import { test, expect } from '@playwright/test'

// THE ROBOT OPENS WESLEY PERROTT'S COMPLIANCE TAB.
//
// 10 Sep 2026. Melissa gets "This page couldn't load" on that one tab of that
// one deal. I laid defaults under the stored record (c5fc20f) and the crash did
// not move. I then ran thirty-one library functions against his real record and
// every one of them passed - so the throw is in the JSX, not in a library, and
// no amount of reading files was going to name the line.
//
// Fabio, 10 Sep 2026: "why waiting for mellissa you have a robot test it!"
//
// He is right. This opens the deal he cannot open, presses the tab he cannot
// press, and prints three things a person cannot get at without the console:
//
//   1. the uncaught error and its stack, straight off the page
//   2. whatever TabBoundary caught, including the component that threw
//   3. any console error, in case it fires before the boundary sees it
//
// IT DOES NOT ASSERT ITS WAY TO A PASS. It exists to say what broke. It fails
// loudly if the tab is broken and passes quietly once it is not, which makes it
// worth keeping afterwards as the regression test for this exact deal.
//
// READ ONLY, DELIBERATELY. This is a real client's file, not the test deal.
// Nothing here types, clicks a save, or presses a compose button.

const WESLEY = process.env.PORTAL_WESLEY_DEAL_ID || '687e36af-9457-4bdc-bfe0-e870755d9ebe'

test.describe('Wesley Perrott — the compliance tab that will not open', () => {
  test('the compliance tab draws, and says what broke if it does not', async ({ page }) => {
    const thrown: string[] = []
    const consoleErrors: string[] = []

    // pageerror is the uncaught render throw itself, with the real stack. React
    // strips its own messages in production; it does not strip ours.
    page.on('pageerror', err => {
      thrown.push(`${err.name}: ${err.message}\n${(err.stack || '').split('\n').slice(0, 12).join('\n')}`)
    })
    // TabBoundary logs the component stack here, whole.
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 2000))
    })

    await page.goto(`/deals/${WESLEY}`)
    await page.locator('[data-ready="1"]').waitFor({ timeout: 30_000 })

    // The deal itself loaded. If this fails the problem is not the tab.
    console.log('\n  Deal page loaded. Opening Compliance…')
    await page.getByRole('button', { name: /^Compliance$/ }).click()

    // Give the render - and the boundary, and any effect that throws a tick
    // later - time to happen.
    await page.waitForTimeout(4000)

    // WHAT THE BOUNDARY CAUGHT.
    const panel = page.getByText('tab could not be drawn')
    const caught = await panel.count()
    let boundaryText = ''
    if (caught > 0) {
      boundaryText = (await panel.locator('xpath=ancestor::div[1]').innerText().catch(() => '')) ||
        (await page.locator('body').innerText())
    }

    console.log('\n' + '='.repeat(72))
    console.log('WESLEY PERROTT — COMPLIANCE TAB')
    console.log('='.repeat(72))

    if (thrown.length) {
      console.log('\nUNCAUGHT ERROR(S) ON THE PAGE:')
      for (const t of thrown) console.log('\n' + t)
    } else {
      console.log('\nNo uncaught error reached the page.')
    }

    if (boundaryText) {
      console.log('\nTHE BOUNDARY CAUGHT IT. Panel says:\n')
      console.log(boundaryText)
    } else {
      console.log('\nThe boundary did not fire — the tab drew.')
    }

    if (consoleErrors.length) {
      console.log('\nCONSOLE ERRORS (the component stack is in here):')
      for (const c of consoleErrors.slice(0, 6)) console.log('\n---\n' + c)
    }
    console.log('\n' + '='.repeat(72) + '\n')

    // A screenshot for the record either way.
    await page.screenshot({ path: 'test-results/wesley-compliance.png', fullPage: true })

    // NOW THE ACTUAL TEST. The tab is meant to draw. If it did not, this fails
    // with everything above already printed.
    expect(thrown, `The compliance tab threw:\n${thrown.join('\n\n')}`).toHaveLength(0)
    expect(caught, `TabBoundary caught a render error:\n${boundaryText}`).toBe(0)

    // And the thing Melissa is there to do is on the screen.
    await expect(page.getByRole('button', { name: /Needs & objectives/ })).toBeVisible({ timeout: 15_000 })
  })
})
