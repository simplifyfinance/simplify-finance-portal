import { test, expect } from '@playwright/test'

// A PHOTOGRAPH OF THE DEAL PAGE, FOR SOMEBODY WHO CANNOT OPEN IT.
//
// 16 Nov 2026. Everything else in this folder asserts. This one looks. It was
// written during the deal page redesign, because the thing being changed was
// how the page LOOKS, and the only two ways to check that were to ship it or
// to ask Fabio to describe it down the phone.
//
// IT GOES STRAIGHT TO THE DEAL, and the first attempt did not.
//
// It hunted for a link on the board - a[href^="/deals/"] - and waited thirty
// seconds for one that does not exist. A card on the board is a DIV with an
// onClick that pushes the route; see components/DealBoard.tsx. Nothing was
// broken. The robot was looking for the wrong kind of thing, which is the same
// mistake that quietly bred 891 test deals in thirty days - see
// tests/browser/the-robots-own-deal.ts.
//
// So it uses PORTAL_TEST_DEAL_ID out of .env.local, exactly as every other
// spec here does.
const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.skip(!process.env.LOOK, 'only when scripts/look.sh asks for it')

test('photograph a deal', async ({ page }) => {
  expect(DEAL, 'PORTAL_TEST_DEAL_ID is not set in .env.local').not.toBe('')

  await page.setViewportSize({ width: 1600, height: 1200 })
  await page.goto(`/deals/${DEAL}`, { waitUntil: 'domcontentloaded' })
  // The page says when it is actually alive - see data-ready in DealPageClient.
  await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(2500)

  await page.screenshot({ path: 'look/01-the-whole-page.png', fullPage: true })

  // THE DEAL BOX ON ITS OWN - the head with Mark urgent, Open BC, Client
  // emails, Edit and More.
  await page.locator('section.bub').first()
    .screenshot({ path: 'look/02-the-deal-box.png' }).catch(() => {})

  // THE BC TAB. The one Fabio asked to see: the buttons that live inside the
  // form, in the box this ship puts around it.
  const bcTab = page.getByRole('button', { name: 'BC — Borrowing capacity' }).first()
  if (await bcTab.isVisible().catch(() => false)) {
    await bcTab.click()
    await page.waitForTimeout(3500)
  }
  await page.screenshot({ path: 'look/03-bc-whole-page.png', fullPage: true })

  await page.locator('section.bub')
    .filter({ has: page.locator('h2', { hasText: 'Borrowing capacity' }) }).last()
    .screenshot({ path: 'look/04-bc-box.png' }).catch(() => {})

  // And the same page with the lights off.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'look/05-bc-dark.png', fullPage: true })
})
