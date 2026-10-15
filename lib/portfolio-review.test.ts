import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  STAGES, OUTCOMES, stageLabel, outcomeLabel, stageIndex,
  totalCost, depositNeeded, contributionCheck, usableEquity, totalUsableEquity,
  daysUntil, dueState, whenDue, countsFor, sortForTheList,
  greetingName, canSendTheEmail,
} from './portfolio-review'

// A FIXED MONDAY. Every date test is against this and never against new Date(),
// because a list that says "due today" has to be testable on a day that is not
// today.
//
// BUILT FROM LOCAL PARTS, NOT PARSED FROM A STRING WITH AN OFFSET IN IT.
// '2026-10-19T09:00:00+11:00' is Monday in Melbourne and Sunday night in UTC,
// so the first version of this test passed in Australia and failed on a build
// machine. Month 9 is October - Javascript counts months from zero.
const MONDAY = new Date(2026, 9, 19, 9, 0)

describe('the stages match the ones the database will accept', () => {
  // docs/portfolio-review-schema.sql has the same six in a check constraint.
  // Two lists free to disagree is the mistake this codebase keeps writing notes
  // about, so the file itself is read rather than trusted.
  const sql = readFileSync('docs/portfolio-review-schema.sql', 'utf8')

  it('every stage here is allowed there', () => {
    for (const s of STAGES) {
      expect(sql, `the database will refuse status '${s.key}'`).toContain(`'${s.key}'`)
    }
  })

  it('every outcome here is allowed there', () => {
    for (const o of OUTCOMES) {
      expect(sql, `the database will refuse outcome '${o.key}'`).toContain(`'${o.key}'`)
    }
  })

  it('and the order is the order of the work', () => {
    expect(stageIndex('not_reviewed')).toBeLessThan(stageIndex('numbers_done'))
    expect(stageIndex('numbers_done')).toBeLessThan(stageIndex('template_sent'))
    expect(stageIndex('template_sent')).toBeLessThan(stageIndex('closed'))
  })

  it('an unknown stage reads as not reviewed rather than falling over', () => {
    expect(stageLabel('nonsense')).toBe('Not reviewed')
    expect(stageLabel(null)).toBe('Not reviewed')
    expect(outcomeLabel(null)).toBe('')
  })
})

describe('the money', () => {
  it('adds the duty to the price', () => {
    expect(totalCost(650000, 24740)).toBe(674740)
  })

  it('survives a figure typed with a dollar sign and commas', () => {
    // Number('$650,000') is NaN, and that exact mistake has already taken a
    // report down in this codebase.
    expect(totalCost('$650,000', '$24,740')).toBe(674740)
  })

  it('works out the deposit rather than being told it', () => {
    expect(depositNeeded(650000, 24740, 520000)).toBe(154740)
  })

  it('says nothing rather than zero when it cannot answer', () => {
    // Zero is a claim. It says the deposit is nothing.
    expect(totalCost(null, 24740)).toBeNull()
    expect(depositNeeded(650000, 24740, null)).toBeNull()
  })

  it('treats a missing duty as nothing, because that is a real case', () => {
    expect(totalCost(650000, null)).toBe(650000)
  })
})

describe('the contribution has to tie out', () => {
  const check = (e: any, s: any) => contributionCheck(650000, 24740, 520000, e, s)

  it('adds up exactly', () => {
    const c = check(130000, 24740)
    expect(c.kind).toBe('adds-up')
    expect(c.kind === 'adds-up' && c.deposit).toBe(154740)
  })

  it('says by how much it is short, not just that it is', () => {
    const c = check(120000, 24740)
    expect(c.kind).toBe('short')
    expect(c.kind === 'short' && c.by).toBe(10000)
  })

  it('and by how much it is over', () => {
    // 140,000 + 24,740 = 164,740 against a deposit of 154,740.
    const c = check(140000, 24740)
    expect(c.kind).toBe('over')
    expect(c.kind === 'over' && c.by).toBe(10000)
  })

  it('ignores cents, because a stamp duty calculator leaves them behind', () => {
    // A warning nobody can clear is a warning everybody learns to ignore.
    const c = contributionCheck(650000, 24740.4, 520000, 130000, 24740)
    expect(c.kind).toBe('adds-up')
  })

  it('says unknown when half the figures are missing', () => {
    expect(check(null, null).kind).toBe('unknown')
    expect(contributionCheck(null, null, null, 1, 1).kind).toBe('unknown')
  })
})

