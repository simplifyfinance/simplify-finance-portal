-- ===========================================================================
-- THE WEEK TAB IS THE TEAM'S, NOT EACH PERSON'S
-- ===========================================================================
--
-- 25 Nov 2026, and this is the SECOND attempt. The first stored the tab against
-- each login. It was wrong, and Fabio had already said so:
--
--   "That box is a box that is shared with all admin people. Kylie, Mark,
--    Catherine, Alan, Fabio. Okay? That fucking screen is the same screen for
--    everyone... The whole point of today as admin is everyone has the same
--    fucking information."
--
-- Per-login remembering fixed the resetting and left the real complaint exactly
-- where it was: Alan on This week, Fabio on Nobody has said, same meeting, two
-- different screens.
--
-- So there is ONE tab. Not one each. Kylie clicks This week and it is This week
-- for Mark, Catherine, Alan and Fabio. Looking at somebody else's Today shows
-- the same tab as your own, because there is only one - which also makes "view
-- as Alan" honest, and that feature exists for one reason: "I've been building
-- all these things and I'm saying it works. When they log in, it shows nothing
-- like we discussed."
--
-- IT LIVES IN settings, NOT IN user_profiles. settings is the singleton row the
-- portal already keeps one-of-everything in - the rate notice, the brands, the
-- wealth desk link. A shared tab is one of those. user_profiles.today_seat from
-- this morning is left in place and no longer read; dropping a column on a live
-- table buys nothing and risks a write nobody has found yet.
--
-- SAFE TO RUN TWICE. Run on LIVE and on STAGING.

-- ---------------------------------------------------------------------------
-- 1. THE COLUMN
-- ---------------------------------------------------------------------------
alter table public.settings
  add column if not exists week_tab text;


-- ---------------------------------------------------------------------------
-- 2. WHO MAY MOVE IT
-- ---------------------------------------------------------------------------
--
-- Through a narrow function, for the same reason the board folds go that way.
-- There is no UPDATE policy on settings for ordinary staff, so a direct write
-- is refused by matching zero rows - silently, with no error, which is the most
-- repeated failure in this codebase.
--
-- IT WRITES ONE COLUMN AND CANNOT WRITE A SECOND. settings also holds the rate
-- notice and the brands; a function that could write those would be a way for
-- any signed-in login to change what every client email says.
--
-- IT CHECKS THE TAB IS A TAB. Five names, fixed, matching SEATS in
-- lib/the-run-through.ts. Anything else is refused rather than stored, because
-- a stored value that is not a tab would open every admin on an empty meeting
-- with the counts still showing above it.
create or replace function public.set_the_week_tab(p_tab text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ok text;
begin
  if p_tab is null or p_tab not in
     ('nobody', 'this_week', 'next_week', 'client', 'lodged') then
    raise exception 'Not a tab: %', p_tab;
  end if;

  update public.settings set week_tab = p_tab where id = 'singleton'
  returning week_tab into ok;

  return ok;
end;
$$;

revoke all on function public.set_the_week_tab(text) from anon, public;
grant execute on function public.set_the_week_tab(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. DID IT WORK
-- ---------------------------------------------------------------------------
select 'week_tab column' as what, count(*)::text as got, '1' as want
from information_schema.columns
where table_schema = 'public' and table_name = 'settings' and column_name = 'week_tab'
union all
select 'set_the_week_tab exists', count(*)::text, '1'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_the_week_tab'
union all
select 'anon cannot call it', has_function_privilege('anon', p.oid, 'EXECUTE')::text, 'false'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_the_week_tab'
union all
select 'staff can call it', has_function_privilege('authenticated', p.oid, 'EXECUTE')::text, 'true'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_the_week_tab'
order by what;
