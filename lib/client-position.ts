// WHAT A CLIENT OWNS, WORKED OUT FROM A DEAL.
//
// A deal's fact find holds one list of properties, one of liabilities and one of
// assets, shared by everybody on the deal. Each item says who owns it. This file
// turns that into one client's own position - and it is the only place that
// decides, so the settlement capture, the client page and anything built later
// cannot drift apart.
//
// 21 Sep 2026: before this, two separate copies of the same idea lived in
// ComplianceForm and CloseDeal, and neither ran at settlement. See
// /home/claude/client-position-audit.md.

// OWNERSHIP IS RECORDED TWO DIFFERENT WAYS, AND ALWAYS HAS BEEN.
//
//   Properties and the loans against them: a PERCENTAGE per applicant, filled
//   in automatically as an even split when the item is created.
//   Liabilities and assets: a TICKBOX per applicant, 'Yes' or blank, and NOT
//   filled in automatically.
//
// So a liability nobody ticks belongs to nobody. Today it silently drops out of
// every applicant's position - the client record ends up missing a car loan that
// is sitting right there on the deal. That is what `unassigned` below is for.
export type Ownership = Record<string, string> | null | undefined

export function ownsIt(ownership: Ownership, applicantId: string): boolean {
  const raw = ownership?.[applicantId]
  if (raw === undefined || raw === null) return false
  const s = String(raw).trim()
  if (s === '') return false
  if (s.toLowerCase() === 'yes') return true
  // A percentage. '0' is somebody explicitly recorded as owning none of it, and
  // is not ownership - it reads as truthy in Javascript, which is how a 0%
  // owner used to end up holding the asset.
  const n = Number(s.replace('%', ''))
  return Number.isFinite(n) && n > 0
}

// The percentage, where one was recorded. Null on a tickbox, because a tickbox
// never said what share - and inventing 50% because there are two applicants is
// exactly the kind of made-up figure this file exists to avoid.
export function shareOf(ownership: Ownership, applicantId: string): number | null {
  const raw = ownership?.[applicantId]
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  if (s === '' || s.toLowerCase() === 'yes') return null
  const n = Number(s.replace('%', ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function nobodyOwnsIt(ownership: Ownership, applicantIds: string[]): boolean {
  return !applicantIds.some(id => ownsIt(ownership, id))
}

export type Applicant = { id: string; clientId?: string; firstName?: string; lastName?: string }

export function applicantName(a: Applicant | undefined): string {
  if (!a) return 'the other applicant'
  return [a.firstName, a.lastName].map(x => String(x || '').trim()).filter(Boolean).join(' ') || 'the other applicant'
}

// WHAT GETS STAMPED ONTO EACH ITEM ON A CLIENT RECORD.
//
// Full value, always, plus the share and who it is shared with. Never half the
// value: halving invents a figure that is in no document, and once it is halved
// nobody can tell a $400,000 share from a $400,000 property. Fabio, 22 Sep 2026.
export type Holding = {
  share: number | null
  jointWith: string[]
  // Nobody said who owns this. It is recorded for everybody on the deal rather
  // than dropped, and it says so until a person settles it.
  ownershipConfirmed: boolean
}

export function holdingFor(ownership: Ownership, applicant: Applicant, all: Applicant[]): Holding | null {
  const ids = all.map(a => a.id)
  const unassigned = nobodyOwnsIt(ownership, ids)

  // ONE APPLICANT AND NOTHING SAID: it is theirs. There is nobody else it could
  // belong to, so there is nothing to confirm.
  if (unassigned && all.length === 1) {
    return { share: null, jointWith: [], ownershipConfirmed: true }
  }
  // TWO OR MORE AND NOTHING SAID: everybody gets it, and it says so. Dropping it
  // is the one outcome that loses information nobody can get back.
  if (unassigned) {
    return {
      share: null,
      jointWith: all.filter(a => a.id !== applicant.id).map(applicantName),
      ownershipConfirmed: false,
    }
  }
  if (!ownsIt(ownership, applicant.id)) return null
  return {
    share: shareOf(ownership, applicant.id),
    jointWith: all.filter(a => a.id !== applicant.id && ownsIt(ownership, a.id)).map(applicantName),
    ownershipConfirmed: true,
  }
}

export type FactFind = { applicants?: Applicant[]; properties?: any[]; liabilities?: any[]; assets?: any[] }

export type Position = {
  properties: any[]
  liabilities: any[]
  assets: any[]
  // How many of the above nobody had assigned. Shown to the person before they
  // save, because it is the number that tells them the fact find is thin.
  unconfirmed: number
}

// One applicant's whole position, taken off the deal.
export function positionFor(factFind: FactFind, applicant: Applicant): Position {
  const all = (factFind?.applicants || []).filter(a => a && a.id)
  let unconfirmed = 0

  const take = (list: any[] | undefined) =>
    (list || []).reduce((out: any[], item: any) => {
      const held = holdingFor(item?.ownership, applicant, all)
      if (!held) return out
      if (!held.ownershipConfirmed) unconfirmed++
      out.push({ ...item, held })
      return out
    }, [])

  return {
    properties: take(factFind?.properties),
    liabilities: take(factFind?.liabilities),
    assets: take(factFind?.assets),
    unconfirmed,
  }
}

export function countIn(p: Position): number {
  return p.properties.length + p.liabilities.length + p.assets.length
}

// THE GUARD.
//
// A fact find where nobody assigned anything, or one opened on the wrong deal,
// produces three empty lists. Written over a full client record it looks like a
// fresh, accurate, empty position stamped with today's date - which is worse
// than no capture at all, because it is believable.
//
// Same shape as lib/wipe-guard.ts, which does this for the deal tabs.
const ENOUGH_TO_JUDGE = 3

export function wouldEmptyTheClient(existing: { properties?: any[]; liabilities?: any[]; assets?: any[] } | null | undefined,
                                    next: Position): boolean {
  const had = (existing?.properties?.length || 0)
            + (existing?.liabilities?.length || 0)
            + (existing?.assets?.length || 0)
  if (had < ENOUGH_TO_JUDGE) return false
  return countIn(next) === 0
}

export function emptyRefusal(name: string, existing: any): string {
  const had = (existing?.properties?.length || 0)
            + (existing?.liabilities?.length || 0)
            + (existing?.assets?.length || 0)
  return `NOT SAVED - ${name}'s record holds ${had} thing${had === 1 ? '' : 's'} and this deal's Fact Find `
       + `would leave them holding nothing. Nothing has been changed. If their position really is empty `
       + `now, clear the items on their record directly.`
}

// WHERE A POSITION CAME FROM. It is shown on the client page, because "as at the
// settlement of Chapman on 3 Sep" and "as declared on an application in March"
// are different facts and a book that mixes them without saying so is a book you
// have to check before you can use it.
export type PositionSource = 'settlement' | 'application' | 'deal closed'

export function sourceLine(source: PositionSource | null | undefined, dealName?: string | null): string {
  const on = dealName ? ` of ${dealName}` : ''
  if (source === 'settlement')  return `As at the settlement${on}`
  if (source === 'deal closed') return `As declared${on}. No loan was written - the deal did not proceed`
  return `As declared on the application${on}`
}
