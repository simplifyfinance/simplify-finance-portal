import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

// NO ROUTE SENDS MAIL, OR USES THE MASTER KEY, WITHOUT ASKING WHO IS CALLING.
//
// 23 Sep 2026. Two routes were found open to anyone on the internet:
//
//   /api/invite-user   created an account with the MASTER KEY, taking the role
//                      from the request. Anyone could have made themselves an
//                      admin - every deal, every client, every commission.
//   /api/send-lo-email took an address and a block of HTML and sent it from
//                      simplifyfinance.com.au, cc'ing info@, with a real
//                      broker as reply-to.
//
// Neither was reachable from the portal. Both were reachable from the internet.
// Checked against the live book that night: sixteen accounts, all our own
// people. The door was open; nobody walked through it.
//
// THE REASON BOTH EXISTED IS THE SAME. middleware.ts guards the site and
// deliberately skips /api - so an API route is protected only if it protects
// itself, and nothing said so. Two were written by somebody who did not know
// that, and nothing noticed for months.
//
// This is what notices. It reads every route in the portal, decides which ones
// can do damage, and fails the ship if one of them lets a stranger in.
//
// Fabio, 23 Sep 2026: "how privacy and security is important to us, we are a
// financial services business."

const API = join(__dirname, '..', 'app', 'api')

function routeFiles(): Array<{ name: string; src: string }> {
  const out: Array<{ name: string; src: string }> = []
  for (const dir of readdirSync(API)) {
    for (const f of ['route.ts', 'route.tsx']) {
      const p = join(API, dir, f)
      if (existsSync(p)) out.push({ name: dir, src: readFileSync(p, 'utf8') })
    }
  }
  return out
}

