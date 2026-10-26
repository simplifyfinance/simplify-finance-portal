-- CATCH THIS DATABASE UP. ONE FILE, RUN IT ONCE.
--
-- 26 Oct 2026. An audit of what the portal expects against what is actually
-- here found 32 columns missing - fourteen features that were built, shipped,
-- and quietly do not work. monthly_fee alone had been refusing every product
-- save for a week.
--
-- This is those fourteen migration files, in order, in one go. Every one of
-- them is "add column if not exists": nothing is dropped, nothing is deleted,
-- and running it twice changes nothing the second time.
--
-- The last thing it does is tell the API to re-read the shape of the tables,
-- and then list anything still missing. An empty last result means this
-- database is up to date.


-- ===========================================================================
-- monthly-fee-schema.sql
-- ===========================================================================

-- A MONTHLY FEE ON A PRODUCT.
--
-- 18 Oct 2026. Fabio: "I need to find to add a box that says monthly fees box
-- on product library it is causing confusion."
--
-- The product carried application, annual, valuation, legal, rate lock, early
-- repayment and discharge. A lender charging $10 a month had nowhere to put it,
-- so it went into the annual box as $120 - or into Internal notes, where
-- nothing reads it. Both are wrong on a comparison a client reads.
--
-- TEXT, LIKE EVERY OTHER FEE ON THIS TABLE. These are not amounts the portal
-- does arithmetic on; they are what the lender says, printed as the lender says
-- it. "None", "Free up to $360" and "$150, or None - government" are all real
-- values already in these columns.
--
-- RUN ON STAGING AND LIVE. Safe to run twice; changes no existing row.
alter table public.lender_products
  add column if not exists monthly_fee text;

-- ===========================================================================
-- portfolio-review-contacts.sql
-- ===========================================================================

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

-- ===========================================================================
-- portfolio-review-import.sql
-- ===========================================================================

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

-- ===========================================================================
-- outstanding-schema.sql
-- ===========================================================================

-- THE LENDER SAID YES, SUBJECT TO.
--
-- Fabio, 29 Sep 2026: "call the stage outstanding because it will sit on
-- outstanding under a conditional approval. So the way it should read is
-- application lodged, outstanding, offer accepted, formal." And then, to be
-- certain it was understood: "it doesn't replace pre-approval. So let's be very
-- careful. So it goes lodged, outstanding, and then pre-approval."
--
-- Until now a conditionally approved deal sat in Lodged looking identical to one
-- nobody had heard a word about. Those are opposite situations: one is waiting
-- on a bank to pick a file up, the other is waiting on a client to send two
-- payslips - and only the second can be chased.
--
-- ONE DATE PUTS THE DEAL IN THE COLUMN, exactly like lodged_at and
-- preapproval_at. lib/deal-phase.ts works out which column a deal is in from the
-- furthest date it has reached, so a deal that gets its pre-approval leaves this
-- stage by itself and nothing has to be un-set.
--
-- Safe to run twice.

alter table deals add column if not exists outstanding_at timestamptz;
alter table deals add column if not exists outstanding_by text;

comment on column deals.outstanding_at is
  'When the lender came back with conditions. Puts the deal in the Outstanding column, between Lodged and Preapproved. Cleared when a deal is moved back on the board; the item list below is never cleared.';

-- WHAT WAS ASKED FOR, WHO IT SITS WITH, AND WHAT HAS COME IN.
--
-- A note saying "waiting on conditions" tells nobody which ones or how long.
-- Three items where two are in and one is eleven days old is a completely
-- different morning from three asked for yesterday.
--
-- An array of { id, what, waitingOn, askedAt, receivedAt, receivedBy }.
-- waitingOn is 'client', 'lender' or 'us' - it decides whether the answer to
-- "why has this not moved" is a phone call, a chase to the bank, or somebody in
-- the office. Written whole by lib/outstanding.ts and by nothing else.
--
-- NOTHING IS EVER REMOVED when an item arrives: it is stamped received and kept,
-- because when it was asked for is the age that made it worth chasing.
alter table deals add column if not exists outstanding_items jsonb;

