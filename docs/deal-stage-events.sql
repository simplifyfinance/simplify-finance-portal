-- EVERY STAGE CHANGE, KEPT, WITH WHO MADE IT.
--
-- 17 Aug 2026. Alan's reporting pack: "Stage history is mandatory. Every stage
-- change is stored with a timestamp and the user who made it, and never
-- overwritten."
--
-- The portal already dates every milestone - lodged_at, formal_approval_at and
-- the rest - and lib/deal-phase.ts turns those into which column a deal is in.
-- What they do not carry is WHO, and they can be overwritten.
--
-- WHY A TRIGGER AND NOT A FUNCTION CALL.
--
-- Those dates are written from at least six places: the board, the settlements
-- screen, the outstanding panel, the offer-accepted panel, the settlement panel
-- and the deal page. Adding a call to each one means the next screen somebody
-- builds forgets, and a history with a hole in it is worse than none - you
-- cannot tell a quiet month from a missed write.
--
-- A trigger cannot be forgotten. It fires on the table, so every writer is
-- covered including the ones that do not exist yet.

create table if not exists deal_stage_events (
  id           bigserial primary key,
  deal_id      uuid not null references deals(id) on delete cascade,
  -- The milestone column that was filled, e.g. 'formal_approval_at'. The
  -- phase name is derived from it in lib/deal-phase.ts rather than stored,
  -- so a renamed phase does not orphan its history.
  column_name  text not null,
  entered_at   timestamptz not null,
  -- Who. auth.uid() where the portal did it, null where a migration or an
  -- admin query did - which is itself worth knowing.
  changed_by   uuid,
  -- APPEND ONLY. Nothing updates or deletes a row here; see the policies.
  recorded_at  timestamptz not null default now()
);

create index if not exists deal_stage_events_deal on deal_stage_events(deal_id, entered_at);
create index if not exists deal_stage_events_col  on deal_stage_events(column_name, entered_at);

comment on table deal_stage_events is
  'Append-only record of every milestone date set on a deal, with who set it. Written by a trigger so no screen can forget. See lib/a-stage-is-a-fact.ts.';

-- THE COLUMNS THAT COUNT AS A STAGE. In the order lib/deal-phase.ts has them,
-- and nothing else - a deal has dozens of dates on it and most are not stages.
create or replace function deal_stage_columns() returns text[] as $$
  select array[
    'proceeded_at', 'lo_proceeded_at', 'compliance_sent_at',
    'lodged_at', 'outstanding_at', 'preapproval_at', 'offer_accepted_at',
    'formal_approval_at', 'contracts_returned_at', 'settlement_booked_at',
    'settled_at'
  ];
$$ language sql immutable;

create or replace function record_deal_stage_events() returns trigger as $$
declare
  col  text;
  was  timestamptz;
  now_ timestamptz;
begin
  foreach col in array deal_stage_columns() loop
    execute format('select ($1).%I, ($2).%I', col, col)
      into was, now_ using old, new;

    -- A date that appears, or one that is corrected to a different date. A
    -- date being CLEARED is a stage being undone - also a fact, also kept,
    -- which is why the row carries the new value rather than the old.
    if now_ is distinct from was and now_ is not null then
      insert into deal_stage_events (deal_id, column_name, entered_at, changed_by)
      values (new.id, col, now_, auth.uid());
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists deals_record_stage_events on deals;
create trigger deals_record_stage_events
  after update on deals
  for each row execute function record_deal_stage_events();

-- AND THE SAME ON INSERT, for a deal created with dates already on it - a
-- clone, or an import.
create or replace function record_deal_stage_events_insert() returns trigger as $$
declare
  col  text;
  now_ timestamptz;
begin
  foreach col in array deal_stage_columns() loop
    execute format('select ($1).%I', col) into now_ using new;
    if now_ is not null then
      insert into deal_stage_events (deal_id, column_name, entered_at, changed_by)
      values (new.id, col, now_, auth.uid());
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists deals_record_stage_events_insert on deals;
create trigger deals_record_stage_events_insert
  after insert on deals
  for each row execute function record_deal_stage_events_insert();

-- APPEND ONLY, ENFORCED. Anyone who can see a deal can read its history.
-- Nobody writes it by hand and nobody edits it - the trigger is the only
-- author, and it runs as definer so it is unaffected by these.
alter table deal_stage_events enable row level security;

drop policy if exists stage_events_read on deal_stage_events;
create policy stage_events_read on deal_stage_events
  for select to authenticated using (true);

-- No insert, update or delete policy exists on purpose. Without one, every
-- hand-written change is refused.

-- ---------------------------------------------------------------------------
-- BACKFILL. Every deal already in the book gets its history from the dates it
-- is already carrying. The user is null, which is honest: nobody recorded who
-- moved those deals, and writing a guess in would be worse than a blank.
-- ---------------------------------------------------------------------------
insert into deal_stage_events (deal_id, column_name, entered_at, changed_by)
select d.id, c.col, (to_jsonb(d) ->> c.col)::timestamptz, null
from deals d
cross join lateral unnest(deal_stage_columns()) as c(col)
where (to_jsonb(d) ->> c.col) is not null
  and not exists (
    select 1 from deal_stage_events e
    where e.deal_id = d.id and e.column_name = c.col
  );
