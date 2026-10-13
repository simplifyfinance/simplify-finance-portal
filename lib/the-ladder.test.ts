import { describe, it, expect } from 'vitest'
import { whereIsPaco, rungLabel, rungTone, byRung, RUNGS } from './the-ladder'

const doc = (id: string) => ({ id })
const line = (status = 'live') => ({ status })
const note = (retired = '') => ({ retired_at: retired })

describe('the four rungs', () => {
  it('are named in the words Fabio picked', () => {
    expect(RUNGS.map(rungLabel)).toEqual([
      'In the hangar', 'Ground school', 'Training wheels on', 'Wheels up',
    ])
  })

  // Purple is what one of us said, blue is what the bank wrote - the same two
  // colours Paco answers in, so the tile and the answer agree.
  it('wear only colours this portal already has, and never amber', () => {
    expect(RUNGS.map(rungTone)).toEqual(['quiet', 'waiting', 'info', 'done'])
  })

  it('sort lowest first, so the banks he knows least about come up the top', () => {
    expect([...RUNGS].sort(byRung)).toEqual(['hangar', 'ground', 'wheels', 'up'])
  })
})

describe('where Paco stands on one bank', () => {
  it('is in the hangar with nothing at all', () => {
    const s = whereIsPaco([], [], [])
    expect(s.rung).toBe('hangar')
    expect(s.why).toMatch(/says so rather than guessing/)
  })

  it('is still in the hangar with a document nothing was read out of', () => {
    const s = whereIsPaco([doc('d1')], [], [])
    expect(s.rung).toBe('hangar')
    expect(s.why).toMatch(/nothing has been read out of it yet/)
  })

  // A REAL AND COMMON STATE. Before this it looked identical to a bank with
  // nothing, and it is not the same: somebody knows something and nobody has
  // got the manual yet.
  it('is in ground school on hearsay alone', () => {
    const s = whereIsPaco([], [], [note(), note()])
    expect(s.rung).toBe('ground')
    expect(s.fromUs).toBe(2)
    expect(s.fromTheBank).toBe(0)
    expect(s.why).toMatch(/Nothing the bank has written down/)
  })

  it('has the training wheels on once the bank’s own document is in', () => {
    const s = whereIsPaco([doc('d1')], [line(), line(), line()], [])
    expect(s.rung).toBe('wheels')
    expect(s.fromTheBank).toBe(3)
    expect(s.why).toMatch(/Nothing from us yet/)
  })

  it('gets the wheels up with the document and our own on top', () => {
    const s = whereIsPaco([doc('d1')], [line(), line()], [note()])
    expect(s.rung).toBe('up')
    expect(s.why).toMatch(/2 lines from the bank, and 1 thing we have told him/)
  })

  it('reads properly when there is one of each', () => {
    expect(whereIsPaco([doc('d1')], [line()], [note()]).why)
      .toBe('1 line from the bank, and 1 thing we have told him on top.')
  })
})

// NOTHING IS TICKED ANY MORE, SO NOTHING COUNTS TICKS.
describe('a line is in the moment it is read', () => {
  it('counts a line nobody has looked at, because looking is not a job', () => {
    expect(whereIsPaco([doc('d1')], [line('proposed')], []).fromTheBank).toBe(1)
    expect(whereIsPaco([doc('d1')], [line('live')], []).fromTheBank).toBe(1)
  })

  // THE ONE THING THAT STILL STOPS A LINE. Somebody read it against the
  // document and said it was wrong. That is a decision and it stands.
  it('but not one somebody has said is wrong', () => {
    const s = whereIsPaco([doc('d1')], [line('live'), line('rejected')], [])
    expect(s.fromTheBank).toBe(1)
  })

  it('and not a note that has been retired', () => {
    const s = whereIsPaco([], [], [note(), note('2026-10-01T00:00:00Z')])
    expect(s.fromUs).toBe(1)
  })
})

describe('it goes backwards', () => {
  it('drops when the last thing we told him is retired', () => {
    expect(whereIsPaco([doc('d1')], [line()], [note()]).rung).toBe('up')
    expect(whereIsPaco([doc('d1')], [line()], [note('2026-10-01T00:00:00Z')]).rung).toBe('wheels')
  })

  it('and all the way down when a line is called wrong and the note retired', () => {
    expect(whereIsPaco([doc('d1')], [line('rejected')], [note('2026-10-01T00:00:00Z')]).rung).toBe('hangar')
  })
})

describe('it never falls over on rubbish', () => {
  it('takes nothing at all', () => {
    expect(whereIsPaco(null as any, null as any, null as any).rung).toBe('hangar')
  })

  it('and rows with nothing on them', () => {
    expect(whereIsPaco([doc('d1')], [{}, {}], [{}]).fromTheBank).toBe(2)
  })
})

// NO POINTS, NO STREAK, NO LEADERBOARD.
describe('the badge is a readout, not a reward', () => {
  it('says nothing about helping, learning, levels or scores', () => {
    const everything = [
      ...RUNGS.map(rungLabel),
      whereIsPaco([], [], []).why,
      whereIsPaco([], [], [note()]).why,
      whereIsPaco([doc('d')], [line()], []).why,
      whereIsPaco([doc('d')], [line()], [note()]).why,
    ].join(' ').toLowerCase()
    for (const word of ['help paco', 'level', 'score', 'points', 'streak', 'well done', 'congratulations']) {
      expect(everything, `the badge says "${word}"`).not.toContain(word)
    }
  })

  // AND IT NEVER NAGS. The whole reason the old rungs went is that they
  // counted a job nobody had agreed to do.
  it('and never asks anybody to check, confirm, tick or approve anything', () => {
    const everything = [
      whereIsPaco([], [], []).why,
      whereIsPaco([], [], [note()]).why,
      whereIsPaco([doc('d')], [line()], []).why,
      whereIsPaco([doc('d')], [line(), line()], [note()]).why,
    ].join(' ').toLowerCase()
    for (const word of ['confirm', 'tick', 'approve', 'waiting', 'review', 'check']) {
      expect(everything, `the badge is nagging: "${word}"`).not.toContain(word)
    }
  })
})
