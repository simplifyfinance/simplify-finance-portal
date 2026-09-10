import { test, expect } from '@playwright/test'

// THE DOCUMENTS BOX, PRESSED BY A ROBOT.
//
// 10 Sep 2026. Three changes went in: the add-a-document list carries every
// document the portal knows about, it is alphabetical, and it never offers
// something already on the deal's list. All three are things a unit test can
// only half prove - the list in lib/document-progress.ts is one thing, what is
// actually in the dropdown on a real deal is another.
//
// The datalist's popup is drawn by Chrome and cannot be read, but its <option>
// elements are in the DOM, so what is being OFFERED is testable even though the
// filtering as you type is the browser's own.
//
// READ ONLY. It opens the box, reads it, and closes the input again. It never
// ticks, never adds and never presses Request documents.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('the documents box', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('the add list is alphabetical and offers nothing already on the deal', async ({ page }) => {
    await page.goto(`/deals/${DEAL}`)
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })

    // The box is collapsed until somebody opens it.
    const header = page.getByRole('button', { name: /Documents/ }).first()
    await header.click()
    await page.waitForTimeout(800)

    // WHAT IS ON THE LIST. Every row label, as a person reads them.
    const rowText = await page.locator('text=/Asked for|On file|—/').allTextContents().catch(() => [])
    const bodyText = await page.locator('body').innerText()

    // Open the add input so the datalist renders.
    await page.getByRole('button', { name: /\+ Add a document/ }).click()
    const input = page.locator('input[list="doc-extras"]')
    await expect(input).toBeVisible({ timeout: 10_000 })

    const offered = await page.locator('#doc-extras option').evaluateAll(
      els => els.map(e => (e as HTMLOptionElement).value))

    console.log('\n' + '='.repeat(66))
    console.log(`THE ADD-A-DOCUMENT LIST — ${offered.length} offered`)
    console.log('='.repeat(66))
    offered.forEach(o => console.log('   ' + o))

    // 1. There is a real list.
    expect(offered.length).toBeGreaterThan(10)

    // 2. Alphabetical.
    const sorted = [...offered].sort((a, b) => a.localeCompare(b, 'en'))
    expect(offered, 'the offered list is not in alphabetical order').toEqual(sorted)

    // 3. NOTHING ALREADY ON THE LIST IS OFFERED AGAIN.
    //
    // Read from the page rather than from a fixture: whatever this deal happens
    // to be asking for must not appear in the dropdown. The statements carry the
    // bank on the end, so the prefix is checked too.
    const doubled = offered.filter(o =>
      new RegExp(`^\\s*${o.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(\\s+—|\\s*$)`, 'mi').test(bodyText))
    console.log(doubled.length
      ? `\n!! OFFERED DESPITE BEING ON THE LIST: ${doubled.join(', ')}`
      : '\nNothing offered that is already on the deal.')
    expect(doubled, `these are on the list and still offered: ${doubled.join(', ')}`).toHaveLength(0)

    // Put the input away without adding anything.
    await input.press('Escape')

    // 4. WHETHER THE STATEMENTS ARE DOING THEIR JOB ON THIS DEAL.
    //
    // Only reported, not asserted - the test deal may have no statements
    // uploaded, and that is not a fault in the code.
    const onFile = (bodyText.match(/On file — .*statements came through[^\n]*/g) || [])
    const short = (bodyText.match(/but only \d+ days of them/g) || [])
    console.log('\n' + '='.repeat(66))
    console.log('STATEMENT COVER ON THIS DEAL')
    console.log('='.repeat(66))
    if (onFile.length) {
      console.log(`${onFile.length} document(s) crossed off by uploaded statements:`)
      onFile.forEach(l => console.log('   ✓ ' + l.trim()))
      if (short.length) console.log(`   (${short.length} of them short of the period asked for)`)
    } else {
      console.log('No statements uploaded on this deal, so nothing was crossed off.')
      console.log('Drop the CashDeck summary into the Statements tab to see this work.')
    }
    console.log('='.repeat(66) + '\n')

    await page.screenshot({ path: 'test-results/documents-box.png', fullPage: true })
    void rowText
  })
})
