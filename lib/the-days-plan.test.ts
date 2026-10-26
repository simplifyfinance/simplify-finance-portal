// THE DAY IS DRAFTED, NOT TYPED.
//
// 22 Oct 2026. What this replaces: an email the credit team write every
// morning listing yesterday's work and today's, which brokers reply to with an
// order of priority. Every name in it is already on a deal.
import { describe, it, expect } from 'vitest'
import { draftDay, finishedOn, planBoard, everybodyPlanned, stageWaitingOn,
         notTold, minutesIntoDay, dayBefore, DAY_STARTS, creditHasIt, finishedAcross,
         LINE, moveInOrder, splitAtLine, startingOrder, noteFor, withNote,
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
  // 23 Oct 2026 IS A FRIDAY, AND THE DAY IS NOW NAMED.
  //
  // notTold() defaults to the real today, and on a Saturday it answers nobody
  // is late - correctly. Left to default, every test below would have started
  // failing at midnight on a Friday and passing again on Monday, which is the
  // worst kind of test there is. See lib/the-week.ts.
  const FRIDAY = '2026-10-23'
  const unplanned: Plan = { officerId: 'sylvan', officerName: 'Sylvan', confirmedAt: null, deals: [] }

  it('nobody is late on a Saturday, a Sunday or Australia Day', () => {
    for (const day of ['2026-10-24', '2026-10-25', '2026-01-26']) {
      expect(notTold([unplanned], at('09:30'), day), `${day} flagged somebody`).toHaveLength(0)
    }
    // And the working day either side still does.
    expect(notTold([unplanned], at('09:30'), '2026-10-23')).toHaveLength(1)
    expect(notTold([unplanned], at('09:30'), '2026-10-26')).toHaveLength(1)
  })

  it('is 7:30, not 8 - Fabio said 8 is too late', () => {
    expect(DAY_STARTS).toBe('07:30')
  })

  it('nobody is late before it', () => {
    expect(minutesIntoDay(at('07:00'))).toBeLessThan(0)
    expect(notTold([unplanned], at('07:00'), FRIDAY)[0].level).toBe('quiet')
  })

  it('at 7:45 it is a nudge, and it names who is waiting', () => {
    const [n] = notTold([unplanned], at('07:45'), FRIDAY)
    expect(n.level).toBe('nudge')
    expect(n.mine).toBe('You have not told the brokers your day yet.')
  })

  it('an hour later it is a flag, and it says how long', () => {
    const [n] = notTold([unplanned], at('09:30'), FRIDAY)
    expect(n.level).toBe('flag')
    expect(n.mine).toContain('2 hours')
  })

  it('the brokers read a different sentence about the same person', () => {
    const [n] = notTold([unplanned], at('07:45'), FRIDAY)
    expect(n.theirs).toBe('Sylvan has not told you their day yet')
  })

  it('and somebody who has planned is not on the list at all', () => {
    const done: Plan = { ...unplanned, confirmedAt: '2026-10-22T20:40:00Z' }
    expect(notTold([done], at('09:30'), FRIDAY)).toHaveLength(0)
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

// ---------------------------------------------------------------------------
// WHOSE DAY IS THIS DEAL ON?
//
// 23 Oct 2026, building a broker's own Today. If Katie has the lending
// options, that deal belongs on Katie's list and not on the broker's as well -
// the same file on two plans is two people doing one job, which is the thing
// this whole page exists to stop.
//
// The question has to be per stage. A broker who wrote the BC himself and then
// gave the lending options to credit has a deal with a credit officer on it
// for one stage and not the other, and the deal-wide column cannot tell those
// apart. See lib/who-did-this-stage.ts.
describe('whether credit is carrying the stage that is with us', () => {
  // Fact find and BC closed; the lending options are open.
  const open = {
    id: 'd1', deal_name: 'Harding & Vass 2026', assigned_broker: 'mark',
    created_at: '2026-09-24T01:00:00Z', bc_data: { purpose: 'OO purchase' },
    client_proceeded: true, proceeded_at: '2026-09-24T05:00:00Z',
  }

  it('says who, when a credit assessor owns the open stage', () => {
    expect(stageWaitingOn(open)).toBe('LO')
    const d = { ...open, lo_owner_officer: 'k1', lo_owner_name: 'Katie Amos' }
    expect(creditHasIt(d)).toEqual({ officerId: 'k1', name: 'Katie Amos' })
  })

  it('and nothing when the broker kept it', () => {
    const d = { ...open, lo_owner_officer: null, lo_owner_name: 'Mark Gallo' }
    expect(creditHasIt(d)).toBeNull()
  })

  it('a BC credit wrote does not make the lending options theirs', () => {
    const d = {
      ...open,
      bc_owner_officer: 'k1', bc_owner_name: 'Katie Amos',
      lo_owner_officer: null, lo_owner_name: 'Mark Gallo',
      assigned_credit_officer: 'k1',
    }
    expect(creditHasIt(d), 'the deal-wide officer is being read again').toBeNull()
  })

  it('and a deal sitting with the client is nobody\u2019s day', () => {
    const sent = { ...open, lo_sent_at: '2026-10-01T05:00:00Z' }
    expect(stageWaitingOn(sent)).toBeNull()
    expect(creditHasIt(sent)).toBeNull()
  })
})

describe('what finished yesterday, for everybody', () => {
  const deal = {
    id: 'd1', deal_name: 'Harding & Vass 2026', assigned_broker: 'mark',
    created_at: '2026-09-24T01:00:00Z', bc_data: { purpose: 'OO purchase' },
    client_proceeded: true, proceeded_at: '2026-09-24T05:00:00Z',
    lo_owner_officer: 'k1', lo_owner_name: 'Katie Amos',
    lo_completed_at: '2026-10-22T04:00:00Z',
  }

  it('names the person who did that stage, not the deal\u2019s officer', () => {
    const [row] = finishedAcross([deal], '2026-10-22')
    expect(row.what).toBe('Lending options')
    expect(row.who).toBe('Katie Amos')
  })

  it('counts from when the stage opened, not from when somebody was assigned', () => {
    // The stage opened when the BC closed, 24 Sep. 28 days to 22 Oct.
    const [row] = finishedAcross([deal], '2026-10-22')
    expect(row.days).toBe(28)
  })

  it('and a Sydney day, not the machine\u2019s day', () => {
    // 10pm Sydney on the 22nd is 11am UTC on the 22nd; 9am Sydney on the 23rd
    // is 10pm UTC on the 22nd and belongs to the 23rd.
    const late = { ...deal, lo_completed_at: '2026-10-22T11:00:00Z' }
    const next = { ...deal, lo_completed_at: '2026-10-22T22:00:00Z' }
    expect(finishedAcross([late], '2026-10-22')).toHaveLength(1)
    expect(finishedAcross([next], '2026-10-22')).toHaveLength(0)
    expect(finishedAcross([next], '2026-10-23')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// THE LINE
// ---------------------------------------------------------------------------
//
// 26 Oct 2026. The draft put everything sitting with a person on one list - on
// Fabio's own book that is fifty-eight deals, and a list of fifty-eight is not
// a plan. So the list has a line in it: above is today, below is the rest, and
// the person drags it to where their day ends. His call, asked straight out:
// "you pull the line down".

describe('above the line and below it', () => {
  it('a day starts as everything drafted, with the line at the bottom', () => {
    expect(startingOrder(['a', 'b', 'c'])).toEqual(['a', 'b', 'c', LINE])
    expect(splitAtLine(startingOrder(['a', 'b', 'c']))).toEqual({ today: ['a', 'b', 'c'], queue: [] })
  })

  it('and a saved day decides the line, not the draft', () => {
    // Somebody kept two above the line this morning. The third arrived since,
    // and goes to the queue rather than silently into a day already agreed.
    expect(startingOrder(['a', 'b', 'c'], ['a', 'b'])).toEqual(['a', 'b', LINE, 'c'])
  })

  it('a saved deal that is no longer theirs quietly drops out', () => {
    expect(startingOrder(['a', 'c'], ['a', 'b'])).toEqual(['a', LINE, 'c'])
  })

  it('a list with no line on it is all today', () => {
    expect(splitAtLine(['a', 'b'])).toEqual({ today: ['a', 'b'], queue: [] })
  })

  it('splits where the line is', () => {
    expect(splitAtLine(['a', 'b', LINE, 'c', 'd'])).toEqual({ today: ['a', 'b'], queue: ['c', 'd'] })
  })
})

describe('moving things, including the line', () => {
  const day = ['a', 'b', 'c', LINE, 'd']

  it('reorders a deal within the day', () => {
    expect(moveInOrder(day, 'c', 'a')).toEqual(['c', 'a', 'b', LINE, 'd'])
  })

  it('sends one back to the queue by dropping it on the end', () => {
    // What the cross does. It is a move, never a delete - it is back on the
    // list tomorrow, and a screen that loses a deal on a mis-tap is a screen
    // nobody trusts with their morning.
    expect(moveInOrder(day, 'b', null)).toEqual(['a', 'c', LINE, 'd', 'b'])
  })

  it('pulls one up out of the queue by dropping it on the line', () => {
    expect(moveInOrder(day, 'd', LINE)).toEqual(['a', 'b', 'c', 'd', LINE])
  })

  it('and moving the LINE itself is the same gesture', () => {
    // The whole trick: the line is an item in the list, so dragging it and
    // dragging a deal run the same code and cannot disagree about where the
    // day ends.
    expect(splitAtLine(moveInOrder(day, LINE, 'b'))).toEqual({ today: ['a'], queue: ['b', 'c', 'd'] })
  })

  it('nothing is lost whatever is dragged where', () => {
    for (const id of ['a', 'b', 'c', 'd', LINE]) {
      for (const before of ['a', 'b', 'c', 'd', LINE, null]) {
        const out = moveInOrder(day, id, before as any)
        expect([...out].sort(), `${id} onto ${before} lost something`).toEqual([...day].sort())
      }
    }
  })

  it('dropping something on itself changes nothing', () => {
    expect(moveInOrder(day, 'b', 'b')).toEqual(day)
  })
})

describe('a note about today', () => {
  it('keeps what was typed', () => {
    const n = withNote({}, 'deal-1', '  Chase CBA at 11  ')
    expect(n).toEqual({ 'deal-1': 'Chase CBA at 11' })
    expect(noteFor(n, 'deal-1')).toBe('Chase CBA at 11')
  })

  it('an empty note is no note rather than an empty one', () => {
    const n = withNote({ 'deal-1': 'something' }, 'deal-1', '   ')
    expect(n).toEqual({})
    expect(noteFor(n, 'deal-1')).toBe('')
  })

  it('and it never touches anybody else\u2019s', () => {
    const before = { a: 'one', b: 'two' }
    expect(withNote(before, 'c', 'three')).toEqual({ a: 'one', b: 'two', c: 'three' })
    expect(before, 'the original was edited in place').toEqual({ a: 'one', b: 'two' })
  })

  it('says nothing where nothing was written', () => {
    expect(noteFor(null, 'deal-1')).toBe('')
    expect(noteFor({}, 'deal-1')).toBe('')
  })
})
