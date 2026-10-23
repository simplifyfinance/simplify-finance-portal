// THE DAY IS DRAFTED, NOT TYPED.
//
// 22 Oct 2026. What this replaces: an email the credit team write every
// morning listing yesterday's work and today's, which brokers reply to with an
// order of priority. Every name in it is already on a deal.
import { describe, it, expect } from 'vitest'
import { draftDay, finishedOn, planBoard, everybodyPlanned, stageWaitingOn,
         notTold, minutesIntoDay, dayBefore, DAY_STARTS,
         type PlanDeal, type Plan } from './the-days-plan'

const d = (id: string, since: string | null, priority?: any): PlanDeal =>
  ({ id, name: id, stage: 'BC', since, priority: priority || null })

describe('the draft, when no broker has said anything', () => {
  it('is oldest first - a defensible day with nobody’s input', () => {
    const out = draftDay([
      d('newest', '2026-10-22T09:00:00Z'),
      d('oldest', '2026-10-18T09:00:00Z'),
      d('middle', '2026-10-20T09:00:00Z'),
    ])
    expect(out.map(x => x.id)).toEqual(['oldest', 'middle', 'newest'])
  })

  it('a deal with no date at all is treated as the oldest, not the newest', () => {
    const out = draftDay([d('dated', '2026-10-22T09:00:00Z'), d('undated', null)])
    expect(out[0].id).toBe('undated')
  })
})

describe('the draft, once brokers have set priorities', () => {
  const starred = (id: string, by: string, at: string) =>
    d(id, '2026-10-22T09:00:00Z', { by, why: 'client found a property', at })

  it('priority deals come first, however new they are', () => {
    const out = draftDay([
      d('old', '2026-10-15T09:00:00Z'),
      starred('kylies', 'Kylie', '2026-10-23T08:00:00Z'),
    ])
    expect(out[0].id).toBe('kylies')
  })

  it('and among themselves, whoever asked first', () => {
    const out = draftDay([
      starred('second', 'Mark', '2026-10-23T10:00:00Z'),
      starred('first', 'Kylie', '2026-10-23T08:00:00Z'),
    ])
    expect(out.map(x => x.id)).toEqual(['first', 'second'])
  })

  it('a broker arriving late still reorders - nothing waits for them', () => {
    const before = draftDay([d('a', '2026-10-15T09:00:00Z'), d('b', '2026-10-20T09:00:00Z')])
    expect(before.map(x => x.id)).toEqual(['a', 'b'])
    const after = draftDay([d('a', '2026-10-15T09:00:00Z'),
                            starred('b', 'Mark', '2026-10-23T10:40:00Z')])
    expect(after.map(x => x.id)).toEqual(['b', 'a'])
  })
})

describe('yesterday writes itself', () => {
  // SYDNEY TIMES, WRITTEN AS THE INSTANTS THEY REALLY ARE.
  //
  // 23 Oct 2026. This block used to say '2026-10-22T14:00:00Z' and expect it
  // to be the 22nd. In Sydney that instant is one in the morning on the 23rd,
  // so the test only passed on a machine running UTC - which is my sandbox,
  // and not Fabio's Mac, and not what matters. The tests passed and the
  // feature was broken.
  //
  // 2pm Sydney on 22 October is 03:00Z. Written that way here so the fixture
  // cannot drift from the thing it is testing.
  const SYD = (day: string, hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return new Date(Date.UTC(2026, 9, Number(day), h - 11, m)).toISOString()
  }
  const deal = (x: any) => ({ assigned_credit_officer: 'katie',
                              credit_assigned_at: SYD('20', '09:00'), ...x })

  it('lists the stages that were finished that day', () => {
    const out = finishedOn([
      deal({ id: '1', deal_name: 'Beatrix Nakamura', bc_completed_at: SYD('22', '14:00') }),
      deal({ id: '2', deal_name: 'Hugo Vanterpool', lo_completed_at: SYD('22', '16:30') }),
    ], 'katie', '2026-10-22')
    expect(out.map(x => x.what)).toEqual(['BC', 'Lending options'])
  })

  it('and how long each one was on them', () => {
    const out = finishedOn([
      deal({ id: '1', deal_name: 'Beatrix', bc_completed_at: SYD('22', '09:00') }),
    ], 'katie', '2026-10-22')
    expect(out[0].days).toBe(2)
  })

  it('ignores another assessor\u2019s work', () => {
    const out = finishedOn([
      deal({ id: '1', deal_name: 'X', assigned_credit_officer: 'sylvan',
             bc_completed_at: SYD('22', '14:00') }),
    ], 'katie', '2026-10-22')
    expect(out).toHaveLength(0)
  })

  it('and anything finished on a different day', () => {
    const out = finishedOn([
      deal({ id: '1', deal_name: 'X', bc_completed_at: SYD('21', '23:59') }),
    ], 'katie', '2026-10-22')
    expect(out).toHaveLength(0)
  })

  // THE ONE THAT CAUGHT IT. Late afternoon in Sydney is already tomorrow in
  // UTC, so this is the case that was landing in the wrong day's list.
  it('counts late afternoon as the same day, not the next one', () => {
    const out = finishedOn([
      deal({ id: '1', deal_name: 'Esme', compliance_completed_at: SYD('22', '16:00') }),
    ], 'katie', '2026-10-22')
    expect(out).toHaveLength(1)
  })

  it('one deal can finish two stages in a day', () => {
    const out = finishedOn([
      deal({ id: '1', deal_name: 'Esme', lo_completed_at: SYD('22', '10:00'),
             compliance_completed_at: SYD('22', '16:00') }),
    ], 'katie', '2026-10-22')
    expect(out.map(x => x.what)).toEqual(['Lending options', 'Compliance'])
  })

  it('and a stage finished just before midnight is still that day', () => {
    const out = finishedOn([
      deal({ id: '1', deal_name: 'Late', bc_completed_at: SYD('22', '23:30') }),
    ], 'katie', '2026-10-22')
    expect(out).toHaveLength(1)
  })
})

