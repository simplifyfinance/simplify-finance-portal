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

**FOUND IN PRODUCTION, 23 Nov 2026.** Two client fact finds were sitting in the
`deal-documents` bucket with no row pointing at them, from deals deleted in
October.

> **CHECK 17 READS 1, DELIBERATELY, AND NOT 0.**
>
> One of the two was deleted on 23 Nov. The other was kept on Fabio's
> instruction:
>
>     deal-documents / 0cca5f69-0e9c-46bd-9758-e4aed5b7c9e7
>         1791953429519_Cockburn - Fact Find.pdf
>         315 kB, uploaded 14 October 2026
>
> Its deal no longer exists, so nothing in the portal can reach it and nothing
> will unless somebody goes looking in the bucket.
>
> **So check 17 is expected to read 1 until that file is either filed against a
> deal or removed.** If it ever reads 2 or more, that is a NEW orphan and the
> ordering fault has happened again. Do not raise the expected number to 1 -
> that would hide the next one.
>
> It also travels to Sydney with the other 584 objects unless it is dealt with
> first. Deleting a deal removes its `deal_documents` rows by cascade and leaves
the files in storage untouched. They were also the only surviving trace of those
two deals. Removed on Fabio's instruction the same day.

**The fix is the ORDER, not reconciliation.** The reviewer's answer, and it is
better than what we proposed:

> Upload-then-insert fails invisibly - the object exists, no row references it,
> nothing can see it. Insert-then-upload fails visibly: write the row with
> `status = 'pending'`, upload, then mark it `complete`. If the upload fails you
> have a row that says pending, and a pending row can be listed, counted,
> alerted on and retried. Same failure rate, completely different
> observability. An ordering change plus one column, not a project.

The same in reverse on delete: mark the row `deleting`, remove the object, then
remove the row. A failure leaves a visible tombstone rather than a broken link
in front of a client.

**Check 17 of `docs/weekly-audit.sql` is the backstop**, not the fix. It catches
it in a week. The ordering change stops it happening.

**Audit every two-step write and delete across that boundary** when building it.

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

---

## THE LENDING OPTIONS BUTTONS STAY, EVEN AFTER THE CLIENT AGREES — approved 25 Nov 2026

Fabio, after twenty minutes looking for a button that was hidden:

> "I don't like dragging deal cards. We always talk about not dragging deal
> cards... I want to make sure in future, even when we send to the client, it
> doesn't suppress. So we can always change it and send it again."

**Today:** the moment `lo_client_proceeded` is true, `canSendAgain` returns
false and `canSendBack` refuses with "The client has already agreed to this
one". Both buttons vanish with nothing on screen saying why, and the only way
back is dragging the card from Compliance to Lending options on the deal board.
Nothing on the tab says so. It cost an hour and a hand-written SQL update on a
live deal.

**Approved:** both buttons stay. The green tick is a fact, not a lock - which is
already the stated rule for Send again and was never applied to this case.

### The condition, and it is the whole risk

> "as long as when we go to compliance, it doesn't hard code the previous
> choice, then no issues"

It does not, and that is not luck - it is the Charles Mullins fix of 25 Sep
2026, where compliance kept saying AMP after the lending options moved to
Bankwest. `lib/client-agreement.ts` holds the rule: **lo_data is the answer,
compliance_data holds a copy, and the copy is rebuilt from the answer every
time.** Compliance has no box that can set those fields.

**BUT THE UNDO MUST CLEAR BOTH HALVES OF THE ANSWER, NOT JUST ONE.** The
client's own press and the broker's recorded decision are different records in
different places, and compliance rebuilds from the second one:

| Where | Field | What it is |
|---|---|---|
| `deals` | `lo_client_proceeded` | the client pressed Proceed |
| `deals` | `lo_proceeded_at` | when |
| `deals` | `lo_proceeded_lender` | which bank they confirmed themselves |
| `lo_data` | `clientAgreedLender` | **the broker's recorded Yes/No - THIS is what the compliance pack reads** |
| `lo_data` | `clientChosenLender` / `clientChosenLenderOther` | the bank they chose instead |
| `lo_data` | `clientChosenLenderReason` | why |
| `lo_data` | `clientDecisionAt` / `clientDecisionBy` | who recorded it and when |

Clear only the first three and compliance will faithfully rebuild from a stale
`clientAgreedLender` - naming a lender the client is no longer taking, on a
regulated document. That is the Charles Mullins fault coming back through a
different door.

### What to build

