-- ===========================================================================
-- THE ACCURACY CHECK: THE SIX WAYS A NUMBER GOES WRONG
-- ===========================================================================
--
-- 23 Nov 2026. Fabio: "we're building a portal that we rely on data to run the
-- business... I hate finding these things along the way, because then the data
-- that I'm managing my business is incorrect."
--
-- The security audit asks one question - what can somebody reach without
-- logging in - and asks it of every route into the database. This is the same
-- idea for figures. It asks one question: HOW CAN A NUMBER ON SCREEN BE WRONG
-- WHILE EVERYTHING LOOKS FINE, and asks it of every way that happens.
--
-- There are six. Every one has happened in this portal or come close.
--
--   1. TRUNCATION. The server sends 1,000 rows and says nothing about the
--      rest. 2 Nov 2026: two deal cards could not be found - 1,165 deals, the
--      newest thousand returned. 23 Nov 2026: Portfolio Review's plan built
--      from 1,000 of 8,700 trail lines.
--      -> CHECK 16 of docs/weekly-audit.sql, and docs/do-the-numbers-match.sql
--
--   2. A WRITE REFUSED IN SILENCE. Postgres returns zero rows and no error
--      when a policy blocks a save. The screen says "Saved". Belle's folded
--      columns did this for weeks.
--      -> lib/checked-write.ts and its test, at build time
--
--   3. A JOIN THAT QUIETLY DROPS ROWS. Joining on a column that is null for
--      some records. 23 Nov 2026: a portfolio review from the book import had
--      no client_id, so a join on it returned nothing at all.
--      -> SECTION 3 BELOW
--
--   4. A JOIN THAT QUIETLY DOUBLES ROWS. One deal with two snapshots counted
--      twice. The total comes out high and looks plausible.
--      -> SECTION 4 BELOW
--
--   5. A MISSING VALUE SUMMED AS ZERO. A loan with no balance recorded becomes
--      $0 in a total. Nothing looks broken.
--      -> SECTION 5 BELOW
--
--   6. A DATE IN THE WRONG MONTH. The database is UTC, the business is Sydney.
--      A settlement at 9am on the 1st is the previous month in UTC, so a
--      month-end figure moves.
--      -> SECTION 6 BELOW
--
-- Run it in the SQL editor. It writes nothing. Send Claude any line that does
-- not say OK.

