# Add this to the Valora Capital portal

**From the Simplify Finance portal · 23 November 2026**
**Commercial in confidence**

On 23 November we audited the Simplify Finance client portal properly for the
first time. It found four ways into the database from the open internet, plus
three further faults.

**None of them were mistakes. All of them were steps nobody took.** Everything
in a new Supabase project is open until somebody closes it, and closing it is
never the thing that fails loudly.

This is the add-on. Work through it in order. Parts 1 and 2 take about fifteen
minutes and close the whole class of problem.

---

## Part 1 — Run this today

**Step one: close the defaults.** New functions are callable by everybody the
moment they exist. New tables are reachable by the not-logged-in role. Change
that first.

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

**Step two: close what is already open.**

```sql
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure::text as sig
           from pg_proc p where p.pronamespace = 'public'::regnamespace
  loop
    execute 'revoke all on function ' || f.sig || ' from public, anon';
    execute 'grant execute on function ' || f.sig || ' to service_role';
  end loop;
end $$;
```

**One thing you cannot change, and it does not matter much.** Supabase has its
own internal role, and objects created by *that* role still grant the
not-logged-in role access. You are not permitted to change it and the attempt is
refused. It matters little because you create objects as `postgres`, not as that
role - but it is one more reason nothing may be created in the dashboard.

**Step three: grant back only what the signed-in portal actually calls.** Search
your code for every `.rpc(` call, list those function names, and grant execute
to `authenticated` for each. Nothing else.

**Step four: test.** Sign out, sign back in, open a record. If a screen breaks
it will say so, and it is one `grant` line to fix. That is the right failure
direction — closed until opened, rather than open until noticed.

---

## Part 2 — Find out what is currently reachable

Run this. **Anything it returns is reachable by a stranger with your public
key** — the one built into your login page.

```sql
with reach as (
  select case c.relkind when 'r' then 'table' when 'p' then 'table'
                        when 'v' then 'view' when 'm' then 'materialised view' end as kind,
         c.relname::text as name,
         case
           when c.relkind = 'm' then 'MATERIALISED VIEW - row security never applies'
           when c.relkind in ('r','p') and not c.relrowsecurity then 'NO ROW SECURITY'
           when c.relkind = 'v' and coalesce((select option_value
                 from pg_options_to_table(c.reloptions)
                 where option_name = 'security_invoker'), 'off') not in ('on','true')
             then 'VIEW BYPASSES ROW SECURITY'
           else 'gated'
         end as problem
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r','p','v','m')
    and has_table_privilege('anon', c.oid, 'SELECT')
)
select kind, name, problem from reach where problem <> 'gated'
union all
select 'function (runs as owner)',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'IGNORES ROW SECURITY'
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')
union all
select 'bucket', id::text, 'PUBLIC BUCKET'
from storage.buckets where public
union all
select 'policy', tablename || ' / ' || policyname, 'open to everyone, no identity check'
from pg_policies
where schemaname in ('public','storage')
  and roles::text like '%public%'
  and coalesce(qual,'') !~* 'auth_role|auth\.uid|auth_is_admin|auth_sees|auth_credit|auth_visible'
  and coalesce(with_check,'') !~* 'auth_role|auth\.uid|auth_is_admin|auth_sees|auth_credit|auth_visible'
order by 1, 2;
```

Go through whatever it returns, one at a time, and close each. Then it must
return nothing.

---

## Part 3 — The change in how to think about auditing

**Do not audit the faults you know about. List every route in, and test each
one.**

Our first audit was built from the faults we had already found. Within an hour
of being written it missed three more, because it was checking tables and the
three were a view, a function and a set of permissions.

There are exactly five routes into a PostgreSQL database:

**Tables** — open unless row security is on *and* a rule names who may read.
Rules written while row security is off are ignored entirely.

**Views** — a view runs as *its creator* unless `security_invoker` is set. It
hands back rows the table underneath would have refused. There is no default and
nothing warns you. This is how our commission book, with client names and loan
balances, was readable without logging in.

**Materialised views** — row security never applies. No option, no rule, no
protection. Do not put client data in one.

**Functions** — a `security definer` function ignores every rule, and execute is
granted to everybody by default. This is how our entire pipeline — deal names,
loan amounts, commissions — came back from a single unauthenticated request.

**Storage** — a public bucket serves files to anyone with the link, and a
storage rule naming `{public}` does the same without the flag. This is how 581
client documents were readable.

---

## Part 4 — The trap. Read this one twice

**"Granted to `anon`" and "granted to everyone" are two different grants.
Revoking one does not touch the other.**

We wrote a function in September with `revoke all on function ... from anon`
beside it, and a check querying the privileges table for a grantee of `anon` to
prove it. The check passed. The function stayed callable by the entire internet
for two months, because the grant that mattered was to `public` and neither the
revoke nor the check mentioned it.

