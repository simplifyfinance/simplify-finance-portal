# Outstanding — Simplify Finance Portal

Last updated: 23 Nov 2026

This is the running list. Fabio: say "check the outstanding list" in any future
session and it gets read first, before anything else.

---

## Still to build

### 1. Press the nine buttons, not just find them
`tests/browser/compliance-boxes.spec.ts` (16 Sep) now walks both stages, opens
all nine regulated boxes and checks each is still a box a person can write in,
and still has a "Write from the deal" button rather than falling back to the
model. 4 seconds.

What it deliberately does NOT do is press those buttons. That composes the
regulated wording from the live record, and it wants its own test with its own
assertions - one test that fails for nine unrelated reasons helps nobody. That
is the next piece of work on compliance.

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

### The reading room sweep is written down but never runs

23 Nov 2026. Found while listing the live extensions for the Sydney move.

`docs/the-reading-room.sql` creates `sweep_the_reading_room()` and the comment
above it says it is the third of three things that keep the bucket empty. It
also says "call it from the same place sweep_expired_auth() is called."

**There is no such place.** `sweep_expired_auth()` does not exist anywhere in
this repo - Claude wrote that line as if it did. `pg_cron` is not installed on
live (checked 23 Nov: only pg_stat_statements, pgcrypto, plpgsql,
supabase_vault and uuid-ossp). There is no `vercel.json`, so no Vercel cron
either. Nothing in this system runs anything on a schedule.

**What still works.** The reader deletes what it read, in a `finally`, and
`lib/the-reading-room-is-emptied.test.ts` refuses a reader that uploads without
a delete beside it. That is the path every normal read takes.

**What does not.** A request that dies between the upload and the read - a
browser closed mid-upload, a function that times out, a deploy mid-request -
leaves its PDF in the bucket for good. Nobody can read it: the bucket is
private and has no select policy on purpose. But it is not removed, and the
file says it is.

**AND IT COULD NOT WORK ANYWAY.** Confirmed on live, 23 Nov. Supabase has a
`BEFORE DELETE` statement trigger `protect_objects_delete` on `storage.objects`
running `storage.protect_delete()`, which raises:

    Direct deletion from storage tables is not allowed. Use the Storage API
    instead.

unless `storage.allow_delete_query` is set to true. `sweep_the_reading_room()`
does `delete from storage.objects`. So it is not merely unscheduled - scheduling
it would only produce an error every hour.

The protection is right. Deleting the row never deleted the file; it orphaned
it. The reader was always correct: `admin.storage.from('reading-room').remove()`
is the Storage API and does remove the file.

**So the fix is not a cron on this function.** Drop
`sweep_the_reading_room()` and replace it with a scheduled route that lists the
reading-room bucket and removes anything over an hour old through the Storage
API. That needs a `vercel.json` cron, which this project does not have yet.

**Fix it as part of the Sydney move**, not before - that is the next time the
database is touched, and this is a scheduler, not a code change. Either enable
`pg_cron` and schedule the sweep hourly, or correct the comment in
`the-reading-room.sql` so it stops promising something that is not happening.
Do not leave both.

### Sixty rules say "anyone signed in" where they mean "any staff member"

23 Nov 2026. The biggest open security item. Full write-up in
`docs/the-security-audit.md`.

About sixty policies in the database have `using (true)` for the
`authenticated` role. That checks you hold a login. It does not check you are on
the team. Harmless while every login was a staff member; not harmless the moment
one exists without a staff record, which is what happened in October.

What such a login could reach: the client book (portfolio reviews, contacts,
properties), commissions, lenders and lender policy, the Paco knowledge, daily
plans and the team list. Deals were safe - they are locked by broker.

**The fix** is one named check - "is this caller an active staff member" - used
by every rule and every API route, replacing `true`. It is a large, careful job:
each rule needs changing and testing, and getting one wrong locks the team out
of something.

`docs/weekly-audit.sql` check 10 counts them. The number should fall every week
and never rise.

### Fourteen AI routes have no sign-in check

23 Nov 2026. Found by `scripts/weekly-audit.sh` on its first run, then read one
by one.

`read-loan-contract`, `read-tax-document`, `read-settlement-document`,
`extract-fact-find`, `extract-lender`, `extract-policy`, `generate-email`,
`generate-lo-email`, `generate-lo-recommendation`, `generate-compliance`,
`expand-drop`, `document-text`, `book-import`, `abn-lookup`.

**No client data is exposed by any of them.** Each one works only on what the
caller posts to it, and none reads a deal out of the database. Checked line by
line, not assumed. `read-link` already refuses addresses on our own network, so
it cannot be pointed at anything internal.

**The cost is money, not data.** Every one of these calls a paid model. Anyone
on the internet who finds the address can run them, and the bill is Fabio's.

**The fix** is one shared check used by all fourteen - signed in, and an active
staff member. One line each, no change to what they do.

**Not faults, checked and cleared:** `statement-analysis` checks who is signing
in and reads the deal through the caller's own access, so the database rules
apply. `2fa/send` and `2fa/verify` run before sign-in is complete and check the
user id, which is the most they can do. `version` returns a build number.

