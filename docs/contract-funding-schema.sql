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
