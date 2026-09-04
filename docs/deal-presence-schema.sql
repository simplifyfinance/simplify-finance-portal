-- WHO ELSE IS IN THIS DEAL CARD.
--
-- One row per person per deal, rewritten every twenty seconds while their deal
-- page is open. Anybody whose row has not been touched for a minute has closed
-- the tab and stops being shown.
--
-- Fabio, 4 Sep 2026: "I like the warning saying someone is on this deal card...
-- I don't wanna lock it to the point that they can't edit, but it will say."
--
-- This LOCKS NOTHING. It is read to draw a banner and for no other purpose. The
-- only thing that ever refuses a write is the save guard in lib/save-conflict.ts,
-- and only at the moment somebody's work would actually be lost.
--
-- The tab matters: each tab writes its own jsonb column, so two people on
-- different tabs cannot touch each other's work. The banner says which tab, so
-- the usual answer is "you two are fine".
--
-- Safe to run twice. Nothing already stored is touched.

create table if not exists deal_presence (
  deal_id    uuid not null references deals(id) on delete cascade,
  user_id    uuid not null,
  full_name  text,
  tab        text,
  last_seen  timestamptz not null default now(),
  primary key (deal_id, user_id)
);

create index if not exists deal_presence_deal_idx on deal_presence (deal_id, last_seen desc);

alter table deal_presence enable row level security;

-- Everybody signed in can see who is in a deal, and write only their own row.
-- Presence is not sensitive - it is a name and a tab - and the whole point is
-- that colleagues can see each other.
drop policy if exists deal_presence_read on deal_presence;
create policy deal_presence_read on deal_presence
  for select to authenticated using (true);

drop policy if exists deal_presence_write_own on deal_presence;
create policy deal_presence_write_own on deal_presence
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists deal_presence_update_own on deal_presence;
create policy deal_presence_update_own on deal_presence
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists deal_presence_delete_own on deal_presence;
create policy deal_presence_delete_own on deal_presence
  for delete to authenticated using (user_id = auth.uid());

comment on table deal_presence is
  'Advisory only. Who has a deal card open, refreshed every 20s, stale after 60s. Locks nothing.';
