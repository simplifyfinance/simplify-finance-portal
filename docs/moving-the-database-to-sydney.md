# Moving the portal's database to Sydney

Written 23 November 2026. Plain English on purpose — meant to be read by
anyone, and handed to the IT reviewer or another tool to pick holes in.

**The situation.** The portal's database is in Singapore (`ap-southeast-1`).
It holds personal and financial information for Australian clients of an
Australian credit licensee. It should be in Sydney (`ap-southeast-2`).

| Project | Ref | Region | |
|---|---|---|---|
| simplify-finance-portal-claude | `brjytbuirbupatjtauhx` | ap-southeast-1 Singapore | production |
| Simplify Finance Portal — Staging | `jfgsyotmvwxeaohwdejv` | ap-northeast-2 Seoul | staging |

It was written down in `docs/OUTSTANDING.md` on 16 September 2026 and nobody
acted on it for two months.

---

## Status, 25 November 2026

**Phase 1 has started.** The 23 November version of this section said to wait
for Supabase. We are no longer waiting, because two of the three things we
were waiting on we can answer ourselves - see 1.3 and 1.4b below - and the
third (whether the API keys come out byte-identical) only changes how easy
Phase 4 is, not whether any of this is safe.

Done:

- `READY_LINK_SECRET` is set in Vercel, Production, 22 Nov. Tested end to end
  on 25 Nov by generating a fresh link from the refinance template and opening
  it. Nothing further needed.
- The Sydney staging project exists: `ap-southeast-2`, Micro, Data API on,
  "grant API access to new tables automatically" OFF, "enable RLS on new tables
  automatically" OFF. Both deliberate - see 1.4a.
- Seoul's extensions listed: `pg_stat_statements`, `pgcrypto`, `plpgsql`,
  `supabase_vault`, `uuid-ossp`. All Supabase defaults.
- Tooling checked on the laptop: Supabase CLI 2.117.0, psql 18.6. The CLI was
  deliberately NOT upgraded to 3.x - we rehearse with the version we will use
  on the day.

**Still genuinely open with Supabase:** whether the new project's keys are
identical if the JWT secret is reused, and where logs, analytics and
point-in-time recovery data sit. Neither blocks Phase 1, 2 or 3.

---

## The strategy

**Practise on staging. Production is not touched at all until staging has
proven the whole thing works.**

1. Move the Seoul staging project to Sydney, exactly as it is.
2. Bring that Sydney staging up to date so it matches production.
3. Run the robots against it for as long as it takes.
4. Then, and only then, do production on a weekend.

Staging has no client data, so there is nothing to lose while we learn. Every
command used on staging is the same command we will use on production.

**Nothing is ever copied INTO Korea.** Seoul is only ever copied out of. That
is the point of the exercise.

---

## What staging will NOT prove

Read this before starting, because these become the checklist for the real day.

| Cannot be tested on staging | Why | So on the day |
|---|---|---|
| The data moving | Staging has test data, not 146 MB of real records | Check row counts table by table, both sides |
| The 18 user accounts | Staging's users are not the staff | Check all 18 IDs match, and sign in with a real password before anyone is let back in |
| The 582 files | Staging has almost none | Count them, and open three documents from three different deals |
| The catch-up copy | Nothing is being written to staging while we work | Freeze writes properly, then re-copy, then re-check |
| Several people at once | Robots work alone | Watch the first hour after everyone is back |

All five have been put to Supabase in writing. Their answers go here when they
arrive.

---

# WHAT THE REHEARSAL ACTUALLY TAUGHT US — 25 NOVEMBER 2026

**Phase 1 and Phase 2 were done on 25 November. This section is what we did not
know when this plan was written two days earlier.** It is written down rather
than remembered, because the person doing this on the day may not be the person
who did it today.

Fabio, 25 Nov: "do not rely on memory... we're building a plan in the background
so we can fucking rely on it."

## What was done, and in what order

The order in this document was changed on the day, at Fabio's instruction, and
the new order is the right one:

> "bring the staging up to scratch. Match the staging to my current portal in
> Korea. Then we merge it across to Sydney... the point of this is then we're
> going to deploy bots to test every function of the current version of the
> portal to see if anything broke when we move from Korea to Sydney."

So: **update staging FIRST, then move it.** The original order moved an
out-of-date Seoul and layered production's schema on afterwards, which leaves a
hybrid - old data in an old shape with new columns bolted on - and robot
failures against a hybrid are impossible to tell from real ones.

What actually happened, in sequence:

