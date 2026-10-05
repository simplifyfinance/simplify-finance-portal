import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { THE_LOOK, built, outstanding, MOCKS } from './the-look'

// EVERY CLAIM IN lib/the-look.ts HAS TO BE TRUE.
//
// The point of the list is that neither of us has to remember whether a piece
// of an approved mock is in the portal. Marking something built without
// building it fails here, which is the only thing that makes the list worth
// anything.

describe('the approved look, piece by piece', () => {
  it('the list is not empty and every entry says where it came from', () => {
    expect(THE_LOOK.length).toBeGreaterThan(0)
    for (const p of THE_LOOK) {
      expect(p.mock, 'every piece names the mock it came from').toBeTruthy()
      expect(p.piece, 'every piece says what it is').toBeTruthy()
    }
  })

  for (const p of THE_LOOK.filter(built)) {
    it(`${p.piece} — is really in the code`, () => {
      const f = p.proof!.file
      expect(existsSync(f), `${f} does not exist, so "${p.piece}" cannot be in it`).toBe(true)
      const src = readFileSync(f, 'utf8')
      expect(src.includes(p.proof!.contains),
        `"${p.piece}" is marked built, but ${f} does not contain ${p.proof!.contains}`).toBe(true)
    })
  }

  // Not a failure - a number. It is how much of the approved look is still only
  // a drawing, and it is meant to go down and never up.
  it('says how much of the approved look is still not built', () => {
    const left = outstanding()
    const done = THE_LOOK.length - left.length
    console.log(`\n  THE LOOK: ${done} of ${THE_LOOK.length} pieces built, ${left.length} to go`)
    for (const p of left) console.log(`    not built - ${p.piece}`)
    expect(left.length).toBeLessThanOrEqual(THE_LOOK.length)
  })
})

// A CARD IS STILL CALLED BY ITS TAB NAME.
//
// The status line lives inside the button, so without an explicit name the
// button is called "Compliance Not started" and anything clicking the tab by
// name - a person using a screen reader, or six of our own browser specs -
// cannot find it. See components/DealTabCards.tsx.
describe('the tab cards answer to their own names', () => {
  const src = readFileSync('components/DealTabCards.tsx', 'utf8')

  it('every card states its name rather than letting the words inside it decide', () => {
    expect(src).toMatch(/aria-label=\{label\}/)
  })
})

// data-compose IS NOT A WAY OUT OF THE TYPING TESTS.
//
// It means one thing: this box is typed into and then added with a button, so
// it holds nothing of its own. If it ever appears on a field that saves itself,
// that field stops being checked for losing work - which is the fault those
// tests exist for. So it is counted, and the count is small and named.
describe('boxes that hold nothing are marked, and only those', () => {
  const ALLOWED = ['components/DealFile.tsx']

  it('only the add-a-note box is marked', () => {
    const { execSync } = require('child_process')
    const hits = execSync(
      `grep -rl 'data-compose' app components || true`, { encoding: 'utf8' },
    ).split('\n').filter(Boolean).sort()
    expect(hits, 'something new was marked as holding nothing - is it really?').toEqual(ALLOWED)
  })
})

// THE RAIL IS ALWAYS THERE, AND A LOCKED DEAL DOES NOT CLOSE IT.
//
// Fabio, 5 Oct 2026: "I want the functionality that even when deal is locked the
// left hand boxes are ALWAYS open, that's how we run the deal card."
//
// Two things have to stay true for that. The rail must be rendered OUTSIDE
// <TabLock>, which is what disables a locked tab, and none of the boxes in it
// may decide for themselves to go quiet when a deal is locked.
describe('the rail stays open on a locked deal', () => {
  const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')

  it('the rail is outside the tab lock', () => {
    const rail = page.indexOf('<DealRail>')
    const open = page.indexOf('<TabLock')
    const shut = page.indexOf('</TabLock>')
    expect(rail, 'the rail is not on the deal page').toBeGreaterThan(-1)
    const inside = rail > open && rail < shut
    expect(inside, 'the rail is inside the tab lock, so locking a deal would close it').toBe(false)
  })

  it('no box in the rail goes quiet when the deal is locked', () => {
    for (const f of ['components/DealRail.tsx', 'components/DealFile.tsx',
                     'components/InternalNotes.tsx', 'components/DocumentsBox.tsx']) {
      expect(readFileSync(f, 'utf8'), `${f} changes what it draws when the deal is locked`)
        .not.toMatch(/isLocked|dealUnlocked/)
    }
  })

  // ONE EXCEPTION, AND IT IS THE RIGHT ONE. The PDF box lets you OPEN a filed
  // document on a locked deal and refuses to let you REMOVE it. That is a
  // locked deal behaving correctly, not the box closing - so what is checked
  // here is that it never bails out of drawing itself.
  it('the PDF box still draws on a locked deal, it only refuses to delete', () => {
    const src = readFileSync('components/DealDocuments.tsx', 'utf8')
    expect(src, 'the PDF box returns nothing when the deal is locked')
      .not.toMatch(/if \(\s*isLocked\([^)]*\)\s*\)\s*return/)
    expect(src).toMatch(/\{!isLocked\(deal\) && \(/)
  })
})

// THE MOCKS THEMSELVES CANNOT GO MISSING.
//
// Every mock named in the list has to be a real file in docs/approved-looks.
// Delete one and the ship stops - which is the whole point, because for weeks
// they lived in an ignored folder with no copy anywhere.
describe('every approved mock is still in the repo', () => {
  const named = [...new Set(THE_LOOK.map(p => p.mock))]

  it('there is at least one', () => {
    expect(named.length).toBeGreaterThan(0)
  })

  for (const m of named) {
    it(`${m} is still there`, () => {
      expect(existsSync(`${MOCKS}/${m}`),
        `${m} is named in the look list but is not in ${MOCKS} - it is the spec, it cannot be deleted`).toBe(true)
    })
  }

  it('and the folder says what each one settles', () => {
    expect(existsSync(`${MOCKS}/README.md`)).toBe(true)
  })
})

// THE DEAL PAGE DOES NOT GAIN NEW STATE THAT LANDS WHILE SOMEBODY IS TYPING.
//
// 5 Oct 2026. The credit officer's name was handed up to the page, so a
// setState landed a moment after the deal loaded and re-rendered the form under
// whoever was typing. The robot caught it: "it survived on screen but never
// reached the database". The page says this hazard out loud in its own comments
// and I added one anyway.
//
// This counts the page's own useState calls. It is allowed to go down. Going up
// means something new is being held here, and the question to answer before
// changing this number is whether it can land while somebody is typing.
describe('the deal page holds no more state than it did', () => {
  it('and anything new has to justify itself', () => {
    const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    const held = (page.match(/useState[<(]/g) || []).length
    expect(held, 'the deal page is holding more state than it was - can it land mid-keystroke?')
      .toBeLessThanOrEqual(12)
  })
})
