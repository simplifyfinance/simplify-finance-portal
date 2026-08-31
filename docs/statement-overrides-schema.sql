-- Overruling a line in the Audit tab (31 Aug 2026)
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- The Audit tab was read-only, which made it half a tool: you could see that a
-- figure was wrong and then had to come back to have the code changed. These are
-- the corrections a person makes on the line itself.
--
-- `signature` is what the line IS — same day, same wording, same cents — so a
-- correction is not lost when a client re-sends their statements and CashDeck
-- renumbers the rows.
--
-- Standing "always treat this payer this way" rules live in
-- settings.statement_payer_rules, not here, because they apply to every client
-- and have to be visible and removable in one place.

create table if not exists public.deal_statement_overrides (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  upload_id   uuid references public.deal_statement_uploads(id) on delete set null,
  external_id text,
  signature   text,
  treat_as    text not null,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists deal_statement_overrides_deal_idx
  on public.deal_statement_overrides (deal_id, external_id);

alter table public.deal_statement_overrides enable row level security;

drop policy if exists "Statement overrides via deals" on public.deal_statement_overrides;
create policy "Statement overrides via deals"
  on public.deal_statement_overrides
  as permissive for all to authenticated
  using      (exists (select 1 from public.deals d where d.id = deal_statement_overrides.deal_id))
  with check (exists (select 1 from public.deals d where d.id = deal_statement_overrides.deal_id));

-- Standing corrections, applied to every file.
alter table public.settings
  add column if not exists statement_payer_rules jsonb;
