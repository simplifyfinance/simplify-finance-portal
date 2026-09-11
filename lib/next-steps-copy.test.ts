import { describe, it, expect } from 'vitest'
import { nextStepsSubject, buildNextStepsContent } from './next-steps-copy'

// THE CLIENT'S "WHAT HAPPENS NEXT" EMAIL.
//
// 11 Sep 2026. Two things were wrong. The subject read
// "Kylie_Searle_Purchase_2026 — what happens next": our internal file reference,
// in front of the client, as the first thing they read. Fabio: "that's so audit".
// And the whole bank statements step vanished whenever the WealthDesk link in
// Settings was blank. These tests are the fence around both.

describe('the subject line the client actually sees', () => {
  const every = [nextStepsSubject('BC'), nextStepsSubject('LO')]

  it('never carries the deal file name, in any shape', () => {
    // deal_name looks like Kylie_Searle_Purchase_2026. Underscores are the tell,
    // and no client-facing sentence wants one.
    for (const s of every) expect(s, s).not.toMatch(/_/)
  })

  it('is never built from a template that could interpolate a deal', () => {
    for (const s of every) {
      expect(s, s).not.toMatch(/undefined|null|\$\{/)
      expect(s.trim(), s).toBe(s)
      expect(s.length, s).toBeGreaterThan(10)
    }
  })

  it('reads differently at each stage, so the second is not the first resent', () => {
    // The same email fires twice, weeks apart, with completely different steps in
    // the body. One subject for both made the second look like a resend.
    expect(nextStepsSubject('BC')).not.toBe(nextStepsSubject('LO'))
  })

  it('names the job, which is the thing that gets it opened', () => {
    expect(nextStepsSubject('BC')).toBe('Next steps — your client portal and bank statements')
    expect(nextStepsSubject('LO')).toBe('Next steps — documents to sign and submission')
  })

  it('does not change with the WealthDesk link, because the step never goes away', () => {
    // The subject takes one argument now. Anything passed as a second is ignored,
    // which is the point: there is no blank-link wording to fall back to.
    expect((nextStepsSubject as any)('BC', '')).toBe(nextStepsSubject('BC'))
    expect((nextStepsSubject as any)('BC', 'https://x')).toBe(nextStepsSubject('BC'))
  })
})

describe('the bank statements step', () => {
  it('is in the email whether or not the link is set', () => {
    // It used to disappear with the link, turning a three-step email into a
    // two-step one that looked completely normal. A broken link gets reported by
    // the client. A missing step gets reported by nobody.
    for (const link of ['https://simplify.wealthdesk.com.au/iv/tk/abc', '', undefined]) {
      const { steps } = buildNextStepsContent('BC', link)
      expect(steps.length, String(link)).toBe(3)
      expect(steps.some(s => /bank statements/i.test(s.title)), String(link)).toBe(true)
      expect(steps.filter(s => s.button).length, String(link)).toBe(1)
    }
  })

  it('promises in the subject exactly what the email asks for', () => {
    const { steps } = buildNextStepsContent('BC', '')
    expect(nextStepsSubject('BC')).toMatch(/bank statements/)
    expect(steps.some(s => /bank statements/i.test(s.title))).toBe(true)
  })

  it('is not on the second email, which has nothing to do with statements', () => {
    const { steps } = buildNextStepsContent('LO')
    expect(steps.some(s => s.button)).toBe(false)
    expect(nextStepsSubject('LO')).not.toMatch(/bank statements/)
  })
})
