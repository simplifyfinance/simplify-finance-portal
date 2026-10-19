-- ===========================================================================
-- THE OPPORTUNITY EMAIL. 19 October 2026.
--
-- Run in the Supabase SQL editor. STAGING FIRST, then LIVE.
-- Safe to run twice. Nothing is deleted and nothing existing is changed.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. THE CASH-FLOW BUFFER
-- ---------------------------------------------------------------------------
--
-- The email says "we structure a little extra equity as a cash-flow buffer, so
-- any shortfall on the new property is covered by the buffer rather than paid
-- out of your pocket". That means the equity release is DELIBERATELY more than
-- the deposit.
--
-- Without somewhere to record it, the portal reads that as the figures not
-- tying out and warns about a shortfall that was the plan all along. With it,
-- the deposit check knows what is intended and the email can name the figure -
-- which is a better sentence than a promise with no number behind it.
alter table public.portfolio_reviews
  add column if not exists equity_buffer numeric(14,2);

comment on column public.portfolio_reviews.equity_buffer is
  'Equity released on purpose over and above the deposit, set aside as a '
  'cash-flow buffer rather than spent at settlement.';


-- ---------------------------------------------------------------------------
-- 2. WHAT TO SAY ABOUT THE LOAN AMOUNT
-- ---------------------------------------------------------------------------
--
-- "Loan Amount: $385,000 (your maximum borrowing capacity with non-bank
-- lender)". The bracket changes deal by deal and is in front of a client, so it
-- is typed on the review rather than guessed from the lender type - which lives
-- in internal_notes and is explicitly never merged into an email.
alter table public.portfolio_reviews
  add column if not exists loan_note text not null default '';


-- ---------------------------------------------------------------------------
-- 3. THE WORDING, OUT OF THE CODE
-- ---------------------------------------------------------------------------
--
-- Fabio, 19 Oct 2026: "use your wording for now so we set up the rules THEN I
-- WILL CHANGE THE WORDING."
--
-- So every paragraph somebody might want to rewrite lives here, as one jsonb
-- column, and changing any of them needs no ship. An empty object means "use
-- what the code ships with" - see DEFAULT_COPY in lib/portfolio-review-email.ts.
--
-- ONE COLUMN, NOT TWELVE. The shape of this email will change again; a column
-- per paragraph would mean a migration every time somebody wants another line.
alter table public.settings
  add column if not exists portfolio_review_copy jsonb not null default '{}'::jsonb;

comment on column public.settings.portfolio_review_copy is
  'The editable paragraphs of the portfolio review email. Empty means the '
  'defaults in lib/portfolio-review-email.ts. Never holds a dollar figure - '
  'every number in that email is built from the review itself.';


-- ---------------------------------------------------------------------------
-- 4. WHAT IT LOOKS LIKE NOW. Reads only - nothing below changes anything.
-- ---------------------------------------------------------------------------

select 'columns added to the review' as what, count(*) as how_many
from information_schema.columns
where table_schema = 'public' and table_name = 'portfolio_reviews'
  and column_name in ('equity_buffer', 'loan_note')
union all
select 'the wording column', count(*)
from information_schema.columns
where table_schema = 'public' and table_name = 'settings'
  and column_name = 'portfolio_review_copy';
