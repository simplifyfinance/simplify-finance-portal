// LOCKING THE FRONT DOOR.
//
// 21 Oct 2026. Fabio: "We now have a lot of personal information there and we
// need to lock in the system... I don't want to be in a position, which I had
// multiple times, that I leave the portal open and it stays open overnight."
//
// Password, then a six digit code by email. The browser is trusted for thirty
// days afterwards, so the code is for a new machine or once a month - not every
// morning. The password is still typed every single time.
//
// WHY NOT AN AUTHENTICATOR APP. Asked for and declined: "I don't want an
// authenticator app. I'd rather emails."
//
// EVERYTHING HERE IS A FUNCTION OF ITS ARGUMENTS. No database, no cookies, no
// clock of its own - `now` is always passed in, because a rule about an hour
// has to be testable at any hour. The middleware and the routes do the reaching.

// ---------------------------------------------------------------------------
// HOW LONG A SESSION LASTS
// ---------------------------------------------------------------------------
//
// Fabio picked these on 21 Oct 2026 from four options.
//
// IDLE is the one that answers the question he actually asked. A laptop left
// open overnight is idle, and at sixty minutes it is gone.
//
// THE HARD CAP is the backstop. Something that keeps a tab busy - a stuck
// poll, a page left reloading - cannot hold a session open for a week.
export const IDLE_MINUTES = 60
export const ABSOLUTE_HOURS = 12
export const TRUST_DAYS = 30

// A CODE IS SHORT LIVED AND CHEAP TO GET WRONG TWICE, NOT FIFTY TIMES.
export const CODE_MINUTES = 10
export const MAX_ATTEMPTS = 5
/** Per person, per hour. Stops somebody's inbox being used as a weapon. */
export const MAX_SENDS_PER_HOUR = 3

export const SESSION_COOKIE = 'sf_pass'
export const DEVICE_COOKIE = 'sf_device'

