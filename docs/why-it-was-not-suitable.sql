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