select area, what, found, verdict from (

-- ---------------------------------------------------------------------------
-- 3. ROWS THAT A JOIN WOULD DROP
-- ---------------------------------------------------------------------------
-- A null key is not a small problem. The row does not come back short - it does
-- not come back at all, and no total mentions it.

select 'Dropped by a join' as area,
       'portfolio reviews with no client attached' as what,
       (select count(*) from portfolio_reviews where client_id is null)::text as found,
       'these vanish from any screen that joins reviews to clients' as verdict

union all
select 'Dropped by a join', 'deals with no client attached',
       (select count(*) from deals where client_id is null)::text,
       'these vanish from any client-based total'

union all
select 'Dropped by a join', 'commission lines with no lender matched',
       (select count(*) from commission_lines where lender_id is null)::text,
       'these vanish from any per-lender figure'

union all
select 'Dropped by a join', 'commission lines whose loan is in no review',
       (select count(*) from commission_lines cl
         where cl.loan_ref is not null
           and not exists (select 1 from portfolio_review_properties p
                            where p.loan_ref = cl.loan_ref))::text,
       'trail that belongs to no property on any review'

union all
select 'Dropped by a join', 'deals with no broker assigned',
       (select count(*) from deals
         where assigned_broker is null or btrim(assigned_broker) = '')::text,
       'these are invisible to every per-broker figure, and to the rules'

-- ---------------------------------------------------------------------------
-- 4. ROWS A JOIN WOULD COUNT TWICE
-- ---------------------------------------------------------------------------
-- Fan-out. One row on the left, two on the right, and every sum doubles. The
-- answer stays plausible, which is what makes it dangerous.

union all
select 'Counted twice', 'deals with more than one snapshot at a stage',
       (select count(*) from (
          select deal_id, stage from deal_stage_snapshots
          group by deal_id, stage having count(*) > 1) d)::text,
       'a per-stage total would count these deals more than once'

union all
select 'Counted twice', 'the same commission line imported twice',
       (select count(*) from (
          select broker_key, loan_ref, period_month, kind
          from commission_lines
          where loan_ref is not null
          group by 1,2,3,4 having count(*) > 1) x)::text,
       'the same month paid on the same loan, twice. Real duplicates inflate every total'

union all
select 'Counted twice', 'the same property on two reviews',
       (select count(*) from (
          select loan_ref from portfolio_review_properties
          where loan_ref is not null and btrim(loan_ref) <> ''
          group by loan_ref having count(*) > 1) x)::text,
       'one loan counted in two places - check whether that is deliberate'

-- ---------------------------------------------------------------------------
-- 5. MISSING VALUES THAT BECOME ZERO
-- ---------------------------------------------------------------------------
-- "We do not know" and "nothing" are different answers, and a sum cannot tell
-- them apart.

union all
select 'Unknown shown as nothing', 'properties with no current balance',
       (select count(*) from portfolio_review_properties
         where current_balance is null)::text,
       'these add 0 to any equity or exposure total'

union all
select 'Unknown shown as nothing', 'properties with no estimated value',
       (select count(*) from portfolio_review_properties
         where estimated_current_value is null)::text,
       'these add 0 to any LVR or usable-equity figure'

union all
select 'Unknown shown as nothing', 'settled deals with no loan amount',
       (select count(*) from deals
         where settled_at is not null and loan_amount is null)::text,
       'these add 0 to settled volume'

union all
select 'Unknown shown as nothing', 'trail lines with no balance',
       (select count(*) from commission_lines
         where kind = 'trail' and balance is null)::text,
       'these add 0 to any book balance'

-- ---------------------------------------------------------------------------
-- 6. DATES THAT COULD SIT IN THE WRONG MONTH
-- ---------------------------------------------------------------------------
-- The database is UTC and the business is Sydney, 11 hours ahead. Anything
-- recorded in the first 11 hours of a Sydney day belongs to the previous day
-- in UTC - and at a month boundary, to the previous month.

union all
select 'Wrong month', 'settlements in the UTC/Sydney gap at a month end',
       (select count(*) from deals
         where settled_at is not null
           and date_trunc('month', settled_at)
               <> date_trunc('month', settled_at at time zone 'Australia/Sydney'))::text,
       'these land in a different month depending on which clock you ask'

union all
select 'Wrong month', 'deals lodged in the same gap',
       (select count(*) from deals
         where lodged_at is not null
           and date_trunc('month', lodged_at)
               <> date_trunc('month', lodged_at at time zone 'Australia/Sydney'))::text,
       'a monthly lodgement count moves depending on the clock'

-- ---------------------------------------------------------------------------
-- 1. TRUNCATION - the headline, repeated here so one run covers all six
-- ---------------------------------------------------------------------------

union all
select 'Truncation', 'lists a screen reads in one go that are over 800 rows',
       (select count(*) from (
          select 1 from commission_lines where kind = 'upfront' having count(*) > 800
          union all select 1 from commission_lines where kind = 'clawback' having count(*) > 800
          union all select 1 from portfolio_review_properties having count(*) > 800
          union all select 1 from portfolio_reviews having count(*) > 800
          union all select 1 from commission_trail_gaps having count(*) > 800
          union all select 1 from deal_alerts where resolved_at is null having count(*) > 800
       ) n)::text,
       'at 1,000 the server starts cutting silently. Page these before then'

) rows
order by case area
           when 'Truncation' then 0
           when 'Counted twice' then 1
           when 'Dropped by a join' then 2
           when 'Unknown shown as nothing' then 3
           else 4 end,
         what;
