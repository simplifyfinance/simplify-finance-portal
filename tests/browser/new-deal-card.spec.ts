import { test, expect } from '@playwright/test'

// THE NEW DEAL CARD BUTTON, PRESSED.
//
// 12 Nov 2026, Fabio, approving the broker's screen: the New deal card
// "must work" - meaning it opens the form, rather than dropping somebody on
// the deals list to hunt for the button a second time.
//
// 15 Nov 2026: it had three tests and not one of them pressed it. They checked
// that the link says /deals?new=1, and that the deals page reads `new` on
// mount. Both true, both source-level, and neither answers the question. The
// honest answer was "the wiring is right, nobody has ever clicked it" - which
// is not something to tell the person whose staff use it on Monday.
//
// IT ALSO GUARDS A BUILD FAULT THAT ALREADY HAPPENED ONCE. The deals page read
// the address with useSearchParams(), which makes the page un-prerenderable
// unless the whole of it is wrapped in Suspense - the production build refused
// it outright. It now reads window.location.search once on mount. If anybody
// moves that back, the page still compiles, and this is what fails.
//
// ONE TEST, ON PURPOSE. The first version of this file also checked that the
// dialog stays shut on a plain visit, and waited for [data-ready="1"] to know
// the page had loaded. The deals board does not set that marker - only a deal
// card does - so it would have hung for thirty seconds and failed the ship for
// a reason that had nothing to do with the button.
test('the New deal card opens the form, not a list to hunt through', async ({ page }) => {
  // ARRIVING THE WAY THE BUTTON ARRIVES. The button on the broker's Today is a
  // plain link to this address - lib/the-brokers-screen.test.ts holds that - so
  // landing here is pressing it.
  await page.goto('/deals?new=1', { waitUntil: 'domcontentloaded' })

  // "New client" is one of the two mode buttons INSIDE the dialog, and the
  // dialog is only mounted while it is open ({showModal && <NewDealModal/>}),
  // so finding it means the form is actually on screen.
  await expect(page.getByRole('button', { name: 'New client' }))
    .toBeVisible({ timeout: 30_000 })
})
