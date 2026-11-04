# Simplify Finance – CRM "Run Serviceability" button: email spec

## Purpose
When a broker presses **Run Serviceability** on a client record, the CRM sends one email containing a structured summary of the fact find. The Serviceability Calc Bot parses it, runs the lender calculators, and emails the results back to the broker.

## Delivery
- **To:** fabio-tgt029+servicing@mail.grokbot.com
- **From:** the broker's own Simplify Finance address (results are returned to this sender, cc fabio@simplifyfinance.com.au)
- **Subject:** `SERVICEABILITY | {DealRef} | {ScenarioType} | {FirstName}`
  - Example: `SERVICEABILITY | SF-10482 | PURCHASE | Mai`
- **Body:** plain text, in the exact format below. The headings and keys must not change. Leave values blank if unknown. Never delete a key.
- **Privacy:** first names only. No surnames, DOB, addresses, phone numbers, emails, TFNs, or account numbers. Use the suburb/postcode for the security property only.
- **Attachments:** none required. Optional: payslips/tax returns are NOT wanted (privacy).

## Formatting rules
- One `Key: Value` per line.
- Money: digits only, no `$` or commas (e.g. `193000`). Annual unless the key says `_monthly`.
- Percentages: number only (e.g. `6.40`).
- Yes/No fields: `Y` or `N`.
- Dates: `YYYY-MM-DD`.
- Repeating items (applicants, incomes, liabilities, properties) use a numbered block: `[APPLICANT 1]`, `[APPLICANT 2]`, `[LIABILITY 1]`, `[LIABILITY 2]` etc.
- Enumerated fields must use one of the listed values exactly.

---

## Email body template

```
=== SERVICEABILITY REQUEST v1 ===
DealRef: 
Broker: 
RequestedLenders: ALL            # ALL | or comma list: BANKWEST,CBA,NAB,STGEORGE,PEPPER,LIBERTY,FIRSTMAC
Instructions:                    # free text from broker, e.g. "show max price, use partner 800k gift"

[SCENARIO]
ScenarioType:                    # PURCHASE | REFINANCE | REFINANCE_CASHOUT | CONSTRUCTION | EQUITY_RELEASE | PREAPPROVAL
Purpose:                         # OWNER_OCCUPIED | INVESTMENT
State:                           # NSW | VIC | QLD | WA | SA | TAS | ACT | NT
FirstHomeBuyer:                  # Y | N
GovernmentScheme:                # NONE | FIVE_PERCENT_DEPOSIT | FAMILY_HOME_GUARANTEE | REGIONAL_FHB
TargetPrice:                     # purchase price, or current value for a refinance
SuburbPostcode:                  # e.g. Ryde 2112
PropertyType:                    # HOUSE | UNIT | TOWNHOUSE | LAND | OFF_THE_PLAN
NewOrEstablished:                # NEW | ESTABLISHED
TargetLVR:                       # optional, e.g. 80, 90, 95
LoanTermYears: 30
RepaymentType: PI                # PI | IO
IOPeriodYears:                   # if IO
ShowMaxPrice: Y                  # Y | N
LMIPreference:                   # STANDARD (90% and 95% incl LMI options) | AVOID | N/A

[HOUSEHOLD]
NumberOfApplicants:              # 1 | 2
MaritalStatus:                   # SINGLE | MARRIED | DE_FACTO | SEPARATED | DIVORCED | WIDOWED
NonApplicantSpouse:              # Y | N  (married/de facto partner who is NOT on the loan)
Dependants:                      # number
DependantAges:                   # comma list, e.g. 3,7
DeclaredLivingExpenses_monthly:  # household total from fact find
CurrentHousing:                  # RENTING | OWN_HOME | BOARDING | WITH_PARENTS
CurrentRent_monthly:             # if renting and continuing after settlement

[APPLICANT 1]
FirstName: 
Age: 
EmploymentType:                  # PAYG_FULLTIME | PAYG_PARTTIME | PAYG_CASUAL | CONTRACTOR | SELF_EMPLOYED | RETIRED | NOT_EMPLOYED
Occupation: 
EmploymentStartDate: 
OnProbation:                     # Y | N
BaseIncome:                      # gross annual
Overtime:                        # gross annual
Bonus:                           # gross annual
Commission:                      # gross annual
Allowances:                      # gross annual
SelfEmployed_NetProfit_Y1:       # most recent year
SelfEmployed_NetProfit_Y2:       # prior year
SelfEmployed_Addbacks_Y1:        # depreciation, interest, super etc.
SelfEmployed_Addbacks_Y2:
OtherIncome:                     # gross annual
OtherIncomeType:                 # e.g. GOVERNMENT, CHILD_SUPPORT, DIVIDENDS
HECS_Balance:                    # HELP/STSL debt balance

[APPLICANT 2]
# same keys as APPLICANT 1, delete block if single applicant

[RENTAL INCOME]
# one line per property kept after settlement
Property1_RentWeekly: 
Property1_Owner:                 # A1 | A2 | JOINT
Property2_RentWeekly: 
Property2_Owner: 

[ASSETS]
Savings: 
SavingsEvidenced:                # Y | N (genuine savings history)
GiftFunds: 
GiftFrom:                        # e.g. PARTNER_NON_APPLICANT, PARENTS
FirstHomeOwnerGrant: 
Superannuation: 
Shares: 
Vehicles: 
OtherAssets: 

[PROPERTIES OWNED]
# one block per property already owned
Property1_Value: 
Property1_Purpose:               # OWNER_OCCUPIED | INVESTMENT
Property1_Action:                # KEEP | SELL | REFINANCE
Property1_SalePrice:             # if SELL
Property1_SellingCostsPct:       # if SELL, default 2
Property1_LoanBalance: 
Property1_Lender: 

[LIABILITY 1]
Type:                            # HOME_LOAN | INVESTMENT_LOAN | CREDIT_CARD | PERSONAL_LOAN | CAR_LOAN | BNPL | OVERDRAFT | STORE_CARD | TAX_DEBT | OTHER
Lender: 
Limit:                           # for cards/overdrafts/BNPL
Balance: 
Repayment_monthly: 
RemainingTermMonths: 
InterestRate: 
Action:                          # KEEP | CLOSE | REFINANCE | PAID_OUT_ON_SALE
LinkedProperty:                  # e.g. Property1

[LIABILITY 2]
# repeat as needed

[REFINANCE]
# only for REFINANCE scenarios
CurrentLoanBalance: 
CurrentRate: 
CurrentLender: 
CashOutAmount: 
CashOutPurpose: 
DebtsToConsolidate:              # list LIABILITY numbers, e.g. 2,3

=== END ===
```

