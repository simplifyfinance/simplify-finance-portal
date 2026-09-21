-- MARKING A DEAL AS A TEST
--
-- 21 September 2026. One true/false on the deals table, defaulting to false.
--
-- RUN IT ON STAGING FIRST, THEN ON PRODUCTION. It is the same file both times.
--
-- Adding a true/false that defaults to false cannot alter a single existing row
-- and cannot break a single existing query: every deal you already have reads
-- as a real deal, so there is nothing to convert. Nothing is dropped, nothing
-- is deleted, and it is safe to run twice.
--
-- THE CODE THAT READS THIS COLUMN MUST NOT SHIP BEFORE THE COLUMN EXISTS.
-- Screens filter on is_test, and a query naming a column that is not there
-- fails outright - it does not quietly return everything. Column first, in both
-- databases, then the deploy.

-- ----------------------------------------------------------------------
-- 1. The column
-- ----------------------------------------------------------------------
alter table public.deals
  add column if not exists is_test boolean not null default false;

comment on column public.deals.is_test is
  'A deal made to try something out, not a client. It is counted nowhere, its client emails come to the person testing instead of the client, and it never writes a lender rate observation. lib/test-deal.ts is the single rule; every screen asks it rather than deciding for itself.';

-- Most deals are real, so the index only carries the test ones. It stays tiny
-- however large the book gets.
create index if not exists deals_is_test_idx
  on public.deals (is_test) where is_test;

-- ----------------------------------------------------------------------
-- 2. The pipeline register stops reporting test deals
--
-- Every other screen filters in the code, where it can be read and tested. The
-- pipeline is the one that cannot: it reads this function, and the function
-- decides what a screen never sees. So the rule goes in here too.
--
-- This is the same function that is there now with one line added - the
-- "d.is_test = false" in the where clause. Nothing else about it changes.
-- ----------------------------------------------------------------------
create or replace function public.pipeline_register()
 returns table(deal_id uuid, deal_name text, assigned_broker text, lender text,
               loan_amount text, expected_upfront text, lodged_at text,
               preapproval_at text, formal_approval_at text, settled_at text,
               lodged_date text, lodged_total text, lodged_lender text,
               lodged_splits jsonb, formal_date text, formal_total text,
               formal_lender text, settled_date text, settled_total text,
               settled_lender text, settled_splits jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- Deliberately narrow. Every team member may read this register for every
  -- deal, so it returns only what the lodged and settled views display and
  -- never touches bc_data, lo_data, fact_find_data or compliance_data.
  select
    d.id,
    d.deal_name,
    d.assigned_broker,
    d.lender,
    d.loan_amount::text,
    d.expected_upfront::text,
    d.lodged_at::text,
    d.preapproval_at::text,
    d.formal_approval_at::text,
    d.settled_at::text,
    l.effective_date::text, l.total_amount::text, l.lender, l.splits,
    f.effective_date::text, f.total_amount::text, f.lender,
    s.effective_date::text, s.total_amount::text, s.lender, s.splits
  from public.deals d
  left join public.deal_stage_snapshots l on l.deal_id = d.id and l.stage = 'lodged'
  left join public.deal_stage_snapshots f on f.deal_id = d.id and f.stage = 'formal'
  left join public.deal_stage_snapshots s on s.deal_id = d.id and s.stage = 'settled'
  where d.is_test = false
    and (d.lodged_at is not null
     or d.settled_at is not null
     or l.deal_id is not null
     or s.deal_id is not null)
$function$;

-- ----------------------------------------------------------------------
-- 3. Read back what you just did
-- ----------------------------------------------------------------------
select
  (select count(*) from public.deals)                     as deals_in_the_book,
  (select count(*) from public.deals where is_test)       as marked_as_test,
  (select count(*) from public.deals where not is_test)   as real_deals;
