-- UNDO: brokers planning their day.
--
-- Takes the broker half back out. The credit team's plans are untouched by
-- every line of this.
--
-- RUN IT IN THIS ORDER. The brokers' rows have to go before officer_id can be
-- made compulsory again, because those rows are exactly the ones without one.

delete from public.daily_plans where broker_key is not null;

drop index if exists public.daily_plans_broker_day;

alter table public.daily_plans drop column if exists broker_key;

alter table public.daily_plans alter column officer_id set not null;
