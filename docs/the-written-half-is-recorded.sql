-- THE WRITTEN HALF OF THE BUSINESS STARTS BEING RECORDED.
--
-- Run on the live database on 19 Nov 2026. Fabio: "it's very important that
-- the portal does this moving forward... if it is genuinely with the client,
-- it's a sales team that needs to keep in touch with the client. If it's
-- genuinely with us, we need to know how long is it taking for us to do."
--
-- WHAT WAS ALREADY THERE. docs/deal-stage-events.sql, 17 Aug 2026: an
-- append-only table and a trigger that writes a row whenever a milestone date
-- is set, with who set it. It cannot be forgotten by a screen because it is
-- not a screen that writes it.
--
-- WHAT IT WAS NOT WATCHING. Eleven columns, every one of them from lodgement
-- onwards, plus the two moments a client agrees. So the half of the business
-- credit and the brokers are actually measured on - the BC, the lending
-- options, the documents, compliance - had no history at all. Only a current
-- value, in a column anything can overwrite.
--
-- Six names, one list. No new table, no application change, and the trigger
-- picks them up on the next save.
--
-- IT CANNOT GO BACKWARDS. Nothing before the day it ran is recoverable, which
-- is the whole reason it ran the day it was noticed.
--
-- THE OTHER HALF OF THE DOCUMENTS CLOCK was already kept: every request for
-- documents is stamped inside the deal's own document record and appended to,
-- never rewritten - see lib/document-progress.ts. Watching docs_received_at
-- closes it, so "how long were we waiting on the client" is answerable per
-- deal and across the book.

create or replace function deal_stage_columns() returns text[] as $$
  select array[
    -- the written half. Added 19 Nov 2026.
    'bc_completed_at', 'bc_sent_at',
    'lo_completed_at', 'lo_sent_at',
    'docs_received_at', 'compliance_completed_at',
    -- as before
    'proceeded_at', 'lo_proceeded_at', 'compliance_sent_at',
    'lodged_at', 'outstanding_at', 'preapproval_at', 'offer_accepted_at',
    'formal_approval_at', 'contracts_returned_at', 'settlement_booked_at',
    'settled_at'
  ];
$$ language sql immutable;

-- Seventeen names, and the trigger still on the table.
select array_length(deal_stage_columns(), 1) as watched_columns,
       (select count(*) from pg_trigger
         where tgname = 'deals_record_stage_events') as trigger_present;
