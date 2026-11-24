-- ===========================================================================
-- THE WEEK TAB IS REMEMBERED, AND LOOKING AT SOMEBODY SHOWS THEIRS
-- ===========================================================================
--
-- 25 Nov 2026. Fabio, with three screenshots of the same screen:
--
--   "look at this screenshot that I'm looking at Alan Hemmings from his
--    laptop... So his laptop, his view, and what I'm pressing on my view that
--    says Alan Hemmings is different."
--
-- And then, on why it matters:
--
--   "How am I supposed to track what my team is doing as a team when my screen
--    and Alan's screen are fucking different?... which files are we focusing
--    this week, next week, and which ones are at the client? That's common
--    data. That's shared across everyone."
--
-- THE ANSWERS WERE ALWAYS SHARED. This week, next week, with the client - all
-- three live on the deal, written by whoever presses the button, read by
-- everybody. The counts on his three screenshots were identical: 17, 10, 6, 24,
-- 3. Nothing about the data differed.
--
-- WHAT DIFFERED WAS WHICH TAB WAS OPEN, and the reason is one line in
-- components/RunThrough.tsx:
--
--     const [seat, setSeat] = useState<Seat>('nobody')
--
-- It opens on "Nobody has said" every single time, for everybody, on every
-- load. Alan had clicked This week. Fabio's screen had reset. Two people
-- looking at the same meeting from different tabs and each assuming the other
-- was seeing different deals.
--
-- WHY THIS IS A DATABASE CHANGE AND NOT A BROWSER ONE. Fabio, asked directly:
-- "it's their fucking last tab. If I want the ability to view something as
-- someone, I need their fucking last tab." A tab kept in Alan's browser cannot
-- be read by Fabio's. So it is kept against the login, like the board folds and
-- the board filters already are.
--
-- SAFE TO RUN TWICE. Run on LIVE and on STAGING.

-- ---------------------------------------------------------------------------
-- 1. THE COLUMN
-- ---------------------------------------------------------------------------
alter table public.user_profiles
  add column if not exists today_seat text;


-- ---------------------------------------------------------------------------
-- 2. ONE MORE THING save_my_board_view MAY WRITE
-- ---------------------------------------------------------------------------
--
-- DROPPED AND RECREATED, NOT OVERLOADED. `create or replace` cannot change a
-- function's signature, so adding a third argument would leave TWO functions
-- side by side - and a call naming only p_filters would then be ambiguous and
-- fail with "function is not unique". The existing two-argument calls in
-- lib/use-column-folds.ts and lib/use-board-filters.ts keep working against
-- the new one, because the third argument has a default.
--
-- EVERYTHING ELSE ABOUT IT IS UNCHANGED, and deliberately: it still writes for
-- auth.uid() and takes no id argument, so nobody can write anybody else's view.
-- user_profiles still has exactly one UPDATE policy and it is still the admin
-- one. See docs/my-own-board-is-mine.sql for why that matters - the row also
-- holds role and broker_key, and a policy letting a person update their own row
-- would let any login make itself an admin.
drop function if exists public.save_my_board_view(jsonb, jsonb);

create or replace function public.save_my_board_view(
  p_folds      jsonb default null,
  p_filters    jsonb default null,
  p_today_seat text  default null
)
returns table (board_folds jsonb, board_filters jsonb, today_seat text)
language sql
security definer
set search_path = public
as $$
  update public.user_profiles
     set board_folds   = coalesce(p_folds,      user_profiles.board_folds),
         board_filters = coalesce(p_filters,    user_profiles.board_filters),
         today_seat    = coalesce(p_today_seat, user_profiles.today_seat)
   where id = auth.uid()
  returning user_profiles.board_folds, user_profiles.board_filters, user_profiles.today_seat;
$$;

revoke all on function public.save_my_board_view(jsonb, jsonb, text) from anon, public;
grant execute on function public.save_my_board_view(jsonb, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. DID IT WORK
-- ---------------------------------------------------------------------------
--
-- Expect three rows, every "got" matching every "want".
-- `check` is a RESERVED WORD in Postgres and cannot be a bare column alias -
-- 25 Nov 2026, found by running it: ERROR 42601 syntax error at or near "check".
select 'today_seat column' as what, count(*)::text as got, '1' as want
from information_schema.columns
where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'today_seat'
union all
select 'save_my_board_view takes 3 args', count(*)::text, '1'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'save_my_board_view' and p.pronargs = 3
union all
-- The old two-argument one must be GONE, or a call naming one argument is
-- ambiguous and every board fold stops saving.
select 'the old 2-arg one is gone', count(*)::text, '0'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'save_my_board_view' and p.pronargs = 2
order by what;
