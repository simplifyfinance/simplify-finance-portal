import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  enforcedFor, makeCode, makeToken, hashSecret, sameSecret, checkCode,
  sealPass, openPass, sessionVerdict, isRealVisit, shouldPush, whyYouAreOut,
  codeExpiry, trustExpiry, readPolicy,
  DEFAULTS, LIMITS, MAX_ATTEMPTS, CODE_MINUTES,
  SESSION_COOKIE, DEVICE_COOKIE,
} from './two-factor'

// LOCKING THE FRONT DOOR.
//
// 21 Oct 2026. Fabio: "We now have a lot of personal information there and we
// need to lock in the system... I don't want to be in a position, which I had
// multiple times, that I leave the portal open and it stays open overnight."
//
// Password, then a six digit code by email. Sixty minutes idle, twelve hour
// cap, browser trusted thirty days.
//
// MOST OF WHAT IS BELOW IS NOT ABOUT LETTING THE RIGHT PEOPLE IN. It is about
// the ways this could keep everybody out at seven in the morning, which is the
// failure that matters on the day after it ships.

const SECRET = 'a-long-secret-that-only-vercel-knows'
const ME = '11111111-1111-1111-1111-111111111111'
const at = (iso: string) => new Date(iso)

describe('who it applies to, which is the way out', () => {
  // EMPTY MEANS OFF. If a missing setting locked people out, the first
  // deploy that dropped an environment variable would stop the business.
  it('is off when nobody is listed', () => {
    expect(enforcedFor('fabio@simplifyfinance.com.au', '')).toBe(false)
    expect(enforcedFor('fabio@simplifyfinance.com.au', undefined)).toBe(false)
    expect(enforcedFor('fabio@simplifyfinance.com.au', '   ')).toBe(false)
  })

  it('applies to the people named and nobody else', () => {
    const list = 'fabio@simplifyfinance.com.au, katie@simplifyfinance.com.au'
    expect(enforcedFor('fabio@simplifyfinance.com.au', list)).toBe(true)
    expect(enforcedFor('KATIE@SimplifyFinance.com.au', list)).toBe(true)
    expect(enforcedFor('someone@else.com', list)).toBe(false)
  })

  it('turns on for the whole business with one word', () => {
    expect(enforcedFor('anyone@anywhere.com', '*')).toBe(true)
    expect(enforcedFor('anyone@anywhere.com', 'everyone')).toBe(true)
  })

  it('never applies to somebody with no address at all', () => {
    expect(enforcedFor('', '*')).toBe(false)
    expect(enforcedFor(null, '*')).toBe(false)
  })
})

describe('the code itself', () => {
  it('is six digits, every time', () => {
    for (let i = 0; i < 400; i++) expect(makeCode()).toMatch(/^\d{6}$/)
  })

  it('is not the same code twice in a row', () => {
    const many = new Set(Array.from({ length: 200 }, () => makeCode()))
    expect(many.size).toBeGreaterThan(150)
  })

  // NOTHING SECRET IS STORED AS ITSELF. A copy of the table is not a way in.
  it('is hashed with its own salt before it is stored', async () => {
    const a = await hashSecret('123456', 'salt-one')
    const b = await hashSecret('123456', 'salt-two')
    expect(a).not.toBe('123456')
    expect(a).not.toBe(b)
    expect(a).toBe(await hashSecret('123456', 'salt-one'))
  })

  it('compares without giving the answer away a character at a time', () => {
    expect(sameSecret('abc', 'abc')).toBe(true)
    expect(sameSecret('abc', 'abd')).toBe(false)
    expect(sameSecret('abc', 'abcd')).toBe(false)
    expect(sameSecret('', '')).toBe(true)
  })
})

