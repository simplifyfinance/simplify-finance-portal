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

## The broker key, and where a broker is managed (FINAL — 17 Aug 2026)

A broker used to exist in three places joined only by matching their first name:
the profile in settings.brokers, the login in user_profiles.broker_key, and
their targets in pipeline_targets.broker_key. Nothing enforced the join and
nothing showed when it was broken.

- **The broker key is the single join.** Lower case, historically the first
  name. It links the profile, the login, the deals and the targets. It is shown
  and edited on the broker's profile in Settings.
- **Settings → Broker profiles is where a broker is managed.** Details for
  documents, the key, and their own monthly targets, all on one card.
- **Settings → Business targets is the business only.** A broker's targets are
  never set there.
- **The profile card says when the wiring is broken** — amber whenever no login
  carries that key, because targets will still save while the person never
  appears on the Pipeline.
- **Settings → Team, Access** sets broker_key, is_admin, sees_finance and
  sees_all_deals. These were SQL-only until now, which caused two live problems.
- **Inviting someone as a broker asks for their key** and writes it, so a new
  broker is wired from the moment they are invited.
- **role and is_admin remain two columns.** role drives the deal screens,
  is_admin drives Targets, Monthly actuals and the sidebar. Where they disagree
  the Access panel warns rather than guessing. Merging them is still open.
- **Everyone sees every broker** on the Pipeline snapshot. This replaces the
  earlier rule that only sees_finance people saw other brokers by name.
- **Custom period is whole months only.** History before the portal is stored as
  monthly totals, so a half month cannot be reported honestly.

## Commission library — COMPLETE (17 Aug 2026)

35 lenders, all confirmed, every upfront, trail and clawback window present.
Bank Australia is clawback_months = 0, meaning genuinely nil — not unknown.

Nothing in commission or clawback reporting is blocked on data any more.
Both can be built with no "rate not confirmed" tail.

## Statement analysis — the Statements tab (31 Aug 2026)

A CashDeck income verification workbook is dropped on a deal, read against that
deal's fact find, and the differences flagged. Decisions made building it:

- **The tab NEVER writes to the fact find.** Every difference is a flag for a
  person to answer. A tool that silently corrects a declared figure would put a
  number in a client file that nobody chose.
- **The score reads the FILE, not the client.** It measures how much of what was
  declared the statements confirm and how many questions are open. A number
  banded "strong / weak" against a person is a credit opinion generated inside an
  ACL business, and it would live in the file forever. The score is never shown
  to the client and never sent to a lender. Four components, weighted: income
  verified 30, commitments matched 30, conduct 25, coverage 15.
- **Every transaction is stored against the deal**, so the drill-downs still work
  months later without the original upload. Both tables sit behind the deals
  policy — the policy asks whether the user can see the deal and lets the deals
  policy answer, so visibility is decided in one place.
- **Nothing is annualised from a single occurrence.** One rent credit, one
  dividend, one debit to a lender: listed, never multiplied up. Money that does
  not repeat says nothing about a year.
- **A figure that cannot be worked out honestly is withheld with a reason.** When
  no closing balances are supplied, overdrawn days, lowest balance, genuine
  savings and the savings trend all read "—" with an explanation. They never read
  zero. An account with no balance is left out of the combined figure rather than
  counted as nothing.
- **The financial year comes from the statement dates, not from today.** A period
  crossing 1 July is grossed up under both scales and the dominant year is the
  headline. The first bracket steps 16% → 15% on 1 July 2026 and → 14% a year
  later, so this matters immediately.
- **The gross-up can only understate.** It assumes no HELP debt, no salary
  sacrifice and no pre-tax deduction, so the real gross is always at least the
  figure shown. That asymmetry is stated on the card, because a broker acting on
  it in the other direction would be wrong.
- **Commitments are matched by lender name, not by amount.** A loan declared at
  $500 and debiting $585 is declared — a value difference, not a hidden
  liability. Treating it as hidden would train people to ignore the card.
- **Undisclosed income is read as a find in the client's favour**, not as a
  flag against them, and it is a prompt to go and get the evidence rather than a
  figure to type into a servicing calculator.
- **Short provider codes must match a whole word.** "ppl" lives inside "apple"
  and "ing" inside almost everything; both produced wrong findings on a real
  file before the split existed. Anything four characters or shorter is matched
  as a word, never as a substring.
