-- ===========================================================================
-- THE MONDAY MORNING AUDIT
-- ===========================================================================
--
-- 23 Nov 2026. Fabio: "Security is the number one priority of this portal. I
-- need you to understand the seriousness of that because I have financial
-- information in here."
--
-- HOW TO RUN IT. Paste the whole file into the Supabase SQL editor on LIVE and
-- press run. It writes nothing. It returns one table. Every line says PASS or
-- FAIL, and the FAILs sort to the top. Send Claude the FAIL lines.
--
-- AND THERE IS A SECOND HALF, because a portal can be perfectly locked and
-- still show the wrong number. Run these two beside this file:
--
--   docs/the-accuracy-check.sql    the six ways a figure goes wrong
--   docs/do-the-numbers-match.sql  what the database holds behind each screen
--
-- Why those six and not others: docs/the-six-ways-a-number-goes-wrong.md
-- Fabio, 23 Nov 2026: 'we rely on data to run the business.'
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE IS WRITTEN THE WAY IT IS
-- ---------------------------------------------------------------------------
--
-- The first version of this audit checked the faults we had already found.
-- That is backwards, and it missed three more holes within the hour - a view,
-- a function and a set of permissions - because it was not looking at them.
--
-- Fabio, 23 Nov 2026: "you're just checking, you're not checking ways of
-- people coming in."
--
-- So CHECK 1 IS THE WHOLE AUDIT and everything after it is detail. It asks one
-- question - WHAT CAN SOMEBODY REACH WITHOUT LOGGING IN - and it asks it of
-- every route into a Postgres database, not just the obvious one:
--
--   1. TABLES          - open unless row level security is on AND a policy
--                        names who may read.
--   2. VIEWS           - a view runs as ITS OWNER unless security_invoker is
--                        set, so it hands back rows the table underneath would
--                        have refused. This is how the commission book was
--                        readable on 23 Nov.
--   3. MATERIALISED    - row level security NEVER applies to these. If one
--      VIEWS             exists and anon can select it, it is open. Full stop.
--   4. FUNCTIONS       - a SECURITY DEFINER function runs as its owner and
--                        ignores every rule. Postgres grants EXECUTE to
--                        EVERYONE by default. This is how the entire pipeline
--                        - names, loan amounts, commissions - was readable.
--   5. STORAGE         - a public bucket serves files to anyone with the link,
--                        and a storage policy naming {public} does the same.
--                        This is how 581 client documents were readable.
--
-- AND ONE TRAP WORTH NAMING. "Granted to anon" and "granted to everyone" are
-- two different grants. `revoke ... from anon` does not touch the second one.
-- A fix written in September looked right, was verified by a query that looked
-- in the wrong place, and did nothing for two months. Check 1 uses
-- has_table_privilege and has_function_privilege, which see both.

select check_name, found, expected, result from (

-- ===========================================================================
-- 1. WHAT CAN BE REACHED WITHOUT LOGGING IN
-- ===========================================================================
select 1 as ord,
       'Things reachable without logging in' as check_name,
       (
         select count(*) from (
           -- Tables, views and materialised views the public can select
           select 1
           from pg_class c
           where c.relnamespace = 'public'::regnamespace
             and c.relkind in ('r','p','v','m')
             and has_table_privilege('anon', c.oid, 'SELECT')
             and (
               c.relkind = 'm'
               or (c.relkind in ('r','p') and not c.relrowsecurity)
               or (c.relkind = 'v' and coalesce((
                     select option_value from pg_options_to_table(c.reloptions)
                     where option_name = 'security_invoker'), 'off') not in ('on','true'))
             )

           union all
           -- Functions that run as owner and the public may call
           select 1 from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.prosecdef
             and has_function_privilege('anon', p.oid, 'EXECUTE')

           union all
           -- Buckets served to anyone with the link
           select 1 from storage.buckets where public

           union all
           -- Policies that name {public} and check nobody's identity
           select 1 from pg_policies
           where schemaname in ('public','storage')
             and roles::text like '%public%'
             and coalesce(qual,'') !~* 'auth_role|auth\.uid|auth_is_admin|auth_sees|auth_credit|auth_visible'
             and coalesce(with_check,'') !~* 'auth_role|auth\.uid|auth_is_admin|auth_sees|auth_credit|auth_visible'
         ) ways
       )::text as found,
       '0' as expected

union all
-- 2. A VIEW THAT BYPASSES THE RULES, whoever can reach it. A view without
--    security_invoker runs as its owner - postgres - and postgres is not
--    bound by row level security.
select 2,
       'Views that ignore row security',
       (select count(*) from pg_class c
         where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
           and coalesce((select option_value from pg_options_to_table(c.reloptions)
                         where option_name = 'security_invoker'), 'off') not in ('on','true'))::text,
       '0'

union all
-- 3. A FUNCTION THAT RUNS AS OWNER WITHOUT PINNING WHERE IT LOOKS THINGS UP.
--    Without `set search_path`, somebody who can create an object can change
--    what an unqualified name means inside a function running with full rights.
select 3,
       'Owner-rights functions with no fixed search path',
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.prosecdef
           and (p.proconfig is null
                or not exists (select 1 from unnest(p.proconfig) s
                                where s like 'search_path=%')))::text,
       '0'

