-- ===========================================================================
-- DO THE NUMBERS ON SCREEN MATCH THE DATABASE
-- ===========================================================================
--
-- 23 Nov 2026. Fabio: "we're building a portal that we rely on data to run the
-- business... I hate finding these things along the way, because then the data
-- that I'm managing my business is incorrect."
--
-- WHAT THIS IS FOR. Every figure in this portal is a query, and a query can be
-- short without saying so. Supabase sends at most 1,000 rows per read and
-- reports no error for the ones it withheld. A screen built that way renders
-- perfectly and is wrong.
--
-- This file is the second opinion. It asks the database directly, with no
-- screen in the way. Paste it in, then open the portal beside it and compare.
-- If a number differs, the screen is wrong - not the database.
--
-- HOW TO USE IT. Run it, then check these pages:
--
--   Commissions -> Trail book        months, silent loans, new loans
--   Commissions -> Missed trail      gaps
--   Commissions -> Clawback watch    upfronts, clawbacks
--   Commissions -> Settlement        upfronts, statements
--   Portfolio review                 reviews, properties
--   Reports -> LVR                   properties, named reviews
--   Deals                            real deals, unresolved alerts
--
-- It writes nothing. Run it as often as you like.
--
-- IT IS ALSO CHECK 16 OF THE MONDAY AUDIT, which warns when any of these
-- passes 800 - before the cap starts cutting, rather than after somebody
-- notices a figure looks wrong.

select section, what, rows,
       case when rows > 1000 then 'MUST BE PAGED - a single read cannot see this'
            when rows > 800  then 'approaching the 1,000 cap - page it soon'
            else 'fits in one read' end as reading
from (

select 'Trail book' as section, 'months of trail' as what,
       (select count(*) from commission_trail_months)::bigint as rows
union all
select 'Trail book', 'loans gone silent (3+ months)',
       (select count(*) from commission_trail_loan_state where months_absent >= 3)
union all
select 'Trail book', 'every loan state row',
       (select count(*) from commission_trail_loan_state)
union all
select 'Trail book', 'upfronts, used to prove a loan started',
       (select count(*) from commission_lines where kind = 'upfront')

union all
select 'Missed trail', 'trail gaps',
       (select count(*) from commission_trail_gaps)
union all
select 'Missed trail', 'gaps somebody has resolved',
       (select count(*) from commission_trail_resolved)
union all
select 'Missed trail', 'gaps with a reason recorded',
       (select count(*) from commission_trail_gone_reason)

union all
select 'Clawback watch', 'upfronts',
       (select count(*) from commission_lines where kind = 'upfront')
union all
select 'Clawback watch', 'clawbacks already taken',
       (select count(*) from commission_lines where kind = 'clawback')

union all
select 'Settlement reconcile', 'settled deals',
       (select count(*) from deals where settled_at is not null)
union all
select 'Settlement reconcile', 'upfront statements held',
       (select count(*) from commission_statements where kind = 'upfront')

union all
select 'Commissions', 'every statement',
       (select count(*) from commission_statements)
union all
select 'Commissions', 'every commission line',
       (select count(*) from commission_lines)
union all
select 'Commissions', 'trail lines',
       (select count(*) from commission_lines where kind = 'trail')
union all
select 'Commissions', 'trail lines in the last 4 months',
       (select count(*) from commission_lines
         where kind = 'trail'
           and period_month >= (select max(period_month) - interval '3 months'
                                  from commission_lines where kind = 'trail'))
union all
select 'Commissions', 'referral lines',
       (select count(*) from commission_referral_lines)
union all
select 'Commissions', 'splits',
       (select count(*) from commission_splits)

union all
select 'Portfolio review', 'reviews',
       (select count(*) from portfolio_reviews)
union all
select 'Portfolio review', 'properties',
       (select count(*) from portfolio_review_properties)
union all
select 'Portfolio review', 'contacts',
       (select count(*) from portfolio_review_contacts)

union all
select 'Deals', 'every deal',
       (select count(*) from deals)
union all
select 'Deals', 'real deals (not test)',
       (select count(*) from deals where is_test = false)
union all
select 'Deals', 'lodged or settled',
       (select count(*) from deals
         where lodged_at is not null or settled_at is not null)
union all
select 'Deals', 'unresolved alerts',
       (select count(*) from deal_alerts where resolved_at is null)
union all
select 'Deals', 'clients',
       (select count(*) from clients)

union all
select 'Lender library', 'lenders',      (select count(*) from lenders)
union all
select 'Lender library', 'policy rules', (select count(*) from lender_policy_rules)
union all
select 'Lender library', 'documents',    (select count(*) from lender_documents)

) counts
order by case when rows > 1000 then 0 when rows > 800 then 1 else 2 end,
         section, what;
