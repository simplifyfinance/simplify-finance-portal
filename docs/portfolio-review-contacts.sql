-- ===========================================================================
-- THE SECOND APPLICANT'S EMAIL AND PHONE. 20 October 2026.
--
-- Run in the Supabase SQL editor. STAGING FIRST, then LIVE.
-- Safe to run twice. Nothing is deleted and nothing existing is changed.
-- ===========================================================================
--
-- The first CRM export had 29 columns and not one of them was a way to contact
-- anybody, so all 656 reviews landed with nothing to send to. The second export
-- splits the applicants out - C1 First Name, C1 Email, C1 Phone, then the same
-- for C2.
--
-- book_email and book_phone already exist. These two are the other half of a
-- couple, so a joint email reaches both of them rather than whichever name the
-- CRM happened to put first.

alter table public.portfolio_reviews
  add column if not exists book_email2 text not null default '',
  add column if not exists book_phone2 text not null default '';

comment on column public.portfolio_reviews.book_email2 is
  'The second applicant''s email. The opportunity email goes to both.';


-- ---------------------------------------------------------------------------
-- WHAT IT LOOKS LIKE NOW. Reads only - nothing below changes anything.
-- ---------------------------------------------------------------------------

select 'contact columns on the review' as what, count(*) as how_many
from information_schema.columns
where table_schema = 'public' and table_name = 'portfolio_reviews'
  and column_name in ('book_email', 'book_phone', 'book_email2', 'book_phone2');
