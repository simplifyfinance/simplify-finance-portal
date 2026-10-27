import type { GapKind } from './what-we-still-need'

// WHAT THE CLIENT TYPED, PUT ONTO THE FACT FIND.
//
// 27 Oct 2026. The questions in the borrowing capacity and lending options
// emails can be answered by replying, and a reply never ticks anything off by
// itself because somebody has to type it in first. This is the other way: the
// client fills the gap and the question closes.
//
// THE ONE RULE THAT MAKES IT SAFE:
//
//   A CLIENT CAN FILL IN SOMETHING EMPTY.
//   A CLIENT CAN NEVER CHANGE SOMETHING THAT HAS A VALUE.
//
// Everything below is that sentence. An address for a period nobody recorded is
// added - there is nothing there to overwrite and it can only make the history
// longer. A residency status is written only where the box is blank. An asset
// is a new row. Not one path here replaces a value a broker typed.
//
// AND THE PAGE ENFORCES IT TWICE. Anything that already has a value is drawn
// locked, so there is no box to type in - the rule is held by what is DRAWN,
// not only by a check. This file is the second line, for the request that did
// not come from the page.
//
// WHY IT LANDS STRAIGHT ON RATHER THAN IN A TRAY. Holding a client's answer for
// a broker to approve is how it sits there for a week and the next email asks
// again. It is an ordinary save: the version it replaced is in the deal history
// with the client's name on it, so putting it back is one press.

export type AddressAnswer = {
  address: string
  residentialStatus: string
  startDate: string
  endDate: string
}

export type EmploymentAnswer = {
  employerName: string
  occupation: string
  startDate: string
  endDate: string
}

export type AssetAnswer = {
  description: string
  value: string
  make?: string
  model?: string
  year?: string
}

export type Answer =
  | { key: string; kind: 'address_history'; applicantId: string; addresses: AddressAnswer[] }
  | { key: string; kind: 'employment_history'; applicantId: string; jobs: EmploymentAnswer[] }
  | { key: string; kind: 'residency'; applicantId: string; value: string }
  | { key: string; kind: 'marital'; applicantId: string; value: string }
  | { key: string; kind: 'dependant_ages'; ages: string[] }
  | { key: string; kind: 'vehicle' | 'home_contents' | 'super' | 'shares'
      assets: AssetAnswer[]; none?: boolean }

const txt = (v: any) => String(v ?? '').trim()
const list = (v: any) => (Array.isArray(v) ? v : [])

/** Ids that cannot collide with the form's own, and read as what they are. */
export function clientId(n: number, now = new Date()): string {
  return `client-${now.getTime().toString(36)}-${n}`
}

const ASSET_TYPE: Record<string, string> = {
  vehicle: 'Vehicle',
  home_contents: 'Home Contents',
  super: 'Super',
  shares: 'Shares',
}

function withApplicant(ff: any, id: string, change: (a: any) => any): any {
  const applicants = list(ff?.applicants)
  // A CLIENT WHO NO LONGER EXISTS CHANGES NOTHING. An applicant deleted between
  // the email going out and the link being opened must not resurrect as a new
  // row at the end of the list.
  if (!applicants.some((a: any) => txt(a?.id) === txt(id))) return ff
  return {
    ...ff,
    applicants: applicants.map((a: any) => txt(a?.id) === txt(id) ? change(a) : a),
  }
}

/**
 * ONE ANSWER, APPLIED. Returns the fact find unchanged where it cannot be.
 *
 * Never throws. A malformed answer is a no-op, because a client typing
 * something odd into one box must not cost them the other three.
 */
