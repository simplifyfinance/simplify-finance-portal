// IS THE APPROVED LOOK ACTUALLY BUILT?
//
// Fabio, 5 Oct 2026: "How are we making sure the approved looks are getting
// built?" - after hard refreshing the portal and finding it looked nothing like
// one-inside-the-deal-v4.html, which he signed off weeks ago.
//
// He was right. A day of work had gone into colour - amber out, dark in - and
// none of it was the LAYOUT he approved. Nothing in the repo could tell either
// of us that, because a colour swap passes every test we had.
//
// So this is the list. Every piece of every approved mock, and either the proof
// it is in the code or `null` meaning it is not built yet. lib/the-look.test.ts
// checks every claim: a piece cannot be marked built unless the file named here
// really contains that text. The number of nulls is the honest size of what is
// left, and it prints on every ship.
//
// THE RULE: a piece moves from null to a proof only in the same commit that
// builds it. Never before.

export type Piece = {
  /** The approved mock this piece comes from. */
  mock: string
  /** What it is, in the words we use for it. */
  piece: string
  /** Where it lives in the code, or null while it does not exist. */
  proof: { file: string; contains: string } | null
}

// WHERE THE MOCKS LIVE, NOW THAT THEY LIVE SOMEWHERE SAFE.
// Until 5 Oct 2026 these were in Claude outputs/, which .gitignore ignores -
// one laptop, no copy, nothing pointing at them. They are in the repo now and
// the test below fails if one goes missing.
export const MOCKS = 'docs/approved-looks'

const V4 = 'one-inside-the-deal-v4.html'
const PAGE = 'app/(app)/deals/[id]/DealPageClient.tsx'
const RAIL = 'components/DealRail.tsx'
const CARDS = 'components/DealTabCards.tsx'
const BC = 'app/(app)/deals/[id]/BCForm.tsx'
const DOCS = 'components/DocumentsBox.tsx'

export const THE_LOOK: Piece[] = [
  // ---- the deal page, top to bottom as the mock draws it -------------------
  { mock: V4, piece: 'Breadcrumb: Deals / the scenario name',
    proof: { file: PAGE, contains: "aria-label=\"Back to deals\"" } },
  { mock: V4, piece: 'Deal name row with its chips and buttons',
    proof: { file: PAGE, contains: '<DealMore>' } },
  { mock: V4, piece: 'SalesTrekker and links, in the rail',
    proof: { file: PAGE, contains: '<DealLinks' } },
  { mock: V4, piece: 'Open BC button in the header',
    proof: { file: PAGE, contains: 'Open BC' } },
  { mock: V4, piece: 'Client emails menu in the header', proof: null },
  { mock: V4, piece: 'Broker and credit officer line under the name',
    proof: { file: PAGE, contains: '<BrokerAssignment' } },
  { mock: V4, piece: 'The prompt band across the top', proof: null },
  { mock: V4, piece: 'Who else is on this deal',
    proof: { file: PAGE, contains: '<DealPresence' } },
  { mock: V4, piece: 'The stage bar with its beads and dates',
    proof: { file: PAGE, contains: '<DealProgress' } },
  { mock: V4, piece: 'The five tabs as cards with an icon and a status line',
    proof: { file: PAGE, contains: '<DealTabCards' } },
  { mock: V4, piece: 'Next action box beside the tab cards',
    proof: { file: CARDS, contains: 'Next action' } },
  { mock: V4, piece: 'Two columns: the form, and the rail beside it',
    proof: { file: PAGE, contains: '<DealRail>' } },
  // The proof is that it is INSIDE the rail, not merely imported somewhere -
  // which is the mistake that made this list wrong the first time.
  { mock: V4, piece: 'Important, in the rail',
    proof: { file: PAGE, contains: '<DealRail>\n          <DealAlerts' } },
  { mock: V4, piece: 'Internal notes, in the rail',
    proof: { file: PAGE, contains: '<RailNotes' } },
  { mock: V4, piece: 'Internal notes can be made taller, and the words fade where they are cut off',
    proof: { file: RAIL, contains: 'cursor-ns-resize' } },
  { mock: V4, piece: 'Documents, in the rail',
    proof: { file: PAGE, contains: '<DealRail>' } },
  { mock: V4, piece: 'Build a PDF, in the rail',
    proof: { file: PAGE, contains: '<DealDocuments' } },
  { mock: V4, piece: 'File notes, in the rail',
    proof: { file: PAGE, contains: '<FileNotes' } },
  { mock: V4, piece: 'Documents counts: to request, received, to check',
    proof: { file: DOCS, contains: '>To check</dt>' } },

  // ---- what we agreed INSIDE the tabs ------------------------------------
  //
  // 5 Oct 2026. The list above is the FRAME of the deal page. Fabio asked
  // whether Fact Find, Statements, BC and Lending options were done "as per all
  // our discussions and mock ups" - and nothing in the repo could answer,
  // because the things we agreed inside each tab were in a scratch file and
  // were never counted. That is the same hole as before, one level down.

  // BC - the four small ships, all done.
  { mock: 'one-bc-tab.html', piece: 'BC: a split is a card with a grey header band',
    proof: { file: BC, contains: 'rounded-t-xl flex items-center gap-2.5' } },
  { mock: 'one-bc-tab.html', piece: 'BC: the checklist ticks are green discs',
    proof: { file: BC, contains: 'bg-done-bg text-done' } },
  { mock: 'one-bc-tab.html', piece: 'BC: Generate email looks like a button',
    proof: { file: BC, contains: "'Generating...' : 'Generate email'" } },
  { mock: 'one-bc-tab.html', piece: 'BC: one column, with the client words under one line',
    proof: { file: BC, contains: 'What goes in the email' } },

  // LENDING OPTIONS - the four Fabio picked, none of them built.
  { mock: 'lo.html', piece: 'LO: deal structure density B - two lines per split, not a table',
    proof: { file: 'components/DealStructure.tsx', contains: 'TWO LINES PER SPLIT' } },
  { mock: 'lo.html', piece: 'LO: research criteria and important notes above the lender options',
    proof: { file: 'app/(app)/deals/[id]/LOForm.tsx', contains: 'WHAT WAS DECIDED BEFORE ANY LENDER WAS LOOKED AT' } },
  { mock: 'lo.html', piece: "LO: the client's decision inside the recommendation card",
    proof: { file: 'app/(app)/deals/[id]/LOForm.tsx', contains: 'AT THE FOOT OF THE RECOMMENDATION IT IS ABOUT' } },
  { mock: 'lo.html', piece: 'LO: rate modules as chips at the top with panels below',
    proof: { file: 'app/(app)/deals/[id]/LOForm.tsx', contains: 'RATE MODULES AS CHIPS' } },

  // STATEMENTS - mocked and approved, nothing built but the colours.
  { mock: 'st-page.html', piece: 'Statements: the approved layout', proof: null },

  // 6 Oct 2026. Not part of the branding work - it came out of the dark mode
  // afternoon, where the fix was already live and the tab was not.
  { mock: 'one-new-version.html', piece: 'A newer version is deployed: the line in the sidebar',
    proof: { file: 'components/NewVersion.tsx', contains: 'NEW VERSION READY' } },
]

export const built = (p: Piece) => p.proof !== null
export const outstanding = (list: Piece[] = THE_LOOK) => list.filter(p => !built(p))
