// READING THE CONTRACTS, AND NOT KEEPING THEM.
//
// 17 Nov 2026. Fabio: "the biggest task we have in our team is to make sure the
// rates is correct, the security is correct, the terms is correct... So you
// need to start reading contracts." And on storing them: "we dont need to store
// the documents after reading but obviously we retain all data."
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const code = (f: string) => readFileSync(f, 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const ROUTE = readFileSync('app/api/read-loan-contract/route.ts', 'utf8')
const BOX = code('components/TheContracts.tsx')
const PANEL = code('app/(app)/deals/[id]/DealSettlementPanel.tsx')

describe('the reader', () => {
  // NOTHING IS INVENTED. A missing value is useful; a wrong one is dangerous.
  it('is told not to guess, in the prompt', () => {
    expect(ROUTE).toContain('DO NOT GUESS OR INVENT ANY VALUE')
    expect(ROUTE).toContain('A missing value is useful; a wrong one is dangerous')
  })

  // 360 MONTHS AND 30 YEARS ARE COMPARED AS MONTHS, so the reader must hand
  // back what the contract actually says rather than its own conversion.
  it('and not to convert anything on the way', () => {
    expect(ROUTE).toContain('Do not convert years to months')
  })

  // A COMPARISON RATE IS NOT THE INTEREST RATE, and a compliance note that
  // confuses them has been a real bug in this portal before.
  it('it knows a comparison rate is not the rate', () => {
    expect(ROUTE).toContain('A comparison rate is NOT the interest rate')
  })

  it('several loans come back as several, never merged', () => {
    expect(ROUTE).toContain('Do not merge two loans into one')
    expect(ROUTE).toContain('one entry per loan')
  })

  // A CUT-OFF ANSWER SAYS SO, rather than failing at JSON.parse and reading
  // like a broken portal.
  it('and a document too long to read says so plainly', () => {
    expect(ROUTE).toContain("stop_reason === 'max_tokens'")
    expect(ROUTE).toContain('Nothing has been recorded')
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
})

// "EVERYHTIG PASSES THROUGH FORMAL."
describe('what it is checked against', () => {
  it('the formal approval, always', () => {
    expect(BOX).toContain('formalSnapshot(snapRows)')
    expect(BOX).toContain('expectedFromFormal(d, snap)')
  })

  it('and with no formal approval it says so instead of using something else', () => {
    expect(BOX).toContain('NO_FORMAL')
    expect(BOX, 'the drop is closed until there is something to check against')
      .toContain('disabled={busy || !snap}')
  })

  it('the screen says what it measured against, and when', () => {
    expect(BOX).toContain('checkedAgainst(d, day)')
  })
})

describe('nothing is corrected automatically', () => {
  it('a person says which side is wrong', () => {
    expect(BOX).toContain('ANSWER_WORDS[a]')
    expect(BOX).toContain('void answer(i, l.field, a)')
  })

  // 17 Nov 2026: "you'll confirm when we're sending the confirmation email that
  // everything is correct."
  it('and an unanswered difference holds the client email', () => {
    expect(BOX).toContain('heldBack(lines,')
    expect(BOX).toContain('The loan documents email is held until every difference has been answered')
  })

  it('a new drop clears the answers, because they were about other figures', () => {
    expect(BOX).toContain('answers: {}')
  })
})

describe('where it sits', () => {
  it('on the settlement panel, on a deal that is on a step', () => {
    expect(PANEL).toContain('<TheContracts deal={d} me={me}')
    expect(PANEL).toContain('!d.settled_at && stepOf(d)')
  })
})
