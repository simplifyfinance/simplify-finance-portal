# Portal backlog

Current state. Update as things land.

## Waiting on Fabio

Nothing is blocked on commission rates. The library was completed 17 Aug 2026 —
all 35 lenders confirmed, every upfront, trail and clawback window present. The
old "confirm the 22 rates" line lived here until 31 Aug 2026 and was wrong; it
had already been done. Check `docs/decisions.md` before trusting a blocker here.

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

**SETTLEMENTS IS NEXT.** Agreed 17 Aug, re-confirmed 31 Aug. It is the screen the
team touches daily. Blocked on one thing only: the settlement team's spreadsheet
— their actual columns, what they tick off monthly, and anything colour-coded
(usually a status nobody wrote down). Ask for it at the start of the next
session rather than starting something else.


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

- ~~`custom` email template renders `$undefined`~~ FIXED 31 Aug. It was 34 lines
  across seven templates, not one, and it hid a second fault: an unquoted shell
  heredoc had turned `$0` into `/bin/zsh` in the first home buyer duty line.
  Fixing the precedence alone would have put that in a client email. Guarded by
  `lib/email-money.test.ts`.
- ~~`investment_purchase` repayment line omits the loan term~~ FIXED 31 Aug.
- **Compare-options checkbox — the note does not match the code.** The checkbox is
  gated to oo_purchase, investment_purchase and refinance_equity in BCForm, and
  the email route honours `compareOptions` for exactly those three. Nothing is
  ungated. What IS true: `compareOptions` and `altScenarios` stay in `bc_data`
  after switching to a template that does not use them, so stale scenarios sit on
  the deal and would appear if a template were ever added to that list. Needs
  Fabio to say which was meant before anything changes.
- ~~No build-time guard against field drift~~ DONE 31 Aug — `lib/bc-fields.test.ts`
  compares `buildBcData()` against the autosave dependency array and fails the
  build when they disagree.
- Trail arrears: only the marker is built. Deliberately not built yet, and worth
  revisiting once it has been used a few times — a note box against the reason,
  the other reasons a trail stops (fully offset, hardship, first year, not fully
  drawn), and on "came back", whether the lender back-paid the months it missed.
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

---

## Reviews, tracked (its own project — NOT part of settlements)

17 Nov 2026. Fabio: "the only thing outstanding is the Google review, which is a
whole portal, which we have all the data... remove any Google reviews process
from this."

Then, an hour later, he put one ask back: "why don't we just, as part of the
emails, say there's a settlement email here that we ask for Google reviews just
for the time being... At least we're asking for reviews still while we're
building the portal."

So the settlements build carries ONE review ask, in the settled email, of
everybody, with no condition on it - see lib/the-review-ask.ts. The formal
approval email does not ask. Email 7 ("A small favour") is not built: a second
ask without tracking is the exact thing the rule below exists to prevent.

**The rule this project has to carry**, pinned 16 Nov 2026 in Fabio's words:

> "We want at formal and IF and ONLY IF do feedback ask again at settlement hecne
> why we are building a section within ONE to track reveiws remeber review for
> good thats a whole other porject so pin that and remeber this rule when we
> build it"

In plain terms: ask for the review at formal approval. Ask again at settlement
ONLY where they did not leave one the first time. That condition is the whole
reason reviews need tracking — without knowing who has already reviewed, the
second ask goes to people who already did it, which is worse than not asking.

**Where this project picks up:** `reviewButton()` in lib/the-review-ask.ts is the
function that becomes conditional. Today it always returns the button. When
reviews are tracked it takes the client's review state, the formal approval email
gains the first ask, and the settled email asks only where the first one went
unanswered. Nothing else in settlements has to change.

**What already exists and should be left alone until then:**
- `review_sent` on the Settled checklist (lib/the-step-checklists.ts) — a tickbox,
  not a process. The reviews project replaces it.
- `toCloseOut` on the board's Settled sub-tab (lib/board-subtabs.ts) counts it
  alongside compliance and commission.
- `reviewDaysAfter` in SETTLEMENT_DEFAULTS (lib/settlement-settings.ts) — the
  stored number stays so this project can use it. It is not shown on the
  settlements settings pane, because nothing in settlements reads it.

---

# THE PORTAL ON A PHONE

Fabio, 18 Nov 2026, with a brief from the Valora portal in hand, asked for the
whole thing: shell, gutters, every table, the board, the deal page. Then: "want
everything, add for later." So it is written down rather than started.

**The brief is in docs/mobile-from-valora.md.** It is another portal's build,
not ours, and it is sound: one HTML page with Tailwind breakpoints deciding what
shows, no second mobile site, no user-agent sniffing, desktop pixel-identical.

## Four things that stop it being copied across as written

**1. OUR SHELL IS FIXED HEIGHT AND THEIRS SCROLLS.** app/(app)/layout.tsx is
`flex h-screen overflow-hidden` with the scrolling in `<main>`. Their Shell
assumes the page itself scrolls (`min-h-screen`). Lift their version in as-is
and a phone gets a page it cannot scroll at all. The sticky top bar has to live
inside our scroll container, or the scroll container has to move.

**2. WE ALREADY USE THE OPPOSITE BREAKPOINTS.** About fifty `max-[900px]:`
rules across the portal - shrink-down from desktop. The brief is `sm:`/`lg:` -
build-up from phone. Both work. Both in one file is how a layout stops being
reasonable about. Pick one before a line is written, and the cheaper answer is
almost certainly to keep ours, because ours is what fifty rules already say.

**3. OUR GUTTERS ARE px-6, NOT mx-8.** 27 of them. Same sweep, different
find-and-replace.

**4. FOUR FIXED-POSITION THINGS THEY DO NOT HAVE.** Paco, TopProgress,
StillHere and TheDoorClosed are all mounted on the layout and pinned to the
window. Each one needs looking at on a 390px screen or it sits on the content.
Paco especially - he opens over the page.

## The size of it

- **31 files with a `<table>`.** Each becomes a table above the breakpoint and
  stacked record cards below it, with no field dropped.
- **The board.** Fifteen columns in six groups becomes stage tabs, one at a
  time. The fold work from 19 Nov already proved people want fewer columns at
  once, so this is the same idea taken further.
- **The deal page.** Two columns, and the heavier of the two jobs.
- **The Today page.** Three stacked boxes plus the right-hand column.

Days, across several ships, not an afternoon.

## Where to start when it starts

The Today page alone, for Fabio on a phone. It is the screen he opens first,
it is mostly reading, and it is one ship. Everything learned there - the shell,
the gutters, one record card - is what the other screens need anyway.

**And mock it first.** Same rule as everything else: the mock goes in
docs/approved-looks/, rendered with the stylesheet the build produced, agreed
before a line is written. A phone layout is the easiest thing in the world to
build twice.
