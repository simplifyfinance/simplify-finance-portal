// THE OTHER TWO DOCUMENTS, READ AND NOT KEPT.
//
// 17 Nov 2026. Fabio: "we dont need to store the documents after reading but
// obviously we retain all data." The same promise the loan contracts make, kept
// by the same means - so it is guarded the same way.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const code = (f: string) => readFileSync(f, 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const ROUTE = readFileSync('app/api/read-settlement-document/route.ts', 'utf8')
const BOX = code('components/TheOtherDocuments.tsx')
const PANEL = code('app/(app)/deals/[id]/DealSettlementPanel.tsx')

describe('the reader', () => {
  it('is told not to guess, in both prompts', () => {
    expect(ROUTE).toContain('DO NOT GUESS OR INVENT ANY VALUE')
    expect(ROUTE).toContain('A missing value is useful; a wrong one is dangerous')
  })

  // A NAME PRINTED ON A FORM IS NOT A SIGNATURE, and a pack returned unsigned
  // is exactly the thing this is for.
  it('knows a printed name is not a signature', () => {
    expect(ROUTE).toContain('A name PRINTED on a form is not a signature')
  })

  // THE BLANK BOX IS THE FINDING. Filling it with the insured's name would
  // turn the most common reason a settlement is pulled into a pass.
  it('and leaves a blank interested party blank', () => {
    expect(ROUTE).toContain('do not fill it with the insured')
  })

  it('and takes the END of a period of cover, not its start', () => {
    expect(ROUTE).toContain('is NOT the expiry')
  })

  it('a document too long to read says so plainly', () => {
    expect(ROUTE).toContain("stop_reason === 'max_tokens'")
    expect(ROUTE).toContain('Nothing has been recorded')
  })

  it('and a kind of document it does not know is refused, not guessed at', () => {
    expect(ROUTE).toContain('That is not a document this reader knows about')
  })
})

describe('the file is read and not kept', () => {
  it('nothing is uploaded anywhere', () => {
    for (const never of ['storage.from(', 'upload(', 'deal_statement_uploads']) {
      expect(BOX, `${never} would keep the document`).not.toContain(never)
      expect(ROUTE, `${never} would keep the document`).not.toContain(never)
    }
  })

  it('and what it said is written onto the deal with who and when', () => {
    expect(BOX).toContain('settlement_documents')
    expect(BOX).toContain("at: new Date().toISOString(), by: me?.name || ''")
  })

  // RLS REFUSES A WRITE BY RETURNING NO ROWS AND NO ERROR.
  it('through the one door', () => {
    expect(BOX).toContain('checkedWrite(')
  })

  it('a new drop clears the answers, because they were about another document', () => {
    expect(BOX).toContain('answers: {}')
  })
})

// THESE ARE NOT THE CONTRACT CHECK. Nothing here is measured against the formal
// approval, and nothing here holds an email.
describe('what these two are not', () => {
  it('they are not checked against the formal approval', () => {
    expect(BOX).not.toContain('expectedFromFormal')
    expect(BOX).not.toContain('formalSnapshot')
  })

  it('and they hold nothing up', () => {
    expect(BOX).toContain('nothing is held up by this')
    expect(BOX, 'only the loan contract holds the loan documents email')
      .not.toContain('The loan documents email is held')
  })
})

describe('what each one is checked against', () => {
  // The offset is a fact about this loan, not about what a handover said.
  it('the signed pack against the deal\'s own borrowers and its offset', () => {
    expect(BOX).toContain('borrowers: borrowersOf(d)')
    expect(BOX).toContain('hasOffset: hasOffset(option?.offsetAccount)')
  })

  it('the certificate against the security, the lender and the settlement date', () => {
    expect(BOX).toContain('settlesOn: settlementDate(d)')
    expect(BOX).toContain('securityFor(securities,')
  })

  // Belle: "lenders will generally only require either building insurance or
  // strata, depending on the property type."
  it('and which certificate is never a question anybody is asked', () => {
    expect(BOX).toContain('certificateFor(about?.subtype)')
    expect(BOX, 'land has no building to insure').toContain("needs !== 'none'")
  })
})

describe('where they sit', () => {
  it('on the settlement panel, on a deal that is on a step', () => {
    expect(PANEL).toContain('<TheOtherDocuments deal={d} me={me}')
  })

  // They arrive at different steps, and stay visible afterwards - somebody
  // looking at a booked settlement still wants to see what the certificate said.
  it('the pack from Contracts Reviewing, the certificate from Outstandings', () => {
    expect(BOX).toContain("reached(d, 'contracts_reviewing') || !!signed")
    expect(BOX).toContain("reached(d, 'outstandings') || !!insurance")
  })
})
