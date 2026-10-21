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
// THEY ARE SETTINGS, NOT CODE. 21 Oct 2026, Fabio: "want to be able to change
// in vercel while you are at it". Three numbers in Vercel, a redeploy, ninety
// seconds - rather than an edit and an eight minute ship every time he wants
// to try a different hour.
//
// THE BOUNDS ARE THE POINT OF READING THEM THIS WAY. A typo that set idle to
// zero would sign everybody out on every click, for ever, and the only way
// back would be another deploy by somebody who had worked out what happened.
// Anything outside the range below is ignored and the default is used.
export type Policy = {
  /** How long somebody can walk away. */
  idleMinutes: number
  /** The hard cap from the moment the code was accepted. */
  absoluteHours: number
  /** How long a browser skips the code. 0 means never - a code every time. */
  trustDays: number
}

// A CODE EVERY SINGLE SIGN-IN. 22 Oct 2026.
//
// This shipped at thirty days, which is the ordinary answer: the password is
// typed every time and the code is for a new machine or once a month. Fabio
// signed in the next morning, was not asked for one, and said: "I am nit sure
// I like that for security."
//
// It is his call and he is not wrong to make it. We hold a client's whole
// financial position, and a stolen password with a trusted laptop is one
// factor wearing the costume of two. Zero means the code is always the second
// factor, never a cookie that was the second factor a month ago.
//
// IT COSTS A CODE A MORNING. The hard cap is eight hours, so in practice the
// team will meet the code roughly once a day. That is the price, and it was
// chosen knowing it.
//
// TO GO BACK, nobody needs this file: set TWO_FACTOR_TRUST_DAYS in Vercel and
// redeploy. The screens already follow it - the trust tick box is not drawn at
// zero, and the middleware does not even read the cookie. See app/verify.
export const DEFAULTS: Policy = { idleMinutes: 60, absoluteHours: 8, trustDays: 0 }

export const LIMITS = {
  // Under five minutes is unusable. Over eight hours is not an idle timeout.
  idleMinutes: { min: 5, max: 480 },
  // An hour is the shortest that is not cruel; a day is the longest that is
  // still a cap.
  absoluteHours: { min: 1, max: 24 },
  // Zero is allowed and means something: a code every single sign-in.
  trustDays: { min: 0, max: 90 },
} as const

function within(raw: any, bounds: { min: number; max: number }, fallback: number): number {
  const text = String(raw ?? '').trim()
  // NOT SET IS NOT ZERO. Number('') is 0, and zero is a legal answer for trust
  // days - it means a code every single sign-in. So an unset variable read as
  // "no browser is ever trusted", and everyone would have been typing a code
  // every hour while the setting sat empty exactly as intended. Caught by its
  // own test on the night it was written.
  if (text === '') return fallback
  const n = Number(text)
  if (!Number.isFinite(n)) return fallback
  const whole = Math.round(n)
  if (whole < bounds.min || whole > bounds.max) return fallback
  return whole
}

/** Read once per request from the environment. Nothing here throws. */
export function readPolicy(env: Record<string, string | undefined> = {}): Policy {
  return {
    idleMinutes: within(env.TWO_FACTOR_IDLE_MINUTES, LIMITS.idleMinutes, DEFAULTS.idleMinutes),
    absoluteHours: within(env.TWO_FACTOR_ABSOLUTE_HOURS, LIMITS.absoluteHours, DEFAULTS.absoluteHours),
    trustDays: within(env.TWO_FACTOR_TRUST_DAYS, LIMITS.trustDays, DEFAULTS.trustDays),
  }
}

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

export function trustExpiry(now: Date, policy: Policy = DEFAULTS): string {
  return new Date(now.getTime() + policy.trustDays * 86_400_000).toISOString()
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
export function sessionVerdict(
  pass: Pass | null, userId: string, now: Date, policy: Policy = DEFAULTS,
): SessionVerdict {
  if (!pass) return 'none'
  if (pass.u !== userId) return 'wrong-user'
  const ms = now.getTime()
  if (ms - pass.s > policy.idleMinutes * 60_000) return 'idle'
  if (ms - pass.v > policy.absoluteHours * 3_600_000) return 'spent'
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
/**
 * THE SENTENCE ON THE SIGN-IN SCREEN.
 *
 * The login page is a browser component and cannot read a Vercel setting, so
 * the number travels with the redirect - ?out=idle&n=60 - rather than being
 * hard coded here where it would start lying the first time Fabio changes it.
 */
export function whyYouAreOut(reason: any, howMany?: any): string {
  const n = Number(String(howMany ?? '').trim())
  switch (String(reason || '')) {
    case 'idle': {
      const mins = Number.isFinite(n) && n > 0 ? n : DEFAULTS.idleMinutes
      return `Nobody touched the portal for ${mins} minutes, so it locked itself.`
    }
    case 'spent': {
      const hrs = Number.isFinite(n) && n > 0 ? n : DEFAULTS.absoluteHours
      return `You had been signed in for ${hrs} hours, so the portal locked itself.`
    }
    default:
      return ''
  }
}
