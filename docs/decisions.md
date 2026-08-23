# Decisions

Every decision goes here the moment it is made, with enough detail to act on without
asking again. Chat history gets compacted and summarised; this file does not.

If a decision is not written here, it does not exist.

## Access and visibility

- **Pipeline shows every deal to every team member.** Business-wide totals for
  everyone, through a SECURITY DEFINER register that exposes only register columns —
  never form data. Deal files themselves stay restricted.
- **The database decides access.** No allowlists in code. `sees_all_deals`,
  `sees_finance`, `is_admin` and `broker_access` grants are the only inputs.
- **Kylie keeps access to Fabio's deals permanently**, and will become a broker in her
  own right. She has `is_admin` but not `sees_finance`.
- **Targets are visible to Kylie. Commissions are not.** Targets are goals; commissions
  are earnings.

## Pipeline and reporting

- **Australian financial year, 1 Jul – 30 Jun.** Quarters align to it: Q1 is Jul–Sep.
- **A part-finished period is compared like for like** — the same months of earlier
  years, never against a complete year.
- **"Business average" means the same month across the last three financial years**,
  not a rolling twelve-month average. August is compared to Augusts.
- **The spreadsheet history is authoritative through Jul 2026.** From Aug 2026 the
  portal's own deals count. A month can be overridden by hand in Pipeline → Monthly
  actuals, and released again.
- **Brokers are measured against their own target and their share of the business
  only.** No year-on-year per broker — the ten years of history is a business total,
  because only Fabio was a broker for it.
- **Targets are entered by hand, monthly, per financial year**, for the business and
  for each broker. Quarter and year targets are the months summed, never typed.

## Commission

- **Calculate upfront and trail only.** Clawback is stored as published wording plus a
  window in months, used for the loans-at-risk report — never modelled as a formula.
- **Two layers.** `commission_schedule` is the 56-lender SFG schedule verbatim, for
  reference and audit only. `commission_rates` is the calculating layer, covering the
  lenders we are accredited with.
- **Only confirmed rates calculate.** Unconfirmed, missing or rateless reads
  "rate not confirmed" — never zero, never an estimate.
- Lenders can be added and removed from the calculating layer; the published schedule
  is never edited.

## Client position

- **Written at Settled, not at compliance push.** After settlement the position is the
  fact find **plus** the settled loan as a new liability and, for a purchase, the
  property as a new asset. On a refinance the new loan replaces the liability it
  refinanced rather than adding to it.
- **Also offered when a deal is closed**, as a checkbox on by default. A lost deal
  still captured a full fact find and that is worth keeping. Written **as declared** —
  no loan added, because no loan happened.
- Both prompt before overwriting and show what is about to change.

## Deal lifecycle

- Push to SalesTrekker emails whoever Settings nominates and asks them to move a card.
  There is no SalesTrekker API. Lodgement is marked by hand in the portal afterwards.
- Stages keep their own snapshots: lodged, formal, settled. Amounts differ between
  them and commission is calculated on the settled amount at the settled date.

### Close reasons — FINAL

Eight, and they cover everything. Stored value on the left, label shown on the right.

| Value | Label |
|---|---|
| `no_response` | No response from client |
| `not_ready` | Not ready yet — revisit later |
| `changed_plans` | Client changed plans |
| `property_fell_through` | Property fell through |
| `servicing` | Servicing — couldn't borrow enough |
| `insufficient_funds` | Insufficient deposit or funds |
| `duplicate` | Duplicate or invalid enquiry |
| `other` | Other — note required |

`other` requires a note. Nothing else does.

### Closing a deal

Closing is one step, not three. The modal asks for the reason, offers to save the
client's position, and takes one next action.

- **One next action per closed deal**, with a date. Not a task list — one thing, so it
  actually gets done.
- **Three reasons are "not now", not "never"**, and require a follow-up date rather
  than leaving it optional: `not_ready`, `servicing`, `insufficient_funds`. These are
  the ones that come back, and they are the reason for closing properly rather than
  letting a deal rot in the active list.
- **The client's position is saved by default**, as declared — no loan added, because
  no loan happened. A lost deal still captured a full fact find.
- Closing sets `status = 'lost'`, which the credit team workload screen and the
  waiting-on label already respect. Until this is built, every dead deal counts as
  active work.
- **A follow-up date emails support** — the same recipient as "when a deal moves
  stage", set in Settings — asking them to put a follow-up task on the deal card for
  the broker and the support team. Interim behaviour, deliberately.
