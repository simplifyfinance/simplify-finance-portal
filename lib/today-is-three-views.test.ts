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
import { LINE, splitAtLine, startingOrder } from './the-days-plan'
import { whichToday, showsTheBusinessDashboard } from './which-today'

const page = readFileSync('components/TodayPlan.tsx', 'utf8')
const dash = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')
// 26 Oct 2026. The day itself moved into its own file when it grew a line, an
// order you can drag and a note on each row - see components/MyDay.tsx.
const day = readFileSync('components/MyDay.tsx', 'utf8')

describe('three views, and admin wins', () => {
  // 15 Nov 2026. These used to read the rule as a string out of TodayPlan.tsx,
  // because that is where it lived. It now lives in lib/which-today.ts, so the
  // dashboard page can ask the same question instead of inventing its own -
  // which is exactly how a broker ended up with the business dashboard bolted
  // under his Today. The rule is now exercised, not spelled.
  it('picks the view from who is looking', () => {
    expect(page).toContain('whichToday(meOfficerId, seesAll)')
    expect(whichToday('officer-1', false)).toBe('credit')
    expect(whichToday(null, true)).toBe('admin')
    expect(whichToday(null, false)).toBe('broker')
  })

  it('an admin who is also a broker gets the business, not their own list', () => {
    // Fabio, 23 Oct 2026: "a broker /admin, admin view supersedes". If admin
    // ever stopped beating broker he would get a broker's page again and the
    // business view would be unreachable for the five people it was built for.
    expect(whichToday(null, true)).toBe('admin')
  })

  it('and a credit assessor who is also an admin still gets their own day', () => {
    // She has a day to agree to and nobody else can do it for her.
    expect(whichToday('officer-1', true)).toBe('credit')
  })

  // ---------------------------------------------------------------------
  // WHAT A BROKER'S TODAY MUST NOT HAVE UNDER IT
  // ---------------------------------------------------------------------
  //
  // 15 Nov 2026. Keanen's Today carried the whole business dashboard beneath
  // it: a second greeting, Deals by broker across every broker in the firm,
  // Needs your action, five stage tiles and Recent deals - plus This week and
  // Due to lodge. None of it was in the screen approved on 12 Nov.
  //
  // It happened because the page asked "is this an admin" where it meant "is
  // this a credit assessor". Fabio had said it more than once before it was
  // found: "come on all this still showing in broker view I SAID multiple
  // types remove it."
  // 15 Nov 2026. The View as picker had its own seat ladder and it asked about
  // the broker key before the role, so Alan, Mark and Kylie - who have a broker
  // key AND are admins - were listed as brokers, and looking at one of them
  // drew a broker's screen they have never seen.
  describe('the picker seats people the same way Today does', () => {
    it('admin beats broker there too', () => {
      expect(dash).toContain("p.role === 'admin' ? 'admin'")
      const line = dash.split('\n').findIndex(l => l.includes("p.role === 'admin' ? 'admin'"))
      const brokerLine = dash.split('\n').findIndex(l => l.includes("p.broker_key ? 'broker'"))
      expect(line, 'admin must be asked before the broker key').toBeLessThan(brokerLine)
    })

    it('and looking at a broker/admin draws the screen they actually see', () => {
      expect(dash, 'this said "an admin, but only if not also a broker"')
        .not.toContain("!creditOfficerId && !brokerKey && profile?.role === 'admin'")
      expect(dash).toContain("!creditOfficerId && profile?.role === 'admin'")
    })
  })

  describe('and a broker gets his three boxes and nothing bolted underneath', () => {
    it('the business dashboard is for credit only', () => {
      expect(showsTheBusinessDashboard('credit')).toBe(true)
      expect(showsTheBusinessDashboard('broker')).toBe(false)
      expect(showsTheBusinessDashboard('admin')).toBe(false)
    })

    it('and the page asks that, not "is this an admin"', () => {
      expect(dash).toContain('showsTheBusinessDashboard(todayView)')
      expect(dash, 'the old guard let every non-admin through')
        .not.toContain('{!theirScreen && (\n      <DashboardClient')
    })

    it('This week and Due to lodge are credit\'s, not a broker\'s', () => {
      expect(dash).toContain("{todayView === 'credit' && <ThisWeek")
      expect(dash, 'this let brokers through').not.toContain('!creditOfficerId && !theirScreen')
    })
  })

  // IT READS CODE, NOT COMMENTS. 15 Nov 2026: this list passed for a heading
  // that had already been deleted, because the comment explaining the deletion
  // still contained the old words. Third time tonight a check read prose as if
  // it were instructions - see scripts/check-one-clock.sh and the sweep guard.
  const CODE = page.split('\n')
    .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')
                 && !l.trim().startsWith('{/*'))
    .join('\n')

  it('each view draws something of its own', () => {
    expect(day, 'the day list has lost its heading').toContain('Today, in this order')
    // THREE OF THESE WERE DEAD. 15 Nov 2026: 'Where the book is this morning',
    // 'With us and on nobody' and 'By broker' were taken off the Today page on
    // 12 Nov - Fabio, looking at his own: "all these data..." - and this test
    // went on passing because the COMMENT recording their removal still spells
    // them out. A test that asserts the presence of something deliberately
    // deleted is worse than no test: it reads as cover.
    for (const want of [
      'What credit is doing on your files today',  // broker
      'Chase these',                               // broker
      'The team today',                            // admin only, as of 15 Nov
    ]) {
      expect(CODE, `the page no longer says "${want}"`).toContain(want)
    }
  })

  // ---------------------------------------------------------------------
  // AND WHAT A BROKER NO LONGER CARRIES - 15 Nov 2026
  // ---------------------------------------------------------------------
  it('a broker has no day list, because nobody assigns him a day', () => {
    expect(CODE, 'the day list is back on the broker screen')
      .not.toContain("{view === 'broker' && dayCard}")
  })

  it('and the credit roster is admin\'s, not his', () => {
    // It used to read `view === 'credit' ? tellBox : teamBox`, so everybody
    // who was not credit got the roster - brokers included.
    expect(CODE).toContain("view === 'credit' ? tellBox : view === 'admin' ? teamBox : null")
  })

  it('and the chase list carries ages, oldest first', () => {
    expect(CODE).toContain('oldestFirst(elsewhere')
    expect(CODE).toContain('waitedWords(daysWaiting(deal, now))')
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
  // 12 Nov 2026: seesAll={!!seesAll} became seesAll={theirScreen}.
  //
  // auth_sees_all_deals() answers for whoever is SIGNED IN. Once Fabio could
  // look at somebody else's Today, that flag was his, not theirs - so opening
  // Katie's day would have drawn HIS run-through with her name on it, which is
  // the one thing that feature exists to avoid. theirScreen is worked out from
  // the seat of the person being drawn. See lib/view-as.ts.
  it('the dashboard passes the flag, the key and the brokers’ plans', () => {
    for (const want of ['seesAll={theirScreen}', 'brokerKey={brokerKey}',
                        'brokerNames={brokerNames}', 'brokerPlans={brokerPlans}']) {
      expect(dash, `the dashboard stopped passing ${want}`).toContain(want)
    }
  })

  // AND THE SCREEN IS CHOSEN THE SAME WAY EVERYWHERE ON THE PAGE. A page that
  // picked the run-through from one flag and the panels from another would
  // draw half of each.
  it('and chooses every panel from the same flag', () => {
    // Which PANEL is drawn comes from the seat being looked at...
    expect(dash).toContain('{theirScreen ? (')
    expect(dash).not.toContain('!creditOfficerId && !seesAll')
    expect(dash).not.toContain('{!seesAll && (')
    // ...while what the SIGNED-IN person is allowed to change still comes from
    // their own permission, and is off entirely while they are looking at
    // somebody else's day.
    expect(dash).toContain('canSet={!!seesAll && !viewingId}')
  })

  it('and reads the brokers’ half of the plans table', () => {
    // The exact column list is checked once, further down, where the day's
    // notes are. Two tests naming the same string is how the first run of
    // this ship failed: the query grew a column and this line still wanted
    // the old one.
    // 14 Nov 2026: plan_date went in between them, because an order is written
    // to a row keyed by officer AND date and the write needs the date it is
    // amending. See lib/the-order-from-above.ts.
    expect(dash).toContain('broker_key, plan_date, deal_ids')
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
    expect(page).toContain('startingOrder(')
    expect(page).toContain('mine.map(d => d.id)')
    expect(page).toContain('splitAtLine(dayOrder).today')
  })

  // 12 Nov 2026. Fabio, on an assessor holding fourteen files: "14 is too
  // many... they will pick the ones that they're doing today." Opening with
  // all fourteen above the line is a day nobody believes, and a day nobody
  // believes is one nobody edits before pressing the button.
  it('a credit assessor opens with nothing above the line', () => {
    expect(page).toContain("view === 'credit')")
    expect(startingOrder(['a', 'b'], null, true)).toEqual([LINE, 'a', 'b'])
    expect(splitAtLine(startingOrder(['a', 'b'], null, true)))
      .toEqual({ today: [], queue: ['a', 'b'] })
  })

  // AND A BROKER'S DAY IS UNCHANGED. Only the credit view asked for this.
  it('leaves every other view exactly as it was', () => {
    expect(startingOrder(['a', 'b'])).toEqual(['a', 'b', LINE])
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
    for (const col of ['officer_id', 'broker_key', 'deal_ids', 'confirmed_at', 'notes', 'on_it_now']) {
      expect(dash, `the plan row is read without ${col}`).toContain(col)
    }
  })

  // THE MORNING IS THREE PRESSES - 12 Nov 2026. A row read without these comes
  // back looking like somebody who has confirmed nothing, every morning, for
  // ever. See lib/the-morning-three.ts.
  it('and what she confirmed, and whether management has been told', () => {
    for (const col of ['yesterday_ok_at', 'informed_at', 'yesterday_added', 'yesterday_removed']) {
      expect(dash, `the plan row is read without ${col}`).toContain(col)
    }
  })

  it('and the columns exist to put them in', () => {
    const sql = readFileSync('docs/a-day-is-a-day.sql', 'utf8')
    expect(sql).toContain('add column if not exists notes')
    expect(sql).toContain('add column if not exists on_it_now')
    // The afternoon of 23 Oct 2026, in one line.
    expect(sql, 'a foreign key is back on a hot table').not.toContain('references public.deals')
  })
})
