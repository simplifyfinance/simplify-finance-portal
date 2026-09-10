# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boxone.spec.ts >> box one — primary reasons for seeking credit >> the fact find turns red when the purpose is missing
- Location: tests/browser/boxone.spec.ts:89:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel(/Purpose of loan/i)
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByLabel(/Purpose of loan/i) with timeout 20000ms
  - waiting for getByLabel(/Purpose of loan/i)

```

```yaml
- complementary:
  - img "Simplify Finance"
  - text: Credit & Compliance Portal
  - navigation:
    - text: Main
    - link "Dashboard":
      - /url: /dashboard
    - link "Deals":
      - /url: /deals
    - link "Pipeline Expand":
      - /url: /pipeline
      - text: Pipeline
      - button "Expand":
        - img
    - link "Settlements":
      - /url: /settlements
    - link "Clients":
      - /url: /clients
    - link "Lender library Expand":
      - /url: /lenders
      - text: Lender library
      - button "Expand":
        - img
    - link "Templates":
      - /url: /templates
    - link "Reports":
      - /url: /reports
    - link "Cheat sheet":
      - /url: /cheat-sheet
    - text: Admin
    - link "Commissions Expand":
      - /url: /commissions
      - text: Commissions
      - button "Expand":
        - img
    - link "Team workload":
      - /url: /credit-team-workload
    - link "Team":
      - /url: /team
    - link "Settings Expand":
      - /url: /settings
      - text: Settings
      - button "Expand":
        - img
  - text: FD Fabio De Castro Admin
  - button "Sign out"
