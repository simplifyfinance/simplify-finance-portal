-- WHO IS IN A DEAL, TOLD HONESTLY.
--
-- The first version of this table kept one row PER PERSON PER DEAL, deleted the
-- old row when somebody moved on, and let each browser decide who had gone
-- stale using its own clock. On 8 Sep 2026 it held twenty two rows: Ellie on
-- eight deals at once, Katie on four, one row four and a half days old. Nobody
-- had been in eight deals. The deletes were simply not landing, and the only
-- thing that ever cleared a ghost was making the person log out.
--
-- Fabio, 8 Sep 2026: "I need to understand that if Katie or anyone now changes
-- deal card is this going to register she is NOT on the deal?"
--
-- Three changes, so the answer is yes and stays yes:
--
--   1. ONE ROW PER PERSON. A person is in one deal at a time, so moving to
--      another deal OVERWRITES their row. There is nowhere for an old row to
--      live, so a leftover is not something that can fail - it is something
--      that cannot exist.
--
--   2. THE DATABASE STAMPS THE TIME, AND THE DATABASE DECIDES WHO HAS GONE.
--      Five laptops with five clocks cannot agree on what "a minute ago" means.
--      One clock can.
--
--   3. THE TABLE SWEEPS ITSELF. Every heartbeat clears anything older than a
--      day, so it can never silt up again.
--
-- Safe to run twice.

-- --- 1. one row per person ---------------------------------------------------

-- Keep only each person's most recent row before the key changes under them.
delete from deal_presence a
  using deal_presence b
 where a.user_id = b.user_id
   and a.last_seen < b.last_seen;

alter table deal_presence drop constraint if exists deal_presence_pkey;
alter table deal_presence add primary key (user_id);

-- --- 2. the heartbeat, stamped by the server ---------------------------------

create or replace function presence_beat(p_deal uuid, p_tab text, p_name text)
returns void
language plpgsql
as $$
begin
  insert into deal_presence (user_id, deal_id, full_name, tab, last_seen)
  values (auth.uid(), p_deal, p_name, p_tab, now())
  on conflict (user_id) do update
    set deal_id   = excluded.deal_id,
        full_name = excluded.full_name,
        tab       = excluded.tab,
        last_seen = now();

  -- Costs nothing and means the table can never silt up again.
  delete from deal_presence where last_seen < now() - interval '1 day';
end $$;

-- --- 3. who else is here, decided by the server clock ------------------------

create or replace function presence_others(p_deal uuid)
returns table (user_id uuid, full_name text, tab text, seconds_ago integer)
language sql
stable
as $$
  select p.user_id, p.full_name, p.tab,
         floor(extract(epoch from (now() - p.last_seen)))::integer
    from deal_presence p
   where p.deal_id = p_deal
     and p.user_id <> auth.uid()
     and p.last_seen > now() - interval '60 seconds'
   order by p.last_seen desc
$$;

-- --- leaving, when the browser gets the chance to say so ---------------------
--
-- Not relied on. A closed laptop never calls it, which is exactly why the
-- sixty second expiry above is the real mechanism. This just makes the common
-- case instant.
create or replace function presence_leave()
returns void
language sql
as $$
  delete from deal_presence where user_id = auth.uid();
$$;

grant execute on function presence_beat(uuid, text, text) to authenticated;
grant execute on function presence_others(uuid)           to authenticated;
grant execute on function presence_leave()                to authenticated;

comment on table deal_presence is
  'One row per person: which deal they have open, which tab, and when they were last really there. Stamped and expired by the server clock only - see docs/deal-presence-v2.sql. Advisory. Locks nothing.';
