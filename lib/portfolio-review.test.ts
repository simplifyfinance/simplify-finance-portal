import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  STAGES, OUTCOMES, REASONS, stageLabel, outcomeLabel, reasonLabel, reasonTally, stageIndex,
  usableEquity, matchesTile, onTile,
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
    //
    // 26 Oct 2026: four, not five. "On the list" is the work left now - the
    // closed row has moved over, and the opted-out one was never counted.
    // Fabio: "the filters once I close move them over".
    expect(c.onTheList).toBe(4)
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
    // 26 Oct 2026: three, not four. A closed review is not work in progress,
    // whatever stage it reached before it closed, so it is off this tile too.
    expect(c.reviewed).toBe(3)
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

// ---------------------------------------------------------------------------
// WHY IT WAS NOT SUITABLE, AND WHAT BRINGS IT BACK
// ---------------------------------------------------------------------------
//
// 26 Oct 2026. Fabio, going through the book: "I want to find the best way to
// add notes that why not suitable so we can track things better also creating
// a task to follow up later as sometimes it is not a deal now but can be
// later."

describe('the reasons match the ones the database will accept', () => {
  const sql = readFileSync('docs/why-it-was-not-suitable.sql', 'utf8')

  it('every reason here is allowed there', () => {
    for (const r of REASONS) {
      expect(sql, `the database will refuse reason '${r.key}'`).toContain(`'${r.key}'`)
    }
  })

  it('and every one of them has words a person reads', () => {
    for (const r of REASONS) {
      expect(reasonLabel(r.key), `${r.key} has no label`).toBe(r.label)
      expect(r.label.length).toBeGreaterThan(3)
    }
    // An unknown key says nothing rather than guessing.
    expect(reasonLabel('nonsense')).toBe('')
    expect(reasonLabel(null)).toBe('')
  })
})

describe('counting the reasons, which is the point of asking', () => {
  const rows = [
    { outcome_reason: 'serviceability' },
    { outcome_reason: 'serviceability' },
    { outcome_reason: 'equity' },
    { outcome_reason: null },          // closed before this existed
    { outcome_reason: 'nonsense' },    // not one of ours
    { outcome_reason: 'serviceability' },
  ]

  it('biggest first, and only the ones it has an answer for', () => {
    expect(reasonTally(rows)).toEqual([
      { key: 'serviceability', label: 'Serviceability', n: 3 },
      { key: 'equity', label: 'Not enough equity', n: 1 },
    ])
  })

  it('never invents an answer for a review nobody gave one for', () => {
    // Three of the six rows above have no usable reason. Reading them as
    // "something else" would put a made-up number at the top of a report.
    const total = reasonTally(rows).reduce((n, r) => n + r.n, 0)
    expect(total).toBe(4)
  })

  it('and says nothing at all where nothing has been recorded', () => {
    expect(reasonTally([])).toEqual([])
    expect(reasonTally([{ outcome: 'declined' }])).toEqual([])
  })
})

describe('the ones that came back round', () => {
  // THE HOLE THIS FILLS. next_review_date has been saved on every close since
  // the day the book shipped, and the trigger fills in twelve months where
  // nobody chose a date. Nothing ever counted them: "to chase today" skips
  // anything closed, so the day arrived and no number on the screen moved.
  const rows = [
    { status: 'closed', outcome: 'not_suitable', due_on: '2026-10-16' },  // came back round
    { status: 'closed', outcome: 'declined',     due_on: '2026-10-19' },  // today
    { status: 'closed', outcome: 'converted',    due_on: '2027-10-19' },  // next year
    { status: 'template_sent', due_on: '2026-10-16' },                    // a chase, not this
    { status: 'closed', outcome: 'declined', due_on: '2026-10-16', opted_out: true },
  ]
  const c = countsFor(rows, MONDAY)

  it('counts a closed review whose day has come', () => {
    expect(c.comingBack).toBe(2)
  })

  it('and does not mix it in with today\u2019s chasing', () => {
    // Ringing somebody back a year later is a different job to finishing a
    // conversation from last week, so they are two numbers.
    expect(c.toChase).toBe(1)
  })

  it('an opted-out client never comes back round either', () => {
    expect(c.comingBack).toBe(2)
    // One, not four. Four of these five are closed and have moved off the
    // list; the fifth is the only one still being worked. Written earlier the
    // same day, when "on the list" still counted every row.
    expect(c.onTheList).toBe(1)
  })
})

describe('closing one out asks why', () => {
  const box = readFileSync('components/ReviewActions.tsx', 'utf8')

  it('offers the reasons rather than a free-for-all', () => {
    expect(box).toContain("import { OUTCOMES, REASONS")
    expect(box, 'the reason chips have gone').toContain('{REASONS.map(r => (')
  })

  it('and a note in their own words beside it', () => {
    expect(box).toContain('setClose({ ...close, note: e.target.value })')
  })

  it('saves both, and when it was closed', () => {
    for (const field of ['outcome_reason:', 'outcome_note:', 'closed_at:']) {
      expect(box, `${field} is no longer written`).toContain(field)
    }
    // Null rather than '' - "nobody said" and "they said something else" are
    // different things, and a check constraint refuses an empty string.
    expect(box).toContain('outcome_reason: close.reason || null')
  })

  it('and still gives every outcome a day to come back on', () => {
    expect(box).toContain('next_review_date: close.next_review_date || null')
  })
})

// ---------------------------------------------------------------------------
// A SECURITY THE BOOK NEVER HAD
// ---------------------------------------------------------------------------
//
// 26 Oct 2026. Fabio, working a review: "I cannot add a security and loan that
// is not being pulled so need the ability of doing that". Every property
// arrived from the spreadsheet and there was no other door - so a client who
// has bought since the export had a usable equity figure that was wrong by
// whatever was missing, and nothing on the screen said so.
//
// Asked whether rows should be removable too, he was exact: "I need to add not
// remove".

