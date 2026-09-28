-- THE NUMBER THE LENDER CALLS THIS APPLICATION.
--
-- Fabio, 28 Sep 2026. ANZ want their acknowledgement email sent to
-- assessmentmail@anz.com with the loan reference as the subject line, and the
-- portal had nowhere to hold one.
--
-- IT IS NOT THE LOAN ID. The Loan ID is the account number the bank issues at
-- the other end - Fabio, 1 Sep 2026: "once contracts are issued and loan settles
-- our team contacts the bank and manually input the Loan ID". At the point an
-- offer is accepted it is empty on every deal, so it could never have carried
-- this. See lib/loan-id.ts, which stays exactly as it is.
--
-- This is the reference the lender issues when the application goes in, which is
-- why it is asked for when a deal is marked Lodged. Fabio, 28 Sep 2026: "for all
-- deals" - every lender issues one and anybody ringing a bank to chase a file
-- needs it, so it is not an ANZ field sitting on an ANZ deal.
--
-- Text, not a number. Lenders use letters, hyphens and leading zeroes, and a
-- format rule we invented would reject a real reference. Same reasoning as
-- cleanLoanId.
--
-- Safe to run twice.

alter table deals add column if not exists lender_reference text;

comment on column deals.lender_reference is
  'The reference the LENDER gives this application, recorded when the deal is lodged. Not the Loan ID, which is the account number issued at settlement and lives on the split in settled_splits.';

select count(*)                                          as deals,
       count(*) filter (where lodged_at is not null)      as lodged,
       count(*) filter (where lender_reference is not null) as have_a_reference
  from deals;
