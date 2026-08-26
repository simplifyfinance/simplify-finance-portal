import crypto from 'crypto'

// The "get started" link carries everything it needs inside itself, signed, so
// nothing has to be stored and there is no record to go stale. Change one
// character of the link and the signature stops matching, so a stranger cannot
// forge a "ready to proceed" notice for a client who never asked.

export type ReadyPayload = {
  name: string            // client first name, for the greeting
  email: string           // client email, so the broker can reply
  brokerKey: string
  brokerName: string
  calendly: string        // the same link the email's "book a chat" button uses
  sentOn: string          // YYYY-MM-DD, so the notice can say when it was sent
  repaymentType: 'PI' | 'IO'
  balance: number
  currentRate: number
  newRate: number
  remainingYears: number
  cashback: number
  monthlySaving: number
}

// A dedicated secret if one is set, otherwise the service role key — which is
// server-only and already required for the portal to run, so the links work
// without a deploy-time step. Never sent to the browser either way.
function secret(): string {
  const s = process.env.READY_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!s) throw new Error('No signing secret is configured.')
  return s
}

const b64 = (b: Buffer) => b.toString('base64url')

// Signing and checking are the same job whatever the link carries, so both the
// "ready to proceed" link and the buying-opportunity link share this rather than
// each growing their own copy of the crypto.
export function signPayload(value: unknown): string {
  const body = b64(Buffer.from(JSON.stringify(value)))
  const mac = b64(crypto.createHmac('sha256', secret()).update(body).digest()).slice(0, 32)
  return `${body}.${mac}`
}

export function verifyPayload<T>(token: string): T | null {
  try {
    const [body, mac] = String(token || '').split('.')
    if (!body || !mac) return null
    const want = b64(crypto.createHmac('sha256', secret()).update(body).digest()).slice(0, 32)
    // constant time, so a wrong signature cannot be narrowed down by timing
    const a = Buffer.from(mac), b = Buffer.from(want)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as T
  } catch {
    return null
  }
}

export const signReady = (p: ReadyPayload): string => signPayload(p)
export const verifyReady = (token: string): ReadyPayload | null => verifyPayload<ReadyPayload>(token)

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://simplify-finance-portal.vercel.app'
}

export function readyUrl(token: string): string {
  return `${siteUrl()}/ready/${token}`
}
