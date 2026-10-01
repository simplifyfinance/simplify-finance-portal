import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { optionFromLink } from './bc-scenarios'

// THE LANDING PAGE A CLIENT ACTUALLY REACHES.
//
// Fabio, 1 Oct 2026: "Please esnure we test the proceed button as last time we
// went live and realised later on the lendig page was retruning 404 error for
// custoners AND make sure cant be used the hack into the system".
//
// The 404 had one cause and it is worth stating plainly, because every test
// here exists to stop it coming back in a new shape: the page read the deal
// with the VISITOR'S OWN session. A client opening a link from an email has no
// session, row level security returned nothing, and the page called notFound().
// It looked fine every time it was tested, because it was tested from a browser
// already signed in. Twenty-two deals proceeded in four weeks and exactly one
// of them was a client.
//
// These read the code rather than run a browser, which the ship's browser check
// does afterwards. What they protect is the REASONING: the admin read, the
// narrow select, the POST-only write, and the fact that nothing a stranger puts
// in the URL reaches the page or the database.

const flow = readFileSync('lib/proceed-flow.ts', 'utf8')
const page = readFileSync('app/proceed/[id]/page.tsx', 'utf8')
const action = readFileSync('app/proceed/[id]/actions.ts', 'utf8')

describe('the client is not signed in to anything', () => {
  it('reads the deal with the admin client, not the visitor session', () => {
    const load = flow.slice(flow.indexOf('export async function loadProceed'))
    const body = load.slice(0, load.indexOf('\n}'))
    expect(body).toContain('createSupabaseAdmin()')
    expect(body).not.toContain('createSupabaseServer')
  })

  // THE PRICE OF THE ADMIN KEY IS A NARROW SELECT. It ignores row level
  // security, so it asks for the few things the page draws and nothing else.
  // No fact find, no figures, no notes.
  it('and asks for the four things the page draws, nothing more', () => {
    const load = flow.slice(flow.indexOf('export async function loadProceed'))
    const select = load.slice(load.indexOf(".select('"), load.indexOf("')", load.indexOf(".select('")) + 1)
    expect(select).toContain('client_proceeded')
    for (const wide of ['*', 'bc_data', 'fact_find_data', 'lo_data', 'compliance_data', 'internal_notes']) {
      expect(select, `the proceed page is reading ${wide}`).not.toContain(wide)
    }
  })

  it('and a deal it cannot find is a 404 rather than a crash', () => {
    expect(flow).toContain('return { ok: false as const }')
    expect(page).toContain('notFound()')
  })
})

describe('nothing happens until a person presses the button', () => {
  // A mail scanner follows every link in an email before it reaches the inbox.
  // Opening the page used to move the deal a stage, allocate a credit officer
  // and email two people, with nobody having read the message.
  it('the write lives behind a server action, which is a POST', () => {
    expect(action).toContain("'use server'")
    expect(action).toContain('markProceeded(')
    // The page itself must not write on render.
    expect(page).not.toContain('markProceeded(')
  })

  it('and a failed write is told to the client rather than swallowed', () => {
    expect(action).toContain('return { ok: false')
    expect(flow).toContain('The deal would not save. Nothing was recorded.')
  })
})

describe('what a stranger can put in the URL', () => {
  // The option arrives in a query string. It reaches a database write and a
  // rendered page, which are the two things worth attacking.
  it('is checked into 1, 2 or nothing before it is used', () => {
    expect(page).toContain('optionFromLink(opt)')
    const bound = page.indexOf('confirmProceed.bind')
    const checked = page.indexOf('optionFromLink(opt)')
    expect(checked).toBeGreaterThan(-1)
    expect(bound, 'the option is bound before it is checked').toBeGreaterThan(checked)
  })

  it('and nothing off the link is ever rendered as text', () => {
    // The page prints the word Option and a digit we chose. If it ever prints
    // the raw query value, somebody else writes a sentence on our page.
    expect(page).not.toContain('{opt}')
    expect(page).not.toContain('{searchParams.opt}')
    expect(page).toContain('Option {option}')
  })

  it('refuses every shape that is not one of the two', () => {
    for (const bad of ['3', '0', '99', '-1', 'admin', '1 OR 1=1', "1'; drop table deals;--",
                       '<img src=x onerror=alert(1)>', 'javascript:alert(1)', '%3Cscript%3E',
                       '../../etc/passwd', '{"$ne":null}']) {
      expect(optionFromLink(bad), bad).toBe(null)
    }
  })

  // The option is bound on the SERVER when the page is built. A form field
  // would be one more thing a person can edit before it is posted.
  it('and the browser does not get to decide it', () => {
    expect(action).toContain('option: 1 | 2 | null')
    expect(action).not.toContain("formData.get('opt')")
    expect(action).not.toContain('_form.get')
  })

  // Only ever set. An older email with a single button must not wipe what a
  // client already told us.
  it('never clears a choice a client already made', () => {
    expect(flow).toContain('const chose = (option === 1 || option === 2)')
    expect(flow).toContain('? { client_chose_scenario: option')
    expect(flow).toContain(': {}')
  })

  // IT RECORDS A PREFERENCE, IT DOES NOT SWITCH THE SCENARIO. Swapping a deal's
  // whole borrowing capacity on the strength of a URL is the thing this must
  // never grow into.
  it('and never swaps the scenario off a link', () => {
    expect(flow).not.toContain('bc_scenarios')
    expect(flow).not.toContain('swapTo')
    expect(action).not.toContain('bc_data')
  })
})
