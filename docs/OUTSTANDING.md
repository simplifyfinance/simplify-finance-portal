# Outstanding — Simplify Finance Portal

Last updated: 16 Sep 2026 (end of day)

This is the running list. Fabio: say "check the outstanding list" in any future
session and it gets read first, before anything else.

---

## Still to build

### 1. Compliance's nine collapsed sections have never been robot-tested
All 42 browser tests run against open, visible fields. Those nine sections are
the ones that produce the regulated wording, and nothing automated has ever
opened them. If something breaks in there, a person finds it, not a test.

### 2. The ship takes 7 minutes, and 6.5 of it is the browser stage
Measured 16 Sep: code checks 1s, 1,895 unit tests 4s, build 9s, browser 6m 27s.

**The easy answer is wrong.** 155s of the browser stage is fixed `waitForTimeout`
sleeps, and it is tempting to replace them with waiting for a condition. Most of
them cannot be: those specs prove things DO NOT happen - text not clobbered by
the other window, a tick box not flipping back, the form not moving under
somebody's hands. Letting time pass IS the test. One attempt at replacing them
was made and reverted: waiting for the save line to read "Saved" could be
satisfied by a stale "Saved" from an earlier write, so the test would pass
without the save landing.

**The real answer is parallelism**, and the blocker is that ten of the fourteen
specs drive the SAME deal (`PORTAL_TEST_DEAL_ID`), several of them specifically
about two people in it at once. Running those side by side would corrupt each
other and the gate would start failing at random.

So: give each heavy spec its own deal, then raise `workers` in
playwright.config.ts. Roughly 2 minutes instead of 7. A fresh-day job with proof
at every step - this is the gate that caught a broken Lending Options tab on
16 Sep, and a fast gate nobody trusts is worth nothing.

### 3. Staging - parked
The honest position: staging was never a copy of production. **16 tables exist
live with no file anywhere that creates them.** Bringing it up needs
production's real schema pulled out properly (pg_dump via libpq, already
installed on the Mac). A sit-down job. Nothing day to day depends on it.

Project refs: production `brjytbuirbupatjtauhx` (Singapore), staging
`jfgsyotmvwxeaohwdejv` (Seoul).

### 4. Two files Claude cannot delete
- `_to_delete/StatementNotes.tsx`
- `_to_delete/proceed-flow.test.ts`

No delete permission on the Mac. Fabio needs to remove these.

### 5. One skipped browser test
`new-deal-busy.spec.ts` has a hard-refresh case still turned off from the week
of 8 Sep.

## Tidy-ups Fabio wants

(Fabio mentioned a few on 16 Sep, not yet described. Fill these in.)

- [ ]
- [ ]
- [ ]

---

## Clearing the robot deal cards

Run in **Supabase -> SQL Editor**, production project `brjytbuirbupatjtauhx`.
The robot fix (b0fc178) is live, so the pile will not come straight back.

Step 1 - see what would go. Nothing is deleted.

    select id, deal_name, stage, created_at, compliance_sent_at, settled_at
    from deals
    where deal_name ilike '%ZZROBOT%'
       or fact_find_data::text ilike '%ZZROBOT%'
    order by created_at desc;

Step 2 - check nothing gets orphaned. Every row should say CASCADE.

    select tc.table_name, rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'deals'
    order by rc.delete_rule, tc.table_name;

Step 3 - delete them.

    delete from deals
    where deal_name ilike '%ZZROBOT%'
       or fact_find_data::text ilike '%ZZROBOT%';

Step 4 - the leftover robot clients.

    select id, first_name, last_name, email from clients where first_name ilike 'ZZROBOT%';
    delete from clients where first_name ilike 'ZZROBOT%';

---

## Shipped 16 Sep 2026

Tests went 1,730 -> 1,895 across the day.

| Commit | What |
|---|---|
| `5363c06` | Save line tells the truth - Saving / Saved HH:MM / Still saving / NOT SAVED, instead of sitting on a stale "Autosaved" |
| `1af9c4a` | Recommendation points at the chosen **product**, not just the bank. Sixteen places matched on lender name, so two Bankwest options were both starred and compliance could quote the wrong one |
| `5a70cdd` | LMI records whether it is capitalised onto the loan or paid at settlement, and every figure says which |
| `49b1310` | Typed repayments always win over calculated. One card per split. Optional existing balance per split |
| `2eb0131` | Every scenario prints every split - no template can silently drop one |
| `dd51a4b` | Changing scenario asks before it replaces your splits |
| `b0fc178` | Robot reuses its deal instead of breeding new ones |
| `08111c6` | Ship timings per stage, and this file |
| `ce70e26` | One purchase breakdown on every scenario - price, duty, total cost, loan, contribution |
| `e2be78c` | A copy of unsaved work that survives the tab dying, on all four deal tabs |
| `b4bdef6` | Notes box stops floating over the documents, keeps a draft, and one handover copy per deal |
| `ae2159d` | Fix the LO tab - `b4bdef6` declared the draft above the thing it reads and took the tab out |

### The one that got away
`b4bdef6` broke the Lending Options tab and **shipped anyway**, because the
browser gate reported and did not block. It was live until `ae2159d`. The gate
now blocks - see scripts/check-browser.sh.

### Letters disappearing - all five faults now closed
1. Keystrokes swallowed by re-render -> the autosave waits for a pause
2. Somebody else's save landing on a box being typed in -> field ownership
3. Nothing written on leaving the page -> keepalive, and a write on leaving a box
4. The screen claiming "Autosaved" when it had not -> an honest save line
5. The save failing and the tab dying with the only copy -> the draft store

Covered on Fact Find, BC, Lending Options, Compliance and the Internal notes box.
Boxes with their own Save button do not have a draft and do not need one: the
text stays on screen until the person presses Save and sees it fail.

## Standing rules

- Nothing from this project leaves the private repo or the conversation.
- Never ask Fabio to paste database passwords, connection strings or service
  keys into chat - he runs those in his own Terminal or in the Supabase
  dashboard.
- Every command is labelled **TERMINAL**, **SQL LIVE** or **SQL STAGING**.
- Deploys only ever via `./scripts/ship.sh "message"`, run by Fabio.
- Claude never runs git on his machine.
- Claude never edits files while `ship.sh` is running - the commit sweeps up
  whatever is in the folder, tested or not. Editing `ship.sh` itself mid-run is
  worse: bash reads a script as it executes.
- Show a mockup before any visual change.
- Never invent a figure. Never quote a DTI, a maximum borrowing capacity, or
  living expenses. Never say something is cheaper when it is not.
