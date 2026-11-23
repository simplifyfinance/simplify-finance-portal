-- ===========================================================================
-- THE MONDAY MORNING AUDIT
-- ===========================================================================
--
-- 23 Nov 2026. Fabio: "Security is the number one priority of this portal. I
-- need you to understand the seriousness of that because I have financial
-- information in here."
--
-- This exists because an audit nobody runs is not an audit. On 23 Nov a single
-- afternoon of looking found three faults that had been sitting there for
-- weeks: a leaver whose login still worked, dozens of rules that said "anyone
-- signed in" when they meant "any staff member", and a storage rule that let
-- the whole internet at the client documents. None of them were hard to find.
-- Nobody had looked.
--
-- HOW TO RUN IT. Paste the whole file into the Supabase SQL editor on LIVE and
-- press run. It writes nothing. It returns one table. Every line says PASS or
-- FAIL, and the FAILs sort to the top.
--
-- Send Claude the FAIL lines. That is the whole job.
--
-- Run it on STAGING too once staging is real.

select check_name, found, expected, result from (

-- 1. A LOGIN WITH NO STAFF RECORD.
--    This is how Sylvanne kept her way in. Deleting somebody's staff record
--    takes them off the team screen and leaves the login untouched.
select 1 as ord,
       'Logins with no staff record' as check_name,
       (select count(*) from auth.users u
          left join public.user_profiles p on p.id = u.id
         where p.id is null)::text as found,
       '0' as expected

union all
-- 2. A PAST STAFF MEMBER WHO CAN STILL SIGN IN.
--    Archiving bans the login. This catches anyone archived before that was
--    built, or archived by a route that forgot.
select 2,
       'Past staff who can still sign in',
       (select count(*) from auth.users u
          join public.user_profiles p on p.id = u.id
         where p.active = false
           and (u.banned_until is null or u.banned_until < now()))::text,
       '0'

union all
-- 3. RULES OPEN TO THE WHOLE INTERNET.
--    A policy on {public} with no check of who is asking. This is what was
--    wrong with the deal-documents bucket.
select 3,
       'Rules open to anyone, signed in or not',
       (select count(*) from pg_policies
         where schemaname in ('public','storage')
           and roles::text like '%public%'
           and coalesce(qual,'') !~* 'auth_role|auth\.uid|auth_is_admin|auth_sees|auth_credit_officer|auth_visible'
           and coalesce(with_check,'') !~* 'auth_role|auth\.uid|auth_is_admin|auth_sees|auth_credit_officer|auth_visible')::text,
       '0'

union all
-- 4. A TABLE WITH THE LOCK SWITCHED OFF.
--    Row level security off means every rule on that table is ignored.
select 4,
       'Tables with security switched off',
       (select count(*) from pg_class c
         where c.relnamespace = 'public'::regnamespace
           and c.relkind = 'r'
           and c.relrowsecurity = false)::text,
       '0'

union all
-- 5. A PUBLIC BUCKET.
--    A public bucket serves its files to anyone with the link, no sign-in.
--    Nothing in this portal should be in one.
select 5,
       'Storage buckets open to the public',
       (select count(*) from storage.buckets where public = true)::text,
       '0'

union all
-- 6. FILES LEFT IN THE READING ROOM.
--    A document that could not be read should be gone within the hour. See
--    docs/OUTSTANDING.md - the sweep is a known open item.
select 6,
       'Documents stuck in the reading room',
       (select count(*) from storage.objects
         where bucket_id = 'reading-room'
           and created_at < now() - interval '1 hour')::text,
       '0'

union all
-- 7. HOW MANY ADMINS.
--    An admin can change anybody's role. If this number moves and nobody
--    asked for it to move, something is wrong.
select 7,
       'Admins',
       (select count(*) from public.user_profiles
         where role = 'admin' and active)::text,
       '4'

union all
-- 8. NEW LOGINS THIS WEEK.
--    Expected 0 most weeks. A number here is fine if you invited somebody.
--    A number here when you did not is the whole point of this audit.
select 8,
       'Logins created in the last 7 days',
       (select count(*) from auth.users
         where created_at > now() - interval '7 days')::text,
       '0'

union all
-- 9. NOBODY HOME.
--    Sixty days without signing in. Not a fault - a prompt to ask whether
--    they still work here.
select 9,
       'Active staff not seen in 60 days',
       (select count(*) from auth.users u
          join public.user_profiles p on p.id = u.id
         where p.active
           and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '60 days'))::text,
       '0'

union all
-- 10. "ANYONE SIGNED IN" WHERE IT SHOULD SAY "ANY STAFF MEMBER".
--     THIS ONE FAILS ON PURPOSE until the big job is done. The number is what
--     matters: it should go down every week and never up. Write the first
--     run's number here so later weeks have something to compare against.
select 10,
       'Rules that say anyone signed in, not staff',
       (select count(*) from pg_policies
         where schemaname in ('public','storage')
           and roles::text like '%authenticated%'
           and coalesce(qual,'true') in ('true','')
           and coalesce(with_check,'') !~* 'auth_role|auth\.uid|auth_is_admin|auth_sees')::text,
       '0'

) checks
cross join lateral (
  select case
           when expected like '0%' and found = '0' then 'PASS'
           when expected = found then 'PASS'
           else 'FAIL'
         end as result
) r
order by case when result = 'FAIL' then 0 else 1 end, ord;