1. Dumped Seoul (roles, schema, data).
2. Dumped production's SCHEMA ONLY. No client data left production at any point.
3. Compared the two. **Staging was one table and about thirty columns behind** -
   not three months of chaos. The gap that mattered: `deals` was missing all
   fourteen settlement columns, so the entire Settlements tab would have failed
   and it would have looked like Sydney broke it.
4. Dropped Seoul's public schema and rebuilt it from production's.
5. Proved it matched: 51 tables, 114 policies **word for word**, 36 functions,
   79 indexes, 12 triggers, row level security on all 51.
6. Re-dumped Seoul, restored into Sydney, locked Sydney down.
7. Proved Sydney matched production on the same counts, with `anon` able to
   reach nothing.
8. Pointed the portal at Sydney and ran the 43 browser tests.

## The five things this document did not know

**1. DOCKER IS REQUIRED AND WAS NOT INSTALLED.**
`supabase db dump` does not dump anything itself - it runs `pg_dump` inside a
Docker container. Without Docker it stops at `docker: command not found`. The
laptop has `pg_dump` and `pg_dumpall` 18.6 from Homebrew and using them directly
is tempting; do not. Supabase document no pg_dump equivalent, so the flags would
be ours, and what a dump silently leaves out is the one thing we cannot afford
to guess at.

**2. THE DIRECT CONNECTION DOES NOT WORK FROM DOCKER. USE THE SESSION POOLER.**
Supabase's direct connection is IPv6 only unless the IPv4 add-on is on. Docker's
default network is IPv4 only. So the container cannot reach the database however
healthy the project is, and the error is a bare `Connection refused` that reads
like an outage.

This document said "use the direct connection, not the pooler - the pooler
breaks the bulk copy". That is **right about the TRANSACTION pooler and wrong
about the SESSION pooler**, which behaves like a real connection and is
Supabase's own documented answer for IPv4-only networks. Session pooler was used
for every command on the day and nothing broke.

The two look different, which is how you tell them apart:

