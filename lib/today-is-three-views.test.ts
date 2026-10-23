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
    for (const want of [
      'Today, in this order',                      // credit and broker
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
    expect(dash).toContain("select('officer_id, broker_key, deal_ids, confirmed_at')")
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
