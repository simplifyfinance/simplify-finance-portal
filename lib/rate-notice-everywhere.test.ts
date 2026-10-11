import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'

// EVERY CLIENT EMAIL THAT QUOTES A RATE CARRIES THE NOTICE, OR SAYS WHY NOT.
//
// Fabio, 30 Sep 2026: "I want to put a disclaimer in ALL temppaltes that go
// out". The failure that wording is guarding against is the obvious one - it
// goes on three of them and somebody forgets the fourth, and a client is quoted
// a rate with no warning while their neighbour got one.
//
// This codebase has made that exact mistake before with a lender name: four
// separate ships to chase one consumer at a time, because nothing listed who
// the consumers were. So this test IS the list, and a new file that prints a
// rate to a client fails the build until somebody puts it on one side or the
// other.

// The client-facing surfaces, and where each one gets the notice.
const WIRED: Record<string, string> = {
  'app/api/generate-email/route.ts':    'rateNoticeLines',   // borrowing capacity
  'app/api/generate-lo-email/route.ts': 'rateNoticeLines',   // lending options
  'lib/formal-approval-email.ts':       'ctx.rateNotice',
  'lib/preapproval-email.ts':           'ctx.rateNotice',
}

// Prints a rate, but never to a client - so there is nothing to disclaim.
// Each one needs a reason somebody can disagree with.
const NOT_CLIENT_FACING: Record<string, string> = {
  'lib/milestone-figures.ts':       'builds the figures; the emails that print them are wired',
  'lib/split-cards.ts':             'builds the cards; the emails that print them are wired',
  'lib/assessment-content.ts':      'the assessment is for the lender and the file, not the client',
  'lib/handover-view.ts':           'internal handover to the credit team',
  'lib/broker-notes.ts':            'goes into the lender portal, not to a client',
  'lib/deal-facts.ts':              'what the model is told about the deal',
  'lib/factfind-form-content.ts':   'the fact find sheet, filled in with the client in front of you',
  'lib/self-employed-facts.ts':     'income working, internal',
  'lib/income-calculations.ts':     'income working, internal',
  'app/(app)/deals/[id]/BCForm.tsx':        'the form somebody types into',
  'app/(app)/deals/[id]/LOForm.tsx':        'the form somebody types into',
  'app/(app)/deals/[id]/FactFindForm.tsx':  'the form somebody types into',
}

// CLIENT FACING, BUT THE PERCENTAGE IS NOT AN INTEREST RATE.
//
// 9 Oct 2026. The buyers agency email tripped this guard on "12.3% p.a." - a
// capital growth rate across a client portfolio - and it also quotes a 4.8%
// rental yield. Neither is a lender's interest rate, so lib/rate-notice.ts has
// nothing to say about them: that notice exists to tell a client a bank has
// changed a rate since the figures were prepared, which cannot happen to a
// growth rate that already happened.
//
// THIS LIST IS NOT A WAY OUT OF THE OTHER TWO. A file goes here only when the
// percentage is historical or a yield AND the email carries its own caveat
// about it. The buyers agency email does - see DISCLAIMER in
// lib/simplify-ba-email.ts, which names past performance, the single example
// and the yield - and the test below checks that rather than taking my word.
const NOT_AN_INTEREST_RATE: Record<string, string> = {
  'lib/simplify-ba-email.ts': 'past capital growth and a rental yield, with its own performance caveat',
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

// Comments are not code - the email HTML gate learned that on 29 September when
// it failed a ship over an rgba() inside a comment explaining rgba().
const codeOf = (f: string) => readFileSync(f, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, ' '))

describe('the notice reaches every client email that quotes a rate', () => {
  it('each one named as wired really does read it', () => {
    for (const [file, needle] of Object.entries(WIRED)) {
      expect(codeOf(file), `${file} no longer reads the rate notice`).toContain(needle)
    }
  })

  // THE GUARD. Anything new that prints a rate has to be classified.
  it('and nothing new prints a rate to anybody without being on a list', () => {
    const files = [...walk('lib'), ...walk('app'), ...walk('components')]
      .filter(f => !(f in WIRED) && !(f in NOT_CLIENT_FACING) && !(f in NOT_AN_INTEREST_RATE))
      .filter(f => !f.includes('rate-notice'))
      .filter(f => /p\.a\.|Indicative rate|'Interest rate'/.test(codeOf(f)))
    expect(files,
      'this file prints a rate. Wire it to lib/rate-notice.ts, or add it to ' +
      'NOT_CLIENT_FACING with a reason.').toEqual([])
  })

  // AND THE EXCUSE HAS TO BE TRUE. A file claiming its percentage is historical
  // must actually caveat it, or this list is just somewhere to hide.
  it('anything excused as not-an-interest-rate carries its own caveat', () => {
    for (const f of Object.keys(NOT_AN_INTEREST_RATE)) {
      const code = readFileSync(f, 'utf8')
      expect(/past performance/i.test(code),
        `${f} is excused as historical but says nothing about past performance`).toBe(true)
    }
  })

  it('the lists are about real files, so neither is quietly stale', () => {
    for (const f of [...Object.keys(WIRED), ...Object.keys(NOT_CLIENT_FACING),
                     ...Object.keys(NOT_AN_INTEREST_RATE)]) {
      expect(() => readFileSync(f, 'utf8'), `${f} is on a list but no longer exists`).not.toThrow()
    }
  })
})

describe('the screens that run it', () => {
  // UNDER THE LENDER LIBRARY, not Settings - most of the team cannot see
  // Settings, and recording a bank's date is a team job. 30 Sep 2026.
  it('there is somewhere to write it, where the team can reach it', () => {
    const lenders = readFileSync('app/(app)/lenders/LendersClient.tsx', 'utf8')
    expect(lenders).toContain('RateNoticeSettings')
    expect(lenders).toContain("pane === 'rate-notice'")
  })

  it('there is somewhere to record when each bank\u2019s change starts', () => {
    const lib = readFileSync('components/LenderLibrary.tsx', 'utf8')
    expect(lib).toContain('rate_notice_from')
    expect(lib).toContain('announcedFrom(')
  })

  // WITHOUT THIS IT CAN BE FORGOTTEN, which is the failure that matters more
  // than any of the others.
  // TWO MONTHS FROM NOW. One field, and every date the banks gave for the last
  // decision stops applying by itself.
  it('and a way to start the next decision', () => {
    const settings = readFileSync('components/RateNoticeSettings.tsx', 'utf8')
    expect(settings).toContain('forNextDecision(')
    expect(settings).toContain('nextDecisionWarning(')
  })

  it('and something that will not let it be forgotten', () => {
    const dash = readFileSync('app/(app)/dashboard/DashboardClient.tsx', 'utf8')
    expect(dash).toContain('<RateNoticeNag />')
    expect(readFileSync('components/RateNoticeNag.tsx', 'utf8')).toContain('nagLine(')
  })

  it('and the deal records whether the email carried it', () => {
    expect(readFileSync('lib/milestone-emails.ts', 'utf8')).toContain('rateNotice')
    expect(readFileSync('app/api/send-milestone-email/route.ts', 'utf8'))
      .toContain('rateNotice: !!built.rateNotice')
  })
})
