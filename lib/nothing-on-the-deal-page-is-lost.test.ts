import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'

// EVERY CONTROL ON THE DEAL PAGE, AND THE PROOF IT STILL EXISTS.
//
// 18 Nov 2026. Fabio, three days into redesigning this page: "Changing the look
// is one thing. Losing features of the current thing is the same. It's another
// problem. That's what I don't want."
//
// He is right, and a promise is not a mechanism. lib/the-look.ts proves that
// what was DESIGNED got built. This is its mirror: it proves that what was
// already BUILT is still there afterwards.
//
// HOW IT WORKS. Every row names a thing a person can do on the deal page and a
// piece of code that can only be there if that thing is. The test fails if the
// proof goes missing, so a redesign that quietly drops a button cannot ship -
// not because somebody remembered, but because the ship refuses.
//
// WHEN SOMETHING IS REMOVED ON PURPOSE. It happens, and it should: three things
// came off this page today and all three were decided out loud. In that case
// the row moves to GONE below, with the date and the reason, in the same commit
// that removes it. The list of what we deliberately gave up is as useful as the
// list of what we kept, and it is the honest way to tell the two apart.
//
// THE PROOF IS A SHAPE, NOT A WORD. A component's tag, a route, a label in a
// map. Renaming a button does not fail this test; deleting it does.

const PAGE = 'app/(app)/deals/[id]/DealPageClient.tsx'

type Feature = { does: string; file: string; proof: string }

const KEPT: Feature[] = [
  // ---- the header, and who the deal belongs to ----------------------------
  { does: 'Read the whole history of a deal', file: PAGE, proof: '<DealHistory' },
  { does: 'Rename the deal', file: PAGE, proof: '<DealName' },
  { does: 'Open the menu behind More', file: PAGE, proof: '<DealMore' },
  { does: 'Close a deal, with a reason', file: PAGE, proof: '<CloseDeal' },
  { does: 'Send a client email', file: 'components/MilestoneEmails.tsx', proof: 'export default function' },
  { does: 'Jump to the BC', file: PAGE, proof: 'Open BC' },
  { does: 'Reassign the broker', file: PAGE, proof: '<BrokerAssignment' },
  { does: 'Reassign the credit officer', file: PAGE, proof: '<CreditOfficerAssignment' },
  { does: 'Reassign the compliance pack', file: PAGE, proof: '<CompliancePackAssignment' },
  { does: 'Mark a deal urgent', file: PAGE, proof: '<MarkUrgent' },
  { does: 'See who else has this deal open', file: PAGE, proof: '<DealPresence' },
  { does: 'See and clear alerts', file: PAGE, proof: '<DealAlerts' },
  { does: 'Say who the deal is shared with', file: PAGE, proof: '<SharedWithBox' },
  { does: 'See what nobody has started', file: PAGE, proof: '<DealPrompts' },
  { does: 'See that the client agreed, and when', file: PAGE, proof: '<ClientAgreed' },

  // ---- where the deal is ---------------------------------------------------
  { does: 'The stage bar', file: PAGE, proof: '<DealProgress' },
  { does: 'The six tab cards', file: PAGE, proof: '<DealTabCards' },

  // ---- the work itself -----------------------------------------------------
  { does: 'Fill in the fact find', file: PAGE, proof: '<FactFindForm' },
  { does: 'Read the statements', file: PAGE, proof: '<StatementAnalysis' },
  { does: 'Write the BC', file: PAGE, proof: '<BCForm' },
  { does: 'Write the lending options', file: PAGE, proof: '<LOForm' },
  { does: 'Write the compliance', file: PAGE, proof: '<ComplianceForm' },
  { does: 'Read the file notes full screen', file: PAGE, proof: '<FileNotesTab' },
  { does: 'Mark a stage done, send it, record the client agreeing',
    file: 'components/WhatNow.tsx', proof: 'What now' },
  { does: 'Send a stage back to whoever wrote it',
    file: 'components/SendItBack.tsx', proof: 'export default function SendItBack' },
  { does: 'Order a valuation', file: 'components/OrderValuation.tsx', proof: 'export default function' },
  { does: 'Pick a BC template', file: 'app/(app)/deals/[id]/BCForm.tsx', proof: 'templateLabel' },
  { does: 'Ask the client the questions the fact find is missing',
    file: 'components/WhatWeStillNeed.tsx', proof: 'Questions going out with this email' },
  { does: 'Flag an issue on compliance',
    file: 'app/(app)/deals/[id]/ComplianceForm.tsx', proof: 'Flag an issue' },
  { does: 'Push compliance to SalesTrekker',
    file: 'app/(app)/deals/[id]/ComplianceForm.tsx', proof: 'Already pushed to SalesTrekker.' },
  { does: 'Hand a stage over to somebody else',
    file: 'lib/hand-this-stage-over.ts', proof: 'export' },

  // ---- after lodgement -----------------------------------------------------
  { does: 'The settlement panel', file: PAGE, proof: '<DealSettlement' },
  { does: 'Record an accepted offer', file: PAGE, proof: '<OfferAccepted' },
  { does: 'Work the outstandings', file: PAGE, proof: '<Outstanding' },
  { does: 'See the commission', file: PAGE, proof: '<DealCommission' },
  { does: 'The handover notes', file: PAGE, proof: '<HandoverNotes' },

  // ---- the rail ------------------------------------------------------------
  { does: 'Write a sales note', file: 'components/DealRail.tsx', proof: 'Sales notes' },
  { does: 'Write to the file, where nothing can be overwritten',
    file: 'components/DealFile.tsx', proof: 'File update' },
  { does: 'Request documents from the client',
    file: 'components/DocumentsBox.tsx', proof: 'onClick={requestThem}' },
  { does: 'Build the Fact Find PDF', file: 'components/DealDocuments.tsx', proof: "label: 'Fact Find PDF'" },
  { does: 'Build the Handover PDF', file: 'components/DealDocuments.tsx', proof: "label: 'Handover PDF'" },
  { does: 'Build the Broker Notes PDF', file: 'components/DealDocuments.tsx', proof: "label: 'Broker Notes PDF'" },
  { does: 'Build all of them at once', file: 'components/DealDocuments.tsx', proof: 'Rebuild all three' },
  { does: 'Build the purchase handover', file: 'lib/the-purchase-handover.ts', proof: 'export' },
  { does: 'Keep the links to SalesTrekker and OneDrive',
    file: 'components/DealLinks.tsx', proof: 'export default function' },
  { does: 'Say credit cannot action this', file: PAGE, proof: '<CreditCannotAction' },
  { does: 'Report that something is wrong',
    file: 'components/SomethingWrong.tsx', proof: 'export default function' },

  // ---- and the net under all of it ----------------------------------------
  { does: 'Clone a deal', file: 'lib/clone-deal.ts', proof: 'export' },
  { does: 'Keep the other tabs alive when one of them breaks',
    file: 'components/TabBoundary.tsx', proof: 'could not be drawn' },
]

