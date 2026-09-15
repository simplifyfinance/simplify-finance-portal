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

// AND THE PROPER FIX, 16 Sep 2026.
//
// The wiring above covers ONE person moving between tabs. It does not cover the
// credit officer in her own window putting the rates in while the broker has
// Compliance open: his page was loaded before her work existed, and nothing
// about her saving reaches him, because live editing is off on purpose.
//
// So the boxes read the four records back at the moment the button is pressed.
// That makes the wiring above a belt-and-braces check rather than the only
// thing holding it together - which is the right way round for the one thing in
// this portal that goes to a credit assessor.
describe('what Compliance composes from', () => {
  const src = () => read('ComplianceForm.tsx')

  it('READS THE RECORD, NOT THE COPY THE PAGE IS HOLDING', () => {
    expect(src(), 'compose() went back to composing from the page object')
      .toMatch(/const \{ deal: from, fromRecord \} = await freshDeal\(\)/)
    expect(src()).toMatch(/COMPOSERS\[field\]\(from\)/)
    expect(src(), 'the composers are reading `deal` again').not.toMatch(/COMPOSERS\[field\]\(deal\)/)
  })

  it('reads all four records, so no box composes from a stale one', () => {
    expect(src()).toMatch(/select\('fact_find_data,bc_data,lo_data,compliance_data'\)/)
  })

  it('stamps the box with the facts it actually used', () => {
    // A box composed from the record must be stamped with THOSE facts, or the
    // staleness check is measuring against something the box was never written
    // from. See lib/notes-freshness.ts.
    expect(src()).toMatch(/const facts = factsOf\(from\)/)
    expect(src()).toMatch(/at: new Date\(\)\.toISOString\(\), facts \} \} \}\)\)/)
  })

  it('still writes the box when the record cannot be reached, and says so', () => {
    // Refusing to write over a network hiccup would be the portal getting in
    // the way. It falls back to the page's copy - which is what it always did -
    // and records which of the two happened.
    expect(src()).toMatch(/read from this screen - the saved record could not be reached/)
  })
})
