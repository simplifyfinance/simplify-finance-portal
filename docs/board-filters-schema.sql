-- THE FILTERS A PERSON LEFT ON THE BOARD.
--
-- Fabio, 30 Sep 2026: "on the board view I want filters for deals", and on
-- whether they should survive the night: "Remember them, but say so loudly."
--
-- Beside board_folds, which already remembers which columns each person has
-- shut, and for the same reason. A filter is ONE PERSON'S VIEW of their own
-- board - Kylie looking at her own book must never change what Ellie sees - so
-- it lives on the profile, not in settings.
--
-- A BLOB HERE IS THE RIGHT SHAPE, unlike lender_rules next door. There is one
-- writer (the person themselves, from their own browser), nobody else ever
-- writes it, and losing it costs somebody one click. That is the opposite of a
-- rule two people answer about a bank.
--
-- NOTHING BREAKS WITHOUT IT. lib/use-board-filters.ts reads this column and
-- carries on with nothing filtered if it is not there, exactly as board_folds
-- does - so this can be run before the deploy or after it.
--
-- Safe to run twice. Nothing already stored is touched.

alter table public.user_profiles
  add column if not exists board_filters jsonb;

comment on column public.user_profiles.board_filters is
  'This person''s own deal board filters - broker, credit officer, lender, needs attention. A view, never a record: single writer, and losing it costs one click. Read by lib/use-board-filters.ts.';

-- WHO HAS ONE ON. A filter is a way to hide deals, so it is worth being able to
-- ask this when somebody says a deal has vanished.
select full_name,
       case when board_filters is null then 'none' else board_filters::text end as filters
  from public.user_profiles
 order by full_name;
