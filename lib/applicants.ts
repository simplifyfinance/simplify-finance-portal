// Who is on the deal.
//
// Compliance built this list from the BC: the first applicant from
// bc.firstName, and a second one only if `bc.joint === 'Yes' && bc.jointFirstName`.
// But `jointFirstName` is assembled when the BC email is generated and is NEVER
// written into bc_data - so `bc.jointFirstName` was always undefined, the second
// applicant was never added, and every joint deal has a compliance record naming
// one person.
//
// On the Chapman file that is two people borrowing $1,700,000 with risk
// questions answered for one of them, and a handover that would have gone to the
// lender the same way. Fabio, 2 Sep 2026: "it is always should be both and on
// the handover".
//
// The fact find is where applicants actually live, so that is what is read. The
// BC and the client record are the fallback for a deal whose fact find is empty.

export type Applicant = { name: string; type: 'applicant' }

const full = (first: any, last: any): string =>
  `${String(first || '').trim()} ${String(last || '').trim()}`.trim()

export function applicantsOf(deal: any, bc: any = {}): Applicant[] {
  const ff = deal?.fact_find_data || {}
  const fromFactFind = (ff.applicants || [])
    .map((a: any) => full(a?.firstName, a?.lastName))
    .filter(Boolean)
  if (fromFactFind.length) {
    // De-duplicated, because two applicants typed identically are one person as
    // far as the risk answers are concerned - they are keyed by name.
    return [...new Set<string>(fromFactFind)].map(name => ({ name, type: 'applicant' as const }))
  }

  const single = full(bc?.firstName || deal?.clients?.first_name, bc?.lastName || deal?.clients?.last_name)
  if (single) return [{ name: single, type: 'applicant' }]
  return [{ name: 'Applicant 1', type: 'applicant' }]
}

export function applicantNamesOf(deal: any, bc: any = {}): string[] {
  return applicantsOf(deal, bc).map(a => a.name)
}
