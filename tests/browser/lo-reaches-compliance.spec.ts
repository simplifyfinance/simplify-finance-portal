import { test, expect } from '@playwright/test'

// CHANGE THE LENDING OPTIONS, THEN WRITE A COMPLIANCE BOX.
//
// Fabio, 15 Sep 2026: "if we do change BC, LO, fact find information halfway
// through and then go back to compliance, how can the system fix that?"
//
// Compliance does not read the database when somebody presses "Write from the
// deal". It composes the regulated wording from the copy of the deal the page
// is holding, and the only thing that refreshes that copy during a session is
// each tab reporting its changes as it saves.
//
// Lending options never did. So this exact sequence - edit LO, switch to
// Compliance, press the button - wrote the wording from the record as it was
// when the deal was OPENED. Reloading fixed it, which is what made it
// dangerous: the text looked completely normal and nothing said it was stale.
//
// This drives that sequence with NO RELOAD anywhere in it. If the wiring ever
// comes out again, this goes red.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('lending options reaches compliance without a reload', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('a research criterion typed on LO appears in box five straight away', async ({ page }) => {
    test.setTimeout(120_000)
    // Something no deal would ever contain, so finding it in the box proves it
    // came from what was just typed and not from what was already there.
    const mark = `robot criterion ${Date.now()}`

    await page.goto(`/deals/${DEAL}`)
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })

    // --- 1. type it on the Lending options tab ------------------------------
    await page.getByRole('button', { name: /^Lending options$/ }).click()
    const add = page.getByPlaceholder('Add custom criteria and press Enter')
    await expect(add).toBeVisible({ timeout: 20_000 })
    await add.click()
    await add.pressSequentially(mark, { delay: 15 })
    await add.press('Enter')
    await expect(page.getByText(mark, { exact: false }).first()).toBeVisible({ timeout: 10_000 })

    // Long enough for the autosave to have gone out and come back.
    await page.waitForTimeout(4_000)

    try {
      // --- 2. straight to Compliance. NO RELOAD. ----------------------------
      await page.getByRole('button', { name: /^Compliance$/ }).click()
      await page.getByRole('button', { name: /Broker comments/ }).click()

      const field = page.getByLabel('Options presented & recommendation', { exact: true })
      await expect(field).toBeVisible({ timeout: 20_000 })
      const original = await field.inputValue()

      await field.click()
      await field.press('Meta+a')
      await field.press('Delete')

      // --- 3. write it from the deal ----------------------------------------
      await field.locator('xpath=following::button[contains(., "Write from the deal")][1]').click()
      await expect(field).not.toHaveValue('', { timeout: 10_000 })

      const text = await field.inputValue()

      // Box five only lists what the clients said mattered once a lender is
      // marked as recommended. On a deal without one it shouts instead, and
      // that is the box working correctly - there is nothing to prove here.
      if (/NOT RECORDED . which lender was recommended/i.test(text)) {
        test.skip(true, 'The test deal has no recommended lender on the LO, so box five lists no criteria.')
      }

      expect(text, 'Compliance composed from the lending options as they were when the deal was opened')
        .toContain(mark)

      // Put the box back however this went.
      await field.click()
      await field.press('Meta+a')
      await field.press('Delete')
      if (original) await field.fill(original)
      await page.waitForTimeout(2_000)
    } finally {
      // And take the criterion off the deal. It is on the LO tab, with a Remove
      // beside it - a custom one always is.
      try {
        await page.getByRole('button', { name: /^Lending options$/ }).click({ timeout: 10_000 })
        const row = page.locator('div').filter({ hasText: new RegExp(`^${mark}$`) }).last()
        await row.getByRole('button', { name: /Remove/ }).click({ timeout: 10_000 })
        await page.waitForTimeout(2_500)
      } catch { /* the next run makes its own marker; nothing here blocks anybody */ }
    }
  })
})
