import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { emailFreshness, needsAttention } from './email-freshness'

// UNTICKING A QUESTION DID NOT TAKE IT OFF THE EMAIL.
//
// 30 Oct 2026. Fabio: "when I untick these boxes they are still showing on the
// email."
//
// The questions block is built on the server, at the moment the email is
// generated. Untick one afterwards and the saved wording knows nothing about
// it - and nothing on the screen said so.
//
// IT IS WORSE THAN AN ANNOYANCE. Send to client sends the SAVED wording and
// records what went out from the LIVE list, so the deal says four questions
// were asked while the client receives five.

const BC = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const LO = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

const saved = (emailQuestions: string[] | null) => ({
  emailHtml: '<p>hello</p>', emailHtmlTemplate: 'oo_purchase', emailFigures: {}, emailQuestions,
})

describe('AN EMAIL REMEMBERS WHICH QUESTIONS IT CARRIED', () => {
  it('and says so when one is unticked after it was written', () => {
    expect(emailFreshness(saved([]), 'oo_purchase', {}, ['addresses']).state)
      .toBe('questions-moved')
  })

  it('and when one is ticked back on', () => {
    expect(emailFreshness(saved(['addresses']), 'oo_purchase', {}, []).state)
      .toBe('questions-moved')
  })

  it('and stays fresh while the list is the same', () => {
    expect(emailFreshness(saved(['addresses']), 'oo_purchase', {}, ['addresses']).state).toBe('fresh')
  })

  it('whatever order they are in', () => {
    expect(emailFreshness(saved(['a', 'b']), 'oo_purchase', {}, ['b', 'a']).state).toBe('fresh')
  })

  it('AND EVERY EMAIL WRITTEN BEFORE TODAY IS LEFT ALONE', () => {
    // No list recorded means we cannot know, and a warning on every old email
    // is noise about a thing nobody can check. Same reasoning as 'unknown'.
    expect(emailFreshness(saved(null), 'oo_purchase', {}, ['addresses']).state).toBe('fresh')
  })

  it('and the scenario still wins, because it rewrites the whole email', () => {
    expect(emailFreshness(saved([]), 'investment_purchase', {}, ['addresses']).state).toBe('stale')
  })

  it('and a moved figure still wins over a moved question', () => {
    const f = emailFreshness({ ...saved([]), emailFigures: { "Dean's income": '$90,000' } },
                             'oo_purchase', { "Dean's income": '$120,000' }, ['addresses'])
    expect(f.state).toBe('figures-moved')
  })

  it('AND IT COUNTS AS SOMETHING TO LOOK AT', () => {
    expect(needsAttention({ state: 'questions-moved' })).toBe(true)
  })
})

describe('AND BOTH FORMS RECORD IT WHEN THEY GENERATE', () => {
  it('the borrowing capacity', () => {
    expect(BC).toContain('setEmailQuestions(questionsDropped)')
    expect(BC).toContain('emailQuestions }, \n' .trim().slice(0, 16))
  })

  it('and the lending options', () => {
    expect(LO).toContain('emailQuestions: questionsDropped')
  })

  it('and both ask the shared question with the live list', () => {
    expect(BC).toContain('template, nowFigures, questionsDropped)')
    expect(LO).toContain('emailQuestions: d.emailQuestions')
  })

  it('AND THE BC SAYS IT IN WORDS, NOT JUST A TOOLTIP', () => {
    expect(BC).toContain('The questions have changed since this email was written.')
    expect(BC).toContain("freshness.state === 'questions-moved'")
  })

  it('and nothing is blocked', () => {
    // 8 Sep 2026: "last time we blocked something on the portal it was worse
    // than the problem." It says so and leaves the decision where it belongs.
    const at = BC.indexOf('The questions have changed since this email was written.')
    expect(BC.slice(at - 400, at + 400)).not.toContain('disabled')
  })
})
