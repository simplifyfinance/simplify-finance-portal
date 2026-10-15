import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// 15 Oct 2026. A second reader of the same lender policy, built outside this
// codebase against an xAI Collection, mounted at /api/policy-ask.
//
// MEASURED, NOT ASSUMED. Asked "crypto currency as a deposit" against
// Macquarie - a term that appears nowhere in that document - the search
// returned matches anyway, off the cover page and the contents, top score
// 0.00057. A real question, "cash out", scored about 0.11. Two hundred times
// apart, so a floor between them is viable.
//
// This file holds the route to the four things that keep it honest. They are
// checked in the source because the route is a handler around two network
// calls; what matters is that these guards are in it and in the right order.
const SRC = readFileSync('app/api/policy-ask/route.ts', 'utf8')

describe('the policy bot cannot answer a question the documents do not cover', () => {
  it('has a score floor', () => {
    expect(SRC).toContain('PACO_SCORE_FLOOR')
    expect(SRC).toContain("const FLOOR")
  })

  it('and the floor sits between the nonsense query and the real one', () => {
    const m = /PACO_SCORE_FLOOR \|\| '([0-9.]+)'/.exec(SRC)
    expect(m, 'the default floor is gone').not.toBeNull()
    const floor = Number(m![1])
    expect(floor, 'below the 0.00057 a nonsense query scored').toBeGreaterThan(0.00057)
    expect(floor, 'above the 0.11 a real question scored').toBeLessThan(0.11)
  })

  it('WEAK MATCHES NEVER REACH THE MODEL', () => {
    // Not trimmed, not caveated - they do not go. A model handed a cover page
    // and asked a question it cannot answer is being invited to be helpful
    // about nothing, which is how a confident wrong answer gets made.
    const filtered = SRC.indexOf('Number(c?.score) >= FLOOR')
    const chat = SRC.indexOf('chat/completions')
    expect(filtered).toBeGreaterThan(-1)
    expect(filtered, 'the filter must run before the model is called').toBeLessThan(chat)
  })

  it('and nothing left above the floor returns found:false without calling it', () => {
    const noneLeft = SRC.indexOf('chunks.length === 0')
    const chat = SRC.indexOf('chat/completions')
    expect(noneLeft).toBeGreaterThan(-1)
    expect(noneLeft).toBeLessThan(chat)
  })
})

describe('the four things it must do before it talks to anybody', () => {
  it('refuses anyone not signed in', () => {
    expect(SRC).toContain('auth.getUser()')
    expect(SRC).toContain('Not signed in.')
  })

  it('matches the lender against our own table rather than interpolating it', () => {
    expect(SRC).toContain("from('lenders')")
    expect(SRC, 'the raw request value must not reach the filter')
      .not.toContain('filter = `lender = "${askedFor}"`')
  })

  it('gives itself long enough to answer', () => {
    expect(SRC).toContain('maxDuration = 300')
  })

  it('and never puts the word Nada on a screen', () => {
    expect(SRC).toContain("toLowerCase() !== 'nada'")
    expect(SRC).toContain('found')
  })
})

describe('a citation names something a person can open', () => {
  it('the lender and the document, not just a file id', () => {
    expect(SRC).toContain('c?.fields?.lender')
    expect(SRC).toContain('c?.fields?.title')
  })

  it('and page 0 is never printed as a page', () => {
    expect(SRC).toContain('page > 0 ? page : null')
  })
})

describe('nothing in the portal calls it yet', () => {
  const panel = readFileSync('components/Paco.tsx', 'utf8')

  it('because which of the two answers a policy question is not decided', () => {
    // Two unlabelled answers to one question is how a team stops trusting
    // both. When it is decided, this test changes with the decision.
    expect(panel).not.toContain('policy-ask')
  })
})