```
direct  : postgresql://postgres:PASSWORD@db.PROJECTREF.supabase.co:5432/postgres
session : postgresql://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

**3. ONE LINE OF roles.sql CANNOT BE RESTORED.**

```
psql:roles.sql:13: ERROR: permission denied for parameter log_min_messages
```

The line is `GRANT SET ON PARAMETER "log_min_messages" TO
"supabase_realtime_admin";`. The restoring role may not grant it. It is a
Supabase internal for their realtime service, which the new project manages
itself, and nothing of ours reads it. **Comment it out and re-run.**

**This is not on Supabase's documented error list.** It is ours, found here,
and it will happen again on the real day. The three statement timeouts above it
- `anon` 3s, `authenticated` 8s - are ours and must survive.

**4. THE DUMP DOES CARRY THE SECURITY POLICIES. Open question 2 is answered.**

This was the single largest risk in the project: a restore that silently drops
policies leaves a database where every row is present, every screen works, and
anyone holding the publishable key can read everything.

Counted off the schema file in about ten seconds:

| | production | staging after restore |
|---|---|---|
| `CREATE POLICY` | 114 | 114, word for word |
| `ENABLE ROW LEVEL SECURITY` | 51 | 51 |
| tables | 51 | 51 |
| functions | 36 | 36 |

We were waiting on Supabase to answer this. We did not need to.

**5. PASSWORD RECOVERY LINKS DO NOT WORK ON A NEW PROJECT.**
The recovery email arrives and its link lands on the login page rather than a
set-password screen, because the new project's redirect URLs have never been
configured. On the real day that is **eighteen people unable to get in**, on a
Sunday, with no way round it.

Configure the new project's Site URL and redirect URLs BEFORE cutover. Add it
to Phase 4's "before the weekend" list.

## Two smaller ones, worth knowing

**The circular foreign key warning is expected.**

```
pg_dump: warning: there are circular foreign-key constraints on this table:
pg_dump: detail: lender_documents
```

It means the data cannot load in a simple order. The restore already handles it
- that is exactly what `SET session_replication_role = replica` is doing in the
middle of the psql command. Production will throw the same warning. It is not a
problem.

**The CLI needs the password percent-encoded; psql does not.** The same
connection string that psql accepted was refused by `supabase db dump` with
`password authentication failed`. If a password has symbols in it, the CLI
needs them encoded. Easiest answer: when resetting a database password, use
letters and numbers only.

## THE RUN THAT MATTERED — 42 of 42, 25 November 2026

**A clean full browser run against Sydney staging.** Signing in, opening deals,
typing into boxes, two windows on one deal, the compliance tab, the emails -
all 42 against a database in `ap-southeast-2`.

Nothing in the portal broke because of the move. Every failure in the earlier
runs was the database being empty, and the last three were a single blank
field. The move itself did not break one thing.

That is the result this whole exercise existed to get, and it was got on a
database with no client data in it rather than at eight o'clock on a Saturday
night.

## What the robots found, and what they did not

40 of 43 passed on the first full run against Sydney. **Every failure traced to
the database being empty, not to Sydney:**

| Failed | Why | Real? |
|---|---|---|
| `wesley.spec` | opens one specific client's deal by id, which only exists in production | no - point `PORTAL_WESLEY_DEAL_ID` at a Sydney deal |
| `new-deal-busy.spec` | the "Test deals only" filter row only exists when a test deal does | no - make one test deal |
| `settings.spec` | the credit team dropdown was empty | no - add a credit officer |
| `next-steps-email.spec` ×2 | the WealthDesk link in settings is blank | no - settings was recreated empty |

**Seed these before judging a run:** at least one broker, one credit officer,
one deal flagged as a test deal, and a settings row **with the WealthDesk link
filled in - that one blocks every save on the Settings page while it is blank**. Without them you will spend an afternoon chasing failures that are
not failures.

### IT WAS ALL ONE BLANK FIELD — answered 25 Nov 2026

The settings test looked like the one real failure. It was not, and the way it
hid is worth knowing.

**A blank WealthDesk link refuses EVERY save on the Settings page.** The
validation is deliberate - "It is the only way clients can send us their bank
statements, and it goes in every next-steps email" - but it blocks the whole
page, not just that field. So:

- `settings.spec` pressed Save settings, the save was refused by a dialog, and
  the test sat waiting for a value that was never written. It read as a
  60-second timeout with no clue attached.
- `next-steps-email.spec` x2 failed because the link itself was blank.

One empty field, three failures, none of them Sydney.

**So every robot failure in the first runs against Sydney traced to the database
being empty. Nothing was broken by the move.**

Two things to carry forward:

1. The seed list below is not optional. A blank WealthDesk link in particular
   silently blocks every other setting from saving, which on a fresh project
   looks like a broken Settings page.
2. On the real day this cannot happen, because production's settings row comes
   across with its data. It is a staging artefact - but it cost an hour to
   find, so it is written here rather than rediscovered.

## WHAT IS POINTED AT WHAT, AS AT 25 NOVEMBER 2026 — READ THIS FIRST

**THE LAPTOP NOW TALKS TO SYDNEY STAGING, NOT PRODUCTION.** `.env.local` was
changed on 25 Nov. Three values point at the Sydney staging project:

```
NEXT_PUBLIC_SUPABASE_URL          Sydney staging
NEXT_PUBLIC_SUPABASE_ANON_KEY     Sydney staging publishable key
SUPABASE_SERVICE_ROLE_KEY         Sydney staging secret key
PORTAL_TEST_DEAL_ID               a Sydney deal
PORTAL_WESLEY_DEAL_ID             the same Sydney deal
```

**THIS CHANGES WHAT A SHIP DOES, AND IT IS THE FIX WE WANTED.** `ship.sh` runs
`check-browser.sh`, which loads `.env.local` and runs 43 browser tests that sign
in and type into real screens. Until today that was PRODUCTION - which is how
roughly 891 robot deals appeared in the live database over thirty days in
October. From now on those tests run against Sydney staging and the live book is
never touched by a robot again.

So: **do not put `.env.local` back to production.** The backup is
`.env.local.production` if it is ever needed, and both are ignored by git.

The one consequence worth knowing: a ship now proves the portal works against
SYDNEY STAGING, not against production. Until cutover those are the same code
against the same structure, which is exactly what we spent today proving. After
cutover they are the same thing entirely.

**The Sydney staging project costs about $10 a month.** Delete it when the real
move is done and verified, not before.

## WHAT STAGING STILL HAS NOT PROVEN

Three things, and **two of them have not been done even once**:

1. **The 582 client documents.** Staging has none. Copying them is a separate
   Node script from Supabase's guide and it has never been run. Known rough
   edges: it lists with a limit of 1000 and does not page past it, and it
   uploads with `upsert: true`.
2. **The 18 staff keeping their passwords.** This needs the JWT secret copied to
   the new project BEFORE the auth users move. We did not do it - we set a
   staging password by hand instead. Untested.
3. **The real volume.** Staging moved 258KB. Production is 161MB with 306 deals,
   1,911 clients and 21,479 history rows.

**The mechanics are rehearsed. The parts that touch your staff and your clients
are not.**

## The plan from here, agreed 25 Nov

- **Next few days:** run the robots repeatedly against Sydney staging, by hand
  as well, and learn more. Seed the data above first.
- **The weekend after that:** the real transfer - not this coming weekend.
- **Before then, rehearse the two untested things:** the storage copy and the
  JWT secret / auth users step.

Fabio: "on the weekend... we use all the robots to test and learn a lot more.
And then the weekend after, we'll do the transfer."

---

# PHASE 1 — Move staging from Seoul to Sydney

This is the rehearsal of the real move. Same commands, nothing at stake.

**1.1** Create a new project in `ap-southeast-2`. Call it
`Simplify Finance Portal — Staging (Sydney)`.

**1.2** Find out what is enabled on Seoul, and turn the same things on in
Sydney before restoring anything. Restoring into a project missing an
extension fails.

```sql
select extname, extversion from pg_extension order by extname;
```

**1.3** ~~Do not start 1.4 until Supabase answer.~~ **ANSWERED, 25 Nov 2026 -
and we answered it ourselves.**

Supabase say the target's default privileges can change the effective
permissions, and to revoke them before restoring if the existing permissions
matter. We asked them for the exact statements and sat waiting.

The statements are already in this document. They are in "A NEW PROJECT IS
BORN OPEN", worked out in the 23 November security audit against this very
problem - a brand new project starts open, and nothing fails when you forget
to close it.

So there is nothing to wait for. The revokes have been lifted into the
sequence as **1.4a**, which is where they actually have to run, and the
section below is kept as the background.

**The dump in 1.4 writes nothing to any database.** It reads Seoul and writes
three files to the laptop. It was never the risky step; the restore in 1.5 is.

**1.4** Dump Seoul. Three files.

**DOCKER IS REQUIRED, AND THERE IS NO DOCUMENTED WAY AROUND IT - 25 Nov 2026.**

`supabase db dump` does not dump anything itself: it runs `pg_dump` inside a
Docker container. On a laptop without Docker it stops with
`docker: command not found`. Supabase's backup-and-restore page lists
"Install Docker Desktop" as step 2 for exactly this reason.

The laptop HAS `pg_dump` and `pg_dumpall` 18.6 from Homebrew, so running them
directly is tempting. **Do not.** Supabase document no pg_dump equivalent of
these three commands, which means the flags would be ours rather than theirs -
and the one thing we cannot afford to get subtly wrong is what the dump
leaves out. Install Docker and use the documented path.

**ON THE CONNECTION STRING.** Direct connection, not the pooler - the pooler
breaks the bulk copy. Supabase's page says the same, with one exception they
document: if the network has no IPv6 and the IPv4 add-on is off, use the
**Session pooler** string instead. Not the transaction pooler.

**ON THE FLAG, AGAIN.** Supabase's page writes these as `--remote=`. The CLI
installed on this laptop is 2.117.0 and has **no `--remote` flag at all** -
`supabase db dump --help` lists `--db-url`. Their docs are written against a
newer CLI. We use `--db-url` because that is what the installed binary takes,
and we are deliberately not upgrading mid-rehearsal. Re-check the help after
any CLI upgrade.

**THE FLAG IS `--db-url`, NOT `--remote`.** Checked against the installed CLI
on 24 Nov 2026 (v2.117.0) with `supabase db dump --help`. There is no
`--remote` flag and the first command would have failed on it. Check the help
again on the day rather than trusting this block, because the flags have
changed between releases before and that is how this one got written wrong.

**The URL must be percent-encoded.** The CLI says so itself. If the database
password contains any of `@ : / ? # [ ] %` the URL has to carry the encoded
form or the connection fails with something unhelpful about the host.

