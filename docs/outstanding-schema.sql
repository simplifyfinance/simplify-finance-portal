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
