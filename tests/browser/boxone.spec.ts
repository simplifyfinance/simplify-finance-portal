import { test, expect } from '@playwright/test'

// BOX ONE, PRESSED BY A ROBOT.
//
// Box one is composed rather than generated - lib/box-one.ts - and it has 36
// unit tests. None of those prove the button on the screen is wired to it, that
// the text lands in the box, or that the gap list appears. That is what this
// does: press the thing a person presses, read what a person reads.
//
// It writes to the test deal on purpose. That is what the test deal is for.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('box one — primary reasons for seeking credit', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local, and run ./scripts/portal-login.sh once.')

  test('the button writes a paragraph built from the deal', async ({ page }) => {
    await page.goto(`/deals/${DEAL}`)
    // The page is HTML before it is a page. See data-ready in DealPageClient -
    // a click before this appears goes nowhere, which is a race, not a bug in
    // whatever was clicked.
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Compliance$/ }).click()
    await page.getByRole('button', { name: /Needs & objectives/ }).click()

    const box = page.getByLabel(/Primary reasons for seeking credit/i)
    await expect(box).toBeVisible({ timeout: 20_000 })

    // Emptied first, so what we read afterwards cannot be what was already there.
    await box.click()
    await box.press('Meta+a')
    await box.press('Delete')
    expect(await box.inputValue()).toBe('')

    // The button no longer says "Generate with AI", because no AI writes this.
    // THREE BOXES, THREE BUTTONS, THE SAME WORDS ON EACH.
    // Boxes 2 and 3 got the same button on 10 Sep, so this has to say which
    // one it means. Box one is the first.
    await page.getByRole('button', { name: /Write from the deal/i }).first().click()

    // Composed, so it is instant - no network call, nothing to wait for.
    await expect(box).not.toHaveValue('', { timeout: 5_000 })
    const text = await box.inputValue()

    // THE THINGS THAT MUST NEVER APPEAR IN A COMPLIANCE PARAGRAPH.
    //
    // Every one of these has been on a real file at some point: a raw database
    // key, an empty income, a placeholder, a dollar sign with nothing after it.
    expect(text).not.toMatch(/oo_purchase|lo_purchase|investment_equity|refinance_only|refinance_equity/)
    expect(text).not.toMatch(/\$XXX|\[calculated\]|\[Client|undefined|NaN/)
    expect(text).not.toMatch(/Income: \$ |\$ base|\$,|\$\./)
    expect(text).not.toMatch(/ {2}|\.\.|,,/)

    // It has to actually say something about this deal, not just be non-empty.
    expect(text.length).toBeGreaterThan(200)

    // A FIGURE, OR A REASON THERE ISN'T ONE.
    //
    // This asked flatly for a dollar amount, and failed on 10 Sep against a test
    // deal that has no loan amount recorded - where saying so loudly is the
    // correct answer and a figure would have been invented. So: a figure, or the
    // shout explaining its absence. Never silence.
    if (/NOT RECORDED — no loan amount/.test(text)) expect(text).toContain('** NOT RECORDED')
    else expect(text).toMatch(/\$[\d,]{5,}/)
  })

  test('the same deal writes the same words every time', async ({ page }) => {
    // The wording varies across the book and never within one file - otherwise
    // pressing the button twice rewords a file underneath the team.
    await page.goto(`/deals/${DEAL}`)
    // The page is HTML before it is a page. See data-ready in DealPageClient -
    // a click before this appears goes nowhere, which is a race, not a bug in
    // whatever was clicked.
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Compliance$/ }).click()
    await page.getByRole('button', { name: /Needs & objectives/ }).click()
    const box = page.getByLabel(/Primary reasons for seeking credit/i)
    await expect(box).toBeVisible({ timeout: 20_000 })

    // THREE BOXES, THREE BUTTONS, THE SAME WORDS ON EACH.
    // Boxes 2 and 3 got the same button on 10 Sep, so this has to say which
    // one it means. Box one is the first.
    await page.getByRole('button', { name: /Write from the deal/i }).first().click()
    await expect(box).not.toHaveValue('', { timeout: 5_000 })
    const first = await box.inputValue()

    // THREE BOXES, THREE BUTTONS, THE SAME WORDS ON EACH.
    // Boxes 2 and 3 got the same button on 10 Sep, so this has to say which
    // one it means. Box one is the first.
    await page.getByRole('button', { name: /Write from the deal/i }).first().click()
    await page.waitForTimeout(500)
    expect(await box.inputValue()).toBe(first)
  })

  test('a gap is shouted, on the screen and in the text', async ({ page }) => {
    // Only meaningful when the test deal actually has a gap. When it has none,
    // the paragraph must not be shouting either - both directions are checked.
    await page.goto(`/deals/${DEAL}`)
    // The page is HTML before it is a page. See data-ready in DealPageClient -
    // a click before this appears goes nowhere, which is a race, not a bug in
    // whatever was clicked.
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Compliance$/ }).click()
    await page.getByRole('button', { name: /Needs & objectives/ }).click()
    const box = page.getByLabel(/Primary reasons for seeking credit/i)
    await expect(box).toBeVisible({ timeout: 20_000 })

    // THREE BOXES, THREE BUTTONS, THE SAME WORDS ON EACH.
    // Boxes 2 and 3 got the same button on 10 Sep, so this has to say which
    // one it means. Box one is the first.
    await page.getByRole('button', { name: /Write from the deal/i }).first().click()
    await expect(box).not.toHaveValue('', { timeout: 5_000 })
    const text = await box.inputValue()
    const shouting = /\*\* NOT RECORDED|\*\* ONLY ONE LENDER|\*\* NO RECOMMENDED/.test(text)
    const list = page.getByText(/Recorded nowhere/)

    if (shouting) await expect(list).toBeVisible()
    else await expect(list).toHaveCount(0)
  })

  test('the fact find turns red when the purpose is missing', async ({ page }) => {
    await page.goto(`/deals/${DEAL}`)
    // The page is HTML before it is a page. See data-ready in DealPageClient -
    // a click before this appears goes nowhere, which is a race, not a bug in
    // whatever was clicked.
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Fact Find$/ }).click()
    const purpose = page.getByLabel(/Purpose of loan/i)
    await expect(purpose).toBeVisible({ timeout: 20_000 })

    const filled = (await purpose.inputValue()).trim().length > 0
    const warning = page.getByText(/Compliance box 1 cannot be written without this/)
    if (filled) await expect(warning).toHaveCount(0)
    else await expect(warning).toBeVisible()
  })
})