describe('usable equity', () => {
  it('is eighty per cent of the value less what is owed', () => {
    expect(usableEquity(720000, 398220)).toBe(177780)
  })

  it('REFUSES to count an owner occupied property', () => {
    // You need the home on screen to have the conversation. Counting its equity
    // would inflate the figure and the email would be wrong. The function
    // refuses rather than trusting every caller to remember.
    expect(usableEquity(1240000, 612400, false)).toBeNull()
  })

  it('never returns a negative, because that reads as money you could use', () => {
    expect(usableEquity(500000, 480000)).toBe(0)
  })

  it('totals only the investment properties', () => {
    const rows = [
      { estimated_current_value: 720000,  current_balance: 398220, investor: true },
      { estimated_current_value: 560000,  current_balance: 351900, investor: true },
      { estimated_current_value: 1240000, current_balance: 612400, investor: false },
    ]
    expect(totalUsableEquity(rows)).toBe(177780 + 96100)
  })
})

describe('when something is due', () => {
  it('counts whole days either side of today', () => {
    expect(daysUntil('2026-10-19', MONDAY)).toBe(0)
    expect(daysUntil('2026-10-20', MONDAY)).toBe(1)
    expect(daysUntil('2026-10-16', MONDAY)).toBe(-3)
    expect(daysUntil(null, MONDAY)).toBeNull()
  })

  it('survives a timestamp as well as a date, and an offset it must ignore', () => {
    // Only the first ten characters are read. An offset on the end is the
    // database saying where the server is, which has nothing to do with what
    // day the review is due.
    expect(daysUntil('2026-10-19T00:00:00+11:00', MONDAY)).toBe(0)
    expect(daysUntil('2026-10-19T23:59:59Z', MONDAY)).toBe(0)
    expect(daysUntil('2026-10-19', MONDAY)).toBe(0)
  })

  it('refuses a date that is not one rather than inventing a day', () => {
    // new Date('2026-02-31') rolls silently into March.
    expect(daysUntil('2026-02-31', MONDAY)).toBeNull()
    expect(daysUntil('not a date', MONDAY)).toBeNull()
    expect(daysUntil('', MONDAY)).toBeNull()
  })

  it('separates overdue from due today, which are not the same job', () => {
    expect(dueState('2026-10-16', MONDAY)).toBe('overdue')
    expect(dueState('2026-10-19', MONDAY)).toBe('today')
    expect(dueState('2026-10-23', MONDAY)).toBe('this-week')
    expect(dueState('2027-03-01', MONDAY)).toBe('later')
    expect(dueState(null, MONDAY)).toBe('none')
  })

  it('says it the way a person would', () => {
    expect(whenDue('2026-10-19', MONDAY)).toBe('today')
    expect(whenDue('2026-10-20', MONDAY)).toBe('tomorrow')
    expect(whenDue('2026-10-18', MONDAY)).toBe('yesterday')
    expect(whenDue('2026-10-15', MONDAY)).toBe('4 days late')
    expect(whenDue('2026-10-26', MONDAY)).toBe('in 7 days')
    expect(whenDue('2027-03-01', MONDAY)).toContain('2027')
  })
})