comment on column deals.outstanding_items is
  'What the lender asked for after lodgement. Not the documents box, which asks the client for what we need in order to lodge. Single writer: lib/outstanding.ts.';

select count(*) filter (where outstanding_at is not null)    as in_outstanding,
       count(*) filter (where outstanding_items is not null) as have_a_list
  from deals;

-- ===========================================================================
-- offer-accepted-schema.sql
-- ===========================================================================

-- WHAT AN ACCEPTED OFFER CREATES.
--
-- Fabio, 27 Sep 2026. Marking a deal offer-accepted wrote a date and stopped.
-- These are the three facts it now records that nothing anywhere else holds.
--
-- WHAT IS DELIBERATELY NOT HERE, because the portal already has it:
--
--   The settlement date      deals.expected_settlement_date  (settlements panel)
--   The finance clause date  deals.finance_clause_date       (settlements panel)
--   The property address     compliance_data.securityAddress (deal structure)
--
-- I told Fabio on 25 September that the portal had never held a settlement date.
-- That was wrong: it has held one since the settlements board was built. What is
-- true is that nothing ever ASKS for it at the moment an offer is accepted - it
-- sits in a panel headed "settlement" that a broker does not think of as theirs,
-- on a deal that has not settled. The offer-accepted panel writes those same two
-- columns rather than inventing second copies of them, because two dates called
-- the settlement date is how a deal ends up disagreeing with itself.
--
-- Safe to run twice.

-- WHAT THEY ACTUALLY PAID, which is not what the BC allowed for.
--
-- bc_data.purchasePrice is what the client could afford when the borrowing
-- capacity was written. This is what is on the contract. Kept apart on purpose:
-- every figure downstream still reads the BC until somebody decides what the
-- difference means - keep their savings where they are and borrow more, or
-- cover it themselves and borrow the same. Fabio, 27 Sep 2026: "Ask before
-- calcualting to ensure custoemr would like to keep same savings postion or
-- reduce or increase".
alter table deals add column if not exists contract_price numeric;

-- THE DEPOSIT THAT HAS ACTUALLY GONE IN, and when.
--
-- Not bc_data.deposit, which is the contribution the loan was worked out
-- against. This is money that has left the client's account.
alter table deals add column if not exists deposit_paid    numeric;
alter table deals add column if not exists deposit_paid_at date;

comment on column deals.contract_price is
  'What the clients actually paid, off the contract of sale. bc_data.purchasePrice stays as the estimate the borrowing capacity was built on until somebody decides how the difference is funded.';
comment on column deals.deposit_paid is
  'Deposit that has actually been paid, not the contribution the loan was structured against.';

-- Nothing to backfill: no deal has ever been asked these questions.
select count(*) filter (where offer_accepted_at is not null) as offer_accepted_deals,
       count(*) filter (where contract_price is not null)    as have_a_contract_price,
       count(*) filter (where expected_settlement_date is not null) as have_a_settlement_date,
       count(*) filter (where finance_clause_date is not null)      as have_a_finance_clause
  from deals;

-- ===========================================================================
-- contract-funding-schema.sql
-- ===========================================================================

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

-- ===========================================================================
-- documents-freshness-schema.sql
-- ===========================================================================

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

-- ===========================================================================
-- milestone-emails-schema.sql
-- ===========================================================================

-- WHAT HAS BEEN SENT TO THIS CLIENT, AND BY WHOM.
--
-- Fabio, 29 Sep 2026, on the milestone emails: "Everyone can send it". Which is
-- exactly why the deal has to record what went - four people can reach the same
-- client, and "has anybody told them yet" must not be answered by asking around.
--
-- An array of { template, at, by, to, cc, attached }.
--
-- `attached` is kept because "we told them" and "we told them and sent the
-- bank's approval" are different claims on a regulated file.
--
-- IT IS ALSO WHAT THE $800 LINE TURNS ON. Fabio's own pre-approval wording says
-- a fee applies "beyond the second pre-approval", so the extension email has to
-- know which extension this is - and counting rows here is the only honest way
-- to know. See lib/milestone-emails.ts.
--
-- Written whole by the send route, never patched: two half-writes to a JSON
-- column lose a send, and a send nobody recorded is a client rung twice.
--
-- Safe to run twice.