---

## Worked example (Mai, purchase, CBA run 4 Nov 2026)

```
=== SERVICEABILITY REQUEST v1 ===
DealRef: SF-EXAMPLE
Broker: Fabio
RequestedLenders: ALL
Instructions: Show 1.6M target and max purchase price. Partner contributing 800k.

[SCENARIO]
ScenarioType: PURCHASE
Purpose: OWNER_OCCUPIED
State: NSW
FirstHomeBuyer: N
GovernmentScheme: NONE
TargetPrice: 1600000
LoanTermYears: 30
RepaymentType: PI
ShowMaxPrice: Y

[HOUSEHOLD]
NumberOfApplicants: 1
MaritalStatus: MARRIED
NonApplicantSpouse: Y
Dependants: 0
DeclaredLivingExpenses_monthly: 

[APPLICANT 1]
FirstName: Mai
EmploymentType: PAYG_FULLTIME
BaseIncome: 193000

[ASSETS]
GiftFunds: 800000
GiftFrom: PARTNER_NON_APPLICANT

[PROPERTIES OWNED]
Property1_Purpose: OWNER_OCCUPIED
Property1_Action: SELL
Property1_SalePrice: 950000
Property1_SellingCostsPct: 2
Property1_LoanBalance: 600000
Property1_Lender: ANZ

[LIABILITY 1]
Type: CREDIT_CARD
Lender: AMEX
Limit: 
Action: KEEP
=== END ===
```

---

## What the bot does on receipt
1. Validates the format. If any required field is missing (ScenarioType, Purpose, State, TargetPrice or ShowMaxPrice, income, liabilities, living expenses), it replies to the sender listing exactly what's missing and does not guess.
2. Runs the requested lenders' latest uploaded calculators, using the latest uploaded rate sheets.
3. Logs every result (de-identified profile, max loan per lender, and the reason for differences) to build the lender ranking by client profile.
4. Emails the sender, cc Fabio: a comparison table (max loan, max price, repayments per lender), a recommended lender, the filled calculators, the results PDF, the workings, and a short sales-style client email draft.

## Required vs optional
- **Always required:** ScenarioType, Purpose, State, NumberOfApplicants, MaritalStatus, Dependants, at least one income line per applicant, EmploymentType, all liabilities with limits/balances, DeclaredLivingExpenses_monthly.
- **Purchase:** TargetPrice or ShowMaxPrice: Y, Savings/GiftFunds, FirstHomeBuyer.
- **Refinance:** the [REFINANCE] block.
- **Selling a property:** the Property block with SalePrice and LoanBalance.

## Notes for the developer
- Generate the body from CRM fields; map CRM picklists to the enumerated values above.
- Do not send HTML-only; send text/plain (an HTML alternative is fine).
- Keep `v1` in the header line. If the format changes, bump the version so the bot knows.
- One email per deal. To re-run with changes, send a new email with the same DealRef.
