import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  ENTRIES, SECTIONS, entriesFor, readableDate, entryEmailHtml, entryPlainText,
  templatesWithNoEntry, WRITTEN_UP_LATER,
  isBullets, isCall, isFigure, isStep, stepNumber, searchText,
  isLong, wordCount, readingMinutes, LONG_WORDS,
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

// ---------------------------------------------------------------------------
// THE SHAPES AN ENTRY IS MADE OF
// ---------------------------------------------------------------------------
//
// 21 Oct 2026. Added so the lending options guide could be itself - six
// numbered steps, two watch-outs and a worked table - rather than forty bullet
// points. Every shape has to survive Word, which is what most of this checks.

describe('the blocks', () => {
  const all = ENTRIES.flatMap(e => e.body.map(b => ({ id: e.id, b })))

  it('are one of the five shapes and nothing else', () => {
    for (const { id, b } of all) {
      const known = typeof b === 'string' || isBullets(b) || isStep(b) || isCall(b) || isFigure(b)
      expect(known, `${id} carries a block that is none of the five shapes`).toBe(true)
    }
  })

  it('never leave a step, a callout or a figure empty', () => {
    for (const { id, b } of all) {
      if (isStep(b)) {
        expect(b.step.length, `${id} has a step with no title`).toBeGreaterThan(3)
        expect(b.body.length, `${id}: step "${b.step}" says nothing`).toBeGreaterThan(0)
      }
      if (isCall(b)) {
        expect(b.title.length, `${id} has a callout with no title`).toBeGreaterThan(2)
        expect(b.call.length, `${id}: callout "${b.title}" says nothing`).toBeGreaterThan(20)
      }
      if (isFigure(b)) {
        expect(b.head.length, `${id} has a figure with no columns`).toBeGreaterThan(1)
        expect(b.rows.length, `${id}: figure "${b.figure}" has no rows`).toBeGreaterThan(0)
        for (const r of b.rows) {
          expect(r.length, `${id}: a row in "${b.figure}" does not match the header`).toBe(b.head.length)
        }
        if (b.win !== undefined) {
          expect(b.win, `${id}: "${b.figure}" marks a row that is not there`).toBeLessThan(b.rows.length)
        }
      }
    }
  })

  // A callout sitting between two steps must not restart the numbering.
  it('number the steps straight through whatever sits between them', () => {
    const lo = ENTRIES.find(e => e.id === 'lending-options-step-by-step')!
    const seen: number[] = []
    lo.body.forEach((b, i) => { if (isStep(b)) seen.push(stepNumber(lo.body, i)) })
    expect(seen).toEqual(seen.map((_, i) => i + 1))
    expect(seen.length).toBeGreaterThan(4)
  })

  it('are all searchable, including the words inside a step', () => {
    const lo = ENTRIES.find(e => e.id === 'lending-options-step-by-step')!
    // "dropdown" lives inside a step, which the old flat() search could not see.
    expect(searchText(lo).toLowerCase()).toContain('dropdown')
    expect(entriesFor('all', 'dropdown').map(e => e.id)).toContain('lending-options-step-by-step')
    // And a word that only exists inside a figure.
    expect(entriesFor('all', '$575,326').map(e => e.id)).toContain('repayment-analysis')
  })
})

describe('the long ones', () => {
  it('know they are long, and the short ones do not', () => {
    const lo = ENTRIES.find(e => e.id === 'lending-options-step-by-step')!
    const short = ENTRIES.find(e => e.id === 'refinance-saving-second-angle')!
    expect(wordCount(lo)).toBeGreaterThan(LONG_WORDS)
    expect(isLong(lo)).toBe(true)
    expect(isLong(short)).toBe(false)
    expect(readingMinutes(lo)).toBeGreaterThanOrEqual(1)
  })

  // Nothing is hidden that a reader cannot get back.
  it('still carry every word in the email, collapsed or not', () => {
    const lo = ENTRIES.find(e => e.id === 'lending-options-step-by-step')!
    const text = entryPlainText(lo)
    expect(text).toContain('Set as recommended')
    expect(text).toContain('ACTION NEEDED')
    expect(text).toContain('1. You pick the recommendation')
  })
})

