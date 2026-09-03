-- WHAT A PERSON DECIDED ABOUT THE DOCUMENT LIST.
--
-- The list of documents itself is NOT stored. It is worked out from the fact
-- find every time the page is opened (lib/document-rules.ts), so changing a
-- client from PAYG to self-employed changes what we ask them for. A list saved
-- when the fact find was filled in would be wrong by the afternoon.
--
-- This column holds only the small number of things a human decided, which no
-- rule could know:
--
--   {
--     "decisions": {
--       "<item key>": { "ticked": true, "at": "<iso>", "by": "<full name>" }
--     },
--     "added": [
--       { "key": "added:...", "label": "Accountant's letter",
--         "forWhat": "lodge", "at": "<iso>", "by": "<full name>" }
--     ]
--   }
--
-- Keys are derived and stable - "payslips:<applicant id>", "rates:<property
-- id>". A key that no longer appears in the list is simply ignored, so deleting
-- a liability takes its row away and cannot break the page. Same shape and same
-- reasoning as deals.handover_progress.
alter table deals add column if not exists document_progress jsonb;

comment on column deals.document_progress is
  'Human decisions about the document request list: which rows were ticked or unticked, and any documents added by hand. The list itself is derived from fact_find_data and never stored.';
