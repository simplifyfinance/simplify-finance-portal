import { test, expect } from '@playwright/test'

// A COMPLIANCE BOX READS THE DEAL, NOT THE SCREEN.
//
// 16 Sep 2026. Yesterday's fix made each tab report its changes to the deal
// page, so a person who edits the lending options and walks over to Compliance
// composes from what they just typed. That covers one person in one window.
//
// It does not cover the credit officer. She is in the same deal in her own
// window; she puts the rates in while the broker has Compliance open. His page
// was loaded before her work existed, and nothing about her saving reaches him
// - live editing is off on purpose. So he presses "Write from the deal" and
// gets regulated wording composed from a deal that is twenty minutes old, with
// nothing on screen to say so.
//
// A compliance box is the one thing in this portal that must never be composed
// from a copy. It reads the record at the moment the button is pressed.
//
// THIS IS THE TWO-PERSON VERSION of lo-reaches-compliance.spec.ts. Same
// sequence, but the edit happens in a window the composing page has never
// heard from.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('compliance composes from the record, not from the page', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('a criterion typed in ANOTHER window reaches the box with no reload', async ({ page, context }) => {
    test.setTimeout(150_000)
    const mark = `robot other window ${Date.now()}`

    // --- the broker opens the deal and goes to Compliance FIRST -------------
    // His page now holds a copy of the deal as it is right now. Everything the
    // credit officer does below is invisible to it.
    await page.goto(`/deals/${DEAL}`)
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Compliance$/ }).click()
    await page.getByRole('button', { name: /Broker comments/ }).click()
    const field = page.getByLabel('Options presented & recommendation', { exact: true })
    await expect(field).toBeVisible({ timeout: 20_000 })
    const original = await field.inputValue()

    // --- the credit officer, in her own window, adds a research criterion ---
    const her = await context.newPage()
    await her.goto(`/deals/${DEAL}`)
    await her.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await her.getByRole('button', { name: /^Lending options$/ }).click()
    const add = her.getByPlaceholder('Add custom criteria and press Enter')
    await expect(add).toBeVisible({ timeout: 20_000 })
    await add.click()
    await add.pressSequentially(mark, { delay: 15 })
    await add.press('Enter')
    await her.waitForTimeout(4_000)          // her autosave goes out and lands

    try {
      // --- he presses the button. NO RELOAD on his page anywhere. ----------
      await page.bringToFront()
      await field.click()
      await field.press('Meta+a')
      await field.press('Delete')
      await field.locator('xpath=following::button[contains(., "Write from the deal")][1]').click()
      await expect(field).not.toHaveValue('', { timeout: 15_000 })

      const text = await field.inputValue()
      if (/NOT RECORDED . which lender was recommended/i.test(text)) {
        test.skip(true, 'The test deal has no recommended lender on the LO, so box five lists no criteria.')
      }

      expect(text, 'the box was composed from the copy his page loaded, not from the deal')
        .toContain(mark)

      await field.click()
      await field.press('Meta+a')
      await field.press('Delete')
      if (original) await field.fill(original)
      await page.waitForTimeout(2_000)
    } finally {
      try {
        const row = her.locator('div').filter({ hasText: new RegExp(`^${mark}$`) }).last()
        await row.getByRole('button', { name: /Remove/ }).click({ timeout: 10_000 })
        await her.waitForTimeout(2_500)
      } catch { /* the next run makes its own marker */ }
      await her.close().catch(() => {})
    }
  })
})