1. `canSendAgain` and `canSendBack` stop refusing on `lo_client_proceeded`.
2. When the client HAS agreed, both buttons first show the confirmation in the
   approved mockup: it names the bank and the date, says the agreement comes
   off, and says the deal moves back from Compliance to Lending options.
3. On confirm, clear **every field in the table above**, write a file note
   saying who undid it and when, and leave the original date visible as undone
   rather than deleted.
4. A test that fails the build if the undo clears the `deals` half and not the
   `lo_data` half. That is the only way this stays fixed.

### BUILT 25 NOV 2026 — all four, same day

| | Where |
|---|---|
| 1. Both buttons stop refusing | `lib/send-it-back.ts` — `canSendBack`, `canSendAgain` |
| 2. The confirmation that names the bank and the date | `components/UndoTheAgreement.tsx` |
| 3. Clears both halves, writes the file note | `app/api/undo-the-agreement/route.ts` |
| 4. The test that fails the build if either list shrinks | `lib/the-agreement-comes-off-both.test.ts` |

Wired into **both** tabs, not just the lending options: `LOForm.tsx` and
`BCForm.tsx`. The BC had the same hidden-button fault and nobody had hit it yet.

**AND THE CARD MOVING IS NOT A SEPARATE JOB.** The board is worked out, never
stored — `lib/the-board-columns.ts`. Compliance is reached by
`lo_client_proceeded` alone, so clearing it walks the card back to Lending
options by itself. The dialog says so, and says the opposite when
`compliance_sent_at` is set: the pack has gone out, the card stays put, only the
agreement comes off. A broker who expects the card to move and watches it sit
still goes hunting for a button that does not exist — which is this morning,
again.

### THE FINDING: NO NEW COLUMNS, ON PURPOSE

The first build wrote `lo_agreement_undone_at` and `_by` onto `deals`. That
would have failed the ship — `scripts/check-deal-columns.sh` refuses any column
the database does not have — and fixing it meant SQL on **live, staging AND
Sydney**, in the same fortnight the database is being moved between countries.

To hold a value that two existing stores already hold perfectly well. So the
undo is recorded in `deal_notes` (a `kind: 'system'` line, which is what anyone
reviewing the file actually reads) and in a stamp inside `lo_data`. No
migration, nothing new for the Sydney move to carry.

### WHAT THE ROBOTS DO NOT COVER

No browser spec touches Send again or Send it back — checked, 25 Nov 2026.
`lo-reaches-compliance.spec.ts` and `compliance-reads-the-record.spec.ts` are
the nearest and neither presses either button. The guard on this change is the
vitest suite, not the browser gate. Worth knowing before trusting a green ship.

Mockup approved 25 Nov 2026. Built 25 Nov 2026.

---

## THREE FIELDS TYPED HUNDREDS OF TIMES AND PRINTED NOWHERE — 26 Nov 2026

Cath, working through a compliance file by hand:

> "I noticed a few fields in ONE that don't seem to carry over to the generated
> Fact Find form... Even when the Credit Managers complete these fields in ONE,
> the information doesn't appear in the generated Fact Find."

She named four. **She was right about all four**, and the database said how
badly (311 live deals, test deals excluded):

| Field | Typed on | Where it went |
|---|---|---|
| Middle name | **185 of 311** | Nowhere. No document in the portal ever printed it. |
| Citizenship (`residencyStatus`) | **208 of 311** | Assessment form only. No row on the Fact Find at all. |
| Dependants' ages | **62** | Nowhere. Both documents printed the count. |
| Comparison rate | **0** | Nothing writes it. There is no box. |

### The one that was worse than missing

The Personal Assessment Form had a row **labelled "Ages of dependants" that
printed the count**. Three dependants read as though they were all aged three,
on a form a client signs. Not a blank — a wrong answer.

### What was built

- `legalName()` in `lib/fact-find.ts` — first, middle, last. Used in the name
  box on both forms.
- **`fullName()` was deliberately left alone.** It feeds about twenty callers
  and most of them are prose: the compliance narrative, the document chase
  list, handover headings, the broker notes. A middle name in a sentence reads
  as a legal document that wandered in. Two functions, not one widened one.
- `dependantsLine()` — the count and the ages, used by **both** documents so
  they cannot drift apart again. The count stays beside the ages: three
  dependants with two ages typed is a question for a person, not something a
  document tidies away.
- A **Citizenship** row on the Fact Find.
- `lib/what-cath-found-missing.test.ts` pins all of it.

