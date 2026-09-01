-- The deal board: one canonical phase (1 Sep 2026)
-- Run in the Supabase SQL editor. Read step 2 before running step 3.
--
-- Pushing compliance to SalesTrekker used to set status = 'completed', and the
-- deals list hides anything completed. So a loan vanished the moment compliance
-- went out — before it was lodged, approved or settled. On 1 Sep 2026 that was
-- NINE of twenty-one deals, none of them lodged, the oldest eight business days
-- old, with no way to tell a loan progressing nicely from one that had fallen over.
--
-- A deal is now finished when it SETTLES or when it DIES. Nothing else is an ending.

-- 1. When compliance actually went out.
alter table public.deals
  add column if not exists compliance_sent_at timestamptz;

-- 2. LOOK FIRST. Every deal the old rule marked completed. These are the nine.
--    They are about to reappear on the board in the "Compliance sent" column.
select deal_name,
       compliance_completed_at::date as compliance_done,
       lodged_at::date, preapproval_at::date, formal_approval_at::date, settled_at::date
from public.deals
where status = 'completed'
order by compliance_completed_at;

-- 3. Backfill. The date compliance was finished is the best record we have of when
--    it was sent — they happened in the same action.
update public.deals
set compliance_sent_at = coalesce(compliance_sent_at, compliance_completed_at)
where status = 'completed'
  and compliance_completed_at is not null;

-- 4. Retire the status. A deal that genuinely settled keeps its settled_at and is
--    read as settled from that; nothing else was ever really complete.
update public.deals
set status = 'in_progress'
where status = 'completed'
  and settled_at is null;

-- 5. Check. Nine deals should now carry a compliance_sent_at and no longer be
--    hidden, and nothing should still be sitting on the retired status.
select
  count(*) filter (where compliance_sent_at is not null) as compliance_sent,
  count(*) filter (where status = 'completed')           as still_completed,
  count(*) filter (where status = 'lost')                as lost,
  count(*) filter (where settled_at is not null)         as settled
from public.deals;
