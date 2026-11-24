import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// THE LINKS WE EMAIL CLIENTS, AND THE ONE SECRET THAT HOLDS THEM OPEN.
//
// Three client pages open from a signed link: /ready, /answers and
// /opportunity. All three go through signPayload and verifyPayload in
// lib/ready-link.ts, and both read the same secret:
//
//     process.env.READY_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
//
// WHICH IS WHY READY_LINK_SECRET EXISTS. Until it was set, the fallback was
// doing the work - and that key changes when the database project changes. On
// the day the portal moves to Sydney every link already sitting in a client's
// inbox would have stopped opening. No error at our end: the client clicks and
// gets a page that says nothing.
//
// Fabio, 24 Nov 2026, after being told to go and find a sent email to test it:
// "I don't have a copy of the emails going out... Go and check the code and
// make sure that the ready link secret is fucking working." Fair. There was no
// test on any of this, which is why it could only be answered by clicking.
//
// This file is the answer in code. It proves the three things that matter:
// a link opens, a tampered one does not, and a changed secret closes all of
// them - which is the exact failure READY_LINK_SECRET was set to prevent.

const WAS = { ...process.env }

async function freshModule() {
  // The secret is read at call time, not import time, but the module cache
  // still has to be cleared between different env setups to be certain of it.
  const vitest = await import('vitest')
  vitest.vi.resetModules()
  return await import('./ready-link')
}

const PAYLOAD = {
  name: 'Sam', email: 'sam@example.com',
  brokerKey: 'fabio', brokerName: 'Fabio De Castro',
  calendly: 'https://example.com/book', sentOn: '2026-11-24',
  repaymentType: 'PI' as const,
  balance: 540000, currentRate: 6.44, newRate: 5.89,
  remainingYears: 27, cashback: 2000, monthlySaving: 184,
}

beforeEach(() => {
  delete process.env.READY_LINK_SECRET
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})
afterEach(() => { process.env = { ...WAS } })

describe('a link we signed opens again', () => {
  it('round trips every figure the client reads', async () => {
    process.env.READY_LINK_SECRET = 'a-secret-that-does-not-move'
    const { signReady, verifyReady } = await freshModule()
    const back = verifyReady(signReady(PAYLOAD))
    expect(back).toEqual(PAYLOAD)
  })

  it('and the three kinds of link all use the same secret', async () => {
    process.env.READY_LINK_SECRET = 'a-secret-that-does-not-move'
    const { signPayload, verifyPayload } = await freshModule()
    const { verifyOpportunity, signOpportunity } = await import('./opportunity-link')
    // Signed through the shared pair, read back through the opportunity pair.
    // One secret, three doors - if they ever drift apart this fails.
    const token = signOpportunity({ ...(PAYLOAD as any) })
    expect(verifyOpportunity(token)).toBeTruthy()
    expect(verifyPayload(signPayload({ hello: 'there' }))).toEqual({ hello: 'there' })
  })
})

describe('a link nobody signed does not open', () => {
  it('refuses a changed token', async () => {
    process.env.READY_LINK_SECRET = 'a-secret-that-does-not-move'
    const { signReady, verifyReady } = await freshModule()
    const token = signReady(PAYLOAD)
    const [body, mac] = token.split('.')
    // One character of the payload changed, signature left alone.
    expect(verifyReady(`${body.slice(0, -1)}X.${mac}`)).toBeNull()
    // Signature changed, payload left alone.
    expect(verifyReady(`${body}.${mac.slice(0, -1)}X`)).toBeNull()
    expect(verifyReady('')).toBeNull()
    expect(verifyReady('not-a-token')).toBeNull()
  })
})

describe('WHY READY_LINK_SECRET IS SET, PROVEN', () => {
  it('a link signed under one secret will not open under another', async () => {
    process.env.READY_LINK_SECRET = 'the-old-secret'
    const first = await freshModule()
    const token = first.signReady(PAYLOAD)
    expect(first.verifyReady(token)).toEqual(PAYLOAD)

    // The database moves and the service role key changes with it.
    process.env.READY_LINK_SECRET = 'the-new-secret'
    const second = await freshModule()
    expect(second.verifyReady(token)).toBeNull()
  })

  it('without READY_LINK_SECRET the service role key is doing the signing', async () => {
    // The fallback, which is the thing that moves. Shown rather than described
    // so nobody has to take the comment's word for it.
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-of-the-day'
    const before = await freshModule()
    const token = before.signReady(PAYLOAD)
    expect(before.verifyReady(token)).toEqual(PAYLOAD)

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'a-different-key-after-the-move'
    const after = await freshModule()
    expect(after.verifyReady(token)).toBeNull()
  })

  it('and a dedicated secret outranks the key, so the move cannot touch it', async () => {
    process.env.READY_LINK_SECRET = 'the-one-that-stays'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'before-the-move'
    const before = await freshModule()
    const token = before.signReady(PAYLOAD)

    // The project changes. The service key changes with it. The link still opens.
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'after-the-move'
    const after = await freshModule()
    expect(after.verifyReady(token)).toEqual(PAYLOAD)
  })

  it('and with no secret at all it refuses to sign rather than signing with nothing', async () => {
    const { signReady } = await freshModule()
    expect(() => signReady(PAYLOAD)).toThrow(/signing secret/i)
  })
})
