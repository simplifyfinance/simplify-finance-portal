// WHO THESE PEOPLE ARE TO EACH OTHER.
//
// It goes on the broker notes PDF, under "Relationship of applicants", because
// a lender wants to know whether two people on a loan are a couple, siblings,
// or business partners. The portal recorded it nowhere.
//
// Two fields, both on the applicant:
//
//   relationshipStatus     single, married, de facto, ...
//   relatedToApplicantId   WHICH other applicant, when the status implies one
//
// The id, never the name. Fabio, 3 Sep 2026: "once the names are completed, then
// that drop down box on the first section, you will actually just copy the
// name." Storing the id and rendering the name gets that for free and survives
// the case that a copied name would not: applicant two is very often added
// before anybody has typed who they are, and renaming them later would leave
// applicant one married to somebody who no longer exists.

export const RELATIONSHIP_STATUSES = [
  'Single',
  'Married',
  'De facto',
  'Separated',
  'Divorced',
  'Widowed',
] as const

// The ones that are ABOUT somebody else, so the second dropdown appears.
const PAIRED = ['Married', 'De facto', 'Separated']

export function needsPartner(status: string | null | undefined): boolean {
  return PAIRED.includes(String(status || '').trim())
}

const txt = (v: any) => String(v ?? '').trim()
const nameOf = (a: any): string =>
  [a?.firstName, a?.lastName].map(txt).filter(Boolean).join(' ')

// What to show in the "to whom" dropdown. Everyone else on the deal, named -
// and named "Applicant 2" until somebody types who they are, rather than
// offered as a blank line you cannot tell apart from the others.
export function partnerOptions(applicants: any[], selfId: string): { id: string; label: string }[] {
  return (applicants || [])
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => txt(a?.id) !== txt(selfId))
    .map(({ a, i }) => ({ id: txt(a?.id), label: nameOf(a) || `Applicant ${i + 1}` }))
}

// MIRRORED, because it is a fact about a pair and cannot be true one way only.
// Fabio, 3 Sep 2026: "applicant two, we don't have to worry about it" - he
// should not have to type it twice, and a file saying applicant one is married
// to applicant two while applicant two says single is a file with a mistake in
// it that nobody will notice.
//
// Setting a status with no partner (single, divorced, widowed) clears the link
// but leaves the other person's own status alone - being single is not a claim
// about anybody else.
export function applyRelationship(applicants: any[], selfId: string,
                                  status: string, partnerId: string): any[] {
  const wantsPartner = needsPartner(status)
  const partner = wantsPartner ? txt(partnerId) : ''

  return (applicants || []).map(a => {
    const id = txt(a?.id)

    if (id === txt(selfId)) {
      return { ...a, relationshipStatus: status, relatedToApplicantId: partner }
    }

    // The person just named. They get the same status, pointing back.
    if (partner && id === partner) {
      return { ...a, relationshipStatus: status, relatedToApplicantId: txt(selfId) }
    }

    // Somebody who WAS named and no longer is - their half of the old pairing
    // has to go, or the deal keeps a marriage nobody is in.
    if (txt(a?.relatedToApplicantId) === txt(selfId)) {
      return { ...a, relatedToApplicantId: '' }
    }

    return a
  })
}

// The line the broker notes PDF prints. Empty when there is nothing to say -
// one applicant, or nobody has answered - because a blank field under a
// printed label reads as an unfinished form.
export function relationshipLine(applicants: any[]): string {
  const apps = (applicants || []).filter(a => nameOf(a))
  if (apps.length < 2) return ''

  const byId = new Map(apps.map(a => [txt(a?.id), a]))
  for (const a of apps) {
    const status = txt(a?.relationshipStatus)
    if (!needsPartner(status)) continue
    const other = byId.get(txt(a?.relatedToApplicantId))
    if (!other) continue
    return `${status} — ${nameOf(a)} and ${nameOf(other)}`
  }

  // No pairing recorded, but everybody has said something about themselves.
  const stated = apps.map(a => txt(a?.relationshipStatus)).filter(Boolean)
  if (stated.length === apps.length && new Set(stated).size === 1) return stated[0]
  return ''
}
