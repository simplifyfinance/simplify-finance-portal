-- THE SETTLEMENT TEAM PLAN THEIR DAY TOO.
--
-- 18 Nov 2026. Credit has said what they are doing every morning since 23
-- October (docs/the-days-plan.sql) and brokers since the week after
-- (docs/brokers-plan-their-day.sql). Settlements had the morning list - what
-- the book is owed - and no way for Belle or Julian to say which of it was
-- today's. So management could see the month and could not see the day.
--
-- A CREDIT ROW HAS AN OFFICER. A BROKER ROW HAS A KEY. Settlement staff are
-- neither: they are not in credit_officers and they carry no broker_key. So
-- the third way of naming a person on this table is the person.
--
-- NO FOREIGN KEY, AND NONE ANYWHERE NEAR THIS TABLE. See
-- docs/brokers-plan-their-day.sql for the twenty minutes that taught us: with
-- several links between two tables Supabase stops guessing which one an
-- embedded query means and refuses the lot.
--
-- RUN ON STAGING FIRST, then live. One column and one index. Nothing existing
-- is changed or dropped, and every row already in the table is untouched.

alter table public.daily_plans add column if not exists user_id uuid;

-- One plan per person per day, the same promise officer_id and broker_key have.
-- Credit and broker rows leave this null, and Postgres treats nulls as all
-- different, so this index does not touch them.
create unique index if not exists daily_plans_user_day
  on public.daily_plans (user_id, plan_date);

comment on column public.daily_plans.user_id is
  'Set on a settlement person''s own plan. Null on a credit assessor''s (officer_id) and on a broker''s (broker_key). Exactly one of the three is filled in - the portal decides which, see components/SettlementDay.tsx.';