// ---------------------------------------------------------------------------
// WHO IT APPLIES TO
// ---------------------------------------------------------------------------
//
// THIS IS THE WAY OUT, AND IT IS THE WHOLE REASON THE FEATURE IS SAFE TO SHIP.
//
// A list of email addresses in an environment variable. Fabio goes in it alone,
// tests it on the live site himself, and adds the team when he is happy. If
// anything goes wrong at seven in the morning he empties the list in Vercel and
// everybody is back in within a minute - no deploy, no code change, nobody
// waiting on me.
//
// EMPTY MEANS OFF. A portal with nothing configured behaves exactly as it did
// yesterday. That is deliberate: a missing setting must never be the thing that
// locks a business out of its own system.
export function enforcedFor(email: any, list: any): boolean {
  const who = String(email || '').trim().toLowerCase()
  if (!who) return false
  const all = String(list || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (all.length === 0) return false
  // One entry turns it on for the lot, for the day the rollout is finished.
  if (all.includes('*') || all.includes('everyone')) return true
  return all.includes(who)
}

// ---------------------------------------------------------------------------
// THE CODE
// ---------------------------------------------------------------------------

/** Six digits, from the system's own randomness. Never Math.random for this. */
export function makeCode(): string {
  const n = new Uint32Array(1)
  crypto.getRandomValues(n)
  return String(n[0] % 1000000).padStart(6, '0')
}

/** A long random string for a trusted browser to carry. */
export function makeToken(): string {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return b64url(b)
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * NOTHING SECRET IS EVER STORED AS ITSELF.
 *
 * A code and a trust token are both hashed before they go in the database, so
 * a copy of that table is not a way in. Web Crypto rather than node:crypto,
 * because the middleware runs on the edge where node:crypto does not exist.
 */
export async function hashSecret(value: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${value}`))
  return b64url(new Uint8Array(digest))
}

/** Compared in constant time, so the comparison itself gives nothing away. */
export function sameSecret(a: string, b: string): boolean {
  const x = String(a || ''), y = String(b || '')
  if (x.length !== y.length) return false
  let bad = 0
  for (let i = 0; i < x.length; i++) bad |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return bad === 0
}

export type CodeVerdict =
  | { ok: true }
  | { ok: false; why: 'expired' | 'used' | 'too-many' | 'wrong'; left?: number }

/** Everything that can be wrong with a code, in the order it matters. */
export function checkCode(row: {
  code_hash?: string | null; expires_at?: string | null
  used_at?: string | null; attempts?: number | null
} | null | undefined, givenHash: string, now: Date): CodeVerdict {
  if (!row || !row.code_hash) return { ok: false, why: 'wrong' }
  if (row.used_at) return { ok: false, why: 'used' }
  const attempts = Number(row.attempts || 0)
  if (attempts >= MAX_ATTEMPTS) return { ok: false, why: 'too-many' }
  const until = new Date(String(row.expires_at || ''))
  if (isNaN(until.getTime()) || until.getTime() <= now.getTime()) return { ok: false, why: 'expired' }
  if (!sameSecret(row.code_hash, givenHash)) {
    return { ok: false, why: 'wrong', left: Math.max(0, MAX_ATTEMPTS - attempts - 1) }
  }
  return { ok: true }
}

export function codeExpiry(now: Date): string {
  return new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString()
}

export function trustExpiry(now: Date): string {
  return new Date(now.getTime() + TRUST_DAYS * 86_400_000).toISOString()
}

// ---------------------------------------------------------------------------
// THE SESSION COOKIE
// ---------------------------------------------------------------------------
//
// It holds when the second factor was passed and when the person was last
// actually doing something. Signed, so nobody can hand themselves another
// twelve hours by editing it. HttpOnly, so no script on the page can read it.

export type Pass = {
  /** The Supabase user this belongs to. A cookie from another login is no use. */
  u: string
  /** When the code was accepted. The twelve hours run from here. */
  v: number
  /** When this person last clicked or typed. The hour runs from here. */
  s: number
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function sealPass(pass: Pass, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(pass)))
  const mac = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body))
  return `${body}.${b64url(new Uint8Array(mac))}`
}

/** null for anything that is not a cookie this portal signed. */
export async function openPass(cookie: any, secret: string): Promise<Pass | null> {
  const raw = String(cookie || '')
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const body = raw.slice(0, dot), mac = raw.slice(dot + 1)
  try {
    const good = await crypto.subtle.verify('HMAC', await key(secret),
      unb64url(mac) as any, enc.encode(body))
    if (!good) return null
    const parsed = JSON.parse(new TextDecoder().decode(unb64url(body)))
    if (!parsed || typeof parsed.u !== 'string' || typeof parsed.v !== 'number'
        || typeof parsed.s !== 'number') return null
    return parsed as Pass
  } catch { return null }
}

export type SessionVerdict = 'ok' | 'idle' | 'spent' | 'wrong-user' | 'none'

/**
 * IS THIS SESSION STILL ALLOWED?
 *
 * Idle first, because it is the one Fabio asked for and the one that will
 * actually fire. "spent" is the twelve hour backstop.
 */
export function sessionVerdict(pass: Pass | null, userId: string, now: Date): SessionVerdict {
  if (!pass) return 'none'
  if (pass.u !== userId) return 'wrong-user'
  const ms = now.getTime()
  if (ms - pass.s > IDLE_MINUTES * 60_000) return 'idle'
  if (ms - pass.v > ABSOLUTE_HOURS * 3_600_000) return 'spent'
  return 'ok'
}

/**
 * WHAT COUNTS AS BEING THERE.
 *
 * This portal saves as you type and keeps a presence record for every open
 * deal. If those counted, a laptop left open overnight would keep itself alive
 * until morning and the whole feature would do nothing - which is the exact
 * thing being fixed.
 *
 * So the clock is only pushed on a page somebody navigated to, or on a beacon
 * the browser sends when a real finger touches a key or a mouse button. The
 * portal talking to itself never counts.
 */
export function isRealVisit(headers: { get(name: string): string | null }): boolean {
  const mode = (headers.get('sec-fetch-mode') || '').toLowerCase()
  const dest = (headers.get('sec-fetch-dest') || '').toLowerCase()
  if (mode === 'navigate') return true
  // Older browsers send no sec-fetch headers at all; a request that asks for a
  // page rather than for data is a navigation in every one of them.
  if (!mode && (headers.get('accept') || '').includes('text/html')) return true
  return dest === 'document'
}

/** Only pushed every few minutes, so a busy screen is not writing a cookie per click. */
export const TOUCH_EVERY_MS = 5 * 60_000

export function shouldPush(pass: Pass, now: Date): boolean {
  return now.getTime() - pass.s >= TOUCH_EVERY_MS
}

/** The words on the sign-in screen when the portal let somebody go. */
export function whyYouAreOut(reason: any): string {
  switch (String(reason || '')) {
    case 'idle':
      return `Nobody touched the portal for ${IDLE_MINUTES} minutes, so it locked itself.`
    case 'spent':
      return `You had been signed in for ${ABSOLUTE_HOURS} hours, so the portal locked itself.`
    default:
      return ''
  }
}