```
supabase db dump --db-url "<SEOUL_CONNECTION_STRING>" -f roles.sql  --role-only
supabase db dump --db-url "<SEOUL_CONNECTION_STRING>" -f schema.sql
supabase db dump --db-url "<SEOUL_CONNECTION_STRING>" -f data.sql \
  --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

**1.4a** **LOCK THE NEW SYDNEY PROJECT DOWN BEFORE ANYTHING IS RESTORED INTO
IT.** Added to the sequence 25 Nov 2026, because Phase 1 did not have it and
the step it refers to sits 200 lines further down this document under a
heading nobody reads mid-restore.

A new Supabase project is born open: a new function is callable by everybody
the moment it exists, and a new table is reachable by the not-logged-in role.
Production has settings that close those defaults and **those settings do not
travel with a restore.** Nothing fails when you skip this, which is exactly
why it gets skipped.

Run these on the NEW Sydney project, before 1.5:

```sql
alter default privileges in schema public
  revoke execute on functions from public, anon;
alter default privileges in schema public
  revoke all on tables from anon;
alter default privileges in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
```

And after 1.5, before anybody uses it:

```sql
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
```

Full background in "A NEW PROJECT IS BORN OPEN" below, and in
`docs/the-security-audit.md`.

**1.4b** **ANSWER THE BIGGEST OPEN QUESTION OFF THE DUMP, INSTEAD OF WAITING
FOR SUPABASE TO ANSWER IT.** Added 25 Nov 2026.

Open question 2 asks whether `supabase db dump` emits `CREATE POLICY` and the
row-level-security switches. That is the single largest risk in this entire
project: a restore that silently drops policies leaves a database where every
row is present, every screen works, and anyone holding the public key can read
everything.

We do not need Supabase to answer it. `schema.sql` is sitting on the laptop.
Look:

```
grep -c "CREATE POLICY"                 schema.sql
grep -c "ENABLE ROW LEVEL SECURITY"     schema.sql
grep -c "GRANT "                        schema.sql
```

The first two must both be greater than zero, and `CREATE POLICY` should be in
the same ballpark as the policy count on Seoul:

```sql
select count(*) from pg_policies where schemaname = 'public';
```

**If `CREATE POLICY` comes back 0, stop.** The dump is not carrying the
security rules, every later phase is built on sand, and the whole method has
to change before anything is restored anywhere.

**1.5** Load all three into Sydney, in order, in one transaction.

**VERIFIED 25 Nov 2026.** Checked against Supabase's own backup-and-restore
page: this is their documented restore command, character for character,
including the `--command` sitting between the two files. Their stated reason
for it is that it "disables triggers during the migration, preventing columns
from being double encrypted", and its position matters - it applies to the
data load only.

The documented error list below is also theirs, and matches ours exactly.

```
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname <SYDNEY_STAGING_CONNECTION_STRING>
```

`session_replication_role = replica` turns triggers off while data loads, so
nothing fires half-built.

**Expect errors. These are documented by Supabase, so they are normal:**

| Error | Fix |
|---|---|
| `must be owner of ...` or `supabase_admin` permission denied | Comment out the `ALTER ... OWNER TO "supabase_admin"` lines in `schema.sql` |
| `permission denied to grant role "postgres"` | Comment out the `GRANT "postgres" TO "cli_login_postgres"` line in `roles.sql` |
| anything about `cli_login_postgres` | `DROP ROLE IF EXISTS cli_login_postgres;` then retry |
| a custom login role cannot sign in | `alter user "THE_ROLE" with password 'something';` |

**Write down every error and every fix.** That list is the most useful thing
this phase produces, because the same errors appear on the real day.

**1.6** Bring across the bits the dump leaves out. Supabase confirmed
`supabase db dump` **excludes the managed `auth`, `storage` and extension
schemas by default.**

**NOT YET VERIFIED - 25 Nov 2026.** `supabase db diff` normally compares a
database against the local migration files, and **this repository has no
migrations folder** - `supabase/` contains only an empty `.temp`. So what this
command would actually produce here is unknown.

Check what it expects before running it:

```
supabase db diff --help
```

If it needs migrations we do not have, the fallback is a schema-only dump of
the `storage` and `auth` schemas and reading that instead. Decide before the
real day, not during it.

```
supabase db diff --db-url "<SEOUL_CONNECTION_STRING>" > changes.sql
```

Read `changes.sql` before running it. It should contain the rules on
`storage.objects`, including the reading-room one.

**1.7** Move the auth users. Set the new project's JWT secret to the same
value as Seoul's first — Supabase confirm that keeps existing sessions valid.
Practise it here, because on the real day this is the part that must not go
wrong.

**1.8** Copy the storage files using the script in Supabase's backup-restore
guide. Two known rough edges: it lists with a limit of 1000 and does not page
past it, and it uploads with `upsert: true`, overwriting anything at the same
path.

---

# PHASE 2 — Bring Sydney staging up to date

> **WHY THIS IS AFTER PHASE 1 AND NOT BEFORE IT.** Asked directly, 24 Nov 2026:
> "the staging is really behind the current portal, and we need to bring the
> staging up to date to then move it across. Otherwise, we're testing things
> that are not exactly the same."
>
> Right concern, and this is where it is answered. Phase 1 is not the test - it
> is practising the mechanics of moving a database that has data, roles, auth
> users and files in it, and for that the shape does not matter. Phase 2 is
> where the shape is fixed, by copying production's own schema rather than by
> running the September catch-up script, which never knew about the sixteen
> tables that exist live and are described nowhere in this repository.
>
> Nothing is tested against a three-month-old database. 2.4 is the gate: the
> structures must match exactly, or we stop.

Staging has never matched production. Sixteen tables exist live that no file
in this repository describes, which is why it was parked.

Only now, with staging already in Sydney, does production's structure get
copied — and it goes to Sydney, never to Korea.

**2.1** Take the schema out of production. **Schema only. No client data goes
anywhere near staging.**

```
supabase db dump --db-url "<SINGAPORE_CONNECTION_STRING>" -f prod-roles.sql  --role-only
supabase db dump --db-url "<SINGAPORE_CONNECTION_STRING>" -f prod-schema.sql
```

**2.2** Load it into Sydney staging.

```
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file prod-roles.sql \
  --file prod-schema.sql \
  --dbname <SYDNEY_STAGING_CONNECTION_STRING>
