-- ONE ASK EACH, PER BROKER, PER DAY.
--
-- 27 Oct 2026. Catherine, Operations Manager, item 2 of nine: "The deal lists
-- the credit managers send don't show which broker each deal belongs to. When
-- Mark and Kylie reprioritise, other brokers' deals, like Justin's, keep
-- getting pushed back. Possibly a queuing system?"
--
-- THE PORTAL HAD NO PRIORITY AT ALL. lib/the-days-plan.ts has read a
-- `priority` field on a deal since the day's plan was built, and nothing in
-- the codebase has ever written one. The reprioritising Catherine is
-- describing happens in email and chat, which is exactly why whoever chases
-- hardest wins and Justin's files slide.
--
-- SO THE FIX IS NOT "LET BROKERS SET A PRIORITY". That is what is already
-- happening, just not in the portal, and building it plainly would make her
-- complaint worse rather than better: three of Mark's asks would simply sit at
-- the top of Katie's day in writing instead of in her inbox.
--
-- ONE SLOT EACH, PER DAY. Fabio's call, asked directly on 27 Oct. Every broker
-- may mark one deal as their next. Credit's day takes one from each broker in
-- the order they asked, and only then comes back round for seconds. Mark still
-- goes first because he asked first; he just does not get three in a row.
--
-- THE DAY IS A SYDNEY DAY and it is stored, not worked out. A slot that reset
-- at midnight UTC would reset at 11am in the office, which is the middle of
-- the morning somebody is trying to plan. See lib/periods.ts.
--
-- NO FOREIGN KEY on priority_by. It is a broker key, matched in the portal -
-- same decision as docs/who-did-each-stage.sql.
--
-- RUN ON STAGING FIRST, then live. Four columns, all nullable. Nothing
-- existing is changed.

alter table public.deals
  add column if not exists priority_by  text,
  add column if not exists priority_why text,
  add column if not exists priority_at  timestamptz,
  add column if not exists priority_day date;

comment on column public.deals.priority_by is
  'The broker key of whoever asked for this one next. Null means nobody has. Not a join - see lib/broker-key.ts.';
comment on column public.deals.priority_why is
  'Their reason, in their own words. Required when asking - a mark with no reason is just volume, and credit cannot choose between three of them.';
comment on column public.deals.priority_at is
  'When they asked. Decides the order BETWEEN brokers: whoever asked first is served first in each round.';
comment on column public.deals.priority_day is
  'The Sydney day the ask is for. A slot is one per broker per day and resets overnight whether or not it was used.';

-- ONE LIVE ASK PER BROKER PER DAY, HELD BY THE DATABASE AND NOT ONLY BY THE
-- SCREEN. A broker with two tabs open could otherwise mark two deals and take
-- two slots, which is the whole thing this is meant to stop.
create unique index if not exists deals_one_priority_per_broker_per_day
  on public.deals (priority_by, priority_day)
  where priority_by is not null and priority_day is not null;

create index if not exists deals_priority_day_idx
  on public.deals (priority_day)
  where priority_day is not null;

-- A CHECK OF WHAT YOU JUST RAN. Expect 4 and 1.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'deals'
      and column_name like 'priority\_%') as new_columns,
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'deals_one_priority_per_broker_per_day') as the_one_each_rule;