describe('who has planned, which is the whole enforcement', () => {
  const plan = (id: string, name: string, confirmedAt: string | null, n = 4): Plan =>
    ({ officerId: id, officerName: name, confirmedAt,
       deals: Array.from({ length: n }, (_, i) => d(`${id}-${i}`, null)) })

  it('puts whoever has not planned at the top', () => {
    const rows = planBoard([
      plan('melissa', 'Melissa', '2026-10-23T08:12:00Z'),
      plan('sylvan', 'Sylvan', null, 7),
      plan('katie', 'Katie', '2026-10-23T08:35:00Z'),
    ])
    expect(rows.map(r => r.name)).toEqual(['Sylvan', 'Melissa', 'Katie'])
  })

  it('and says how many each is carrying', () => {
    expect(planBoard([plan('sylvan', 'Sylvan', null, 7)])[0].count).toBe(7)
  })

  it('the brokers know when everybody has planned', () => {
    expect(everybodyPlanned([plan('a', 'A', '2026-10-23T08:00:00Z')])).toBe(true)
    expect(everybodyPlanned([plan('a', 'A', null)])).toBe(false)
    expect(everybodyPlanned([])).toBe(false)
  })
})

describe('which stage is sitting with us', () => {
  const base = { status: 'in_progress',
                 fact_find_data: { applicants: [{ firstName: 'Nora', dob: '1988-04-02' }] } }

  it('names the BC while it is being written', () => {
    expect(stageWaitingOn(base)).toBe('BC')
  })

  it('says nothing at all when the ball is with the client', () => {
    expect(stageWaitingOn({ ...base, bc_completed_at: '1', bc_sent_at: '1' })).toBeNull()
  })

  it('names compliance once the client has agreed the lending options', () => {
    expect(stageWaitingOn({ ...base, bc_completed_at: '1', bc_sent_at: '1', client_proceeded: true,
                            lo_completed_at: '1', lo_sent_at: '1', lo_client_proceeded: true }))
      .toBe('Compliance')
  })
})

describe('the day starts at half past seven', () => {
  // Sydney wall-clock times, as the instants they really are. Same reason as
  // the block above: the office opens at 7:30 in Sydney, not wherever the
  // server happens to be.
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return new Date(Date.UTC(2026, 9, 23, h - 11, m))
  }
  const unplanned: Plan = { officerId: 'sylvan', officerName: 'Sylvan', confirmedAt: null, deals: [] }

  it('is 7:30, not 8 - Fabio said 8 is too late', () => {
    expect(DAY_STARTS).toBe('07:30')
  })

  it('nobody is late before it', () => {
    expect(minutesIntoDay(at('07:00'))).toBeLessThan(0)
    expect(notTold([unplanned], at('07:00'))[0].level).toBe('quiet')
  })

  it('at 7:45 it is a nudge, and it names who is waiting', () => {
    const [n] = notTold([unplanned], at('07:45'))
    expect(n.level).toBe('nudge')
    expect(n.mine).toBe('You have not told the brokers your day yet.')
  })

  it('an hour later it is a flag, and it says how long', () => {
    const [n] = notTold([unplanned], at('09:30'))
    expect(n.level).toBe('flag')
    expect(n.mine).toContain('2 hours')
  })

  it('the brokers read a different sentence about the same person', () => {
    const [n] = notTold([unplanned], at('07:45'))
    expect(n.theirs).toBe('Sylvan has not told you their day yet')
  })

  it('and somebody who has planned is not on the list at all', () => {
    const done: Plan = { ...unplanned, confirmedAt: '2026-10-22T20:40:00Z' }
    expect(notTold([done], at('09:30'))).toHaveLength(0)
  })

  // THE GUARD THAT WOULD HAVE CAUGHT THIS. Half past seven in Sydney is half
  // past eight the previous evening in UTC, so a machine reading its own clock
  // gets a different answer. Every test in this file now asserts the Sydney
  // answer, whatever machine runs it.
  it('gives the same answer on a machine in any time zone', () => {
    expect(minutesIntoDay(at('07:30'))).toBe(0)
    expect(minutesIntoDay(at('08:30'))).toBe(60)
    expect(minutesIntoDay(at('06:30'))).toBe(-60)
  })
})

describe('the day before, on the calendar not the clock', () => {
  it('steps back one day', () => {
    expect(dayBefore('2026-10-23')).toBe('2026-10-22')
  })
  it('across a month', () => {
    expect(dayBefore('2026-11-01')).toBe('2026-10-31')
  })
  it('and across a year', () => {
    expect(dayBefore('2027-01-01')).toBe('2026-12-31')
  })
})
