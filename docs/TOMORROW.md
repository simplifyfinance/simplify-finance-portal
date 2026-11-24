# Tomorrow morning — start here

Written Monday evening, 23 November 2026, for Tuesday morning.
Nothing in this file depends on Claude remembering anything. Work down it.

---

## WHERE YOU ARE RIGHT NOW

**Done today and already live:**

- Four unauthenticated ways into the database found and closed.
- Platform defaults closed (functions, anon grants).
- The weekly audit built: `docs/weekly-audit.sql` (17 checks) and
  `scripts/weekly-audit.sh`. Runs every Monday.
- Portfolio Review was reading 11% of its data. Fixed and shipped.
- `vercel.json` pins the portal to Sydney (`syd1`).
- Vercel upgraded to Pro — the data processing agreement now covers you
  automatically. **This one is finished. Nothing further to do.**

**Done today, sitting uncommitted, needs one ship:**

- `app/(app)/deals/page.tsx` — the delete function now checks whether the
  documents actually left storage, and refuses to delete the deal if they
  did not. This is what silently orphaned two client fact finds in October.
- `lib/no-document-is-left-behind.test.ts` — new, stops that check being
  removed again. 4 tests.
- `docs/weekly-audit.sql`, `docs/OUTSTANDING.md`, `docs/sixth-reply.md`.

`npx vitest run` passed tonight: **506 files, 9,545 tests**.

**Not started:** staging catch-up, and the move to Sydney.

---

## STEP 1 — SHIP WHAT IS WAITING (first thing, ~8 minutes)

**TERMINAL**

```
caffeinate -i ./scripts/ship.sh "deleting a deal can no longer lose a document"
```

Do not touch any file while it runs. If the browser check says the robot is
signed out, run `./scripts/portal-login.sh` and ship again.

---

## STEP 2 — THE ROOT CAUSE. THIS IS THE BIG ONE.

Nobody had answered why ~900 robot deals were in production in the first
place. Tonight we found how it is possible.

`scripts/check-browser.sh` line 35 loads `.env.local`, then starts the portal
on port 3100 and runs 43 browser tests against it. Those tests sign in and
type into real screens. **They write to whatever database `.env.local` names.**

`.env.local` currently names the Supabase project whose reference starts
**`brjy`**.

**What to do:** open Supabase, look at the project reference in the address
bar of your PRODUCTION project.

- If it starts `brjy` — that is the cause. Every ship for months has been
  creating test deals in your live database. October was simply the first
  time somebody counted and cleaned up.
- If it does not start `brjy` — the robots are already pointed elsewhere and
  we look again.

**Tell Claude which it is.** Everything below depends on the answer.

If it is production, the fix is one line and it needs the Sydney staging
project to exist first — which is Step 4 anyway. The robots get pointed at
staging and stop touching the live book forever.

---

## STEP 3 — TWO QUERIES THAT MIGHT BE A FIFTH OPEN DOOR

The outside reviewer made one mechanical point we have not checked, and he
is right that it is easy to miss.

A rule written `using (true)` with no `TO` clause applies to **PUBLIC**, not
to logged-in staff. PUBLIC includes `anon` — the internet. The rule text
looks identical either way. So the twelve open tables may be open to staff
as intended, or open to anyone, and only the `roles` column tells you which.

This is not about the commission access model, which is settled and correct.
It is only about whether those same rules also apply to people who are not
logged in at all.

**SQL LIVE** — run both, paste both back.

```sql
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename, policyname;
```

```sql
select c.relname,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_can_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_can_update,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_can_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    select tablename from pg_policies
    where schemaname = 'public' and qual = 'true')
order by c.relname;
```

`{authenticated}` everywhere with no anon grant = all fine, nothing to do.
Any `{public}` with an anon SELECT = a fifth open door, fixed that morning.

**Portfolio Review first.** It is the only one of the open tables with a
client on the other end. If a client can reach those tables directly, every
client can see every other client's portfolio.

