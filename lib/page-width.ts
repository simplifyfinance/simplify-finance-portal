// HOW WIDE A PAGE IS. ONE PLACE, NOT THIRTEEN.
//
// 7 Oct 2026. Fabio, looking at the Lender library and the Dashboard side by
// side: "any reason why the information doesnt fill the pages see theres alwasy
// gaps on the side and sometimes on the right hand side".
//
// There was no reason. app/(app)/layout.tsx puts NO width on the page at all -
// <main> is flex-1, the whole remainder of the screen - so every page set its
// own, and thirteen of them had drifted into six different answers:
//
//     768px   Team
//     896px   Cheat sheet, Reports
//    1024px   Clients, Team workload, Lender library, Settings, Dashboard
//    1152px   Commissions, Pipeline, Settlements, Templates
//
// On a 1760px screen the Lender library wasted 256px EACH SIDE. The Dashboard
// was worse: p-6 max-w-5xl with no mx-auto, so it was capped at the same 1024
// and never centred - it pinned left and dropped 512px on the right in one
// lump. That was a missing word, not a decision.
//
// AND THE TWO SCREENS THE TEAM LIVES IN WERE ALREADY FLUID. The deals board and
// a deal have no cap. The capped pages were the odd ones out, which is exactly
// why they looked wrong.
//
// TWO WIDTHS, AND NO UPPER CAP.
//
// WIDE is everything that shows a list: the board, a deal, Pipeline,
// Settlements, Commissions, Templates, Clients, the Lender library, Dashboard,
// Team workload, Reports and the Cheat sheet. It takes the screen. Fabio asked
// what the rest of the trade does and then chose this: "no cap". Salesforce,
// Pipedrive, HubSpot and Jira all run their list and board views full width -
// nobody caps a CRM's main table.
//
// READ is for the handful of pages that are a record or a form rather than a
// list, where a line stretched across a big monitor is harder to read, not
// easier: a client's record, the deal summary, Team. 1120px is not a new
// invention - it is the number the handover sheet already used, the only page
// where somebody had thought about it.
//
// SETTINGS IS DELIBERATELY NOT IN HERE. Fabio, 7 Oct: "leave setting width when
// we go page by page to change the look". It keeps its own 1024 until Settings
// gets drawn properly.
//
// lib/one-page-width.test.ts fails the ship if a page starts setting its own
// width again, which is the only thing stopping six answers coming back.

// The screen, less a gutter so cards do not touch the edge.
export const PAGE_WIDE = 'w-full px-7 py-6'

// A record or a form. Centred, because a column of text with equal air either
// side is easier to read than one pinned to the left.
export const PAGE_READ = 'max-w-[1120px] mx-auto px-6 py-6'
