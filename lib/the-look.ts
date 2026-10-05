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

const V4 = 'one-inside-the-deal-v4.html'
const PAGE = 'app/(app)/deals/[id]/DealPageClient.tsx'

export const THE_LOOK: Piece[] = [
  // ---- the deal page, top to bottom as the mock draws it -------------------
  { mock: V4, piece: 'Breadcrumb: Deals / the scenario name', proof: null },
  { mock: V4, piece: 'Deal name row with its chips and buttons', proof: null },
  { mock: V4, piece: 'Open BC button in the header', proof: null },
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
  { mock: V4, piece: 'Next action box beside the tab cards', proof: null },
  // WITHDRAWN 5 Oct 2026. The two-column grid on the page is the SETTLEMENT
  // columns, drawn only once a deal is with a lender. It is not the rail, and
  // calling it one was the same mistake this list exists to catch.
  { mock: V4, piece: 'Two columns: the form, and the rail beside it', proof: null },
  // The component exists. It is inside the settlement grid, so on a Fact Find
  // deal it is not on screen at all.
  { mock: V4, piece: 'Important, in the rail', proof: null },
  // Full width, stacked under the form. Not beside it.
  { mock: V4, piece: 'Internal notes, in the rail', proof: null },
  { mock: V4, piece: 'Internal notes can be made taller, and the words fade where they are cut off', proof: null },
  // Same - full width, under the form.
  { mock: V4, piece: 'Documents, in the rail', proof: null },
  { mock: V4, piece: 'Documents counts: to request, received, to check', proof: null },
]

export const built = (p: Piece) => p.proof !== null
export const outstanding = (list: Piece[] = THE_LOOK) => list.filter(p => !built(p))
