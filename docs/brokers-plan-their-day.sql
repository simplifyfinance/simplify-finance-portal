-- BROKERS PLAN THEIR DAY TOO.
--
-- 23 Oct 2026. Fabio, looking at his own Today page the morning after it
-- shipped: "yeah look at mine!" - and it was blank. Every box on that page was
-- written "only if you are a credit assessor", so the four people who are not
-- got a greeting, a team panel floating on the right, and a hole where the
-- page should be.
--
-- A broker's day is the same shape as a credit assessor's: the deals sitting
-- with them, in order, and a button that says so. The table was built for
-- credit only - officer_id, not null, one row per officer per day - so this
-- makes room for the other half of the business.
--
-- NO FOREIGN KEY ON broker_key, AND NONE ANYWHERE NEAR THIS TABLE.
-- Earlier today I added three foreign keys from deals to credit_officers and
-- took the whole deals list down for twenty minutes: with four links between
-- two tables, Supabase stops guessing which one an embedded query means and
-- refuses the lot. See docs/who-did-each-stage.sql. A text key, matched in the
-- portal, cannot do that.
--
-- RUN ON STAGING FIRST, then live. Adds one column and one index, and relaxes
-- one rule. Nothing existing is changed or dropped.

-- The credit team's rows keep their officer. A broker's row has a key instead.
alter table public.daily_plans alter column officer_id drop not null;

alter table public.daily_plans add column if not exists broker_key text;

-- One plan per broker per day, the same promise officer_id already has.
-- Credit rows leave this null, and Postgres treats nulls as all different, so
-- this index does not touch them.
create unique index if not exists daily_plans_broker_day
  on public.daily_plans (broker_key, plan_date);

comment on column public.daily_plans.broker_key is
  'Set on a broker''s own plan. Null on a credit assessor''s, which uses officer_id. Exactly one of the two is filled in - the portal decides which, see components/TodayPlan.tsx.';

-- Reading and writing are already open to anybody signed in - see
-- docs/the-days-plan.sql. Nothing here is client data, and the brokers were
-- always meant to see every plan.
