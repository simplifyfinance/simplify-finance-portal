import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// THE PAGES A CLIENT OPENS FROM AN EMAIL.
//
// 23 Sep 2026. Every client who pressed "Proceed" in a Borrowing Capacity or
// Lending Options email got a page saying it does not exist.
//
// WHY. The page read the deal using the VISITOR'S OWN session. A client has no
// session - they have never logged in to anything and never will. Row level
// security correctly returned nothing, so the page called notFound(). The same
// was true of the button: the update wrote no rows and reported "the deal would
// not save".
//
// WHY NOBODY SAW IT. It was only ever tested from a browser already signed in
// to the portal, and then the database answers. Fabio, 23 Sep 2026: "we tested
// this so many times."
//
// WHAT IT COST. In four weeks: 22 deals marked as proceeded, 20 of them by the
// office doing it by hand and ONE by an actual client. The team worked around
// it without knowing there was anything to work around.
//
// WHOSE FAULT. Mine, on 14 Sep 2026, when the document request inside
// markProceeded was given the admin client with a comment saying the client is
// not signed in - and the read eight lines above it was left as it was.
//
// This file exists so that never happens again on any client-facing page.

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')

const flow = () => read('lib', 'proceed-flow.ts')

// The pages a person with no login is meant to reach. Every one of these is on
// the middleware allowlist, which means nothing else is standing in front of
// them.
const CLIENT_PAGES = [
  ['app', 'proceed', '[id]', 'page.tsx'],
  ['app', 'ready', '[token]', 'page.tsx'],
  ['app', 'opportunity', '[token]', 'page.tsx'],
]

describe('a client with no login can actually use the page', () => {
  it('the deal is not read as the visitor', () => {
    // createSupabaseServer() is the visitor's own session. On these pages the
    // visitor is a client, and a client has no session.
    expect(flow()).not.toContain('createSupabaseServer')
  })

  it('the deal is read with the key that does not need a login', () => {
    const s = flow()
    const load = s.slice(s.indexOf('export async function loadProceed'), s.indexOf('export function stageFor'))
    expect(load).toContain('createSupabaseAdmin()')
  })

  it('pressing the button is not read as the visitor either', () => {
    // The page rendering and the button working are two separate failures.
    // Fixing one and not the other gives a client a page that looks fine and
    // then tells them it could not be saved.
    const s = flow()
    const mark = s.slice(s.indexOf('export async function markProceeded'))
    expect(mark).toContain('createSupabaseAdmin()')
  })

  it('every client-facing page still exists where the middleware expects it', () => {
    for (const p of CLIENT_PAGES) {
      expect(existsSync(join(root, ...p)), p.join('/')).toBe(true)
    }
  })

  it('the middleware still lets them through without a login', () => {
    const mw = read('middleware.ts')
    for (const path of ['/proceed', '/ready', '/opportunity']) {
      expect(mw, `${path} is no longer public`).toContain(`pathname.startsWith('${path}')`)
    }
  })
})

describe('reading without a login costs as little as possible', () => {
  it('the page asks for the few things it draws, not the whole deal', () => {
    // Reading with the admin key ignores row level security, so the SELECT is
    // the only thing deciding what a stranger with a deal id could see. It asks
    // for a first name and two flags. Nothing else.
    const s = flow()
    const load = s.slice(s.indexOf('export async function loadProceed'), s.indexOf('export function stageFor'))
    const select = load.slice(load.indexOf('.select('), load.indexOf('.eq('))
    expect(select).toContain('first_name')
    expect(select).not.toContain('*')
    for (const forbidden of ['fact_find_data', 'bc_data', 'lo_data', 'compliance_data', 'internal_notes']) {
      expect(select, `the client page must never read ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('hands back one client, not a list of one', () => {
    // A joined table comes back as an array when the select names its columns
    // and as an object when it is `*`. Narrowing the query changed that shape
    // under the page and the email preview, which both read
    // deal.clients.first_name. Typecheck caught it; this keeps it caught.
    const s = flow()
    const load = s.slice(s.indexOf('export async function loadProceed'), s.indexOf('export function stageFor'))
    expect(load).toContain('Array.isArray(row.clients)')
  })

  it('a deal that does not exist still shows nothing', () => {
    // The page must fail closed. A missing deal is a 404, not a blank greeting.
    const page = read('app', 'proceed', '[id]', 'page.tsx')
    expect(page).toContain('notFound()')
    expect(page).toMatch(/if \(!result\.ok\)/)
  })
})

describe('both steps, and the screen after the button', () => {
  it('BC and LO both come through the same two functions', () => {
    // There are two landing pages - Borrowing Capacity and Lending Options -
    // and a third screen after the button is pressed. All three are this one
    // page, so all three were broken and all three are fixed together.
    const page = read('app', 'proceed', '[id]', 'page.tsx')
    expect(page).toContain('loadProceed(')
    expect(page).toContain('stageFor(')
    expect(page).toContain('hasProceeded(')
  })

  it('the stage still comes from the deal when the link does not say', () => {
    const s = flow()
    expect(s).toMatch(/if \(hint === 'LO'\) return 'LO'/)
    expect(s).toMatch(/return deal\?\.client_proceeded \? 'LO' : 'BC'/)
  })
})