- main:
  - button "Back to deals"
  - text: TestFabioKylie Test 2026
  - button "History"
  - button "✎ Edit"
  - text: Broker Fabio Scenario OO purchase Waiting on Broker to complete BC Deal
  - link "Summary":
    - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073/summary
    - img
    - text: Summary
  - button "Clone":
    - img
    - text: Clone
  - button "Close deal":
    - img
    - text: Close deal
  - img
  - text: Fact Find 07 Sept BC with broker Lending Options Compliance Lodged Preapproved Offer accepted Formal Contracts returned Settlement booked Settled
  - button "Documents 6 to request of 6 on the list 1 to check Show"
  - button "Fact Find"
  - button "Statements"
  - button "BC — Borrowing capacity"
  - button "Lending options"
  - button "Compliance"
  - img
  - text: Internal notes
  - paragraph: The same notes on every tab of this deal — not client facing
  - textbox "Jot notes while on the phone with the client..."
  - img
  - text: Drop the fact find PDF here AI will extract the client details Attached documents + Add
  - paragraph: Fact finds, screenshots, rate sheets.
  - img
  - text: Drop documents here as many at once as you like
  - paragraph: No documents yet.
  - text: Deal links OneDrive folder
  - textbox "Paste OneDrive folder URL..."
  - text: SalesTrekker card
  - textbox "Paste SalesTrekker deal URL..."
  - text: SalesTrekker BCC code
  - textbox "e.g. deal-12345@salestrekker.com"
  - button "Personal & address"
  - button "Employment"
  - button "Income"
  - button "Other assets"
  - button "Properties"
  - button "Liabilities"
  - button "TestFabioKylie"
  - button "+ Add applicant"
  - img
  - text: Dependants
  - spinbutton: "0"
  - text: Purpose and goals ⚠
  - paragraph: 3 of these three are not recorded. They go straight onto the compliance file, and it cannot be written properly without them.
  - text: Where is the deposit coming from?
  - combobox:
    - option "Select" [selected]
    - option "Savings"
    - option "Gift"
    - option "Sale of a property"
    - option "Sale of another asset"
    - option "Equity release"
    - option "Inheritance"
    - option "First Home Super Saver"
    - option "Other"
  - text: Purpose of loan / primary reason for finance● Required
  - textbox "What the client told you they want this loan for..."
  - paragraph: Compliance box 1 cannot be written without this
  - text: Goals — next 2 years● Required
  - textbox "Client's own stated short-term plans..."
  - paragraph: Compliance box 2 cannot be written without this
  - text: Goals — 2 to 10 years● Required
  - textbox "Client's own stated long-term plans..."
  - paragraph: Compliance box 3 cannot be written without this
  - text: Personal details Title
  - combobox:
    - option "— select —" [selected]
    - option "Mr"
    - option "Mrs"
    - option "Ms"
    - option "Miss"
    - option "Dr"
    - option "Prof"
  - text: First name
  - textbox: TestFabioKylie
  - text: Middle name
  - textbox
  - text: Last name
  - textbox: Test
  - text: Preferred name
  - textbox
  - text: Previous name
  - textbox
  - text: Gender
  - combobox:
    - option "Select" [selected]
    - option "Male"
    - option "Female"
    - option "Other"
  - text: Date of birth
  - textbox
  - text: Phone mobile
  - textbox
  - text: Email
  - textbox
  - text: Residency status
  - combobox:
    - option "Select" [selected]
    - option "Australian citizen"
    - option "Permanent resident"
    - option "New Zealand citizen"
    - option "Temporary visa"
    - option "Non-resident"
  - text: Relationship status
  - combobox:
    - option "Select" [selected]
    - option "Single"
    - option "Married"
    - option "De facto"
    - option "Separated"
    - option "Divorced"
    - option "Widowed"
  - text: Address history Current address
  - textbox "Search address"
  - combobox:
    - option "Residential status" [selected]
    - option "Renting"
    - option "Owner"
    - option "Boarding"
    - option "Living with family"
  - text: Move-in date
  - textbox
  - text: 0 months of address history recorded — add a previous address to reach the required 24 months.
  - button "+ Add previous address"
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | // BOX ONE, PRESSED BY A ROBOT.
  4   | //
  5   | // Box one is composed rather than generated - lib/box-one.ts - and it has 36
  6   | // unit tests. None of those prove the button on the screen is wired to it, that
  7   | // the text lands in the box, or that the gap list appears. That is what this
  8   | // does: press the thing a person presses, read what a person reads.
  9   | //
  10  | // It writes to the test deal on purpose. That is what the test deal is for.
  11  | 
  12  | const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''
  13  | 
  14  | test.describe('box one — primary reasons for seeking credit', () => {
  15  |   test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local, and run ./scripts/portal-login.sh once.')
  16  | 
  17  |   test('the button writes a paragraph built from the deal', async ({ page }) => {
  18  |     await page.goto(`/deals/${DEAL}`)
  19  |     await page.getByRole('button', { name: /^Compliance$/ }).click()
  20  |     await page.getByRole('button', { name: /Needs & objectives/ }).click()
  21  | 
  22  |     const box = page.getByLabel(/Primary reasons for seeking credit/i)
  23  |     await expect(box).toBeVisible({ timeout: 20_000 })
  24  | 
  25  |     // Emptied first, so what we read afterwards cannot be what was already there.
  26  |     await box.click()
  27  |     await box.press('Meta+a')
  28  |     await box.press('Delete')
  29  |     expect(await box.inputValue()).toBe('')
  30  | 
  31  |     // The button no longer says "Generate with AI", because no AI writes this.
  32  |     await page.getByRole('button', { name: /Write from the deal/i }).click()
  33  | 
  34  |     // Composed, so it is instant - no network call, nothing to wait for.
  35  |     await expect(box).not.toHaveValue('', { timeout: 5_000 })
  36  |     const text = await box.inputValue()
  37  | 
  38  |     // THE THINGS THAT MUST NEVER APPEAR IN A COMPLIANCE PARAGRAPH.
  39  |     //
  40  |     // Every one of these has been on a real file at some point: a raw database
  41  |     // key, an empty income, a placeholder, a dollar sign with nothing after it.
  42  |     expect(text).not.toMatch(/oo_purchase|lo_purchase|investment_equity|refinance_only|refinance_equity/)
  43  |     expect(text).not.toMatch(/\$XXX|\[calculated\]|\[Client|undefined|NaN/)
  44  |     expect(text).not.toMatch(/Income: \$ |\$ base|\$,|\$\./)
  45  |     expect(text).not.toMatch(/ {2}|\.\.|,,/)
  46  | 
  47  |     // It has to actually say something about this deal, not just be non-empty.
  48  |     expect(text.length).toBeGreaterThan(200)
  49  |     expect(text).toMatch(/\$[\d,]{5,}/)
  50  |   })
  51  | 
  52  |   test('the same deal writes the same words every time', async ({ page }) => {
  53  |     // The wording varies across the book and never within one file - otherwise
  54  |     // pressing the button twice rewords a file underneath the team.
  55  |     await page.goto(`/deals/${DEAL}`)
  56  |     await page.getByRole('button', { name: /^Compliance$/ }).click()
  57  |     await page.getByRole('button', { name: /Needs & objectives/ }).click()
  58  |     const box = page.getByLabel(/Primary reasons for seeking credit/i)
  59  |     await expect(box).toBeVisible({ timeout: 20_000 })
  60  | 
  61  |     await page.getByRole('button', { name: /Write from the deal/i }).click()
  62  |     await expect(box).not.toHaveValue('', { timeout: 5_000 })
  63  |     const first = await box.inputValue()
  64  | 
  65  |     await page.getByRole('button', { name: /Write from the deal/i }).click()
  66  |     await page.waitForTimeout(500)
  67  |     expect(await box.inputValue()).toBe(first)
  68  |   })
  69  | 
  70  |   test('a gap is shouted, on the screen and in the text', async ({ page }) => {
  71  |     // Only meaningful when the test deal actually has a gap. When it has none,
  72  |     // the paragraph must not be shouting either - both directions are checked.
  73  |     await page.goto(`/deals/${DEAL}`)
  74  |     await page.getByRole('button', { name: /^Compliance$/ }).click()
  75  |     await page.getByRole('button', { name: /Needs & objectives/ }).click()
  76  |     const box = page.getByLabel(/Primary reasons for seeking credit/i)
  77  |     await expect(box).toBeVisible({ timeout: 20_000 })
  78  | 
  79  |     await page.getByRole('button', { name: /Write from the deal/i }).click()
  80  |     await expect(box).not.toHaveValue('', { timeout: 5_000 })
  81  |     const text = await box.inputValue()
  82  |     const shouting = /\*\* NOT RECORDED|\*\* ONLY ONE LENDER|\*\* NO RECOMMENDED/.test(text)
  83  |     const list = page.getByText(/Recorded nowhere/)
  84  | 
  85  |     if (shouting) await expect(list).toBeVisible()
  86  |     else await expect(list).toHaveCount(0)
  87  |   })
  88  | 
  89  |   test('the fact find turns red when the purpose is missing', async ({ page }) => {
  90  |     await page.goto(`/deals/${DEAL}`)
  91  |     await page.getByRole('button', { name: /^Fact Find$/ }).click()
  92  |     const purpose = page.getByLabel(/Purpose of loan/i)
> 93  |     await expect(purpose).toBeVisible({ timeout: 20_000 })
      |                           ^ Error: expect(locator).toBeVisible() failed
  94  | 
  95  |     const filled = (await purpose.inputValue()).trim().length > 0
  96  |     const warning = page.getByText(/Compliance box 1 cannot be written without this/)
  97  |     if (filled) await expect(warning).toHaveCount(0)
  98  |     else await expect(warning).toBeVisible()
  99  |   })
  100 | })
  101 | 
```