describe('the Monday numbers', () => {
  const rows = [
    { status: 'numbers_done',    due_on: '2026-10-19' },                      // due today
    { status: 'template_sent',   due_on: '2026-10-16' },                      // overdue
    { status: 'template_sent',   due_on: '2026-11-30' },                      // waiting
    { status: 'closed', outcome: 'converted', due_on: '2026-10-16' },         // closed, not chased
    { status: 'not_reviewed',    due_on: null },
    { status: 'numbers_done',    due_on: '2026-10-16', opted_out: true },     // counted nowhere
  ]
  const c = countsFor(rows, MONDAY)

  it('leaves an opted-out client out of every count', () => {
    // They asked not to hear from us. A list that still counts them as "to
    // chase" is how that promise gets broken.
    expect(c.onTheList).toBe(5)
    expect(c.toChase).toBe(2)
  })

  it('counts a closed review as finished, not as a chase', () => {
    expect(c.toChase).toBe(2)
    expect(c.becameDeals).toBe(1)
  })

  it('counts who is waiting on a reply', () => {
    expect(c.awaitingReply).toBe(2)
  })

  it('counts reviewed as having got as far as the figures', () => {
    expect(c.reviewed).toBe(4)
  })
})

describe('the order the list is worked in', () => {
  const rows = [
    { last_name: 'Later',    status: 'numbers_done', due_on: '2027-03-01' },
    { last_name: 'OptedOut', status: 'numbers_done', due_on: '2026-10-01', opted_out: true },
    { last_name: 'Today',    status: 'numbers_done', due_on: '2026-10-19' },
    { last_name: 'NoDate',   status: 'not_reviewed', due_on: null },
    { last_name: 'Late',     status: 'template_sent', due_on: '2026-10-12' },
  ]
  const out = sortForTheList(rows, MONDAY).map(r => r.last_name)

  it('puts what is late first and what is unscheduled last', () => {
    // Nulls sorted to the top would make "not urgent" look identical to
    // "overdue", which is the whole point of the column.
    expect(out).toEqual(['Late', 'Today', 'Later', 'NoDate', 'OptedOut'])
  })

  it('does not change the array it was given', () => {
    expect(rows[0].last_name).toBe('Later')
  })
})

describe('the greeting', () => {
  it('joins a couple the way the email says it', () => {
    expect(greetingName('Daniel', 'Whitmore', 'Rachel')).toBe('Daniel and Rachel')
  })

  it('uses one name on their own', () => {
    expect(greetingName('Priya', 'Venkatesan')).toBe('Priya')
  })

  it('falls back to the surname rather than greeting nobody', () => {
    expect(greetingName('', 'Barakat')).toBe('Barakat')
  })
})

describe('who may be emailed', () => {
  const ready = {
    status: 'numbers_done', email: 'd@example.com.au',
    purchase_price: 650000, stamp_duty: 24740, loan_amount: 520000,
    equity_release: 130000, savings_contribution: 24740,
    equity_property_id: 'p1',
  }

  it('lets a finished review through', () => {
    expect(canSendTheEmail(ready, { email: 'd@example.com.au' }).ok).toBe(true)
  })

  it('REFUSES somebody who opted out', () => {
    const r = canSendTheEmail(ready, { email: 'd@example.com.au', portfolio_review_opt_out: true })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.why).toContain('not to receive')
  })

  it('refuses when there is no email address', () => {
    expect(canSendTheEmail({ ...ready, email: '' }, { email: '' }).ok).toBe(false)
  })

  it('refuses before the figures are done', () => {
    expect(canSendTheEmail({ ...ready, status: 'valuation_checked' }, { email: 'd@e.com' }).ok).toBe(false)
  })

  it('refuses when no property has been named for the equity', () => {
    // The email says "we would use equity in <address>". Without one it would
    // send a sentence with a hole in it.
    const r = canSendTheEmail({ ...ready, equity_property_id: null }, { email: 'd@e.com' })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.why).toContain('which property')
  })

  it('WARNS but does not refuse when the deposit does not tie out', () => {
    // Fabio may have a reason. A portal that refuses to let a broker send his
    // own email is a portal he stops using.
    expect(canSendTheEmail({ ...ready, savings_contribution: 20000 }, { email: 'd@e.com' }).ok).toBe(true)
  })
})

describe('it decides nothing and fetches nothing', () => {
  const src = readFileSync('lib/portfolio-review.ts', 'utf8')

  it('calls no model, no database and no clock of its own', () => {
    for (const banned of ['fetch(', 'supabase', 'anthropic', 'Date.now(', 'new Date()']) {
      expect(src, `this file must stay a function of its arguments (${banned})`)
        .not.toContain(banned)
    }
  })
})
