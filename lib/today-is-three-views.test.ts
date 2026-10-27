// TODAY IS THREE PAGES, NOT ONE.
//
// 23 Oct 2026. Fabio opened his own Today the morning after it shipped and
// sent a screenshot of it: "yeah look at mine!" It was empty. Every box on
// that page was written "only if you are a credit assessor", and four of the
// people who open it every day are not one.
//
// So: credit sees their day, a broker sees theirs and who in credit has their
// files, an admin sees the business. His rule where somebody is both, in his
// words: "a broker /admin, admin view supersedes".
//
// This file is the lock on all of it, and on the week - see lib/the-week.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const page = readFileSync('components/TodayPlan.tsx', 'utf8')
const dash = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')
// 26 Oct 2026. The day itself moved into its own file when it grew a line, an
// order you can drag and a note on each row - see components/MyDay.tsx.
const day = readFileSync('components/MyDay.tsx', 'utf8')

describe('three views, and admin wins', () => {
  it('picks the view from who is looking', () => {
    expect(page).toContain(
      "const view: 'credit' | 'admin' | 'broker' = meOfficerId ? 'credit' : seesAll ? 'admin' : 'broker'")
  })

  it('an admin who is also a broker gets the business, not their own list', () => {
    // seesAll is read BEFORE brokerKey in that line. If the order is ever
    // swapped, Fabio gets a broker's page again and the business view is
    // unreachable for the five people it was built for.
    // lastIndexOf, because 'broker' also appears in the type annotation at
    // the front of the same line. The first version of this test read that one
    // and failed on correct code.
    const line = page.split('\n').find(l => l.includes("meOfficerId ? 'credit'"))!
    expect(line.indexOf('seesAll')).toBeLessThan(line.lastIndexOf("'broker'"))
  })

  it('and a credit assessor who is also an admin still gets their own day', () => {
    const line = page.split('\n').find(l => l.includes("meOfficerId ? 'credit'"))!
    expect(line.indexOf('meOfficerId')).toBeLessThan(line.indexOf('seesAll'))
  })

  it('each view draws something of its own', () => {
    expect(day, 'the day list has lost its heading').toContain('Today, in this order')
    for (const want of [
      'With credit today',                         // broker
      'Where the book is this morning',            // admin
      'With us and on nobody',                     // admin
      'By broker',                                 // admin
      'The team today',                            // everybody
    ]) {
      expect(page, `the page no longer says "${want}"`).toContain(want)
    }
  })
})

describe('a file is never on two people’s day at once', () => {
  it('a broker’s own list leaves out what credit is carrying', () => {
    expect(page, 'the broker day no longer filters out credit-held deals')
      .toContain('.filter(d => !creditHasIt(d))')
  })

  it('and the question is asked per stage, not per deal', () => {
    const lib = readFileSync('lib/the-days-plan.ts', 'utf8')
    expect(lib).toContain('export function creditHasIt')
    // assigned_credit_officer is the deal-wide column that caused the problem
    // this replaced - a broker who did the BC himself could not be told apart
    // from one whose whole file sits with credit.
    const fn = lib.slice(lib.indexOf('export function creditHasIt'))
      .slice(0, lib.slice(lib.indexOf('export function creditHasIt')).indexOf('\n}'))
    expect(fn, 'creditHasIt is back to reading the deal-wide officer')
      .not.toContain('assigned_credit_officer')
    expect(fn).toContain('ownerOf(deal, stage)')
  })
})

describe('the week', () => {
  it('nothing is drawn on a weekend or a public holiday', () => {
    expect(page).toContain("import { whyNoPlan, lastWorkdayBefore } from '@/lib/the-week'")
    expect(page, 'the weekend rule has gone from the page')
      .toContain('if (whyNoPlan(today)) return null')
  })

  it('and yesterday means the last day anybody was at work', () => {
    expect(page).toContain('lastWorkdayBefore(today)')
    // A word boundary, because "lastWorkdayBefore(today)" has
    // "dayBefore(today)" inside it and a plain contains() reads the right
    // answer as the wrong one.
    expect(page, 'Monday is looking at Sunday again').not.toMatch(/\bdayBefore\(today\)/)
  })

  it('the flag does not count the weekend either', () => {
    const lib = readFileSync('lib/the-days-plan.ts', 'utf8')
    expect(lib).toContain('if (!isWorkday(day)) return []')
  })
})