alter table deals add column if not exists emails_sent jsonb;

comment on column deals.emails_sent is
  'Milestone emails that have gone to the client: which template, when, by whom, to and cc, and whether the lender letter was attached. Single writer - app/api/send-milestone-email. Read by lib/milestone-emails.ts.';

select count(*) filter (where emails_sent is not null) as deals_with_a_record
  from deals;

-- ===========================================================================
-- rate-notice-schema.sql
-- ===========================================================================

-- THE RBA NOTICE, AND WHO HAS PASSED IT ON.
--
-- Fabio, 30 Sep 2026: a disclaimer on every client email that quotes a rate,
-- because the RBA has moved and the banks will take two or three weeks to follow
-- - then off again, and ready to do the whole thing again next decision.
--
-- TWO PIECES, AND THE SECOND IS THE INTERESTING ONE.
--
-- settings.rate_notice holds the notice: the words, the decision it is about,
-- and when to review it. One row, one writer, and losing it costs a retype - the
-- right shape for a blob, unlike lender_rules next door where two people answer
-- different questions about different banks at the same moment.
--
-- THE LENDER SIDE IS A DATE, NOT A TICK. Fabio, 30 Sep 2026: "if I say for
-- exmaple Macquarie bank decion 30 septemebt and rate will increase on the 21st
-- of October I need the disclaiumer to go out on all Macquaire emails until the
-- 21st of October AFTER THAT date the disclaimer disapear".
--
-- A bank names the day when it announces, weeks ahead. So rate_notice_from holds
-- that day and the notice ends itself on it - nobody has to be at their desk on
-- the morning for a client email to be right.
--
-- rate_notice_for holds WHICH DECISION that date answers, and that is what makes
-- the next one free: change settings.rate_notice.decisionDate and not one
-- lender's stamp matches any more, so every bank goes back to carrying the
-- notice and last quarter's dates cannot leak into this quarter.
--
-- Nothing is written to any lender to do that. A clear-down loop is something
-- that can be half-finished, and seven banks silently exempt because a reset was
-- interrupted is exactly the failure this shape makes impossible.
--
-- EVERYBODY CAN TICK ONE. Fabio, 30 Sep 2026: "anyone can do this as it is a
-- team effort". So the name goes on it rather than a permission - somebody has
-- to be askable when a tick turns out to be wrong.
--
-- Safe to run twice. Nothing already stored is touched.

alter table public.settings
  add column if not exists rate_notice jsonb;

comment on column public.settings.rate_notice is
  'The RBA rate notice on client emails: { on, text, decisionDate, reviewBy }. decisionDate is what lenders.rate_notice_for is matched against - change it and every lender goes back to carrying the notice. Read by lib/rate-notice.ts.';

alter table public.lenders
  add column if not exists rate_notice_for  text,
  add column if not exists rate_notice_from date,
  add column if not exists rate_notice_by   text,
  add column if not exists rate_notice_at   timestamptz;

comment on column public.lenders.rate_notice_for is
  'WHICH RBA decision this lender''s announced date answers. Matches settings.rate_notice.decisionDate while current; anything else is last quarter''s news and is ignored.';
comment on column public.lenders.rate_notice_from is
  'The day this lender''s change takes effect, as they announced it. Client emails quoting this lender carry the notice up to this date and stop on it, by themselves.';
comment on column public.lenders.rate_notice_by is
  'Who ticked it. Everybody can, so somebody has to be askable when it turns out to be wrong.';

-- WHERE IT STANDS. Run this any time somebody asks what clients are being told.
select l.name,
       coalesce(l.rate_notice_for, '—')                       as announced_for,
       coalesce(l.rate_notice_from::text, '—')                as takes_effect,
       coalesce(l.rate_notice_by, '—')                        as recorded_by,
       case
         when (s.rate_notice ->> 'on') is distinct from 'true' then 'notice is off'
         when l.rate_notice_for is distinct from (s.rate_notice ->> 'decisionDate')
           then 'NOTICE SHOWN — nothing announced for this decision'
         when l.rate_notice_from <= current_date then 'no notice — in force since ' || l.rate_notice_from
         else 'notice until ' || l.rate_notice_from || ', then it stops by itself'
       end                                                    as right_now
  from public.lenders l
  cross join (select rate_notice from public.settings where id = 'singleton') s
 order by right_now, l.name;