- **Money that is not income is set aside and shown, never dropped silently.**
  Transfers between the client's own accounts, credits carrying the client's own
  name, and refunds or Medicare rebates each get their own line in the Other
  income drill-down so a reviewer can disagree.
- **No Export CSV and no Copy to file notes.** Asked for and declined — the
  drill-downs are for reading on screen.

The provider watchlists (buy now pay later, gambling, small amount credit
lenders, real estate agents, benefit types, lender aliases) live in
`lib/statement-watchlists.ts` so they can be read at a glance and moved into
Settings later.

## Statement rules live in Settings (31 Aug 2026)

- **An analysis stores the rules it was run under.** Changing a threshold must
  never silently rewrite a file someone has already reviewed. The deal compares
  the two, names in plain words what has moved, and offers to re-run.
- **Re-analysing reads the stored ledger, not a new upload.** Every transaction
  is already against the deal, so the findings can be recomputed without asking
  for the file again and without a second copy of the client's banking data. The
  transactions themselves are never rewritten — they are what the bank said.
- **A half-saved rule set falls back field by field.** Adding a rule later must
  not break a portal saved before it existed, and an empty list falls back to the
  shipped one rather than matching nothing.
- **An empty number box means "not set", not zero.** Reading it as zero turned
  every threshold into its minimum the first time settings were saved. Caught by
  a test, not by looking at it.
- **The serious salary threshold cannot sit below the question one.** Otherwise a
  variance could be amber and red at once and the card would contradict itself.
- **A row with a name but no terms is dropped, not kept.** A rule that matches
  nothing while looking like it works is worse than no rule.
- **The four-character rule is shown in the interface**, not just enforced. A
  short code matches whole words only; a longer one matches anywhere. Someone
  adding a term needs to know which they are getting.

## CashDeck is the only bank statement format (FINAL — 31 Aug 2026)

Simplify uses CashDeck and nothing else, so the statement parser reads CashDeck
and refuses anything else by name rather than guessing at it. illion was
considered and dropped — not deferred. Do not build a second parser without a
real reason and a real file to build it from.

## Arrears is remembered against the loan (31 Aug 2026)

A trail can stop because the borrower is behind. Marking that is now a fourth
outcome on Trail missing, beside Paid, Not owed and Queried.

- **The memory is keyed on the loan, not the gap.** Every other outcome is filed
  against broker + loan + the month it last paid, which is right for "we chased
  this one". Arrears is different: the same loan goes quiet again months later
  under a new key, and everything learned the first time would be lost. So the
  lookup ignores the month.
- **It prompts, it never clears.** A loan that has been in arrears before carries
  an amber marker saying so and how long ago. It does not pre-tick anything and
  it does not clear the row. A ten-month-old arrears note is a reason to check,
  not an answer.
- **The marker hides on the gap it belongs to.** Where this gap is itself the one
  marked arrears, the existing status badge already says so and a second badge
  beside it would be noise.
- **It rides along in the Excel export**, because that is the column that turns a
  chase list into "ask about the arrears first".

## A missed trail month is usually not missing (31 Aug 2026)

Usha at SFG, 31 Aug 2026, confirmed by four Bendigo loans: when a trail month is
skipped, the lender does not drop it. It is paid as an **extra line item** in a
later statement — not as one doubled figure. Mehta had two January 2026 lines of
$67.90, and the balances prove which is which: 533,132.57 sits between November's
533,784.02 and January's 532,559.07, so the second line is December's payment.

- **Count the payments, not the months.** The view grouped a loan's lines by
  month and summed them, so two January lines looked like one January payment and
  the hole at December looked real. It now counts lines as well.
- **A gap is caught up when the returning month carried at least one extra line
  per month away.** Extra means more than that loan normally gets, not more than
  one: about forty loans are split loans that receive two lines every month, and
  for them two is normal and three is the catch-up.
- **It is a flag, not a verdict. The row stays on the list.** Fabio, 31 Aug 2026:
  keep showing missing trail exactly as before, and just say when that loan was
  paid twice that month so he does not ask about it twice. Nothing is cleared,
  no total moves. A row that vanishes on a guess is worse than a row that asks a
  question — and the check is not safe enough to clear money on, which the MA
  Money rows proved within minutes of it being written.
- **Why it is not safe to clear on.** Counting lines counts nil-value lines too,
  and those are common — May 2025 alone had 81 trail lines worth zero. Three MA
  Money loans came back "caught up" when Usha's file note said the trail amount
  was NIL and nothing was ever owed. Good enough to raise a flag; nowhere near
  good enough to take money off a chase list.
