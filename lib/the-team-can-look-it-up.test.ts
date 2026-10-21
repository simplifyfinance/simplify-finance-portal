import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  ENTRIES, SECTIONS, entriesFor, readableDate, entryEmailHtml, entryPlainText,
  templatesWithNoEntry, WRITTEN_UP_LATER,
} from './knowledge-base'
import { TEMPLATE_LABELS } from './templates'

// THE TEAM CAN LOOK IT UP.
//
// 21 Oct 2026. Every team email so far has existed in exactly one place -
// Fabio's sent items. Three weeks later a broker who cannot remember how a top
// up works has nowhere to look, and anybody hired next month has no record that
// any of it happened.

describe('the entries', () => {
  it('each sit in a section the page draws', () => {
    const keys = SECTIONS.map(s => s.key)
    for (const e of ENTRIES) expect(keys, `${e.id} is in no section`).toContain(e.section)
  })

  // The id is the link somebody pastes into a chat.
  it('have ids that are unique and safe in a URL', () => {
    const ids = ENTRIES.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it('carry a readable date', () => {
    for (const e of ENTRIES) expect(e.on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(readableDate('2026-10-21')).toBe('21 October 2026')
  })

  it('say something before they say everything', () => {
    for (const e of ENTRIES) {
      expect(e.title.length, `${e.id} has no title`).toBeGreaterThan(3)
      expect(e.lead.length, `${e.id} has no lead`).toBeGreaterThan(30)
    }
  })
})

describe('finding one', () => {
  it('filters by section', () => {
    const t = entriesFor('templates')
    expect(t.length).toBeGreaterThan(0)
    expect(t.every(e => e.section === 'templates')).toBe(true)
  })

  it('searches the body, not just the title', () => {
    expect(entriesFor('all', 'dollar for dollar').length).toBeGreaterThan(0)
    expect(entriesFor('all', 'zzzz nothing').length).toBe(0)
  })
})

describe('the email is the same words', () => {
  const e = ENTRIES[0]
  const html = entryEmailHtml(e)

  // Written twice they drift, and the copy in somebody's inbox is the one they
  // act on.
  it('is built from the entry on screen', () => {
    expect(html).toContain(e.title)
    expect(html).toContain(e.lead.slice(0, 40))
    expect(entryPlainText(e)).toContain(e.lead)
  })

  it('points back at the portal', () => {
    expect(html).toContain('under Knowledge base')
  })

  // An internal note forwarded outside must not read as advice to anybody.
  it('says what it is and is not', () => {
    expect(html).toContain('Not advice, and not for sending to clients')
  })

  // Word paints a background only from bgcolor on a td or table, drops colour
  // set on a <p>, and paints pale text black on a dark cell.
  it('uses the shell every other email uses', () => {
    const src = readFileSync('lib/knowledge-base.ts', 'utf8')
    expect(src).toContain("from './email-shell'")
    expect(html).not.toContain('rgba(')
    expect(html).toContain('bgcolor=')
  })
})

describe('the one thing that is automatic', () => {
  // Fabio asked for the whole thing to be automatic. 93 ships in 30 days
  // touched something client facing, and a prompt that fires 93 times and is
  // right 10 times trains everybody to click past it. This is the only trigger
  // narrow enough to be right every time: five new templates in thirty days.
  it('names a new scenario nobody has written up', () => {
    const out = templatesWithNoEntry({ ...TEMPLATE_LABELS, brand_new_thing: 'Brand new thing' })
    expect(out).toContain('Brand new thing')
  })

  it('is quiet on the repo as it stands', () => {
    expect(templatesWithNoEntry(TEMPLATE_LABELS)).toEqual([])
  })

  // The backlog is a decision somebody made, listed once where it can be worked
  // through - not twelve lines on every audit until somebody stops reading it.
  it('holds the templates that predate the page in one place', () => {
    expect(WRITTEN_UP_LATER.length).toBeGreaterThan(0)
    for (const name of WRITTEN_UP_LATER) {
      expect(Object.values(TEMPLATE_LABELS), `${name} is not a scenario any more`).toContain(name)
    }
  })

  it('asks again the moment a name is taken off that list', () => {
    const shortened = WRITTEN_UP_LATER.slice(1)
    const dropped = WRITTEN_UP_LATER[0]
    const hay = ENTRIES.map(e => [e.title, e.lead, ...e.body.flat()].join(' ')).join(' ').toLowerCase()
    expect(shortened).not.toContain(dropped)
    expect(hay.includes(dropped.toLowerCase())).toBe(false)
  })

  it('reports and never blocks', () => {
    const audit = readFileSync('scripts/audit.sh', 'utf8')
    expect(audit).toContain('Scenarios the knowledge base has never mentioned')
    expect(readFileSync('scripts/ship.sh', 'utf8')).not.toContain('audit.sh')
  })
})

describe('somebody can get to it', () => {
  it('is in the sidebar, not just at a URL', () => {
    const nav = readFileSync('components/Sidebar.tsx', 'utf8')
    expect(nav).toContain('"/knowledge-base"')
    expect(nav).toContain('Knowledge base')
  })

  it('has a page and a title', () => {
    expect(readFileSync('app/(app)/knowledge-base/page.tsx', 'utf8')).toContain('Knowledge base')
    expect(readFileSync('app/(app)/knowledge-base/layout.tsx', 'utf8')).toContain("title: 'Knowledge base'")
  })
})
