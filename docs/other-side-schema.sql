-- WHO ELSE IS ON A PURCHASE.
--
-- Fabio, 29 Sep 2026: "we should have a spot do solictors details so they also
-- recieve apporval??? when it is a purchase" - and then "add buers agent as
-- well".
--
-- HE FOUND A HOLE. A draft of the formal approval email said "we have let your
-- solicitor and your buyers agent know". The portal cannot do that and cannot
-- know it: there is nowhere on a deal to record a solicitor at all, not a name
-- and not an email. The only mention of one anywhere is a tick on the settlement
-- panel reading "Checked with the solicitor", with nothing behind it saying who.
--
-- His answer is the better one. Do not claim they were told - COPY THEM IN, and
-- the sentence is true because they are reading it.
--
-- NEITHER IS COMPULSORY. Plenty of purchases have no buyers agent, and a blank
-- is a fact rather than a gap: nothing nags, and nothing about them appears in
-- the email. The email never says anybody was told unless they are on the copy
-- line of the email doing the telling.
--
-- Safe to run twice.

alter table deals add column if not exists solicitor_name   text;
alter table deals add column if not exists solicitor_email  text;
alter table deals add column if not exists solicitor_phone  text;

alter table deals add column if not exists buyers_agent_name  text;
alter table deals add column if not exists buyers_agent_email text;
alter table deals add column if not exists buyers_agent_phone text;

comment on column deals.solicitor_email is
  'Copied in on the formal approval, so the email saying they were told is true. A name with no email is shown as a gap on the send screen rather than a silent omission.';
comment on column deals.buyers_agent_email is
  'Same as the solicitor. Recorded on the Offer accepted panel, purchases only, and never compulsory.';

select count(*) filter (where solicitor_email is not null)    as have_a_solicitor,
       count(*) filter (where buyers_agent_email is not null) as have_a_buyers_agent
  from deals;
