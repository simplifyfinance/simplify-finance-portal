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