union all
-- 4. A LOGIN WITH NO STAFF RECORD. Deleting somebody's staff record takes
--    them off the team screen and leaves the login working. That is how a
--    leaver kept her way in until 23 Nov 2026.
select 4,
       'Logins with no staff record',
       (select count(*) from auth.users u
          left join public.user_profiles p on p.id = u.id
         where p.id is null)::text,
       '0'

union all
-- 5. A PAST STAFF MEMBER WHO CAN STILL SIGN IN.
select 5,
       'Past staff who can still sign in',
       (select count(*) from auth.users u
          join public.user_profiles p on p.id = u.id
         where p.active = false
           and (u.banned_until is null or u.banned_until < now()))::text,
       '0'

union all
-- 6. A TABLE WITH THE LOCK SWITCHED OFF.
select 6,
       'Tables with row security switched off',
       (select count(*) from pg_class c
         where c.relnamespace = 'public'::regnamespace
           and c.relkind = 'r' and c.relrowsecurity = false)::text,
       '0'

union all
-- 7. A MATERIALISED VIEW. Row level security does not apply to these at all,
--    so one holding client data is open to anybody who can select it. There
--    are none today. If this ever reads anything but 0, read it before
--    trusting it.
select 7,
       'Materialised views (row security never applies)',
       (select count(*) from pg_class c
         where c.relnamespace = 'public'::regnamespace and c.relkind = 'm')::text,
       '0'

union all
-- 8. A PUBLIC BUCKET.
select 8,
       'Storage buckets open to the public',
       (select count(*) from storage.buckets where public = true)::text,
       '0'

union all
-- 9. FILES LEFT IN THE READING ROOM. See docs/OUTSTANDING.md - the sweep is a
--    known open item and cannot work as written.
select 9,
       'Documents stuck in the reading room',
       (select count(*) from storage.objects
         where bucket_id = 'reading-room'
           and created_at < now() - interval '1 hour')::text,
       '0'

union all
-- 10. HOW MANY ADMINS. An admin can change anybody's role.
select 10,
       'Admins',
       (select count(*) from public.user_profiles
         where role = 'admin' and active)::text,
       '4'

union all
-- 11. NEW LOGINS THIS WEEK. Fine if you invited somebody. The point of this
--     audit if you did not.
select 11,
       'Logins created in the last 7 days',
       (select count(*) from auth.users
         where created_at > now() - interval '7 days')::text,
       '0'

union all
-- 12. NOBODY HOME. Not a fault - a prompt to ask whether they still work here.
select 12,
       'Active staff not seen in 60 days',
       (select count(*) from auth.users u
          join public.user_profiles p on p.id = u.id
         where p.active
           and (u.last_sign_in_at is null
                or u.last_sign_in_at < now() - interval '60 days'))::text,
       '0'

