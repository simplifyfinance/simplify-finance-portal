-- UNDO: why it was not suitable.
--
-- Puts the view back as it was on 19 Oct (see
-- docs/portfolio-review-stands-alone.sql) and takes the three columns out. The
-- view has to lose them first: a view that selects a column stops that column
-- being dropped.
--
-- Nothing here touches outcome, next_review_date or anything the list already
-- worked from before 26 Oct 2026.

-- Replacing cannot REMOVE a column, so this one is dropped and rebuilt. A view
-- holds no data - only the query below.
drop view if exists public.portfolio_review_list;

create view public.portfolio_review_list
with (security_invoker = true)
as
select
  r.id                       as review_id,
  r.client_id,
  -- The client row wins where there is one, because somebody has been keeping
  -- it. The book's copy is the fallback, never the override.
  coalesce(nullif(c.first_name, ''), r.book_first_name)  as first_name,
  coalesce(nullif(c.last_name, ''),  r.book_last_name)   as last_name,
  coalesce(nullif(c.email, ''),      r.book_email)       as email,
  coalesce(nullif(c.phone, ''),      r.book_phone)       as phone,
  r.book_name,
  r.book_group,
  (r.book_row_key is not null)                           as from_book,
  r.book_broker_key,
  r.opted_out,
  r.status, r.outcome,
  r.reviewed_at, r.next_review_date,
  r.figures_date,
  r.purchase_range_min, r.purchase_range_max,
  r.email_sent_at, r.linked_deal_id,
  (select count(*) from public.portfolio_review_properties p
     where p.review_id = r.id)                               as properties,
  (select count(*) from public.portfolio_review_properties p
     where p.review_id = r.id and p.investor)                as investment_properties,
  (select coalesce(sum(p.usable_equity), 0)
     from public.portfolio_review_properties p
     where p.review_id = r.id and p.investor)                as usable_equity,
  -- WHAT THE BOOK SAID THEY OWE AND WHAT IT WAS WORTH. On the list because
  -- these are the two figures the whole triage is done on, and reading them
  -- out of the properties every time is how a list gets slow.
  (select coalesce(sum(p.current_balance), 0)
     from public.portfolio_review_properties p
     where p.review_id = r.id and p.investor)                as owes,
  (select coalesce(sum(coalesce(p.estimated_current_value, p.original_value)), 0)
     from public.portfolio_review_properties p
     where p.review_id = r.id and p.investor)                as portfolio_value,
  (select count(*) from public.portfolio_review_contacts t
     where t.review_id = r.id and t.kind = 'call')           as calls,
  (select count(*) from public.portfolio_review_contacts t
     where t.review_id = r.id)                               as contacts,
  (select max(t.happened_on) from public.portfolio_review_contacts t
     where t.review_id = r.id)                               as last_contact,
  -- THE ONE THE MONDAY LIST SORTS ON. The earliest thing waiting: a chase that
  -- is due, or the review coming round again.
  least(
    (select min(t.next_action_on) from public.portfolio_review_contacts t
       where t.review_id = r.id and t.next_action_on is not null),
    r.next_review_date
  )                                                          as due_on
from public.portfolio_reviews r
left join public.clients c on c.id = r.client_id;

alter table public.portfolio_reviews drop constraint if exists portfolio_reviews_reason_known;

alter table public.portfolio_reviews
  drop column if exists outcome_reason,
  drop column if exists outcome_note,
  drop column if exists closed_at;
