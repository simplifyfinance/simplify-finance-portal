# Outstanding — Simplify Finance Portal

Last updated: 16 Sep 2026

This is the running list. Fabio: say "check the outstanding list" in any future
session and it gets read first, before anything else.

---

## Still to build

### 1. Offline drafts  <- next up
The keepalive covers a refresh and closing the tab. It does **not** cover the
laptop losing wifi mid-sentence. The save fails, the indicator goes amber and
says "keep this tab open" - but if they close it anyway, the text is gone.

A local draft store would survive that. **This is the last real hole in the
"letters disappearing" family** that has been costing Kylie work since late
August.

### 2. Compliance's nine collapsed sections have never been robot-tested
All 42 browser tests run against open, visible fields. Those nine sections are
the ones that produce the regulated wording, and nothing automated has ever
opened them. If something breaks in there, a person finds it, not a test.

### 3. Staging - parked
The honest position: staging was never a copy of production. **16 tables exist
live with no file anywhere that creates them.** Bringing it up needs
production's real schema pulled out properly (pg_dump via libpq, already
installed on the Mac). A sit-down job, not a ten-minute one. Nothing day to day
depends on it.

Project refs: production `brjytbuirbupatjtauhx` (Singapore), staging
`jfgsyotmvwxeaohwdejv` (Seoul).

### 4. Two files Claude cannot delete
- `_to_delete/StatementNotes.tsx`
- `_to_delete/proceed-flow.test.ts`

No delete permission on the Mac. Fabio needs to remove these.

### 5. One skipped browser test
`new-deal-busy.spec.ts` has a hard-refresh case still turned off from the week
of 8 Sep.

---

## Tidy-ups Fabio wants

(Fabio mentioned a few on 16 Sep, not yet described. Fill these in.)

- [ ]
- [ ]
- [ ]

---

## For the team, not for Claude

- **Arvind Mane** - decide whether **$3,445 (P&I)** or **Interest only** is
  right. The BC now flags the mismatch but will not choose. The email sends
  whatever is typed.
- **William Welton** - pick which Bankwest product is recommended (the dropdown
  now records the product, not just the bank), and answer the new
  **"How is the LMI paid?"** question.

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

Tests went 1,730 -> 1,839 across the day.

| Commit | What |
|---|---|
| `5363c06` | Save line tells the truth - Saving / Saved HH:MM / Still saving / NOT SAVED, instead of sitting on a stale "Autosaved" |
| `1af9c4a` | Recommendation points at the chosen **product**, not just the bank. Sixteen places matched on lender name, so two Bankwest options were both starred and compliance could quote the wrong one |
| `5a70cdd` | LMI records whether it is capitalised onto the loan or paid at settlement, and every figure says which |
| `49b1310` | Typed repayments always win over calculated. One card per split. Optional existing balance per split |
| `2eb0131` | Every scenario prints every split - no template can silently drop one |
| `dd51a4b` | Changing scenario asks before it replaces your splits |
| `b0fc178` | Robot reuses its deal instead of breeding new ones |

---

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