- **The amount is not the test either.** The summed figure does come out at
  roughly double, but the ratio is unreliable: on a nearly-offset loan paying
  $0.54 a month, ordinary movement produces ratios of 16 or 29.

## A query is tracked until it is answered (31 Aug 2026)

"Queried, waiting" used to clear the row off the list and record the date without
ever showing it. A query nobody replied to and a query nobody sent looked
identical once the row had gone.

- **The badge carries the age.** "Queried · 6 weeks" rather than "Queried".
- **After 21 days with no answer it comes back on the list by itself**, in amber.
  SFG normally answer inside a fortnight, so three weeks is late rather than
  merely pending. Marking it again resets the clock; a real answer — paid, not
  owed, in arrears — closes it properly.
- **The toolbar says how many are waiting and how long the longest has been.**
- **Three views, not a "show cleared" checkbox.** Paid, not owed and in arrears
  are finished answers and leave the chase list for good. A query is the only
  outcome still waiting on somebody, so it gets its own view. Answered stays
  reachable rather than vanishing entirely, because otherwise one misclick hides
  a real claim with no way to put it back.
- **Nothing new is stored.** resolved_at was always being written; it was simply
  never read. The fix was to show it.

## Clawback risk, and the amber that was never readable (31 Aug 2026)

The loan list already existed as `ClawbackWatch`. What was missing was the shape
of it — four figures, when it clears, and which lenders carry it — so the section
no longer opens straight into a 147-row table.

- **The window comes from the dates, not from a second lookup.** Each lender's
  window is derived from settled date to window end on the loans themselves, so
  the months column can never disagree with the figure beside it.
- **"Upfront at risk" is the whole upfront, and says so.** Most lenders claw the
  lot in year one and part of it in year two, but the library holds the window
  length and no taper. Worst case, stated plainly, until someone supplies the
  year-two percentages. It is not guessed.
- **"Settled in the last 12 months" makes no claim about recovery.** It is the
  newest and most exposed part of the book, nothing more.
- **Commissions is now one section at a time**, chosen from the sidebar, the same
  way Settings works. Seven sections stacked on one page had become a very long
  scroll. `PANES` on the page and `SUBNAV` in the sidebar share their keys.
- **The overstatement warning sits above the numbers, not under the table.** A
  caveat below a figure someone has already read and believed is decoration.

The amber, separately: `#B4761F` had been typed by hand into ten files and
measures **3.78:1 on white** — under the 4.5:1 floor `lib/tone.ts` exists to
hold, and worse on its own chip at 3.52:1. It is now `#946017`, the same hue
taken down until it clears: 5.32:1 on white, 4.96:1 on the chip. Measured, not
eyeballed. `TONE.warn` is the token; only files that already import TONE use it,
because rewriting a Tailwind class string into a JS expression breaks the class
silently — which is exactly what happened on the first attempt.

## The broker key is never what a person reads (31 Aug 2026)

Team workload and the Dashboard were printing the broker key straight onto the
screen, so every broker appeared as "fabio", "kylie", "mark". The key is lower
case by design — it is the join, not a label.

- **Name from the register, key for matching.** Team workload was already
  querying `brokers` for both and then mapping to the key, throwing the name
  away. The Dashboard had no register at all; its server page now loads one and
  passes it down.
- **A tidied key is the fallback, and only for a profile with no name recorded.**
  Never for a name we simply did not bother to fetch.
- **`check-broker-keys.sh` had a hole and has been closed.** It caught a bare
  `assigned_broker ===` but walked straight past
  `assigned_broker?.toLowerCase() === brokerKey.toLowerCase()`, which looks
  careful and is not: `brokerKey()` takes the first word, so "Fabio De Castro"
  lower-cased never equals "fabio". Two of those were live on the Dashboard.
  Extending the check found four more, including a Settlements broker filter
  that would have shown an empty screen rather than an error.
- **The new rule was proved by reintroducing the bug** and watching the ship
  refuse, then putting it back. A guard nobody has seen fail is not a guard.

Swept the rest of the portal on 31 Aug: the deal header's broker chip, the
Dashboard deal rows, and the deals list. Also removed `BROKER_DISPLAY`, a
two-person map hard-coded into the deals page whose keys were capitalised and so
never matched a key anyway, and the `['Fabio', 'Mark']` fallback beside it — a
team list in code, twice over.