```

Same errors as 1.5, same fixes.

**2.3** Run the diff against production for the auth and storage rules.

```
supabase db diff --db-url "<SINGAPORE_CONNECTION_STRING>" > prod-changes.sql
```

**2.4** Prove Sydney staging now matches production. Run
`docs/both-sides-must-match.sql` on production and on Sydney staging, and
compare.

Ignore the row counts — staging has different data. Everything else must match:

- The table count
- The policy count
- **Tables with row level security OFF: 0 on both**
- The grants for `anon`, `authenticated` and `service_role`
- The policy text, word for word

**DO NOT CHECK AGAINST A NUMBER WRITTEN IN THIS DOCUMENT.** 25 Nov 2026: this
list used to say "58 tables, 114 policies". The audit of 23 November counted
**51** tables and 585 storage objects, and the database was 161 MB, not the
146 MB quoted elsewhere here. One of those two counts was wrong, and a stale
number in a checklist is worse than no number - on the day it makes a clean
restore look like a failure, or hides a real one.

`docs/both-sides-must-match.sql` counts BOTH sides and does not hardcode
anything, which is why it is the gate rather than this prose. The rule is: the
two sides must equal each other. What they equal is not decided here.

**If the policies do not match, stop.** That is the whole risk of this
project, and finding it here, on staging, is exactly why we are doing it this
way.

**2.5** Point a copy of the portal at Sydney staging. A Vercel preview
deployment with three values changed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nothing else changes.

---

# PHASE 3 — Let the robots loose

Only start this once Phase 2 has shown Sydney staging matching production.

**3.1** Run the full browser suite against Sydney staging.

**FIRST, POINT THE ROBOTS AT SYDNEY. THIS STEP WAS MISSING - 25 Nov 2026.**

`scripts/check-browser.sh` loads `.env.local` (line 35) and starts the portal
on port 3100 with whatever that file names. **`.env.local` currently names
PRODUCTION.** Run 3.1 as it was written and the robots test the live database
again - which is the fault found on 25 Nov that put roughly 891 test deals in
production over thirty days.

So before running anything here:

1. Back up the real file: `cp .env.local .env.local.production`
2. In `.env.local`, change `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the publishable key) and
   `SUPABASE_SERVICE_ROLE_KEY` to the **Sydney staging** values.