---

## STEP 4 — STAGING. THIS IS THE PATH TO SYDNEY.

The full plan is `docs/moving-the-database-to-sydney.md`. It has four phases.
Phases 1 to 3 are the rehearsal. Phase 4 is the real thing, on a weekend.

**How far away you are: the rehearsal is one day's work, not a week.**

| Phase | What it is | Roughly |
|---|---|---|
| 1 | Move the staging project from Seoul to Sydney | half a day, mostly waiting |
| 2 | Bring Sydney staging up to date (`docs/staging-catchup.sql`) | 1–2 hours |
| 3 | Point the robots at it and let all 43 tests run | 1 hour |
| 4 | Production, on a weekend | the weekend after Phase 3 passes |

Phase 1 is the one to start tomorrow. Open
`docs/moving-the-database-to-sydney.md` at the line "PHASE 1" and work down.
Claude walks you through it; the document is the script either way.

**The rehearsal is the gate.** If Phases 1–3 come through clean, production
goes on the following weekend. If they do not, the errors from Phase 1 become
the checklist for the real day, which is the entire point of rehearsing.

Phase 2 and Step 2 above join up: once Sydney staging exists and is current,
`.env.local` points the robots at it, and the test suite stops writing to
your live book.

---

## STEP 5 — THINGS THAT NEED A PERSON, NOT A COMPUTER

These do not block anything. Do them when you have a spare ten minutes.

1. **Ask the four people about October.** The deletions were done by someone
   entitled to do them — senior staff, the assigned broker, or the credit
   officer. That is a handful of names, not eighteen. "Did you delete deals
   in October, and roughly how many?" turns an open question into a closed
   one. There is no log, so asking is the only route.

2. **Seven tables still open, one question each.** The three portfolio review
   tables, the three lender reference tables, and the staff directory. Claude
   will put all seven to you in one go — not one at a time.


---

## STEP 6 — REPLY TO THE REVIEWER. LAST, NOT FIRST.

Do not reply before Steps 2 and 3. The reply is only worth sending once it
carries answers rather than intentions, and those two steps are the answers
he asked for.

He already has our last note — his latest reply is a response to it. Nothing
is outstanding tonight.

What the next reply needs:

1. **The roles column result** from Step 3. Either all twelve open rules are
   staff-only, which closes his one remaining mechanical point completely, or
   one of them is not, and that is a finding.
2. **Whether `brjy` is production**, from Step 2. He predicted the test suite
   was the cause before we found the mechanism. Confirming it closes the
   root-cause question that has been open through the whole exchange.
3. **The rehearsal numbers**, if Phase 3 has run by then. He asked for two:
   how long the storage copy took, and whether the canary comparison matched.
   If it has not run, say so and send them after.

Claude drafts it once those are in hand. It will be short — three answers and
the rehearsal result.

---

## WHAT IS ON THE LIST AFTER THAT

Not tomorrow. Written down so it is not lost.

- **Soft delete on deals.** A `deleted_at` column instead of destroying the
  row, the history no longer cascading away with it, and an append-only log
  of who deleted what and why. You can always delete later; you can never
  undelete. This is the records-keeping fix and it is the one that outlives
  the migration.
- Confirm the credit record-keeping retention period with your lawyer, and
  whether being able to hard-delete a deal at all is compatible with it.
- A daily alert on 4xx storage requests — free burglar alarm on the door we
  closed.
- The orphan check becomes an allowlist by filename, so it reads zero.
- The entitlement rewrite across the remaining rules.
- Two functions still missing `search_path`.
- `lender-documents` bucket policies; no size or file-type limits on uploads.
- Whether the offshore team have individual logins or a shared one.

---

## IF YOU ONLY DO THREE THINGS

1. Ship what is waiting (Step 1).
2. Check whether `brjy` is production (Step 2). It is the root cause.
3. Start Phase 1 of the Sydney move (Step 4).
