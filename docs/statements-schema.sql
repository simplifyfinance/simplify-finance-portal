-- Statement analysis: two tables, run once in the Supabase SQL editor.
--
-- These hold client banking data. Visibility is not decided here twice: each
-- policy asks whether the signed-in user can see the deal, and the deals policy
-- answers. Row level security on deals applies inside that subquery, so a person
-- who cannot open a deal cannot read a single line of its statements.
--
-- Everything cascades from the deal. Deleting a deal deletes its statements.

create table if not exists public.deal_statement_uploads (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references public.deals(id) on delete cascade,
  file_name         text not null,
  source            text not null default 'cashdeck',
  uploaded_by       uuid references auth.users(id) on delete set null,
  uploaded_by_email text,
  uploaded_at       timestamptz not null default now(),
  client_name       text,
  period_from       date,
  period_to         date,
  days              integer,
  txn_count         integer,
  institutions      jsonb not null default '[]'::jsonb,
  accounts          jsonb not null default '[]'::jsonb,
  coverage_complete boolean,
  score             integer,
  analysis_version  integer not null default 1,
  analysis          jsonb not null default '{}'::jsonb
);

create table if not exists public.deal_statement_transactions (
  id               uuid primary key default gen_random_uuid(),
  upload_id        uuid not null references public.deal_statement_uploads(id) on delete cascade,
  deal_id          uuid not null references public.deals(id) on delete cascade,
  external_id      text,
  txn_date         date not null,
  description      text,
  merchant         text,
  account_number   text,
  account_name     text,
  institution      text,
  category         text,
  summary_category text,
  category_type    text,
  amount           numeric(14,2) not null
);

create index if not exists deal_statement_uploads_deal_idx
  on public.deal_statement_uploads (deal_id, uploaded_at desc);
create index if not exists deal_statement_txn_upload_idx
  on public.deal_statement_transactions (upload_id, txn_date);
create index if not exists deal_statement_txn_deal_idx
  on public.deal_statement_transactions (deal_id, txn_date);

alter table public.deal_statement_uploads      enable row level security;
alter table public.deal_statement_transactions enable row level security;

drop policy if exists "Statement uploads via deals" on public.deal_statement_uploads;
create policy "Statement uploads via deals"
  on public.deal_statement_uploads
  as permissive for all to authenticated
  using      (exists (select 1 from public.deals d where d.id = deal_statement_uploads.deal_id))
  with check (exists (select 1 from public.deals d where d.id = deal_statement_uploads.deal_id));

drop policy if exists "Statement transactions via deals" on public.deal_statement_transactions;
create policy "Statement transactions via deals"
  on public.deal_statement_transactions
  as permissive for all to authenticated
  using      (exists (select 1 from public.deals d where d.id = deal_statement_transactions.deal_id))
  with check (exists (select 1 from public.deals d where d.id = deal_statement_transactions.deal_id));