3. Set `PORTAL_TEST_DEAL_ID` to a deal that exists in Sydney staging.
4. Check it: the robots' first screenshot should show staging, not the live
   book.

**And this is the permanent fix, not a Phase 3 chore.** Once Sydney staging
exists and is current, `.env.local` points at it for good and the test suite
stops writing to the live database forever. That is the root-cause fix for the
robot deals, and it is free - the staging project has to exist anyway.

```
cd ~/simplify-finance-portal && ./scripts/check-browser.sh
```

43 tests. Run it repeatedly, over days. Every failure is a thing we would have
discovered on production at eight o'clock on a Saturday night.

**3.2** Work it by hand as well. The robots do not look at everything:

- Sign in, including the emailed code
- Open a deal, every tab
- Open a document from the list
- Fold a board column, open a deal, come back — is it still folded
- Drop a PDF on a reader and see it come back
- Open a client link
- Open the compliance tab and generate a pack

**3.3** Write down everything that broke and what fixed it. That list plus the
Phase 1 error list is the script for the real day.

**3.4** Check `auth_role()` works in Sydney. **Effectively every policy on the
database calls it** - count them on the day rather than trusting the figure
that used to be written here; see the note in 2.4. If it is missing or owned by the wrong role, nothing works for
anybody. Same for `save_my_board_view`, `sweep_the_reading_room`,
`deal_exists` and `auth_credit_officer_id`.