describe('everything that can be wrong with a code', () => {
  const live = {
    code_hash: 'right', expires_at: '2026-10-21T10:10:00Z', used_at: null, attempts: 0,
  }
  const now = at('2026-10-21T10:05:00Z')

  it('accepts the right one', () => {
    expect(checkCode(live, 'right', now)).toEqual({ ok: true })
  })

  it('refuses one that has run out of time', () => {
    expect(checkCode(live, 'right', at('2026-10-21T10:11:00Z')))
      .toEqual({ ok: false, why: 'expired' })
  })

  // A CODE IS FOR ONE SIGN-IN. Without this it stays live in a mailbox for its
  // whole ten minutes, for anybody who can read that mailbox.
  it('refuses one that has already been used', () => {
    expect(checkCode({ ...live, used_at: '2026-10-21T10:06:00Z' }, 'right', now))
      .toEqual({ ok: false, why: 'used' })
  })

  // Five tries, or a million guesses is an afternoon.
  it('refuses one that has been guessed at too many times', () => {
    expect(checkCode({ ...live, attempts: MAX_ATTEMPTS }, 'right', now))
      .toEqual({ ok: false, why: 'too-many' })
  })

  it('counts down the tries left on a wrong one', () => {
    expect(checkCode({ ...live, attempts: 2 }, 'wrong', now))
      .toEqual({ ok: false, why: 'wrong', left: MAX_ATTEMPTS - 3 })
  })

  it('refuses when there is no code at all', () => {
    expect(checkCode(null, 'anything', now)).toEqual({ ok: false, why: 'wrong' })
  })

  it('dates a code ten minutes out and a trust by the policy', () => {
    const now = at('2026-10-21T10:00:00Z')
    expect(codeExpiry(now)).toBe(new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString())
    expect(trustExpiry(now, { ...DEFAULTS, trustDays: 30 }))
      .toBe(new Date(now.getTime() + 30 * 86_400_000).toISOString())
    expect(trustExpiry(now, { ...DEFAULTS, trustDays: 7 }))
      .toBe(new Date(now.getTime() + 7 * 86_400_000).toISOString())
  })
})