describe('the page is given what the three views need', () => {
  it('the dashboard passes the flag, the key and the brokers’ plans', () => {
    for (const want of ['seesAll={!!seesAll}', 'brokerKey={brokerKey}',
                        'brokerNames={brokerNames}', 'brokerPlans={brokerPlans}']) {
      expect(dash, `the dashboard stopped passing ${want}`).toContain(want)
    }
  })

  it('and reads the brokers’ half of the plans table', () => {
    // The exact column list is checked once, further down, where the day's
    // notes are. Two tests naming the same string is how the first run of
    // this ship failed: the query grew a column and this line still wanted
    // the old one.
    expect(dash).toContain('broker_key, deal_ids')
  })

  it('a broker’s plan is saved against their key, not an officer id', () => {
    expect(page).toContain('row.broker_key = brokerKey')
    expect(page).toContain("onConflict: meOfficerId ? 'officer_id,plan_date' : 'broker_key,plan_date'")
  })

  it('and a write that saves nothing is still treated as a failure', () => {
    // RLS refuses by returning no rows and no error. Every write in this
    // portal checks the rows, not the error.
    expect(page).toContain('if (error || !data?.length)')
  })
})

describe('it is still the portal’s own colours', () => {
  it('no amber, anywhere', () => {
    expect(page).not.toMatch(/amber|yellow|orange/)
  })

  it('and the brokers’ keys are never printed at a person', () => {
    // assigned_broker holds 'fabio', not 'Fabio De Castro'. Every screen that
    // shows a broker reads the register - see brokerNames on the dashboard.
    expect(page).toContain('brokerNames[String(key || \'\').toLowerCase()]')
  })
})

// ---------------------------------------------------------------------------
// A DAY THAT IS A DAY
// ---------------------------------------------------------------------------
//
// 26 Oct 2026. Fabio, after a week of the first version: "we should be able to
// remove from list as everything that is allocated is being allocated to be
// done in one day". The draft listed everything sitting with a person. On his
// own book that is fifty-eight deals.

describe('the line', () => {
  it('the day is drawn from one order with the line in it', () => {
    expect(page).toContain('startingOrder(mine.map(d => d.id)')
    expect(page).toContain('splitAtLine(dayOrder).today')
  })

  it('and only what is above it is saved as the day', () => {
    // Saving the queue as the plan is how a day became a book in the first
    // place, and it would put every deal on the admin "planned" list too.
    expect(page).toContain('deal_ids: todayIds')
    expect(page, 'the whole draft is being saved as the day again')
      .not.toContain('deal_ids: mine.map(d => d.id)')
  })

  it('the line is dragged like anything else in the list', () => {
    expect(day).toContain('onDragStart={() => setDrag(LINE)}')
    expect(day).toContain('moveInOrder(items, drag, before)')
  })

  it('and the cross is a move, never a delete', () => {
    // It drops the deal below the line. It is on the list again tomorrow.
    expect(day).toContain('setOrder(moveInOrder(items, id, null))')
    expect(day, 'something is being deleted off a day')
      .not.toMatch(/\.filter\(x => x !== id\)[\s\S]{0,40}setOrder/)
  })
})

describe('what a person can write and mark', () => {
  it('a note on a deal, for today', () => {
    expect(day).toContain('setNote(id, e.target.value)')
    expect(page).toContain('setNotes(n => withNote(n, id, text))')
    expect(page).toContain('notes, on_it_now: onItNow')
  })

  it('and one deal marked as the one they are on', () => {
    expect(day).toContain('setOnItNow(now ? null : id)')
    expect(day).toContain('On it now')
  })

  it('every row says why it is where it is', () => {
    // The draft's reason, not the person's - drag it anywhere and the tag
    // still says what put it there.
    //
    // 27 Oct 2026. This used to look for "S NEXT", off a chip that read
    // "MARK'S NEXT". It now reads "MARK ASKED FOR THIS" - the words changed
    // with Catherine's item 2, because a broker marking a file is now an ASK
    // with a reason on it rather than a flag, and three of them on one day
    // have to be told apart. See lib/a-slot-each.ts.
    expect(day).toContain('askChip(d.priority')
    expect(day).toContain("'oldest · '")
  })

  it('and whose file it is, which it never said until today', () => {
    // Catherine, Operations Manager, 27 Oct 2026: "The deal lists the credit
    // managers send don't show which broker each deal belongs to."
    expect(day).toContain('brokerLabel(d.broker).toUpperCase()')
  })
})

describe('the plan table is asked for all of it', () => {
  it('the day, the notes and the one they are on', () => {
    expect(dash).toContain("select('officer_id, broker_key, deal_ids, confirmed_at, notes, on_it_now')")
  })

  it('and the columns exist to put them in', () => {
    const sql = readFileSync('docs/a-day-is-a-day.sql', 'utf8')
    expect(sql).toContain('add column if not exists notes')
    expect(sql).toContain('add column if not exists on_it_now')
    // The afternoon of 23 Oct 2026, in one line.
    expect(sql, 'a foreign key is back on a hot table').not.toContain('references public.deals')
  })
})
