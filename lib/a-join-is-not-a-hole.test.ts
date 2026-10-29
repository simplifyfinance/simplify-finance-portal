import { describe, it, expect } from 'vitest'
import { gapsInHistory, gapInWords } from './fact-find'

// A JOIN IS NOT A HOLE.
//
// 29 Oct 2026. Fabio, on an address history that runs straight through:
// "clearly theres no gap!!!"
//
//   Previous address   01/09/2020 - 31/12/2024
//   Current address    01/01/2025 - now
//
// and the form said "Nothing recorded between December 2024 and January 2025."
// One day apart, and the portal called it a month missing.
//
// THE UNIT WAS WRONG. Gaps are counted in whole months, which is right for
// reporting one and wrong for deciding whether there is one: 31 December and
// 1 January are a day apart and fall in different months.
//
// AND THE OBVIOUS FIX WAS WRONG TOO. Covering the end month outright would have
// merged "out 1 March, in 30 April" into an unbroken run with two months
// missing inside it. Two existing tests in lib/history.test.ts refused that
// version, correctly. So the joins are closed in days, and only what survives
// becomes months.

const TODAY = new Date('2026-09-03')
const words = (e: any[]) => gapsInHistory(e, TODAY).map(gapInWords)

describe('THE ONE FABIO SENT', () => {
  const history = [
    { isCurrent: true, startDate: '2025-01-01' },
    { startDate: '2020-09-01', endDate: '2024-12-31' },
  ]

  it('is not a gap', () => {
    expect(words(history)).toEqual([])
  })

  it('and it is not a gap whichever order the entries are in', () => {
    expect(words([...history].reverse())).toEqual([])
  })
})

describe('THE DAY BETWEEN TWO ADDRESSES', () => {
  const run = (endDate: string, nextStart: string) => words([
    { isCurrent: true, startDate: nextStart },
    { startDate: '2021-01-01', endDate },
  ])

  it('out on the last day, in on the first, is one move', () => {
    expect(run('2025-06-30', '2025-07-01')).toEqual([])
  })

  it('and the same day twice is one move', () => {
    expect(run('2025-06-30', '2025-06-30')).toEqual([])
  })

  it('AND A FORTNIGHT IS STILL ONE MOVE', () => {
    // Nobody signs the new lease the morning they hand back the old keys.
    expect(run('2025-06-20', '2025-07-04')).toEqual([])
  })

  it('but a month apart is a month to account for', () => {
    expect(run('2025-06-01', '2025-08-01')).not.toEqual([])
  })
})

describe('WHAT MUST STILL BE CAUGHT', () => {
  it('four months between two addresses', () => {
    expect(words([
      { isCurrent: true, startDate: '2025-07-03' },
      { startDate: '2023-01-03', endDate: '2025-03-03' },
    ])).toEqual(['March 2025 and July 2025'])
  })

  it('AND THE CASE THAT KILLED MY FIRST ATTEMPT', () => {
    // Out on 1 March, in on 30 April. Covering the end month outright would
    // have joined these into an unbroken run with two months missing in it.
    const g = words([
      { isCurrent: true, startDate: '2025-04-30' },
      { startDate: '2022-01-01', endDate: '2025-03-01' },
    ])
    expect(g, 'two months vanished').not.toEqual([])
  })

  it('and two holes are still two questions', () => {
    expect(words([
      { isCurrent: true, startDate: '2026-06-03' },
      { startDate: '2025-01-03', endDate: '2025-09-03' },
      { startDate: '2024-01-03', endDate: '2024-06-03' },
    ])).toEqual(['June 2024 and January 2025', 'September 2025 and June 2026'])
  })

  it('and a hole at the end, where nothing current is recorded', () => {
    expect(words([
      { startDate: '2022-01-01', endDate: '2026-03-01' },
    ])).not.toEqual([])
  })

  it('and an unbroken run has none', () => {
    expect(words([
      { isCurrent: true, startDate: '2024-01-03' },
      { startDate: '2021-01-03', endDate: '2024-01-03' },
    ])).toEqual([])
  })
})

describe('AND NOTHING FALLS OVER ON RUBBISH', () => {
  it('an entry with no start date is left out rather than guessed at', () => {
    expect(words([{ isCurrent: true, startDate: '' }])).toEqual([])
    expect(words([])).toEqual([])
  })

  it('and a date nobody can read is ignored, not treated as today', () => {
    expect(words([
      { isCurrent: true, startDate: '2025-01-01' },
      { startDate: 'last winter', endDate: 'the other one' },
    ])).toEqual(words([{ isCurrent: true, startDate: '2025-01-01' }]))
  })

  it('and an end before its own start does not invent a span', () => {
    expect(() => words([{ startDate: '2025-06-01', endDate: '2024-01-01' }])).not.toThrow()
  })
})
