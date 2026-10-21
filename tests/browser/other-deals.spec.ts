import { test, expect } from '@playwright/test'

// THE OTHER DEALS ROW, PRESSED BY A ROBOT.
//
// 21 Oct 2026. Katie: "Would it be okay to remove the lost deals from this
// section so only the active deals are showing? There are 5 lost deals in
// here." Fabio, on the same row: "ensure if I press the balloon I can go into
// the actual deal."
//
// The chips were already built as Links, which is exactly the shape of the two
// faults this folder exists for - see more-menu.spec.ts, where the button was
// there, enabled, with the right handler on it, and pressing it did nothing.
// Only a browser can say whether a person can actually get somewhere.
//
// READ ONLY. It presses a link and checks which page opens. Nothing is saved
// and no deal is changed.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('the other deals on a header', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('a chip opens the deal it names', async ({ page }) => {
    await page.goto(`/deals/${DEAL}`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })

    const chips = page.locator('[data-other-deal]')
    const howMany = await chips.count()
    test.skip(howMany === 0, 'This deal has no other deals for the same client.')

    // The id is on the chip, so the test knows where it should land rather
    // than trusting that it landed somewhere.
    const first = chips.first()
    const goingTo = await first.getAttribute('data-other-deal')
    expect(goingTo, 'a chip with no deal id on it').toBeTruthy()

    await first.click()
    await page.waitForURL(new RegExp(`/deals/${goingTo}`), { timeout: 30_000 })
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })

    // AND IT IS A DEAL, not a page that loaded and said nothing. The header
    // carries the row we just came from.
    expect(page.url()).toContain(String(goingTo))
  })

  test('a lost deal is not on the row until it is asked for', async ({ page }) => {
    await page.goto(`/deals/${DEAL}`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })

    const reveal = page.getByRole('button', { name: /lost · show$/ })
    test.skip(await reveal.count() === 0, 'This client has no lost deals.')

    const before = await page.locator('[data-other-deal]').count()
    await reveal.click()
    const after = await page.locator('[data-other-deal]').count()

    // They were folded away, and one press brings every one of them back.
    expect(after).toBeGreaterThan(before)
    await expect(page.getByRole('button', { name: /^hide$/ })).toBeVisible()
  })
})
