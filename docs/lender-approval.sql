-- HOW LONG AN APPROVAL STANDS, ON THE LENDER.
--
-- 17 Aug 2026. Fabio: "on the offer accepted, it doesn't know that the offer
-- accepted lasts 90 days. Is there somewhere in the lender library that I can
-- update that?" There was not. It was a list of ten banks written into
-- lib/offer-accepted-rules.ts, so every other lender in the library got
-- nothing at all - silently, which reads as "there is no deadline" - and
-- correcting one of the ten meant a code change.
--
-- Four columns, beside reprice_over_percent, which is already a number this
-- bank happens to use that Fabio owns.
--
-- NULL IS NOT RECORDED, AND STAYS NOT RECORDED. Nothing here defaults to 90:
-- a lender nobody has filled in says so on the deal rather than borrowing a
-- figure from the bank next to it. Same rule as the repricing threshold.
alter table lenders
  add column if not exists preapproval_days integer,
  add column if not exists preapproval_extends boolean,
  add column if not exists preapproval_extend_days integer,
  add column if not exists preapproval_extend_fee numeric;

comment on column lenders.preapproval_days is
  'How many days a preapproval from this lender stands. NULL means nobody has recorded it.';

-- THE TEN THAT WERE ALREADY IN THE CODE, so nothing a broker sees today stops
-- being said tomorrow. Matched on the name, lower case, the way the old
-- ruleFor() matched it. A lender that is not here keeps NULL and says so.
update lenders set preapproval_days = 90, preapproval_extends = true, preapproval_extend_days = 90
  where lower(name) in ('cba', 'commonwealth bank', 'commbank',
                        'st george', 'stg', 'bank of melbourne', 'bom', 'banksa', 'bank sa',
                        'westpac', 'anz', 'ing', 'ubank', 'u bank')
    and preapproval_days is null;

update lenders set preapproval_days = 90, preapproval_extends = false
  where lower(name) in ('nab', 'national australia bank',
                        'macquarie', 'macquarie bank', 'bankwest')
    and preapproval_days is null;

update lenders set preapproval_days = 90, preapproval_extends = true,
                   preapproval_extend_days = 90, preapproval_extend_fee = 100
  where lower(name) = 'wlth'
    and preapproval_days is null;
