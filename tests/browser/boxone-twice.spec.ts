import { test, expect } from '@playwright/test'

// PRESSING THE BOX ONE BUTTON TWICE EMPTIES THE BOX. WHY?
//
// 10 Sep 2026: every other box one test passes. This one fails with the box
// empty after a second press. I am not going to guess at the cause again - this
// prints what the page does between the two presses.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('pressing it twice', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('report what happens between the two presses', async ({ page }) => {
    const log: string[] = []
    page.on('console', m => log.push(`${m.type()}: ${m.text()}`.slice(0, 200)))
    page.on('pageerror', e => log.push(`PAGE ERROR: ${e.message}`.slice(0, 300)))

    await page.goto(`/deals/${DEAL}`)
    // The page is HTML before it is a page. See data-ready in DealPageClient -
    // a click before this appears goes nowhere, which is a race, not a bug in
    // whatever was clicked.
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Compliance$/ }).click()
    await page.getByRole('button', { name: /Needs & objectives/ }).click()

    const box = page.getByLabel(/Primary reasons for seeking credit/i)
    await expect(box).toBeVisible({ timeout: 20_000 })
    const button = page.getByRole('button', { name: /Write from the deal/i })

    const say = (t: string) => console.log(t)
    const peek = async (when: string) => {
      const n = await page.getByLabel(/Primary reasons for seeking credit/i).count()
      const v = n === 1 ? await box.inputValue() : '(cannot read - see count)'
      say(`${when.padEnd(26)} boxes:${n}  buttons:${await button.count()}  length:${String(v).length}  ${JSON.stringify(String(v).slice(0, 70))}`)
      return v
    }

    say('\n──────────── PRESSING IT TWICE ────────────')
    await peek('before any press')

    await button.click()
    await page.waitForTimeout(300)
    const first = await peek('300ms after press one')
    await page.waitForTimeout(1200)
    await peek('1.5s after press one')
    await page.waitForTimeout(2000)
    await peek('3.5s after press one')

    await button.click()
    await page.waitForTimeout(100)
    await peek('100ms after press two')
    await page.waitForTimeout(400)
    const second = await peek('500ms after press two')
    await page.waitForTimeout(2000)
    await peek('2.5s after press two')

    say('\n──────────── CONSOLE ────────────')
    say(log.length ? log.slice(-20).join('\n') : '  nothing')
    say('───────────────────────────────────────\n')

    expect(second, 'the second press emptied the box').toBe(first)
  })
})