// WHAT WE GAVE UP, ON PURPOSE, AND WHY.
//
// Nothing goes on this list by accident. A row moves here in the same commit
// that removes the thing, with the date and the person who decided.
const GONE = [
  { was: 'The "With client" chip in the header',
    when: '18 Nov 2026',
    why: 'The board columns say who is holding a deal up now - BC with credit beside BC with '
       + 'client - so the chip was the card printing its own address. Fabio: "doesn\'t that '
       + 'defeat the purpose now that we have the breakdown of all the portal between us and them".' },
  { was: 'The Next action box beside the tab cards',
    when: '18 Nov 2026',
    why: 'It said "Waiting on: Mellissa Sedin to complete BC" while the header said the same '
       + 'thing two inches above it. One fact, drawn three times.' },
  { was: 'The days-on-this-stage figure on the deal page',
    when: '18 Nov 2026',
    why: 'Still recorded, still read - it moved to Team workload, which is the screen built for '
       + 'it. Fabio: "that\'s a management team number when we look at the workload tab".' },
]

describe('nothing on the deal page is lost', () => {
  it('every one of these can still be done', () => {
    const missing: string[] = []
    for (const f of KEPT) {
      if (!existsSync(f.file)) { missing.push(`${f.does} - ${f.file} is gone`); continue }
      if (!readFileSync(f.file, 'utf8').includes(f.proof)) {
        missing.push(`${f.does} - ${f.file} no longer contains ${f.proof}`)
      }
    }
    expect(missing, `\n\n${missing.length} thing(s) the deal page could do are no longer there:\n`
      + missing.map(m => `  - ${m}`).join('\n')
      + '\n\nIf one of these was removed on purpose, move its row to GONE with the date and the '
      + 'reason, in this same commit.\n').toEqual([])
  })

  // The list is only worth having if it is the whole list.
  it('covers the header, the stages, the settlement end and the rail', () => {
    expect(KEPT.length).toBeGreaterThanOrEqual(45)
    const does = KEPT.map(f => f.does)
    expect(new Set(does).size).toBe(does.length)
  })

  it('and says out loud what was given up, with a reason', () => {
    for (const g of GONE) {
      expect(g.when).toMatch(/\d{4}/)
      expect(g.why.length).toBeGreaterThan(40)
    }
  })

  // 18 Nov 2026. The one Fabio named twice, and the one he was most afraid of
  // losing: "the history button that is only available to me and Kylie... make
  // sure that's included on my view and her view."
  it('History is on the page, and still only for the people who may see it', () => {
    const page = readFileSync(PAGE, 'utf8')
    expect(page).toContain('<DealHistory')
    expect(page).toContain('canSeeHistory')
  })
})
