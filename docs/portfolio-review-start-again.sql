-- ===========================================================================
-- CLEARING THE IMPORTED BOOK, IF YOU HAVE TO. 20 October 2026.
--
-- READ THIS BEFORE RUNNING ANY OF IT. You probably do not need it.
-- ===========================================================================
--
-- WHY YOU PROBABLY DO NOT NEED THIS.
--
-- The import matches on the client's name as the CRM writes it - the
-- "Contact - group data - full name" column. Drop the second export in with
-- that column still present and every one of the 656 is UPDATED: the emails
-- and phones fill in, the properties are rebuilt, and anything somebody has
-- already done - a figure typed in, a call logged, a stage, a chase date - is
-- left exactly as it was.
--
-- Deleting and re-importing throws all of that away and gains nothing.
--
-- WHEN YOU DO NEED IT. Only if the second export no longer carries that name
-- column, or carries the names differently enough that the portal reads them
-- as different people. Then a re-import would ADD 656 more rather than update
-- the 656 you have, and starting clean is the only way out.
--
-- HOW TO TELL, BEFORE YOU DELETE ANYTHING: drop the new file into Import the
-- book and read the preview. "656 already here" means it will update and you
-- should close the import rather than run anything below. "656 new" with 656
-- already on the list means the names no longer match, and this file is for
-- that.


-- ---------------------------------------------------------------------------
-- 1. WHAT IS THERE NOW. Reads only. Run this first, always.
-- ---------------------------------------------------------------------------

select 'reviews from the book'            as what, count(*) as how_many
from public.portfolio_reviews where book_row_key is not null
union all
select 'of those, somebody has worked on', count(*)
from public.portfolio_reviews
where book_row_key is not null
  and (status <> 'not_reviewed' or purchase_price is not null
       or equity_release is not null or email_sent_at is not null)
union all
select 'calls and emails logged against them', count(*)
from public.portfolio_review_contacts t
where exists (select 1 from public.portfolio_reviews r
               where r.id = t.review_id and r.book_row_key is not null)
union all
select 'reviews NOT from the book (never touched below)', count(*)
from public.portfolio_reviews where book_row_key is null;


-- ---------------------------------------------------------------------------
-- 2. THE DELETE.
-- ---------------------------------------------------------------------------
--
-- IT CANNOT BE UNDONE. There is no trash and no history behind it.
--
-- If the first query above says anybody has been worked on, stop and say so
-- rather than running this - that work is somebody's afternoon and it is not
-- coming back.
--
-- SCOPED TO THE BOOK, ON PURPOSE. `book_row_key is not null` is only ever set
-- by the import, so a review created any other way is untouched. The
-- properties and the contact history go with it through the cascade the schema
-- already sets, so there is one statement here rather than three.
--
-- Nothing in `clients` is touched by this, because the import never wrote
-- there - see components/BookImport.tsx.

-- Remove the two dashes at the start of the next line to actually run it.
-- delete from public.portfolio_reviews where book_row_key is not null;


-- ---------------------------------------------------------------------------
-- 3. AND WHAT IS LEFT. Reads only.
-- ---------------------------------------------------------------------------

select 'reviews from the book, after' as what, count(*) as how_many
from public.portfolio_reviews where book_row_key is not null;
