# Simplify Finance – CRM "Order Valuation" pop-up: build spec (keep it simple)

## Purpose
Brokers and the credit team press **Order Valuation** on a deal, answer a short pop-up, and the CRM emails the answers to Valerio (valuations bot). Valerio places the order in CoreLogic PropertyHub and emails the result back. These are BC-stage valuations to get the right pricing and deal, so every order is STANDARD (never urgent) and there are NO optional questions.

## Delivery
- **To:** fabio-tgt029+valuations@mail.grokbot.com
- **Subject:** `VALUATION REQUEST v1 – {BorrowerFirstName} – {Suburb}`
- **Body:** plain text, the block below, one `Key: Value` per line. Keys never change.
- Replies go to `RequestedByEmail`, cc the broker (`BrokerEmail`, if different) and fabio@simplifyfinance.com.au (no duplicate cc if Fabio is the requester or broker).

## Filled automatically by the CRM (not shown in the pop-up)
- DealRef – the CRM deal ID
- RequestedByName / RequestedByEmail – the logged-in user who pressed the button (may be admin/credit staff, not the broker)
- BrokerName / BrokerEmail – **the broker assigned to the deal**. Required. Valerio uses this to pick that broker's own CoreLogic login, so the valuation is ordered under the correct broker. If the deal has no broker assigned, the pop-up must show a required "Broker" dropdown.
- ValueType – PURCHASE → CONTRACT_PRICE; REFINANCE or EQUITY_RELEASE → CUSTOMER_ESTIMATE
- Urgency is always STANDARD (no field needed)

## The pop-up: questions shown to everyone (all required)
| # | Question | Answer type / options |
|---|----------|-----------------------|
| 1 | Lender(s) | Multi-select tick boxes – the team can tick one or more lenders (names as on CoreLogic's "Choose a Lender" page), not limited to a fixed list. At least one required. |
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

## Extra questions – only shown when ANZ is one of the ticked lenders (all required)
| # | Question | Answer type / options |
|---|----------|-----------------------|
| A1 | Expected LVR including LMI (%) | Number (pre-fill from Loan amount ÷ Value, broker can adjust) |
| A2 | Title | Freehold / Strata / Company title / Leasehold |
| A3 | Does ANZ already hold this property as security? | Yes / No |
| A4 | Is this an on-completion valuation of a new build? | Yes / No |
| A5 | Ancillary improvements | Tick boxes: Pool / Tennis court / Carport – leave all unticked if none |

## Extra questions – only shown when Bankwest is one of the ticked lenders (all required)
| # | Question | Answer type / options |
|---|----------|-----------------------|
| B1 | Is the property under 50 m²? | Yes / No |
| B2 | Off the plan purchase? (only if Loan purpose = Purchase) | Yes / No |
| B3 | Is the current lender Bankwest or CBA? (only if Refinance / Equity release) | Yes / No |
| B4 | Anything special about the deal? | Tick boxes, default "None of these": Bridging finance / Fixed-price build contract over $1M / Cost-plus build contract / House and land package / Complex of 4+ dwellings / Not at arm's length / Over 2 hectares / Two-tiered marketing / Non-standard lease / 3+ dwellings on one title / Second mortgage / Leasehold |

## Email body the CRM sends
```
=== VALUATION REQUEST v1 ===
DealRef: 
RequestedByName: 
RequestedByEmail: 
BrokerName:             # broker assigned to the deal (required)
BrokerEmail:            # that broker's email – used to pick their CoreLogic login (required)
Lender:                 # one or more lender names exactly as shown on the CoreLogic "Choose a Lender" page, separated by " | " (e.g. ING | ANZ - Brokers | Macquarie). Any lender, not a fixed list.
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
BW_Under50sqm:          # Bankwest only: Y | N
BW_OffThePlan:          # Bankwest only, purchases: Y | N
BW_CurrentLenderBWCBA:  # Bankwest only, refinance/equity release: Y | N
BW_Special:             # Bankwest only: NONE, or comma-separated BRIDGING, FIXED_PRICE_OVER_1M, COST_PLUS, HOUSE_AND_LAND, COMPLEX_4PLUS, NOT_ARMS_LENGTH, OVER_2HA, TWO_TIERED, NON_STANDARD_LEASE, THREE_PLUS_ON_TITLE, SECOND_MORTGAGE, LEASEHOLD
=== END ===
```
Fields that don't apply (e.g. CompanyName for individuals, ANZ_ / BW_ lines when that bank isn't ticked) are sent blank – never removed.

## Worked example (ING purchase, unit)
```
=== VALUATION REQUEST v1 ===
DealRef: SF-EXAMPLE
RequestedByName: Fabio
RequestedByEmail: fabio@simplifyfinance.com.au
BrokerName: Fabio De Castro
BrokerEmail: fabio@simplifyfinance.com.au
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
BW_Under50sqm: 
BW_OffThePlan: 
BW_CurrentLenderBWCBA: 
BW_Special: 
=== END ===
```

## What Valerio does on receipt
1. Checks every required answer is there; if not, replies to the requester listing exactly what's missing (no guessing, no order).
2. Signs in to CoreLogic PropertyHub with **the broker's own login** (matched on BrokerEmail; if no login is saved for that broker it stops and tells the requester), on the Oxygen Home Loans account, finds the property, picks each ticked lender in turn and answers its questions from the email only. Floor size is not asked in the pop-up: Valerio reads the m² from the CoreLogic property page (top right) and uses 100 if CoreLogic has none.
3. Orders only if it's free / on account. If any screen shows a card charge or amount payable, it stops and emails the requester the lender, valuation type and quoted cost so a person can order it.
4. Emails the requester (cc Fabio) the outcome and CoreLogic reference, then forwards updates and the final report.
5. Never orders construction/progress valuations or commercial security – those go back to a person.
6. **Bankwest** is ordered in Bankwest's own broker portal (not CoreLogic), signed in as the deal's broker. **CBA is not supported yet** – if CBA is ticked, Valerio replies that CBA must be ordered by a person (other ticked lenders still get ordered). Leave CBA in the lender list.

## Notes for the developer
- Keep `v1` in the subject and header; bump it if the format changes.
- Send text/plain.
- One email per property. If several lenders are ticked, send them all in the one email (Lender line separated by " | "); all other details are shared. Valerio places a separate order per lender.
