// THE BROKER'S OWN MONDAY.
//
// 12 Nov 2026, mocked and approved: "The Monday ask is the whole point. His
// four answers are exactly what fills your Simplify Finance Brokers section on
// the admin page - same three buttons, same three answers, written to the same
// place. Nobody types anything twice."
//
// So the two things these tests hold are: he is asked about the right deals,
// and the rules are the MEETING'S rules, not a second set written for this
// screen. If the two ever disagreed, a broker would answer about a deal that
// never reached the meeting.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  isMonday, askAbout, progress, progressWords, allAnswered,
  stageOf, byStage, STAGE_ORDER, whoHasIt, stageNote,
} from './the-brokers-monday'

const sameBroker = (a: any, b: any) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

const MON = new Date('2026-11-16T00:00:00+11:00')   // Monday in Sydney
const SUN = new Date('2026-11-15T23:00:00+11:00')   // still Sunday there

describe('is it Monday', () => {
  it('in Sydney, not on the server', () => {
    expect(isMonday(MON)).toBe(true)
    expect(isMonday(SUN)).toBe(false)
  })

  // 13:00 UTC Sunday is already Monday in the office. A server asking its own
  // clock would have said no.
  it('and the office gets its Monday eleven hours before London does', () => {
    expect(isMonday(new Date('2026-11-15T13:00:00.000Z'))).toBe(true)
  })
})

describe('which deals he is asked about', () => {
  const deals = [
    { id: 'a', assigned_broker: 'keanen', compliance_sent_at: '2026-11-10T00:00:00Z' },
    { id: 'b', assigned_broker: 'keanen', lo_client_proceeded: true, client_proceeded: true },
    { id: 'c', assigned_broker: 'keanen' },                      // fact find - not ready
    { id: 'd', assigned_broker: 'justin', compliance_sent_at: '2026-11-10T00:00:00Z' },
  ]

  it('his own, and nobody else\'s', () => {
    expect(askAbout(deals, 'keanen', sameBroker).map(d => d.id)).not.toContain('d')
  })

  // ASKING HIM ABOUT A FACT FIND IS ASKING HIM TO GUESS.
  it('and only the ones that could actually lodge', () => {
    expect(askAbout(deals, 'keanen', sameBroker).map(d => d.id)).not.toContain('c')
  })

  it('closest to lodging first', () => {
    expect(askAbout(deals, 'keanen', sameBroker)[0].id).toBe('a')
  })

  it('and nothing at all without a broker key', () => {
    expect(askAbout(deals, '', sameBroker)).toEqual([])
    expect(askAbout(deals, null, sameBroker)).toEqual([])
  })
})

describe('how far through he is', () => {
  // An answer is what patchForAnswer() writes - lib/lodging-when.ts - plus the
  // stage that makes the deal askable in the first place. Written here the way
  // the database holds it, not the way I guessed it.
  const ready = { compliance_sent_at: '2026-11-10T00:00:00Z' }
  const answered = { id: '1', ...ready, lodgement_plan: 'week', lodgement_week: '2026-11-16' }
  const not = { id: '2', ...ready }

  it('counts the ones with an answer', () => {
    const p = progress([answered, not, not], MON)
    expect(p).toEqual({ answered: 1, toGo: 2, all: 3 })
  })

  it('and says so in words', () => {
    expect(progressWords({ answered: 4, toGo: 2, all: 6 })).toBe('4 answered · 2 to go')
    expect(progressWords({ answered: 6, toGo: 0, all: 6 })).toBe('all 6 answered')
    expect(progressWords({ answered: 0, toGo: 0, all: 0 })).toBe('')
  })

  it('and knows when he is done', () => {
    expect(allAnswered([answered], MON)).toBe(true)
    expect(allAnswered([answered, not], MON)).toBe(false)
    // Nothing to answer is not the same as finished.
    expect(allAnswered([], MON)).toBe(false)
  })
})

// 14 NOV 2026. I wrote a second ladder here first - reading lodged_at and
// compliance_sent_at straight off the deal - and that is the fault this whole
// week has been about. phaseOf() is the portal's answer and this only folds it.
describe('where my deals are', () => {
  it('asks the portal what phase a deal is in, rather than deciding again', () => {
    const src = readFileSync('lib/the-brokers-monday.ts', 'utf8')
    const code = src.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n')
    expect(code).toContain('phaseOf(deal)')
    expect(code, 'reading a milestone column here is a second ladder')
      .not.toMatch(/deal\?\.(lodged_at|compliance_sent_at|bc_completed_at)/)
  })

  it('folds the thirteen phases into the five a broker thinks in', () => {
    expect(stageOf({ })).toBe('Fact find')
    expect(stageOf({ client_proceeded: true, dob: '1 Jan' })).toBeTruthy()
    expect(stageOf({ compliance_sent_at: '2026-11-10T00:00:00Z' })).toBe('Compliance')
    expect(stageOf({ lodged_at: '2026-11-10T00:00:00Z' })).toBe('Lodged, waiting on the bank')
    expect(stageOf({ formal_approval_at: '2026-11-10T00:00:00Z', lodged_at: '2026-11-09T00:00:00Z' }))
      .toBe('Lodged, waiting on the bank')
  })

  // A FINISHED DEAL IS NOT SOMEWHERE YOU CAN CHASE IT.
  it('and leaves finished and lost deals out entirely', () => {
    expect(stageOf({ settled_at: '2026-11-10T00:00:00Z' })).toBe(null)
    expect(stageOf({ status: 'lost' })).toBe(null)
    expect(stageOf(null)).toBe(null)
  })

  it('and only lists the stages that have something in them', () => {
    const rows = byStage([{}, {}, { lodged_at: '2026-11-10T00:00:00Z' }])
    expect(rows.map(r => r.stage)).toEqual(['Fact find', 'Lodged, waiting on the bank'])
    expect(rows[0].count).toBe(2)
  })

  it('in the order a deal moves through them', () => {
    expect(STAGE_ORDER[0]).toBe('Fact find')
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe('Lodged, waiting on the bank')
  })
})

describe('who is holding it, in the words a broker would use', () => {
  const name = (id: any) => (id === 'mel' ? 'Mellissa' : '')

  it('names the person, not an id', () => {
    expect(whoHasIt({ assigned_credit_officer: 'mel' }, name)).toBe('Mellissa has it')
  })

  it('says it is his when nobody here has it', () => {
    expect(whoHasIt({}, name)).toBe('With you')
  })

  it('and the lender once it is lodged', () => {
    expect(whoHasIt({ lodged_at: '2026-11-10T00:00:00Z' }, name)).toBe('With the lender')
  })

  it('and the line under a stage says what is happening in it', () => {
    const rows = byStage([{ assigned_credit_officer: 'mel' }, {}])
    expect(stageNote(rows[0], name)).toBe('1 with credit, 1 with you')
  })
})
