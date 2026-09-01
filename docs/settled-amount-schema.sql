-- Lodged and settled amounts get their own boxes, and the existing deals are
-- repaired from the snapshots that already hold the truth.
-- Fabio, 1 Sep 2026. Run in the Supabase SQL editor.
--
-- WHY: a loan's amount changes all the way along - BC, LO, compliance, lodged,
-- formal. Two of those are kept forever: what was LODGED and what SETTLED.
-- Commission is paid on what settled.
--
-- What was actually happening: all three of Mark as lodged, Mark as settled and
-- the Lending options autosave wrote the same single column, loan_amount.
-- Whichever ran last won. The LO autosave had no dirty flag either, so merely
-- OPENING the Lending options tab on a settled deal replaced what settled with
-- the old estimate 700 milliseconds later - and every screen that reports
-- settled volume falls through to loan_amount, so all of them would have
-- silently changed.
--
-- The four columns below are read in eight places (the pipeline, broker targets,
-- monthly actuals, the settlements list, the commission panel, the reconcile
-- screen, amountOf and the commission calculation) and were written in none.

-- 1. The boxes.
alter table deals add column if not exists lodged_total   numeric;
alter table deals add column if not exists lodged_splits  jsonb;
alter table deals add column if not exists settled_total  numeric;
alter table deals add column if not exists settled_splits jsonb;

-- 2. The repair. Every Mark as lodged and Mark as settled already wrote a
--    snapshot with the real total and every split, so nothing was ever lost -
--    no screen was reading it. Copying it onto the deal fills the columns that
--    every reader prefers, which also CORRECTS any deal whose loan_amount was
--    already overwritten by an opened LO.
update deals d
set lodged_total  = s.total_amount,
    lodged_splits = s.splits
from deal_stage_snapshots s
where s.deal_id = d.id
  and s.stage = 'lodged'
  and d.lodged_total is null;

update deals d
set settled_total  = s.total_amount,
    settled_splits = s.splits
from deal_stage_snapshots s
where s.deal_id = d.id
  and s.stage = 'settled'
  and d.settled_total is null;

-- 3. What the repair did. Any row where these disagree was a deal displaying
--    the wrong amount until a moment ago.
select d.deal_name,
       d.lodged_total,
       d.settled_total,
       d.loan_amount,
       d.settled_total - d.loan_amount as was_out_by
from deals d
where d.settled_total is not null
  and d.settled_total is distinct from d.loan_amount
order by abs(d.settled_total - d.loan_amount) desc;
