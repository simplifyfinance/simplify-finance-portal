# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boxone.spec.ts >> box one — primary reasons for seeking credit >> the same deal writes the same words every time
- Location: tests/browser/boxone.spec.ts:60:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "TestFabioKylie Test is borrowing ** NOT RECORDED — no loan amount has been recorded ** over a thirty year term to buy an owner-occupied property. ** NOT RECORDED — nobody has recorded what these clients said they want the loan for. The fact find question is blank and must be completed before submission. **·
** NOT RECORDED — no rate type has been recorded against the recommended lender, so the structure of this loan cannot be described. **·
TestFabioKylie is employed full time.·
** ONLY ONE LENDER RECORDED — CBA is the only lender option on this file, so the recommendation has not been compared against any alternative. **"
Received: ""
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
              - generic [ref=e78]: TestFabioKylie Test 2026
              - button "✎ Edit" [ref=e80]
            - generic [ref=e81]:
              - generic [ref=e82]:
                - generic [ref=e83]: Broker
                - generic [ref=e84]: Fabio
              - generic [ref=e85]:
                - generic [ref=e86]: Scenario
                - generic [ref=e87]: OO purchase
              - generic [ref=e88]:
                - generic [ref=e89]: Waiting on
                - generic [ref=e90]: Broker to complete BC
          - generic [ref=e92]:
            - generic [ref=e93]: Deal
            - generic [ref=e94]:
              - link "Summary" [ref=e95] [cursor=pointer]:
                - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073/summary
              - button "Clone" [ref=e99]
              - button "Close deal" [ref=e103]
        - generic [ref=e108]:
          - generic [ref=e109]:
            - generic [ref=e113]: Fact Find
            - generic [ref=e114]: 07 Sept
          - generic [ref=e115]:
            - generic [ref=e118]: BC
            - generic [ref=e119]: with broker
          - generic [ref=e120]: Lending Options
          - generic [ref=e125]: Compliance
          - generic [ref=e130]: Lodged
          - generic [ref=e135]: Preapproved
          - generic [ref=e140]: Offer accepted
          - generic [ref=e145]: Formal
          - generic [ref=e150]: Contracts returned
          - generic [ref=e155]: Settlement booked
          - generic [ref=e160]: Settled
        - button "Internal notes Nothing written yet — what the client told us goes here. Add" [ref=e165]:
          - generic [ref=e166]: Internal notes
          - generic [ref=e167]: Nothing written yet — what the client told us goes here.
          - generic [ref=e168]: Add
        - button "Documents 6 to request of 6 on the list 1 to check Show" [ref=e170]:
          - generic [ref=e171]: Documents
          - generic [ref=e172]: 6 to request
          - generic [ref=e173]: of 6 on the list
          - generic [ref=e174]: 1 to check
          - generic [ref=e175]: Show
        - generic [ref=e176]:
          - button "Fact Find" [ref=e177]
          - button "Statements" [ref=e178]
          - button "BC — Borrowing capacity" [ref=e179]
          - button "Lending options" [ref=e180]
          - button "Compliance" [ref=e181]
        - generic [ref=e182]:
          - generic [ref=e183]:
            - button "Needs & objectives" [ref=e184]
            - button "Risks" [ref=e185]
            - button "Product requirements" [ref=e186]
            - button "Broker comments" [ref=e187]
            - button "Living expenses" [ref=e188]
          - generic [ref=e189]:
            - generic [ref=e190]:
              - generic [ref=e191]: Deal structure
              - generic [ref=e192]: OO purchase
              - generic [ref=e193]: 2 to complete
              - link "Open BC tab →" [ref=e194] [cursor=pointer]:
                - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073?stage=BC
            - generic [ref=e195]:
              - generic [ref=e196]:
                - generic [ref=e197]: Lender
                - generic [ref=e198]:
                  - text: CBA
                  - generic [ref=e199]: from the LO
              - generic [ref=e200]:
                - generic [ref=e201]: Approval
                - generic [ref=e202]:
                  - button "Formal" [ref=e203]
                  - button "Pre-approval" [ref=e204]
              - generic [ref=e205]:
                - generic [ref=e206]: Security address
                - textbox "Street, suburb, state" [ref=e207]
              - generic [ref=e208]:
                - generic [ref=e209]: Property value
                - text: not recorded
              - generic [ref=e210]:
                - generic [ref=e211]: LVR
                - text: not known
            - generic [ref=e213]:
              - generic [ref=e214]: Loan splits
              - generic [ref=e215]: amount, rate, repayment and purpose come from the Lending options tab
            - table [ref=e217]:
              - rowgroup [ref=e218]:
                - row [ref=e219]:
                  - columnheader "Split" [ref=e220]
                  - columnheader "Amount" [ref=e221]
                  - columnheader "Rate" [ref=e222]
                  - columnheader "P&I / IO" [ref=e223]
                  - columnheader "Purpose" [ref=e224]
                  - columnheader "Term" [ref=e225]
                  - columnheader "Product type" [ref=e226]
                  - columnheader "Promotion / cashback" [ref=e227]
              - rowgroup [ref=e228]:
                - row [ref=e229]:
                  - cell "Split 1 Owner-occupied loan" [ref=e230]:
                    - generic [ref=e231]: Split 1
                    - generic [ref=e232]: Owner-occupied loan
                  - cell "—" [ref=e233]
                  - cell "6.14%" [ref=e234]
                  - cell "P&I" [ref=e235]
                  - cell [ref=e236]:
                    - link "set on the LO ↗" [ref=e237] [cursor=pointer]:
                      - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073?stage=LO
                  - cell [ref=e238]:
                    - textbox "years" [ref=e239]: "30"
                  - cell [ref=e240]:
                    - textbox "product" [ref=e241]
                  - cell [ref=e242]:
                    - textbox "none" [ref=e243]
            - generic [ref=e244]:
              - heading "⚠ 2 things are needed before the credit notes can be written" [level=4] [ref=e245]
              - paragraph [ref=e246]: Left blank, the notes would either say nothing useful about that money or start guessing.
              - list [ref=e247]:
                - listitem [ref=e248]: Owner-occupied loan — purpose — owner occupied or investment
                - listitem [ref=e249]: Owner-occupied loan — product type
          - generic [ref=e251]:
            - generic [ref=e252]:
              - button "Push to SalesTrekker" [ref=e253]
              - generic [ref=e256]: Marks compliance complete and emails both PDFs to the compliance team.
            - generic [ref=e257]:
              - link "Open to copy" [ref=e258] [cursor=pointer]:
                - /url: /deals/e3cd45b0-1f1b-493c-8c05-00a789f46073/handover
              - button "Fact Find PDF" [ref=e262]
              - button "Handover PDF" [ref=e265]
              - button "Broker Notes" [ref=e268]
          - generic [ref=e272]:
            - generic [ref=e273]:
              - generic [ref=e274]: Needs & objectives
              - button "Generate all fields" [ref=e276]
            - generic [ref=e280]:
              - generic [ref=e281]: Primary reasons for seeking credit
              - textbox "Primary reasons for seeking credit" [ref=e282]:
                - /placeholder: Click Write from the deal, or type it yourself...
              - button "Write from the deal" [active] [ref=e283]
              - button "Flag an issue" [ref=e287]
              - generic [ref=e288]:
                - paragraph [ref=e289]: Recorded nowhere — these must be filled in before this file is submitted
                - paragraph [ref=e290]: · The clients' own reason for the loan — Fact Find → Purpose of loan
                - paragraph [ref=e291]: · Rate type on the recommended lender — Lending options → recommended lender
                - paragraph [ref=e292]: · Only one lender option recorded — Lending options → lender options
            - generic [ref=e293]:
              - generic [ref=e294]: Immediate needs & objectives — next 2 years
              - textbox "Immediate needs & objectives — next 2 years" [ref=e295]:
                - /placeholder: Click Generate with AI or type manually...
              - button "Generate with AI" [ref=e296]
              - button "Flag an issue" [ref=e300]
            - generic [ref=e301]:
              - generic [ref=e302]: Longer term — 2 to 10 years
              - textbox "Longer term — 2 to 10 years" [ref=e303]:
                - /placeholder: Click Generate with AI or type manually...
              - button "Generate with AI" [ref=e304]
              - button "Flag an issue" [ref=e308]
            - generic [ref=e309]:
              - generic [ref=e310]: Requirements type
              - generic [ref=e311]:
                - button "Owner occupied" [ref=e312] [cursor=pointer]
                - button "Investment" [ref=e313] [cursor=pointer]
  - alert [ref=e314]
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
  49  | 
  50  |     // A FIGURE, OR A REASON THERE ISN'T ONE.
  51  |     //
  52  |     // This asked flatly for a dollar amount, and failed on 10 Sep against a test
  53  |     // deal that has no loan amount recorded - where saying so loudly is the
  54  |     // correct answer and a figure would have been invented. So: a figure, or the
  55  |     // shout explaining its absence. Never silence.
  56  |     if (/NOT RECORDED — no loan amount/.test(text)) expect(text).toContain('** NOT RECORDED')
  57  |     else expect(text).toMatch(/\$[\d,]{5,}/)
  58  |   })
  59  | 
  60  |   test('the same deal writes the same words every time', async ({ page }) => {
  61  |     // The wording varies across the book and never within one file - otherwise
  62  |     // pressing the button twice rewords a file underneath the team.
  63  |     await page.goto(`/deals/${DEAL}`)
  64  |     await page.getByRole('button', { name: /^Compliance$/ }).click()
  65  |     await page.getByRole('button', { name: /Needs & objectives/ }).click()
  66  |     const box = page.getByLabel(/Primary reasons for seeking credit/i)
  67  |     await expect(box).toBeVisible({ timeout: 20_000 })
  68  | 
  69  |     await page.getByRole('button', { name: /Write from the deal/i }).click()
  70  |     await expect(box).not.toHaveValue('', { timeout: 5_000 })
  71  |     const first = await box.inputValue()
  72  | 
  73  |     await page.getByRole('button', { name: /Write from the deal/i }).click()
  74  |     await page.waitForTimeout(500)
> 75  |     expect(await box.inputValue()).toBe(first)
      |                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  76  |   })
  77  | 
  78  |   test('a gap is shouted, on the screen and in the text', async ({ page }) => {
  79  |     // Only meaningful when the test deal actually has a gap. When it has none,
  80  |     // the paragraph must not be shouting either - both directions are checked.
  81  |     await page.goto(`/deals/${DEAL}`)
  82  |     await page.getByRole('button', { name: /^Compliance$/ }).click()
  83  |     await page.getByRole('button', { name: /Needs & objectives/ }).click()
  84  |     const box = page.getByLabel(/Primary reasons for seeking credit/i)
  85  |     await expect(box).toBeVisible({ timeout: 20_000 })
  86  | 
  87  |     await page.getByRole('button', { name: /Write from the deal/i }).click()
  88  |     await expect(box).not.toHaveValue('', { timeout: 5_000 })
  89  |     const text = await box.inputValue()
  90  |     const shouting = /\*\* NOT RECORDED|\*\* ONLY ONE LENDER|\*\* NO RECOMMENDED/.test(text)
  91  |     const list = page.getByText(/Recorded nowhere/)
  92  | 
  93  |     if (shouting) await expect(list).toBeVisible()
  94  |     else await expect(list).toHaveCount(0)
  95  |   })
  96  | 
  97  |   test('the fact find turns red when the purpose is missing', async ({ page }) => {
  98  |     await page.goto(`/deals/${DEAL}`)
  99  |     await page.getByRole('button', { name: /^Fact Find$/ }).click()
  100 |     const purpose = page.getByLabel(/Purpose of loan/i)
  101 |     await expect(purpose).toBeVisible({ timeout: 20_000 })
  102 | 
  103 |     const filled = (await purpose.inputValue()).trim().length > 0
  104 |     const warning = page.getByText(/Compliance box 1 cannot be written without this/)
  105 |     if (filled) await expect(warning).toHaveCount(0)
  106 |     else await expect(warning).toBeVisible()
  107 |   })
  108 | })
  109 | 
```