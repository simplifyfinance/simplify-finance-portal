# The security audit

**Written 23 November 2026.** Fabio: *"Security is the number one priority of
this portal. I need you to understand the seriousness of that because I have
financial information in here."*

This is the record of what one afternoon of looking found in a portal that had
never been audited, the weekly routine that stops it recurring, and the settings
that stop it happening in the first place.

**It is written to be handed to the next portal.** Part 3 is the part to read
before building anything. Part 6 is the hour of work that would have prevented
all of this.

---

## 1. What was found on 23 November 2026

Seven faults. None were hard to find. Nobody had looked.

Four of them were ways into the database from the open internet, with no login
at all.

### 1.1 Client documents, readable by anyone — 581 files

A storage rule said *allow everybody*, with no check of who was asking. Anyone
holding the portal's public key — which is built into the login page and
readable from the page source — could list, download, overwrite and delete every
file in the container.

581 files, 136 MB: generated Fact Find, Handover and Broker Notes documents
across roughly 145 applications. Each one carries a client's whole financial
position.

In place since around August. Closed 23 November.

### 1.2 The commission book, readable by anyone

A database view returned, per loan: client name, loan reference, loan balance,
lender, monthly trail and commission missed. It ran with its creator's
permissions rather than the caller's, so the security rules underneath it never
applied, and the not-logged-in role could select from it.

**This one did not even need guessing.** The public key can ask the database
what exists and get a list back. The view was on that list.

Closed 23 November.

### 1.3 The entire pipeline, readable by anyone — one call

A function named `pipeline_register` returned, for every lodged or settled deal:
deal name, broker, lender, loan amount, expected upfront commission, settlement
dates, totals and splits. 304 deals.

It ran with owner rights, so no rule applied, and Postgres grants permission to
call a function to *everyone* by default. One request, no login, whole book.

The function itself was written correctly and deliberately narrow. The fault was
the permission, which nobody had to do anything to create.

Closed 23 November.

### 1.4 Functions the public could call

Thirteen more functions, including two that delete rows, were callable without
logging in. None leaked data on inspection, but none had any business being
reachable.

Closed 23 November.

### 1.5 A former staff member's login still worked

Her staff record had been deleted rather than archived. Deleting a record takes
somebody off the team screen and does not touch the login. Her credentials
remained valid for about a month after she left.

Closed 23 November.

### 1.6 "Signed in" was treated as "is a staff member"

About sixty database rules say `true` where they mean *any active staff member*,
and fifteen application endpoints checked nothing at all.

Harmless while every login was necessarily a staff member. 1.5 shows that
assumption failing.

Endpoints fixed 23 November. **The database rules are still open** — see
`docs/OUTSTANDING.md`.

### 1.7 A cleanup that was written down but never ran

A documented hourly cleanup of temporary uploads had no scheduler, and used a
method the provider blocks. The primary deletion path works and is tested; the
backstop did not exist.

**Still open.**

---

## 2. The two root causes

### Everything is open until somebody closes it

Four of the seven were things nobody did. Not mistakes — omissions. Postgres
grants function access to everyone by default. Supabase grants table access to
the not-logged-in role by default. A view obeys the rules underneath it *only if
somebody sets a flag*. A storage container is reachable *unless* a rule says
otherwise.

Every one of those defaults is open. Closing them is a separate, deliberate act
that nothing reminds you to take.

### A check that asks the easy question instead of the right one

- *Is this request authenticated?* in place of *is this request entitled?*
- *Is this the documents container?* in place of *is this requester permitted?*
- *Have they been removed from the list?* in place of *can they still log in?*

Each was adequate when written and became inadequate as the system grew.

---

## 3. Rules for the next portal

Every one of these is cheaper than the afternoon that found the faults above.

**Run the settings in part 6 on day one.** Before the first table exists. That
single step would have prevented 1.1 through 1.4.

**One function decides who is staff, and everything calls it.** Not "signed in".
A named check that reads the staff record, confirms it is active, and refuses
otherwise. Every endpoint and every database rule uses it.

**Never write `true` in a security rule.** If a rule cannot name who it lets in,
it is not a rule.

**Never create anything in the dashboard.** Every table, view, function and rule
lives in a `.sql` file in the repository. The two worst faults above —
1.1 and 1.2 — existed in no file anywhere, which is precisely why no review ever
saw them.

**Every new view sets `security_invoker = on`.** Without it a view hands back
rows the table underneath would have refused.

**Every new function revokes execute from `public`, not from `anon`.** See part
4. Getting this wrong looks exactly like getting it right.

**Never create a materialised view holding client data.** Row level security
does not apply to them at all. There is no flag to set.

**Leaving is one action, and it closes the login.** Not delete. Not hide. One
button that marks the person past and bans the account.

**Never delete a person.** Their name is on the work. Archive, always.

**A guard test for every fault you fix.** A fix with no test is a fault waiting
for the next person who does not know why the code looks like that.

**Audit from week one.** The checks below take two minutes on an empty portal.
They take an afternoon and a bad feeling after five months.

---

## 4. The trap worth its own section

