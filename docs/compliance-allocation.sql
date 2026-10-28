-- WHO THE COMPLIANCE PACK GOES TO, AND WHO ALREADY HAS ONE TODAY.
--
-- 28 Oct 2026. The pack got its own recipient this morning. Fabio, the same
-- afternoon: "I need to be able to choose two people, not just one... it goes
-- to the first person until we hit the number of that particular day of five.
-- Once we hit five, anything after that goes to person number two."
--
-- THE COUNT IS NOT KEPT ANYWHERE. It is counted from the deals themselves -
-- how many packs carry today's date - so there is no tally to drift, nothing to
-- reset at midnight, and nothing that can disagree with the deal card or the
-- workload tab. Every number in this feature is derived from the same three
-- columns below.
--
-- WORKING DAYS ONLY. Monday to Friday, excluding NSW public holidays, from the
-- list lib/the-week.ts already keeps for Today and the credit team.

-- --- Settings: the two people and the day's number ---------------------------
--
-- compliance_issued_notification_user_id already exists - see
-- docs/compliance-pack-recipient.sql. It is now "first".

alter table settings add column if not exists compliance_issued_backup_user_id uuid;
alter table settings add column if not exists compliance_daily_cap integer;

comment on column settings.compliance_issued_backup_user_id is
  'The second person. Everything after the day''s cap goes here, with no limit. Null means there is no second person and everything stays with the first.';
comment on column settings.compliance_daily_cap is
  'How many packs the first person takes on a working day before the rest go to the second. Null means the built-in default of 5.';

-- --- The deal: who got the pack, and when ------------------------------------

alter table deals add column if not exists compliance_pack_user_id uuid;
alter table deals add column if not exists compliance_pack_user_name text;
alter table deals add column if not exists compliance_pack_at timestamptz;

comment on column deals.compliance_pack_user_id is
  'Who the Fact Find, Handover and Broker Notes went to. Set on the first push and kept - pushing the same deal again does not move it or use another slot. Changed only by a deliberate reassign.';
comment on column deals.compliance_pack_user_name is
  'Their name as it was at the time, so a deal still reads correctly after somebody leaves the team.';
comment on column deals.compliance_pack_at is
  'When the pack was first sent. THIS IS WHAT THE DAY''S COUNT IS COUNTED FROM, so it is deliberately not touched by a reassign - moving a deal to somebody else must not quietly free up a slot in a day that has already happened.';

-- Counting today's packs is the hot path: it runs on every push.
create index if not exists deals_compliance_pack_at_idx on deals (compliance_pack_at);
