import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// WHAT ONE TAB CHANGES, THE OTHERS HAVE TO SEE.
//
// Fabio, 15 Sep 2026: "if we do change BC, LO, fact find information halfway
// through and then go back to compliance, how can the system fix that?"
//
// Here is the shape of it. The deal page holds the whole deal in one object and
// hands it to whichever tab is open. Compliance does not read the database when
// you press "Write from the deal" - it composes the regulated wording from that
// object. And the ONLY thing that refreshes that object during a session is
// each tab calling onDataChange as it saves.
//
// The Fact Find and the BC do. Lending options never did. So editing the
// lending options and going straight to Compliance composed from the record as
// it was when the deal was OPENED - which is the Mark Guiness fault: "no deal
// has been selected in LO" with products sitting right there on the screen.
//
// Reloading the page fixed it, which is exactly what makes this dangerous: the
// wording looks completely normal and nothing says it is out of date.
//
// COMPLIANCE IS NOT IN THIS LIST ON PURPOSE. Nothing composes from
// compliance_data, so it has nothing to report. It patches the deal row through
// onDealPatched instead.

const DIR = 'app/(app)/deals/[id]/'
const read = (f: string) => readFileSync(DIR + f, 'utf8')

const FEEDS_COMPLIANCE = [
  { tab: 'Fact Find', file: 'FactFindForm.tsx', column: 'fact_find_data' },
  { tab: 'BC', file: 'BCForm.tsx', column: 'bc_data' },
  { tab: 'Lending options', file: 'LOForm.tsx', column: 'lo_data' },
]

describe('every tab Compliance reads from reports its changes up', () => {
  for (const { tab, file, column } of FEEDS_COMPLIANCE) {
    it(`${tab} tells the deal page when its record changes`, () => {
      const src = read(file)
      expect(src, `${file} never calls onDataChange, so ${column} goes stale mid-session`)
        .toMatch(/onDataChange\?\.\(/)
    })

    it(`the deal page listens to ${tab} and puts it into ${column}`, () => {
      const page = read('DealPageClient.tsx')
      const wired = new RegExp(`onDataChange=\\{[^}]*${column}`)
      expect(page, `DealPageClient does not pass onDataChange for ${column}`).toMatch(wired)
    })
  }
})

describe('what Compliance composes from', () => {
  it('reads the deal object it was handed, not the database', () => {
    // Stated here so the test above has an obvious reason to exist. Changing
    // this - having the composers read the record at the moment the button is
    // pressed - is the proper fix, and it would make the wiring above a
    // belt-and-braces check rather than the only thing holding it together.
    const src = read('ComplianceForm.tsx')
    expect(src).toMatch(/COMPOSERS\[field\]\(deal\)/)
  })
})
