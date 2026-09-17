// WHO SHARES A KITCHEN.
//
// Fabio, 17 Sep 2026: "I need you to be able to allow us to do a loan for 2
// parties that are not married or de facto... dependants allocates to both and
// when we get to living expenses in Compliance it is one household."
//
// Two people buying together who are not a couple share a loan, not a home. A
// lender assesses them as two households - their own dependants, their own
// living expenses, their own HEM benchmark. Until now the portal had one of
// each, so the file we hand the lender said one household and the assessment
// underneath it was wrong for at least one of them.
//
// WHAT THIS DOES NOT DO, AND THE REASON.
//
// It does not move the dependants number. Nineteen files read
// fact_find_data.dependants today - the BC checklist, four compliance boxes, the
// handover, the summary PDF. Pulling that out from under them to make room for a
// per-household number would be a large change to everything in exchange for a
// case that is rare. So the total stays exactly where it is and stays correct,
// and the per-household numbers sit alongside it. A one-household deal - which
// is almost all of them - reads identically to the way it reads today, byte for
// byte, and that is what makes this safe to put into a book of live deals.

const txt = (v: any) => String(v ?? '').trim()

// Three. Fabio, 17 Sep 2026: "no more than 3 is ever needed." A limit is not a
// restriction here, it is what keeps the screen readable - twenty-two expense
// categories times four would be a page nobody checks properly.
export const MAX_HOUSEHOLDS = 3

export type HouseholdId = '1' | '2' | '3'
export const HOUSEHOLD_IDS: HouseholdId[] = ['1', '2', '3']

// Everyone is in household 1 until somebody says otherwise. A blank is not a
// missing answer to chase - it is the ordinary case.
export function householdOf(applicant: any): HouseholdId {
  const h = txt(applicant?.household)
  return (HOUSEHOLD_IDS as string[]).includes(h) ? (h as HouseholdId) : '1'
}

export type Household = {
  id: HouseholdId
  // In the order they appear on the deal, so Applicant 1 leads.
  people: { id: string; name: string }[]
  dependants: string
}

// THE SAME NAME COMPLIANCE USES, not a friendlier one.
//
// The living expense percentages are keyed by applicant name, and that name is
// built by applicantsOf() in lib/applicants.ts as first and last together. A
// household that called the same person "Emma" would not line up with a column
// called "Emma Byrnes", and the percentages would quietly land nowhere.
const nameOf = (a: any, i: number) => {
  const full = `${txt(a?.firstName)} ${txt(a?.lastName)}`.trim()
  return full || `Applicant ${i + 1}`
}

// Every household that has somebody in it, in order. Never empty: a deal with
// no applicants still has household 1, because that is what the screen draws.
export function householdsOf(ff: any): Household[] {
  const apps: any[] = Array.isArray(ff?.applicants) ? ff.applicants : []
  const out: Household[] = []
  for (const id of HOUSEHOLD_IDS) {
    const people = apps
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => householdOf(a) === id)
      .map(({ a, i }) => ({ id: txt(a?.id) || `a${i}`, name: nameOf(a, i) }))
    if (people.length === 0 && id !== '1') continue
    out.push({ id, people, dependants: dependantsFor(ff, id) })
  }
  return out
}

export function householdCount(ff: any): number {
  return householdsOf(ff).length
}

// The ordinary deal. Everything new stays off the screen while this is true.
export function isOneHousehold(ff: any): boolean {
  return householdCount(ff) <= 1
}

// --- dependants -------------------------------------------------------------
//
// The deal total is the number every existing reader uses and it stays the
// truth. Per household is recorded separately and, on a deal that uses them,
// must add up to it - see keepTotalInStep.

export function dependantsFor(ff: any, id: HouseholdId): string {
  const per = ff?.householdDependants
  if (per && txt(per[id]) !== '') return txt(per[id])
  // Nothing recorded per household yet: household 1 carries the deal's number,
  // which is where it has always been, and the others start at none.
  return id === '1' ? (txt(ff?.dependants) || '0') : '0'
}

export function totalDependants(ff: any): number {
  if (isOneHousehold(ff)) return Number(txt(ff?.dependants) || '0') || 0
  return householdsOf(ff).reduce((n, h) => n + (Number(h.dependants) || 0), 0)
}

// Set one household's dependants and hand back BOTH fields to write: the per
// household map, and the deal total kept in step with it. The total is not a
// second opinion - it is the sum, so nothing downstream can quote a number the
// households disagree with.
export function setDependants(ff: any, id: HouseholdId, value: string):
    { householdDependants: Record<string, string>; dependants: string } {
  const per: Record<string, string> = { ...(ff?.householdDependants || {}) }
  per[id] = txt(value)
  const next = { ...ff, householdDependants: per }
  return { householdDependants: per, dependants: String(totalDependants(next)) }
}

// --- moving somebody --------------------------------------------------------

// Can another household be opened? Only while there is somebody left who could
// move into it - a household with nobody in it is not a household.
export function canAddHousehold(ff: any): boolean {
  const apps: any[] = Array.isArray(ff?.applicants) ? ff.applicants : []
  if (apps.length < 2) return false
  const used = householdCount(ff)
  if (used >= MAX_HOUSEHOLDS) return false
  // Somebody has to be able to leave: a household of one cannot empty itself.
  return householdsOf(ff).some(h => h.people.length > 1)
}

export function nextHouseholdId(ff: any): HouseholdId | null {
  const used = new Set(householdsOf(ff).map(h => h.id))
  return HOUSEHOLD_IDS.find(id => !used.has(id)) || null
}

// --- the suggestion ---------------------------------------------------------
//
// Offered, never applied. Fabio asked for it to be pointed out rather than
// waited for: two applicants both recorded as Single, all under one roof, is
// usually two households that nobody has told the portal about.

export function suggestSecondHousehold(ff: any): boolean {
  if (txt(ff?.householdsDismissed) === 'yes') return false
  const apps: any[] = Array.isArray(ff?.applicants) ? ff.applicants : []
  if (apps.length < 2) return false
  if (!isOneHousehold(ff)) return false
  // Anybody partnered to anybody else is a couple, and couples are one home.
  if (apps.some(a => txt(a?.relatedToApplicantId))) return false
  // Every one of them has to have actually answered, and answered Single. A
  // blank is not evidence of anything and must not raise a suggestion.
  return apps.every(a => /^single$/i.test(txt(a?.relationshipStatus)))
}
