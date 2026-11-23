-- ===========================================================================
-- BOTH SIDES MUST MATCH
-- ===========================================================================
--
-- 22 Nov 2026. The portal's database is in Singapore (ap-southeast-1) and is
-- moving to Sydney (ap-southeast-2). Fabio has said since June that nothing
-- sits outside Australia. The region was recorded in docs/OUTSTANDING.md on
-- 16 September and nobody acted on it for two months.
--
-- THIS FILE IS THE PROOF, NOT THE MOVE.
--
-- Run it on the OLD project, run it on the NEW one, and put the two answers
-- side by side. Every number must be identical. Nothing goes live until they
-- are.
--
-- WHY THIS EXISTS AT ALL. On 12 November a table was created in production by
-- copying another one. It inherited no policies, no row level security and no
-- grants, and sat readable by anyone holding the public key for six days. One
-- table. A region move is that same risk across all 58 at once, because a
-- restore that silently drops policies leaves a database that LOOKS complete -
-- every row present, every screen working - and is wide open.
--
-- So the row counts are the easy half. The policy counts are the half that
-- matters.

-- ---------------------------------------------------------------------------
-- 1. THE SHAPE OF IT
-- ---------------------------------------------------------------------------
select 'tables'   as what, count(*)::text as n from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
union all
select 'views', count(*)::text from information_schema.views where table_schema = 'public'
union all
select 'functions', count(*)::text from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all
select 'policies', count(*)::text from pg_policies where schemaname = 'public'
union all
-- A TABLE WITH RLS OFF IS THE WHOLE REASON THIS FILE EXISTS. This must read 0
-- on both sides. If it reads anything else on the new project, stop.
select 'TABLES WITH RLS OFF', count(*)::text from pg_tables t
  join pg_class c on c.relname = t.tablename
  join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = t.schemaname
  where t.schemaname = 'public' and c.relrowsecurity = false
union all
select 'auth users', count(*)::text from auth.users
union all
select 'storage buckets', count(*)::text from storage.buckets
union all
select 'storage objects', count(*)::text from storage.objects
union all
select 'database size', pg_size_pretty(pg_database_size(current_database()))
order by what;


-- ---------------------------------------------------------------------------
-- 2. EVERY TABLE, ITS ROWS, AND ITS POLICIES
-- ---------------------------------------------------------------------------
--
-- The one that actually catches a bad restore. Save both results and diff them.
-- A table whose rows match and whose policy count does not is the dangerous
-- case, and it is invisible from the portal.
select
  t.tablename,
  c.relrowsecurity                                   as rls_on,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = t.tablename) as policies,
  (xpath('/row/c/text()',
     query_to_xml(format('select count(*) as c from public.%I', t.tablename),
                  false, true, '')))[1]::text::bigint as rows
from pg_tables t
join pg_class c on c.relname = t.tablename
join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = t.schemaname
where t.schemaname = 'public'
order by t.tablename;


-- ---------------------------------------------------------------------------
-- 3. THE POLICIES THEMSELVES
-- ---------------------------------------------------------------------------
--
-- Counts can match while the rules differ. This is the text of every policy,
-- so the two sides can be compared word for word.
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;


-- ---------------------------------------------------------------------------
-- 4. WHAT A STRANGER AND A SIGNED-IN PERSON MAY RUN
-- ---------------------------------------------------------------------------
--
-- Grants do not come across with a plain data restore and nobody notices until
-- a screen is empty - or worse, until one is not.
select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as granted
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
group by grantee, table_name
order by table_name, grantee;


-- ---------------------------------------------------------------------------
-- 5. THE BUCKETS, AND WHETHER ANY OF THEM IS PUBLIC
-- ---------------------------------------------------------------------------
--
-- reading-room must be private and must have no policy that can read it.
-- See docs/the-reading-room.sql.
select id, public,
  (select count(*) from storage.objects o where o.bucket_id = b.id) as objects
from storage.buckets b
order by id;

select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
