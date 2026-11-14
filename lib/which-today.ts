// WHICH TODAY IS THIS, AND IT IS DECIDED IN ONE PLACE.
//
// 23 Oct 2026. Fabio opened his own Today the morning after it shipped: "yeah
// look at mine!" Every box on it was written "only if you are a credit
// assessor", and four of the people who open it daily are not one. So there
// are three views, and they answer three different questions:
//
//   CREDIT  - what am I doing today, and what did I finish yesterday
//   BROKER  - what is sitting with me, and who in credit has my files
//   ADMIN   - where is the book, and what is nobody doing anything about
//
// ---------------------------------------------------------------------------
// WHY IT MOVED OUT OF THE COMPONENT - 15 Nov 2026
// ---------------------------------------------------------------------------
//
// This line lived inside components/TodayPlan.tsx. The dashboard page needed
// the same answer, to decide whether to draw the business dashboard underneath
// - and it could not reach it, so it asked its own question instead:
//
//     {!theirScreen && <DashboardClient ... />}
//
// Which is not the same question. `theirScreen` is "is this an admin", so a
// BROKER got the whole business dashboard bolted under his Today: a second
// greeting, Deals by broker across every broker in the business, Needs your
// action, five stage tiles and Recent deals. None of it was in the screen he
// approved on 12 Nov, and he said so more than once before it was found.
//
// Fabio, 15 Nov: "come on all this still showing in broker view I SAID
// multiple types remove it."
//
// One fact, two homes, free to drift - the same shape as the loan split filed
// under its typed label and the second stage ladder in the brokers' Monday.
// See CLAUDE.md.
//
// ---------------------------------------------------------------------------
// THE ORDER OF THE THREE TESTS IS THE RULE, NOT AN ACCIDENT
// ---------------------------------------------------------------------------
//
// CREDIT IS ASKED FIRST. A credit assessor who is also an admin still gets her
// own day, because she has a day to agree to and nobody else can do it for her.
//
// THEN ADMIN. Fabio, Mark and Kylie are brokers who are also admins; his words
// on 23 Oct: "a broker /admin, admin view supersedes". If these two were
// swapped he would get a broker's page again and the business view would be
// unreachable for the five people it was built for.
//
// BROKER IS WHAT IS LEFT. Keanen and Justin are brokers and nothing else.

export type TodayView = 'credit' | 'admin' | 'broker'

/**
 * @param officerId  their credit_officers id, when they are a credit assessor
 * @param seesAll    auth_sees_all_deals() - and when somebody is being looked
 *                   at through View as, it is THEIR seat, not the viewer's.
 *                   See lib/view-as.ts and `theirScreen` on the dashboard.
 */
export function whichToday(officerId: any, seesAll: any): TodayView {
  if (officerId) return 'credit'
  if (seesAll) return 'admin'
  return 'broker'
}

/**
 * DOES THE BUSINESS DASHBOARD BELONG UNDER THIS TODAY?
 *
 * Only for credit. An admin gets the run-through instead, and a broker gets
 * his own three boxes and nothing else bolted underneath.
 */
export function showsTheBusinessDashboard(view: TodayView): boolean {
  return view === 'credit'
}
