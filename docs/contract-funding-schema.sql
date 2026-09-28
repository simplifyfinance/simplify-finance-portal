-- WHERE THE DIFFERENCE CAME FROM.
--
-- Fabio, 27 Sep 2026: "Ask before calcualting to ensure custoemr would like to
-- keep same savings postion or reduce or increase". And 28 Sep, on what happens
-- to the figures once it is answered: "Keep the BC, hold the contract beside it."
--
-- So the borrowing capacity is never rewritten. It stays as what the clients
-- were assessed against and what the compliance pack was written from. These
-- columns are the contracted position sitting alongside it, and three readers in
-- lib/funds-to-complete.ts prefer them once they exist - which is how LVR, LMI
-- and funds to complete all move together without anything being overwritten.
--
-- Same idea as lodged_total at the other end of the deal: keep both, prefer the
-- newer, lose neither.
--
-- Safe to run twice.

alter table deals add column if not exists contract_loan_amount  numeric;

-- WHO ANSWERED IT AND WHEN. This is a conversation with a client about their
-- savings, recorded on a regulated file. Which way they went is worth as much as
-- the number.
alter table deals add column if not exists contract_funding_choice text;
alter table deals add column if not exists contract_funding_at     timestamptz;
alter table deals add column if not exists contract_funding_by     text;

comment on column deals.contract_loan_amount is
  'The loan once somebody answered how a changed purchase price is funded. Preferred over lo_data.loanAmount by lib/funds-to-complete.ts. The BC is never rewritten.';
comment on column deals.contract_funding_choice is
  'loan = the clients kept their savings and borrowed the difference. savings = they covered it and the loan stood. custom = a figure typed by hand.';

select count(*) filter (where contract_price is not null)        as have_a_price,
       count(*) filter (where contract_loan_amount is not null)  as have_answered_the_funding
  from deals;

-- STAMP DUTY MOVES WITH THE PRICE.
--
-- Fabio, 28 Sep 2026: "REMEMBER Stamp DUTY is still a figures as we need to
-- input the new amount which show me a gap we didtnt account for."
--
-- His example: assessed at $1,000,000 with about $39,000 of NSW duty, bought at
-- $950,000 where it is about $37,000. bc_data.stampDuty is TYPED, so nothing
-- made it move - funds to complete would have gone on charging the client duty
-- on a price they did not pay, which is money they turn up without.
--
-- The portal does not calculate it. State scales, first home concessions,
-- foreign surcharges and thresholds that move in budgets - a figure we worked
-- out would be wrong for somebody. It is asked for, and the BC's own figure is
-- left alone like everything else here.
alter table deals add column if not exists contract_stamp_duty numeric;

comment on column deals.contract_stamp_duty is
  'Stamp duty against the price actually paid. Preferred over bc_data.stampDuty by lib/funds-to-complete.ts. Never calculated by the portal.';

-- WHAT THE CLIENTS ARE PUTTING IN.
--
-- Fabio, 28 Sep 2026: "depsoit is the only real question what the customer would
-- like to do and YES depsoit needs to be enough to cover duty so purcahse pirce
-- + duty = total cost - deposit = loan amount".
--
-- The deposit is the INPUT and contract_loan_amount is what falls out of it.
-- Both are stored: the loan because everything downstream reads it, the deposit
-- because it is the answer somebody actually gave and reopening the deal should
-- show the question as answered rather than blank.
alter table deals add column if not exists contract_deposit numeric;

comment on column deals.contract_deposit is
  'What the clients are putting in, against the contract price. The loan is total cost less this. The BC is never rewritten.';
