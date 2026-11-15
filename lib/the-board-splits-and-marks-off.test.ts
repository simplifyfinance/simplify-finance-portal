// SUB-TABS ON THE BOARD, AND MARKING THINGS OFF WITHOUT OPENING THE DEAL.
//
// 17 Nov 2026. Fabio: "we have build deal card with magnifying glass ability
// for a reason for example so we can quickly marking thinghs off whitout having
// to get into deal... lets build productivity."
//
// And, on the quick look being one way of doing it rather than the way:
// "remeber its an option but not a rule as we can still do the same inside the
// deal card."
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const code = (f: string) => readFileSync(f, 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const BOARD = code('components/DealBoard.tsx')
const PEEK = code('components/DealPeek.tsx')
const STRIP = code('components/PeekSettlement.tsx')

describe('the board splits three columns and leaves the rest alone', () => {
  it('it asks one place which columns split', () => {
    expect(BOARD).toContain('hasSubTabs(p)')
    expect(BOARD).toContain('cardsOn(colCards, p as SplitColumn, tab)')
  })

  // A FILTER MUST NEVER MAKE THE BOARD LOOK EMPTIER THAN THE BOOK IS.
  it('and the headline count, the money and the chase count stay the whole column', () => {
    expect(BOARD).toContain('countLabel(p, colCards.length)')
    expect(BOARD).toContain('colCards.reduce((t, d) => t + (amountOf(d) || 0), 0)')
    expect(BOARD).toContain("colCards.filter(d => ageGroupOf(d, thresholds) === 'nudge')")
  })

  it('a filtered column says what it is showing', () => {
    expect(BOARD).toContain('showingWords(cards.length, colCards.length, tab)')
  })

  // "PLEASE RESET EACH MORNING SO THAT IT SHOWS ALL DEAL CARDS IN EACH SUB
  // TAB." - Julian Kok, and Belle agreeing. A remembered filter costs the one
  // morning somebody opens the board, sees four cards and thinks the book has
  // emptied.
  it('and the chosen tab is never remembered between visits', () => {
    expect(BOARD).toContain('const [subTab, setSubTab] = useState<Record<string, string>>({})')
    const near = BOARD.slice(BOARD.indexOf('const [subTab'), BOARD.indexOf('const [subTab') + 900)
    expect(near, 'a remembered sub-tab is the thing both of them asked against')
      .not.toContain('localStorage')
  })

  it('the dot on a tab is the step’s own clock, not the column’s', () => {
    expect(BOARD).toContain('isOverdue(d, settlementChase.chase)')
  })
})

describe('the quick look can mark things off', () => {
  it('the strip is on it, and only on a deal that is on a step', () => {
    expect(PEEK).toContain('<PeekSettlement deal={deal} onSaved={onSaved} />')
    expect(STRIP).toContain('if (!step) return null')
  })

  // RLS REFUSES A WRITE BY RETURNING NO ROWS AND NO ERROR. One door.
  it('and every write goes through the one door', () => {
    expect(STRIP).toContain('checkedWrite(')
    expect(STRIP, 'a bare update cannot tell success from total failure')
      .not.toMatch(/await supabase\.from\('deals'\)\.update\([^)]*\)\.eq\([^)]*\)\s*$/m)
  })

  it('1 to 9 tick, Enter moves on', () => {
    expect(STRIP).toContain("e.key >= '1' && e.key <= '9'")
    expect(STRIP).toContain("e.key === 'Enter'")
  })

  // LEFT AND RIGHT ALREADY WALK THE COLUMN, and that stays where it was.
  it('and the arrows are left exactly where they were', () => {
    expect(PEEK).toContain("e.key === 'ArrowLeft'")
    expect(PEEK).toContain("e.key === 'ArrowRight'")
    expect(STRIP, 'two handlers fighting over the arrow keys is a bug waiting')
      .not.toContain('ArrowRight')
  })

  it('nothing fires while somebody is typing', () => {
    expect(STRIP).toContain('/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)')
  })

  // THE OLD RULE WAS ABOUT HALF RECORDS, and it is kept exactly where it earns
  // its place: a tick is one boolean, a move to Settlement Booked needs a date.
  it('and it still refuses a move that needs data', () => {
    expect(STRIP).toContain('cannotMoveBecause(d, to)')
    expect(STRIP).toContain('Open the deal to add it.')
  })

  it('a derived item cannot be pressed, and gets no key', () => {
    expect(STRIP).toContain('items.filter(i => !i.derived)')
  })

  // A SCREEN THAT DISAGREES WITH ITSELF IS WORSE THAN ONE THAT MADE YOU OPEN
  // THE DEAL.
  it('and what was ticked reaches the card behind it', () => {
    expect(PEEK).toContain('onSaved?: (patch: Record<string, any>) => void')
    expect(BOARD).toContain('onSaved={patch => setPatched(')
  })
})
