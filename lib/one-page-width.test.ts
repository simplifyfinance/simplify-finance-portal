import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { PAGE_WIDE, PAGE_READ } from './page-width'

// ONE PLACE DECIDES HOW WIDE A PAGE IS.
//
// 7 Oct 2026. Before this, nothing did. app/(app)/layout.tsx puts no width on
// the page, so each page set its own and thirteen of them ended up with six
// different answers - 768, 896, 1024 and 1152 - plus a Dashboard that was
// capped AND never centred, so it pinned left and threw 512px onto the right.
//
// Nobody decided any of that. It accrued, one page at a time, which is exactly
// what this test exists to stop happening again.
const ROOT = 'app/(app)'

// SETTINGS IS ALLOWED ITS OWN. Fabio, 7 Oct: "leave setting width when we go
// page by page to change the look". It comes in when Settings gets drawn.
const NOT_YET = ['settings']

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (NOT_YET.includes(name)) continue
      walk(p, out)
    } else if (/\.tsx$/.test(p)) out.push(p)
  }
  return out
}

describe('a page does not decide its own width', () => {
  const files = walk(ROOT)

  it('finds the pages', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  // A PAGE CONTAINER IS A CAP PLUS A CENTRING, in one class string. That pair
  // is what makes a page sit in a strip with air either side.
  //
  // It deliberately does NOT catch max-w-sm on a search box or max-w-[86ch] on
  // a paragraph: those cap a FIELD or a LINE, which is a different thing and
  // often right. Only `max-w-<n>xl` together with `mx-auto` is a page deciding
  // where it stops.
  const PAGE_CONTAINER = /className="[^"]*\bmax-w-\d?xl\b[^"]*\bmx-auto\b[^"]*"|className="[^"]*\bmx-auto\b[^"]*\bmax-w-\d?xl\b[^"]*"/

  it('nothing sets its own cap and centres itself', () => {
    const caught: string[] = []
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (PAGE_CONTAINER.test(line)) caught.push(`${f}:${i + 1}`)
      })
    }
    expect(caught, 'Use PAGE_WIDE or PAGE_READ from lib/page-width.ts.\n'
      + 'A page that picks its own width is how the portal ended up with six of them.\n'
      + caught.join('\n')).toEqual([])
  })

  // THE TWO WIDTHS THEMSELVES, stated so a change to them is a deliberate one
  // and shows up in a diff as what it is.
  it('wide takes the screen, and read is the handover sheet’s 1120', () => {
    expect(PAGE_WIDE).toBe('w-full px-7 py-6')
    expect(PAGE_READ).toBe('max-w-[1120px] mx-auto px-6 py-6')
    expect(PAGE_WIDE, 'wide means no cap - that is the whole point of it')
      .not.toMatch(/max-w-/)
  })
})