-- ===========================================================================
-- lender-reference-schema.sql
-- ===========================================================================

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

-- ===========================================================================
-- lender-reprice-schema.sql
-- ===========================================================================

-- HOW FAR THE LOAN CAN MOVE BEFORE THE PRICING HAS TO BE REDONE.
--
-- Fabio, 27 Sep 2026: "10% is only a St George Westpac and Bank of Melbourne
-- rule so in the document library complete that as you build the rule and leave
-- all other lenders as N/A and I will manually either input a figure or not
-- change so we dont ahve do to do 1 by one".
--
-- WHY THIS IS A COLUMN AND NOT CODE. The other lender rules - ninety days, who
-- can extend, whether a change goes in by email or through AOL - live in
-- lib/offer-accepted-rules.ts because they are facts the PORTAL has to
-- understand. This one is a number that changes when a bank changes its mind,
-- and nobody should wait ten minutes for a deploy to type it in. It sits in the
-- lender library beside the fee wording and the statement codes, and Fabio or
-- Katie edit it directly.
--
-- NULL MEANS N/A, AND N/A IS A REAL ANSWER. A lender with nothing recorded is
-- never given the most common rule - the deal says "no repricing rule is
-- recorded for Macquarie, check before you submit" instead. A wrong threshold is
-- worse than no threshold: it tells somebody the discount still holds when it
-- does not.
--
-- Safe to run twice. Nothing already typed is overwritten.

alter table public.lenders
  add column if not exists reprice_over_percent numeric;

comment on column public.lenders.reprice_over_percent is
  'The loan may move by up to this percentage, up or down, before this lender wants the pricing redone. NULL means no rule has been recorded, which the portal says out loud rather than guessing. A percentage only - no lender of ours works on a dollar figure.';

-- THE EIGHT WE HAVE BEEN TOLD ABOUT, and only those eight.
--
-- Fabio, 28 Sep 2026: "these are all the lenders that if pricing is wihtin 10%
-- up or down we dont need new pricing" - CBA, Bankwest, ANZ, St George,
-- Westpac, NAB - and then, asked about the two Westpac-group banks he had not
-- named: "bankSA and Bbak of Melbourne also 10%".
--
-- The first version of this file had three, and a comment explaining that
-- BankSA was deliberately left out. That was right at the time and is wrong
-- now. Left as a note rather than quietly rewritten, because the reason a rule
-- changed is worth as much as the rule.
--
-- Named exactly, not by pattern. `ilike 'westpac%'` would also catch a
-- "Westpac Equipment Finance" added next year, and a threshold applied to a
-- bank nobody checked is the thing this file exists to avoid.
--
-- `is null` on purpose: this fills a lender that has never been given a figure
-- and leaves alone any that somebody has since typed by hand. Running it again
-- after Fabio moves St George to 15 will not drag it back to 10.
update public.lenders
   set reprice_over_percent = 10
 where reprice_over_percent is null
   and name in ('CBA', 'Bankwest', 'ANZ', 'St George',
                'Westpac', 'NAB', 'Bank of Melbourne', 'BankSA');

-- What that just did, and what is left as N/A. Read this before closing the tab.
select name,
       coalesce(reprice_over_percent::text, 'N/A') as reprice_over
  from public.lenders
 where active
 order by reprice_over_percent nulls last, name;

-- ===========================================================================
-- board-filters-schema.sql
-- ===========================================================================

-- THE FILTERS A PERSON LEFT ON THE BOARD.
--
-- Fabio, 30 Sep 2026: "on the board view I want filters for deals", and on
-- whether they should survive the night: "Remember them, but say so loudly."
--
-- Beside board_folds, which already remembers which columns each person has
-- shut, and for the same reason. A filter is ONE PERSON'S VIEW of their own
-- board - Kylie looking at her own book must never change what Ellie sees - so
-- it lives on the profile, not in settings.
--
-- A BLOB HERE IS THE RIGHT SHAPE, unlike lender_rules next door. There is one
-- writer (the person themselves, from their own browser), nobody else ever
-- writes it, and losing it costs somebody one click. That is the opposite of a
-- rule two people answer about a bank.
--
-- NOTHING BREAKS WITHOUT IT. lib/use-board-filters.ts reads this column and
-- carries on with nothing filtered if it is not there, exactly as board_folds
-- does - so this can be run before the deploy or after it.
--
-- Safe to run twice. Nothing already stored is touched.

