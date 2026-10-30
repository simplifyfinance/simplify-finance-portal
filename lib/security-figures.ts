import { readMoney } from './money'
import { splitSecurityId } from './securities'

const txt = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown): number => readMoney(v) || 0

// WHAT THE THREE BOXES ALREADY KNOW.
//
// 29 Oct 2026. Fabio, on the securities block of the Mawing deal: "owes now
// releasing still blank???"
//
// They were blank on a deal that holds every one of their figures. The house
// owes $700,000 - it is on the fact find, on a loan marked Refinance - and
// $920,000 is being lent against it, which the row was already printing as
// "drawn $920,000" two columns across. Nobody typed the boxes because the
// numbers were recorded somewhere else first, and the screen said nothing.
//
// SHOWN, NOT STORED. These are placeholders. Writing them into the boxes would
// leave a copy that goes a version behind the fact find the moment a balance is
// corrected - which is four of the faults fixed this week, in one shape. The
// typed box still wins the instant somebody types in it.

/**
 * IS THIS LOAN BEING DISCHARGED BY THIS DEAL?
 *
 * The fact find offers three answers - Ongoing, Refinance, To be paid out - and
 * two of them mean the loan goes at settlement.
 *
 * "TO BE REFINANCED" IS NOT ONE OF THEM, and the auto-fill on the deal-level
 * Existing loan balance box has been waiting for exactly that phrase since it
 * was written. It has never once fired, which is why that box has been typed by
 * hand on every refinance this portal has ever done.
 */
export function isBeingDischarged(status: unknown): boolean {
  const v = txt(status).toLowerCase()
  return v === 'refinance' || v === 'to be refinanced' || v === 'to be paid out'
}

/** Every loan on this property that goes at settlement, added up. */
export function owedOnProperty(property: any): number {
  const loans = Array.isArray(property?.loans) ? property.loans : []
  return loans.filter((l: any) => isBeingDischarged(l?.status))
    .reduce((t: number, l: any) => t + num(l?.balance), 0)
}

/** The first balance on the fact find that this deal is discharging. */
export function firstDischargedBalance(properties: any): string {
  for (const prop of Array.isArray(properties) ? properties : []) {
    for (const loan of (prop?.loans || [])) {
      if (isBeingDischarged(loan?.status) && loan?.balance) return String(loan.balance)
    }
  }
  return ''
}

export type SecurityBoxes = { owes: number; releasing: number; limit: number }

/**
 * THE THREE FIGURES FOR ONE SECURITY, FROM WHAT THE DEAL ALREADY HOLDS.
 *
 * owes      what that house owes today, off the fact find
 * releasing what is being lent against it beyond that
 * limit     the two together, which is what the splits put against it
 *
 * Zero where it cannot be worked out, so a caller shows nothing rather than a
 * nought - a $0 in a box reads as an answer.
 */
export function boxesFor(bc: any, ff: any, id: unknown): SecurityBoxes {
  const want = txt(id)
  const property = (Array.isArray(ff?.properties) ? ff.properties : [])
    .find((p: any) => txt(p?.id) === want)
  const splits = Array.isArray(bc?.splits) ? bc.splits : []
  const mine = splits.filter((sp: any) => splitSecurityId(sp) === want)

  // WHAT IT OWES TODAY, FROM EITHER PLACE IT IS RECORDED.
  //
  // The fact find first - that is the client's own record of the loan. Then the
  // BC's own "Existing balance on this property" box, per split, which is where
  // a broker puts it on a deal whose fact find never itemised the loans. 30 Oct
  // 2026: reading only the first left the box blank on a deal showing $189,000
  // two panels down.
  const owes = owedOnProperty(property)
    || mine.reduce((t: number, sp: any) => t + num(sp?.existingBalance), 0)

  const limit = mine.reduce((t: number, sp: any) => t + num(sp?.amount), 0)
  return { owes, releasing: Math.max(0, limit - owes), limit }
}
