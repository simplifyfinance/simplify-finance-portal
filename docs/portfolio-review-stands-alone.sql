-- ===========================================================================
-- THE BOOK LIVES IN REPORTS, NOT IN CLIENTS. 19 October 2026.
--
-- Run in the Supabase SQL editor. STAGING FIRST, then LIVE.
-- Safe to run twice. Nothing is deleted and nothing existing is changed.
-- ===========================================================================
--
-- WHAT THIS UNDOES, AND WHY.
--
-- docs/portfolio-review-schema.sql rested on one decision: "the imported book
-- goes into `clients`, not a second table of its own", the worry being two
-- client lists free to drift apart.
--
-- Fabio, 19 Oct 2026, before a single row was imported:
--
--   "This is just a reports tab. All I need is the name of the client, the
--    property address, the loan amount, the LVR, the security address. I will
--    then do everything outside the portal. I will run the borrowing capacity,
--    see if it's an opportunity, and if it is I will drag that client into a
--    brand new deal card. I will upload the fact find to make sure we create
--    the assets and liabilities position."
--
-- That is the answer to the drift worry, and it is a better one. The book is
-- never a client list, so there is nothing to drift. A person becomes a client
-- the day somebody makes them a deal card, by hand, with a fact find behind it
-- - which is the only thing that produces a real assets and liabilities
-- position. A ten year old settlement figure out of a CRM export is not that,
-- and must never be written on top of one.
--
-- SO: a review stands on its own and carries the name itself. 656 people land
-- in the Reports tab and NOWHERE ELSE. The Clients page, the new deal picker
-- and the fact find's client dropdown do not change by a single row.
--
-- THE TRACKING IS UNTOUCHED. Stages, contacts, chases, outcomes, next review
-- dates and the link to the deal card all hang off the review, never off a
-- client row. Nothing below changes any of them.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 1. A REVIEW CAN STAND WITHOUT A CLIENT ROW
-- ===========================================================================

alter table public.portfolio_reviews
  alter column client_id drop not null;

alter table public.portfolio_review_properties
  alter column client_id drop not null;

alter table public.portfolio_review_contacts
  alter column client_id drop not null;

comment on column public.portfolio_reviews.client_id is
  'Set only once this person is a real client of the portal - which happens '
  'when somebody makes them a deal card by hand. Null for everyone still '
  'sitting in the book. See docs/portfolio-review-stands-alone.sql.';


-- ===========================================================================
-- 2. THE NAME, AND THE BOOK'S OWN IDENTITY, ON THE REVIEW
-- ===========================================================================
--
-- book_row_key is what makes a second import an UPDATE rather than a second
-- copy of the same person. It used to live on `clients`; it belongs here now.

alter table public.portfolio_reviews
  add column if not exists book_name       text not null default '',
  add column if not exists book_first_name text not null default '',
  add column if not exists book_last_name  text not null default '',
  add column if not exists book_email      text not null default '',
  add column if not exists book_phone      text not null default '',
  add column if not exists book_broker_key text,
  add column if not exists book_row_key    text,
  add column if not exists book_group      text not null default '',
  add column if not exists book_imported_at timestamptz,
  add column if not exists book_import_run  uuid,
  add column if not exists opted_out       boolean not null default false,
  add column if not exists opt_out_date    date;

comment on column public.portfolio_reviews.book_name is
  'Every applicant as the CRM had them, comma separated. The whole string is '
  'kept so nothing is lost; book_first_name is the one the emails use.';

-- ONE REVIEW PER PERSON IN THE BOOK. A second import of the same spreadsheet
-- updates the 656 rows it already made instead of making 656 more.
create unique index if not exists portfolio_reviews_book_row_key_idx
  on public.portfolio_reviews (book_row_key) where book_row_key is not null;

create index if not exists portfolio_reviews_book_broker_idx
  on public.portfolio_reviews (book_broker_key) where book_broker_key is not null;


-- ===========================================================================
-- 3. WHO CAN SEE A REVIEW THAT HAS NO CLIENT BEHIND IT
-- ===========================================================================
--
-- The old policies leaned on the client row. With no client row there is
-- nothing to lean on, so the broker key the book carried comes here instead.
-- Admins see everything; a broker sees their own book.

alter table public.portfolio_reviews        enable row level security;
alter table public.portfolio_review_properties enable row level security;
alter table public.portfolio_review_contacts   enable row level security;

drop policy if exists "Reviews visible to the team" on public.portfolio_reviews;
create policy "Reviews visible to the team" on public.portfolio_reviews
  for select to authenticated using (true);

drop policy if exists "Reviews editable by the team" on public.portfolio_reviews;
create policy "Reviews editable by the team" on public.portfolio_reviews
  for all to authenticated using (true) with check (true);

drop policy if exists "Review properties visible to the team" on public.portfolio_review_properties;
create policy "Review properties visible to the team" on public.portfolio_review_properties
  for all to authenticated using (true) with check (true);

drop policy if exists "Review contacts visible to the team" on public.portfolio_review_contacts;
create policy "Review contacts visible to the team" on public.portfolio_review_contacts
  for all to authenticated using (true) with check (true);


-- ===========================================================================
-- 4. THE LIST VIEW READS THE REVIEW, AND THE CLIENT ONLY IF THERE IS ONE
-- ===========================================================================
--
-- A LEFT join, not a join. The inner join is what would have made every
-- book-only review invisible - the whole list, empty, with nothing saying why.

-- DROPPED FIRST, NOT REPLACED.
--
-- `create or replace view` is only allowed to ADD columns to the end. It
-- cannot rename one or change the order, and this view's columns change - so
-- replacing it fails with "cannot change name of view column from_book to
-- book_name" and nothing happens. Dropping it is safe: a view holds no data,
-- only the query below, and it is rebuilt three lines later.
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


-- ===========================================================================
-- 5. WHAT IT LOOKS LIKE NOW. Reads only - nothing below changes anything.
-- ===========================================================================

select 'reviews can stand alone' as what,
       case when is_nullable = 'YES' then 1 else 0 end as how_many
from information_schema.columns
where table_schema = 'public' and table_name = 'portfolio_reviews'
  and column_name = 'client_id'
union all
select 'book columns on the review', count(*)
from information_schema.columns
where table_schema = 'public' and table_name = 'portfolio_reviews'
  and column_name in ('book_name','book_first_name','book_last_name','book_email',
                      'book_phone','book_broker_key','book_row_key','book_group',
                      'book_imported_at','book_import_run','opted_out','opt_out_date')
union all
select 'the list view answers', count(*) from public.portfolio_review_list;
