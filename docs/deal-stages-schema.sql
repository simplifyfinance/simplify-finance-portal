-- Three more stages, and a place to remember folded board columns.
-- Run in the Supabase SQL editor. Safe to run twice.
--
-- WHY
--
-- Offer accepted was a whole process inside Preapproved that the board could not
-- see: a client whose offer on a property had been accepted - with a price and a
-- settlement date - looked identical to a client still house hunting.
--
-- Contracts returned and Settlement booked were `settlement_step`, ONE column
-- holding ONE of them, with no date, visible only inside the Settlement panel.
-- Three things were wrong with that. They are not exclusive - a deal can have
-- its contracts back and its settlement booked. Nothing recorded WHEN either
-- happened, so loan docs could sit returned for three weeks unnoticed. And on
-- the board those deals looked exactly like a deal formally approved this
-- morning.
--
-- settlement_step is kept and still written, because the settlements board reads
-- it for its chip. It now holds the FURTHEST of the two.

alter table deals add column if not exists offer_accepted_at      timestamptz;
alter table deals add column if not exists contracts_returned_at  timestamptz;
alter table deals add column if not exists settlement_booked_at   timestamptz;

-- Which board columns this person has folded away. Per person: a fold is a view,
-- never a setting, and one person hiding a column must not hide it for anybody
-- else. An empty array, or no column at all, means nothing is folded.
alter table user_profiles add column if not exists board_folds jsonb not null default '[]'::jsonb;

-- The backfill.
--
-- Deals already carrying a step get a date, taken from when the settlement team
-- last touched the record. That is the closest thing to the truth that exists -
-- the step itself was never dated - and it is better than leaving these deals
-- sitting in Formal on a board that now has a column for exactly where they are.
--
-- Only the step actually recorded is filled in. A deal marked 'settlement_booked'
-- does NOT get a contracts_returned_at: the old field could only hold one of the
-- two, so we do not know whether the contracts came back, and inventing a date
-- for a thing nobody recorded is how a board starts lying.
update deals
   set contracts_returned_at = coalesce(settlement_updated_at, formal_approval_at, lodged_at)
 where settlement_step = 'contracts_returned'
   and contracts_returned_at is null;

update deals
   set settlement_booked_at = coalesce(settlement_updated_at, formal_approval_at, lodged_at)
 where settlement_step = 'settlement_booked'
   and settlement_booked_at is null;

-- What the backfill did, and what is now on the board.
select settlement_step,
       count(*)                                              as deals,
       count(contracts_returned_at)                          as have_contracts_date,
       count(settlement_booked_at)                           as have_booked_date
  from deals
 where settled_at is null
 group by settlement_step
 order by settlement_step nulls first;
