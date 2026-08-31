# Portal backlog

Current state. Update as things land.

## Waiting on Fabio

- **Confirm the 22 commission rates** (Settings → Commission library). Gates the
  commission calculation, RCTI reconciliation and the clawback report. Bankwest 34
  deals, St George 30, ING 19, ANZ 17, Ubank 15, CBA 14 — those six are 129 deals.
- **A figure for La Trobe and ME Bank.** La Trobe's schedule is fee-based; ME Bank
  isn't in the SFG schedule at all (now part of BOQ).
- **Alan's FY27 monthly targets.** Until they land, every "vs target" panel reads
  "not set".
- **Test the stage snapshots** (`f2d64e8`) on a cloned deal: Lodged, then Formal with
  a changed split amount and repayment type. Check the amber highlighting, the
  variance line and the modal comparison. Never been run.
- **Melissa's browser cache** may still hold unsaved BC work from before the
  localStorage fix. She must not clear browser data.
- **Supabase backups** never checked. **Blake Toscan's figures** need retyping or
  recovering from them.

## Next to build

1. **Loans at risk of clawback.** No new plumbing — settled dates and clawback
   windows are loaded. Total exposure, the 100% band (first 12 months), what clears
   each month, by lender. Works on unconfirmed rates: it only uses the window.
2. **Client position at settlement.** Currently written at compliance push, which is
   too early — the loan can still be declined. Move to Settled with an overwrite
   prompt. Open question: copy the fact find as-is, or add the settled loan and
   purchased property to it.
3. **Commission calculation.** Upfront and trail from confirmed rates only. LVR bands
   for ING and ANZ. Anything unconfirmed reads "rate not confirmed" — never zero.
4. **AI expenses.** Usage table, logging in six routes, per-model price list, screen.
   60–90 min. Only counts from the day it ships.
5. **Tasks in the portal.** Follow-ups currently leave the system as an email asking
   support to create a card task. Bring them in: a task on the deal, visible to the
   broker and support, with the Monday digest reading from it.
6. **RCTI import.** Expected against received. Upfront only to start.
6. **Access & permissions screen.** `is_admin`, `sees_finance`, `sees_all_deals` are
   SQL-only. Has caused two incidents.
7. **Closing deals without losing the client.** Eight closure reasons, one next
   action, Monday digest. Then opportunities and referrals.
8. **Group referrals and the overlap report.** Business unit on deals, client identity
   columns, hashed matching across the four businesses. Its own project.

## Known gaps in the process

- **Compliance issued → lodged is joined by memory.** Push to SalesTrekker emails a
  person asking them to move a card; nothing tracks whether they did, and nothing
  prompts anyone to mark the deal lodged. No ageing, no task.
- **Spreadsheet history wins to Jul 2026.** Portal lodgements dated before August
  won't move the Pipeline. Release the month in Pipeline → Monthly actuals if needed.

## Small things

- `custom` email template renders `$undefined` (operator precedence on purchase price).
- `investment_purchase` repayment line omits the loan term.
- Compare-options checkbox ungated on ten templates.
- No build-time guard against field drift — agreed after the blank-data incident.
- Confirm Dinisha and Ria should see zero deals (no `credit_officers` rows).
- Rename `notifyEllieCreateCard` / `notifyCrisMoveCard` — internal names only.

## Settlements (next build — agreed 17 Aug 2026)

Its own item in the left nav, gated by a NEW `sees_settlements` flag on
user_profiles — not is_admin and not sees_finance, so a settlement person can be
given it without finance. Top-level nav items are not permission-filtered today;
that filter has to be added.

Replaces the settlement team's monthly spreadsheet. Built on:
- `deals.expected_settlement_date` — does not exist yet, and is the spine of it.
- a settlement status, so "trying to settle this month" is a real state.
- Google review state: asked / reminded / left / declined, plus dates. The portal
  KNOWS the state; the separate reviews project DOES the asking. Fields to be
  named to match that project's stages so the two never need reconciling.
- "Commission paid" — a manual tick now (paid, date, amount received). When the
  commission platform lands it becomes a reconciliation: expected vs received,
  with the gap visible. The settlement team's habit does not change.

Sequencing decided: settlements BEFORE commission. Nothing here depends on
commission existing, and it is the screen the team touches daily.

Blocked on: the settlement team's spreadsheet — their actual columns, what they
tick off monthly, and anything colour-coded (usually a status nobody wrote down).

## Loans at risk of clawback — MOVED

Was next-to-build. It is a dollar figure — what commission comes back if a loan
repays inside its window — so it needs the commission platform. Counting loans
and months without dollars is not something anyone would act on. Sits AFTER
commission calculation.

## Statement analysis — BUILT, not yet run on a live deal (31 Aug 2026)

The Statements tab sits between Fact Find and BC on every deal. Drop the CashDeck
income verification workbook on it and it reads the statements against that deal's
fact find.

Shipped:
- `lib/tax-au.ts` — resident rate scales by financial year, Medicare levy, LITO,
  and the reverse solve from net to gross. 16 tests.
- `lib/statement-parse.ts` — reads the CashDeck workbook. Reads only, judges
  nothing, so a change to their export breaks one file.
- `lib/statement-watchlists.ts` — the named providers and benefit types.
- `lib/statement-analysis.ts` — the findings, the cards, the worklist, the score.
  37 tests.
- `app/api/statement-analysis/route.ts` — upload and delete, both counting rows.
- `components/StatementAnalysis.tsx` — the tab.
- `docs/statements-schema.sql` — two tables, run once in Supabase.

Rules moved into Settings (31 Aug 2026):
- `lib/statement-rules.ts` — the shape, the defaults, field-by-field fallback for
  a half-saved copy, and `rulesChanged` for telling someone in plain words what
  has moved. 16 tests.
- `components/StatementRules.tsx` — Settings → Statement analysis. Six thresholds
  and every named list.
- `PUT /api/statement-analysis` re-runs the findings over the stored ledger under
  the current rules. No file, no second copy of the client's banking data, and the
  transactions are never touched.
- An analysis stores the rules it ran under, so changing a threshold never
  silently rewrites a file someone reviewed. The deal shows what moved and offers
  to re-run.

Still to do:
- Run it on a real deal on Vercel and check the findings against the file by hand.
- An analysis saved before 31 Aug has no `parsed_meta`, so Re-analyse refuses and
  says to remove and upload again. Only affects files loaded on the first day.
- Multiple uploads per deal: the tab reads the most recent and Remove deletes it.
  If a deal ever needs two periods side by side, the tables already support it -
  only the tab assumes one.
- illion is the other format the industry uses. The parser is CashDeck only and
  says so plainly when handed something else.
