import { describe, it, expect } from 'vitest'
import { nextStepsSubject, buildNextStepsContent } from './next-steps-copy'

// THE SUBJECT LINE ON THE CLIENT'S "WHAT HAPPENS NEXT" EMAIL.
//
// 11 Sep 2026. It used to read "Kylie_Searle_Purchase_2026 — what happens next":
// our internal file reference, in front of the client, as the first thing they
// read. Fabio: "that's so audit". These tests are the fence around that not
// coming back.

describe('the subject line the client actually sees', () => {
  const every = [
    nextStepsSubject('BC', 'https://wealthdesk.example/abc'),
    nextStepsSubject('BC', ''),
    nextStepsSubject('BC'),
    nextStepsSubject('LO'),
  ]

  it('never carries the deal file name, in any shape', () => {
    // deal_name looks like Kylie_Searle_Purchase_2026. Underscores are the tell,
    // and there is no client-facing sentence that wants one.
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
    // the body. Sending one subject for both made the second look like a resend.
    expect(nextStepsSubject('BC', 'https://x')).not.toBe(nextStepsSubject('LO'))
    expect(nextStepsSubject('BC', '')).not.toBe(nextStepsSubject('LO'))
  })

  it('names the job, which is the thing that gets it opened', () => {
    expect(nextStepsSubject('BC', 'https://x')).toBe('Next steps \u2014 your client portal and bank statements')
    expect(nextStepsSubject('LO')).toBe('Next steps \u2014 documents to sign and submission')
  })

  it('only promises bank statements when there is a bank statement step', () => {
    // Without the WealthDesk link the email has no statements step at all, so the
    // subject must not offer one.
    const withLink = buildNextStepsContent('BC', 'https://x')
    const without = buildNextStepsContent('BC', '')
    expect(withLink.steps.some(s => /bank statements/i.test(s.title))).toBe(true)
    expect(without.steps.some(s => /bank statements/i.test(s.title))).toBe(false)

    expect(nextStepsSubject('BC', 'https://x')).toMatch(/bank statements/)
    expect(nextStepsSubject('BC', '')).not.toMatch(/bank statements/)
    expect(nextStepsSubject('BC', '')).toMatch(/documents/)
  })

  it('treats a missing link the same as a blank one', () => {
    expect(nextStepsSubject('BC')).toBe(nextStepsSubject('BC', ''))
  })
})
