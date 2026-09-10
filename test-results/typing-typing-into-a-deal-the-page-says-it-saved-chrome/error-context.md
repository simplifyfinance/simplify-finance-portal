# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: typing.spec.ts >> typing into a deal >> the page says it saved
- Location: tests/browser/typing.spec.ts:76:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Autosaved/)
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/Autosaved/) with timeout 20000ms
  - waiting for getByText(/Autosaved/)

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
  - button "Internal notes Nothing written yet — what the client told us goes here. Add"
  - button "Documents 6 to request of 6 on the list 1 to check Show"
  - button "Fact Find"
  - button "Statements"
  - button "BC — Borrowing capacity"
  - button "Lending options"
  - button "Compliance"
  - button "BC form"
  - button "Preview & share"
  - button "Client agreed — move to LO"
  - text: BC template
  - button "Refinance + equity release"
  - button "Refinance only"
  - button "OO purchase"
  - button "OO purchase — LVR comparison"
  - button "Investment purchase"
  - button "Equity release + purchase"
  - button "Buy / sell"
  - button "First home buyer"
  - button "Bridging loan"
  - button "Family pledge"
  - button "SMSF purchase"
  - button "Construction loan"
  - button "Custom (all fields)"
  - text: Notes Broker summary notes (included in email)
  - textbox "Broker summary notes (included in email)":
    - /placeholder: ✏ Add your personalised opening message — this goes directly into the client email...
    - text: Window one is typing while window two is open. Testing one. Testing two. Testing three. Don't d Checking the save stamp.rop anything.
  - text: Important things to note (included in email, one per line — pre-filled per template)
  - textbox "Important things to note (included in email, one per line — pre-filled per template)":
    - /placeholder: One note per line...
  - text: Broker signature
  - combobox "Broker signature":
    - option "Fabio de Castro" [selected]
    - option "Mark Gallo"
    - option "Keanen Wood"
    - option "Justin Cornock"
    - option "Kylie Searle"
  - text: Brand
  - combobox "Brand":
    - option "Simplify Finance" [selected]
  - text: Scenario details State
  - textbox "State"
  - text: Property type
  - combobox "Property type":
    - option "Owner-occupied" [selected]
    - option "Investment"
  - text: House or strata?
  - combobox "House or strata?":
    - option "Not recorded" [selected]
    - option "House"
    - option "Unit"
    - option "Townhouse"
    - option "Land"
    - option "Commercial"
    - option "Rural"
    - option "Other"
  - checkbox "Compare multiple options (e.g. different scenarios based on paying down liabilities)"
  - text: Compare multiple options (e.g. different scenarios based on paying down liabilities) Purchase price $
  - textbox "Purchase price $"
  - text: Deposit $
  - textbox "Deposit $"
  - text: Deposit source
  - combobox "Deposit source":
    - option "Select source" [selected]
    - option "Savings"
    - option "Equity"
    - option "Gift"
    - option "Combination of savings & equity"
  - text: Stamp duty $
  - textbox "Stamp duty $"
  - text: State
  - combobox "State":
    - option "Select" [selected]
    - option "NSW"
    - option "VIC"
    - option "QLD"
    - option "SA"
    - option "WA"
    - option "TAS"
    - option "NT"
    - option "ACT"
  - text: LVR (calculated) — Loan term (years)
  - textbox "Loan term (years)": "30"
  - text: Loan splits Split 1 Label
  - textbox "Label": Owner-occupied loan
  - text: Amount
  - textbox "Amount"
  - text: Rate
  - textbox "Rate": "6.14"
  - text: Type
  - combobox "Type":
    - option "P&I" [selected]
    - option "Interest only"
  - text: Repayment
  - textbox "Repayment"
  - button "+ Add split"
  - text: "\"Based on your numbers\" checklist"
  - textbox "Add item..."
  - button "Add"
  - button "✨ Generate email"
