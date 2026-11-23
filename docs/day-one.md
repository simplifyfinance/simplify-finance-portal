# Day one

**The first thing to do on any new portal, before the first table exists.**

Written 23 November 2026, after an audit of the Simplify Finance client portal
found four ways into its database from the open internet. Every one of them was
something nobody did, rather than something somebody did wrong. The full record
is in `docs/the-security-audit.md`.

This document is the hour of work that would have prevented all of it.

Work through it in order. Do not skip part 1 because the portal is empty — an
empty portal is exactly when this is free.

---

## Part 1 — Close the defaults

**A new Supabase project is open.** A function is callable by everybody the
moment it is created. A table is reachable by the not-logged-in role. Nothing
warns you. Nothing fails. The hole simply exists.

Run this in the SQL editor before anything else:

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

**Then prove it took.** This must return 3 — one for functions, one for tables,
one for sequences:

```sql
select count(*) from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public' and d.defaclobjtype in ('f','r','S');
```

**One thing you cannot change, and it does not matter much.** Supabase has its
own internal role, and objects created by *that* role still grant the
not-logged-in role access. You are not permitted to change it and the attempt is
refused. It matters little because you create objects as `postgres`, not as that
role - but it is one more reason nothing may be created in the dashboard.

**These settings live in the project and do not travel.** Every new project
needs them again. Moving regions means a new project. Write it on the migration
plan.

---

## Part 2 — Build the one check everything uses

Before the first endpoint, write the function that answers *is this caller an
active staff member*. Not *are they signed in* — those are different questions,
and the difference is how a departed employee keeps her access.

It must do three things: confirm there is a session, read the staff record, and
refuse a record marked past. It returns the refusal itself rather than true or
false, so every endpoint refuses in the same words.

`lib/only-staff.ts` in this repository is the working version. Copy it.

Then: **every endpoint calls it as its first two lines.** Every one. The ones
that look harmless are the ones that get forgotten.

---

## Part 3 — The rules

**Never write `true` in a security rule.** If a rule cannot name who it lets
in, it is not a rule. Roughly sixty rules in this portal say `true`, and
unpicking them is now a large careful job that would have been nothing at all
if they had never been written.

**Never create anything in the dashboard.** Tables, views, functions, storage
rules — all of them live in a `.sql` file in the repository. The two worst
faults found in this portal existed in no file anywhere, which is exactly why
no review ever caught them.

**Every view sets `security_invoker = on`.** A view without it runs as its
creator and hands back rows the table underneath would have refused. There is
no default for this and nothing reminds you.

```sql
create view public.something with (security_invoker = on) as ...
```

**Every function revokes from `public`, not from `anon`.**

```sql
create function public.something() ...;
revoke all on function public.something() from public, anon;
grant execute on function public.something() to authenticated;
```

Read part 4 of `docs/the-security-audit.md` before you decide this is pedantic.
Revoking from `anon` alone looks identical, passes a plausible-looking check,
and leaves the function callable by the entire internet.

**Never create a materialised view holding client data.** Row level security
does not apply to them. At all. There is no flag to set and no rule to write.

**Row level security on, on every table, the moment it is created.** A table
without it ignores every rule you later write for it.

**Leaving the business is one action, and it closes the login.** Not delete,
not hide. One button that marks the person past and bans the account. If there
are two ways out and only one of them closes the login, somebody will use the
other one.

**Never delete a person.** Their name is on the work they did. Archive.

**Every fix gets a test that fails the build if it is undone.** A fix with no
test is a fault waiting for the next person who does not know why the code
looks like that.

---

## Part 4 — Set up the audit before you need it

Copy these three files:

| File | What it is |
|---|---|
| `docs/weekly-audit.sql` | 15 database checks. Paste into the SQL editor, read the FAILs. |
| `scripts/weekly-audit.sh` | 4 code checks. One command in Terminal. |
| `docs/the-security-audit.md` | What each failure means and what to do about it. |

Then set a recurring Monday morning reminder that opens the audit.

**Check 1 is the whole audit.** It asks one question — *what can somebody reach
without logging in* — of all five routes into a Postgres database:

1. **Tables** — open unless row security is on and a policy names who may read.
2. **Views** — run as their owner unless `security_invoker` is set.
3. **Materialised views** — row security never applies. Ever.
4. **Functions** — a `security definer` function ignores every rule, and
   execute is granted to everybody by default.
5. **Storage** — a public bucket serves files to anyone with the link, and a
   storage rule naming `{public}` does the same.

An audit that checks only tables will pass while three of the five are open.
That is not hypothetical. It is what happened here, on the first run, an hour
after the audit was written.

---

## Part 5 — Run it on day one and write down the numbers

Run both halves against the empty portal. Everything should pass. That takes two
minutes and gives you a baseline.

The alternative is running it for the first time after five months, which takes
an afternoon, finds four open doors, and ends with a conversation you did not
want to have.

---

## Part 7 — The check the audit cannot do

**Everything above tests the portal. None of it applies to somebody signing in
to the platforms behind the portal.**

An administrator on the Supabase account can open the table editor and read
every record and every file. No rule in this document stops them, because those
rules govern the portal's connection and a person at the dashboard is not using
it.

So, **on the 1st of each month**, open these five and read the names:

| Where | Exactly where | What they could do |
|---|---|---|
| **Supabase** | Organization → Team | Read and change every record and file. This one matters most. |
| **Vercel** | Team → Members | Change the live site, read its secret keys |
| **GitHub** | repo → Settings → Collaborators | Change the code |
| **Resend** | Team | Send email as you |
| **OneDrive** | The shared folders | Read archived documents |

Keep the allowed list in a file in the repository, so a change to who is allowed
is itself a visible, dated change. `docs/who-has-the-keys.md` is the template.

**Do not automate this with stored keys.** Supabase offers no read-only key —
its key can read everything and delete the project. Storing one on a laptop to
save two minutes a month creates a larger risk than it removes. Vercel's tokens
are broad too, and Resend offers no way to read its team list at all. You are
already signed in to these dashboards; reading five short lists is faster than
setting up the keys would be, and it cannot be stolen.

**If a name is there that should not be: remove it first, investigate second.**
Then check the provider's access logs for that period the same day — they are
kept for days, not months.

---

## The one-paragraph version

Everything in a new Supabase project is open until somebody closes it, and
closing it is never the thing that fails loudly. Spend the first hour closing
defaults, writing one entitlement check, and setting up the weekly audit. Then
build.
