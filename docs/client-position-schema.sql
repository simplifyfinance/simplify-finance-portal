-- ============================================================================
-- THE CLIENT POSITION: THE COLUMNS AND THE POLICIES IT NEEDS.
--
-- Run in the Supabase SQL editor. Run it on LIVE and on STAGING.
--
-- It is safe to run twice. Every statement either checks first or replaces
-- something with itself. Nothing is deleted and no data is changed.
--
-- 23 September 2026.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. TWO COLUMNS THE CODE WRITES AND THE DATABASE DID NOT HAVE.
--
-- `position_source` says whether a position was taken at a settlement, at an
-- application, or when a deal was closed as lost. Without it the client page
-- can only show a date, and a date does not tell anybody whether our own loan
-- is in the figures.
--
-- `position_updated_by` is who recorded it. Anyone may edit a position, so the
-- one line that separates a correction from a typo six months later is who and
-- when.
--
-- Both were shipped in code on 22 Sep 2026 (c840cbd) with no migration behind
-- them, so every capture would have been refused on the first save.
-- ----------------------------------------------------------------------------
alter table public.clients add column if not exists position_source     text;
alter table public.clients add column if not exists position_updated_by uuid;


-- ----------------------------------------------------------------------------
-- 2. WHO MAY RECORD AND READ A POSITION HISTORY.
--
-- `client_positions` has existed since the portal was built and has never once
-- been written to, so its policies had never been exercised. Both of them found
-- a client only through `deals.client_id` - which is the FIRST applicant on a
-- deal.
--
-- On a joint deal the second applicant's client id lives inside
-- `fact_find_data->applicants`, not in `deals.client_id`. So the second person
-- on every joint deal could never have a position recorded, and could never
-- have one read back. The client page has always looked deals up both ways;
-- these policies only knew one of them.
--
-- The insert policy was also missing `auth_sees_all_deals()`, which the select
-- policy has - so somebody who can see every deal could not record a position
-- on one unless they happened to be the broker or the credit officer on it.
--
-- Both are replaced below with the same rule: find the deal either way, then
-- apply the same four role tests the rest of the portal uses.
-- ----------------------------------------------------------------------------

drop policy if exists "Position insert via clients" on public.client_positions;

create policy "Position insert via clients" on public.client_positions
for insert with check (
  exists (
    select 1 from deals d
    where (
      d.client_id = client_positions.client_id
      or d.fact_find_data->'applicants' @> jsonb_build_array(
           jsonb_build_object('clientId', client_positions.client_id::text))
    )
    and (
      auth_role() = 'admin'
      or auth_sees_all_deals()
      or (auth_role() = 'broker' and lower(d.assigned_broker) = lower(auth_broker_key()))
      or (auth_role() = 'staff'  and d.assigned_credit_officer = auth_credit_officer_id())
    )
  )
);

drop policy if exists "Position visibility via clients" on public.client_positions;

create policy "Position visibility via clients" on public.client_positions
for select using (
  exists (
    select 1 from deals d
    where (
      d.client_id = client_positions.client_id
      or d.fact_find_data->'applicants' @> jsonb_build_array(
           jsonb_build_object('clientId', client_positions.client_id::text))
    )
    and (
      auth_role() = 'admin'
      or auth_sees_all_deals()
      or (auth_role() = 'broker' and lower(d.assigned_broker) = lower(auth_broker_key()))
      or (auth_role() = 'staff'  and d.assigned_credit_officer = auth_credit_officer_id())
    )
  )
);


-- ----------------------------------------------------------------------------
-- 3. WHAT IT LOOKS LIKE NOW. Reads only.
-- ----------------------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'clients'
  and column_name in ('position_source', 'position_updated_by',
                      'position_properties', 'position_liabilities', 'position_assets',
                      'position_updated_at', 'position_updated_from_deal_id')
order by column_name;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'client_positions'
order by policyname;
