# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boxone-twice.spec.ts >> pressing it twice >> report what happens between the two presses
- Location: tests/browser/boxone-twice.spec.ts:14:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-ready="1"]') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img "Simplify Finance" [ref=e5]
      - heading "Simplify Finance" [level=1] [ref=e6]
      - paragraph [ref=e7]: Sign in to your portal
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]: Email
        - textbox "you@simplifyfinance.com.au" [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: Password
          - button "Forgot password?" [ref=e15]
        - textbox "••••••••" [ref=e16]
      - button "Sign in" [ref=e17]
    - paragraph [ref=e18]: Access is by invitation only. Contact your administrator.
  - alert [ref=e19]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | // PRESSING THE BOX ONE BUTTON TWICE EMPTIES THE BOX. WHY?
  4  | //
  5  | // 10 Sep 2026: every other box one test passes. This one fails with the box
  6  | // empty after a second press. I am not going to guess at the cause again - this
  7  | // prints what the page does between the two presses.
  8  | 
  9  | const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''
  10 | 
  11 | test.describe('pressing it twice', () => {
  12 |   test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local.')
  13 | 
  14 |   test('report what happens between the two presses', async ({ page }) => {
  15 |     const log: string[] = []
  16 |     page.on('console', m => log.push(`${m.type()}: ${m.text()}`.slice(0, 200)))
  17 |     page.on('pageerror', e => log.push(`PAGE ERROR: ${e.message}`.slice(0, 300)))
  18 | 
  19 |     await page.goto(`/deals/${DEAL}`)
  20 |     // The page is HTML before it is a page. See data-ready in DealPageClient -
  21 |     // a click before this appears goes nowhere, which is a race, not a bug in
  22 |     // whatever was clicked.
> 23 |     await page.locator('[data-ready="1"]').waitFor({ timeout: 20_000 })
     |                                            ^ Error: locator.waitFor: Test timeout of 60000ms exceeded.
  24 |     await page.getByRole('button', { name: /^Compliance$/ }).click()
  25 |     await page.getByRole('button', { name: /Needs & objectives/ }).click()
  26 | 
  27 |     const box = page.getByLabel(/Primary reasons for seeking credit/i)
  28 |     await expect(box).toBeVisible({ timeout: 20_000 })
  29 |     const button = page.getByRole('button', { name: /Write from the deal/i })
  30 | 
  31 |     const say = (t: string) => console.log(t)
  32 |     const peek = async (when: string) => {
  33 |       const n = await page.getByLabel(/Primary reasons for seeking credit/i).count()
  34 |       const v = n === 1 ? await box.inputValue() : '(cannot read - see count)'
  35 |       say(`${when.padEnd(26)} boxes:${n}  buttons:${await button.count()}  length:${String(v).length}  ${JSON.stringify(String(v).slice(0, 70))}`)
  36 |       return v
  37 |     }
  38 | 
  39 |     say('\n──────────── PRESSING IT TWICE ────────────')
  40 |     await peek('before any press')
  41 | 
  42 |     await button.click()
  43 |     await page.waitForTimeout(300)
  44 |     const first = await peek('300ms after press one')
  45 |     await page.waitForTimeout(1200)
  46 |     await peek('1.5s after press one')
  47 |     await page.waitForTimeout(2000)
  48 |     await peek('3.5s after press one')
  49 | 
  50 |     await button.click()
  51 |     await page.waitForTimeout(100)
  52 |     await peek('100ms after press two')
  53 |     await page.waitForTimeout(400)
  54 |     const second = await peek('500ms after press two')
  55 |     await page.waitForTimeout(2000)
  56 |     await peek('2.5s after press two')
  57 | 
  58 |     say('\n──────────── CONSOLE ────────────')
  59 |     say(log.length ? log.slice(-20).join('\n') : '  nothing')
  60 |     say('───────────────────────────────────────\n')
  61 | 
  62 |     expect(second, 'the second press emptied the box').toBe(first)
  63 |   })
  64 | })
  65 | 
```