describe('the session cookie', () => {
  const now = at('2026-10-21T10:00:00Z')

  it('comes back as it went in', async () => {
    const sealed = await sealPass({ u: ME, v: now.getTime(), s: now.getTime() }, SECRET)
    expect(await openPass(sealed, SECRET)).toEqual({ u: ME, v: now.getTime(), s: now.getTime() })
  })

  // THE WHOLE POINT OF SIGNING IT. Without this, anybody could hand themselves
  // another twelve hours by editing a cookie in their own browser.
  it('is refused when somebody has edited it', async () => {
    const sealed = await sealPass({ u: ME, v: now.getTime(), s: now.getTime() }, SECRET)
    const [body, mac] = sealed.split('.')
    const forged = btoa(JSON.stringify({ u: ME, v: Date.now(), s: Date.now() }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await openPass(`${forged}.${mac}`, SECRET)).toBe(null)
    expect(await openPass(`${body}.notthemac`, SECRET)).toBe(null)
  })

  it('is refused when it was signed with a different secret', async () => {
    const sealed = await sealPass({ u: ME, v: now.getTime(), s: now.getTime() }, SECRET)
    expect(await openPass(sealed, 'some-other-secret')).toBe(null)
  })

  it('is refused when it is nonsense', async () => {
    for (const junk of ['', 'no-dot', 'a.b', null, undefined]) {
      expect(await openPass(junk as any, SECRET)).toBe(null)
    }
  })
})

describe('the two clocks', () => {
  const started = at('2026-10-21T09:00:00Z')
  const pass = { u: ME, v: started.getTime(), s: started.getTime() }

  it('lets somebody straight back in a minute later', () => {
    expect(sessionVerdict(pass, ME, at('2026-10-21T09:01:00Z'))).toBe('ok')
  })

  // THE ONE FABIO ASKED FOR. A laptop left open overnight is idle, and at
  // sixty minutes it is gone.
  it('ends it after an hour of nobody being there', () => {
    expect(sessionVerdict(pass, ME, at('2026-10-21T09:59:00Z'))).toBe('ok')
    expect(sessionVerdict(pass, ME, at('2026-10-21T10:01:00Z'))).toBe('idle')
    expect(DEFAULTS.idleMinutes).toBe(60)
  })

  it('uses whatever hour it has been given rather than a number of its own', () => {
    const tight = { ...DEFAULTS, idleMinutes: 15 }
    expect(sessionVerdict(pass, ME, at('2026-10-21T09:14:00Z'), tight)).toBe('ok')
    expect(sessionVerdict(pass, ME, at('2026-10-21T09:16:00Z'), tight)).toBe('idle')
  })

  // THE BACKSTOP. Something that keeps a tab busy cannot hold a session open
  // for a week.
  // Fabio moved this from twelve to eight on 21 Oct 2026, the night it was
  // built, which is the whole reason these are settings and not constants.
  it('ends it after the cap however busy they were', () => {
    const busy = { u: ME, v: started.getTime(), s: at('2026-10-21T17:30:00Z').getTime() }
    expect(sessionVerdict(busy, ME, at('2026-10-21T16:59:00Z'))).toBe('ok')
    expect(sessionVerdict(busy, ME, at('2026-10-21T17:31:00Z'))).toBe('spent')
    expect(DEFAULTS.absoluteHours).toBe(8)
    // 22 Oct 2026. A code every single sign-in, by Fabio's decision the morning
    // after this shipped at thirty days: "I am nit sure I like that for
    // security." Zero is not a leftover or a typo - it is the answer - and the
    // bounds below allow it on purpose, so nothing else in here would notice if
    // it drifted back to a month.
    expect(DEFAULTS.trustDays).toBe(0)
  })

  // A cookie from somebody else's login is no use on this account.
  it('refuses a cookie belonging to another person', () => {
    expect(sessionVerdict(pass, 'someone-else', at('2026-10-21T09:01:00Z'))).toBe('wrong-user')
  })

  it('says there is nothing when there is nothing', () => {
    expect(sessionVerdict(null, ME, started)).toBe('none')
  })

  // The sign-in screen is a browser component and cannot read a Vercel
  // setting, so the number travels in the address with it.
  it('tells the person which clock it was, with the real number', () => {
    expect(whyYouAreOut('idle', 60)).toContain('60 minutes')
    expect(whyYouAreOut('idle', 15)).toContain('15 minutes')
    expect(whyYouAreOut('spent', 8)).toContain('8 hours')
    expect(whyYouAreOut('')).toBe('')
    expect(whyYouAreOut('nonsense')).toBe('')
  })

  it('falls back to the default rather than printing nonsense', () => {
    expect(whyYouAreOut('idle')).toContain(`${DEFAULTS.idleMinutes} minutes`)
    expect(whyYouAreOut('idle', 'rubbish')).toContain(`${DEFAULTS.idleMinutes} minutes`)
    expect(whyYouAreOut('spent', '-4')).toContain(`${DEFAULTS.absoluteHours} hours`)
  })
})

// ---------------------------------------------------------------------------
// THE PIECE THE WHOLE FEATURE TURNS ON
// ---------------------------------------------------------------------------
//
// This portal saves as you type and keeps a presence record for every open
// deal. If those pushed the idle clock, a laptop left open overnight would
// keep itself signed in until morning - and the thing Fabio actually asked for
// would quietly do nothing while every test passed.

describe('what counts as somebody being there', () => {
  const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null })

  it('counts a page somebody navigated to', () => {
    expect(isRealVisit(headers({ 'sec-fetch-mode': 'navigate' }))).toBe(true)
    expect(isRealVisit(headers({ 'sec-fetch-dest': 'document' }))).toBe(true)
  })

  it('does not count the portal talking to itself', () => {
    expect(isRealVisit(headers({ 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }))).toBe(false)
    expect(isRealVisit(headers({ 'sec-fetch-mode': 'no-cors', 'sec-fetch-dest': 'empty' }))).toBe(false)
  })

  it('still counts a page request from a browser too old to say so', () => {
    expect(isRealVisit(headers({ accept: 'text/html,application/xhtml+xml' }))).toBe(true)
    expect(isRealVisit(headers({ accept: 'application/json' }))).toBe(false)
  })

  it('does not rewrite the cookie on every single click', () => {
    const now = at('2026-10-21T10:00:00Z')
    const justNow = { u: ME, v: now.getTime(), s: now.getTime() - 60_000 }
    const aWhileAgo = { u: ME, v: now.getTime(), s: now.getTime() - 6 * 60_000 }
    expect(shouldPush(justNow, now)).toBe(false)
    expect(shouldPush(aWhileAgo, now)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// THE WAYS THIS LOCKS EVERYBODY OUT AT SEVEN IN THE MORNING
// ---------------------------------------------------------------------------

describe('the code that decides', () => {
  const mw = readFileSync('middleware.ts', 'utf8')

  // WITHOUT A SECRET NOTHING CAN BE SIGNED. The honest answer is to behave
  // exactly as yesterday, not to invent a lock with no key.
  it('does nothing at all when no secret is set', () => {
    expect(mw).toContain('AUTH_COOKIE_SECRET')
    expect(mw).toMatch(/mustVerify = !!secret/)
  })

  it('does nothing at all when nobody is listed', () => {
    expect(mw).toContain('TWO_FACTOR_EMAILS')
    expect(mw).toContain('enforcedFor')
  })

  // The code screen and the route that feeds it cannot sit behind the gate
  // they exist to open.
  it('lets the code screen and its route through', () => {
    expect(mw).toContain("!pathname.startsWith('/verify')")
    expect(mw).toContain("!pathname.startsWith('/api/2fa')")
  })

  // A CLIENT PRESSING A BUTTON IN AN EMAIL HAS NO LOGIN AND MUST NOT MEET A
  // CODE SCREEN. The public pages were working before this and have to still
  // be working after it.
  it('leaves the client-facing pages alone', () => {
    expect(mw).toContain("pathname.startsWith('/proceed')")
    expect(mw).toContain("pathname.startsWith('/ready')")
    expect(mw).toContain("pathname.startsWith('/opportunity')")
  })

  // Those pages call their own routes with nobody signed in. A redirect there
  // would hand a client a sign-in screen in place of a confirmation.
  it('leaves a route called with no session alone', () => {
    expect(mw).toMatch(/if \(pathname\.startsWith\('\/api'\)\) return supabaseResponse/)
  })

  // 21 Oct 2026: /api used to be excluded from the middleware entirely, so
  // somebody with a stolen password who never loaded a page would never have
  // met the code screen.
  it('now runs on the routes as well as the pages', () => {
    const matcher = mw.slice(mw.indexOf('matcher:'))
    expect(matcher).not.toMatch(/\|api\|/)
  })

  // A laptop on a train has to be signed OUT, not parked behind a code screen
  // with a live session behind it.
  it('throws the session away when a clock runs out', () => {
    expect(mw).toMatch(/verdict === 'idle' \|\| verdict === 'spent'/)
    expect(mw).toContain("c.name.startsWith('sb-')")
  })

  // A DATABASE THAT CANNOT BE REACHED IS NOT A TRUSTED BROWSER. The other way
  // round is a door that opens whenever the network is poor.
  it('treats an unreachable database as untrusted, not as trusted', () => {
    const fn = mw.slice(mw.indexOf('async function trustedBrowser'))
    expect(fn).toMatch(/catch \{[\s\S]*return false/)
  })
})

describe('the screens', () => {
  const verify = readFileSync('app/verify/page.tsx', 'utf8')
  const login = readFileSync('app/login/page.tsx', 'utf8')

  it('tell somebody why they are suddenly back at the sign-in screen', () => {
    expect(login).toContain('whyYouAreOut')
    expect(login).toContain('You were signed out')
  })

  // Somebody who cannot reach their email on this machine is otherwise stuck
  // on the code screen with a live session behind it.
  it('give a way off the code screen that is not the back button', () => {
    expect(verify).toContain('Sign out instead')
  })

  // The same bug that left people on a dead "Signing in..." button in
  // September: the middleware has to see a cookie set a moment ago, and a
  // background fetch can race it.
  it('leave the code screen with a full page load, not a router push', () => {
    expect(verify).toContain('window.location.href')
    expect(verify).not.toContain('router.push')
  })

  it('offer the trust, and say the password is still needed', () => {
    expect(verify).toContain('Trust this browser')
    expect(verify).toContain('still type your password')
  })
})

describe('the routes', () => {
  const send = readFileSync('app/api/2fa/send/route.ts', 'utf8')
  const verify = readFileSync('app/api/2fa/verify/route.ts', 'utf8')
  const revoke = readFileSync('app/api/2fa/revoke/route.ts', 'utf8')

  // A route that took an address from the caller would send codes to
  // strangers on request. See app/api/invite-user/route.ts for the time this
  // codebase learned that.
  it('send a code only to the person already signed in', () => {
    expect(send).toContain('auth.getUser()')
    expect(send).toContain('to: [user.email]')
    expect(send).not.toMatch(/to: \[.*body\./)
  })

  it('never hand the code back to the browser', () => {
    // Every reply this route makes, checked one at a time. The code is built
    // into the email body and the subject, which is why a blunt search over
    // the whole file says nothing useful.
    const replies = send.match(/NextResponse\.json\(\{[\s\S]*?\}/g) || []
    expect(replies.length).toBeGreaterThan(3)
    for (const r of replies) {
      // The English is stripped first. "The code could not be emailed" is a
      // sentence for a person; what must never appear is the variable.
      const noWords = r.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
      expect(noWords, `a reply carries the code: ${r}`).not.toMatch(/\bcode\b/)
    }
  })

  it('spend the code the moment it works', () => {
    expect(verify).toContain("used_at: now.toISOString()")
    expect(verify).toContain(".is('used_at', null)")
  })

  // The five-try limit is a decoration if a wrong guess costs nothing.
  it('charge a wrong guess against the tries', () => {
    expect(verify).toContain('attempts: Number(row.attempts || 0) + 1')
  })

  // A trust that was not saved must not be handed out: it would be presented
  // every morning and refused every morning.
  it('only hand out a trust cookie that reached the database', () => {
    expect(verify).toMatch(/if \(!trustErr && kept && kept\.length > 0\)/)
  })

  it('put both cookies out of reach of anything on the page', () => {
    expect(verify).toContain('httpOnly: true')
    expect(verify).toContain(SESSION_COOKIE)
    expect(verify).toContain(DEVICE_COOKIE)
  })

  it('let only an admin cut off somebody else, and anyone cut off themselves', () => {
    expect(revoke).toContain("can(me as any, 'manageTeam')")
    expect(revoke).toContain('target !== user.id')
  })
})

describe('the tables', () => {
  const sql = readFileSync('docs/two-factor-schema.sql', 'utf8')

  // A SIGN-IN CODE ANY LOGGED-IN USER COULD READ IS NOT A SECOND FACTOR, it
  // is a second copy of the first one.
  it('are locked so that no browser key can read them', () => {
    expect(sql).toContain('alter table public.auth_codes      enable row level security')
    expect(sql).toContain('alter table public.trusted_devices enable row level security')
    expect(sql).toContain('revoke all on public.auth_codes      from anon, authenticated')
  })

  it('store a hash and a salt, never the thing itself', () => {
    expect(sql).toContain('code_hash text not null')
    expect(sql).toContain('token_hash text not null')
    expect(sql).not.toMatch(/^\s*code text/m)
  })

  it('check afterwards that nobody added a policy', () => {
    expect(sql).toContain('policies on them (must be 0)')
  })
})

describe('the beacon', () => {
  const beacon = readFileSync('components/StillHere.tsx', 'utf8')

  it('listens for a finger, not for the portal talking to itself', () => {
    expect(beacon).toContain('keydown')
    expect(beacon).toContain('pointerdown')
  })

  // A cat on a desk and a nudged trackpad both move a pointer. Pressing
  // something is a decision.
  it('does not count the mouse merely moving', () => {
    // The word itself is in a comment saying why, so this looks for a
    // listener rather than for the word.
    expect(beacon).not.toMatch(/addEventListener\(\s*['"]mousemove/)
    expect(beacon).not.toMatch(/addEventListener\(\s*['"]mouseover/)
  })

  it('ignores a tab nobody is looking at', () => {
    expect(beacon).toContain('document.hidden')
  })
})

// ---------------------------------------------------------------------------
// THE THREE NUMBERS ARE SETTINGS, AND A TYPO IN ONE IS NOT A LOCKOUT
// ---------------------------------------------------------------------------
//
// 21 Oct 2026, Fabio: "want to be able to change in vercel while you are at
// it". The bounds are the reason this is safe: a zero in the idle box would
// otherwise sign the whole business out on every click, for ever, and the only
// way back would be another deploy by somebody who had worked out why.

describe('reading the rules out of Vercel', () => {
  it('uses the defaults when nothing is set', () => {
    expect(readPolicy({})).toEqual(DEFAULTS)
    expect(readPolicy({ TWO_FACTOR_IDLE_MINUTES: '' })).toEqual(DEFAULTS)
  })

  it('takes a number that makes sense', () => {
    expect(readPolicy({
      TWO_FACTOR_IDLE_MINUTES: '30',
      TWO_FACTOR_ABSOLUTE_HOURS: '10',
      TWO_FACTOR_TRUST_DAYS: '7',
    })).toEqual({ idleMinutes: 30, absoluteHours: 10, trustDays: 7 })
  })

  it('ignores a number that would lock everybody out', () => {
    expect(readPolicy({ TWO_FACTOR_IDLE_MINUTES: '0' }).idleMinutes).toBe(DEFAULTS.idleMinutes)
    expect(readPolicy({ TWO_FACTOR_IDLE_MINUTES: '-5' }).idleMinutes).toBe(DEFAULTS.idleMinutes)
    expect(readPolicy({ TWO_FACTOR_IDLE_MINUTES: '1' }).idleMinutes).toBe(DEFAULTS.idleMinutes)
    expect(readPolicy({ TWO_FACTOR_ABSOLUTE_HOURS: '0' }).absoluteHours).toBe(DEFAULTS.absoluteHours)
  })

  it('ignores a number that would make the lock pointless', () => {
    expect(readPolicy({ TWO_FACTOR_IDLE_MINUTES: '99999' }).idleMinutes).toBe(DEFAULTS.idleMinutes)
    expect(readPolicy({ TWO_FACTOR_ABSOLUTE_HOURS: '720' }).absoluteHours).toBe(DEFAULTS.absoluteHours)
    expect(readPolicy({ TWO_FACTOR_TRUST_DAYS: '3650' }).trustDays).toBe(DEFAULTS.trustDays)
  })

  it('ignores anything that is not a number at all', () => {
    for (const junk of ['sixty', 'an hour', '60 minutes', ' ', 'null']) {
      expect(readPolicy({ TWO_FACTOR_IDLE_MINUTES: junk }).idleMinutes,
        `${junk} should fall back`).toBe(DEFAULTS.idleMinutes)
    }
  })

  // ZERO TRUST DAYS IS A REAL ANSWER, not a mistake - it means a code every
  // single sign-in, which is the strictest setting Fabio was offered.
  it('allows zero trust days, which means a code every time', () => {
    expect(readPolicy({ TWO_FACTOR_TRUST_DAYS: '0' }).trustDays).toBe(0)
  })

  it('rounds a number somebody typed with a decimal point', () => {
    expect(readPolicy({ TWO_FACTOR_IDLE_MINUTES: '45.4' }).idleMinutes).toBe(45)
  })

  it('has bounds that make sense against each other', () => {
    expect(LIMITS.idleMinutes.min).toBeLessThan(LIMITS.idleMinutes.max)
    expect(LIMITS.absoluteHours.min).toBeLessThan(LIMITS.absoluteHours.max)
    expect(DEFAULTS.idleMinutes).toBeGreaterThanOrEqual(LIMITS.idleMinutes.min)
    expect(DEFAULTS.absoluteHours).toBeLessThanOrEqual(LIMITS.absoluteHours.max)
  })
})

describe('the rules reach the places that enforce them', () => {
  const mw = readFileSync('middleware.ts', 'utf8')
  const verify = readFileSync('app/api/2fa/verify/route.ts', 'utf8')
  const screen = readFileSync('app/verify/page.tsx', 'utf8')

  it('are read from the environment rather than hard coded', () => {
    expect(mw).toContain('readPolicy(process.env')
    expect(verify).toContain('readPolicy(process.env')
  })

  it('hand the number to the sign-in screen, which cannot read a setting', () => {
    expect(mw).toContain("url.searchParams.set('n'")
  })

  // A tick box that does nothing is worse than no tick box.
  it('stop offering to trust a browser when trust is turned off', () => {
    expect(verify).toContain('policy.trustDays > 0')
    expect(mw).toContain('policy.trustDays > 0')
    expect(screen).toContain('rules.trustDays > 0')
  })
})
