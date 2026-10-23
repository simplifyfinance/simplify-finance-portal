-- THE DAY A CREDIT ASSESSOR AGREED TO.
--
-- 22 Oct 2026. One row per person per day. The portal drafts the list; this
-- records what they actually agreed to and when they agreed it.
--
-- WHY THE ORDER IS STORED. The draft can be worked out again at any time, but
-- what somebody agreed to at 8:35 cannot - a deal that arrives at 10am would
-- rewrite history. The agreed order is a fact about the morning.
--
-- RUN THIS ON STAGING FIRST, then live. It creates one table and touches
-- nothing that exists.

create table if not exists public.daily_plans (
  id            uuid primary key default gen_random_uuid(),
  officer_id    uuid not null references public.credit_officers(id) on delete cascade,
  plan_date     date not null,
  -- The deals, in the order they will be worked. Order matters, so an array
  -- rather than a join table.
  deal_ids      uuid[] not null default '{}',
  -- Null until they press "Yes - this is my day". The timestamp IS the
  -- enforcement: it is what the board shows and what nobody wants empty.
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (officer_id, plan_date)
);

create index if not exists daily_plans_date_idx on public.daily_plans (plan_date desc);

alter table public.daily_plans enable row level security;

-- EVERY SIGNED IN PERSON CAN READ EVERY PLAN. That is the point - the brokers
-- see all three, and so does everybody else. Nothing in here is client data.
drop policy if exists "signed in can read plans" on public.daily_plans;
create policy "signed in can read plans"
  on public.daily_plans for select
  to authenticated
  using (true);

-- AND WRITE THEM. The portal decides whose plan is whose; the lock here is
-- only that you are signed in. Deliberately not 'public' - see the four doors
-- closed on 22 Oct 2026.
drop policy if exists "signed in can write plans" on public.daily_plans;
create policy "signed in can write plans"
  on public.daily_plans for insert
  to authenticated
  with check (true);

drop policy if exists "signed in can update plans" on public.daily_plans;
create policy "signed in can update plans"
  on public.daily_plans for update
  to authenticated
  using (true)
  with check (true);
