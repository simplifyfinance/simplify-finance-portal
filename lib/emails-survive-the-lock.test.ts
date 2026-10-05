import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { TEMPLATES } from './milestone-emails'

// THE CLIENT EMAILS ARE OUTSIDE THE LOCK, AND THE BROWSER NEVER WRITES ONE.
//
// Two separate promises, both of which have already been broken once in this
// codebase by somebody who meant well.
//
// THE LOCK. TabLock wraps a locked tab in `<fieldset disabled>`, which disables
// every control underneath it with no way to re-enable one by nesting. The three
// PDFs learned this on 29 Sep - a lodged deal could not open its own documents,
// and lodgement is exactly when they are wanted. A formal approval email has the
// same shape: the deal is nearly always lodged by the time the bank approves it,
// so an email button inside a tab would be dead on arrival.
//
// THE EMAIL. Everything that goes to a client under our licence number is built
// on the server from the deal. The browser posts which deal, which template,
// which blocks were ticked, the free text and the bank's letter - and nothing
// else. If the subject or the HTML could be posted, a stale tab could send a
// client last week's loan amount, and a developer console could send anything at
// all.

const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
const ui = readFileSync('components/MilestoneEmails.tsx', 'utf8')
const lock = readFileSync('components/TabLock.tsx', 'utf8')
const route = readFileSync('app/api/send-milestone-email/route.ts', 'utf8')

describe('the emails are outside the lock', () => {
  it('the lock really does disable everything under it', () => {
    expect(lock).toContain('<fieldset disabled')
  })

  it('is on the page at all', () => {
    expect(page).toContain('<MilestoneEmails')
  })

  it('is drawn above the tabs, not inside one', () => {
    const emails = page.indexOf('<MilestoneEmails')
    const locked = page.indexOf('<TabLock')
    expect(emails).toBeGreaterThan(-1)
    expect(locked).toBeGreaterThan(-1)
    expect(emails, 'a client email inside TabLock is unreachable the moment the deal is lodged')
      .toBeLessThan(locked)
  })
})

describe('the buttons do not collide with the tabs', () => {
  // The same trap the PDFs fell into: two controls with one name, a centimetre
  // apart, and neither a robot nor a person can say which was meant.
  // The five tab names moved into components/DealTabCards.tsx when the tab
  // row became cards - 5 Oct 2026. Same list, read from its new home.
  const tabCards = readFileSync('components/DealTabCards.tsx', 'utf8')
  const tabLabels = [...tabCards.matchAll(/label: '([^']+)' \}/g)].map(m => m[1])

  it('found the tab labels, so the test below is testing something', () => {
    expect(tabLabels).toContain('Fact Find')
    expect(tabLabels.length).toBeGreaterThanOrEqual(5)
  })

  it('no email is named the same as a tab', () => {
    const clash = TEMPLATES.map(t => t.name).filter(n => tabLabels.includes(n))
    expect(clash).toEqual([])
  })
})

describe('the browser posts the deal, never the email', () => {
  // Everything the component puts on the form, read off the component itself.
  const posted = [...ui.matchAll(/body\.(?:set|append)\('([^']+)'/g)].map(m => m[1])

  it('found the send, so the test below is testing something', () => {
    expect(posted.length).toBeGreaterThan(3)
    expect(posted).toContain('dealId')
    expect(posted).toContain('template')
  })

  it('posts nothing but the deal, the choices and the letter', () => {
    const allowed = ['dealId', 'template', 'overrides', 'extra', 'expiry',
                     'insuranceAmount', 'brandId', 'file']
    const extra = posted.filter(k => !allowed.includes(k))
    expect(extra, 'anything else on this form is something a browser could put in a client email')
      .toEqual([])
  })

  it('never posts the words that go to the client', () => {
    for (const forbidden of ['html', 'subject', 'text', 'to', 'cc', 'from', 'replyTo']) {
      expect(posted, `${forbidden} must be decided by the server, never sent up from a page`)
        .not.toContain(forbidden)
    }
  })

  // AND THE SERVER MUST NOT READ THEM EITHER. A route that accepted them would
  // make the guard above a formality - the next component could simply post one.
  it('and the route would not use them if they arrived', () => {
    for (const forbidden of ['html', 'subject', 'to', 'cc']) {
      expect(route.includes(`form.get('${forbidden}')`),
        `the send route reads ${forbidden} off the request`).toBe(false)
    }
    // The email itself comes from the one function the preview also calls.
    expect(route).toContain('assembleMilestoneEmail')
  })
})

describe('the letter is compulsory', () => {
  it('is refused by the server, not only greyed out on the screen', () => {
    expect(route).toContain("form.getAll('file')")
    expect(route).toMatch(/if \(!files\.length\)[\s\S]{0,400}status: 400/)
  })
})