- **Later: tasks live in the portal**, so nobody leaves the system to record or see a
  follow-up. The email exists only until that is built.
- **Monday digest** lists next actions falling due that week.

## The deals list

- **Grouped by what needs attention**, not a flat list: Needs a nudge / Running long /
  Moving / Settled this month. The top of the page is the morning's work.
- **Brokers see their own deals; admins see all.** This is the existing access model —
  RLS plus `sees_all_deals` and broker grants. No separate rule.
- **Age is days in the current stage**, measured in **business days** so a Friday
  action does not look stale on Monday. (My call — say if calendar is preferred.)
- **Thresholds per stage**, because they are not the same:

  | Stage | Running long after | Needs a nudge after |
  |---|---|---|
  | Fact find | 10 | 15 |
  | BC | 3 | 5 |
  | Lending options | 7 | 10 |
  | Compliance (being written) | 5 | 8 |
  | Compliance issued, not lodged | 5 | 8 |

  Post-lodgement stages are not aged yet — those wait on the lender, not on us.
- **Ageing starts 24 Aug 2026.** A stage entered before that date is not aged and
  shows no chip — the historical timestamps predate the rule and would fill the top of
  the list with deals nobody intends to chase. Anything entering a stage from that date
  on is tracked immediately, including deals created long before it. The cutover is
  `AGEING_FROM` in `lib/deal-age.ts`.
- A deal at "compliance issued" ageing is the one that matters most: it means nobody
  moved the SalesTrekker card and nobody marked it lodged.

## Interface

- Sidebar sections nest in place — Settings, Lender library and Pipeline. Never a
  second left column beside the portal's own nav. The chevron toggles.
- Lender library stays in MAIN. Commission library lives under Settings, finance-gated.
- Palette: ink for values, ink-soft for labels, ink-faint for hints. Cyan is never a
  button — a section dot, a badge, an add action, a focus ring. Nothing more.
- Design is shown before it is built, using the real palette and real data.

## Process

- **Deploy only with `./scripts/ship.sh "message"`.** It refuses on a failed build and
  refuses off `main`.
- **A decision is recorded here in the same commit as the work it decides.**

## Commission library (FINAL — 17 Aug 2026)

One view only: the lenders we are accredited with. The full SFG schedule is not
a separate tab; it appears as source text under each lender.

- **Upfront** — one percentage, except where the lender genuinely prices by LVR
  (ING, ANZ, ANZ Medical). Bands are read-only in the UI and changed by request.
- **Trail** — ONE percentage. Lenders whose trail steps up over the years are
  flattened to the first-year figure, with the stepping written into comments.
  Calculation and reporting use the single figure. Deliberate simplification.
- **Clawback** — a whole number of months only, "out of clawback after N".
  The diminishing scale is not modelled. Wording only, for the loans-at-risk
  report. 0 = no clawback.
- **Comments** — free text. Where the nuance lives.
- **Editing** — a row is read-only until Edit is pressed. Save writes and
  collapses; Cancel discards.
- **Amending the SFG text** — allowed. The entry is tagged "Amended", and the
  original is retained in commission_schedule.original and can be shown.
- **confirmed = false is honest.** Commission calculation uses confirmed rates
  only and reads "rate not confirmed" otherwise. Never zero, never an estimate.

Still needed from Fabio: La Trobe (fee-based schedule) and ME Bank (not in the
SFG schedule — now part of BOQ) have no figures at all.

## Targets and pace (FINAL — 17 Aug 2026)

Alan's FY27 targets are loaded: $449,867,845 lodged, $330,000,000 settled,
business-level (broker_key null). Monthly dollars reconcile to his totals
exactly. His deal COUNTS are one over his own stated totals (666 vs 665 lodged,
515 vs 514 settled) — rounding in his spreadsheet. Counts are not loaded; the
portal tracks dollars only.

- **Targets screen sets numbers. It does not compare them.** Last year's actual
  is a faint reference while typing. No Change column — comparing a target to a
  prior-year actual is not a result anyone acts on.
- **The Pipeline is the only place results are compared.** Three questions, at
  any scope: this period vs target; financial year to date vs target (ahead or
  behind); and vs last year.
- **Pace pro-rates the running month.** Part-way through a month, only that
  share of the month's target counts. Otherwise every month reads as behind
  until its last day.
- **Brokers get target, year-to-date pace and share of the business. Never
  year-on-year** — the ten years of history is a business total with no broker
  split. Share of business is suppressed with an explanation whenever the
  business figure for that period came from the spreadsheet.
