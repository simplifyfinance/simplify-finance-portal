# Simplify Finance – CRM "Order Valuation" pop-up: build spec (keep it simple)

## Purpose
Brokers and the credit team press **Order Valuation** on a deal, answer a short pop-up, and the CRM emails the answers to Valerio (valuations bot). Valerio places the order in CoreLogic PropertyHub and emails the result back. These are BC-stage valuations to get the right pricing and deal, so every order is STANDARD (never urgent) and there are NO optional questions.

## Delivery
- **To:** fabio-tgt029+valuations@mail.grokbot.com
- **Subject:** `VALUATION REQUEST v1 – {BorrowerFirstName} – {Suburb}`
- **Body:** plain text, the block below, one `Key: Value` per line. Keys never change.
- Replies go to `RequestedByEmail`, cc fabio@simplifyfinance.com.au (no cc if Fabio is the requester).

## Filled automatically by the CRM (not shown in the pop-up)
- DealRef – the CRM deal ID
- RequestedByName / RequestedByEmail – the logged-in user who pressed the button
- ValueType – PURCHASE → CONTRACT_PRICE; REFINANCE or EQUITY_RELEASE → CUSTOMER_ESTIMATE
- Urgency is always STANDARD (no field needed)

## The pop-up: questions shown to everyone (all required)
| # | Question | Answer type / options |
|---|----------|-----------------------|
| 1 | Lender | Dropdown: ANZ, ING, CBA, NAB, Westpac, St.George, Bankwest, Macquarie, Pepper, Liberty |
| 2 | Loan purpose | Purchase / Refinance / Equity release |
| 3 | Property use | Owner occupied / Investment |
| 4 | Loan amount | Number |
| 5 | Purchase price (if Purchase) or Estimated value (if Refinance/Equity release) | Number – label changes with Q2 |
| 6 | Property address | Street address, Suburb, State, Postcode (address autocomplete if possible) |
| 7 | Property type | House / Unit / Townhouse / Villa / Land / Duplex |
| 8 | Security type | Residential / Commercial – defaults to Residential |
| 9 | Borrower first name | Text |
| 10 | Borrower last name | Text |
| 11 | Company name | Text – **only shown if a "Borrowing in a company" tick box is ticked** |
| 12 | Access contact | Agent / Owner / Occupier / Tenant / Borrower |
| 13 | Access contact first name | Text |
| 14 | Access contact last name | Text |
| 15 | Access contact mobile | Digits, e.g. 0412345678 |

## Extra questions – only shown when Lender = ANZ (all required)
| # | Question | Answer type / options |
|---|----------|-----------------------|
| A1 | Expected LVR including LMI (%) | Number (pre-fill from Loan amount ÷ Value, broker can adjust) |
| A2 | Title | Freehold / Strata / Company title / Leasehold |
| A3 | Does ANZ already hold this property as security? | Yes / No |
| A4 | Is this an on-completion valuation of a new build? | Yes / No |
| A5 | Ancillary improvements | Tick boxes: Pool / Tennis court / Carport – leave all unticked if none |

## Email body the CRM sends
```
=== VALUATION REQUEST v1 ===
DealRef: 
RequestedByName: 
RequestedByEmail: 
Lender:                 # ANZ | ING | CBA | NAB | WESTPAC | STGEORGE | BANKWEST | MACQUARIE | PEPPER | LIBERTY
LoanPurpose:            # PURCHASE | REFINANCE | EQUITY_RELEASE
PropertyUse:            # OWNER_OCCUPIED | INVESTMENT
LoanAmount:             # digits only
ValueAmount:            # digits only
ValueType:              # CONTRACT_PRICE | CUSTOMER_ESTIMATE (auto)
StreetAddress: 
Suburb: 
State:                  # NSW | VIC | QLD | WA | SA | TAS | ACT | NT
Postcode: 
PropertyType:           # HOUSE | UNIT | TOWNHOUSE | VILLA | LAND | DUPLEX
SecurityCategory:       # RESIDENTIAL | COMMERCIAL
BorrowerFirstName: 
BorrowerLastName: 
CompanyName:            # only if borrowing in a company
AccessContactType:      # AGENT | OWNER | OCCUPIER | TENANT | BORROWER
AccessFirstName: 
AccessLastName: 
AccessMobile: 
ANZ_ExpectedLVR:        # ANZ only
ANZ_Tenure:             # ANZ only: FREEHOLD | STRATA | COMPANY_TITLE | LEASEHOLD
ANZ_HoldsSecurity:      # ANZ only: Y | N
ANZ_OnCompletion:       # ANZ only: Y | N
ANZ_Ancillary:          # ANZ only: POOL, TENNIS_COURT, CARPORT comma-separated, or blank
=== END ===
```
Fields that don't apply (e.g. CompanyName for individuals, ANZ_ lines for other lenders) are sent blank – never removed.

## Worked example (ING purchase, unit)
```
=== VALUATION REQUEST v1 ===
DealRef: SF-EXAMPLE
RequestedByName: Fabio
RequestedByEmail: fabio@simplifyfinance.com.au
Lender: ING
LoanPurpose: PURCHASE
PropertyUse: OWNER_OCCUPIED
LoanAmount: 760000
ValueAmount: 950000
ValueType: CONTRACT_PRICE
StreetAddress: 5/12 Example St
Suburb: Ryde
State: NSW
Postcode: 2112
PropertyType: UNIT
SecurityCategory: RESIDENTIAL
BorrowerFirstName: Mai
BorrowerLastName: Example
CompanyName: 
AccessContactType: AGENT
AccessFirstName: Sam
AccessLastName: Example
AccessMobile: 0400000000
ANZ_ExpectedLVR: 
ANZ_Tenure: 
ANZ_HoldsSecurity: 
ANZ_OnCompletion: 
ANZ_Ancillary: 
=== END ===
```

## What Valerio does on receipt
1. Checks every required answer is there; if not, replies to the requester listing exactly what's missing (no guessing, no order).
2. Signs in to CoreLogic PropertyHub (Oxygen Home Loans account), finds the property, picks the lender and answers its questions from the email only. Floor size is not asked in the pop-up: Valerio reads the m² from the CoreLogic property page (top right) and uses 100 if CoreLogic has none.
3. Orders only if it's free / on account. If any screen shows a card charge or amount payable, it stops and emails the requester the lender, valuation type and quoted cost so a person can order it.
4. Emails the requester (cc Fabio) the order confirmation and CoreLogic reference, then forwards updates and the final report.
5. Never orders construction/progress valuations or commercial security – those go back to a person.

## Notes for the developer
- Keep `v1` in the subject and header; bump it if the format changes.
- Send text/plain.
- One email per property per lender.
