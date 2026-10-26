-- A DAY THAT IS A DAY: THE LINE, THE NOTES, AND THE ONE YOU ARE ON.
--
-- 26 Oct 2026. Fabio, after a week of the first version: "we need to be able
-- to really understand the order and flow, we should be able to add notes we
-- should be able to remove from list as everything that is allocated is being
-- allocated to be done in one day".
--
-- The plan already stored deal_ids in order. Two things were missing.
--
-- NOTES. A line against a deal FOR TODAY - "waiting on the valuation, chase
-- CBA at 11". It belongs to the day, not to the deal, so it lives on the plan
-- and it is gone tomorrow. Anything that matters longer than a day belongs in
-- the deal's own notes where the next person reads it.
--
-- ON IT NOW. The one deal somebody is working on this minute, so the team
-- board can say so and nobody rings about the file they are already on.
--
-- deal_ids NOW MEANS "ABOVE THE LINE". It always held the day; what changes
-- today is that the day is no longer everything sitting with you. A person
-- drags the line to where their day ends and what is below it is the queue -
-- not saved, because tomorrow it is drafted again.
--
-- NO FOREIGN KEY ON on_it_now. A deal id, matched in the portal. See
-- docs/who-did-each-stage.sql for the afternoon that taught me.
--
-- RUN ON STAGING FIRST, then live. Two columns, both with defaults. Nothing
-- existing is changed or dropped.

alter table public.daily_plans
  add column if not exists notes     jsonb not null default '{}'::jsonb,
  add column if not exists on_it_now uuid;

comment on column public.daily_plans.notes is
  'One line per deal, for this day only - { "<deal id>": "chase CBA at 11" }. Written by components/MyDay.tsx. Not deal notes: these are gone tomorrow.';

comment on column public.daily_plans.on_it_now is
  'The deal this person is working on right now, or null. Shown on the team board so nobody rings about the file somebody is already in.';