---

# PHASE 4 — Production, on a weekend

Only start this when Phase 3 has been clean for several runs.

## Before the weekend

### Set `READY_LINK_SECRET` in Vercel. ~~Not optional.~~ DONE.

**24 Nov 2026: this is already done.** `READY_LINK_SECRET` exists in Vercel on
the Production environment, set 22 Nov. Nothing further is needed and nothing
below this line needs doing - it is kept because it explains WHY the variable
is there, which the next person to read this will want to know.

Preview and Development do not have it and do not need it: the links are signed
and checked on Production, and anywhere else the fallback below is fine.

The original note follows.

Three of the four client pages — `/ready`, `/answers`, `/opportunity` — open
from a signed link we email. The line that signs them, in `lib/ready-link.ts`:

```
process.env.READY_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
```

`READY_LINK_SECRET` is not set anywhere in this repository. So unless it was
added to Vercel by hand, those links are signed with the **service role key**,
which changes with the new project.

Supabase have **not** confirmed the new project's keys would be identical even
if we reuse the JWT secret. So assume they change.

What happens if we do nothing: every one of those links already sitting in a
client's inbox stops working at cutover. No error our end. The client clicks
and gets nothing.

**Do this:** copy the current service role key value out of Vercel, add it as
`READY_LINK_SECRET`, redeploy. Two minutes. `/proceed` is fine — it uses a
deal id, not a token.

### Run these on production and keep the answers

```sql
select extname, extversion from pg_extension order by extname;
select * from cron.job;                    -- harmless error if not installed
select * from supabase_functions.hooks;    -- harmless error if not installed
select count(*) from vault.secrets;        -- harmless error if not installed
select id, email, created_at from auth.users order by created_at;
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
```

If `vault.secrets` returns rows, the encryption key must be copied **while
Singapore is still alive.**

## The day

**4.1** Create the production Sydney project. Enable the same extensions.

**4.2** Tell the team. Nobody opens the portal until you say.

**4.3** Stop everything that writes, and put the portal into maintenance.
Supabase were specific: setting the database read-only is only a soft freeze
and is not enough on its own.

**4.4** Run Phase 1's steps against production — dump, restore, diff, auth
users. You have done every one of them before on staging.

**4.5** Copy the 582 files.

**4.6** Run `both-sides-must-match.sql` on both. **Every number identical,
including the row counts this time.** One difference and we stop.

Identical to EACH OTHER, not to any figure written in this document. See the
note in 2.4 - the counts quoted in the 23 November draft did not match what
the audit actually measured, and that is exactly how a good restore gets
declared broken at eleven o'clock on a Saturday night.

**4.7** The five things staging could not prove, in order:

1. Row counts match, table by table
2. All 18 user IDs match
3. Sign in as a real person with their existing password
4. 582 files present; open three documents from three different deals
5. The catch-up copy brought across anything saved since

**4.8** Change the three values in Vercel. Redeploy.

**4.9** Smoke test before anyone is let in: sign in with the code, open a deal,
open a document, fold a column and come back, open a client link emailed before
the move, save something and confirm it saved.

**4.10** Let everyone back in. Watch the first hour.

---

# After

**Leave Singapore switched on for two weeks.** Do not pause it, do not delete
it. It costs money and it is worth it.

**Understand the rollback honestly.** Until the first person saves something in
Sydney, rolling back costs nothing — change the three Vercel values back. After
that, going back means losing whatever was done in between, because Singapore
is no longer being updated. The free rollback window closes at the first save,
not at the end of the day.

**Then** delete Seoul.

---

# What "in Australia" will actually mean

Do not tell the IT reviewer that nothing leaves Australia. It will not be true.

**Will be in Australia:** the database, the Auth service, storage objects, and
backups alongside them. That is where the client records live, and it is the
bulk of it.

**Will not be:** Supabase's primary data processor is **Supabase Pte. Ltd., a
Singapore company**. **Supabase, Inc. in the United States** provides support
and operational services. Data transfers to Singapore and the US happen under
standard contractual clauses. That is the corporate structure, not a setting.

