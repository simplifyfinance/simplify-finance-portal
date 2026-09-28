// THE NUMBER THE LENDER CALLS THIS APPLICATION.
//
// Fabio, 28 Sep 2026. ANZ want their acknowledgement sent to
// assessmentmail@anz.com with the loan reference as the subject, and the portal
// had nowhere to hold one. Asked for when a deal is marked Lodged, because that
// is when the lender issues it - and "for all deals", not only ANZ ones.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('the box at lodgement', () => {
  const src = read('../app/(app)/deals/[id]/DealSettlement.tsx')
  const code = strip(src)

  it('is on the lodged form and nowhere else', () => {
    expect(code).toContain("{stage.snap === 'lodged' && (")
    expect(code).toContain('setLenderRef')
  })

  it('is asked on every deal, not only ANZ', () => {
    // A lender name anywhere near the box would mean somebody had gated it.
    const at = code.indexOf('lenderRef} placeholder')
    expect(at).toBeGreaterThan(-1)
    expect(code.slice(Math.max(0, at - 700), at)).not.toContain("'anz'")
  })

  it('shows what is already recorded when you open it again', () => {
    expect(code).toContain('setLenderRef(deal.lender_reference')
  })

  // MARKING A DEAL LODGED TWICE MUST NOT WIPE IT. Somebody may have filled it in
  // from the offer-accepted panel in between.
  it('writes a reference but never blanks one', () => {
    expect(code).toContain('if (lenderRef.trim()) patch.lender_reference = lenderRef.trim()')
  })
})

describe('a deal lodged before the box existed can still catch up', () => {
  const code = strip(read('../components/OfferAccepted.tsx'))

  it('the offer-accepted panel can record it too', () => {
    expect(code).toContain("onBlurField('lender_reference')")
  })
})

// IT IS NOT THE LOAN ID, and the two must never be confused. The Loan ID is the
// account number the bank issues at settlement - empty on every deal at the
// point an offer is accepted - and it lives on the split. Fabio, 1 Sep 2026:
// "once contracts are issued and loan settles our team contacts the bank and
// manually input the Loan ID."
describe('it is kept apart from the Loan ID', () => {
  it('nothing reads a loan id to fill the reference', () => {
    const oa = strip(read('../components/OfferAccepted.tsx'))
    const ds = strip(read('../app/(app)/deals/[id]/DealSettlement.tsx'))
    const at = ds.indexOf('patch.lender_reference')
    expect(ds.slice(Math.max(0, at - 400), at)).not.toContain('loanId')
    expect(oa).not.toContain('loanId')
  })

  it('and the loan id code is untouched by any of this', () => {
    const loanId = read('../lib/loan-id.ts')
    expect(loanId).not.toContain('lender_reference')
  })
})

describe('the column', () => {
  const sql = read('../docs/lender-reference-schema.sql')

  it('is text, because lenders use letters and leading zeroes', () => {
    expect(sql).toContain('add column if not exists lender_reference text')
  })

  it('can be run twice', () => {
    expect(sql).toContain('if not exists')
  })

  it('and says in the database itself what it is not', () => {
    expect(sql).toContain('comment on column deals.lender_reference')
    expect(sql).toContain('Not the Loan ID')
  })
})