**"Granted to `anon`" and "granted to everyone" are two different grants.**

In Postgres a permission can be held by a named role, or by `public`, which
means everybody. Revoking one does not touch the other.

In September a function was written with `revoke all on function ... from anon`
beside it, and a check that queried `information_schema.routine_privileges` for
a grantee of `anon` to prove it. The check passed. The function stayed callable
by the whole internet for two months, because the grant that mattered was the
one to `public` and neither the revoke nor the check mentioned it.

**Use `has_function_privilege` and `has_table_privilege`.** They answer *can this
role actually do this*, following every route. A query against a privileges
table answers a narrower question and will tell you what you want to hear.

---

## 5. The Monday routine

Five minutes.

### Part one — the code, in Terminal

```
./scripts/weekly-audit.sh
```

Looks for: endpoints using the master key without checking for a staff record,
endpoints with no sign-in check, keys written into the code, and guard tests
that have gone missing.

### Part two — the database, in Supabase

Paste `docs/weekly-audit.sql` into the SQL editor on LIVE and run it. Writes
nothing. Returns one table, FAILs at the top.

**Check 1 is the whole audit.** It asks one question — *what can somebody reach
without logging in* — of all five routes into the database: tables, views,
materialised views, functions and storage. Everything after it is detail.

### Part three — send Claude the FAILs

That is the whole job.

---

---

## 6. What each failure means, and what to do

The audit is written so no judgement is needed to read it. This is the table.

| Check | What a FAIL means | What to do |
|---|---|---|
| 1. Things reachable without logging in | Somebody with your public key can reach this without a login. **This is the one that matters.** | Treat as urgent. Whatever is listed, close it today. Four of these were found on 23 Nov 2026. |
| 2. Views that ignore row security | A view is handing back rows the table underneath would have refused. | `alter view public.<name> set (security_invoker = on);` then check the screen that uses it. |
| 3. Owner-rights functions with no fixed search path | A function with full rights can be tricked into running the wrong thing. | `alter function public.<name>() set search_path = public;` |
| 4. Logins with no staff record | Somebody can sign in who is not on the team. | Ban the login, then find out how it happened. |
| 5. Past staff who can still sign in | A leaver kept their way in. | Ban it today. |
| 6. Tables with row security switched off | Every rule on that table is being ignored. | Turn it back on, then ask who turned it off. |
| 7. Materialised views | Row security never applies to these. One holding client data is open. | Read it. If it holds client data, replace it with an ordinary view. |
| 8. Storage buckets open to the public | Files served to anyone with the link. | Nothing in this portal should be in one. |
| 9. Documents stuck in the reading room | The cleanup is not working. | Known open item — see `docs/OUTSTANDING.md`. |
| 10. Admins | The number moved. | If nobody asked for it, investigate immediately. |
| 11. Logins created in the last 7 days | Somebody was invited. | Fine if you invited them. Alarming if you did not. |
| 12. Not seen in 60 days | Possibly a leaver nobody archived. | Ask whether they still work here. |
| 13. Rules that say anyone signed in | The big job. Expected to fail until it is done. | Write the number down. It should fall every week and never rise. |
| 14. Tables the not-logged-in role holds a grant on | A table created without row security would be open from birth. | `revoke all on all tables in schema public from anon;` |
| 15. Settings that keep new objects closed | Your defaults are back to open, and everything built since is exposed. | Re-run part 7, then run check 1 again. |

**Code side.** A FAIL on endpoints using the master key, or with no sign-in
check, means `lib/only-staff.ts` is missing from that file — add it as the
first two lines. A FAIL on a missing guard test means somebody deleted a test
that was holding a fix in place; restore it from git history.

## 7. Stopping it rather than catching it

Catching a hole on Monday is worse than never opening it. These settings change
what happens by default, so a table or function created next month is closed
when it is born.

Run once, on LIVE and on every new project:

```sql
-- New functions are not callable by everybody.
alter default privileges in schema public
  revoke execute on functions from public, anon;

-- New tables and sequences are not reachable by the not-logged-in role.
alter default privileges in schema public
  revoke all on tables from anon;
alter default privileges in schema public
  revoke all on sequences from anon;

-- And the same for anything created by the dashboard, which creates as postgres.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
```

**What this does not do.** It does not set `security_invoker` on new views —
there is no default for that, so it stays a rule people must follow and the
audit must check. It does not turn on row level security for new tables. It does
not apply to objects that already exist; those are fixed once, by hand.

**What it costs if you get it wrong.** Nothing silent. A screen stops working
and says so, and one `grant` line fixes it. That is the right failure direction:
closed until opened, rather than open until noticed.

---

## 8. What this audit does not cover

Said plainly so nobody assumes otherwise.

- **It does not read access logs.** Whether somebody actually retrieved
  anything lives in the provider's logs, kept for days rather than months. The
  audit tells you what is open, not what was taken.
- **It does not test the application's screens.** A page showing a figure to the
  wrong person is a different kind of fault.
- **It does not check Vercel, Resend or GitHub.** Those have their own access
  lists and want their own review.
- **It cannot prove a negative.** A clean run means these checks passed.