Nothing needs re-typing. The data was always on the deal; the 185 and the 62
get it back the moment somebody regenerates the document.

### The comparison rate came OFF a document instead

Zero of 311, because nothing in the portal writes that field and there is no box
anywhere to type one into. So the Broker Notes PDF had been printing
**"Comparison rate: Not recorded"** on every deal since it was built.

Fabio: *"We don't have comparison rate... We never send comparison rate to
anyone."* So the line came off, rather than a box being built to feed it. A row
that is always empty is worse than no row — it teaches whoever reads the sheet
that this part of it can be skipped.

### THE LESSON, WHICH IS THE POINT OF WRITING THIS DOWN

**No test could have caught any of these, and none did.** Every one was found by
a person reading a finished document and asking why a box she had filled in was
not on it. Four fields, months in the dark, on regulated paperwork.

Nothing in the ship pipeline compares *what the tabs capture* against *what the
documents print*. That gap is still open after this fix — these four are closed,
the next four are not. Worth a guard script one day.

---

## ONE EMAIL, THREE FAULTS — THE LOCK ON A LODGED DEAL, 26 Nov 2026

Catherine, on **Simone Howland — OO Refinance — Wyoming — MACQ**, a deal changed
right after lodgement where one split had to become two ($60k variable, $430k
fixed one year):

> "I may need your help with the best way to do that as it kept locking and when
> I hit edit on the single loan split, it only let me update that $ value, not
> add an additional split/product. Credit (Mel) isn't able to edit even when I
> unlock FYI — remains locked for her. I asked her to send me the details to
> update as admin."

Three separate things, and only one of them a bug in the ordinary sense.

### 1. "It kept locking" — a bug

The unlock lived in the deal page's React state and nowhere else. Anything that
reloaded the page put the lock straight back, and plenty of actions on a deal
reload when they finish. From where she stood the button did not hold.

Now kept in `sessionStorage`, per deal, and cleared when the page unmounts —
which is what navigating away does. **A reload does not unmount anything, so the
unlock survives exactly the case it was failing.** The promise on screen still
holds: it re-locks when you leave the deal. It just also holds when you did not.
`lib/the-unlock-survives-a-reload.ts`.

### 2. "It only let me update that $ value" — a dead end, by design

Nothing was broken. **The BC owns the loan structure** and always has
(`canEditStructure` is hard `false` on the deal strip). The strip's Edit button
changes one figure — the amount — and the header beside it said "amount and rate
come from the lender options below", which is true and is about something else.

So she was standing in the one place that cannot add a split, being told nothing
about the place that can. The `+ Add split` button is hidden whenever the BC owns
the structure, and in its place there was **blank space**.

Now a link sits there: *adding or removing a split is done on the BC ↗*. Same
pattern the rows underneath already use when an answer lives on another tab. A
signpost, not a second door — the BC still owns it.

### 3. "Credit isn't able to edit even when I unlock" — the design, changed

`canUnlock` was `admin || broker`. Mel is staff, so no unlock button, ever, no
matter what Catherine did.

The reasoning was that credit should leave a file note asking a broker to make
the change, so it is made by somebody accountable. In practice it made Catherine
the typist for work Mel had already done, on a deal that needed changing that
day.

Fabio, 26 Nov 2026: *"I don't mind credit being able to unlock it. as long we
are recording everyhting on file notes history."*

**It always was.** An unlock has never opened without a typed reason, and
`TabLock` refuses to unlock at all when the file note cannot be written — *"an
untraceable edit is worse than a locked tab"*. The choice was never between a
record and no record. It was between credit changing it with their name on it,
and credit emailing it to somebody who types it with theirs. Moved to
`CAPABILITIES.unlockLodgedDeal` in `lib/permissions.ts`.

### THE PATTERN WORTH NOTICING

Two of these three were **invisible to everyone except the person doing the
work**, and neither would ever have appeared in a test. The lock dropping looked
like the button not working. The missing Add split looked like a missing
feature. Both were found because somebody wrote an email instead of giving up.

Guarded by `lib/the-lock-catherine-hit.test.ts`.

---

## THE SECOND APPLICANT NOBODY CAN READ — 26 Nov 2026

Catherine, marking several of Mark Gallo's deals as lost:

> "I got through two successfully, and then when I did those showing in the
> screenshots it came up with an error. However, the deals were showing as Lost,
> even though the window didn't close. So it worked but looked like it didn't."