- **`lib/broker-names.ts` is the one loader.** `useBrokerNames()` returns the
  register's options and a `nameFor(key)`. Three screens had each written their
  own version of the same query and each thrown the name away.
- **A new deal no longer defaults to a named person.** It was `brokerKey ||
  'Fabio'`. An unassigned deal is visible and fixable; one quietly filed under
  the wrong broker is neither, so the picker now requires a choice.
- **`check-broker-keys.sh` refuses a key rendered as text.** It ignores props,
  form values and template-literal map keys, which is the key doing its job. The
  Broker profiles screen shows the key deliberately and says so with a
  `shows-the-key:` comment.

## Sending the LO never recorded that it was sent (31 Aug 2026)

A deal that had gone to the client still read "Waiting on: Broker to review and
send". The label logic was right all along — `lo_sent_at` was simply never
written.

- **The write was fired and abandoned.** `supabase...update(updates).then(() => {})`,
  unawaited and unchecked, immediately after `window.location.href = mailto:`.
  Handing the browser a mailto can abort a request already in flight, so the
  write frequently never completed — and "Sent" was shown before it was even
  attempted.
- **BC had already been fixed for exactly this** and carries a comment saying so
  ("Navigation can abort in-flight requests, which previously lost Ellie's
  notification silently"). LO was never brought across. Fixing one of a pair and
  not auditing the other is how this returns.
- **Now: persist first, await it, `.select()` it, check the row, and only then
  navigate.** A failure says so instead of showing "Sent".
- **The page is told immediately**, via `onDealFieldChange`, so the badge moves to
  "Waiting on: Client to respond" without a refresh.
- **`scripts/check-writes.sh` now fails the ship** on any `.then(() => {})` or
  `.catch(() => {})` attached to an update, insert, upsert or delete. CLAUDE.md
  calls unchecked writes the most repeated failure in this codebase; this was the
  fifth. A write that genuinely does not matter opts out with a
  `fire-and-forget: <why>` comment — writing the reason is the point. Only one
  qualifies today: remembering which tab was last open.
- **Proved by reintroducing the bug** and watching the ship refuse.

## What a deal is waiting on comes from the timestamps (31 Aug 2026)

A deal whose LO had been written, sent and was sitting with the client still read
"Waiting on: Broker to review and send".

- **The label was reading `deals.stage`.** That column is advanced in exactly one
  place in the codebase — when a client clicks proceed. This client never had, so
  `stage` was still 'BC' and the label was answering a question about the BC and
  had never looked at the LO at all. The progress bar above it was right the whole
  time, because it reads timestamps.
- **It now reads the same timestamps.** Find the furthest milestone reached, name
  the next one that has not happened. `deals.stage` is not consulted, and a test
  asserts the answer is identical whatever that column says.
- **A skipped step behind the furthest milestone is history, not a task.** This
  deal never had `bc_sent_at` ticked, yet the LO was finished and sent. Walking
  the ladder from the top would have stuck on the BC forever.
  **Fabio, 31 Aug 2026: this is normal and the behaviour is deliberate.** The BC
  is often done outside the portal and only the LO is entered here, so BC
  milestones will legitimately be missing on plenty of deals. A deal is never
  chased for a step it was never going to have. Do not "fix" this by requiring
  the steps in order.
- **The labels now name the stage** — "review and send the LO", "respond to the
  BC". The old wording was identical for both and that is what made this so hard
  to see.
- Covered by `lib/deal-status.test.ts`, including the exact row that exposed it.

Separately: `deals.stage` now drives almost nothing but is still stored. Either
it should be removed or it should be maintained. Leaving it half-true is what
caused this.

## Flagging an LO recommendation feeds the next one (31 Aug 2026)

Compliance already had a feedback loop: flag a bad AI answer, the flag lands in
Settings, promote it and it becomes a style note the next draft has to obey. The
Lending Options recommendation had the AI button but no way to say it got it
wrong.

- **The LO now has the same flag panel**, next to the "✦ AI draft recommendation"
  button. A flag writes to `compliance_flags` with `stage = 'lo'`.
- **LO flags and Compliance flags are stored in the same table but kept apart.**
  Promoting an LO flag writes to `settings.lo_style_notes`; promoting a
  Compliance flag writes to `settings.compliance_style_notes`, exactly as before.
  A correction about how a recommendation should be worded must never be able to
  change a Compliance answer — different documents, different regulator, different
  audience. Settings shows an LO/Compliance chip on every flag so it is obvious
  which pile a correction is going into.
- `compliance_flags.stage` defaults to 'compliance', so every existing flag keeps
  behaving the way it always did.
- The generate route takes `styleNotes` and appends them to the prompt, mirroring
  `generate-compliance`. The LO form shows "N style notes applied" so it is clear
  the corrections are actually being used.
- Both promote paths now check the returned row and roll back the on-screen list
  if the write did not happen — RLS returns zero rows and no error, so an
  unchecked write looks like success.

## The progress bar was ticking the wrong thing (31 Aug 2026)

Two deals looked identical on the bar — Fact Find and BC green, Lending Options
lit up — while the amber chip underneath correctly said one was waiting on the
client to respond to the BC and the other on the credit officer to write the LO.

- **The BC bead was ticking on `bc_completed_at`.** That timestamp means the
  credit officer finished typing and handed it to the broker. Not sent, not
  agreed. So a BC sitting unanswered with the client showed as finished, and the
  LO showed as under way when nobody had opened it. Lending Options had the same
  fault on `lo_completed_at`.
- **A stage is finished when the client agrees to move past it.** BC closes on
  `client_proceeded`, LO on `lo_client_proceeded`. Nothing else closes them.
- **The beads and the chip now come out of one file**, `lib/deal-status.ts`.
  They disagreed because they were two separate ladders; there is now one.
  `currentStage` — which decides the tab the deal page opens on — comes from the
  same beads, so the blue bead and the open tab cannot disagree either.
- The skipped-step rule from earlier today still holds: a BC done outside the
  portal does not hold the bar at BC forever. A test covers it.
- The live bead now carries one short word — "with client", "with credit",
  "with broker" — so the bar says who is holding the deal up without reading the
  chip.

## "Client agreed" stays on screen, and says who pressed it (31 Aug 2026)

The button vanished the instant it was pressed. On a deal where someone had
already pressed it there was nothing there at all, which looks exactly like a
broken screen — and that is how it was reported.

- **It now stays, ticked and locked, with the date**, matching the "✓ Sent to
  broker for review" button beside it. Both the BC and the LO tab.
- **There are two doors onto the same lock.** The client presses Proceed on their
  own page, or one of us presses "Client agreed" because they rang or replied.
  Both used to write `client_proceeded` and nothing else. They now stamp
  `proceeded_source` ('client' or 'office') and, for the office, who.
- **Deals recorded before today say so.** `proceeded_source` is NULL on all of
  them and has no default, so the button reads "recorded before we started
  tracking who pressed it". Guessing "the client pressed it" on a deal where one
  of us did would be worse than saying nothing.
- The proceed write is now checked — it `.select()`s and fails loudly. It was a
  bare update, and RLS refuses by returning no rows and no error, so a refused
  write would have reported the client as having agreed.

## Clawback risk was blank because it read the wrong table (31 Aug 2026)

The screen showed nothing at all. Not a rendering fault — it had nothing to draw.

- **It read `deals` filtered on `settled_at`.** That is the portal's own pipeline,
  and **not one deal in it has ever been ticked as settled** — confirmed by query,
  the count is zero. Meanwhile the commission statements hold **766 upfronts, 732
  of them settled in the last two years**, each with a settlement date on it. The
  settled book is in the statements. That is where it looks now.
- **The figure at risk is the upfront that was actually paid**, straight off the
  statement, not one worked out from the rate library. The library is now only
  asked one thing: how many months each lender's window runs.
- **One loan, not one line.** A loan paid across two lines — a split, an increase —
  is added up and listed once, and its window runs from the earliest settlement.
- **Loans already clawed back are left out.** They are not at risk of it twice.
- **Two things are called unknown rather than safe:** a line whose lender is not
  in the rate register, and a line with no settlement date. Both are listed under
  the table. A lender that genuinely has no clawback period is skipped silently —
  nothing to watch is not a problem to report.
- The maths moved to `lib/clawback.ts` with 11 tests, including the boundary
  (a window closing today is still open; closing yesterday is not) and the
  already-clawed-back case. It was inline in the component and untestable.

Same shape checked elsewhere: `SettlementReconcile` also reads `deals` on
`settled_at`. Its "unpaid" tab is empty for the same reason, but that is correct —
it exists to reconcile portal deals against statements, and with no settled portal
deals there is nothing to reconcile. Its "Paid, no deal" tab reads the statements
and still works. **Fabio: if portal deals are never going to be marked settled,
that tab is dead weight and should be said so out loud on the screen.**
