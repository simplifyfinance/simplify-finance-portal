import { describe, it, expect } from 'vitest'
import { whereIsPaco, rungLabel, rungTone, byRung, RUNGS } from './the-ladder'

const TODAY = '2026-10-13'
const A_YEAR_AGO = '2025-09-01'

const doc = (id: string, lastChecked = TODAY) =>
  ({ id, last_checked_at: lastChecked })
const rule = (document_id: string, status: string) => ({ document_id, status })

describe('the four rungs', () => {
  it('are named in the words Fabio picked', () => {
    expect(RUNGS.map(rungLabel)).toEqual([
      'In the hangar', 'Ground school', 'Training wheels on', 'Wheels up',
    ])
  })

  it('wear only colours this portal already has, and never amber', () => {
    expect(RUNGS.map(rungTone)).toEqual(['quiet', 'quiet', 'info', 'done'])
  })

  it('sort lowest first, so the work is at the top', () => {
    expect([...RUNGS].sort(byRung)).toEqual(['hangar', 'ground', 'wheels', 'up'])
  })
})

describe('where Paco stands on one bank', () => {
  it('is in the hangar with nothing on file', () => {
    const s = whereIsPaco([], [], TODAY)
    expect(s.rung).toBe('hangar')
    expect(s.why).toMatch(/our own notes/)
    expect(s.documents).toBe(0)
  })

  it('is in ground school once a document is read and nobody has checked it', () => {
    const s = whereIsPaco([doc('d1')], [rule('d1', 'proposed'), rule('d1', 'proposed')], TODAY)
    expect(s.rung).toBe('ground')
    expect(s.waiting).toBe(2)
    expect(s.why).toMatch(/shows the quote/)
  })

  it('is still in ground school with a document nothing was read out of', () => {
    const s = whereIsPaco([doc('d1')], [], TODAY)
    expect(s.rung).toBe('ground')
    expect(s.why).toMatch(/nothing has been read out of it/)
  })

  it('has the training wheels on once some of it is checked', () => {
    const s = whereIsPaco([doc('d1')],
      [rule('d1', 'live'), rule('d1', 'live'), rule('d1', 'proposed')], TODAY)
    expect(s.rung).toBe('wheels')
    expect(s.checked).toBe(2)
    expect(s.waiting).toBe(1)
  })

  it('gets the wheels up when the whole thing has been looked at', () => {
    const s = whereIsPaco([doc('d1')], [rule('d1', 'live'), rule('d1', 'live')], TODAY)
    expect(s.rung).toBe('up')
    expect(s.why).toMatch(/quote on request/)
  })

  it('counts a rejected line as neither checked nor waiting', () => {
    const s = whereIsPaco([doc('d1')], [rule('d1', 'live'), rule('d1', 'rejected')], TODAY)
    expect(s.rung).toBe('up')
    expect(s.checked).toBe(1)
    expect(s.waiting).toBe(0)
  })
})

// THE HALF THAT MATTERS. A badge that only ever climbs is a badge that lies.
describe('it goes backwards', () => {
  it('drops off wheels up the moment a new document lands unread', () => {
    const settled = whereIsPaco([doc('d1')], [rule('d1', 'live')], TODAY)
    expect(settled.rung).toBe('up')

    const andThenOctoberArrives = whereIsPaco(
      [doc('d1'), doc('d2')],
      [rule('d1', 'live'), rule('d2', 'proposed'), rule('d2', 'proposed')], TODAY)
    expect(andThenOctoberArrives.rung).toBe('wheels')
    expect(andThenOctoberArrives.waiting).toBe(2)
  })

  it('holds a bank down when nobody has looked at the document in a year', () => {
    const s = whereIsPaco([doc('d1', A_YEAR_AGO)], [rule('d1', 'live')], TODAY)
    expect(s.rung).toBe('wheels')
    expect(s.why).toMatch(/not been looked at in a year/)
  })

  it('and says how many documents went stale, not just that one did', () => {
    const s = whereIsPaco(
      [doc('d1', A_YEAR_AGO), doc('d2', A_YEAR_AGO)],
      [rule('d1', 'live')], TODAY)
    expect(s.why).toMatch(/2 documents have not been looked at/)
  })
})

describe('it never falls over on rubbish', () => {
  it('takes nothing at all', () => {
    expect(whereIsPaco(null as any, null as any, TODAY).rung).toBe('hangar')
  })

  it('and a row with no status on it', () => {
    const s = whereIsPaco([doc('d1')], [{ document_id: 'd1' }, rule('d1', 'live')], TODAY)
    expect(s.rung).toBe('up')
    expect(s.checked).toBe(1)
  })
})

// NO POINTS, NO STREAK, NO LEADERBOARD.
describe('the badge is a readout, not a reward', () => {
  it('says nothing anywhere about helping, learning, levels or scores', () => {
    const everything = RUNGS.map(r => {
      const s = whereIsPaco([doc('d1')], [rule('d1', 'live')], TODAY)
      return `${rungLabel(r)} ${s.why}`
    }).join(' ').toLowerCase()
    for (const word of ['help paco', 'level', 'score', 'points', 'streak', 'well done', 'congratulations']) {
      expect(everything, `the badge says "${word}"`).not.toContain(word)
    }
  })
})
