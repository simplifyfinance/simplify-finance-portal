import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { lodgingThisWeek, theWeeksPriority, weekWords } from './the-weeks-priority'
import { patchForAnswer } from './lodging-when'

// PRIORITY FOR THE WEEK.
//
// 19 Nov 2026. Fabio: "since we as management decide the deals that are to be
// lodged today, this week... we should be having something in their today page
// that will show this is a priority for the week."
//
// And then, on where it goes: "I'd rather a new box that shows deals that are
// on our today and they update as we update say this week or change to next
// week so that disapers just a box saying priorty for the week."
//
// THE MOCK IS IN THE REPO, and this test reads it off the disk rather than out
// of my memory of it - docs/approved-looks/today-priority-for-the-week.html.
// Fabio, more than once: "why are you never follow up the mock ups that we
// spend so much time doing". A mock that only exists in a conversation is a
// mock nothing can check.

const MOCK = readFileSync('docs/approved-looks/today-priority-for-the-week.html', 'utf8')
const TODAY = readFileSync('components/TodayPlan.tsx', 'utf8')
const PICK = readFileSync('components/PickTheDay.tsx', 'utf8')

const monday = new Date('2026-11-16T09:00:00')
const thisWeek = { id: 'a', ...patchForAnswer('this', monday) }
const nextWeek = { id: 'b', ...patchForAnswer('next', monday) }

describe('which deals the box holds', () => {
  it('the ones somebody said are lodging this week', () => {
    expect(lodgingThisWeek(thisWeek, monday)).toBe(true)
  })

  it('and it follows the answer - move it to next week and it leaves', () => {
    // The whole point of the box. Fabio: "they update as we update say this
    // week or change to next week so that disapers."
    expect(lodgingThisWeek(nextWeek, monday)).toBe(false)
  })

  it('a deal nobody has said a week for is not in it', () => {
    expect(lodgingThisWeek({ id: 'c' }, monday)).toBe(false)
  })
})

describe('the order, and what it is for', () => {
  const rows = theWeeksPriority([
    { id: '1', name: 'In her day', where: 'Compliance', days: 2 },
    { id: '2', name: 'Not in her day', where: 'LO', days: 5 },
    { id: '3', name: 'Not in her day, older', where: 'BC', days: 9 },
  ], ['1'])

  it('the ones she is NOT on come first - that is the row to act on', () => {
    expect(rows.map(r => r.id)).toEqual(['3', '2', '1'])
  })

  it('and oldest first inside each, like every other list on this screen', () => {
    expect(rows[0].days).toBe(9)
    expect(rows[1].days).toBe(5)
  })

  it('each row says whether she has ticked it into today', () => {
    expect(rows.find(r => r.id === '1')!.onToday).toBe(true)
    expect(rows.find(r => r.id === '2')!.onToday).toBe(false)
  })
})

describe('the words under it', () => {
  const row = (id: string, on: boolean) => ({ id, name: id, where: 'BC', days: 1, onToday: on })
  it('says so plainly when there is nothing', () => {
    expect(weekWords([])).toBe('Nothing of yours is down to lodge this week.')
  })
  it('and counts without arithmetic when it is part way', () => {
    expect(weekWords([row('a', true), row('b', false), row('c', false)]))
      .toBe('1 of 3 are in your day.')
  })
  it('and never tells her off', () => {
    expect(weekWords([row('a', false)])).toBe('It is not in your day.')
    expect(weekWords([row('a', true), row('b', true)])).toBe('All of them are in your day.')
  })
})

describe('the screen draws what the mock drew', () => {
  it('a box called Priority for the week, under Inform management', () => {
    expect(MOCK).toContain('Priority for the week')
    expect(TODAY).toContain('Priority for the week')
    // tellBox is "3 - Inform management". The week box goes straight after it.
    const order = TODAY.indexOf('{weekBox}')
    const tell = TODAY.indexOf("view === 'credit' ? tellBox")
    const waiting = TODAY.indexOf('{waitingBox}')
    expect(tell).toBeGreaterThan(-1)
    expect(order).toBeGreaterThan(tell)
    expect(waiting).toBeGreaterThan(order)
  })

  it('with a black head and the count in it, as the mock draws it', () => {
    expect(TODAY).toContain('bg-ink px-5 py-2.5')
    expect(TODAY).toContain('{weekRows.length}')
  })

  it('and On today / Not on today beside each row', () => {
    expect(MOCK).toContain('On today')
    expect(MOCK).toContain('Not on today')
    expect(TODAY).toContain("{r.onToday ? 'On today' : 'Not on today'}")
  })

  it('the line that says it looks after itself', () => {
    expect(MOCK).toContain('drops off here by itself')
    expect(TODAY).toContain('drops off here by itself')
  })

  it('credit only - Katie, Mellissa and Dinisha', () => {
    expect(TODAY).toContain("const weekBox = view === 'credit' &&")
  })
})

describe('the chip on the row', () => {
  it('is black, and the mock says This week', () => {
    expect(MOCK).toContain('This week')
    expect(PICK).toContain("<span className={WEEK_C}>This week</span>")
    expect(PICK).toContain('border-ink bg-ink text-page')
  })

  it('and it follows the deal into her day', () => {
    // Two of them: one on the list row, one on the day row.
    expect(PICK.split('<span className={WEEK_C}>This week</span>').length - 1).toBe(2)
  })
})

describe('the right-hand column is the lender only now', () => {
  it('because the client ones are on her list', () => {
    expect(MOCK).toContain('Yours, with the lender')
    expect(TODAY).toContain("meOfficerId ? 'Yours, with the lender'")
    expect(TODAY).toContain("!(meOfficerId && x.has!.holder === 'client')")
  })
})