alter table public.user_profiles
  add column if not exists board_filters jsonb;

comment on column public.user_profiles.board_filters is
  'This person''s own deal board filters - broker, credit officer, lender, needs attention. A view, never a record: single writer, and losing it costs one click. Read by lib/use-board-filters.ts.';

-- WHO HAS ONE ON. A filter is a way to hide deals, so it is worth being able to
-- ask this when somebody says a deal has vanished.
select full_name,
       case when board_filters is null then 'none' else board_filters::text end as filters
  from public.user_profiles
 order by full_name;

-- ===========================================================================
-- sender-phone-schema.sql
-- ===========================================================================

-- THE MOBILE UNDER A SIGN-OFF.
--
-- Every milestone email ends with the name of whoever sent it, the brand, an
-- email address and a mobile - because a client reading "your loan is formally
-- approved" at 8pm wants a number, not a reply form. Fabio, 29 Sep 2026, on
-- whether the signature should be the sender or the broker: "B match send and
-- sognature".
--
-- credit_officers.phone already exists for the number a bank's assessor rings.
-- This is the other one: the number a CLIENT rings, belonging to whoever pressed
-- send. Different person, different audience, so a different column rather than
-- one number doing two jobs.
--
-- NOTHING BREAKS WITHOUT IT. A profile with no number simply has no mobile line
-- in the signature - lib/milestone-email-parts.ts has always guarded it - and
-- app/api/send-milestone-email asks for this column and carries on without it if
-- it is not there yet. So this can be run before the deploy or after it.
--
-- Safe to run twice. Nothing already stored is touched.

alter table public.user_profiles
  add column if not exists phone text;

comment on column public.user_profiles.phone is
  'Direct mobile for this person, printed under their name on client emails they send from the portal. Maintained in Settings. Empty is fine - the signature leaves the line out.';

-- WHO HAS ONE. Anybody who sends a client email and shows blank here will sign
-- off without a number.
select full_name,
       case when coalesce(phone, '') = '' then 'no number' else 'has one' end as mobile
  from public.user_profiles
 order by mobile, full_name;

-- ===========================================================================
-- why-it-was-not-suitable.sql
-- ===========================================================================

-- WHY IT WAS NOT SUITABLE, AND WHAT BRINGS IT BACK.
--
-- 26 Oct 2026. Fabio, going through the book: "I want to find the best way to
-- add notes that why not suitable so we can track things better also creating
-- a task to follow up later as sometimes it is not a deal now but can be
-- later."
--
-- Two holes, and only one of them was missing a column.
--
-- 1. NOTHING ASKED WHY. The four outcomes are the whole record of six hundred
--    conversations. "Not suitable now" on its own cannot be counted, chased or
--    learned from - it does not say whether the problem was servicing, equity
--    or a fixed rate with eighteen months left on it.
--
-- 2. THE FOLLOW-UP DATE WAS ALREADY THERE AND NOTHING READ IT. next_review_date
--    has been saved on every close since the day this shipped, and the trigger
--    even fills it in with twelve months when nobody chooses one. But the
--    count at the top of the list skips anything closed, so the date arrives
--    and no number moves. The list would show it; the tile above the list said
--    zero. Those two have disagreed since day one.
--
-- He chose a reason you can count plus a note in your own words, over free
-- text alone: "nine of the last forty were serviceability" is a sentence you
-- can do something about, and six hundred notes read by eye is not.
--
-- RUN ON STAGING FIRST, then live. Three columns, one check, one backfill and
-- a view that gains three columns on the end. Nothing is dropped and no
-- foreign keys are added anywhere.
--
-- THE VIEW IS COPIED FROM docs/portfolio-review-stands-alone.sql, NOT FROM
-- docs/portfolio-review-schema.sql. The first run of this file took the
-- original definition from the schema file and Postgres refused it: "cannot
-- drop columns from view". The schema file is where the view was BORN; the
-- stands-alone migration on 19 Oct replaced it with eight more columns on it,
-- and the database has had those ever since. Copying the older one would have
-- quietly taken book_name, owes and portfolio_value off the list.

