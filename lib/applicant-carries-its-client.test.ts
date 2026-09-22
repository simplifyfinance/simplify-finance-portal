import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// AN APPLICANT WITHOUT A CLIENT RECORD IS INVISIBLE TO THE BOOK.
//
// 21 Sep 2026. Every write of a client's financial position - the assets, the
// liabilities, the properties, the thing the whole client database is to be
// built out of - is gated on one field:
//
//     applicants.filter(a => a.clientId)
//
// A deal started from a NEW client was creating the client record and then
// building its applicant with `undefined` in that field, three lines below the
// id it needed. So the position prompt never appeared, nothing was ever written,
// and nobody could tell: no error, no message, just an empty list and a silent
// skip. It had been that way since the screen was written.
//
// This test is the rule now. A deal's applicants must carry the id of their
// client record, or the book cannot be built.

const deals = readFileSync('app/(app)/deals/page.tsx', 'utf8')

describe('a new deal links its applicants to their client records', () => {
  it('the first applicant is given the client id, whether the client is new or existing', () => {
    // The old line. If it ever comes back, so does the silent skip.
    expect(deals, 'the first applicant is linked only for existing clients again')
      .not.toContain("mode === 'existing' ? clientId : undefined")
    expect(deals, 'the first applicant is not handed the client id at all')
      .toMatch(/makeApplicant\(primaryFirstName, primaryLastNameVal, primaryEmail, primaryPhone, clientId\)/)
  })

  it('a new second applicant gets a client record of their own', () => {
    expect(deals, 'a second applicant who is new to us is never written to the book')
      .toContain('secondClientId')
    expect(deals, 'the second applicant is not handed a client id')
      .toMatch(/makeApplicant\(form2\.first_name, form2\.last_name, form2\.email, form2\.phone, secondClientId\)/)
  })

  it('the deal itself still points at the client, as it always did', () => {
    expect(deals).toContain('client_id: clientId,')
  })
})

describe('the two places that write a position still read that field', () => {
  // If either of these stops gating on clientId the test above stops mattering,
  // and whoever changed it should find out here rather than in six weeks.
  const compliance = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')
  const close = readFileSync('app/(app)/deals/[id]/CloseDeal.tsx', 'utf8')

  it('the compliance push reads it', () => {
    expect(compliance).toMatch(/applicants \|\| \[\]\)\.filter\(\(a: any\) => a\.clientId\)/)
  })

  it('the close panel reads it', () => {
    expect(close).toMatch(/applicants \|\| \[\]\)\.filter\(\(a: any\) => a\?\.clientId\)/)
  })
})