**One real one:** `template-archive` uses the master key and only checks you are
signed in. A login with no staff record could change which templates are
archived for everybody. Small damage, same fault as the big job above.

### The portal runs on Vercel's Hobby plan

23 Nov 2026. Found while checking who can reach the data from outside the
portal.

Hobby is Vercel's **personal, non-commercial** tier. This is a financial
services portal used by 18 staff, holding client financial positions and
identification.

**What it costs in practice:** no team access controls, no audit log, no SSO,
and a single personal account as the only thing standing between an attacker and
the environment variables - which include the database service role key.

**And the terms.** Vercel reserve Hobby for non-commercial use. An IT reviewer
will ask about it, and the honest answer today is that the plan does not match
the use.

Not urgent and not a migration blocker. But it is the one remaining place where
a single personal account holds everything, and it should be a deliberate
decision rather than an accident of how the project started.

`docs/who-has-the-keys.md` now checks the plan name every month as well as the
member list.

### Two steps across two systems, with no way to roll back

23 Nov 2026. Raised in external review after the archive/delete fault, and it
is the class rather than the instance.

The fault that let a departed staff member keep a working login was a two-step
operation across two systems: delete the row in Postgres, then delete the login
in the auth service. Postgres cannot roll back a call to the auth service, so a
failure between the steps leaves exactly what was found - a login with no staff
record, invisible on every screen and perfectly able to sign in.

**The same shape exists everywhere this portal writes to both Postgres and
Storage**, and it fails silently in both directions:

**Forward.** A document uploads to Storage, then a row is inserted into
`deal_documents`. If the insert fails, the file exists and the portal does not
know about it. A client's document, filed, invisible, counted by nothing. No
error anywhere - it looks identical to a document never uploaded.

**Reverse.** A row is deleted from `deal_documents` and the object is not, or
the object goes and the row stays. The portal then offers a document that
storage cannot serve, and a client gets a broken link.

**And we already have one documented without having connected it:**
`sweep_the_reading_room()` cannot delete storage rows from SQL - see above - so
the reverse orphan is possible there by design.

**The likely fix**, pending the reviewer's answer on whether anything lighter is
proportionate: a periodic reconciliation between `storage.objects` and
`deal_documents`, run weekly alongside the audit, reporting objects with no row
and rows with no object. Not an outbox and a reconciler, which is more machinery
than a system this size should carry.

**Audit every two-step write and delete across that boundary** before deciding.

---

### The portal asks "who is this user" about eight times a second

23 Nov 2026. Measured from the auth log: **961 calls in two minutes.**

`middleware.ts` runs on every request and calls `auth.getUser()`, which is a
network round trip rather than a local check. **97 further places** in the
codebase ask the same question independently. A single page load is ten or more
sequential round trips.

Until 23 Nov each of those crossed the Pacific twice - Sydney to Virginia to
Singapore and back - because there was no `vercel.json`. **That is why the
portal is slow to load.**

**Two of the three fixes are done or in progress:**

1. `vercel.json` pins the server code to Sydney. Removes the American leg.
2. The middleware no longer asks before waving through the four client-facing
   pages, which never used the answer.
3. **Still open:** the 97 places each asking separately. The right fix is to ask
   once per request and pass the answer down. Deliberately left until the first
   two can be measured against it - once a round trip is 10ms rather than
   300ms, the saving may not be worth touching the code that decides who sees
   what, a day after hardening it.

---

### Anthropic: the terms, and sending less than a whole document

23 Nov 2026. Raised in external review, and it is a gap the Sydney migration
does not close.

**Nine API routes send document content to the Anthropic API** - loan
contracts, settlement documents, tax returns, payslips, fact finds, and
drafting client correspondence. Confirmed as the commercial API with a server
-held key, not a consumer or team subscription, which is the better of the two
outcomes raised.

**To establish this week:** whether the training prohibition is contractual
rather than policy, whether a data processing agreement is signed rather than
merely available, and what the retention period is.

**The mitigation stands regardless of those answers.** When the portal needs two
figures off a payslip, the provider does not need the client's name, address and
tax file number in the same payload. Stripping identifying pages before
transmission turns a difficult characterisation question into a straightforward
one, and it is days of work rather than a project.

**And the consequence has to be said out loud:** moving the database to Sydney
while every document continues to transit to a United States provider does not
deliver the residency outcome a board would assume. The honest framing is
**storage in Australia, processing under contract**.

---

### The deletion block does not hold during a restore

23 Nov 2026. The `nobody_is_deleted` trigger on `user_profiles` stops any delete
at runtime. Two things it cannot stop, both raised in external review:

**`TRUNCATE` does not fire row triggers.** Closed on 23 Nov:
`revoke truncate on public.user_profiles from public, anon, authenticated;`

**`session_replication_role = replica` disables triggers by design, and
Supabase's own restore procedure sets it.** So the trigger protects normal use
and does **not** protect the migration window. Not fixable, and written down
here so nobody relies on it during exactly the window where it is not true.

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