// CAN THIS ROUTE DO DAMAGE IF A STRANGER CALLS IT?
const sendsMail   = (s: string) => /api\.resend\.com|resend\.emails\.send|new Resend\(/.test(s)
const usesMasterKey = (s: string) => /createSupabaseAdmin\(/.test(s)
// A DOCUMENT OF SOMEBODY'S FINANCES IS THE SAME KIND OF DAMAGE AS AN EMAIL.
// The summary, the compliance record, the broker notes and the assessment form
// each put a client's whole position on a page. A route that hands one out is
// as serious as one that sends mail as us.
const buildsADocument = (s: string) => /PDFDocument|renderToStream|@react-pdf/.test(s)
// And reading the book at all - deals, clients, a fact find.
const readsTheBook = (s: string) =>
  /from\('deals'\)|from\('clients'\)|fact_find_data|compliance_data|bc_data|lo_data/.test(s)
const dangerous   = (s: string) => sendsMail(s) || usesMasterKey(s) || buildsADocument(s) || readsTheBook(s)

// WHAT COUNTS AS ASKING WHO IS CALLING.
//
// Either a signed-in user, or a signed link - the ones a client clicks in an
// email carry a signature this portal made, and a made-up one is refused.
const checksTheUser  = (s: string) => /auth\.getUser\(\)/.test(s)
const checksAToken   = (s: string) => /verifyReady\(|verifyOpportunity\(|verifyToken\(/.test(s)
const asksWhoIsCalling = (s: string) => checksTheUser(s) || checksAToken(s)

describe('every route that can do damage asks who is calling', () => {
  it('finds the routes at all', () => {
    // A test that silently reads nothing passes for ever and protects nothing.
    const all = routeFiles()
    expect(all.length).toBeGreaterThan(20)
    expect(all.filter(r => dangerous(r.src)).length).toBeGreaterThan(8)
  })

  it('no route sends email without asking', () => {
    const open = routeFiles().filter(r => sendsMail(r.src) && !asksWhoIsCalling(r.src)).map(r => r.name)
    expect(open, `these routes send email to anyone who asks: ${open.join(', ')}`).toEqual([])
  })

  it('no route hands out a client document without asking', () => {
    const open = routeFiles().filter(r => buildsADocument(r.src) && !asksWhoIsCalling(r.src)).map(r => r.name)
    expect(open, `these routes build a client's financial position as a document for anyone who asks: ${open.join(', ')}`).toEqual([])
  })

  it('no route reads the book without asking', () => {
    // Deals, clients, fact finds. The database rules would refuse a stranger
    // anyway - but only while the query keeps using the caller's own session.
    // An explicit check cannot be removed by changing a query.
    const open = routeFiles().filter(r => readsTheBook(r.src) && !asksWhoIsCalling(r.src)).map(r => r.name)
    expect(open, `these routes read client data without asking who is calling: ${open.join(', ')}`).toEqual([])
  })

  it('no route uses the master key without asking', () => {
    // The master key ignores every row level security policy in the database.
    const open = routeFiles().filter(r => usesMasterKey(r.src) && !asksWhoIsCalling(r.src)).map(r => r.name)
    expect(open, `these routes use the master key unguarded: ${open.join(', ')}`).toEqual([])
  })

  it('inviting somebody is an admin job, not just a signed-in one', () => {
    // A broker who can create an admin is the same hole wearing a login.
    const invite = routeFiles().find(r => r.name === 'invite-user')!
    expect(invite.src).toContain('auth.getUser()')
    expect(invite.src).toMatch(/can\(profile\?\.role, 'manageTeam'\)/)
  })

  // WHERE THE CHECK CAN LIVE.
  //
  // Two shapes, both correct, and an early version of this test called both of
  // them a hole:
  //   1. auth.getUser() written straight into the handler.
  //   2. a small helper above it - `allowed()`, `requireUser()` - CALLED as the
  //      first thing the handler does.
  // A test that cannot tell a definition from a call teaches people to ignore
  // it, which is worse than not having it.
  function guardMarkers(src: string): string[] {
    const markers = ['auth.getUser()']
    for (const m of src.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)) {
      const name = m[1]
      const body = src.slice(m.index || 0, (m.index || 0) + 900)
      if (body.includes('auth.getUser()')) markers.push(`${name}(`)
    }
    return markers
  }

  function firstGuard(body: string, markers: string[]): number {
    const found = markers.map(m => body.indexOf(m)).filter(n => n >= 0)
    return found.length ? Math.min(...found) : -1
  }

  it('the check comes BEFORE the damage, not after', () => {
    // A guard underneath the send is a guard that has already sent.
    for (const r of routeFiles()) {
      if (!dangerous(r.src) || !checksTheUser(r.src)) continue
      const handler = r.src.search(/export async function (POST|GET|PUT|PATCH|DELETE)/)
      if (handler < 0) continue
      const body = r.src.slice(handler)

      const guard = firstGuard(body, guardMarkers(r.src))
      expect(guard, `${r.name}: nothing in the handler checks who is calling`).toBeGreaterThanOrEqual(0)

      const mail  = body.search(/api\.resend\.com|resend\.emails\.send/)
      const admin = body.indexOf('createSupabaseAdmin(')
      const damage = [mail, admin].filter(n => n >= 0)
      if (damage.length) {
        expect(guard, `${r.name}: the check is after the thing it is meant to guard`)
          .toBeLessThan(Math.min(...damage))
      }
    }
  })

  it('the check is near the top of the handler, not buried in it', () => {
    // A guard twenty lines into the work has let twenty lines of work happen.
    // Generous, because reading the request body and refusing missing fields
    // legitimately comes first.
    const ROOM_TO_READ_THE_REQUEST = 700
    for (const r of routeFiles()) {
      if (!dangerous(r.src) || !checksTheUser(r.src)) continue
      const handler = r.src.search(/export async function (POST|GET|PUT|PATCH|DELETE)/)
      if (handler < 0) continue
      const guard = firstGuard(r.src.slice(handler), guardMarkers(r.src))
      expect(guard, `${r.name}: the check is buried too far into the handler`)
        .toBeLessThan(ROOM_TO_READ_THE_REQUEST)
    }
  })

  it('the route that could send anything to anyone is gone', () => {
    // /api/send-lo-email. Nothing in the portal ever called it. If lending
    // options are emailed one day it gets built the way send-template-email is:
    // signed in, built on the server from a fixed template, and through the
    // test-deal rule so a robot deal can never reach a real client.
    expect(routeFiles().some(r => r.name === 'send-lo-email')).toBe(false)
  })
})

describe('why this test exists', () => {
  it('the site guard really does skip the API', () => {
    // If this ever stops being true, this whole file is belt and braces rather
    // than the only thing standing there - which is worth knowing either way.
    const mw = readFileSync(join(__dirname, '..', 'middleware.ts'), 'utf8')
    expect(mw).toMatch(/matcher/)
    expect(mw).toContain('api')
  })
})
