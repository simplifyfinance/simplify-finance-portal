// "PREVIOUS EMPLOYER #1" MEANS TYPED FIRST. IT HAS NEVER MEANT MOST RECENT.
//
// 17 Nov 2026. A compliance note said "with a previous role ending in May
// 2025" on a file whose previous role ended 6 November 2026. Fabio: "the
// portal is not adjusting chronologically so AI notes confused the previous
// employment supposed to be 2026".
//
// The dates below are the ones off that file.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  when, inDateOrder, outOfOrder, currentRole, currentRoles, roleBefore,
  dateProblems, problemLine,
} from './employment-in-order'

const NOW = new Date('2026-11-17T09:00:00+11:00')

// Typed in the order they were typed, which is NOT date order.
const JOBS = [
  { id: 'now', isCurrent: true, employerName: 'Baymont Engineering',
    occupation: 'Project Engineer', startDate: '2026-11-09', endDate: '' },
  { id: 'older', isCurrent: false, employerName: 'Kerrand Civil',
    startDate: '2023-01-01', endDate: '2025-05-01' },
  { id: 'newer', isCurrent: false, employerName: 'Northway Infrastructure',
    occupation: 'Project Engineer', startDate: '2025-05-01', endDate: '2026-11-06' },
]
const him = { employment: JOBS }

describe('a date, however it was stored', () => {
  it('reads a picker date', () => {
    expect(when('2026-11-06')).toBe(Date.UTC(2026, 10, 6))
  })

  // 06/11/2026 is 6 November here and 11 June to new Date(). The note goes to
  // a lender, so the Australian order is read on purpose rather than left to
  // whichever browser is open.
  it('and reads a typed one the Australian way round', () => {
    expect(when('06/11/2026')).toBe(Date.UTC(2026, 10, 6))
    expect(when('06/11/2026')).not.toBe(when('11/06/2026'))
  })

  it('and a date nobody can read is null, never today and never zero', () => {
    expect(when('')).toBe(null)
    expect(when('sometime in 2019')).toBe(null)
    expect(when(null)).toBe(null)
  })
})

describe('the role before this one', () => {
  // THE BUG, IN ONE ASSERTION.
  it('is the most recent previous role, not the one typed first', () => {
    expect(roleBefore(him)?.employerName).toBe('Northway Infrastructure')
    expect(roleBefore(him)?.endDate).toBe('2026-11-06')
  })

  it('and the old code would have taken the other one', () => {
    const old = JOBS.find(e => !e.isCurrent && e.endDate)
    expect(old!.employerName, 'this is what find() was returning').toBe('Kerrand Civil')
  })

  it('a previous role with no end date cannot be the most recent', () => {
    const odd = { employment: [...JOBS, { id: 'x', isCurrent: false, employerName: 'No End', endDate: '' }] }
    expect(roleBefore(odd)?.employerName).toBe('Northway Infrastructure')
  })

  it('and nobody with a first job has a role before it', () => {
    expect(roleBefore({ employment: [JOBS[0]] })).toBe(null)
    expect(roleBefore({})).toBe(null)
    expect(roleBefore(null)).toBe(null)
  })
})

describe('the list in order', () => {
  it('current first, then finished roles newest first', () => {
    expect(inDateOrder(JOBS).map(e => e.id)).toEqual(['now', 'newer', 'older'])
  })

  it('and it says when it would move something', () => {
    expect(outOfOrder(JOBS)).toBe(true)
    expect(outOfOrder(inDateOrder(JOBS))).toBe(false)
    expect(outOfOrder([])).toBe(false)
  })

  // A LIST SOMEBODY IS TYPING INTO MUST NOT JUMP ABOUT.
  it('a role with no dates yet stays where it was put', () => {
    const typing = [...JOBS, { id: 'blank', isCurrent: false, employerName: '', endDate: '' }]
    expect(inDateOrder(typing).map(e => e.id)).toEqual(['now', 'newer', 'older', 'blank'])
  })

  it('and the list handed in is never touched', () => {
    const copy = [...JOBS]
    inDateOrder(JOBS)
    expect(JOBS).toEqual(copy)
  })

  it('two current jobs read the one started longest ago first', () => {
    const two = { employment: [
      { id: 'b', isCurrent: true, startDate: '2026-01-01', employerName: 'B' },
      { id: 'a', isCurrent: true, startDate: '2026-06-01', employerName: 'A' },
    ] }
    expect(currentRoles(two).map(e => e.id)).toEqual(['a', 'b'])
  })

  it('and a not-working row is never read as the job they are in', () => {
    const idle = { employment: [
      { id: 'idle', isCurrent: true, employmentType: 'Not working', startDate: '2026-01-01' },
      { id: 'job', isCurrent: true, employmentType: 'PAYG', startDate: '2025-01-01', employerName: 'Real' },
    ] }
    expect(currentRole(idle)?.id).toBe('job')
  })
})

// 17 Nov 2026, asked and answered: impossible dates only. A GAP IS NOT WARNED ON.
describe('dates that cannot be right', () => {
  const problems = (emp: any[]) => dateProblems({ employment: emp }, NOW).map(problemLine)

  it('a date in the future', () => {
    expect(problems([{ isCurrent: false, employerName: 'Kerrand Civil',
      startDate: '2023-01-01', endDate: '2028-05-01' }]))
      .toEqual(['Kerrand Civil ends in the future'])
  })

  it('an end date before its own start date', () => {
    expect(problems([{ isCurrent: false, employerName: 'Kerrand Civil',
      startDate: '2025-05-01', endDate: '2023-01-01' }]))
      .toEqual(['Kerrand Civil ends before it starts'])
  })

  it('two roles overlapping, with how long for', () => {
    const out = problems([
      { isCurrent: false, employerName: 'Northway', startDate: '2025-05-01', endDate: '2026-11-06' },
      { isCurrent: false, employerName: 'Kerrand', startDate: '2023-01-01', endDate: '2025-09-01' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toContain('overlaps Kerrand by 4 months')
  })

  // A SECOND JOB IS A RECORDED ANSWER, NOT A MISTAKE.
  it('and secondary employment is never called an overlap', () => {
    expect(problems([
      { isCurrent: false, employerName: 'Northway', startDate: '2025-05-01', endDate: '2026-11-06' },
      { isCurrent: false, employerName: 'Weekend job', employmentPriority: 'Secondary',
        startDate: '2025-06-01', endDate: '2026-01-01' },
    ])).toEqual([])
  })

  it('a gap between two jobs is not a problem', () => {
    expect(problems([
      { isCurrent: false, employerName: 'A', startDate: '2023-01-01', endDate: '2024-01-01' },
      { isCurrent: false, employerName: 'B', startDate: '2025-01-01', endDate: '2026-01-01' },
    ])).toEqual([])
  })

  it('and the real file has nothing wrong with it', () => {
    expect(dateProblems(him, NOW)).toEqual([])
  })

  it('a missing date is never a problem, only a blank', () => {
    expect(problems([{ isCurrent: false, employerName: 'A', startDate: '', endDate: '' }])).toEqual([])
  })
})

// THE NOTE MUST NEVER GO BACK TO READING THE LIST IN TYPING ORDER.
describe('nothing picks a role with find() any more', () => {
  const BOX = readFileSync('lib/box-four.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('box four asks this file for the role before, and for the current one', () => {
    expect(BOX).toContain('roleBefore(')
    expect(BOX, 'find() on employment is the bug this file exists for')
      .not.toContain('.find((e: any) => !e?.isCurrent')
  })
})
