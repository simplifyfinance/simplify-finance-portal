import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A TAB THAT DOES NOT TELL THE PAGE WHAT IT SAVED.
//
// 18 Sep 2026, Richard Lake. Mellissa filled the whole Compliance tab in, left
// the tab, came back, and every box was blank - notes, living expenses, risk
// answers. Kylie opened the same deal and saw all of it. Nothing was lost and
// nothing was ever at risk: the record was complete the whole time.
//
// The deal page loads the row once and holds it in `dealData`. Tabs are
// rendered with `{stage === 'X' && <XForm deal={dealData} …/>}`, so leaving a
// tab destroys the form and returning builds a new one FROM THAT HELD COPY. So
// a tab has to hand its saved record back up, or the copy stays as it was when
// the deal was opened and a rebuilt tab shows work that predates the work.
//
// Fact Find, BC and LO all did. Compliance never has.
//
// This is the sixth time one shape of this has cost somebody an afternoon - two
// copies of one record, allowed to disagree. Each was fixed where it was found.
// This test is the rule instead: the build will not go out with a deal tab that
// cannot tell the page what it saved.

const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')

const TABS = [
  { tag: 'FactFindForm',   column: 'fact_find_data',  file: 'app/(app)/deals/[id]/FactFindForm.tsx' },
  { tag: 'BCForm',         column: 'bc_data',         file: 'app/(app)/deals/[id]/BCForm.tsx' },
  { tag: 'LOForm',         column: 'lo_data',         file: 'app/(app)/deals/[id]/LOForm.tsx' },
  { tag: 'ComplianceForm', column: 'compliance_data', file: 'app/(app)/deals/[id]/ComplianceForm.tsx' },
]

// The whole element, from its tag to the `/>` that closes it. The tabs are
// written across several lines, so a line-at-a-time read finds nothing.
function element(tag: string): string {
  const at = page.indexOf('<' + tag + ' ')
  expect(at, `${tag} is not on the deal page at all`).toBeGreaterThan(-1)
  const end = page.indexOf('/>', at)
  return page.slice(at, end + 2)
}

describe('every deal tab tells the page what it saved', () => {
  TABS.forEach(({ tag, column }) => {
    it(`${tag} is handed an onDataChange that writes ${column}`, () => {
      const el = element(tag)
      expect(el, `${tag} has no onDataChange - leaving this tab and coming back `
        + `will rebuild it from the copy the page was opened with`)
        .toMatch(/onDataChange=\{/)
      expect(el, `${tag}'s onDataChange does not write ${column}`)
        .toMatch(new RegExp(`onDataChange=\\{[^}]*${column}`))
    })
  })

  TABS.forEach(({ tag, file }) => {
    it(`${tag} actually calls it`, () => {
      const src = readFileSync(file, 'utf8')
      // Either directly, or through a ref held so the autosave callback does not
      // change identity on every render - see ComplianceForm.
      expect(src, `${tag} accepts onDataChange and never calls it`)
        .toMatch(/onDataChange\?\.\(|reportUp\.current\?\.\(/)
    })
  })

  it('the tabs are still mounted one at a time, which is why this matters', () => {
    // If this ever stops being true the reasoning above changes, and this test
    // should be read again rather than deleted.
    expect(page).toMatch(/stage === 'Compliance' && </)
  })
})