// BOXES TWO AND THREE, PRESSED THE SAME WAY.
//
// Same button, same composer, same rules. This is deliberately short: the
// wording is covered by 28 unit tests in lib/box-goals.test.ts, and what a
// browser adds is proof that the button on the screen reaches them at all.
test.describe('boxes two and three', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  for (const [label, box] of [
    ['Immediate needs & objectives — next 2 years', 'two'],
    ['Longer term — 2 to 10 years', 'three'],
  ]) {
    test(`box ${box} writes a paragraph built from the deal`, async ({ page }) => {
      await page.goto(`/deals/${DEAL}`)
      await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
      await page.getByRole('button', { name: /^Compliance$/ }).click()
      await page.getByRole('button', { name: /Needs & objectives/ }).click()

      const field = page.getByLabel(label)
      await expect(field).toBeVisible({ timeout: 20_000 })
      await field.click()
      await field.press('Meta+a')
      await field.press('Delete')

      // Each box has its own button; the one directly under this field.
      await page.getByRole('button', { name: /Write from the deal/i })
        .nth(box === 'two' ? 1 : 2).click()
      await expect(field).not.toHaveValue('', { timeout: 5_000 })

      const text = await field.inputValue()
      expect(text).not.toMatch(/oo_purchase|investment_equity|undefined|NaN|\[calculated\]|\$XXX/)
      expect(text).not.toMatch(/ {2}|\.\.|,,/)
      expect(text.length).toBeGreaterThan(80)
    })
  }
})
