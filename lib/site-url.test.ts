import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { siteUrl, DEFAULT_SITE_URL } from './site-url'

// THE ADDRESS HAS ONE HOME NOW. THIS IS WHAT KEEPS IT THAT WAY.
//
// 2 Oct 2026. It was typed out longhand in 34 places across 14 files, 21 of
// them in the email builder. siteUrl() existed the whole time and was meant to
// be the single answer; most of the code just did not ask it.
//
// Nothing was broken, because both copies said the same thing. That is exactly
// what makes this kind of fault dangerous - it is invisible until the day one
// copy changes, and then every client email is pointing at the old address.

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL
})

describe('the fallback is ours, not the hosting company\'s', () => {
  // 14 Nov 2026. one.simplifyfinance.com.au went live and this fallback moved
  // off simplify-finance-portal.vercel.app.
  //
  // WHY IT MATTERS MORE THAN IT LOOKS. NEXT_PUBLIC_SITE_URL had never been set
  // in Vercel - not once since 2 Oct - so every one of the 59 places that
  // builds a link had been silently using this line. Nobody knew, because a
  // fallback that works looks exactly like a setting that works.
  it('with no setting, the address is the portal\'s own', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(siteUrl()).toBe('https://one.simplifyfinance.com.au')
    expect(DEFAULT_SITE_URL).toBe('https://one.simplifyfinance.com.au')
  })

  // THE GUARD THAT STOPS IT COMING BACK. A hosting address here is invisible
  // for as long as the Vercel setting is present, and the day somebody deletes
  // that setting - or adds a new environment and forgets it - every client
  // link goes back to looking untrustworthy, with nothing on any screen saying
  // so. That silence is the whole fault, so it fails the ship instead.
  it('and it is never a hosting address again', () => {
    expect(DEFAULT_SITE_URL, 'a client link must never point at a hosting address')
      .not.toContain('vercel.app')
    expect(DEFAULT_SITE_URL).toMatch(/^https:\/\/[a-z0-9.-]+\.au$/)
  })

  it('and an empty setting is treated as no setting, not as an empty address', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   '
    expect(siteUrl()).toBe(DEFAULT_SITE_URL)
  })
})

describe('and the day a real domain is set', () => {
  it('every link follows it', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://one.simplifyfinance.com.au'
    expect(siteUrl()).toBe('https://one.simplifyfinance.com.au')
  })

  // A trailing slash in the Vercel box would otherwise turn every link into
  // https://one.simplifyfinance.com.au//proceed/... - which works, looks broken,
  // and is the sort of thing nobody notices until a client mentions it.
  it('even if somebody leaves a trailing slash in the box', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://one.simplifyfinance.com.au/'
    expect(siteUrl()).toBe('https://one.simplifyfinance.com.au')
    process.env.NEXT_PUBLIC_SITE_URL = 'https://one.simplifyfinance.com.au///'
    expect(siteUrl()).toBe('https://one.simplifyfinance.com.au')
  })
})

// THE GATE. Nobody types the address out longhand again.
describe('nothing in the portal writes the address out by hand', () => {
  const SKIP = ['node_modules', '.next', '_to_delete', '.git', 'tests']
  const sources: string[] = []
  ;(function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (SKIP.includes(name)) continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.tsx?$/.test(path)) sources.push(path)
    }
  })('.')

  it('finds the files to check', () => {
    expect(sources.length).toBeGreaterThan(100)
  })

  // TWO EXCEPTIONS: the definition itself, and this file - a test that bans a
  // string has to be allowed to name it. Everywhere else asks siteUrl().
  const ALLOWED = ['lib/site-url.ts', 'lib/site-url.test.ts']
  it('and only lib/site-url.ts says it out loud', () => {
    const guilty = sources.filter(f =>
      !ALLOWED.includes(f.replace(/^\.\//, '')) &&
      readFileSync(f, 'utf8').includes('simplify-finance-portal.vercel.app'))
    expect(guilty,
      `these write the address out instead of asking siteUrl():\n${guilty.join('\n')}`).toEqual([])
  })

  // AND NO OTHER HOSTING ADDRESS EITHER. 14 Nov 2026: the old one was banned
  // by name, so a NEW vercel.app address - a renamed project, a second
  // deployment - would have walked straight past this gate.
  it('and no hosting address of any name is written into the portal', () => {
    const guilty = sources.filter(f =>
      !ALLOWED.includes(f.replace(/^\.\//, '')) &&
      readFileSync(f, 'utf8').includes('vercel.app'))
    expect(guilty,
      `a client link must be built from siteUrl(), never a hosting address:\n${guilty.join('\n')}`)
      .toEqual([])
  })

  // THE HALF A CARELESS MIGRATION MISSES. The invitation email had the address
  // twice - once in the href, once as the words a person reads. Replacing the
  // href alone would have left the email telling new staff to go to an address
  // that no longer existed, with a link that worked. Both have to follow.
  it('and the words a person reads follow the link they are attached to', () => {
    const invite = readFileSync('app/api/invite-user/route.ts', 'utf8')
    expect(invite).toContain('${siteUrl()}/login')
    expect(invite).not.toContain('>simplify-finance-portal.vercel.app/login<')
  })

  // The portal used to phone its own front door over the internet with the
  // address typed in. Left alone, reassigning a credit officer would silently
  // stop telling SalesTrekker the day the domain moved.
  it('and the call the portal makes to itself asks too', () => {
    const src = readFileSync('app/api/reassign-credit-officer/route.ts', 'utf8')
    expect(src).toContain('fetch(`${siteUrl()}/api/notify-salestrekker`')
  })

  // The one that locks a person out rather than merely looking wrong.
  it('and the password reset link asks too', () => {
    const src = readFileSync('app/login/page.tsx', 'utf8')
    expect(src).toContain('redirectTo: `${siteUrl()}/reset-password`')
  })
})

describe('the login screen can actually use it', () => {
  // siteUrl() used to live in ready-link.ts, which imports node's crypto to
  // sign tokens. The login screen is a browser component; importing that file
  // would drag the signing code into the browser bundle. So the address lives
  // on its own and imports nothing.
  it('because site-url.ts imports nothing at all', () => {
    const src = readFileSync('lib/site-url.ts', 'utf8')
    expect(src).not.toMatch(/^\s*import\s/m)
  })

  it('and the login screen takes it from there, not from ready-link', () => {
    const src = readFileSync('app/login/page.tsx', 'utf8')
    expect(src).toContain("from '@/lib/site-url'")
    expect(src).not.toContain("siteUrl } from '@/lib/ready-link'")
  })
})
