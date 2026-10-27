// A CLIENT DOES NOT HAVE ACCESS TO THE PORTAL.
//
// 27 Oct 2026. Fabio, on the page a client opens to answer the questions in a
// borrowing capacity email: "thats really important cleints dont have access to
// the portal".
//
// HE WAS RIGHT AND CHECKING IT FOUND SOMETHING. The first version of that page
// took the whole fact find as a prop so the form could print the current
// address above "where did you live before September 2024". A client
// component's props are serialised into the page source - so every income
// figure, every liability, both applicants' dates of birth and everything else
// on the file was sitting there, readable by anybody holding the link, to
// render four strings.
//
// Nothing was exposed in the wild; it never shipped. This file is so it cannot
// come back, because the natural way to write that page is the wrong way.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')

const PAGE = read('app', 'answers', '[token]', 'page.tsx')
const FORM = read('app', 'answers', '[token]', 'AnswersForm.tsx')
const FLOW = read('lib', 'answers-flow.ts')
const ACTIONS = read('app', 'answers', '[token]', 'actions.ts')

const codeOnly = (src: string) =>
  src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('nothing but the question crosses to the browser', () => {
  it('THE FACT FIND IS NEVER A PROP', () => {
    // This is the one. Everything else in this file is a consequence of it.
    expect(codeOnly(FORM), 'the whole fact find is being handed to the browser again')
      .not.toContain('factFind')
    expect(codeOnly(PAGE), 'the page is passing a record to the client component')
      .not.toContain('factFind={')
  })

  it('and neither is the deal', () => {
    for (const [name, src] of [['the page', PAGE], ['the form', FORM]] as const) {
      expect(codeOnly(src), `${name} is handling the deal record`).not.toContain('deal={')
      expect(codeOnly(src), `${name} reads bc_data`).not.toContain('bc_data')
      expect(codeOnly(src), `${name} reads lo_data`).not.toContain('lo_data')
    }
  })

  it('what it gets is sentences, built on the server', () => {
    expect(FLOW).toContain('export type ClientQuestion')
    expect(FLOW).toContain('known: string[]')
    expect(FORM).toContain('questions: ClientQuestion[]')
    expect(FORM).toContain('<Known rows={q.known} />')
  })

  it('and not the line written for the broker', () => {
    // "25 months of the 36 a lender needs" is our business, not something to
    // put in front of a client.
    expect(FLOW).toContain('// NOT q.why.')
    const shape = FLOW.slice(FLOW.indexOf('function forTheClient'), FLOW.indexOf('function knownAddresses'))
    expect(shape, 'the broker-facing reason is being sent to the client').not.toContain('why: q.why')
  })

  it('no figure from the deal reaches that page at all', () => {
    // No loan amount, no rate, no repayment, no commission. A client answering
    // where they lived in 2023 has no business being shown any of it.
    for (const word of ['loanAmount', 'repayment', 'commission_split', 'lenderName', 'money(']) {
      expect(codeOnly(PAGE), `the page prints ${word}`).not.toContain(word)
      expect(codeOnly(FORM), `the form prints ${word}`).not.toContain(word)
    }
  })
})

describe('and it is not a way into anything else', () => {
  it('there is no login, no session and no cookie', () => {
    for (const src of [PAGE, FORM, ACTIONS]) {
      expect(codeOnly(src)).not.toContain('signIn')
      expect(codeOnly(src)).not.toContain('cookies(')
    }
  })

  it('the key that reads the deal never leaves the server', () => {
    // createSupabaseAdmin() is server-only. A client component importing it
    // would put the service role key in the page source.
    expect(codeOnly(FORM), 'the browser is being handed the admin key')
      .not.toContain('createSupabaseAdmin')
    expect(codeOnly(FORM)).not.toContain('supabase')
    expect(FORM.startsWith("'use client'")).toBe(true)
    expect(FLOW).toContain('createSupabaseAdmin')
  })

  it('and the only deal it can touch is the one inside the link', () => {
    // The deal id is signed into the token. There is no deal id in the URL, no
    // deal id in a form field, and nothing the browser sends can change which
    // record is written.
    expect(FLOW).toContain('payload.dealId')
    expect(codeOnly(FORM), 'the browser is choosing which deal to write to')
      .not.toContain('dealId')
    const save = FLOW.slice(FLOW.indexOf('export async function saveAnswers'))
    expect(save).toContain('verifyAnswers(token, today)')
    expect(save.slice(0, save.indexOf('patchDealColumn')))
      .toContain('if (!payload) return')
  })

  it('the page reads and the button writes, never the other way round', () => {
    // A mail scanner following the link on its way to the inbox must not
    // record answers nobody typed. The Proceed page learned this in August.
    expect(PAGE).toContain('loadAnswers(token)')
    expect(codeOnly(PAGE)).not.toContain('saveAnswers(')
    expect(ACTIONS).toContain("'use server'")
  })
})
