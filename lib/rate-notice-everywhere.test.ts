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
  'app/api/generate-lo-email/route.ts': 'rateNoticeLines',   // lending options
  'lib/formal-approval-email.ts':       'ctx.rateNotice',
  'lib/preapproval-email.ts':           'ctx.rateNotice',
  // 9 Oct 2026. Added by an audit, not by this guard - which is the point of
  // the widened pattern below. It quotes two rates and carried nothing.
  'lib/refinance-email-template.ts':    'ctx.rateNotice',
  // The form that builds it. Unlike the other four this email is assembled in
  // the BROWSER, so the notice is fetched here and handed to the builder -
  // which is exactly why this was the one template nobody wired.
  'app/(app)/templates/RefinanceTemplateForm.tsx': 'setRateNotice',
}

// GOES TO A CLIENT, QUOTES A RATE, AND CARRIES NO NOTICE ON PURPOSE.
//
// This list is deliberately short and deliberately awkward to be on. A file here
// is one somebody decided a client does NOT need the warning on, which is the
// decision this whole test exists to make somebody write down.
const CLIENT_FACING_BUT_EXEMPT: Record<string, string> = {
  // 12 Oct 2026, Fabio: "can you remove the rba message from all bc email just
  // keep rules for LO".
  //
  // The notice tells a client that the bank quoting them has not passed the
  // RBA's move on yet. It is about a NAMED lender - the per-bank effective
  // dates in lib/rate-notice.ts are the whole mechanism. A borrowing capacity
  // names no lender and quotes an indicative figure for capacity rather than an
  // offer, so there is no bank to be waiting on.
  //
  // If this email ever starts naming a lender's own rate, it belongs back in
  // WIRED and this line is wrong.
  'app/api/generate-email/route.ts': 'borrowing capacity - indicative rate, no lender named',
}

