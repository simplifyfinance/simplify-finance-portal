// WHO SEES WHICH NUMBERS.
//
// 11 Nov 2026. Fabio, on the Lodged and settled page: "these friday email
// capabilities and reporting only available to whomever have admin access?"
//
// They were not. The page shipped open to anybody signed in, which put every
// broker's figures and every referral partner's TERMS in front of the whole
// office. The portal already treats commission as admin only - the Commission
// library and the splits page are both behind it, and viewCommissions in
// lib/permissions.ts says so - and a report that prints "Justin Cornock 50%,
// Simplify 50%" is the same information wearing a different hat.
//
// THREE VIEWS, AND THE LIST OF DEALS IS IN ALL THREE. Fabio: "what about list
// of deals you are missing the point." The deals ARE the report; the counts
// are a heading for them. What changes between the views is WHOSE deals and
// WHICH COLUMNS, never whether you get a list at all.
//
// NOBODY IS NAMED HERE. It reads the role already on each login, so a person
// moving jobs is one dropdown rather than a ship.

import { sameBroker, brokerKey } from './broker-key'

export type View = 'everything' | 'mine' | 'team'

export function viewFor(role: any): View {
  const r = String(role ?? '').trim().toLowerCase()
  if (r === 'admin') return 'everything'
  if (r === 'broker') return 'mine'
  // ANYTHING UNRECOGNISED GETS THE SMALLEST VIEW. A role added next year must
  // not arrive holding the commission figures by default.
  return 'team'
}

export const VIEW_NOTE: Record<View, string> = {
  everything: 'Every broker, every client, every amount, and what each referral partner is on.',
  mine: 'Your own deals. Other brokers\u2019 clients are not here.',
  team: 'Every broker, every client, every amount, and what each referral partner is on.',
}

/** Whose deals this person is looking at. */
export function dealsFor(view: View, deals: any[], key: any): any[] {
  if (view !== 'mine') return deals || []
  // THROUGH sameBroker, NEVER BY HAND. The live table holds "Fabio" with a
  // capital and everybody else lower case, and an exact match finds nothing
  // while the screen looks perfectly correct - see lib/broker-key.ts, which
  // exists because that already broke credit allocation once.
  //
  // A BROKER WITH NO KEY SEES NOTHING RATHER THAN EVERYTHING. The failure has
  // to be in the safe direction: an empty page is a question somebody asks,
  // which is how it gets fixed. Everybody's deals is not.
  if (!brokerKey(key)) return []
  return (deals || []).filter(d => sameBroker(d?.assigned_broker, key))
}

/**
 * MAY SEND THE FRIDAY EMAILS.
 *
 * 12 Nov 2026. This is now the ONLY thing the three views differ on, besides
 * whose deals a broker gets. Fabio, asked straight out what staff should see:
 * the whole team, same detail. The people doing the work can see the work.
 *
 * What stays with admin is the sending - one of these emails goes to a
 * referral partner, and nothing about a referral relationship leaves this
 * building without Fabio or Alan pressing it.
 */
export function mayEmail(view: View): boolean {
  return view === 'everything'
}
