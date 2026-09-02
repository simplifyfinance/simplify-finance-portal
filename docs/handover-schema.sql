-- What credit is asked when a deal is pushed to SalesTrekker, and the urgency
-- that comes out of it. Run in the Supabase SQL editor. Safe to run twice.
--
-- These questions were being asked in Slack, in email, or not at all - and the
-- answers decide what the credit team does first. They live on the deal now, so
-- a second push does not start from a blank form and nothing is asked twice.

alter table deals add column if not exists push_answers jsonb;

-- Urgency is two real columns rather than a key inside push_answers, because the
-- BOARD reads them on every card to decide the order. A sort that has to parse
-- JSON on every deal is a sort that gets quietly dropped later.
alter table deals add column if not exists is_urgent boolean not null default false;
alter table deals add column if not exists compliance_needed_by date;

-- The flag ends at lodgement, and that is enforced in code (isUrgentNow) rather
-- than by a job that clears the column - a deal that is un-lodged by mistake
-- should get its flag back, and a nightly sweep could not give it back.
create index if not exists deals_urgent_idx on deals (is_urgent) where is_urgent;

-- Ownership of the security - who goes on the title, why a borrower is not on
-- it, and where independent legal advice stands - lives inside compliance_data
-- as `title`. That column is already jsonb, so there is nothing to add for it.

select count(*) filter (where is_urgent) as urgent_now,
       count(*) filter (where push_answers is not null) as have_push_answers,
       count(*) as deals
  from deals;