alter table public.portfolio_reviews
  add column if not exists outcome_reason text,
  add column if not exists outcome_note   text not null default '',
  add column if not exists closed_at      timestamptz;

-- THE SAME EIGHT THE CODE KNOWS. lib/portfolio-review.ts holds the labels and
-- lib/portfolio-review.test.ts fails if the two lists drift - the same guard
-- the six statuses already have, for the same reason.
alter table public.portfolio_reviews
  drop constraint if exists portfolio_reviews_reason_known;

alter table public.portfolio_reviews
  add constraint portfolio_reviews_reason_known check (
    outcome_reason is null or outcome_reason in (
      'serviceability',  -- the numbers do not service
      'equity',          -- not enough equity yet
      'fixed_rate',      -- locked in, with a break cost
      'happy',           -- happy where they are
      'selling',         -- selling, so not now
      'credit',          -- credit history in the way
      'timing',          -- nothing wrong, wrong month
      'other'            -- and the note says what
    )
  );

-- A CLOSED REVIEW THAT ALREADY EXISTS STILL NEEDS A CLOSING DATE. updated_at is
-- the closest honest answer we have for rows closed before today - it is the
-- last time anybody touched them, and on a closed review that is the close.
update public.portfolio_reviews
   set closed_at = updated_at
 where status = 'closed' and closed_at is null;

create or replace view public.portfolio_review_list
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
  )                                                          as due_on,
  -- ADDED 26 Oct 2026. Why it was closed, in a word and in your own words, and
  -- when. ON THE END OF THE LIST, deliberately: create-or-replace will add
  -- columns but will not reorder, rename or remove one, so appending is the
  -- only shape of change to this view that does not need it dropped.
  r.outcome_reason,
  r.outcome_note,
  r.closed_at
from public.portfolio_reviews r
left join public.clients c on c.id = r.client_id;

-- ===========================================================================
-- AND TELL THE API TO LOOK AGAIN
-- ===========================================================================
--
-- Supabase keeps its own picture of the tables. Without this it can keep
-- refusing writes to a column that now exists - which is exactly what the
-- "could not find the column in the schema cache" errors were.

notify pgrst, 'reload schema';
-- WHAT THE PORTAL EXPECTS, AND WHAT THIS DATABASE ACTUALLY HAS.
--
-- 26 Oct 2026. Three times in one day a shipped feature failed in front of
-- somebody because a SQL file had been run on staging and not on live:
-- closed_at on portfolio_reviews, the day's notes on daily_plans, and
-- monthly_fee on lender_products - which had been silently refusing EVERY
-- product save for a week.
--
-- Every column below is one a migration in docs/ adds. Run this on a database
-- and it lists the ones that are not there, and the file that would create
-- them. An empty result means that database is up to date.
--
-- READ ONLY. It changes nothing.