union all
-- 13. "ANYONE SIGNED IN" WHERE IT SHOULD SAY "ANY ACTIVE STAFF MEMBER".
--     THIS FAILS ON PURPOSE until the big job is done. The number is what
--     matters: it should fall every week and never rise. Write each week's
--     number down.
select 13,
       'Rules that say anyone signed in, not staff',
       (select count(*) from pg_policies
         where schemaname in ('public','storage')
           and roles::text like '%authenticated%'
           and coalesce(qual,'true') in ('true','')
           and coalesce(with_check,'') !~* 'auth_role|auth\.uid|auth_is_admin|auth_sees')::text,
       '0'

union all
-- 14. ANON STILL HOLDS TABLE PRIVILEGES. Row level security is what actually
--     stops a stranger, but a table created tomorrow without it would be open
--     the moment it exists. Taking the grant away means a forgotten lock is
--     not also an open door.
select 14,
       'Tables the not-logged-in role still holds a grant on',
       (select count(*) from pg_class c
         where c.relnamespace = 'public'::regnamespace
           and c.relkind in ('r','p')
           and has_table_privilege('anon', c.oid, 'SELECT'))::text,
       '0'

union all
-- 15. ARE THE DEFAULTS STILL CLOSED.
--
--     23 Nov 2026. THE FIRST VERSION OF THIS CHECK COUNTED ROWS, and counting
--     rows is how a check tells you what you want to hear. Six rows existed,
--     the check was happy, and inside one of them `anon=X` was still sitting
--     on functions - so a function created the next day would have been
--     callable by the whole internet, which is the exact fault this audit was
--     written after. Fabio found it by asking what the rows actually said.
--
--     So this reads the contents. It counts the default settings owned by
--     postgres - the role everything here is created as - that still hand
--     something to the not-logged-in role, or to everybody.
--
--     Supabase's own internal role is deliberately not counted. Its defaults
--     cannot be changed and the attempt is refused; nothing in this portal is
--     created as that role.
select 15,
       'Defaults that still open new objects to strangers',
       (select count(*) from pg_default_acl d
          join pg_namespace n on n.oid = d.defaclnamespace
         where n.nspname = 'public'
           and pg_get_userbyid(d.defaclrole) = 'postgres'
           and (d.defaclacl::text like '%anon=%'
                or d.defaclacl::text ~ '[{,]=[a-zA-Z]'))::text,
       '0'

union all
-- 16. IS ANY SCREEN ABOUT TO GO SHORT WITHOUT SAYING SO.
--
--     23 Nov 2026. Supabase sends at most 1,000 rows per read and says nothing
--     about the rest. A screen asking for a whole table is correct until the
--     day that table passes a thousand, and then it is quietly wrong - no
--     error, no empty state, just fewer rows and worse figures.
--
--     It has happened twice. 2 Nov: two deal cards could not be found because
--     the deals screen had been handed the newest thousand of 1,165. 23 Nov:
--     Portfolio Review's plan was built from 1,000 of about 8,700 trail lines,
--     on a page whose figures reach clients.
--
--     Both are fixed and paged. These are the ones still read in one go,
--     because they fit today. THIS CHECK IS THE WARNING BEFORE THEY DO NOT.
--     It counts them at 800 - a fifth of headroom - so the fix happens on a
--     Monday rather than after somebody notices a number looks wrong.
--
--     WHEN THIS FAILS: page that read with everyRow() from
--     lib/the-whole-book.ts, the way TrailBook and PortfolioReview do. Do not
--     raise the cap; that moves the cliff and sends a huge payload to a
--     browser.
select 16,
       'Lists a screen reads in one go that are nearing the 1,000 row cap',
       (select count(*) from (
          select 1 from commission_lines where kind = 'upfront' having count(*) > 800
          union all
          select 1 from commission_lines where kind = 'clawback' having count(*) > 800
          union all
          select 1 from public.portfolio_review_properties having count(*) > 800
          union all
          select 1 from public.portfolio_reviews having count(*) > 800
          union all
          select 1 from public.commission_trail_gaps having count(*) > 800
          union all
          select 1 from public.deal_alerts where resolved_at is null having count(*) > 800
       ) nearly)::text,
       '0'

) checks
cross join lateral (
  select case when expected = found then 'PASS' else 'FAIL' end as result
) r
order by case when result = 'FAIL' then 0 else 1 end, ord;
