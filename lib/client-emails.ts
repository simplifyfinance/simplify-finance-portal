// WHO THE CLIENT EMAILS GO TO.
//
// Every applicant on the fact find who has an address, falling back to the
// client record where the fact find has none. The BC email and the lending
// options email have both worked this way for months; this is the same answer
// in one place so a third copy never gets written.
//
// DE-DUPLICATED, because a couple who share an address should get one email
// rather than two identical ones.

// looksLikeEmail is imported rather than repeated. lib/other-side.ts has held
// the only definition of "is this actually an address" since the solicitor and
// buyers agent work, and a second copy here is how the copy line and the To line
// would start disagreeing about the same address.
import { looksLikeEmail } from './other-side'

const txt = (v: any) => String(v ?? '').trim()

export function clientEmails(deal: any): string[] {
  const ff = deal?.fact_find_data || {}
  const fromFactFind = (ff.applicants || [])
    .map((a: any) => txt(a?.emailPersonal))
    .filter(looksLikeEmail)
  const all = fromFactFind.length ? fromFactFind
    : [txt(deal?.clients?.email)].filter(looksLikeEmail)
  return [...new Set<string>(all)]
}

// "Alexis and Daniel" - first names, for the greeting. The email says hello to
// people, not to a deal name.
export function clientFirstNames(deal: any): string {
  const ff = deal?.fact_find_data || {}
  const names = (ff.applicants || [])
    .map((a: any) => txt(a?.firstName))
    .filter(Boolean)
  const list: string[] = names.length ? [...new Set<string>(names)]
    : [txt(deal?.clients?.first_name)].filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}
