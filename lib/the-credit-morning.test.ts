import { describe, it, expect } from 'vitest'
import { creditMorning, othersFor, moveWords } from './the-credit-morning'

const katie = { id: 'k', name: 'Katie Amos', informedAt: '2026-11-16T09:48:00Z',
  yesterdayCount: 0, todayCount: 5, open: 13 }
const mel = { id: 'm', name: 'Mellissa Sedin', informedAt: '2026-11-16T09:32:00Z',
  yesterdayCount: 2, todayCount: 2, open: 11 }

describe('the credit morning, added up', () => {
  it('adds the two of them together', () => {
    const s = creditMorning([katie, mel])
    expect(s.onToday).toBe(7)
    expect(s.doneYesterday).toBe(2)
    expect(s.openTotal).toBe(24)
    expect(s.sent).toBe(2)
    expect(s.team).toBe(2)
  })

  it('counts what is on nobody day', () => {
    expect(creditMorning([katie, mel]).unwatched).toBe(17)
  })

  it('never reports a negative when a plan outlives the file', () => {
    expect(creditMorning([{ ...katie, open: 2, todayCount: 5 }]).unwatched).toBe(0)
  })

  it('a morning nobody has planned is zeros, not blanks', () => {
    const s = creditMorning([{ id: 'k', name: 'Katie Amos', open: 13 }])
    expect(s.sent).toBe(0)
    expect(s.onToday).toBe(0)
    expect(s.unwatched).toBe(13)
  })

  it('an empty team does not throw', () => {
    expect(creditMorning([])).toEqual({
      sent: 0, team: 0, onToday: 0, doneYesterday: 0, openTotal: 0, unwatched: 0,
    })
  })

  it('rubbish counts read as none', () => {
    const s = creditMorning([{ id: 'k', name: 'K', open: -4, todayCount: NaN as any }])
    expect(s.openTotal).toBe(0)
    expect(s.onToday).toBe(0)
  })
})

describe('where a file can be moved', () => {
  it('offers the other assessor', () => {
    expect(othersFor([katie, mel], 'k')).toEqual([{ id: 'm', name: 'Mellissa Sedin' }])
  })

  it('offers nobody when she is the only one', () => {
    expect(othersFor([katie], 'k')).toEqual([])
  })

  it('says it in first names', () => {
    expect(moveWords('Mellissa Sedin')).toBe('Move to Mellissa')
    expect(moveWords('  ')).toBe('Move to the other one')
  })
})

// 18 Nov 2026. Dinisha is on maternity leave and on the board, so her queue can
// be stacked and waiting - but she is not somebody who failed to send a plan.
describe('somebody on leave', () => {
  const away = { id: 'd', name: 'Dinisha Devadason', onLeave: true, open: 4 }

  it('is not counted as a team member who has not sent', () => {
    const s = creditMorning([katie, mel, away])
    expect(s.team).toBe(2)
    expect(s.sent).toBe(2)
  })

  it('and her files are not counted as the team being buried', () => {
    expect(creditMorning([katie, mel, away]).openTotal).toBe(24)
  })

  it('a team of nobody but somebody on leave reads as empty', () => {
    expect(creditMorning([away]).team).toBe(0)
  })
})