- alert
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test'
  2   | 
  3   | // WHAT A PERSON DOES ALL DAY, DONE BY A ROBOT.
  4   | //
  5   | // These are not clever. They type a sentence and check the sentence is there.
  6   | // That is exactly the check nobody was doing, and it is the one that would have
  7   | // caught every visible fault of the last week.
  8   | 
  9   | const DEAL = process.env.PORTAL_TEST_DEAL_ID || ''
  10  | 
  11  | // The exact shape of thing Kylie writes: long, apostrophes, full stops,
  12  | // percentages. The faults all showed up late in a long run, never in a word or
  13  | // two, which is why a short test would have passed all week.
  14  | const NOTE =
  15  |   "Hi Dylan and Megan, further to our conversation last week, we've finalised " +
  16  |   "your borrowing capacity. We've assumed a minimum rental yield of 4% p.a. and " +
  17  |   "used your latest payslips. The figures below are indicative only and subject " +
  18  |   "to a full assessment. Please don't hesitate to call if anything looks wrong."
  19  | 
  20  | 
  21  | async function openBcNotes(page: Page) {
  22  |   await page.goto(`/deals/${DEAL}`)
  23  |   await page.getByRole('button', { name: /BC — Borrowing capacity/ }).click()
  24  |   const box = page.getByLabel(/Broker summary notes/i)
  25  |   await expect(box).toBeVisible({ timeout: 20_000 })
  26  |   return box
  27  | }
  28  | 
  29  | test.describe('typing into a deal', () => {
  30  |   // Signed in once, by hand, by ./scripts/portal-login.sh. Nothing here knows a
  31  |   // password, so there is nothing here to leak. Inside the describe, because
  32  |   // Playwright will not take a skip at the top of a file.
  33  |   test.skip(!DEAL, 'Set PORTAL_TEST_DEAL_ID in .env.local, and run ./scripts/portal-login.sh once.')
  34  | 
  35  |   // THE ONE THAT MATTERS. Kylie, 9 Sep 2026: "it is deleting letters, and
  36  |   // spaces, and dots." Typed straight through, exactly as she does it.
  37  |   //
  38  |   // Typed, saved and reloaded inside ONE test on purpose. Split across two, the
  39  |   // second depends on the first having run, and a test that only passes in
  40  |   // company is a test that lies the first time somebody runs it alone.
  41  |   test('a long note keeps every character, and survives a reload', async ({ page }) => {
  42  |     const box = await openBcNotes(page)
  43  |     await box.click()
  44  |     await box.press('Meta+a')
  45  |     await box.press('Delete')
  46  |     // Roughly a fast typist. The faults only ever appeared under a sustained
  47  |     // run, never on a slow one.
  48  |     await box.pressSequentially(NOTE, { delay: 25 })
  49  | 
  50  |     // Every character, before anything is saved. This is the letters test.
  51  |     expect(await box.inputValue()).toBe(NOTE)
  52  | 
  53  |     // WAIT FOR THE DATABASE, NOT FOR A STAMP ON THE SCREEN.
  54  |     //
  55  |     // This used to wait for the "Autosaved" line in the header. On 10 Sep it
  56  |     // never appeared, and the run failed there - with the whole note sitting
  57  |     // correctly in the box, which is the thing the test is actually for. A
  58  |     // proxy for the save was standing in front of the save itself.
  59  |     //
  60  |     // The autosave debounce is 700ms. This waits several times that and then
  61  |     // asks the database, which is the only answer that counts. Whether the
  62  |     // stamp appears is a separate question, and it gets its own test below.
  63  |     await page.waitForTimeout(5_000)
  64  | 
  65  |     // And now the database's answer, not the screen's.
  66  |     await page.reload()
  67  |     await expect(page.getByLabel(/Broker summary notes/i)).toHaveValue(NOTE, { timeout: 20_000 })
  68  |   })
  69  | 
  70  |   // THE STAMP THAT DID NOT APPEAR.
  71  |   //
  72  |   // Separate from the letters test on purpose. On 10 Sep the note typed and held
  73  |   // perfectly and no "Autosaved" line ever showed - so somebody typing has no
  74  |   // confirmation their work went in. Whether that is the stamp failing or the
  75  |   // save failing, this is the test that says which.
  76  |   test('the page says it saved', async ({ page }) => {
  77  |     const box = await openBcNotes(page)
  78  |     await box.click()
  79  |     await box.pressSequentially(' Checking the save stamp.', { delay: 25 })
> 80  |     await expect(page.getByText(/Autosaved/)).toBeVisible({ timeout: 20_000 })
      |                                               ^ Error: expect(locator).toBeVisible() failed
  81  |   })
  82  | 
  83  |   // The deal page used to shove the form down the screen whenever a notice
  84  |   // appeared or vanished - three of them, on three different timers.
  85  |   test('the box does not move while somebody is typing in it', async ({ page }) => {
  86  |     const box = await openBcNotes(page)
  87  |     await box.click()
  88  |     const before = await box.boundingBox()
  89  |     await box.pressSequentially(' Still here.', { delay: 25 })
  90  |     // Long enough for a save to land and any notice to come and go.
  91  |     await page.waitForTimeout(6000)
  92  |     const after = await box.boundingBox()
  93  |     expect(before).not.toBeNull()
  94  |     expect(after).not.toBeNull()
  95  |     // A pixel or two of rounding is fine. Sixty is a banner.
  96  |     expect(Math.abs((after!.y) - (before!.y))).toBeLessThan(4)
  97  |   })
  98  | 
  99  |   // Two windows on one deal is the case that broke twice. Same person is
  100 |   // enough to prove nothing is eaten - the portal cannot tell it is a robot.
  101 |   test('a second window open on the same deal costs no letters', async ({ page, context }) => {
  102 |     const second = await context.newPage()
  103 |     await second.goto(`/deals/${DEAL}`)
  104 |     await second.waitForTimeout(3000)
  105 | 
  106 |     const box = await openBcNotes(page)
  107 |     await box.click()
  108 |     await box.press('Meta+a')
  109 |     await box.press('Delete')
  110 |     await box.pressSequentially(NOTE, { delay: 25 })
  111 |     await page.waitForTimeout(2500)
  112 |     expect(await box.inputValue()).toBe(NOTE)
  113 |     await second.close()
  114 |   })
  115 | })
  116 | 
```