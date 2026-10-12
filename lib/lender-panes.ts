// THE PAGES UNDER THE LENDER LIBRARY, IN ONE LIST.
//
// Same rule as lib/settings-panes.ts and for the same reason: the sidebar kept
// its own copy of the settings list and three pages went unreachable for weeks.
// This list is read by both the page and the menu, so that cannot happen here.

export type LenderPane = { key: string; label: string; blurb: string }

export const LENDER_PANES: LenderPane[] = [
  // PRODUCTS AND FEES, NOT "PRODUCTS & POLICY".
  //
  // 13 Oct 2026. It was called Products & policy and holds products and fees.
  // Once the lenders' actual written policy became its own pane, two things on
  // the same menu claimed the word policy, and the one that did NOT hold any
  // policy came first.
  { key: 'lenders', label: 'Products & fees',
    blurb: 'Manage lenders and products. Import from a PDF or URL, or add manually.' },
  { key: 'rules', label: 'What we have learned',
    blurb: 'Answers the portal keeps per lender, asked once and used by every template after.' },
  // THE RATE NOTICE LIVES HERE, NOT IN SETTINGS.
  //
  // Fabio, 30 Sep 2026: "remeber the rates is a team effort once live it needs
  // to be under lender library come on as not evryone can see settings".
  //
  // He is right. Settings is an admin page and this is not an admin job - the
  // whole design of the notice is that anybody who learns a bank's date can put
  // it in. Putting the switch somewhere most of the team cannot reach would have
  // left one person as the bottleneck on every RBA decision.
  //
  // It also belongs beside the per-lender dates it drives, rather than a page
  // away from them.
  // THE LENDERS' OWN WRITTEN POLICY. Paco's third source and the one that
  // outranks the other two. Uploading happens on each lender rather than here,
  // so the bank is never chosen from a dropdown - see LenderPolicyDocs.
  { key: 'policy', label: 'Policy documents',
    blurb: 'The credit manuals Paco answers from. He quotes them; he never paraphrases.' },
  { key: 'rate-notice', label: 'RBA rate notice',
    blurb: 'The line that goes on every client email quoting a rate, until each bank passes the change on.' },
]

export const DEFAULT_LENDER_PANE = LENDER_PANES[0].key

export function isLenderPane(key: any): boolean {
  return LENDER_PANES.some(p => p.key === String(key ?? ''))
}
