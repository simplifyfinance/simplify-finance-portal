-- WHAT THE FILED DOCUMENTS WERE BUILT FROM.
--
-- Fabio, 30 Sep 2026: "I want to be automatic and save on documents tab".
--
-- The three PDFs on a deal are built from the deal and then SAVED. From that
-- moment the deal can move past them - a lender change, a reworked loan, a
-- corrected write-up - and nothing said so. On Lucy Ilbery & Andrew Leigh the
-- filed copies were five days behind and named a bank the clients had left.
--
-- A DATE CANNOT ANSWER THIS. "Filed on 24 September" does not tell anybody
-- whether the deal has changed since. So what they were built FROM is kept, and
-- "are these current" becomes a comparison rather than a memory.
--
-- Deliberately a few facts rather than a hash of the whole deal: the lender, the
-- product, the loan, the purpose, the approval type and the write-up itself.
-- A warning that fires when somebody fixes a phone number is a warning everybody
-- learns to ignore. See lib/keeping-up.ts.
--
-- ONE STAMP FOR ALL THREE, because they are rebuilt together by one press.
--
-- Safe to run twice.

alter table deals add column if not exists documents_built_from jsonb;
alter table deals add column if not exists documents_built_at   timestamptz;
alter table deals add column if not exists documents_built_by   text;

comment on column deals.documents_built_from is
  'The lender, product, loan, purpose, approval type and write-up fingerprint the filed PDFs were built from. Compared against the deal to answer "are the filed copies current". Written by components/DealDocuments.tsx. Never a hash of the whole deal - see lib/keeping-up.ts.';

select count(*) filter (where documents_built_from is not null) as have_a_stamp,
       count(*) filter (where documents_built_at  is not null) as have_been_filed
  from deals;
