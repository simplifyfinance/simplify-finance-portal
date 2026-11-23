# How we audit this portal

**Simplify Finance · Mortgage Specialists Pty Ltd · ACL 387025**
**23 November 2026 · Commercial in confidence**

This document sets out the method by which we test the security of our client
portal, why the method is built the way it is, and what it does and does not
cover.

It describes the process, not the results. Findings are reported separately.

---

## The principle

**We do not audit the faults we already know about. We enumerate every route by
which a party could reach our data, and test each one.**

This distinction is the whole method, and we learned it the hard way.

Our first version of this audit was built from the faults found in an initial
review. It checked those things. Within an hour of being written it was
re-tested against a broader question — *what can an unauthenticated party reach
by any means* — and that question found three further exposures the audit would
never have detected, because it was not looking at them.

An audit written from known faults will keep passing while unknown ones
accumulate. An audit written from the structure of the system does not have that
blind spot.

---

## The five routes into a PostgreSQL database

Our database is PostgreSQL, managed by Supabase. There are exactly five ways
data can be read out of it. Every audit run tests all five.

### 1. Tables

A table is readable by anyone the platform has granted access to, unless row
level security is switched on **and** a rule exists naming who may read it.

**Both conditions are required.** Row level security switched on with no rules
denies everybody, which is safe. Rules written with row level security switched
off are ignored entirely, which is not. We test for the second case.

### 2. Views

A view is a saved query. By default it runs with the permissions of whoever
created it, not whoever calls it — which means it returns rows the underlying
table's rules would have refused.

Making a view respect those rules requires setting an option on it. There is no
default. Nothing warns you. We test every view for that option.

### 3. Materialised views

A stored copy of a query's results. **Row level security does not apply to these
at all.** There is no option to set and no rule that can protect one.

Our policy is that no materialised view may hold client data. The audit counts
them, and any count above zero is examined individually.

### 4. Functions

A database function can be declared to run with its creator's permissions, in
which case it ignores every access rule in the database.

Separately, PostgreSQL grants permission to execute a new function **to
everybody, by default**. The combination — a function that ignores the rules,
callable by anyone — is the most direct exposure available in this kind of
system, and it is created by taking no action at all.

We test every function that runs with creator permissions for who may call it.

### 5. File storage

Files are held in containers governed by their own rules, plus a flag marking a
container as public. A public container serves its contents to anyone with the
link. A rule that names the public role does the same without the flag.

We test both.

---

## A trap we document deliberately

In PostgreSQL a permission can be held by a named role, or by `public`, meaning
everybody. **Revoking one does not affect the other.**

A permission revoked from the unauthenticated role, verified by a query that
asks which named roles hold it, will appear correctly closed while remaining
open to everybody. We encountered exactly this: a control written in September,
verified at the time, and found in November to have had no effect.

Our audit therefore tests effective access — *can this party actually do this* —
rather than reading the permissions table. The two questions have different
answers and only one of them is the one that matters.

---

## What the audit consists of

Two scripted check sets. Both are read-only and neither modifies the system.

### Database checks — fifteen

Run in the database console. The first is the principal check.

| | Check |
|---|---|
| 1 | **Everything reachable without authentication**, across all five routes above. Expected: zero. |
| 2 | Views not set to run with caller permissions |
| 3 | Creator-permission functions without a fixed resolution path |
| 4 | Login accounts with no corresponding staff record |
| 5 | Former staff whose login remains enabled |
| 6 | Tables with row level security disabled |
| 7 | Materialised views in existence |
| 8 | Storage containers marked public |
| 9 | Temporary uploads not cleared |
| 10 | Administrator count, against expected |
| 11 | Accounts created in the last seven days |
| 12 | Active staff not seen in sixty days |
| 13 | Rules granting access on authentication rather than entitlement |
| 14 | Table grants still held by the unauthenticated role |
| 15 | Platform defaults still set to create new objects closed |

### Code checks — four

Run from the command line against the repository.

| | Check |
|---|---|
| 1 | Endpoints using the administrative key without verifying a staff record |
| 2 | Endpoints with no authentication check |
| 3 | Credentials written into source code |
| 4 | Security regression tests still present |

---

## How it runs

**Every Monday morning.** An automated reminder opens the audit at the start of
the week. Both check sets are run and take approximately five minutes together.

**Every check reports PASS or FAIL**, with failures sorted to the top. There is
no interpretation required to read the result.

**Each failure has a documented meaning and a documented response**, recorded in
our internal remediation guide. A failure is not a judgement call.

**Open items are tracked** in a standing register, with the check number that
detects each one, so a known issue is visible every week until it is closed
rather than being forgotten between reviews.

---

## Prevention, not only detection

Detection on a Monday is inferior to the exposure never existing.

We have therefore changed the platform's creation defaults so that new database
functions are not callable by unauthenticated parties and new tables are not
granted to the unauthenticated role. These settings are recorded as a mandatory
step for any new environment, including our planned regional migration, because
they are properties of the project and do not transfer with the data.

Check 15 exists to confirm those settings remain in force.

In addition, each remediated fault is accompanied by an automated test that
fails the build if the fault is reintroduced. A fix without such a test is
treated as incomplete.

---

## What this audit does not cover

Stated explicitly so no assurance is implied beyond what is given.

- **It does not examine access logs.** It establishes what is reachable, not
  what has been retrieved. Our provider retains access logs for days rather than
  months.
- **It does not test the application's user interface.** A screen presenting
  data to an inappropriate user is a separate class of fault.
- **It does not assess our hosting, email or source control providers' own
  access controls.** Those warrant separate review.
- **It is not penetration testing.** It enumerates and tests our own structure.
  It does not attempt to defeat it.
- **A clean result means these checks passed.** It is not an assurance that the
  system is secure.
