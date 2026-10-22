// EVERY CARD READS THE PREMIUM THE SAME WAY.
//
// 22 Oct 2026. One door - lib/lmi.ts - and callers kept handing it a list of
// named fields instead of the borrowing capacity. A field list cannot carry a
// field it does not name, so when the premium moved onto each security on
// 20 Oct every one of those callers went blind.
//
// FABIO'S RULES, 22 Oct 2026. Do not re-derive these from the code:
//
//   OO purchase            yes
//   Investment purchase    yes
//   Custom                 yes
//   Construction           yes
//   Top up + purchase      yes
//   Investment + equity    yes
//   Buy and sell           potentially - treat as yes
//   SMSF                   NO - never
//   Bridging               NO - never
//   First home buyer       NO - that template IS the 5% Government scheme
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const route = readFileSync('app/api/generate-email/route.ts', 'utf8')
const lines = route.split('\n')

// Every purchase card in the email route, with the template it sits under.
function cards() {
  const out: { line: number; template: string; block: string }[] = []
  lines.forEach((l, i) => {
    if (!/purchase(Block|Column)\(\{/.test(l)) return
    const after = lines.slice(i, i + 18).join('\n')
    const block = after.slice(0, after.indexOf('})') + 2)
    let template = 'shared'
    for (let j = i; j > Math.max(0, i - 130); j--) {
      const m = lines[j].match(/template === '([a-z_]+)'/)
      if (m) { template = m[1]; break }
    }
    out.push({ line: i + 1, template, block })
  })
  return out
}

// The three that must never carry a premium.
const NEVER = ['smsf', 'bridging', 'fhb']

describe('the cards that can carry a premium', () => {
  it('every one of them passes the record, not a field list', () => {
    for (const c of cards()) {
      if (NEVER.includes(c.template)) continue
      expect(c.block, `${c.template} card at route.ts:${c.line} does not pass lmiFrom.\n`
        + 'Pass the borrowing capacity whole. A field list cannot carry a field\n'
        + 'it does not name, which is how every card went blind when the premium\n'
        + 'moved onto the securities. See lmiFrom in lib/purchase-rows.ts.')
        .toContain('lmiFrom')
    }
  })

  it('and none of them names the LMI boxes by hand any more', () => {
    for (const c of cards()) {
      if (NEVER.includes(c.template)) continue
      expect(c.block, `${c.template} card at route.ts:${c.line} names lmiApplicable`)
        .not.toContain('lmiApplicable:')
    }
  })
})

describe('the three that never carry one', () => {
  it('SMSF has no LMI - a self managed super fund never does', () => {
    const c = cards().find(x => x.template === 'smsf')!
    expect(c.block).not.toContain('lmiFrom')
  })

  it('bridging has no loan row for a premium to attach to', () => {
    const c = cards().find(x => x.template === 'bridging')!
    expect(c.block).not.toContain('lmiFrom')
    expect(c.block).toContain("loan: ''")
  })

  it('first home buyer is the scheme, and says so itself', () => {
    const c = cards().find(x => x.template === 'fhb')!
    expect(c.block).not.toContain('lmiFrom')
    expect(route).toContain("row('LMI', 'Waived under Gov. Deposit Scheme')")
  })
})

describe('the milestone emails and the offer accepted screen', () => {
  it('pass the record too', () => {
    expect(readFileSync('lib/milestone-figures.ts', 'utf8')).toContain('lmiFrom: bc,')
    expect(readFileSync('components/OfferAccepted.tsx', 'utf8')).toContain('lmiFrom: d.bc_data,')
  })
})

// ---------------------------------------------------------------------------
// AND THE LAST THREE PLACES, 22 Oct 2026.
//
// The cards were only the visible half. The LVR line, the alternative-scenario
// columns and the Option 1 object beside them each read the deal-level boxes
// by name, so a premium recorded against a security was invisible to all three
// as well.
// ---------------------------------------------------------------------------
describe('the LVR line', () => {
  it('is gated on the premium itself, not on two named boxes', () => {
    expect(route).toContain('if (lmiAmount(d) !== null) {')
    expect(route).not.toContain("d.lmiApplicable === 'Applicable' && d.lmi")
  })

  it('and hands the whole deal to the words it prints', () => {
    expect(route).toContain('lmiClientLines(d, base > 0 ? base : null)')
  })

  it('a premium waived on a security still reads as waived', () => {
    expect(route).toContain('securityLmiApplicable || {}')
  })
})

describe('the comparison columns', () => {
  it('Option 1 is built through the one helper that knows every field', () => {
    expect((route.match(/\.\.\.lmiKeys\(d\),/g) || []).length).toBe(3)
  })

  it('and an alternative is passed whole, not three of its fields', () => {
    expect(route).toContain('{ ...(opt || {}), lmiTreatment: treatment }')
  })

  it('lmiKeys carries the per-security maps as well as the old boxes', () => {
    const src = readFileSync('lib/lmi.ts', 'utf8')
    const i = src.indexOf('export function lmiKeys')
    const fn = src.slice(i, i + 500)
    for (const k of ['lmiApplicable', 'lmi:', 'lmiTreatment',
                     'securityLmiApplicable', 'securityLmi:', 'securityLmiTreatment']) {
      expect(fn, `lmiKeys does not carry ${k}`).toContain(k)
    }
  })
})

describe('nothing in the email route names the LMI boxes by hand any more', () => {
  it('not one', () => {
    // ONE EXEMPTION, AND ONLY ONE. The SMSF card keeps its old field list
    // because an SMSF never carries a premium - Fabio, 22 Oct 2026, "Self
    // managed super fund, no". Leaving it is the smaller change than taking
    // its fields away, and nothing reads them on a deal that has no LMI.
    const smsf = cards().find(c => c.template === 'smsf')!
    const named = route.split('\n')
      .map((l, i) => ({ l, i: i + 1 }))
      .filter(x => /lmiApplicable:\s*[a-z]\w*\??\./i.test(x.l))
      .filter(x => !smsf.block.includes(x.l.trim()))
    expect(named.map(x => `route.ts:${x.i}`), 'use lmiKeys(), or pass the record')
      .toEqual([])
  })
})