**Always revoke from `public, anon` — both.**

**Always verify with `has_function_privilege` and `has_table_privilege`.** They
answer *can this party actually do this*, following every route. Querying a
privileges table answers a narrower question and will tell you what you want to
hear.

---

## Part 5 — Rules to adopt

**Never write `true` in a security rule.** If it cannot name who it lets in, it
is not a rule. We have about sixty of these and unpicking them is now a large
careful job that would have been nothing if they had never been written.

**Never create anything in the dashboard.** Tables, views, functions, storage
rules — all in a `.sql` file in the repository. Our two worst faults existed in
no file anywhere, which is exactly why no review caught them.

**Every view:** `create view ... with (security_invoker = on)`.

**Every function:** `revoke all on function ... from public, anon;` then grant
to `authenticated`.

**Every table:** row security on at creation.

**One entitlement check, used everywhere.** Not "is this request signed in" —
"is this an active staff member". Those are different questions, and the
difference is how a departed employee keeps her access. Our working version is
`lib/only-staff.ts`; it returns the refusal itself so every endpoint refuses in
the same words.

**Leaving is one action and it closes the login.** If there are two ways to
remove somebody and only one disables the account, somebody will use the other.

**Every fix gets a test that fails the build if it is undone.**

---

## Part 6 — Copy these files

| File | What it does |
|---|---|
| `docs/weekly-audit.sql` | 15 database checks. Paste into the SQL editor. Read-only. |
| `scripts/weekly-audit.sh` | 4 code checks. One command. Read-only. |
| `lib/only-staff.ts` | The entitlement check. |
| `docs/the-security-audit.md` | What each failure means and what to do. |

Then set a Monday morning reminder that runs both.

**Check 1 of the database audit is the whole audit** — it asks what a stranger
can reach, across all five routes. Everything after it is detail.

**Check 15 watches the defaults from part 1**, so if anyone ever undoes them,
Monday says so.

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

## Part 8 — The other audit: are the numbers right

A portal can be perfectly locked and still show the wrong figure. Parts 1 to 7
are about who can reach the data. This is about whether what they see is true.

**The framing is the same one that made the security audit work.** Do not check
the faults you know about. Ask one question of every way it can happen: *how can
a number on screen be wrong while everything looks fine?*

There are six answers. Every one has happened in the Simplify portal.

**1. Truncation.** Supabase sends at most **1,000 rows** per read and reports no
error for the rest. A screen asking for a whole table is correct until that
table passes a thousand, and then it is quietly wrong. This has happened twice -
once hiding 149 deal cards, once building a client-facing plan from 1,000 of
8,700 trail lines. **This is the big one. Check it today.**

**2. A write refused in silence.** Postgres returns zero rows and no error when
a rule blocks a save. The screen says "Saved". Nothing anywhere says otherwise.

**3. A join that quietly drops rows.** Joining on a column that is null for some
records. The row does not come back short - it does not come back at all.

**4. A join that quietly doubles rows.** One row left, two right, every sum
doubles. The answer stays plausible, which makes this the worst of the six.

**5. A missing value summed as zero.** "We do not know" and "nothing" are
different answers and a sum cannot tell them apart. Never write
`coalesce(figure, 0)` for something a person reads. A blank is honest; a zero is
a claim.

**6. A date in the wrong month.** The database is UTC, the business is Sydney,
eleven hours apart. A settlement at 9am on the 1st is the previous month if you
ask UTC. Month-end figures move depending on which clock the query used.

### What to copy

| File | Portable? |
|---|---|
| `lib/the-whole-book.ts` | **Yes, as is.** The pager. Copy it first |
| `lib/no-silent-thousand.test.ts` | **Yes, as is.** Fails the build on any read over 1,000 |
| `docs/the-six-ways-a-number-goes-wrong.md` | **Yes.** The reasoning |
| `docs/the-accuracy-check.sql` | **No - adapt it.** The six categories are universal; the table names are not. Rewrite it against ONE's own tables |
| `docs/do-the-numbers-match.sql` | **No - adapt it.** Same reason |

### The two rules worth having from day one

**Every list read pages.** Not "asks for a big number" - pages, until a page
comes back empty. Build it before the first list screen, not after somebody
cannot find a record.

**A screen that cannot get the whole answer says so and shows nothing.** Showing
part of an answer, with no sign that it is partial, is worse than showing an
error. In Simplify, Portfolio Review's plan now refuses to build if it cannot
read every trail line.

---

## One paragraph for whoever has no time

Everything in a Supabase project is open until closed, and closing it is a
separate step nothing reminds you to take. Run part 1 today. Run part 2 and
close whatever it finds. Then audit by listing the five ways in — tables, views,
materialised views, functions, storage — rather than by checking the faults you
already know about, because the faults you know about are not the ones that will
hurt you.
