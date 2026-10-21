import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { buildRefinanceEmail, buildKeepRepaymentEmail } from './refinance-email-template'
import { CALCULATOR_DISCLAIMER } from './repayment-analysis'

// THE SAME CLIENT, THE OTHER ARGUMENT.
//
// 21 Oct 2026. Fabio chose one card with a switch over two cards: "a client
// getting two emails from us that both start you could be saving $X a month is
// the problem". So Refinance saving now makes either case, and the email it has
// always sent is not touched.

const input = {
  balance: 600000, currentRate: 6.14, newRate: 5.59,
  repaymentType: 'PI' as const, remainingYears: 25, cashback: 0,
}
const ctx = {
  clientFirstName: 'Ruth', brokerName: 'Fabio De Castro',
  calendlyUrl: 'https://example.test/book', proceedUrl: 'https://example.test/go',
}

describe('the email that was always there', () => {
  // NOT ONE WORD OF IT CHANGES. Fabio: "thats a different template dont touch
  // that."
  it('still leads with the monthly saving', () => {
    const e = buildRefinanceEmail(input, ctx as any)
    expect(e.subject).toContain('saving')
    expect(e.html).toContain("You'd save")
  })

  it('is what the form sends unless somebody moves the switch', () => {
    const form = readFileSync('app/(app)/templates/RefinanceTemplateForm.tsx', 'utf8')
    expect(form).toContain("useState<'saving' | 'keep'>('saving')")
  })
})

describe('the other argument', () => {
  const e = buildKeepRepaymentEmail(input, ctx as any)!

  it('leads with the interest and the years, not the monthly saving', () => {
    expect(e.subject).toContain('off your loan')
    expect(e.html).toContain('If you keep your repayment where it is')
    expect(e.html).toContain('Stay as you are')
    expect(e.html).toContain('Keep paying')
  })

  it('opens with their position, so they can check it against a statement', () => {
    expect(e.html).toContain('$600,000')
    expect(e.html).toContain('25 years to run')
    expect(e.html).toContain('6.14%')
  })

  it('carries the calculator disclaimer', () => {
    expect(e.html).toContain('Calculator Disclaimer')
    expect(e.plainText).toContain(CALCULATOR_DISCLAIMER)
  })

  // Nothing is paying the balance down, so there are no years to take off.
  it('refuses on interest only rather than printing three identical rows', () => {
    expect(buildKeepRepaymentEmail({ ...input, repaymentType: 'IO' }, ctx as any)).toBe(null)
  })

  it('refuses where the new rate is not lower', () => {
    expect(buildKeepRepaymentEmail({ ...input, newRate: 6.5 }, ctx as any)).toBe(null)
  })

  // A real repayment often carries a package fee or extra they already pay, and
  // everything in the email follows from it.
  it('uses their own repayment when somebody has the statement', () => {
    const typed = buildKeepRepaymentEmail(input, ctx as any, { currentRepayment: 4500 })!
    expect(typed.html).toContain('$4,500')
    expect(typed.html).not.toBe(e.html)
  })

  it('stands in with the minimum when nobody does', () => {
    expect(e.html).toContain('$3,917')
  })

  // Word paints a background only from bgcolor on a td or table, and drops
  // colour set on a <p>.
  it('is built the way Word renders', () => {
    expect(e.html).not.toContain('rgba(')
    expect(e.html).toContain('bgcolor=')
  })
})

describe('one engine behind both', () => {
  // The same block the tick box on a borrowing capacity draws, and the same
  // ledger that matches simplifyfinance.com.au/calculators/repayment. A client
  // who reads this email and then runs their own numbers gets one answer.
  it('draws the table from lib/repayment-analysis, not a second copy', () => {
    const src = readFileSync('lib/refinance-email-template.ts', 'utf8')
    expect(src).toContain("from './repayment-analysis'")
    expect(src).toContain('analysisBlockHtml(a,')
    expect(src).not.toContain('Stay as you are')
  })

  it('leaves the existing builder alone', () => {
    const src = readFileSync('lib/refinance-email-template.ts', 'utf8')
    const existing = src.slice(src.indexOf('export function buildRefinanceEmail'),
                               src.indexOf('export function buildKeepRepaymentEmail'))
    expect(existing).not.toContain('analysisBlockHtml')
    expect(existing).toContain('comparisonBlock(r, input')
  })
})

describe('the switch on the form', () => {
  const form = readFileSync('app/(app)/templates/RefinanceTemplateForm.tsx', 'utf8')

  it('is offered on principal and interest only', () => {
    expect(form).toContain("{repaymentType === 'PI' && (")
    expect(form).toContain('What this email says')
  })

  it('asks for their real repayment only where it is used', () => {
    expect(form).toContain("{angle === 'keep' && repaymentType === 'PI' && (")
    expect(form).toContain('Their repayment now (optional)')
  })

  // A refusal must not leave the screen blank.
  it('falls back to the email it has always sent if the other one cannot be built', () => {
    expect(form).toContain('if (alt) return alt')
  })
})