// Prints a rate, but never to a client - so there is nothing to disclaim.
// Each one needs a reason somebody can disagree with.
const NOT_CLIENT_FACING: Record<string, string> = {
  'lib/milestone-figures.ts':       'builds the figures; the emails that print them are wired',
  // 21 Oct 2026. The knowledge base entry for the offer accepted step names
  // the Interest rate box on screen. It is the team's own guide, inside the
  // portal; no client is ever sent it.
  'lib/knowledge-base.ts':          'the team\u2019s own guide inside the portal, never sent to anybody',
  // 21 Oct 2026. Both caught by this guard on their first run, which is what it
  // is for. the-loan-now builds the loan details the offer accepted EMAIL
  // prints, and that email carries the notice - ctx.rateNotice in
  // lib/offer-accepted-email.ts, loaded per lender in send-milestone-email.
  // purchase-handover builds a PDF for the credit team and the file; no client
  // is sent it, which is the whole reason it holds the submission notes.
  'lib/the-loan-now.ts':            'builds the loan details; the offer accepted email that prints them carries the notice',
  'lib/purchase-handover.ts':       'the purchase handover goes to the lender and onto the file, never to a client',
  // 21 Oct 2026. Same shape as the line above and caught by this guard on
  // the first run, which is what it is for. It builds the loan details the
  // offer accepted email prints, and that email carries the notice - see
  // ctx.rateNotice in lib/offer-accepted-email.ts, loaded per lender in
  // app/api/send-milestone-email/route.ts. It sends nothing itself.
  'lib/the-loan-now.ts':            'builds the loan details; the offer accepted email that prints them carries the notice',
  'lib/split-cards.ts':             'builds the cards; the emails that print them are wired',
  'lib/assessment-content.ts':      'the assessment is for the lender and the file, not the client',
  'lib/handover-view.ts':           'internal handover to the credit team',
  'lib/broker-notes.ts':            'goes into the lender portal, not to a client',
  'lib/deal-facts.ts':              'what the model is told about the deal',
  'lib/factfind-form-content.ts':   'the fact find sheet, filled in with the client in front of you',
  'lib/self-employed-facts.ts':     'income working, internal',
  'lib/income-calculations.ts':     'income working, internal',
  // 28 Oct 2026. Caught by this guard on its first run, which is what it is
  // for. The percentage here is the SHADING on variable income - the 80%
  // column beside the 100% one - not a lender's interest rate. It is a rule of
  // thumb the credit team applies, it cannot change after the figures were
  // prepared, and lib/rate-notice.ts has nothing to say about it. This file
  // writes a line into the file notes; no client is ever sent one.
  'lib/income-to-fact-find.ts':     'income working, internal - the 80% shading column, not an interest rate',
  // 13 Oct 2026. Builds the fact find for a NEW deal out of this one's lending
  // options - the rate it carries is going into a liability row on a form, not
  // into anything a client is sent.
  'lib/position-after-settlement.ts': 'builds a fact find, which is a form, not a client email',
  'app/(app)/deals/[id]/BCForm.tsx':        'the form somebody types into',
  'app/(app)/deals/[id]/LOForm.tsx':        'the form somebody types into',
  'app/(app)/deals/[id]/FactFindForm.tsx':  'the form somebody types into',
  // 9 Oct 2026. Surfaced by the widened pattern above, all three staff screens
  // inside the portal. A client never sees any of them, so there is nothing to
  // disclaim - but they are named here rather than left to a pattern that
  // happens not to match them.
  'components/CommissionLibrary.tsx': 'commission rates we are paid, an internal page',
  'components/LenderLibrary.tsx':     'the team\'s own lender reference, never sent',
  'components/RateNoticeSettings.tsx': 'the screen where the notice itself is written',

  // AND THE THIRTEEN THE TIGHTENED PATTERN FOUND, each checked rather than
  // waved through. None is an email to a client: they are screens inside the
  // portal, documents for the lender or the file, or builders whose only
  // consumers are emails already on the WIRED list above.
  'lib/build-card.ts':          'builds the construction rows; generate-email prints them and is wired',
  'lib/box-four.ts':            'compliance box, for the file',
  'lib/lending-by-split.ts':    'the split lines inside box four, same document, never emailed',
  'lib/box-options.ts':         'compliance box, for the file',
  'lib/deal-figures.ts':        'the figures behind the forms somebody types into',
  'lib/property-checklist.ts':  'the fact find checklist, filled in with the client in front of you',
  'lib/scenario-change.ts':     'what changed between two versions of a scenario, internal',
  'lib/tax-au.ts':              'the tax tables behind the statement analysis, never sent',
  'app/(app)/clients/[id]/page.tsx':        'the client page inside the portal, staff only',
  'app/(app)/deals/[id]/summary/page.tsx':  'the deal summary screen, staff only',
  'app/api/generate-broker-notes-pdf/route.tsx': 'notes for the lender portal, not the client',
  // THIS ONE IS AN EMAIL, AND IT WAS WORTH CHECKING PROPERLY. It quotes both
  // rates - but it goes to the BROKER and info@, telling them a client has
  // pressed proceed. The client never receives it; they are the subject of it.
  'app/api/ready-notify/route.ts': 'tells the broker a client is ready; sent to us, never to them',
  'components/DealStructure.tsx':   'the structure panel on the deal screen',
  'components/StatementsLoaded.tsx':'the statement analysis screen, staff only',
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

// WHAT "PRINTS A RATE" LOOKS LIKE IN THIS CODEBASE.
//
// This was three fixed phrases: p.a., "Indicative rate", and 'Interest rate'.
// On 9 Oct 2026 an audit found lib/refinance-email-template.ts quoting TWO live
// interest rates to clients - "Your rate now 5.89%" and "Your new rate 5.49%" -
// with no notice on it ever, for any lender, on any date.
//
// THE FILE WAS NOT MISSED. THE PATTERN WAS. That email writes a number followed
// by a percent sign under a label, and never types any of the three phrases, so
// a guard whose whole job was to make this impossible had never once looked at
// it. A list that only catches the wording somebody happened to use first is a
// list that grows a hole per template.
//
// So it now also catches the way a rate is actually WRITTEN: a label naming a
// rate, or a number formatted as one.
// It looks for a rate being FORMATTED FOR SOMEBODY TO READ, not the word
// "rate" in prose - a first attempt matched validation messages and a sentence
// about test deals, and a guard that cries wolf gets a file added to the
// exceptions list rather than read.
//
// Two shapes, both of which the refinance email has and neither of which it
// could avoid while still showing a client a number:
//   someRate.toFixed(...)   a rate variable turned into text
//   ${...rate...}%           a rate dropped into a template with a percent sign
//
// Both name a VARIABLE called a rate. A looser "the word rate near a percent
// sign" was tried first and matched thirty files - "accurate", "separate",
// "generate" - which is how a guard stops being read.
const PRINTS_A_RATE =
  /p\.a\.|Indicative rate|'Interest rate'|[A-Za-z]*[Rr]ate\.toFixed|\$\{[^}\n]*[Rr]ate[^}\n]*\}\s*%/

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
      .filter(f => !(f in WIRED) && !(f in NOT_CLIENT_FACING) && !(f in NOT_AN_INTEREST_RATE)
                && !(f in CLIENT_FACING_BUT_EXEMPT))
      .filter(f => !f.includes('rate-notice'))
      .filter(f => PRINTS_A_RATE.test(codeOf(f)))
    expect(files,
      'this file prints a rate. Wire it to lib/rate-notice.ts, or add it to ' +
      'NOT_CLIENT_FACING with a reason.').toEqual([])
  })

  // THE BORROWING CAPACITY REALLY DOES NOT NAME A LENDER.
  //
  // That is the whole reason it is excused, so it is checked rather than taken
  // on trust. The moment this email starts quoting a named bank's own rate, the
  // excuse stops being true and this fails.
  it('the email excused for naming no lender really names none', () => {
    const code = codeOf('app/api/generate-email/route.ts')
    expect(code).not.toContain('rateNoticeLines')
    expect(code, 'the borrowing capacity email is naming a lender now')
      .not.toMatch(/lenderName|recommendedLender/)
  })

  it('and it is the only client email excused', () => {
    expect(Object.keys(CLIENT_FACING_BUT_EXEMPT)).toEqual(['app/api/generate-email/route.ts'])
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
                     ...Object.keys(NOT_AN_INTEREST_RATE),
                     ...Object.keys(CLIENT_FACING_BUT_EXEMPT)]) {
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