describe('the email the new shapes make', () => {
  const withEverything = ENTRIES.filter(e => e.body.some(b => isCall(b) || isFigure(b) || isStep(b)))

  it('has entries that use them at all', () => {
    expect(withEverything.length).toBeGreaterThan(2)
  })

  // ONLY THE PART THIS FILE WRITES. emailShell owns the charcoal band at the
  // top, which holds the logo and nothing else - artwork on a dark cell is the
  // one thing the rule allows, and it has shipped for weeks. Testing the whole
  // document would be testing the shell, and it would fail on that band.
  const blocksOf = (e: typeof ENTRIES[number]) => {
    const html = entryEmailHtml(e)
    const from = html.indexOf('Portal update')
    const to = html.indexOf('It is all in the portal')
    expect(from, `${e.id} email has no body`).toBeGreaterThan(-1)
    expect(to).toBeGreaterThan(from)
    return html.slice(from, to)
  }

  it('paints every background with a bgcolor attribute, the only thing Word reads', () => {
    for (const e of withEverything) {
      const body = blocksOf(e)
      // Every fill in a block is an attribute, never a CSS background: Word
      // reads the attribute and drops the style.
      expect(body, `${e.id} sets a CSS background`).not.toMatch(/style="[^"]*background/)
      expect(body).toContain('bgcolor=')
    }
  })

  it('never puts pale text on a dark cell', () => {
    for (const e of withEverything) {
      const body = blocksOf(e)
      // Nothing darker than a tint. A dark cell would come back black in Word
      // with the text painted black on top of it.
      expect(body, `${e.id} paints a dark cell`).not.toMatch(/bgcolor="#(0|1|2|3|4|5|6)[0-9A-Fa-f]{5}"/i)
    }
  })

  it('never uses rgba, which Word drops', () => {
    for (const e of ENTRIES) expect(entryEmailHtml(e)).not.toContain('rgba(')
  })

  it('carries the figures and the steps across', () => {
    const r = entryEmailHtml(ENTRIES.find(e => e.id === 'repayment-analysis')!)
    expect(r).toContain('$575,326')
    expect(r).toContain('22 years 6 months')
    // The winning row is marked, and in the done tint rather than anything new.
    expect(r).toContain('bgcolor="#EAFAF4"')
    const lo = entryEmailHtml(ENTRIES.find(e => e.id === 'lending-options-step-by-step')!)
    expect(lo).toContain('6.</span>')
    expect(lo).toContain('bgcolor="#FDEDED"')
  })
})

describe('the figures in an entry', () => {
  // The analysis table is the one thing here a client ever sees a version of,
  // so it has to reconcile with itself. 301 months staying, 270 keeping the
  // repayment - 31 months, which is 2 years 7 months, not the 2 years 6 the
  // rounded "25 yrs" in the first draft implied.
  it('reconcile - the years saved is the difference between the two rows', () => {
    const e = ENTRIES.find(x => x.id === 'repayment-analysis')!
    const fig = e.body.find(isFigure)!
    const months = (t: string) => {
      const y = /(\d+)\s*year/.exec(t), m = /(\d+)\s*month/.exec(t)
      return (y ? +y[1] * 12 : 0) + (m ? +m[1] : 0)
    }
    const stay = months(fig.rows[0][2])
    const keep = months(fig.rows[2][2])
    expect(stay - keep).toBe(31)
    expect(searchText(e)).toContain('2 years 7 months')
  })

  it('reconcile - the interest saved is the difference between the two rows', () => {
    const e = ENTRIES.find(x => x.id === 'repayment-analysis')!
    const fig = e.body.find(isFigure)!
    const money = (t: string) => Number(t.replace(/[^0-9]/g, ''))
    expect(money(fig.rows[0][3]) - money(fig.rows[2][3])).toBe(121627)
    expect(searchText(e)).toContain('$121,627')
  })
})

// THE SCENARIO THAT WAS PULLED MUST NOT BE PROMISED.
//
// 21 Oct 2026. The team email in Fabio's Downloads said there was a scenario of
// its own called Refinance repayment analysis. It was built, he said it did not
// belong on the BC, and it was reverted the same morning. An entry promising a
// template that is not in the picker sends a broker looking for ten minutes.
describe('nothing promises a template that does not exist', () => {
  it('does not name a Refinance repayment analysis scenario', () => {
    for (const e of ENTRIES) {
      expect(searchText(e).toLowerCase(), `${e.id} promises a scenario that was pulled`)
        .not.toContain('refinance repayment analysis')
    }
  })

  it('points at the switch under Templates instead', () => {
    const e = ENTRIES.find(x => x.id === 'repayment-analysis')!
    expect(searchText(e)).toContain('Refinance saving under Templates')
  })
})
