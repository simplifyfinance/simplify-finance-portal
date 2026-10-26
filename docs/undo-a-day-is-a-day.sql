-- UNDO: the notes and the one you are on.
--
-- Takes both columns off the plan. deal_ids, confirmed_at and broker_key are
-- untouched, so every day already agreed stays agreed.
--
-- The notes go with it. They are a day old at most by design, so there is
-- nothing here worth keeping a copy of.

alter table public.daily_plans
  drop column if exists notes,
  drop column if exists on_it_now;
