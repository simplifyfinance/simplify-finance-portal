# The security audit

**Written 23 November 2026.** Fabio: *"Security is the number one priority of
this portal. I need you to understand the seriousness of that because I have
financial information in here."*

This document is two things. A record of what one afternoon of looking found in
a portal that had never been audited. And the weekly routine that stops it
happening again.

It is written to be handed to the next portal. Read part 3 before you build
anything.

---

## 1. What was found on 23 November 2026

Four faults. None were hard to find. Nobody had looked.

### Client documents could be read by anyone, without signing in

A rule on the document storage said *"allow everybody"* with no check of who was
asking. Combined with the access the not-signed-in role has by default, anyone
holding the portal's public key — which is built into the login page and
readable by anyone who views the page source — could list, download, overwrite
and delete every file in that bucket.

581 files. 136 MB. Fact Finds, Handovers and Broker Notes across roughly 145
deals, each one carrying a client's whole financial position.

In place since around August. No evidence anyone used it. Closed 23 November.

**Why it happened:** the rule was made by hand in the Supabase dashboard to get
storage working, and never revisited. It is in no file in the repo, so no code
review ever saw it.

### A former staff member's login still worked

Her staff record had been deleted. Deleting a record takes somebody off the team
screen and does not touch the login. She could still have signed in.

Last sign-in 21 October, a month before. No sign anyone used it. Closed
23 November.

**Why it happened:** the portal had two ways out — archive and delete — and only
archive bans the login. Archive only started banning on 18 November. Anyone
removed before that kept their way in.

### "Signed in" was treated as "is a staff member"

About sixty rules in the database say `true` where they mean *any staff
member*. The database checked that you had a login. It never checked you were
on the team.

That was harmless while every login was a staff member. It stopped being
harmless the moment a login existed without a staff record — which is exactly
what the fault above created. Such a login could read and write the client book,
commissions, lender data and the team list. Deals were safe; they are locked by
broker.

**Still open.** This is the big job.

### A cleanup that was written down but never ran

`sweep_the_reading_room()` was documented as emptying leftover uploads every
hour. Nothing ever called it, and it could not have worked — Supabase blocks
deleting storage rows from SQL. See `docs/OUTSTANDING.md`.

---

## 2. The one root cause

Three of the four are the same mistake wearing different clothes.

**A check that asks the easy question instead of the right one.**

- *"Are you signed in?"* instead of *"are you staff?"*
- *"Is this the documents bucket?"* instead of *"are you allowed in it?"*
- *"Have they been taken off the list?"* instead of *"can they still get in?"*

Each one was written in a hurry, worked on the day, and was never revisited
because nothing ever said it was wrong.

**That is what the weekly audit is for.** Not to find clever attacks. To ask the
right question on a schedule, so a shortcut taken in June does not survive to
November.

---

## 3. Rules for the next portal

Do these on day one. Every one of them is cheaper than the afternoon that found
the faults above.

**One function decides who is staff, and everything calls it.** Not "signed in".
A named check that asks for the staff record, confirms it is active, and refuses
otherwise. Every API route and every database rule uses it. No route invents
its own.

**Never write `true` in a security rule.** If a rule cannot name who it lets in,
it is not a rule. `true` on a table holding client data is a hole with a
timer on it.

**Never make a rule in the dashboard.** Every rule lives in a `.sql` file in the
repo, gets read in review, and can be diffed. The worst fault above was invisible
precisely because it existed nowhere in the code.

**Leaving must be one action, and it must close the login.** Not delete. Not
hide. One button that marks them past and bans the account, and no other way out
of the team list.

**Never delete a person.** Their name is on the work. Archive, always.

**A guard test for every fault you fix.** A fix with no test is a fault waiting
for the next person who does not know why the code looks like that. This repo
names them plainly — `nobody-is-deleted.test.ts`,
`the-reading-room-is-emptied.test.ts`.

**Audit from week one.** The checks in this document take two minutes. Run them
on an empty portal and they take two minutes. Run them after five months and
they take an afternoon and a bad feeling.

---

## 4. The Monday routine

Two parts. Five minutes in total.

### Part one — the code, in Terminal

```
./scripts/weekly-audit.sh
```

Writes nothing. Takes two seconds. Prints PASS or FAIL per check.

It looks for: routes using the master key without checking for a staff record,
routes with no sign-in check at all, keys written into the code, and guard tests
that have gone missing.

### Part two — the database, in Supabase

Open `docs/weekly-audit.sql`, paste the whole file into the SQL editor on LIVE,
press run. Writes nothing. Returns one table, FAILs at the top.

It looks for: logins with no staff record, past staff who can still sign in,
rules open to the public, tables with security switched off, public buckets,
documents stuck in the reading room, the number of admins, new logins this week,
staff not seen in sixty days, and the count of rules that still say *anyone
signed in*.

### Part three — send Claude the FAILs

That is the whole job. Paste the failing lines. Nothing else is needed.

---

## 5. What a FAIL means

| Check | What it means | What to do |
|---|---|---|
| Logins with no staff record | Somebody can sign in who is not on the team | Ban the login, then find out how it happened |
| Past staff who can still sign in | A leaver kept their way in | Ban it today |
| Rules open to anyone | A table or bucket is readable without signing in | Treat as urgent. This was the worst fault found |
| Tables with security switched off | Every rule on that table is being ignored | Turn it back on, then ask who turned it off |
| Public buckets | Files served to anyone with the link | Nothing in this portal should be in one |
| Documents stuck in the reading room | The cleanup is not working | Known open item, see OUTSTANDING.md |
| Admins | An admin can change anybody's role | If the number moved and nobody asked, investigate |
| New logins this week | Somebody was invited | Fine if you invited them. Alarming if you did not |
| Not seen in 60 days | Possibly a leaver nobody archived | Ask whether they still work here |
| Rules that say anyone signed in | The big job | Should fall every week, never rise |

---

## 6. What this audit does not cover

Said plainly so nobody assumes otherwise.

- **It does not read access logs.** Whether somebody actually downloaded a file
  lives in the Supabase dashboard logs, which are kept for days, not months. The
  audit tells you what is open, not what was taken.
- **It does not test the front end.** A screen that shows a figure to the wrong
  person is a different kind of fault.
- **It does not check Vercel, Resend or GitHub.** Those have their own access
  lists and want their own review, less often.
- **It cannot prove a negative.** A clean run means these checks passed. It does
  not mean the portal is safe.
