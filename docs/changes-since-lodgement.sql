-- WHAT CHANGED AFTER THE DEAL WENT TO THE LENDER.
--
-- 17 Aug 2026. A client moved house during the application. The fact find is
-- read only past lodgement, and rightly so - it is what the lender was told.
-- So the new address had nowhere to go, and the team were unlocking deals to
-- type over the record of what was submitted.
--
-- This holds the change BESIDE the lodged answer, never over it. The lodged
-- fact find is untouched; this is a list of "and now it is this", each one
-- carrying who said so and when.
--
-- jsonb on the deal, like fact_find_data and bc_data beside it. Each entry:
--   { id, field, label, applicantId, applicantName, was, now, note,
--     byName, byId, at, lenderToldAt, appliedAt, undoneAt }
alter table deals
  add column if not exists changes_since_lodgement jsonb not null default '[]'::jsonb;

comment on column deals.changes_since_lodgement is
  'Fact find answers that changed after lodgement. Recorded beside the lodged record, never over it. See lib/changed-since-lodgement.ts.';

-- WHERE A CHANGE LANDS WHEN THE DEAL SETTLES.
--
-- The client record already holds email and phone. It does not hold where they
-- live, who they work for, or whether they are married - so a change to any of
-- those had nowhere to be carried TO, and the settlement question would have
-- been a tick box that did nothing for three of the five fields.
alter table clients
  add column if not exists address text,
  add column if not exists employer text,
  add column if not exists marital_status text;

comment on column clients.address is
  'Where they live now. Written from a deal at settlement, never from a lodged fact find.';
