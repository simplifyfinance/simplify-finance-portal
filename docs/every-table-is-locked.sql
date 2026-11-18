-- EVERY TABLE IS LOCKED, AND THE PORTAL CHECKS ITS OWN LOCKS.
--
-- 18 Nov 2026. Supabase emailed: "Table publicly accessible. Anyone with your
-- project URL can read, edit, and delete all data in this table because
-- Row-Level Security is not enabled."
--
-- The table was public.clients_backup_2026_11_12 - a copy of every client
-- record, taken by hand in the SQL editor on 12 November before a change that
-- wrote client records in bulk. Names, emails, phone numbers.
--
-- HOW IT HAPPENED, which is the part worth writing down:
--
--   create table clients_backup_2026_11_12 as select * from clients;
--
-- A table made that way inherits NOTHING. Not the policies, not the row level
-- security, not the grants. public.clients carries seven policies; the copy was
-- born with none and with RLS off, which is Postgres's default for a new table.
--
-- So nobody switched security off. It was never on. The copy looked like the
-- clients table and behaved like an open door, for six days.
--
-- Fabio: "security is my number one priority... I do not want this to ever
-- happen again." And on the audit he already had: "it never works because I'm
-- never online. So give me another alternative."
--
-- SO IT IS NOT A SCHEDULE. A job that needs somebody at a desk is a job that
-- does not run. This is a function the PORTAL asks every time an admin opens
-- the dashboard - see components/TablesWithoutRls.tsx. Nobody has to be online
-- for it; the next person to open the portal either sees nothing or sees the
-- table named in red at the top of the screen.
--
-- It would have found this one on the 13th instead of the 18th.

-- ---------------------------------------------------------------------------
-- WHAT IT ANSWERS
-- ---------------------------------------------------------------------------
--
-- Only tables with row level security OFF. NOT tables with RLS on and no
-- policies: three of ours are deliberately in that state and they are the most
-- locked things in the database -
--
--   auth_codes        sign-in codes, service role only. A policy here is
--   trusted_devices   somebody having "fixed" the second factor away.
--   broker_access     read only by auth_visible_broker_keys(), which is
--                     security definer and bypasses RLS by design.
--
-- A warning that cries wolf three times a day is a warning nobody reads, so
-- this one only ever names a genuinely open table.

create or replace function public.tables_without_rls()
returns table (table_name text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity = false
     -- ADMINS ONLY. Nobody else learns which doors are open: a list of
     -- unlocked tables is a shopping list. Non-admins get nothing back rather
     -- than an error, so the band simply never draws for them.
     and public.auth_role() = 'admin'
   order by c.relname
$$;

comment on function public.tables_without_rls is
  'Tables in public with row level security OFF. Admins only. Read by the dashboard so the portal checks its own locks without anybody being online. See docs/every-table-is-locked.sql.';

revoke all on function public.tables_without_rls() from public;
grant execute on function public.tables_without_rls() to authenticated;

-- ---------------------------------------------------------------------------
-- THE ONE THAT STARTED IT
-- ---------------------------------------------------------------------------
--
-- Run on the live database on 18 Nov 2026, within the hour of the email. No
-- policy with it, on purpose: nothing in the portal reads this table, so the
-- right answer is that nobody can.
--
--   alter table public.clients_backup_2026_11_12 enable row level security;
--
-- Still to decide: whether to keep it at all. A spare copy of client records
-- with no owner and nothing reading it is a liability even locked.

-- ---------------------------------------------------------------------------
-- AND THE HABIT THAT CAUSED IT
-- ---------------------------------------------------------------------------
--
-- Any time a table is made from another one, the next line locks it:
--
--   create table public.some_backup as select * from public.clients;
--   alter table public.some_backup enable row level security;
--
-- Two lines, always together. lib/every-table-is-locked.test.ts fails the ship
-- if a table is added to docs/ without them.

select count(*) as still_open from public.tables_without_rls();
