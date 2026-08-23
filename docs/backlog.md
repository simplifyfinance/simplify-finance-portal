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
