import { test, expect, type Page } from '@playwright/test'

// WHY DOES NOTHING SAVE? — a diagnostic, not a gate.
//
// On 10 Sep the robot found two things on the BC that fit together: the page
// never printed its "Autosaved" stamp, and a note typed into the broker summary
// did not survive a reload - the box came back holding text from an earlier run.
// The letters themselves were all present on screen the whole time, so this is
// not the dropped-keystroke fault. It is worse: typing that looks perfect and
// never lands.
//
// This test does not assert much. It types, then prints everything the page said
// and everything it sent while it was doing it, so the cause is on the screen
// instead of being guessed at.

const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''

test.describe('what happens when the BC tries to save', () => {
  test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')

  test('type a sentence and report every word the page says about it', async ({ page }) => {
    const console_: string[] = []
    const failures: string[] = []
    const writes: string[] = []

    page.on('console', m => console_.push(`${m.type()}: ${m.text()}`.slice(0, 300)))
    page.on('pageerror', e => failures.push(`PAGE ERROR: ${e.message}`.slice(0, 300)))
    page.on('requestfailed', r => failures.push(`REQUEST FAILED: ${r.method()} ${r.url().slice(0, 120)} — ${r.failure()?.errorText}`))

    // Every write to the deals table, and what came back.
    page.on('response', async r => {
      const u = r.url()
      if (!/\/rest\/v1\/deals/.test(u)) return
      const method = r.request().method()
      if (method === 'GET') return
      let body = ''
      try { body = (await r.text()).slice(0, 240) } catch { body = '(unreadable)' }
      writes.push(`${method} ${r.status()} ${r.statusText()} :: ${body}`)
    })

    await page.goto(`/deals/${DEAL}`)
    // The page is HTML before it is a page. See data-ready in DealPageClient -
    // a click before this appears goes nowhere, which is a race, not a bug in
    // whatever was clicked.
    await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /BC — Borrowing capacity/ }).click()
    const box = page.getByLabel(/Broker summary notes/i)
    await expect(box).toBeVisible({ timeout: 20_000 })

    const MARK = `Save check ${new Date().toISOString()}.`
    await box.click()
    await box.press('Meta+a')
    await box.press('Delete')
    await box.pressSequentially(MARK, { delay: 20 })

    // On screen, before anything else happens.
    const onScreen = await box.inputValue()

    // Long enough for a 700ms debounce several times over.
    await page.waitForTimeout(6_000)

    const stamp = await page.getByText(/Autosaved/).count()
    const errorOnScreen = await page.locator('.text-red-600, .text-red-500').allTextContents()
    const stillOnScreen = await box.inputValue()

    await page.reload()
    await expect(page.getByLabel(/Broker summary notes/i)).toBeVisible({ timeout: 20_000 })
    const afterReload = await page.getByLabel(/Broker summary notes/i).inputValue()

    const say = (t: string) => console.log(t)
    say('\n──────────── WHAT HAPPENED ────────────')
    say(`typed:          ${JSON.stringify(MARK)}`)
    say(`on screen:      ${JSON.stringify(onScreen)}`)
    say(`still there 6s: ${JSON.stringify(stillOnScreen)}`)
    say(`after reload:   ${JSON.stringify(afterReload)}`)
    say(`"Autosaved" on screen: ${stamp > 0 ? 'yes' : 'NO'}`)
    say(`red text on screen: ${JSON.stringify(errorOnScreen.filter(Boolean).slice(0, 6))}`)
    say('\n──────────── WRITES TO THE DEALS TABLE ────────────')
    say(writes.length ? writes.join('\n') : '  NONE. The page never tried to save.')
    say('\n──────────── ERRORS ────────────')
    say(failures.length ? failures.join('\n') : '  none')
    say('\n──────────── CONSOLE ────────────')
    say(console_.filter(l => !/^log: $/.test(l)).slice(-25).join('\n') || '  nothing')
    say('───────────────────────────────────────\n')

    // The one thing that must be true. Everything above is here to explain it
    // when it is not.
    expect(afterReload, 'the note did not survive a reload').toBe(MARK)
  })
})
