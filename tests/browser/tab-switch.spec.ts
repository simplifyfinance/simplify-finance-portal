import { test, expect, type Page } from '@playwright/test'

// CHANGING TAB MUST NOT THROW AWAY WHAT YOU JUST TYPED.
//
// 14 Sep 2026, Aaron Hooper. Somebody finished the lending recommendations,
// clicked the BC tab to copy the important notes, came back to LO, and the whole
// lot was gone.
//
// Three of the four tabs ended their autosave with a line that CANCELLED the
// pending write when the form left the screen. Changing tab is exactly that. So
// anything typed in the last 700ms was deliberately discarded - not overwritten,
// not lost to somebody else, thrown away by us - and coming back loaded the last
// version that did save.
//
// It is the most ordinary action in the portal and nothing tested it.
//
// It writes into the notes boxes on each tab, records what it found first, and
// puts everything back.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

// Tab, and a box on that tab a robot may safely write in.
const TABS = ['Lending options', 'BC — Borrowing capacity', 'Compliance', 'Fact Find']

async function open(page: Page) {
  await page.goto(`/deals/${DEAL}`)
  await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })
}
// The box this test writes in, per tab. Named where a name exists, so the same
// box is found on the way back.
function boxOn(page: Page, tab: string) {
  if (tab === 'Lending options') return page.getByPlaceholder('One note per line...')
  const boxes = page.locator('textarea:visible')
  return boxes.last()
}

const tabButton = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}$`) })

test.describe('changing tab', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')
  test.setTimeout(120_000)

  for (const tab of TABS) {
    test(`${tab}: typing, then straight to another tab and back`, async ({ page }) => {
      const mark = `tabswitch${Date.now().toString().slice(-6)}`
      let original: string | null = null

      try {
        await open(page)
        if (await tabButton(page, tab).count() === 0) test.skip(true, `No ${tab} tab on this deal.`)
        await tabButton(page, tab).first().click()

        // A BOX WITH A NAME, NOT A POSITION.
        //
        // This used the LAST textarea on the tab. On Lending options the number
        // of boxes changes between visits - an email preview comes and goes - so
        // "the last one" was a different box on the way back, and the test failed
        // on a difference it had created itself. On LO it now uses the Important
        // notes box by name, which is the box Aaron Hooper's was lost from.
        const target = boxOn(page, tab)
        await target.waitFor({ timeout: 20_000 })
        original = await target.inputValue()
        await target.fill(`${original}\n${mark}`)

        // STRAIGHT AWAY. Inside the save delay - which is the whole point, and
        // exactly what somebody does when they go to copy something.
        await page.waitForTimeout(150)
        const other = tab === 'Fact Find' ? 'Lending options' : 'Fact Find'
        if (await tabButton(page, other).count() > 0) {
          await tabButton(page, other).first().click()
          await page.waitForTimeout(2500)
        }

        // And back.
        await tabButton(page, tab).first().click()
        await page.waitForTimeout(2500)
        await boxOn(page, tab).waitFor({ timeout: 20_000 })
        const afterReturn = await boxOn(page, tab).inputValue()

        // And really in the database, not just still on the screen.
        await open(page)
        await tabButton(page, tab).first().click()
        await boxOn(page, tab).waitFor({ timeout: 20_000 })
        const stored = await boxOn(page, tab).inputValue()

        console.log('\n' + '='.repeat(70))
        console.log(`${tab} — typed, changed tab within 150ms, came back`)
        console.log(`  still there when you come back : ${afterReturn.includes(mark) ? 'yes' : 'NO'}`)
        console.log(`  actually saved                 : ${stored.includes(mark) ? 'yes' : 'NO - thrown away'}`)
        console.log('='.repeat(70) + '\n')

        expect(afterReturn, `${tab}: coming back to the tab showed an older version`).toContain(mark)
        expect(stored, `${tab}: changing tab threw away what was just typed`).toContain(mark)
      } finally {
        try {
          if (original !== null) {
            await open(page)
            await tabButton(page, tab).first().click()
            await boxOn(page, tab).waitFor({ timeout: 10_000 })
            await boxOn(page, tab).fill(original)
            await page.waitForTimeout(3000)
          }
        } catch { /* reported by the assertions above */ }
      }
    })
  }
})
