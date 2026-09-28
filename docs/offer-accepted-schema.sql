-- WHAT AN ACCEPTED OFFER CREATES.
--
-- Fabio, 27 Sep 2026. Marking a deal offer-accepted wrote a date and stopped.
-- These are the three facts it now records that nothing anywhere else holds.
--
-- WHAT IS DELIBERATELY NOT HERE, because the portal already has it:
--
--   The settlement date      deals.expected_settlement_date  (settlements panel)
--   The finance clause date  deals.finance_clause_date       (settlements panel)
--   The property address     compliance_data.securityAddress (deal structure)
--
-- I told Fabio on 25 September that the portal had never held a settlement date.
-- That was wrong: it has held one since the settlements board was built. What is
-- true is that nothing ever ASKS for it at the moment an offer is accepted - it
-- sits in a panel headed "settlement" that a broker does not think of as theirs,
-- on a deal that has not settled. The offer-accepted panel writes those same two
-- columns rather than inventing second copies of them, because two dates called
-- the settlement date is how a deal ends up disagreeing with itself.
--
-- Safe to run twice.

-- WHAT THEY ACTUALLY PAID, which is not what the BC allowed for.
--
-- bc_data.purchasePrice is what the client could afford when the borrowing
-- capacity was written. This is what is on the contract. Kept apart on purpose:
-- every figure downstream still reads the BC until somebody decides what the
-- difference means - keep their savings where they are and borrow more, or
-- cover it themselves and borrow the same. Fabio, 27 Sep 2026: "Ask before
-- calcualting to ensure custoemr would like to keep same savings postion or
-- reduce or increase".
alter table deals add column if not exists contract_price numeric;

-- THE DEPOSIT THAT HAS ACTUALLY GONE IN, and when.
--
-- Not bc_data.deposit, which is the contribution the loan was worked out
-- against. This is money that has left the client's account.
alter table deals add column if not exists deposit_paid    numeric;
alter table deals add column if not exists deposit_paid_at date;

comment on column deals.contract_price is
  'What the clients actually paid, off the contract of sale. bc_data.purchasePrice stays as the estimate the borrowing capacity was built on until somebody decides how the difference is funded.';
comment on column deals.deposit_paid is
  'Deposit that has actually been paid, not the contribution the loan was structured against.';

-- Nothing to backfill: no deal has ever been asked these questions.
select count(*) filter (where offer_accepted_at is not null) as offer_accepted_deals,
       count(*) filter (where contract_price is not null)    as have_a_contract_price,
       count(*) filter (where expected_settlement_date is not null) as have_a_settlement_date,
       count(*) filter (where finance_clause_date is not null)      as have_a_finance_clause
  from deals;
