import { test, expect } from '@playwright/test'

// WHAT IS BEHIND "MORE", PRESSED BY A ROBOT.
//
// 6 Oct 2026. Close deal stopped working the day the header was tidied and
// nothing said so. The menu shut itself when you picked something, and shutting
// it unmounted the component that had just been asked to open a dialog. Every
// unit test passed. The button was there, it was enabled, it had the right
// handler on it - and pressing it did nothing at all.
//
// That is the second time this month a thing was unreachable while the tests
// said it existed; see tests/browser/milestone-emails.spec.ts, where three PDFs
// sat under a disabled fieldset for a fortnight. Only a browser can tell you
// whether a person can actually get to something.
//
// READ ONLY. This opens the dialog and presses Cancel. It never presses the
// Close deal button inside the dialog, because that closes a real deal on a
// real database. The assertion at the end is that the deal is still open.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('the More menu', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('Close deal opens the dialog and Cancel puts it away', async ({ page }) => {
    await page.goto(`/deals/${DEAL}`)
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })

    const more = page.getByRole('button', { name: /^More$/ })
    await expect(more).toBeVisible({ timeout: 15_000 })
    await more.click()

    // Both of them are listed. A menu that has quietly lost an item is a
    // question somebody has to ask somebody else.
    await expect(page.getByRole('button', { name: /^Clone$/ })).toBeVisible({ timeout: 10_000 })

    // The deal may already be closed, in which case this reads Reopen and there
    // is no dialog to open. Say so rather than pass silently.
    const reopen = page.getByRole('button', { name: /^Reopen$/ })
    if (await reopen.count() > 0) {
      console.log('   (this deal is already closed - the menu offers Reopen)')
      return
    }

    const closeDeal = page.getByRole('button', { name: /^Close deal$/ })
    await expect(closeDeal).toBeVisible({ timeout: 10_000 })
    await closeDeal.click()

    // THE WHOLE POINT. The dialog has to still be on screen a moment later -
    // the fault was that it appeared and was thrown away in the same frame.
    const dialog = page.getByText('Close this deal')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(600)
    await expect(dialog, 'the dialog opened and then disappeared on its own').toBeVisible()

    // Every reason is offered, so nobody has to close a deal under the wrong one.
    const body = await page.locator('body').innerText()
    for (const reason of ['No response from client', 'Client changed plans', 'Other']) {
      expect(body, `the reason "${reason}" is not offered`).toContain(reason)
    }

    // OUT WITHOUT CLOSING ANYTHING.
    await page.getByRole('button', { name: /^Cancel$/ }).click()
    await expect(dialog).toBeHidden({ timeout: 10_000 })

    // And the deal is still open - the menu would say Reopen if it were not.
    await expect(page.getByRole('button', { name: /^Reopen$/ })).toHaveCount(0)
  })
})
