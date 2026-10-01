import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'

// THE BROWSER GATE RUNS IN TWO PASSES NOW. THIS IS WHAT STOPS THAT COSTING US A
// SPEC THAT QUIETLY NEVER RUNS.
//
// 1 Oct 2026. Six ships in a day at ten minutes of browser check each. The log
// said where it went: tab-switch 197s of the 600, and the four specs that build
// their own deals another 110. Those two groups do not touch the shared deal in
// a way that collides, so they run at once; everything else stays serial.
//
// The danger is not a flake. It is a spec added next month that is in neither
// list and is never run again - a gate that silently stops gating. So the
// serial list is worked out by SUBTRACTION from the folder, and these tests
// fail the build if that ever stops being true.

const script = readFileSync('scripts/check-browser.sh', 'utf8')
const specs = readdirSync('tests/browser').filter(f => f.endsWith('.spec.ts'))

// The fast list, read out of the script itself rather than written down twice.
const fast = (script.match(/FAST_SPECS="([\s\S]*?)"/)?.[1] || '')
  .split(/\s+/).map(s => s.trim().replace(/\\$/, '')).filter(Boolean)
  .map(p => p.replace('tests/browser/', ''))

describe('every spec still runs', () => {
  it('and the fast list names real files', () => {
    expect(fast.length).toBeGreaterThan(0)
    for (const f of fast) {
      expect(specs, `${f} is in FAST_SPECS but not in tests/browser`).toContain(f)
    }
  })

  // THE ONE THAT MATTERS. The serial group is the folder minus the fast list, so
  // a new spec lands in it without anybody remembering. Naming the serial specs
  // instead would mean a new one runs nowhere.
  it('the serial group is the folder minus the fast list, not a list of its own', () => {
    expect(script).toContain('for spec in tests/browser/*.spec.ts; do')
    expect(script).toContain('case " $FAST_SPECS " in *" $spec "*) ;; *) REST_SPECS="$REST_SPECS $spec" ;; esac')
    // No second hard-coded list hiding anywhere.
    expect(script).not.toMatch(/REST_SPECS="tests\/browser/)
  })

  it('and both groups are actually run', () => {
    expect(script).toContain('npx playwright test $FAST_SPECS')
    expect(script).toContain('npx playwright test $REST_SPECS')
  })
})

describe('a failure in either pass still fails the ship', () => {
  // The first group failing must not be forgotten because the second passed.
  it('the first result is kept when the second is green', () => {
    expect(script).toContain('if [ $RESULT -eq 0 ]; then RESULT=$SECOND; fi')
  })

  it('and the count is both passes added up, not the last line', () => {
    expect(script).toContain("awk '{n+=$1} END {print n}'")
    expect(script).not.toContain("grep -oE '[0-9]+ passed' .robot-logs/browser-check.log | tail -1")
  })
})

describe('the shared deal is still only touched by one worker at a time', () => {
  // Twelve of the sixteen specs type into PORTAL_TEST_DEAL_ID, and several are
  // about two windows on one record. Those run one at a time, as they always
  // have. Only two kinds are in the fast group:
  //
  //   tab-switch - four tests, four tabs, four DIFFERENT columns of one row
  //   own-data   - specs that build their own deal or touch none
  const ownData = ['wesley.spec.ts', 'settings.spec.ts']

  it('nothing is in the fast group but tab-switch and the own-data specs', () => {
    for (const f of fast) {
      expect(['tab-switch.spec.ts', ...ownData], `${f} shares the test deal and cannot run in parallel`)
        .toContain(f)
    }
  })

  it('and the own-data specs really do not read the shared deal', () => {
    for (const f of ownData) {
      if (!fast.includes(f)) continue
      const src = readFileSync(`tests/browser/${f}`, 'utf8')
      expect(src, `${f} reads PORTAL_TEST_DEAL_ID and is in the fast group`)
        .not.toContain('PORTAL_TEST_DEAL_ID')
    }
  })

  // THE LESSON FROM THE FIRST RUN, WHICH COST A TEN MINUTE SHIP.
  //
  // "It does not read the shared deal" is not the same as "it cannot collide".
  // new-deal looks for a client called ZZROBOT; new-deal-busy creates ZZROBOTTWO
  // and ZZROBOTPARTNER. Both CONTAIN the first name, so a substring match found
  // the wrong deal - and the two specs wrote into each other. It was a coin toss
  // all along; running them one at a time only meant it kept landing right.
  //
  // Every robot that makes its own deal now has to be unmistakable from every
  // other one, by name, whether or not it is in the fast group.
  it('and no robot name can be mistaken for another robot name', () => {
    const names: { spec: string; name: string }[] = []
    for (const f of readdirSync('tests/browser').filter(x => x.endsWith('.spec.ts'))) {
      const src = readFileSync(`tests/browser/${f}`, 'utf8')
      for (const m of src.matchAll(/const\s+\w*FIRST\w*\s*=\s*'(ZZ[A-Z]+)'/g)) {
        names.push({ spec: f, name: m[1] })
      }
    }
    expect(names.length, 'no robot names found - has the naming changed?').toBeGreaterThan(1)
    for (const a of names) {
      for (const b of names) {
        if (a.spec === b.spec || a.name === b.name) continue
        // Within one spec a longer name is fine - it knows about its own. Across
        // specs it is not: one robot's search finds the other robot's deal.
        expect(b.name.startsWith(a.name),
          `${b.spec}'s ${b.name} starts with ${a.spec}'s ${a.name} - one can find the other's deal`)
          .toBe(false)
      }
    }
  })

  // And where one name does contain another inside a single spec, the search
  // has to be anchored so it cannot match the longer one.
  it('and the search that found the wrong deal is anchored', () => {
    const src = readFileSync('tests/browser/new-deal.spec.ts', 'utf8')
    expect(src).toContain('${ROBOT_FIRST}(?![A-Z])')
  })

  // tab-switch's four tests are safe BECAUSE each writes a different column. If
  // somebody adds a fifth tab to that list, two tests could land on one column.
  it('and tab-switch still covers four different tabs, one column each', () => {
    const src = readFileSync('tests/browser/tab-switch.spec.ts', 'utf8')
    const tabs = src.match(/const TABS = \[([\s\S]*?)\]/)?.[1] || ''
    const names = tabs.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    expect(names).toEqual(['Lending options', 'BC — Borrowing capacity', 'Compliance', 'Fact Find'])
    expect(new Set(names).size, 'two tab-switch tests would write the same column').toBe(names.length)
  })
})

describe('and there is a way to prove it was not the parallelism', () => {
  it('SERIAL=1 runs the old way, one worker, everything', () => {
    expect(script).toContain('if [ -n "${SERIAL:-}" ]; then')
    expect(script).toContain('SERIAL=1 ./scripts/check-browser.sh')
  })
})

describe('a failing log is not overwritten by the next run', () => {
  // 1 Oct 2026: a run failed in the morning, the next run wrote over
  // browser-check.log, and the only record of what broke was gone.
  it('a dated copy is kept beside it', () => {
    expect(script).toContain('.robot-logs/failed-$(date +%Y%m%d-%H%M%S).log')
  })

  it('and nothing deletes the dated copies', () => {
    expect(script).not.toMatch(/rm -rf \.robot-logs\/failed/)
    expect(script).not.toMatch(/rm -rf \.robot-logs"?\s*$/m)
  })
})
