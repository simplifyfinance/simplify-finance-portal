// WHICH GROUP A BROKER IS IN.
//
// Fabio, 12 Nov 2026, after saying it several times and being ignored:
// "Simplify Brokers is NOT another brand, it is a sub-aggregation. I am
// telling you, add a drop box on each BROKER."
//
// He was right and I built the first version on the wrong thing entirely.
//
// A BRAND IS A LICENCE. Simplify Finance and Navigate Advisors are separate
// credit licences with separate letterheads, and which one a deal goes out
// under decides whose ACL number sits on a client's email. Getting that wrong
// is the fault Catherine reported in October. See
// lib/the-brand-follows-the-broker.ts.
//
// A GROUP IS HOW THE BOOK IS READ. "Simplify Finance" holding Mark, Fabio and
// Kylie, and "Simplify Finance Brokers" holding Keanen and Justin, is a way of
// adding up the same licence's work in two piles. Nothing about it touches a
// client, an email footer or a licence number.
//
// Building the reports on brand_ids forced a reporting question through a
// compliance control: to split the report, somebody would have had to create a
// second BRAND, which would then be offered on client emails with a licence
// number nobody had set. That is a genuinely dangerous way to be wrong.
//
// SO IT IS ITS OWN FIELD AND ITS OWN DROPDOWN. brokers.team, set in
// Settings -> Broker profiles, used by the reports and by nothing else.
//
// AND IT NEVER GUESSES. A broker with no group set lands in "Nobody has said",
// which is its own heading at the bottom of the page - a thing to go and fix,
// not something quietly folded into the biggest pile.

import { sameBroker } from './broker-key'
import type { Line2 } from './who-brought-us-this'
import { amountOf } from './deal-phase'

const txt = (v: any) => String(v ?? '').trim()

/** The heading for brokers nobody has put in a group. */
export const NO_TEAM = '__no_team__'
export const NO_TEAM_NAME = 'Nobody has said which group'

export type Team = {
  /** The group's name, which IS its key. There is no id and no register. */
  id: string
  name: string
  brokers: Line2[]
  lodged: number
  settled: number
  lodgedAmount: number
  settledAmount: number
}

export type BrokerRow = {
  broker_key?: any
  brokerKey?: any
  name?: any
  team?: any
  active?: any
}

/**
 * WHICH GROUP THIS BROKER IS IN, or NO_TEAM.
 *
 * Matched on the key then the name, both through sameBroker() - a deal carries
 * "justin", a dropdown carries "Justin Cornock", and a row is keyed "justin".
 * Comparing those with === is the mistake this codebase has paid for twice.
 */
export function teamOfBroker(rows: BrokerRow[], who: any): string {
  if (!txt(who)) return NO_TEAM
  const hit = (rows || []).find(r => sameBroker(r.broker_key ?? r.brokerKey, who))
    || (rows || []).find(r => sameBroker(r.name, who))
  return txt(hit?.team) || NO_TEAM
}

/** Every group anybody has been put in, for the dropdown. Alphabetical. */
export function teamsInUse(rows: BrokerRow[]): string[] {
  const seen = new Set<string>()
  for (const r of rows || []) {
    const t = txt(r?.team)
    if (t) seen.add(t)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

function sum(deals: any[]): number {
  return (deals || []).reduce((t, d) => t + (amountOf(d) || 0), 0)
}

const blank = (id: string, name: string): Team => ({
  id, name, brokers: [], lodged: 0, settled: 0, lodgedAmount: 0, settledAmount: 0,
})

/**
 * THE REPORT, GROUP BY GROUP.
 *
 * Takes the per-broker lines byBroker() already produces and files each whole
 * broker under their group. A broker belongs to ONE group - unlike a brand,
 * there is nothing to split a broker's deals between, which is most of why
 * this is simpler than what it replaces.
 */
export function teamsOf(lines: Line2[], rows: BrokerRow[]): Team[] {
  const out = new Map<string, Team>()

  for (const line of lines || []) {
    const id = teamOfBroker(rows, line.key) !== NO_TEAM
      ? teamOfBroker(rows, line.key)
      : teamOfBroker(rows, line.name)
    const key = id || NO_TEAM
    if (!out.has(key)) {
      out.set(key, blank(key, key === NO_TEAM ? NO_TEAM_NAME : key))
    }
    const team = out.get(key)!
    team.brokers.push(line)
    team.lodged += line.lodged.length
    team.settled += line.settled.length
    team.lodgedAmount += sum(line.lodged)
    team.settledAmount += sum(line.settled)
  }

  for (const t of out.values()) {
    t.brokers.sort((a, b) =>
      b.lodged.length - a.lodged.length
      || b.settled.length - a.settled.length
      || a.name.localeCompare(b.name))
  }

  // Biggest first, but "nobody has said" always last - it is a thing to fix,
  // not a group, and it must never head the page.
  return [...out.values()].sort((a, b) => {
    if (a.id === NO_TEAM) return 1
    if (b.id === NO_TEAM) return -1
    return b.lodged - a.lodged || b.settled - a.settled || a.name.localeCompare(b.name)
  })
}

/** Every group added together. */
export function acrossTeams(teams: Team[]): {
  lodged: number; settled: number; lodgedAmount: number; settledAmount: number
} {
  return (teams || []).reduce((t, x) => ({
    lodged: t.lodged + x.lodged,
    settled: t.settled + x.settled,
    lodgedAmount: t.lodgedAmount + x.lodgedAmount,
    settledAmount: t.settledAmount + x.settledAmount,
  }), { lodged: 0, settled: 0, lodgedAmount: 0, settledAmount: 0 })
}