export function applyAnswer(ff: any, answer: Answer, now = new Date(), seed = 0): any {
  try {
    const data = ff && typeof ff === 'object' ? ff : {}
    switch (answer?.kind) {
      case 'address_history': {
        const rows = (answer.addresses || [])
          .filter(r => txt(r?.address) || txt(r?.startDate))
          .map((r, i) => ({
            id: clientId(seed + i, now),
            address: txt(r.address),
            residentialStatus: txt(r.residentialStatus),
            // ALWAYS A PREVIOUS ADDRESS. The current one is already recorded -
            // that is the whole reason this question names a date to go back
            // from - and two current addresses is a fact find nobody can read.
            isCurrent: false,
            startDate: txt(r.startDate),
            endDate: txt(r.endDate),
            housingExpenseAmount: '',
            housingExpenseFrequency: '',
            addedByClient: now.toISOString(),
          }))
        if (!rows.length) return data
        return withApplicant(data, answer.applicantId, a => ({
          ...a, addresses: [...list(a?.addresses), ...rows],
        }))
      }

      case 'employment_history': {
        const rows = (answer.jobs || [])
          .filter(r => txt(r?.employerName) || txt(r?.startDate))
          .map((r, i) => ({
            id: clientId(seed + i, now),
            isCurrent: false,
            employmentPriority: 'Primary',
            employerName: txt(r.employerName),
            occupation: txt(r.occupation),
            startDate: txt(r.startDate),
            endDate: txt(r.endDate),
            // NEVER GUESSED. PAYG or self-employed changes which documents get
            // asked for, and a wrong guess here is a client sent for the wrong
            // paperwork. Blank is the honest answer and credit fills it in.
            employmentType: '',
            addedByClient: now.toISOString(),
          }))
        if (!rows.length) return data
        return withApplicant(data, answer.applicantId, a => ({
          ...a, employment: [...list(a?.employment), ...rows],
        }))
      }

      case 'residency':
      case 'marital': {
        const value = txt(answer.value)
        if (!value) return data
        const field = answer.kind === 'residency' ? 'residencyStatus' : 'relationshipStatus'
        return withApplicant(data, answer.applicantId, a =>
          // ONLY WHERE IT IS EMPTY. If a broker has typed one since the email
          // went out, theirs stands - they have spoken to the client.
          txt(a?.[field]) ? a : { ...a, [field]: value })
      }

      case 'dependant_ages': {
        const ages = (answer.ages || []).map(txt).filter(Boolean)
        if (!ages.length) return data
        if (list(data?.dependantAges).length) return data
        return { ...data, dependantAges: ages }
      }

      case 'vehicle':
      case 'home_contents':
      case 'super':
      case 'shares': {
        const type = ASSET_TYPE[answer.kind]
        if (!type) return data
        // "WE HAVE NONE" IS AN ANSWER, AND IT IS NOT A ROW.
        //
        // The same rule as the commission split: nobody has checked and they
        // have none are different things and both have to be writable. A nil
        // asset row would show up in the position and in every total; this is
        // a note saying somebody asked and the answer was no.
        if (answer.none) {
          const said = { ...(data?.nothingToDeclare || {}) }
          if (said[answer.kind]) return data
          said[answer.kind] = now.toISOString()
          return { ...data, nothingToDeclare: said }
        }
        const rows = (answer.assets || [])
          .filter(r => txt(r?.value) || txt(r?.description) || txt(r?.make))
          .map((r, i) => ({
            id: clientId(seed + i, now),
            assetType: type,
            description: txt(r.description),
            value: txt(r.value),
            bsb: '', accountNumber: '', regNumber: '', membershipNumber: '',
            ...(answer.kind === 'vehicle'
              ? { make: txt(r.make), model: txt(r.model), year: txt(r.year) } : {}),
            ownership: {},
            addedByClient: now.toISOString(),
          }))
        if (!rows.length) return data
        return { ...data, assets: [...list(data?.assets), ...rows] }
      }

      default:
        return data
    }
  } catch {
    return ff && typeof ff === 'object' ? ff : {}
  }
}

/** Every answer, in order. One that cannot be applied leaves the rest alone. */
export function applyAnswers(ff: any, answers: Answer[], now = new Date()): any {
  return (answers || []).reduce(
    (data, a, i) => applyAnswer(data, a, now, i * 10), ff && typeof ff === 'object' ? ff : {})
}

/** The keys that were actually answered, for marking them closed. */
export function keysAnswered(answers: Answer[]): string[] {
  return (answers || []).map(a => txt((a as any)?.key)).filter(Boolean)
}

export type { GapKind }
