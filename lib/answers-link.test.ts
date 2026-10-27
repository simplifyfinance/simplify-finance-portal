// THE LINK A CLIENT OPENS TO ANSWER WHAT IS STILL MISSING.
//
// Signed and not stored, like the Ready and Opportunity links beside it.
// Invented ids and dates throughout.
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  // The real links sign with the service role key. Nothing here needs the real
  // one - only that signing and checking use the same secret.
  process.env.READY_LINK_SECRET = process.env.READY_LINK_SECRET || 'test-secret-for-signing'
})

const load = async () => await import('./answers-link')

const ISSUED = new Date('2026-10-27T09:00:00+11:00')

describe('it carries the deal inside itself', () => {
  it('so there is nothing to store and no row to go stale', async () => {
    const { signAnswers, verifyAnswers } = await load()
    const token = signAnswers('deal-1', ISSUED)
    expect(verifyAnswers(token, ISSUED)?.dealId).toBe('deal-1')
  })

  it('and it says which email it came from', async () => {
    const { signAnswers, verifyAnswers } = await load()
    const token = signAnswers('deal-1', ISSUED)
    expect(verifyAnswers(token, ISSUED)?.sentOn).toBe('27 October 2026')
  })

  it('a link somebody has edited is refused', async () => {
    // Change one character and the signature stops matching.
    const { signAnswers, verifyAnswers } = await load()
    const token = signAnswers('deal-1', ISSUED)
    const tampered = token.slice(0, 4) + (token[4] === 'a' ? 'b' : 'a') + token.slice(5)
    expect(verifyAnswers(tampered, ISSUED)).toBeNull()
  })

  it('and so is nonsense', async () => {
    const { verifyAnswers } = await load()
    expect(verifyAnswers('', ISSUED)).toBeNull()
    expect(verifyAnswers('not-a-token', ISSUED)).toBeNull()
  })
})

describe('four weeks', () => {
  it('is twenty eight days', async () => {
    // Fabio, 27 Oct 2026: "Link expires in 4 weeks."
    const { LINK_LIVES_FOR_DAYS, expiresFrom } = await load()
    expect(LINK_LIVES_FOR_DAYS).toBe(28)
    expect(expiresFrom(new Date('2026-10-27T00:00:00Z')))
      .toBe(new Date('2026-11-24T00:00:00Z').toISOString())
  })

  it('it works on day twenty seven', async () => {
    const { signAnswers, verifyAnswers } = await load()
    const token = signAnswers('deal-1', ISSUED)
    expect(verifyAnswers(token, new Date('2026-11-22T09:00:00+11:00'))?.dealId).toBe('deal-1')
  })

  it('and not on day twenty nine', async () => {
    const { signAnswers, verifyAnswers } = await load()
    const token = signAnswers('deal-1', ISSUED)
    expect(verifyAnswers(token, new Date('2026-11-26T09:00:00+11:00'))).toBeNull()
  })

  it('a link that has run out is TOLD APART from one that was never valid', async () => {
    // Only for the wording. The page says "this link has expired, I will send a
    // new one" to the first and nothing helpful to the second, because only the
    // first is a thing a real client will ever see.
    const { signAnswers, hasExpired } = await load()
    const token = signAnswers('deal-1', ISSUED)
    expect(hasExpired(token, new Date('2026-11-26T09:00:00+11:00'))).toBe(true)
    expect(hasExpired(token, ISSUED)).toBe(false)
    expect(hasExpired('not-a-token', ISSUED)).toBe(false)
  })

  it('EVERY EMAIL CARRIES A FRESH ONE', async () => {
    // Nothing is reused and nothing has to be reissued. A client who comes back
    // after six weeks opens the link in the newest email and it works.
    const { signAnswers, verifyAnswers } = await load()
    const later = signAnswers('deal-1', new Date('2026-11-20T09:00:00+11:00'))
    expect(verifyAnswers(later, new Date('2026-12-10T09:00:00+11:00'))?.dealId).toBe('deal-1')
  })
})

describe('the address', () => {
  it('sits under /answers, where the middleware lets a client through', async () => {
    const { answersUrl } = await load()
    expect(answersUrl('TOK123')).toContain('/answers/TOK123')
  })
})
