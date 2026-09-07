-- THE PORTAL REMEMBERS WHAT IT REPLACED.
--
-- Alexis_Janes_INV_Preapp_2026, 7 Sep 2026. A finished BC was replaced by an
-- almost empty one. The work was not recoverable from anywhere: the daily backup
-- was taken hours before it was typed, point in time recovery is not on the
-- plan, and every save in this portal overwrites what was there with no copy
-- kept. Fabio: "I cannot have the basic data be lost moving forward."
--
-- That was the real hole. Not the bug that emptied the form - the fact that ONE
-- bad save was permanent. Nothing else in this codebase can promise that a save
-- is always correct. This can promise that a wrong one costs a minute.
--
-- Every whole-record save writes the version it is about to replace in here
-- first. The record itself carries on being the single live copy; this is the
-- pile of everything it used to be.
--
-- IT DOES NOT KEEP EVERY KEYSTROKE. The tabs autosave a second after any change,
-- so keeping all of them would be tens of thousands of near identical rows. It
-- keeps a version every few minutes, and ALWAYS keeps one when a save is about
-- to remove content - which is the only case anybody ever wants back.
--
-- Safe to run twice. Nothing already stored is touched.

create table if not exists deal_history (
  id            bigserial primary key,
  deal_id       uuid not null references deals(id) on delete cascade,
  -- 'bc_data', 'fact_find_data', 'lo_data', 'compliance_data'.
  column_name   text not null,
  -- What the record held BEFORE the save that created this row.
  data          jsonb,
  -- Roughly how much was filled in, so a person scanning the list can see at a
  -- glance which version is the full one. Written by the app, not computed here,
  -- so it counts the same way the app does.
  filled        integer,
  replaced_at   timestamptz not null default now(),
  replaced_by   uuid,
  replaced_by_name text
);

create index if not exists deal_history_deal_idx
  on deal_history (deal_id, column_name, replaced_at desc);

alter table deal_history enable row level security;

-- Everybody signed in can read the history of a deal and add to it. It is the
-- same information as the deal itself, one step older.
drop policy if exists deal_history_read on deal_history;
create policy deal_history_read on deal_history
  for select to authenticated using (true);

drop policy if exists deal_history_write on deal_history;
create policy deal_history_write on deal_history
  for insert to authenticated with check (true);

comment on table deal_history is
  'What each deal tab held before it was last saved over. Written by lib/deal-history.ts on every whole-record save. Nothing here is ever read by the app automatically - it exists so a lost afternoon costs a minute.';
