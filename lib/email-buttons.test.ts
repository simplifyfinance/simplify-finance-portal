import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { ctas } from './email-buttons'

// THE BUTTON AT THE BOTTOM OF EVERY CLIENT EMAIL.
//
// 15 Sep 2026. Two buttons of equal weight, so neither was THE action, and the
// primary one was white text on #2DBEFF - a contrast ratio of 2.1 to 1, well
// under the 4.5 needed to read comfortably. It looked like a pale wash rather
// than something you press.
//
// Fabio, 15 Sep 2026: "how do we make it obvious it is a button and they need
// to press". One button, charcoal on the blue at 5.95 to 1, an arrow, a line
// above telling the client to press it, and "book a call" demoted to a link so
// it stops competing.
const html = () => ctas('https://cal.example/simplify', 'https://portal.example/proceed/deal-1')

describe('one button, not two', () => {
  it('has exactly one coloured button cell', () => {
    expect(html().match(/bgcolor="#2DBEFF"/g)?.length).toBe(1)
  })

  it('no longer builds a second charcoal button', () => {
    expect(html()).not.toContain('bgcolor="#343333"')
  })

  it('offers the call as a plain underlined link instead', () => {
    const t = html()
    expect(t).toMatch(/<a href="https:\/\/cal\.example\/simplify"[^>]*text-decoration:underline/)
    expect(t).toContain('book a call')
  })
})

describe('it reads as something you press', () => {
  it('puts the charcoal on the blue, not white', () => {
    // White on #2DBEFF is 2.1:1. #343333 on it is 5.95:1.
    expect(html()).toMatch(/bgcolor="#2DBEFF"[\s\S]*?color:#343333/)
    expect(html()).not.toMatch(/bgcolor="#2DBEFF"[\s\S]*?color:#ffffff/i)
  })

  it('carries an arrow', () => {
    expect(html()).toContain('&rarr;')
  })

  it('tells the client to press it', () => {
    expect(html()).toContain('Ready to go ahead?')
    expect(html()).toMatch(/press the button below/i)
  })

  it('is bold and big enough to be a target', () => {
    expect(html()).toMatch(/font-weight:700/)
    expect(html()).toMatch(/padding:12px 22px/)
  })
})

describe('where the links point - unchanged', () => {
  it('sends the button to the proceed page when there is one', () => {
    expect(ctas('https://cal.example/x', 'https://portal.example/proceed/deal-1'))
      .toContain('href="https://portal.example/proceed/deal-1"')
  })

  it('falls back to the calendar when there is no proceed link', () => {
    const t = ctas('https://cal.example/x')
    expect(t).toContain('href="https://cal.example/x"')
    expect(t).not.toContain('undefined')
  })

  it('always sends the call link to the calendar', () => {
    expect(html()).toContain('href="https://cal.example/simplify"')
  })
})

describe('Outlook on Windows', () => {
  it('paints the button from a bgcolor attribute on a cell, never on the link', () => {
    const t = html()
    // Word ignores a background on an inline anchor. This is the bug that made
    // these arrive as bare blue text.
    expect(t).toMatch(/<td bgcolor="#2DBEFF"[^>]*background:#2DBEFF/)
    expect(t).not.toMatch(/<a [^>]*background/)
  })
})

describe('the Lending Options email puts it above the table', () => {
  it('builds the buttons before the lender comparison, not after it', () => {
    // Fabio, 15 Sep 2026 - the client had to scroll past the whole comparison
    // before anything told them how to reply.
    const src = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')
    const buttons = src.indexOf('body += ctas(')
    const table = src.indexOf('body += buildLenderTable(')
    expect(buttons, 'ctas() is not called in the LO email').toBeGreaterThan(-1)
    expect(table, 'buildLenderTable() is not called in the LO email').toBeGreaterThan(-1)
    expect(buttons, 'the buttons have drifted back below the table').toBeLessThan(table)
  })
})