describe('adding and correcting a security', () => {
  const list = readFileSync('components/PortfolioReview.tsx', 'utf8')

  it('there is a way in', () => {
    expect(list).toContain('+ Add a security')
    expect(list).toContain("from('portfolio_review_properties').insert(")
  })

  it('and it is tied to this review, with an address', () => {
    expect(list).toContain('review_id: r.review_id')
    expect(list, 'a security with no address would be a blank row forever')
      .toContain("if (!address) { setOops('A security needs an address.'); return }")
  })

  it('nothing on this screen deletes a property', () => {
    // His words. A sold property is a different conversation and it has not
    // been had yet.
    expect(list, 'something deletes a property now')
      .not.toContain("from('portfolio_review_properties').delete()")
  })

  it('the loan and the value are typed into where they are read', () => {
    // 26 Oct 2026: the value belongs to the PROPERTY, so it is saved once for
    // the security and written to every loan row on it. The balance is still
    // per loan, because that is what a balance is.
    expect(list).toContain("saveFigure(sec.rows[0] as Prop, 'loan', e.target.value)")
    expect(list).toContain('saveSecurityValue(sec, e.target.value)')
  })

  it('and every change rewrites the stored equity', () => {
    // THE ONE THAT MATTERS. usable_equity is kept on the row and the LIST adds
    // up the stored column rather than working it out - so a loan changed
    // without rewriting it leaves the table saying one thing and the headline
    // figure above it another.
    expect(list).toContain('usable_equity: equityFor(value, loan, p.investor !== false)')
    expect(list).toContain('usable_equity: equityFor(value, loan, form.investor)')
  })

  it('a figure typed by hand says so and says when', () => {
    expect(list).toContain("patch.valuation_source = 'Entered by hand'")
    expect(list).toContain('patch.balance_as_at = n === null ? null : ymd')
  })

  it('and a write that saved nothing is treated as a failure', () => {
    // RLS refuses by returning no rows and no error.
    expect(list).toContain('if (error || !data?.length)')
  })
})

describe('the equity behind all of it', () => {
  it('eighty per cent of the value, less what is owed', () => {
    expect(usableEquity(1000000, 400000)).toBe(400000)
  })

  it('never a negative, because that is not money you can use', () => {
    expect(usableEquity(500000, 480000)).toBe(0)
  })

  it('and nothing at all for a home', () => {
    expect(usableEquity(1000000, 100000, false)).toBeNull()
  })

  it('says nothing rather than guessing where a figure is missing', () => {
    expect(usableEquity(null, 400000)).toBeNull()
    expect(usableEquity(1000000, null)).toBeNull()
  })

  it('reads a figure typed with commas and a dollar sign', () => {
    // It reaches these functions from a form field as well as from the
    // database, and a function that only survives one of those is a bug
    // waiting for a Tuesday.
    expect(usableEquity('$1,000,000', '400,000')).toBe(400000)
  })
})

// ---------------------------------------------------------------------------
// THE TILES ARE FILTERS, AND THE LIST SHRINKS AS YOU WORK IT
// ---------------------------------------------------------------------------
//
// 26 Oct 2026. Fabio, after closing one: "when I press the box at the top, I
// can't tell which ones are reviewed. So what the fuck is the point?" And:
// "the filters once I close move them over".

describe('what each tile shows', () => {
  const rows = [
    { status: 'not_reviewed',   due_on: null },
    { status: 'numbers_done',   due_on: '2026-10-19' },                       // reviewed, due today
    { status: 'template_sent',  due_on: '2026-10-16' },                       // awaiting, overdue
    { status: 'closed', outcome: 'not_suitable', due_on: '2026-10-16' },      // came back round
    { status: 'closed', outcome: 'converted',    due_on: '2027-10-19' },      // became a deal
    { status: 'not_reviewed',   due_on: null, opted_out: true },
  ]
  const c = countsFor(rows, MONDAY)

  it('"on the list" is the work left, not every row ever imported', () => {
    // Three open rows. The two closed ones have moved over, and the opted-out
    // client is counted nowhere.
    expect(c.onTheList).toBe(3)
  })

  it('and a closed review is off it the moment it is closed', () => {
    const before = countsFor([{ status: 'numbers_done', due_on: null }], MONDAY)
    const after = countsFor([{ status: 'closed', outcome: 'declined', due_on: null }], MONDAY)
    expect(before.onTheList).toBe(1)
    expect(after.onTheList).toBe(0)
  })

  it('every tile shows exactly what it counted', () => {
    // THE WHOLE POINT. The number and the list behind it read the same rule,
    // so a tile can never say 3 and show 4.
    for (const tile of ['all', 'reviewed', 'awaiting', 'chase', 'coming', 'deals'] as const) {
      const shown = rows.filter(r => !r.opted_out && matchesTile(r, tile, MONDAY)).length
      const counted = {
        all: c.onTheList, reviewed: c.reviewed, awaiting: c.awaitingReply,
        chase: c.toChase, coming: c.comingBack, deals: c.becameDeals,
      }[tile]
      expect(shown, `the ${tile} tile counts ${counted} and shows ${shown}`).toBe(counted)
    }
  })

  it('an opted-out client is counted nowhere but still appears on the list', () => {
    const them = { status: 'not_reviewed', due_on: null, opted_out: true }
    expect(onTile(them, 'all', MONDAY), 'they are being counted again').toBe(false)
    expect(matchesTile(them, 'all', MONDAY), 'they have vanished off the list').toBe(true)
  })
})
