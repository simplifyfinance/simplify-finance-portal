-- ============================================================================
-- THE LOAN, AS IT ACTUALLY IS ONCE AN OFFER IS ACCEPTED.
--
-- Run in the Supabase SQL editor. STAGING FIRST, then LIVE.
-- Safe to run twice: everything is "if not exists". Nothing is deleted and no
-- existing data is changed.
--
-- 21 October 2026.
--
-- ---------------------------------------------------------------------------
-- WHY THESE COLUMNS EXIST AT ALL
-- ---------------------------------------------------------------------------
--
-- Belle, working a real deal on 21 Oct 2026: "Can we please add a bit to
-- include the new rate - most cases that will change if the LVR position is
-- different or rates go up or down."
--
-- She was right and there was nothing to add it to. The offer accepted step
-- records the price, the deposit, the duty and the loan AMOUNT - because the
-- lender's repricing rule needs the amount - and nothing about the loan itself.
-- The rate, the product, the term and the repayment type existed in one place
-- only: the lending option the PRE-APPROVAL was built on.
--
-- So the offer accepted email, which quotes a rate to a client in writing, had
-- to read the pre-approval's product. On a deal where the price moved and the
-- LVR with it, that is the wrong rate in front of a client.
--
-- ---------------------------------------------------------------------------
-- THE LENDING OPTION IS NOT TOUCHED, AND IS NOT COMPARED WITH
-- ---------------------------------------------------------------------------
--
-- Fabio, 21 Oct 2026: "NEVER care of LO says remeber the figures will almost
-- always be diffeerent! we dont care we care how we move forward to updating
-- details not the LO."
--
-- These columns are seeded from the lending option as a starting point and are
-- the answer from then on. Nothing reports the difference and nothing warns
-- about it: the figures moving is the normal case, not a fault.
--
-- The repricing check on the same panel is a different thing and is unchanged.
-- It compares the old loan AMOUNT with the new one because that is the
-- lender's own rule - St George's ten percent - and it has nothing to do with
-- these columns.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT HERE
-- ---------------------------------------------------------------------------
--
-- The monthly repayment. It is worked out from the loan amount, the rate and
-- the term in these columns, every time it is read - see lib/the-loan-now.ts.
-- Stored, it would be a fourth copy of a figure that is already decided by
-- three others, free to disagree with them the moment one is edited.
-- ============================================================================

alter table public.deals
  -- The product the loan is actually going on. "Flex Home Loan".
  add column if not exists offer_product text,

  -- The rate as a number of percent: 6.74. Not "6.74%" and not 0.0674 - the
  -- same shape as every other rate in this database.
  add column if not exists offer_rate numeric(6,3),

  -- Years. 30.
  add column if not exists offer_term_years int,

  -- "Interest only" or "Principal and interest", in the words the rest of the
  -- portal already uses so nothing has to translate.
  add column if not exists offer_repayment_type text,

  -- Only meaningful on interest only. Null on P&I rather than zero, which
  -- would read as "interest only for no years".
  add column if not exists offer_io_years int;

comment on column public.deals.offer_rate is
  'The rate once the offer is accepted. Seeded from the lending option, then '
  'the answer. The client email and the handover read this, not the pre-approval.';

comment on column public.deals.offer_io_years is
  'Null on principal and interest. Zero would read as interest only for no years.';


-- ===========================================================================
-- DID IT WORK
-- ===========================================================================

select 'the five columns exist' as what, count(*) as how_many, 5 as expected
from information_schema.columns
where table_schema = 'public' and table_name = 'deals'
  and column_name in ('offer_product', 'offer_rate', 'offer_term_years',
                      'offer_repayment_type', 'offer_io_years')
union all
-- Must be zero on the day this runs: nothing has been recorded yet, and a
-- number here would mean these columns already existed holding something else.
select 'deals already carrying a rate (expect 0 today)', count(*), 0
from public.deals where offer_rate is not null;