**Also not:** the emails Supabase Auth sends. The portal uses Supabase to send
**password resets** and **staff invitations** — their subprocessor list names
ActiveCampaign and Postmark in the United States. Pointing Supabase Auth at our
own SMTP, using the Resend account we already pay for, would take those off US
providers. Worth doing at the same time.

**Not documented at all:** where logs and analytics are held, where
point-in-time recovery data sits, and which jurisdictions Supabase staff access
data from. All four have been put to them in writing.

The honest sentence is: **client data is stored in Australia.** That will be
true, and it is the question anybody actually asks.

---

# A NEW PROJECT IS BORN OPEN — 23 Nov 2026

**This is a required step in Sydney, not a nice-to-have, and it is easy to
forget because nothing fails when you skip it.**

The audit of 23 November found four ways into this database from the open
internet. Every one of them existed because Postgres and Supabase open things by
default: a new function is callable by everybody the moment it exists, and a new
table is reachable by the not-logged-in role. Nobody did anything wrong. The
holes appeared on their own.

Production now has settings that close those defaults. **Those settings do not
travel.** They live in the project, so a brand new Sydney project starts with
Supabase's defaults — wide open — whatever the restore brings across.

So on the new Sydney project, before the restore:

```sql
alter default privileges in schema public
  revoke execute on functions from public, anon;
alter default privileges in schema public
  revoke all on tables from anon;
alter default privileges in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
```

And after the restore, before anybody uses it:

```sql
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
```

Then run `docs/weekly-audit.sql` against Sydney. **Check 1 must read 0 and check
15 must read 3.** If check 1 reads anything else, the new project is reachable
without a login and nothing else about the migration matters until it is not.

Full background in `docs/the-security-audit.md`.

# Every integration, and whether it is affected

| Thing | Affected? | Why |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Changes** | New project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Changes** | New project |
| `SUPABASE_SERVICE_ROLE_KEY` | **Changes** | New project |
| `READY_LINK_SECRET` | **Must be set first** | Or it falls back to the service key |
| `AUTH_COOKIE_SECRET` and the 2FA timings | No | Ours, not Supabase's |
| Resend | No | Separate service |
| Anthropic, x.ai | No | Separate services |
| Google Places, ABN lookup | No | Separate services |
| SalesTrekker | No | Email-based |
| GitHub, Vercel hosting | No | Code, not data |
| `/proceed` links already sent | No | Uses a deal id |
| `/ready`, `/answers`, `/opportunity` links | **Yes, unless `READY_LINK_SECRET` is set first** | Signed tokens |
| Edge Functions | None exist | — |
| Realtime, pg_cron, webhooks | None found — confirm live | — |
| Vault / pgsodium | None found — confirm live | If any, copy the key while Singapore is alive |

---

# What breaks if we get it wrong

| If this goes wrong | What you see | How bad |
|---|---|---|
| Policies not restored | Portal looks completely normal, and anyone with the public key can read everything | Worst case. This is what the comparison exists to catch |
| `auth_role()` missing | Nothing works for anyone, every screen empty | Loud and obvious |
| User IDs changed | Portal looks empty for everyone; "who did this" goes blank | Severe, and partly silent |
| Grants missing | Screens blank, or open | Mixed |
| `READY_LINK_SECRET` not set first | Client links already emailed silently stop working | Silent, and the client sees it first |
| Storage paths altered | Documents will not open | Noticed quickly |
| Password hashes not carried | 18 people reset their passwords | Annoying, not dangerous |
| Someone works during cutover | Their work is lost | Avoided by the weekend |

---

# Open with Supabase

Asked and not yet answered:

1. **If we reuse the JWT secret, are the new anon and service keys byte-for-byte
   identical?** They say the docs do not state it. Chase this — if yes, the
   cutover becomes a single URL change.
2. ~~Does `supabase db dump` emit `CREATE POLICY` and the row-level-security
   switches for public tables.~~ **WITHDRAWN 25 Nov 2026 - we can answer this
   ourselves off the dump file. See 1.4b. Do not wait for them on this.**
3. ~~The exact statements to revoke default privileges on the target before
   restoring.~~ **WITHDRAWN 25 Nov 2026 - already written in this document,
   from our own 23 November audit. Lifted into the sequence as 1.4a.**
4. Does custom SMTP remove ActiveCampaign and Postmark from the auth email path.
5. Where logs, analytics, point-in-time recovery data and support access
   actually sit for a Sydney project.
6. Whether any Australian contracting entity exists.
7. Any limit on running both projects for two weeks.
