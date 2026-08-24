# Settlements — what was agreed (17 Aug 2026)

Replaces the settlement team's monthly spreadsheet (Settlement Pipeline 2026.xlsx,
twelve monthly tabs, ~44 deals in August).

## Built
- `/settlements` board: month view, broker filter, tiles, three groups.
- Groups come from the deal's own timestamps. Nobody drags rows between blocks.
  - Confirmed to settle = formally approved, settling this month.
  - Submitted not yet formal = REFINANCES ONLY, lodged, not yet formal. A
    purchase cannot settle the month it is lodged, so purchases are excluded.
  - Settled this month = reviews, compliance, commission.
  - "Yet to be submitted" is deliberately excluded for now.
- Latest Update split into a STATE (ready / awaiting / at risk / pushed) plus a
  free-text note. The sheet conflated the two, so nothing could be counted.
- Two dates: `expected_settlement_date` (tentative, often set at formal) and
  `confirmed_settlement_date` (the settlement team's). Confirmed always wins.
- Settlement steps: contracts_returned | settlement_booked. OPTIONAL markers,
  either can be skipped. Settlement Booked REFUSES without a confirmed date.
- Discharge only on refinances. Ready yes/no; No reveals a free-text box.
- Funds to complete only on purchases, chased 5 business days out.
- Needs attention: no update in 10 business days, within 5 business days of
  settling, or a purchase with funds unchecked. Thresholds live in
  lib/settlement.ts and nowhere else.
- "No chance this month" pushes a deal into the next month's forecast.
- Own permission `sees_settlements`, own nav item, own RLS policies. Settlement
  staff see every broker's deals FROM LODGEMENT ON - never fact finds.
- Settlement panel on the deal card, same fields, same gating.

## The stage rule (the important one)
`stage` never learns the new words. The whole team sees Lodged / Preapproved /
Formal / Settled. Settlement and admin ALSO see Contracts Returned and
Settlement Booked, which are `settlement_step` while the deal is at Formal.
One field, two renderings. Adding real stages would have broken year-on-year
comparability and forced a mapping table into every stage-based report.

Label differs by type: "Contracts returned" on a purchase, "Loan docs returned"
on a refinance. Same field.

## Deal type — fixed
`deal_type` held Refinance / Purchase / Investment, which is two questions in
one box. Replaced by `transaction_type` (purchase | refinance | equity_release |
construction) and `property_use` (owner_occupied | investment | smsf). Every
settlement rule keys off transaction_type.

## Settled feeds the targets automatically
The Pipeline already counts settled deals from the portal for any month the
spreadsheet does not cover, business AND per broker. Marking a deal settled here
flows through with no second entry and no sync job.

## Known limitation, accepted
The settlement UPDATE policy is row-level, not column-level: settlement staff can
technically write any column on a lodged deal through the API. Accepted for a
trusted in-house team. If settlement work is ever outsourced, move the writes
behind a security-definer function that accepts only settlement columns.

## Still to do
- Import August and September from the spreadsheet (row mapping to be shown
  before any client record is created).
- Settlement email templates, with the funds-to-complete reminder firing one.
  Prepopulation follows the BC pattern, simpler. Fabio supplies the wording and
  recipients.
- Board view across ALL stages: Fact find -> BC -> LO -> Compliance ->
  Compliance issued -> Lodged -> Preapproved -> Formal -> [Loan docs returned]
  -> [Settlement booked] -> Settled. Needs ONE canonical "which column is this
  deal in" function first, because pre-lodgement uses `stage` and post-lodgement
  uses timestamps. Dragging a card must do exactly what the buttons do.
- Anniversary / fixed-rate-expiry tracking (Salestrekker has 1 Year and 2 Year
  columns). Parked deliberately.
- `lender_ref` is captured but nothing writes it yet - it should be filled at
  lodgement along with lender and scenario.
