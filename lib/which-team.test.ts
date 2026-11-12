// WHICH GROUP A BROKER IS IN.
//
// Invented brokers and deals throughout.
//
// The thing held here is that a GROUP IS NOT A BRAND. A brand is a credit
// licence and decides whose ACL number goes on a client's email. A group is
// how the book is added up. The first version of this report was built on
// brand_ids, which would have forced somebody to create a second LICENCE in
// order to split a REPORT. See lib/which-team.ts.
import { describe, it, expect } from 'vitest'
import {
  NO_TEAM, NO_TEAM_NAME, acrossTeams, teamOfBroker, teamsInUse, teamsOf,
} from './which-team'
import { byBroker } from './who-brought-us-this'

const SPAN = { from: '2026-11-01', to: '2026-11-30' }

// broker_key is a key, name is a full name. They are never equal.
const ROWS = [
  { broker_key: 'fabio', name: 'Fabio De Castro', team: 'Simplify Finance', active: true },
  { broker_key: 'mark', name: 'Mark Gallo', team: 'Simplify Finance', active: true },
  { broker_key: 'kylie', name: 'Kylie Searle', team: 'Simplify Finance', active: true },
  { broker_key: 'keanen', name: 'Keanen Wood', team: 'Simplify Finance Brokers', active: true },
  { broker_key: 'justin', name: 'Justin Cornock', team: 'Simplify Finance Brokers', active: true },
  { broker_key: 'untold', name: 'Nobody Said', team: null, active: true },
]

const deal = (over: any = {}) => ({
  id: 'd' + Math.random(), status: 'active',
  lodged_at: '2026-11-09T13:00:00+00:00', lodged_total: 100_000, ...over,
})

describe('which group a broker is in', () => {
  it('matches on the key', () => {
    expect(teamOfBroker(ROWS, 'keanen')).toBe('Simplify Finance Brokers')
    expect(teamOfBroker(ROWS, 'mark')).toBe('Simplify Finance')
  })

  // A deal carries "justin", a dropdown carries "Justin Cornock". Comparing
  // those with === is the mistake this codebase has paid for twice.
  it('matches on the full name too', () => {
    expect(teamOfBroker(ROWS, 'Justin Cornock')).toBe('Simplify Finance Brokers')
    expect(teamOfBroker(ROWS, 'Fabio De Castro')).toBe('Simplify Finance')
  })

  it('says nobody has said rather than guessing', () => {
    expect(teamOfBroker(ROWS, 'untold')).toBe(NO_TEAM)
    expect(teamOfBroker(ROWS, 'ghost')).toBe(NO_TEAM)
    expect(teamOfBroker(ROWS, '')).toBe(NO_TEAM)
  })

  it('never falls back to the biggest group', () => {
    for (const who of ['', 'ghost', 'untold']) {
      expect(teamOfBroker(ROWS, who)).not.toBe('Simplify Finance')
    }
  })

  it('offers the groups somebody has actually used, alphabetically', () => {
    expect(teamsInUse(ROWS)).toEqual(['Simplify Finance', 'Simplify Finance Brokers'])
    expect(teamsInUse([])).toEqual([])
  })
})

describe('the report, group by group', () => {
  const deals = [
    deal({ assigned_broker: 'fabio', lodged_total: 700_000 }),
    deal({ assigned_broker: 'fabio', lodged_total: 300_000 }),
    deal({ assigned_broker: 'mark', lodged_total: 500_000 }),
    deal({ assigned_broker: 'keanen', lodged_total: 400_000 }),
    deal({ assigned_broker: 'untold', lodged_total: 200_000 }),
  ]
  const run = () => teamsOf(byBroker(deals, SPAN), ROWS)

  it('heads each group with the name, and nothing else', () => {
    expect(run().map(t => t.name))
      .toEqual(['Simplify Finance', 'Simplify Finance Brokers', NO_TEAM_NAME])
  })

  it('adds the money up from the deals in that group', () => {
    const [sf, sfb] = run()
    expect(sf.lodged).toBe(3)
    expect(sf.lodgedAmount).toBe(1_500_000)
    expect(sfb.lodged).toBe(1)
    expect(sfb.lodgedAmount).toBe(400_000)
  })

  // NOTHING IS COUNTED TWICE. A broker is in ONE group - there is nothing to
  // split, which is most of why this is simpler than what it replaces.
  it('adds back to the whole book', () => {
    const all = acrossTeams(run())
    expect(all.lodged).toBe(5)
    expect(all.lodgedAmount).toBe(2_100_000)
  })

  it('puts nobody has said last, however big it gets', () => {
    const lots = [...Array(9)].map(() => deal({ assigned_broker: 'untold' }))
    const out = teamsOf(byBroker([...deals, ...lots], SPAN), ROWS)
    expect(out[out.length - 1].id).toBe(NO_TEAM)
    expect(out[0].name).toBe('Simplify Finance')
  })

  it('orders the brokers inside a group biggest first', () => {
    const many = [
      deal({ assigned_broker: 'kylie' }),
      ...[...Array(3)].map(() => deal({ assigned_broker: 'mark' })),
    ]
    const [sf] = teamsOf(byBroker(many, SPAN), ROWS)
    expect(sf.brokers.map(b => b.key)).toEqual(['mark', 'kylie'])
  })
})

describe('before anybody has set a group up', () => {
  const NONE = [{ broker_key: 'mark', name: 'Mark Gallo', team: null, active: true }]

  // The page must work on the day it ships. One heading saying nobody has
  // said is the right answer, not a broken screen and not a guess.
  it('puts everybody under nobody has said', () => {
    const out = teamsOf(byBroker([deal({ assigned_broker: 'mark' })], SPAN), NONE)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(NO_TEAM)
    expect(out[0].lodged).toBe(1)
  })

  it('and still adds up', () => {
    const out = teamsOf(byBroker([deal({ assigned_broker: 'mark' })], SPAN), NONE)
    expect(acrossTeams(out).lodged).toBe(1)
  })
})