The error on screen: **"NOT SAVED — Jacob Hastie's position was not saved - the
database refused the change. Nothing has been recorded."**

### Two wrong guesses before the right one

Written down because the wrong turns cost three rounds of SQL:

1. **"The matching rule must be failing for second applicants."** It was not.
   All six applicants passed it.
2. **"The client record must not exist."** It did. All six.

Neither was the cause, and the answer was already sitting in the policy dump I
had read past.

### The actual cause: two rules that disagree

| | What it matches |
|---|---|
| `clients` **UPDATE** — "Client editing via deals" | the deal's main client **OR any applicant in `fact_find_data`** |
| `clients` **SELECT** — "Client visibility via deals" | the deal's main client **only** |

A second applicant is covered by one and not the other. So:

- The portal **is allowed to change** Jacob Hastie. It changes him.
- It is **not allowed to read him back**, so the `RETURNING` row comes back empty.
- `checkedWrite` sees zero rows, which is also what a refusal looks like, and
  reports **"the database refused the change. Nothing has been recorded."**

**The write succeeded. The message is false.** Same class of fault as the deal
showing Lost behind an error box: the portal reporting failure on work it did.

Confirmed in the data — every second applicant is a main client nowhere and not
a book client, so no SELECT policy reaches them at all:

| | main client somewhere | book client |
|---|---|---|
| Jacob Hastie, Pamela Jeffries, Tyrone Mawing | false | false |
| Harrison Hastie, John Jeffries, Leilah Mawing | true | false |

### THE PART THAT IS WORSE THAN THE ERROR MESSAGE

`CloseDeal.writePositions()` reads the client's current position before writing,
so that an empty fact find cannot blank a full client record —
`wouldEmptyTheClient()`, the Natasha Chapman guard.

**That read is one of the reads this policy blocks.** It comes back empty, `had`
is 0, the guard decides there is nothing to protect and returns false.

So for **every second applicant in the book**, the protection against wiping a
client's assets, liabilities and properties with an empty fact find has never
been able to fire. It is not weakened; it is absent, silently, and it reports
success either way.

### The direction of the fix — NOT just copying one policy to the other

The UPDATE policy has **no role test at all**: its whole condition is "a deal
exists that mentions this client". The SELECT policy has the full role test
(admin / sees-all / broker matching / staff matching their credit assignment).

So editing is currently WIDER than reading. That is backwards, and widening
SELECT to match UPDATE would make it worse. Both halves need to move:

1. **SELECT** gains the applicants clause, keeping its role test.
2. **UPDATE** gains the role test it never had.

Policy changes on `clients` touch every screen that reads a client. **Rehearse
on staging before live** — staging is already standing up for the Sydney move,
which is exactly what it is for.

### What it means for the deals Catherine closed

Nothing to redo. The deals are lost, and the positions were almost certainly
written. The portal just told her the opposite.

### BUILT 26 Nov 2026 — the A&L question

Fabio: *"If we're marking a deal as lost, we got to ask the question, do you
want to update the current assets and liabilities? And the preference is
normally we don't because we lost the deal, but just that needs to be a serious
question... please create a habit that you show what the A&L is and say, are you
confirming this is the current position?"*

- A question with **No already chosen**, in place of a tick box that was ticked
  for you.
- Say yes and every property, liability and asset is read out **by name** before
  anything is written. The button is dead until a line naming the clients is
  ticked. A Fact Find holding nothing for anybody cannot be confirmed at all.
- A credit card shows its **limit**, not its balance — that is what a lender
  reads, and the balance flatters the one line that most often decides a deal.
- A missing figure prints "not recorded". Never a zero.
- **The client records are written BEFORE the deal closes.** That ordering is
  the fix for what Catherine saw: a failure now stops before anything happens,
  so a red box means nothing happened.

`lib/what-goes-on-the-client-record.ts`, `lib/the-a-and-l-question.test.ts`.

### THE CONSEQUENCE THAT IS STILL OPEN

Because the records now go first, choosing **Yes** on a deal with a **second
applicant** will stop the close instead of half-doing it — the write "fails" for
exactly the reason above, even though it succeeded. Honest, and blocking.

The default is No, so the common path never touches it. **But this is the clock
on the policy fix.** Until the two `clients` rules agree, anybody answering Yes
on a two-applicant deal gets stopped.

---

## "I COULDN'T FIND THAT SECTION IN THAT PARTICULAR DEAL" — 26 Nov 2026

Belle, on **Thomas and Sally Isherwood - OO Purchase - Mona Vale - STG - 2026**:

> "loan docs have just been issued im gonna put a comment in the latest update
> but I couldnt find that section in that particular deal - why this section is
> missing from particular deal"

One line in `DealSettlementPanel.tsx` gated the **entire** settlement panel —
the seven steps, the contracts, ATTN Settlements and Latest update — on the
deal having a **lodgement date**.

That deal:

| lodged_at | preapproval | offer accepted | formal approval |
|---|---|---|---|
| **null** | 28 Sep | 23 Nov | 26 Nov |

It had plainly reached the lender. Nobody ever ticked Lodged, so the panel went
on waiting for a date that was never coming — while the settlement work it
exists for had already started.

**The question was wrong, not the answer.** "Has it been lodged?" and "has it
reached the lender?" are different questions, and only the second is what this
panel wants to know. Now `isWithLender()`, which reads the furthest milestone
the deal has reached rather than the first.

### AND THE PART THAT IS NOT COSMETIC

`lodged_at` is what the **lodgement numbers** are counted from.
`components/MonthlyActuals.tsx` and `components/BrokerTargets.tsx` read that
column and nothing else.

**A deal that reached formal approval without one has never been counted as
lodged, in any month, by anybody.** Showing the panel makes the settlement work
possible; it does not put the deal back in the figures.

Nothing else in the portal would ever have mentioned it, so the panel now says
so in plain words: *the lodgement numbers are counted off that date — until
somebody records it, this deal is missing from every lodgement figure for the
month it went in.*

### A WRONG TURN, WRITTEN DOWN

I first reported that **there was no way to record a skipped lodgement date on a
live deal**, and told Fabio so. That was wrong.

`STAGES` in `DealSettlement.tsx` marks `lodged_at` with `mark: true`, and
`available` offers every unrecorded stage on any deal that has not settled. So a
**Lodged** button has been sitting under "What happened next?" the whole time.
"Record a date we missed" is the settled-deal version of the same thing.

The warning now points at it. A message that says a number is wrong without
saying how to fix it just moves the confusion along one step.

### HOW BIG IT IS: FIVE DEALS, TWO OF THEM SETTLED

| Deal | Broker | Furthest point |
|---|---|---|
| Matti & Elizabeth Hallanoro - OO Internal Refi - St Ives | fabio | **settled 15 Sep** |
| Melody Ng Villanueva | mark | **settled 19 Oct** |
| Thomas and Sally Isherwood - OO Purchase - Mona Vale | fabio | formal approval 26 Nov |
| Richard Lake & Letitia Lake - OO Preapp | fabio | preapproval 18 Oct |
| Wesley Perrott | mark | preapproval 16 Sep |

**Two settled deals were never counted as lodged.** September and October
lodgement figures are both understated, and nothing in the portal has ever said
so. The five dates need recording by hand before any lodgement figure is
trusted.

Guarded by `lib/the-panel-waits-for-the-lender.test.ts`.

### THE FIX WAS HALF A FIX — corrected the same day

Fabio, shown the above:

> "I don't like that... Whatever goes in and out. Like, you should always be
> available at all times. It can't be tied to a lodgement date."

Right, and the first fix only widened the gate instead of removing it. Notes
start at the first phone call, not at lodgement.

**Latest update and ATTN Settlements are now their own component** —
`components/TheDealTrail.tsx` — drawn on every deal, at every stage, with no
condition of any kind. Written once on the deal page, outside every branch, per
that page's own rule.

What stays inside the settlement panel, still gated on `isWithLender()`: the
seven steps, the contracts, the other documents, the discharge. Those are jobs
that cannot start before a deal reaches the bank, and on a new lead they are a
row of empty boxes for work nobody has begun.

**Why it ever ended up in the wrong box**, which is the part worth keeping:

- **24 Aug 2026** — the settlement panel is built for the settlements team.
  "Latest update" is one line inside it; the placeholder reads *"settling 3pm"*.
  A settlement field. Hiding it before lodgement is correct.
- **15 Nov 2026** — Fabio: *"Latest update - a trail, not a box. Every entry
  dated and named, nothing typed over."* At that moment it stopped being a
  settlement field and became where anybody writes down what happened.
- It stayed in the August box and kept the August rule. Nobody moved it,
  including me, and I built the trail. Three weeks, and it took Belle.

`lib/nothing-is-lost.page.json` was edited by hand to move "Latest update" from
the panel to the new file, which is exactly the friction that snapshot exists to
create.
