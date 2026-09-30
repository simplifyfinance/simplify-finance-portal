// EVERY SETTINGS PAGE, IN ONE LIST.
//
// 30 Sep 2026. Fabio went looking for the new Rate notice page and it was not in
// the menu. It existed, it worked, and /settings#rate-notice opened it - but
// nothing linked to it, because the sidebar kept its own hardcoded copy of the
// settings list and nobody had added it there.
//
// DEAL BOARD AND STATEMENT ANALYSIS WERE MISSING TOO, and had been since they
// shipped. Nobody noticed, because a page that is never linked to is a page
// nobody goes looking for.
//
// This is the same failure this codebase keeps making: one fact - "what settings
// pages exist" - decided in two places and free to disagree. The lender name,
// the duty state, the stamp duty label. Same medicine each time: one home, and a
// test that fails the build when a second copy appears.

export type SettingsPane = {
  key: string
  // In the sidebar and at the top of the page.
  label: string
  // What the page is for, shown under its heading.
  blurb: string
  // Who the menu shows it to. The page itself is not protected by these - they
  // are about clutter, not permission.
  adminOnly?: boolean
  financeOnly?: boolean
}

export const SETTINGS_PANES: SettingsPane[] = [
  { key: 'brands', label: 'Brands',
    blurb: 'Trading names used on deals and client emails.' },
  { key: 'brokers', label: 'Broker profiles',
    blurb: 'Everything about one broker: their details for documents, the key that links them to their deals, and their targets.' },
  { key: 'board', label: 'Deal board',
    blurb: 'The colour of each label on a card, and how long a column may sit before it goes amber and then red.' },
  { key: 'targets', label: 'Business targets', adminOnly: true,
    blurb: 'Monthly lodged and settled targets for the business as a whole. A broker’s own targets live on their profile.' },
  { key: 'commissions', label: 'Commission library', financeOnly: true,
    blurb: 'What each lender pays, on what basis, and what they claw back.' },
  { key: 'ai', label: 'AI expenses', financeOnly: true,
    blurb: 'What the portal spends on Anthropic, by month, person and feature.' },
  { key: 'people', label: 'Credit team',
    blurb: 'Who covers which broker.' },
  { key: 'notifications', label: 'Notifications',
    blurb: 'Who is emailed as deals move through the pipeline.' },
  { key: 'compliance', label: 'Compliance AI',
    blurb: 'Style notes and flags fed into every Compliance generation.' },
  { key: 'connections', label: 'Connections',
    blurb: 'Bank statement collection and other outside services.' },
  { key: 'statements', label: 'Statement analysis',
    blurb: 'What the statement analysis looks for, and when it raises a flag.' },
]

export const DEFAULT_PANE = SETTINGS_PANES[0].key

export function paneFor(key: any): SettingsPane {
  return SETTINGS_PANES.find(p => p.key === String(key ?? '')) || SETTINGS_PANES[0]
}

export function isPane(key: any): boolean {
  return SETTINGS_PANES.some(p => p.key === String(key ?? ''))
}
