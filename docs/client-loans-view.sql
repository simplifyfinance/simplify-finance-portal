-- ============================================================================
-- ONE ROW PER LOAN.
--
-- Run in the Supabase SQL editor. Run it on LIVE and on STAGING.
-- Safe to run twice. It creates a VIEW and nothing else - no table, no data,
-- nothing deleted, nothing copied.
--
-- 23 September 2026. Already run on live.
--
-- WHY A VIEW AND NOT A TABLE.
--
-- Everything a segmentation question needs is already on the client record, in
-- `position_properties` and `position_liabilities`. A table would mean a second
-- copy, a second write path, and a day when the two disagree and nobody knows
-- which is right. A view cannot drift: it is the same data read a different
-- way, correct the instant a position is saved.
--
-- WHY NO HELPER FUNCTIONS.
--
-- The first version of this used two small functions for the money and the
-- dates. The Supabase SQL editor splits a statement on the semicolons inside a
-- function body and refused the whole file. The conversions are written inline
-- below instead - uglier to read, and it pastes.
--
-- WHAT IT IS FOR.
--
-- "Who is with ubank." "Who has a personal loan." "Whose fixed rate runs out
-- before Christmas." Each of those meant loading the whole book into a browser
-- and unpacking it in Javascript, which is what the Reports page does and why
-- it broke on a value with a comma in it. Here they are one line of SQL each.
--
-- MONEY IS STORED AS TYPED, WITH THE COMMAS. '620,000'::numeric throws, and
-- Number('620,000') is NaN - both have already cost a screen. Every figure
-- below is converted in a way that gives a number when it can and NOTHING when
-- it cannot. Never a wrong number, never an error that takes the query down.
--
-- security_invoker IS NOT OPTIONAL. A view runs with its creator's privileges
-- by default, which would hand every broker the entire book straight around the
-- policies on `clients`. With it, nobody sees a row they could not already see.
-- ============================================================================

drop view if exists public.client_loans;

create view public.client_loans
with (security_invoker = true)
as
with raw as (
  select
    c.id                              as client_id,
    c.first_name,
    c.last_name,
    c.position_updated_from_deal_id   as from_deal_id,
    c.position_source,
    c.position_updated_at             as as_at,
    'property'::text                  as held_against,
    l->>'lenderName'                  as lender_t,
    coalesce(nullif(trim(l->>'mortgageType'), ''), 'Home loan') as loan_type_t,
    p->>'ownershipType'               as purpose_t,
    p->>'address'                     as security_t,
    p->>'value'                       as security_value_t,
    l->>'balance'                     as balance_t,
    l->>'limitAmount'                 as limit_t,
    l->>'interestRate'                as rate_t,
    l->>'rateType'                    as rate_type_t,
    l->>'repaymentType'               as repayment_type_t,
    l->>'fixedRateExpiryDate'         as fixed_t,
    l->>'interestOnlyExpiryDate'      as io_t,
    l->>'status'                      as status_t
  from public.clients c
  cross join lateral jsonb_array_elements(coalesce(c.position_properties, '[]'::jsonb)) p
  cross join lateral jsonb_array_elements(coalesce(p->'loans',            '[]'::jsonb)) l

  union all

  select
    c.id, c.first_name, c.last_name,
    c.position_updated_from_deal_id, c.position_source, c.position_updated_at,
    'unsecured'::text,
    li->>'lenderName',
    coalesce(nullif(trim(li->>'liabilityType'), ''), 'Liability'),
    null, null, null,
    li->>'balance',
    li->>'limitAmount',
    null, null, null, null, null,
    li->>'status'
  from public.clients c
  cross join lateral jsonb_array_elements(coalesce(c.position_liabilities, '[]'::jsonb)) li
)
select
  client_id, first_name, last_name, from_deal_id, position_source, as_at, held_against,
  nullif(trim(lender_t), '')           as lender,
  loan_type_t                          as loan_type,
  nullif(trim(purpose_t), '')          as purpose,
  nullif(trim(security_t), '')         as security_address,
  case when regexp_replace(coalesce(security_value_t, ''), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
       then regexp_replace(security_value_t, '[^0-9.-]', '', 'g')::numeric end as security_value,
  case when regexp_replace(coalesce(balance_t, ''), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
       then regexp_replace(balance_t, '[^0-9.-]', '', 'g')::numeric end        as balance,
  case when regexp_replace(coalesce(limit_t, ''), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
       then regexp_replace(limit_t, '[^0-9.-]', '', 'g')::numeric end          as limit_amount,
  case when regexp_replace(coalesce(rate_t, ''), '[^0-9.-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
       then regexp_replace(rate_t, '[^0-9.-]', '', 'g')::numeric end           as interest_rate,
  nullif(trim(rate_type_t), '')        as rate_type,
  nullif(trim(repayment_type_t), '')   as repayment_type,
  case when coalesce(fixed_t, '') ~ '^\d{4}-\d{2}-\d{2}' then substring(fixed_t from 1 for 10)::date end as fixed_expiry,
  case when coalesce(io_t, '')    ~ '^\d{4}-\d{2}-\d{2}' then substring(io_t    from 1 for 10)::date end as interest_only_expiry,
  nullif(trim(status_t), '')           as status
from raw;


-- ----------------------------------------------------------------------------
-- WHAT IT CAN NOW ANSWER. Reads only - run any of these whenever.
-- ----------------------------------------------------------------------------

-- Who is with each lender, and how much.
--   select lender, count(*) as loans, sum(balance) as balance
--   from client_loans where lender is not null group by lender order by balance desc nulls last;

-- Everyone with a personal loan.
--   select first_name, last_name, lender, balance
--   from client_loans where loan_type ilike '%personal%';

-- Whose fixed rate runs out in the next six months - the call list.
--   select first_name, last_name, lender, balance, interest_rate, fixed_expiry
--   from client_loans
--   where fixed_expiry between current_date and current_date + interval '6 months'
--   order by fixed_expiry;

-- Does it work at all.
select
  count(*)                                          as loan_rows,
  count(*) filter (where held_against = 'property')  as secured,
  count(*) filter (where held_against = 'unsecured') as unsecured,
  count(distinct client_id)                          as clients,
  count(distinct lender)                             as lenders,
  count(*) filter (where fixed_expiry is not null)   as with_a_fixed_expiry
from public.client_loans;
