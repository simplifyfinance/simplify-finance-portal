-- Answers to the statement worklist (31 Aug 2026)
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- One row per answer. Kept against the DEAL, not the upload, so an answer
-- survives new statements being loaded and re-analysed — the whole point is that
-- a question already answered is never asked twice. upload_id is recorded for
-- provenance so it is possible to see that an answer predates the current file.
--
-- These are file notes for the credit team. Nothing here is passed to the AI or
-- written into an LO or compliance document.

create table if not exists public.deal_statement_answers (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  upload_id    uuid references public.deal_statement_uploads(id) on delete set null,
  item_key     text not null,
  reason_id    text not null,
  reason_label text not null,
  note         text,
  answered_by  text,
  answered_at  timestamptz not null default now()
);

create index if not exists deal_statement_answers_deal_idx
  on public.deal_statement_answers (deal_id, item_key, answered_at desc);

alter table public.deal_statement_answers enable row level security;

drop policy if exists "Statement answers via deals" on public.deal_statement_answers;
create policy "Statement answers via deals"
  on public.deal_statement_answers
  as permissive for all to authenticated
  using      (exists (select 1 from public.deals d where d.id = deal_statement_answers.deal_id))
  with check (exists (select 1 from public.deals d where d.id = deal_statement_answers.deal_id));
