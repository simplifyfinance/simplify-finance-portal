// THE FOURTH DOCUMENT, AND THE FIRST ONE CHRONOLOGICALLY.
//
// Belle, 14 Nov 2026: "Handover and broker notes: to be updated once loan hits
// formal as we will always base our checking with rates, amounts here — and
// mostly I've noticed that these details are often incorrect."
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { REFRESH_AT_FORMAL, lenderLine } from './the-letter-is-the-banks-word'

const code = (f: string) => readFileSync(f, 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const ROUTE = readFileSync('app/api/read-settlement-document/route.ts', 'utf8')
const BOX = code('components/TheFormalLetter.tsx')
const PANEL = code('app/(app)/deals/[id]/DealSettlementPanel.tsx')

describe('the reader', () => {
  it('knows an approval letter by its other names', () => {
    expect(ROUTE).toContain('approval advice, letter of offer or unconditional approval')
  })

  it('is told not to guess', () => {
    expect(ROUTE).toContain('DO NOT GUESS OR INVENT ANY VALUE')
  })

  it('and that a comparison rate is not the rate', () => {
    expect(ROUTE).toContain('A comparison rate is NOT the interest rate')
  })

  // A letter covering four splits is not short, and the contract route learned
  // this the hard way.
  it('a letter gets the same room as a contract', () => {
    expect(ROUTE).toContain("String(kind) === 'formal_letter' ? 8000 : 2000")
  })

  // Conditions of approval are a wall of text and not what this is for.
  it('and is not asked for the conditions', () => {
    expect(ROUTE).toContain('Conditions of approval are not asked for')
  })
})

// THE WHOLE POINT. Every later check measures against what was recorded at
// formal. This measures what was recorded at formal against the bank.
describe('what it is checked against', () => {
  it('the same formal snapshot the contracts are checked against', () => {
    expect(BOX).toContain('formalSnapshot(snapRows)')
    expect(BOX).toContain('expectedFromFormal(d, snap)')
    expect(BOX).toContain('checkContract(')
  })

  it('and with no formal approval recorded it says so', () => {
    expect(BOX).toContain('NO_FORMAL')
    expect(BOX).toContain('disabled={busy || !snap}')
  })

  it('it runs before the contracts on the panel', () => {
    expect(PANEL.indexOf('<TheFormalLetter')).toBeGreaterThan(-1)
    expect(PANEL.indexOf('<TheFormalLetter'),
      'the letter is dropped at Formal and the contracts at Contracts Issued')
      .toBeLessThan(PANEL.indexOf('<TheContracts'))
  })
})

// NOTHING IS REWRITTEN FROM A PDF.
describe('it changes nothing by itself', () => {
  it('it never writes the figures back onto the deal', () => {
    for (const never of ['loan_amount', 'lodged_splits', 'settled_splits', 'deal_stage_snapshots\').upsert']) {
      expect(BOX, `${never} would rewrite the figures from a PDF`).not.toContain(never)
    }
  })

  it('it writes only what the letter said, through the one door', () => {
    expect(BOX).toContain('settlement_documents')
    expect(BOX).toContain('checkedWrite(')
    expect(BOX).toContain("at: new Date().toISOString(), by: me?.name || ''")
  })

  it('and tells a person to correct the deal and mark it formal again', () => {
    expect(BOX).toContain('REFRESH_AT_FORMAL')
    expect(REFRESH_AT_FORMAL).toContain('mark it formally approved again')
    expect(REFRESH_AT_FORMAL).toContain('Nothing here changes the deal on its own')
  })
})

describe('the file is read and not kept', () => {
  it('nothing is uploaded anywhere', () => {
    for (const never of ['storage.from(', 'upload(', 'deal_statement_uploads']) {
      expect(BOX).not.toContain(never)
    }
  })
})

// A LETTER FOR THE WRONG DEAL IS NOT A FIGURE THAT DISAGREES.
describe('the wrong letter', () => {
  it('a different lender is called out as a different lender', () => {
    const line = lenderLine('ING', 'Bankwest')
    expect(line).toContain('The letter is from ING and the deal records Bankwest')
    expect(line).toContain('check this is the right letter for this deal')
  })

  it('and says nothing where either side is blank', () => {
    expect(lenderLine('', 'Bankwest')).toBe('')
    expect(lenderLine('ING', '')).toBe('')
  })

  it('the screen shows it', () => {
    expect(BOX).toContain('lenderDiffers')
    expect(BOX).toContain('sameLenderName(read.lender, snap.lender)')
  })
})
