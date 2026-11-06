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

-- AND THE SPELLINGS. 17 Aug 2026.
--
-- The seed above matched on the exact name, which left "Commonwealth Bank of
-- Australia" and "National Australia Bank" reading as not recorded. Fabio:
-- "we are smart enough to know CBA is Commonwealth Bank, NAB is National
-- Australia Bank so stop that."
--
-- We are - lib/lender-id.ts has matched on name OR any alias since the
-- commission import was built, and this did not. So it does now: the same
-- normalise-and-aliases test, written as SQL.
--
-- Only fills what is still blank, so anything already set or typed by hand is
-- left exactly as it is.
create or replace function pg_temp.known(l lenders, pattern text) returns boolean as $$
  select l.name ~* pattern
      or exists (select 1 from unnest(coalesce(l.aliases, '{}'::text[])) a where a ~* pattern);
$$ language sql stable;

update lenders l set preapproval_days = 90, preapproval_extends = true, preapproval_extend_days = 90
  where preapproval_days is null and (
       pg_temp.known(l, '^cba\M|commonwealth bank|commbank')
    or pg_temp.known(l, '^stg\M|st\.? ?george|bank of melbourne|^bom\M|bank ?sa')
    or pg_temp.known(l, 'westpac')
    or pg_temp.known(l, '^anz\M')
    or pg_temp.known(l, '^ing\M')
    or pg_temp.known(l, '^u ?bank\M'));

update lenders l set preapproval_days = 90, preapproval_extends = false
  where preapproval_days is null and (
       pg_temp.known(l, '^nab\M|national australia')
    or pg_temp.known(l, 'macquarie')
    or pg_temp.known(l, 'bankwest'));

update lenders l set preapproval_days = 90, preapproval_extends = true,
                     preapproval_extend_days = 90, preapproval_extend_fee = 100
  where preapproval_days is null and pg_temp.known(l, '^wlth\M');

-- WHO IS STILL BLANK, so it is a list rather than a surprise on a deal.
select name, active from lenders
  where preapproval_days is null and active is not false
  order by name;