with expected(table_name, column_name, from_file) as (values
  ('daily_plans','notes','a-day-is-a-day.sql'),
  ('daily_plans','on_it_now','a-day-is-a-day.sql'),
  ('user_profiles','board_filters','board-filters-schema.sql'),
  ('daily_plans','broker_key','brokers-plan-their-day.sql'),
  ('deals','lo_proceeded_lender','client-confirms-lender-schema.sql'),
  ('deals','lo_wants_call','client-confirms-lender-schema.sql'),
  ('deals','lo_wants_call_at','client-confirms-lender-schema.sql'),
  ('clients','position_source','client-position-schema.sql'),
  ('clients','position_updated_by','client-position-schema.sql'),
  ('deals','contract_loan_amount','contract-funding-schema.sql'),
  ('deals','contract_funding_choice','contract-funding-schema.sql'),
  ('deals','contract_funding_at','contract-funding-schema.sql'),
  ('deals','contract_funding_by','contract-funding-schema.sql'),
  ('deals','contract_stamp_duty','contract-funding-schema.sql'),
  ('deals','contract_deposit','contract-funding-schema.sql'),
  ('credit_officers','phone','credit-officer-phone-schema.sql'),
  ('brokers','colour','deal-board-schema.sql'),
  ('settings','deal_board','deal-board-schema.sql'),
  ('deals','last_saved_by','deal-last-saved-by.sql'),
  ('deals','last_saved_name','deal-last-saved-by.sql'),
  ('deals','last_saved_tab','deal-last-saved-by.sql'),
  ('deals','compliance_sent_at','deal-phase-schema.sql'),
  ('deals','row_version','deal-row-version.sql'),
  ('deals','offer_accepted_at','deal-stages-schema.sql'),
  ('deals','contracts_returned_at','deal-stages-schema.sql'),
  ('deals','settlement_booked_at','deal-stages-schema.sql'),
  ('user_profiles','board_folds','deal-stages-schema.sql'),
  ('deals','docs_received_at','docs-received-schema.sql'),
  ('deals','docs_received_by','docs-received-schema.sql'),
  ('deals','docs_assessor_due_at','docs-received-schema.sql'),
  ('deals','docs_assessor_email_id','docs-received-schema.sql'),
  ('settings','docs_file_notification_user_id','docs-received-schema.sql'),
  ('settings','docs_delay_minutes','docs-received-schema.sql'),
  ('deals','document_progress','document-requests-schema.sql'),
  ('deals','documents_built_from','documents-freshness-schema.sql'),
  ('deals','documents_built_at','documents-freshness-schema.sql'),
  ('deals','documents_built_by','documents-freshness-schema.sql'),
  ('lenders','statement_codes','fact-find-documents-schema.sql'),
  ('deals','handover_progress','handover-progress-schema.sql'),
  ('deals','push_answers','handover-schema.sql'),
  ('deals','is_urgent','handover-schema.sql'),
  ('deals','compliance_needed_by','handover-schema.sql'),
  ('deals','internal_notes','internal-notes-schema.sql'),
  ('lenders','legal_fee_label','lender-fee-wording.sql'),
  ('lender_policy_rules','section','lender-policy-sections-and-tables.sql'),
  ('lender_policy_rules','row_headers','lender-policy-sections-and-tables.sql'),
  ('lender_policy_rules','row_cells','lender-policy-sections-and-tables.sql'),
  ('lender_policy_rules','depends_on','lender-policy-sections-and-tables.sql'),
  ('lender_policy_rules','max_lvr','lender-policy-sections-and-tables.sql'),
  ('lender_policy_rules','min_value','lender-policy-sections-and-tables.sql'),
  ('lender_policy_rules','max_value','lender-policy-sections-and-tables.sql'),
  ('lender_policy_rules','excludes','lender-policy-sections-and-tables.sql'),
  ('lender_documents','body_search','lender-policy-text-and-sections.sql'),
  ('lender_policy_sections','search','lender-policy-text-and-sections.sql'),
  ('deals','lender_reference','lender-reference-schema.sql'),
  ('lenders','reprice_over_percent','lender-reprice-schema.sql'),
  ('compliance_flags','stage','lo-flags-schema.sql'),
  ('settings','lo_style_notes','lo-flags-schema.sql'),
  ('deals','emails_sent','milestone-emails-schema.sql'),
  ('lender_products','monthly_fee','monthly-fee-schema.sql'),
  ('deals','finance_clause_date','notes-alerts-schema.sql'),
  ('deals','contract_price','offer-accepted-schema.sql'),
  ('deals','deposit_paid','offer-accepted-schema.sql'),
  ('deals','deposit_paid_at','offer-accepted-schema.sql'),
  ('deals','solicitor_name','other-side-schema.sql'),
  ('deals','solicitor_email','other-side-schema.sql'),
  ('deals','solicitor_phone','other-side-schema.sql'),
  ('deals','buyers_agent_name','other-side-schema.sql'),
  ('deals','buyers_agent_email','other-side-schema.sql'),
  ('deals','buyers_agent_phone','other-side-schema.sql'),
  ('deals','outstanding_at','outstanding-schema.sql'),
  ('deals','outstanding_by','outstanding-schema.sql'),
  ('deals','outstanding_items','outstanding-schema.sql'),
  ('deals','phase_override','phase-override-schema.sql'),
  ('deals','phase_override_from','phase-override-schema.sql'),
  ('deals','phase_override_at','phase-override-schema.sql'),
  ('portfolio_reviews','book_email2','portfolio-review-contacts.sql'),
  ('portfolio_reviews','book_phone2','portfolio-review-contacts.sql'),
  ('portfolio_reviews','equity_buffer','portfolio-review-email.sql'),
  ('portfolio_reviews','loan_note','portfolio-review-email.sql'),
  ('settings','portfolio_review_copy','portfolio-review-email.sql'),
  ('clients','book_group','portfolio-review-import.sql'),
  ('clients','from_book','portfolio-review-schema.sql'),
  ('settings','portfolio_review_market_text','portfolio-review-schema.sql'),
  ('portfolio_reviews','book_name','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_first_name','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_last_name','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_email','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_phone','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_broker_key','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_row_key','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_group','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_imported_at','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','book_import_run','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','opted_out','portfolio-review-stands-alone.sql'),
  ('portfolio_reviews','opt_out_date','portfolio-review-stands-alone.sql'),
  ('deals','proceeded_source','proceed-source-schema.sql'),
  ('deals','proceeded_by','proceed-source-schema.sql'),
  ('deals','lo_proceeded_source','proceed-source-schema.sql'),
  ('deals','lo_proceeded_by','proceed-source-schema.sql'),
  ('settings','rate_notice','rate-notice-schema.sql'),
  ('lenders','rate_notice_for','rate-notice-schema.sql'),
  ('lenders','rate_notice_from','rate-notice-schema.sql'),
  ('lenders','rate_notice_by','rate-notice-schema.sql'),
  ('lenders','rate_notice_at','rate-notice-schema.sql'),
  ('user_profiles','phone','sender-phone-schema.sql'),
  ('deals','lodged_total','settled-amount-schema.sql'),
  ('deals','lodged_splits','settled-amount-schema.sql'),
  ('deals','settled_total','settled-amount-schema.sql'),
  ('deals','settled_splits','settled-amount-schema.sql'),
  ('settings','statement_rules','staging-catchup.sql'),
  ('deal_statement_uploads','rules','staging-catchup.sql'),
  ('deal_statement_uploads','parsed_meta','staging-catchup.sql'),
  ('deal_statement_uploads','reanalysed_at','staging-catchup.sql'),
  ('settings','statement_payer_rules','staging-catchup.sql'),
  ('deals','is_test','test-deal-schema.sql'),
  ('deals','offer_product','the-loan-now-schema.sql'),
  ('deals','offer_rate','the-loan-now-schema.sql'),
  ('deals','offer_term_years','the-loan-now-schema.sql'),
  ('deals','offer_repayment_type','the-loan-now-schema.sql'),
  ('deals','offer_io_years','the-loan-now-schema.sql'),
  ('deals','bc_owner_officer','who-did-each-stage.sql'),
  ('deals','bc_owner_name','who-did-each-stage.sql'),
  ('deals','bc_owner_since','who-did-each-stage.sql'),
  ('deals','lo_owner_officer','who-did-each-stage.sql'),
  ('deals','lo_owner_name','who-did-each-stage.sql'),
  ('deals','lo_owner_since','who-did-each-stage.sql'),
  ('deals','compliance_owner_officer','who-did-each-stage.sql'),
  ('deals','compliance_owner_name','who-did-each-stage.sql'),
  ('deals','compliance_owner_since','who-did-each-stage.sql'),
  ('portfolio_reviews','outcome_reason','why-it-was-not-suitable.sql'),
  ('portfolio_reviews','outcome_note','why-it-was-not-suitable.sql'),
  ('portfolio_reviews','closed_at','why-it-was-not-suitable.sql')
)
select e.table_name, e.column_name, e.from_file
  from expected e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = e.table_name
   and c.column_name = e.column_name
 where c.column_name is null
   and exists (select 1 from information_schema.tables t
                where t.table_schema = 'public' and t.table_name = e.table_name)
 order by e.from_file, e.table_name, e.column_name;
