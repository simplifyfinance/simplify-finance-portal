-- File notes, alerts, and the finance clause date.
-- Fabio, 1 Sep 2026. Run in the Supabase SQL editor BEFORE deploying.
--
-- Three kinds of note, split by HOW THEY END - not by how they feel:
--   pinned  never ends. It is deals.internal_notes, which already exists.
--   note    ends the moment it is written. That is deal_notes below.
--   alert   ends when somebody resolves it, or its date passes. deal_alerts.
--
-- An "urgent" tickbox nobody ever unticks turns everything red inside a month
-- and the colour stops meaning anything, so urgency has an end built into it.

-- 1. The finance clause. On a purchase this is the date the client loses their
--    deposit if finance is not approved, and the portal has never held it.
alter table deals add column if not exists finance_clause_date date;

-- 2. The file note log. Append only - nothing is ever overwritten, because the
--    history is the whole value when a lender disputes a timeline or a client
--    says nobody called them.
create table if not exists deal_notes (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deals(id) on delete cascade,
  body        text not null,
  -- 'note' typed by a person, 'system' written by the portal (lodged, unlocked).
  kind        text not null default 'note',
  author_id   uuid,
  author_name text,
  created_at  timestamptz not null default now()
);
create index if not exists deal_notes_deal_idx on deal_notes(deal_id, created_at desc);

-- 3. Alerts. An alert must have an owner and a way to close it, or it is just a
--    note in red.
create table if not exists deal_alerts (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deals(id) on delete cascade,
  title       text not null,
  owner_name  text,
  due_on      date,
  resolved_at timestamptz,
  resolved_by text,
  author_id   uuid,
  author_name text,
  created_at  timestamptz not null default now()
);
create index if not exists deal_alerts_deal_idx on deal_alerts(deal_id) where resolved_at is null;

-- 4. Row level security. Without this, both tables are readable by anyone with
--    the anon key. Visibility follows the DEAL: the subquery runs as the signed
--    in user, so the existing policies on deals decide it and there is no second
--    copy of those rules to drift.
alter table deal_notes  enable row level security;
alter table deal_alerts enable row level security;

drop policy if exists deal_notes_rw on deal_notes;
create policy deal_notes_rw on deal_notes
  for all to authenticated
  using      (exists (select 1 from deals d where d.id = deal_notes.deal_id))
  with check (exists (select 1 from deals d where d.id = deal_notes.deal_id));

drop policy if exists deal_alerts_rw on deal_alerts;
create policy deal_alerts_rw on deal_alerts
  for all to authenticated
  using      (exists (select 1 from deals d where d.id = deal_alerts.deal_id))
  with check (exists (select 1 from deals d where d.id = deal_alerts.deal_id));
