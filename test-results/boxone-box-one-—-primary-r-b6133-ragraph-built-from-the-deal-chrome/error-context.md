# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boxone.spec.ts >> box one — primary reasons for seeking credit >> the button writes a paragraph built from the deal
- Location: tests/browser/boxone.spec.ts:17:7

# Error details

```
Error: expect(received).toMatch(expected)

Expected pattern: /\$[\d,]{5,}/
Received string:  "TestFabioKylie Test is borrowing ** NOT RECORDED — no loan amount has been recorded ** over a thirty year term to buy an owner-occupied property. ** NOT RECORDED — nobody has recorded what these clients said they want the loan for. The fact find question is blank and must be completed before submission. **·
** NOT RECORDED — no rate type has been recorded against the recommended lender, so the structure of this loan cannot be described. **·
TestFabioKylie is employed full time.·
** ONLY ONE LENDER RECORDED — CBA is the only lender option on this file, so the recommendation has not been compared against any alternative. **"
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - img "Simplify Finance" [ref=e5]
      - generic [ref=e6]: Credit & Compliance Portal
      - navigation [ref=e8]:
        - generic [ref=e9]: Main
        - link "Dashboard" [ref=e11] [cursor=pointer]:
          - /url: /dashboard
        - link "Deals" [ref=e18] [cursor=pointer]:
          - /url: /deals
        - link [ref=e23] [cursor=pointer]:
          - /url: /pipeline
          - text: Pipeline
          - button "Expand" [ref=e27]
        - link "Clients" [ref=e31] [cursor=pointer]:
          - /url: /clients
        - link [ref=e38] [cursor=pointer]:
          - /url: /lenders
          - text: Lender library
          - button "Expand" [ref=e43]
        - link "Templates" [ref=e47] [cursor=pointer]:
          - /url: /templates
        - link "Reports" [ref=e52] [cursor=pointer]:
          - /url: /reports
        - link "Cheat sheet" [ref=e55] [cursor=pointer]:
          - /url: /cheat-sheet
      - generic [ref=e60]:
        - generic [ref=e61]:
          - generic [ref=e62]: "?"
          - generic [ref=e63]:
            - generic [ref=e64]: ...
            - generic [ref=e65]: Unknown
        - button "Sign out" [ref=e66]
    - main [ref=e70]:
      - generic [ref=e71]:
        - button "Back to deals" [ref=e72]
        - generic [ref=e75]:
          - generic [ref=e76]:
            - generic [ref=e77]:
              - generic [ref=e78]:
                - generic [ref=e79]: TestFabioKylie Test 2026
                - button "History" [ref=e80]
              - button "✎ Edit" [ref=e81]
            - generic [ref=e82]:
              - generic [ref=e83]:
                - generic [ref=e84]: Broker
                - generic [ref=e85]: Fabio
              - generic [ref=e86]:
                - generic [ref=e87]: Scenario
                - generic [ref=e88]: OO purchase
              - generic [ref=e89]:
                - generic [ref=e90]: Waiting on
                - generic [ref=e91]: Broker to complete BC
          - generic [ref=e93]:
            - generic [ref=e94]: Deal
            - generic [ref=e95]:
              - link "Summary" [ref=e96] [cursor=pointer]:
                - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073/summary
              - button "Clone" [ref=e100]
              - button "Close deal" [ref=e104]
        - generic [ref=e109]:
          - generic [ref=e110]:
            - generic [ref=e114]: Fact Find
            - generic [ref=e115]: 07 Sept
          - generic [ref=e116]:
            - generic [ref=e119]: BC
            - generic [ref=e120]: with broker
          - generic [ref=e121]: Lending Options
          - generic [ref=e126]: Compliance
          - generic [ref=e131]: Lodged
          - generic [ref=e136]: Preapproved
          - generic [ref=e141]: Offer accepted
          - generic [ref=e146]: Formal
          - generic [ref=e151]: Contracts returned
          - generic [ref=e156]: Settlement booked
          - generic [ref=e161]: Settled
        - button "Internal notes Nothing written yet — what the client told us goes here. Add" [ref=e166]:
          - generic [ref=e167]: Internal notes
          - generic [ref=e168]: Nothing written yet — what the client told us goes here.
          - generic [ref=e169]: Add
        - button "Documents 6 to request of 6 on the list 1 to check Show" [ref=e171]:
          - generic [ref=e172]: Documents
          - generic [ref=e173]: 6 to request
          - generic [ref=e174]: of 6 on the list
          - generic [ref=e175]: 1 to check
          - generic [ref=e176]: Show
        - generic [ref=e177]:
          - button "Fact Find" [ref=e178]
          - button "Statements" [ref=e179]
          - button "BC — Borrowing capacity" [ref=e180]
          - button "Lending options" [ref=e181]
          - button "Compliance" [ref=e182]
        - generic [ref=e183]:
          - generic [ref=e184]:
            - button "Needs & objectives" [ref=e185]
            - button "Risks" [ref=e186]
            - button "Product requirements" [ref=e187]
            - button "Broker comments" [ref=e188]
            - button "Living expenses" [ref=e189]
          - generic [ref=e190]:
            - generic [ref=e191]:
              - generic [ref=e192]: Deal structure
              - generic [ref=e193]: OO purchase
              - generic [ref=e194]: 2 to complete
              - link "Open BC tab →" [ref=e195] [cursor=pointer]:
                - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073?stage=BC
            - generic [ref=e196]:
              - generic [ref=e197]:
                - generic [ref=e198]: Lender
                - generic [ref=e199]:
                  - text: CBA
                  - generic [ref=e200]: from the LO
              - generic [ref=e201]:
                - generic [ref=e202]: Approval
                - generic [ref=e203]:
                  - button "Formal" [ref=e204]
                  - button "Pre-approval" [ref=e205]
              - generic [ref=e206]:
                - generic [ref=e207]: Security address
                - textbox "Street, suburb, state" [ref=e208]
              - generic [ref=e209]:
                - generic [ref=e210]: Property value
                - text: not recorded
              - generic [ref=e211]:
                - generic [ref=e212]: LVR
                - text: not known
            - generic [ref=e214]:
              - generic [ref=e215]: Loan splits
              - generic [ref=e216]: amount, rate, repayment and purpose come from the Lending options tab
            - table [ref=e218]:
              - rowgroup [ref=e219]:
                - row [ref=e220]:
                  - columnheader "Split" [ref=e221]
                  - columnheader "Amount" [ref=e222]
                  - columnheader "Rate" [ref=e223]
                  - columnheader "P&I / IO" [ref=e224]
                  - columnheader "Purpose" [ref=e225]
                  - columnheader "Term" [ref=e226]
                  - columnheader "Product type" [ref=e227]
                  - columnheader "Promotion / cashback" [ref=e228]
              - rowgroup [ref=e229]:
                - row [ref=e230]:
                  - cell "Split 1 Owner-occupied loan" [ref=e231]:
                    - generic [ref=e232]: Split 1
                    - generic [ref=e233]: Owner-occupied loan
                  - cell "—" [ref=e234]
                  - cell "6.14%" [ref=e235]
                  - cell "P&I" [ref=e236]
                  - cell [ref=e237]:
                    - link "set on the LO ↗" [ref=e238] [cursor=pointer]:
                      - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073?stage=LO
                  - cell [ref=e239]:
                    - textbox "years" [ref=e240]: "30"
                  - cell [ref=e241]:
                    - textbox "product" [ref=e242]
                  - cell [ref=e243]:
                    - textbox "none" [ref=e244]
            - generic [ref=e245]:
              - heading "⚠ 2 things are needed before the credit notes can be written" [level=4] [ref=e246]
              - paragraph [ref=e247]: Left blank, the notes would either say nothing useful about that money or start guessing.
              - list [ref=e248]:
                - listitem [ref=e249]: Owner-occupied loan — purpose — owner occupied or investment
                - listitem [ref=e250]: Owner-occupied loan — product type
          - generic [ref=e252]:
            - generic [ref=e253]:
              - button "Push to SalesTrekker" [ref=e254]
              - generic [ref=e257]: Marks compliance complete and emails both PDFs to the compliance team.
            - generic [ref=e258]:
              - link "Open to copy" [ref=e259] [cursor=pointer]:
                - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073/handover
              - button "Fact Find PDF" [ref=e263]
              - button "Handover PDF" [ref=e266]
              - button "Broker Notes" [ref=e269]
          - generic [ref=e273]:
            - generic [ref=e274]:
              - generic [ref=e275]: Needs & objectives
              - button "Generate all fields" [ref=e277]
            - generic [ref=e281]:
              - generic [ref=e282]: Primary reasons for seeking credit
              - textbox "Primary reasons for seeking credit" [ref=e283]:
                - /placeholder: Click Write from the deal, or type it yourself...
              - button "Write from the deal" [active] [ref=e284]
              - button "Flag an issue" [ref=e288]
              - generic [ref=e289]:
                - paragraph [ref=e290]: Recorded nowhere — these must be filled in before this file is submitted
                - paragraph [ref=e291]: · The clients' own reason for the loan — Fact Find → Purpose of loan
                - paragraph [ref=e292]: · Rate type on the recommended lender — Lending options → recommended lender
                - paragraph [ref=e293]: · Only one lender option recorded — Lending options → lender options
            - generic [ref=e294]:
              - generic [ref=e295]: Immediate needs & objectives — next 2 years
              - textbox "Immediate needs & objectives — next 2 years" [ref=e296]:
                - /placeholder: Click Generate with AI or type manually...
              - button "Generate with AI" [ref=e297]
              - button "Flag an issue" [ref=e301]
            - generic [ref=e302]:
              - generic [ref=e303]: Longer term — 2 to 10 years
              - textbox "Longer term — 2 to 10 years" [ref=e304]:
                - /placeholder: Click Generate with AI or type manually...
              - button "Generate with AI" [ref=e305]
              - button "Flag an issue" [ref=e309]
            - generic [ref=e310]:
              - generic [ref=e311]: Requirements type
              - generic [ref=e312]:
                - button "Owner occupied" [ref=e313] [cursor=pointer]
                - button "Investment" [ref=e314] [cursor=pointer]
  - alert [ref=e315]
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
> 49  |     expect(text).toMatch(/\$[\d,]{5,}/)
      |                  ^ Error: expect(received).toMatch(expected)
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
  93  |     await expect(purpose).toBeVisible({ timeout: 20_000 })
  94  | 
  95  |     const filled = (await purpose.inputValue()).trim().length > 0
  96  |     const warning = page.getByText(/Compliance box 1 cannot be written without this/)
  97  |     if (filled) await expect(warning).toHaveCount(0)
  98  |     else await expect(warning).toBeVisible()
  99  |   })
  100 | })
  101 | 
```