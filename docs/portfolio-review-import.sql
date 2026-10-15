-- ============================================================================
-- THE BOOK IMPORT. WHAT THE FIRST FILE DID NOT KNOW IT NEEDED.
--
-- Run in the Supabase SQL editor. STAGING FIRST, then LIVE.
-- Safe to run twice. Nothing is deleted and no existing data is changed.
--
-- 15 October 2026, after reading the real export: 796 rows, 656 clients.
-- Goes on top of docs/portfolio-review-schema.sql.
-- ============================================================================


-- ===========================================================================
-- 1. THE NAME IS A GROUP, NOT A PERSON
-- ===========================================================================
--
-- "Contact - group data - full name" holds every applicant, comma separated.
-- Of the 656 clients, 140 are one person, 225 are two, 64 are three, and one
-- has fourteen.
--
-- `clients` holds ONE person, which is right - that is what a client is. So
-- the first applicant becomes the client, and the whole group string is kept
-- here beside them. When a review turns into a deal, the second applicant is
-- read out of this rather than typed again, which is the thing Fabio asked
-- for: "make sure I can add multiple applicants because most of our clients
-- are couples."
--
-- Kept as the CRM wrote it, not as we parsed it. Our parsing can be improved
-- later; the original cannot be recovered once it is thrown away.
alter table public.clients
  add column if not exists book_group text not null default '';

comment on column public.clients.book_group is
  'Every applicant on the imported deal, comma separated, exactly as the CRM exported it. The second applicant on a deal comes from here.';


-- ===========================================================================
-- 2. A STAGE FOR "THIS ONE IS WORTH DOING"
-- ===========================================================================
--
-- The shape changed on 15 Oct 2026. Fabio: "why are we overcomplicating this?
-- ... I will then do all the work outside of the portal in terms of the
-- borrowing capacity. If I see an opportunity ... we create a deal card like
-- we normally would with both applicants."
--
-- So the portal stops holding the figures. The deal card already takes two
-- applicants, already accepts a dropped fact find, and already builds the
-- client email from the borrowing capacity. A review that becomes real becomes
-- a DEAL, and `opportunity` is the stage where that happens.
--
-- `numbers_done` stays allowed rather than being removed. Nothing has used it
-- yet, and a constraint that refuses a value some row might already hold is
-- how a deploy breaks at the worst moment.
alter table public.portfolio_reviews
  drop constraint if exists portfolio_reviews_status_known;

alter table public.portfolio_reviews
  add constraint portfolio_reviews_status_known check (status in (
    'not_reviewed',       -- on the list, nobody has looked
    'valuation_checked',  -- values looked up, still deciding
    'opportunity',        -- worth doing: a deal card exists, see linked_deal_id
    'numbers_done',       -- kept for anything written before 15 Oct 2026
    'template_sent',      -- the email has gone, and that is a fact not a guess
    'client_responded',   -- they answered
    'closed'              -- finished, see outcome
  ));


-- ===========================================================================
-- 3. WHAT A POSITION FROM THE BOOK LOOKS LIKE
-- ===========================================================================
--
-- The import writes the properties into clients.position_properties - the
-- column the portal ALREADY uses for a client's position, that the client page
-- draws, that docs/client-loans-view.sql reads, and that the Rate exposure and
-- LVR exposure reports are built on. One import, four screens.
--
-- `position_source` already exists and already carries 'deal closed'. The
-- import writes 'book import', and the rule the screen keeps is simple and
-- absolute:
--
--   A POSITION CAPTURED FROM A REAL DEAL IS NEVER OVERWRITTEN BY THE BOOK.
--
-- A spreadsheet value from 2021 must not replace figures somebody took at a
-- settlement last month. This is a comment rather than a trigger because the
-- same column is legitimately written by four other screens; the check lives
-- in components/BookImport.tsx and lib/book-import.test.ts holds it there.
comment on column public.clients.position_source is
  'Where the position came from: "deal closed", "book import", and so on. The book import never overwrites a position taken from a real deal - see docs/portfolio-review-import.sql.';


-- ===========================================================================
-- 4. ONE ROW PER IMPORT, SO A SECOND ONE CAN BE EXPLAINED
-- ===========================================================================
--
-- Not for the data - that is on the clients. This is so that "where did these
-- 656 people come from" has an answer in six months, and so the column mapping
-- is remembered and the second drop does not ask again.

create table if not exists public.book_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null default '',
  -- Which spreadsheet column was read as what. Remembered so the next drop of
  -- the same export maps itself.
  mapping jsonb not null default '{}'::jsonb,
  rows_seen int not null default 0,
  clients_made int not null default 0,
  clients_updated int not null default 0,
  properties_written int not null default 0,
  -- Anything the person was asked about and anything that was skipped.
  notes text not null default '',
  imported_by uuid,
  created_at timestamptz not null default now()
);

alter table public.book_imports enable row level security;

drop policy if exists book_imports_read on public.book_imports;
create policy book_imports_read on public.book_imports
  for select to authenticated using (true);
drop policy if exists book_imports_write on public.book_imports;
create policy book_imports_write on public.book_imports
  for insert to authenticated with check (true);
drop policy if exists book_imports_touch on public.book_imports;
create policy book_imports_touch on public.book_imports
  for update to authenticated using (true) with check (true);

-- NO DELETE POLICY, as everywhere else in this project. An import that went
-- wrong is a thing to explain, not a thing to erase.


-- ===========================================================================
-- 5. WHAT IT LOOKS LIKE NOW. Reads only.
-- ===========================================================================

select 'book_group on clients' as what, count(*) as how_many, 1 as expected
from information_schema.columns
where table_schema = 'public' and table_name = 'clients' and column_name = 'book_group'
union all
select 'book_imports table', count(*), 1
from information_schema.tables
where table_schema = 'public' and table_name = 'book_imports'
union all
select 'opportunity is an allowed stage', count(*), 1
from information_schema.check_constraints
where constraint_schema = 'public'
  and constraint_name = 'portfolio_reviews_status_known'
  and check_clause like '%opportunity%'
union all
select 'clients from the book so far', count(*), null
from public.clients where from_book;
