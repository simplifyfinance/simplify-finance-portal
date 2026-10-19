import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { canSendTheEmail, stageIndex, STAGES, OUTCOMES } from './portfolio-review'

// THE LOOP: SEND IT, RING THEM, CLOSE IT OUT.
//
// Fabio, 19 Oct 2026, looking at 656 imported rows: "there is not section to
// update next steps???" There was not. Six stages, four outcomes, a chase date
// and a count of calls, and nothing on screen could set any of them - so "to
// chase today" and "awaiting a reply" would have read 0 forever.

const actions = readFileSync('components/ReviewActions.tsx', 'utf8')
const figures = readFileSync('components/ReviewFigures.tsx', 'utf8')

const codeOf = (src: string) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => m.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, ' '))

describe('the id the panels write against', () => {
  // 19 Oct 2026, within the hour: "invalid input syntax for type uuid:
  // undefined" under every panel and nothing saved. The row comes off
  // portfolio_review_list, which renames the review's own id to review_id so
  // it can carry client_id beside it.
  it('reads review_id as well as id, in both panels', () => {
    for (const [name, src] of [['ReviewActions', actions], ['ReviewFigures', figures]] as const) {
      expect(codeOf(src), `${name} does not accept review_id`)
        .toContain('review?.review_id || review?.id')
    }
  })

  // Sending the string "undefined" to a uuid column shows a client a database
  // error. Saying so beats asking.
  it('refuses to write at all without one', () => {
    for (const [name, src] of [['ReviewActions', actions], ['ReviewFigures', figures]] as const) {
      expect(codeOf(src), `${name} would still write with no id`).toContain('if (!reviewId)')
    }
  })
})

describe('what the buttons are allowed to do', () => {
  // Only ever forward. A later call on a closed review does not reopen it, and
  // a call made before the email went out does not pretend they replied to it.
  it('moves a stage forward and never back', () => {
    const code = codeOf(actions)
    expect(code).toContain("stageIndex(review.status) < stageIndex('template_sent')")
    expect(code).toContain("stageIndex(review.status) >= stageIndex('template_sent')")
    expect(code).toContain("stageIndex(review.status) < stageIndex('client_responded')")
  })

  // The write has to land before the browser is handed a mailto:, which aborts
  // requests in flight. The lending options email was marked sent while
  // nothing saved for exactly this reason.
  it('saves before it opens the mail client', () => {
    const code = codeOf(actions)
    const saved = code.indexOf("email_sent_at")
    const mailto = code.indexOf('window.location.href')
    expect(saved).toBeGreaterThan(-1)
    expect(mailto).toBeGreaterThan(saved)
  })

  // A refused write returns no rows and no error. Every one of the three is
  // checked, because "it saved" over nothing is the failure this portal keeps
  // paying for.
  it('checks every write it makes', () => {
    const code = codeOf(actions)
    const updates = code.split('.update(').length - 1
    const inserts = code.split('.insert(').length - 1
    expect(updates + inserts).toBeGreaterThanOrEqual(4)
    expect(code.split('|| !data?.length').length - 1).toBeGreaterThanOrEqual(3)
  })

  // An email that goes out with nothing to chase is a client nobody follows up.
  it('sets a chase when the email goes', () => {
    expect(codeOf(actions)).toContain('Opportunity email sent')
    expect(codeOf(actions)).toContain('next_action_on: inDays(7)')
  })

  it('offers every outcome the schema knows about', () => {
    expect(OUTCOMES.map(o => o.key).sort())
      .toEqual(['converted', 'declined', 'no_response', 'not_suitable'])
    expect(codeOf(actions)).toContain('OUTCOMES.map')
  })

  // "Not now" is almost never "not ever", and a client who drops off this list
  // is a client nobody rings again.
  it('always sets a next review date when it closes one', () => {
    expect(codeOf(actions)).toContain('next_review_date: close.next_review_date')
  })
})

describe('what stops the email going out', () => {
  const ready = {
    status: 'numbers_done', purchase_price: 520000, stamp_duty: 28000,
    loan_amount: 385000, equity_release: 130000, savings_contribution: 33000,
    equity_property_id: 'p1',
  }

  it('lets it go when everything is there', () => {
    expect(canSendTheEmail(ready, { email: 'ruth@example.com' })).toEqual({ ok: true })
  })

  // 19 Oct 2026: the CRM export has 29 columns and not one of them is an email
  // address, so all 656 landed with nothing to send to. The panel takes one
  // typed in by hand; this is the rule that makes it necessary.
  it('refuses with nothing to send to, and says so', () => {
    const no = canSendTheEmail(ready, { email: '' })
    expect(no.ok).toBe(false)
    expect((no as any).why).toContain('no email address')
  })

  it('refuses before the numbers are done', () => {
    const no = canSendTheEmail({ ...ready, status: 'not_reviewed' }, { email: 'a@b.com' })
    expect(no.ok).toBe(false)
  })

  it('refuses until somebody says which property the equity comes from', () => {
    const no = canSendTheEmail({ ...ready, equity_property_id: null }, { email: 'a@b.com' })
    expect(no.ok).toBe(false)
    expect((no as any).why).toContain('which property')
  })

  it('refuses for somebody who asked not to be contacted', () => {
    const no = canSendTheEmail({ ...ready, opted_out: true }, { email: 'a@b.com' })
    expect(no.ok).toBe(false)
  })

  // SHORT OR OVER WARNS, IT DOES NOT BLOCK. Fabio may have a reason the
  // deposit does not tie to the dollar, and a portal that refuses to let a
  // broker send his own email is a portal he stops using.
  it('still lets it go when the deposit does not tie out', () => {
    const over = { ...ready, savings_contribution: 80000 }
    expect(canSendTheEmail(over, { email: 'a@b.com' })).toEqual({ ok: true })
  })
})

describe('the stages the list counts on', () => {
  it('are in the order the work happens', () => {
    expect(STAGES.map(s => s.key)).toEqual([
      'not_reviewed', 'valuation_checked', 'numbers_done',
      'template_sent', 'client_responded', 'closed',
    ])
    expect(stageIndex('template_sent')).toBeGreaterThan(stageIndex('numbers_done'))
  })
})
