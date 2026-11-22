-- ===========================================================================
-- A PERSON MAY SAVE THEIR OWN VIEW OF THE BOARD. NOTHING ELSE.
-- ===========================================================================
--
-- 22 Nov 2026. Belle and Ellesse, after a week on the settlement process:
-- "Can we make each column collapsible and retain its last state? Currently,
-- all columns unfold again whenever I return to the main pipeline after
-- opening a deal."
--
-- The portal has always meant to remember it. lib/use-column-folds.ts writes
-- user_profiles.board_folds against the login, and lib/use-board-filters.ts
-- does the same with board_filters.
--
-- WHY IT NEVER SAVED. There are five policies on user_profiles and exactly one
-- of them allows an UPDATE:
--
--     Admins can update profiles   UPDATE   auth_role() = 'admin'
--
-- So Fabio's folds save and nobody else's do. Postgres refuses the write by
-- matching zero rows, with NO ERROR - the fold happens on screen, the save is
-- thrown away, and nothing anywhere says so. CLAUDE.md calls that the single
-- most repeated failure in this codebase and here it is again, this time in a
-- policy rather than in code.
--
-- WHY THE OBVIOUS FIX IS NOT THE FIX. "Let a person update their own row" is
-- one line:
--
--     create policy "..." on user_profiles for update
--       using (auth.uid() = id) with check (auth.uid() = id);
--
-- That row also holds ROLE and BROKER_KEY. Any signed-in person could then set
-- their own role to 'admin', and auth_role() is what every other policy in this
-- database asks. One line to remember a folded column, and the whole portal is
-- open. Fabio, 20 Nov 2026: "security is my number one priority."
--
-- SO THE WRITE IS NARROWED INSTEAD OF THE POLICY WIDENED. This function writes
-- two columns for whoever is calling it and cannot write a third. There is no
-- new UPDATE policy on user_profiles; the table stays exactly as locked as it
-- is today.
--
-- Run this on LIVE and on STAGING.

-- ---------------------------------------------------------------------------
-- 1. THE TWO COLUMNS, IF THEY ARE NOT THERE YET
-- ---------------------------------------------------------------------------
alter table public.user_profiles
  add column if not exists board_folds jsonb not null default '[]'::jsonb;

alter table public.user_profiles
  add column if not exists board_filters jsonb;


-- ---------------------------------------------------------------------------
-- 2. SAVING MY OWN VIEW
-- ---------------------------------------------------------------------------
--
-- NULL MEANS LEAVE IT ALONE, so the two hooks can save independently without
-- either one wiping the other's answer.
--
-- IT WRITES FOR THE CALLER, NEVER FOR A NAMED PERSON. There is no id argument
-- on purpose: an argument is something a browser can change, and the one thing
-- this must not be able to do is edit somebody else's view.
--
-- IT RETURNS THE ROW IT WROTE. A function that returns nothing cannot be
-- checked, which is how this fault stayed invisible for weeks. The hook reads
-- the result and says so when nothing came back.
create or replace function public.save_my_board_view(
  p_folds   jsonb default null,
  p_filters jsonb default null
)
returns table (board_folds jsonb, board_filters jsonb)
language sql
security definer
set search_path = public
as $$
  update public.user_profiles
     set board_folds   = coalesce(p_folds,   user_profiles.board_folds),
         board_filters = coalesce(p_filters, user_profiles.board_filters)
   where id = auth.uid()
  returning user_profiles.board_folds, user_profiles.board_filters;
$$;

revoke all on function public.save_my_board_view(jsonb, jsonb) from anon;
grant execute on function public.save_my_board_view(jsonb, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. DID IT WORK
-- ---------------------------------------------------------------------------
--
-- Both columns present, the function there, and executable by a signed-in
-- person but not by a stranger.

select 'board_folds' as what,
       count(*) as how_many, 1 as expected
from information_schema.columns
where table_schema = 'public' and table_name = 'user_profiles'
  and column_name = 'board_folds'

union all
select 'board_filters', count(*), 1
from information_schema.columns
where table_schema = 'public' and table_name = 'user_profiles'
  and column_name = 'board_filters'

union all
select 'save_my_board_view', count(*), 1
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'save_my_board_view'

union all
select 'authenticated may run it', count(*), 1
from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'save_my_board_view'
  and grantee = 'authenticated' and privilege_type = 'EXECUTE'

union all
select 'anon may NOT run it', count(*), 0
from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'save_my_board_view'
  and grantee = 'anon' and privilege_type = 'EXECUTE'

union all
-- AND user_profiles IS NO MORE OPEN THAN IT WAS. Still exactly one UPDATE
-- policy, still the admin one. If this ever reads 2, something widened the
-- table instead of narrowing the write.
select 'UPDATE policies on user_profiles', count(*), 1
from pg_policies
where schemaname = 'public' and tablename = 'user_profiles' and cmd = 'UPDATE';
