import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'

// WHAT THE BROWSER TAB SAYS, AND WHO IS LOOKING AT IT.
//
// 2 Oct 2026. Two faults, both visible in a screenshot Fabio sent:
//
//   1. The icon was Vercel's placeholder triangle, still sitting in
//      app/favicon.ico from the day the project was created. Every tab of the
//      portal was advertising the hosting company.
//
//   2. Every tab said the same eleven words - "Simplify Finance Portal" - so
//      with four open you could not tell them apart. A browser cuts a title off
//      from the RIGHT, so the only part that survived was the identical part.
//
// The fix is a template, and the thing a template can get wrong is reaching
// further than it should. ONE is internal - Fabio, 30 Sep: "one is internal
// only!" - and three of these routes are opened by clients from an email.

const read = (p: string) => readFileSync(p, 'utf8')

// A COMMENT EXPLAINING A RULE IS NOT A BREACH OF IT.
//
// Written after this very test refused the ship twice over its own notes: the
// deal page explains that the template adds " · ONE", and the proceed page has
// a comment reading "WHICH ONE THEY PRESSED". scripts/check-email-html.sh
// learned the same lesson in September, and so did a SQL guard the week before.
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, ' ')      // /* ... */ and {/* ... */}
         .replace(/(^|[^:])\/\/.*$/gm, '$1 ')      // // ... but not https://


describe('a client never sees the word ONE', () => {
  // The root is what the client-facing pages inherit. If ONE ever gets put
  // here, it reaches ready, opportunity and proceed - the pages strangers open.
  it('the root tab says the company, not the product', () => {
    const root = read('app/layout.tsx')
    expect(root).toContain('title: "Simplify Finance"')
    expect(root).not.toMatch(/title:\s*\{[^}]*template/)
  })

  it('and the three pages a client opens say Simplify Finance', () => {
    for (const p of ['app/ready/[token]/page.tsx', 'app/opportunity/[token]/page.tsx']) {
      expect(read(p), `${p} stopped saying Simplify Finance`).toContain("title: 'Simplify Finance'")
    }
    // proceed has no title of its own, so it inherits the root - which is only
    // safe for as long as the root stays the company. Checked above. What must
    // not appear is a title here that says ONE.
    expect(code('app/proceed/[id]/page.tsx')).not.toMatch(/title[^\n]*ONE/)
  })
})

describe('everything behind the login is ONE', () => {
  it('the template lives on the internal group, and nowhere above it', () => {
    const g = read('app/(app)/layout.tsx')
    expect(g).toContain('template: "%s · ONE"')
    expect(g).toContain('default: "ONE by Simplify"')
  })

  // THE GATE. A page added next month with no title of its own falls back to
  // "ONE by Simplify" and becomes indistinguishable from every other tab - the
  // exact fault this ship exists to fix, quietly returning one page at a time.
  it('and every internal page names itself', () => {
    const pages: string[] = []
    ;(function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next') continue
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (name === 'page.tsx') pages.push(path)
      }
    })('app/(app)')

    expect(pages.length).toBeGreaterThan(10)

    // A NAME, NOT MERELY A metadata EXPORT. `title: ''` is an export and is not
    // a name; this wanted a non-empty one. Found by breaking it on purpose.
    const HAS_NAME = (src: string) =>
      /generateMetadata/.test(src) ||
      /title:\s*['"`][^'"`]+['"`]/.test(src)

    // A page is named if it says so, or if a section above it does - metadata is
    // inherited, so clients/[id] showing "Clients · ONE" has a name rather than
    // having forgotten one.
    //
    // THE WALK STOPS BEFORE app/(app) ITSELF. That layout holds the fallback
    // every page inherits, so counting it would mark every page as named and
    // this check would pass forever while doing nothing. Found by adding an
    // unnamed page on purpose and watching the test stay green.
    const GROUP = join('app', '(app)')
    const named = (page: string) => {
      if (HAS_NAME(code(page))) return true
      let dir = dirname(page)
      while (dir !== GROUP && dir.startsWith(GROUP)) {
        const layout = join(dir, 'layout.tsx')
        if (existsSync(layout) && HAS_NAME(code(layout))) return true
        dir = dirname(dir)
      }
      return false
    }
    const nameless = pages.filter(p => !named(p))

    expect(nameless,
      `these would all show the same tab:\n${nameless.join('\n')}`).toEqual([])
  })

  it('and the deal tab carries the client, because that is what tells five deals apart', () => {
    const src = code('app/(app)/deals/[id]/page.tsx')
    expect(src).toContain('data?.deal_name')
    // The group's template punctuates it. Doing it here as well would give
    // "Boyton · ONE · ONE", which is the kind of thing two homes produce.
    expect(src).not.toContain('Simplify Finance`')
    expect(src).not.toContain('· ONE')
  })
})

describe("the tab icon is ours", () => {
  it('the root icon exists and is a real multi-size icon', () => {
    const ico = readFileSync('app/favicon.ico')
    // ICO header: bytes 4-5 are how many images are inside. A single-size icon
    // looks soft in the places a browser asks for a bigger one.
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(2)
    expect(ico.length).toBeGreaterThan(2000)
  })

  it('and the internal portal has its own, so the two audiences differ', () => {
    const png = readFileSync('app/(app)/icon.png')
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.length).toBeGreaterThan(2000)
  })
})
