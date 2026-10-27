-- SENDING A DEAL BACK TO CREDIT, WITH THE REASON ATTACHED.
--
-- 27 Oct 2026. Fabio: "we have situatiomns where credit has worked on a BC but
-- broker asked credit to reword that deal for exmaple do a different sceanrtio
-- based on conversation with cleints. How can we communicate with credit person
-- thgat this needs a rework so it gets flagged in her queue and needs rework?"
--
-- The portal could already move a deal back. What it could never carry was WHY.
-- The email it sends today says "Check with the broker whether this still needs
-- working on", which is the portal admitting it does not know and making
-- somebody pick up a phone. These twelve columns are the reason, written down.
--
-- SIX PER STAGE, AND THE BC AND THE LENDING OPTIONS GET THE SAME SIX:
--
--   _rework_at        when it was sent back. Null means it never was.
--   _rework_by        the broker's name, for the chip and the email.
--   _rework_why       one of six keys - see REWORK_REASONS in lib/send-it-back.ts.
--   _rework_note      the broker's own words. This is what she reads.
--   _rework_count     how many times this stage has gone back. Never resets.
--   _rework_was_sent  the date the client was first emailed this stage.
--
-- THERE IS NO "IS IT STILL IN REWORK" COLUMN, DELIBERATELY. A rework is open
-- while it has been sent back and bc_completed_at is null - and pressing Done
-- sets bc_completed_at, which closes it. One fact, so nothing can disagree with
-- anything. See reworkOn() in lib/send-it-back.ts.
--
-- WHY _rework_was_sent EXISTS. Sending a BC back clears bc_sent_at as well as
-- bc_completed_at. That is what puts the deal back with credit on the ladder,
-- and it is also what unlocks the Send to client button - Fabio, the same hour:
-- "once we mark email sent it locks and we cant resend the email with rewoked
-- figures". Clearing that date is not a claim that nothing was ever sent, so the
-- date it first went out is kept here. Nothing is lost.
--
-- NOTHING EXISTING IS CHANGED OR DROPPED. Twelve new columns, all nullable
-- except the two counts, which default to 0. Every deal already in the table
-- reads as "never sent back", which is true.
--
-- NO FOREIGN KEY ON _rework_by. It is a name for a screen, not a join - the
-- same decision as docs/who-did-each-stage.sql, and for the same reason.
--
-- RUN ON STAGING FIRST, then live.

alter table public.deals
  add column if not exists bc_rework_at       timestamptz,
  add column if not exists bc_rework_by       text,
  add column if not exists bc_rework_why      text,
  add column if not exists bc_rework_note     text,
  add column if not exists bc_rework_count    integer not null default 0,
  add column if not exists bc_rework_was_sent timestamptz,
  add column if not exists lo_rework_at       timestamptz,
  add column if not exists lo_rework_by       text,
  add column if not exists lo_rework_why      text,
  add column if not exists lo_rework_note     text,
  add column if not exists lo_rework_count    integer not null default 0,
  add column if not exists lo_rework_was_sent timestamptz;

comment on column public.deals.bc_rework_at is
  'When a broker sent the BC back to credit. The rework is OPEN while this is set and bc_completed_at is null - there is no separate flag. Written by app/api/send-it-back/route.ts.';
comment on column public.deals.bc_rework_by is
  'The broker who sent it back, by name. For the chip on the credit assessor''s day and the email she gets. Not a join.';
comment on column public.deals.bc_rework_why is
  'One of six keys - scenario, client_changed, figures, lender, missing, other. See REWORK_REASONS in lib/send-it-back.ts.';
comment on column public.deals.bc_rework_note is
  'The broker''s own words, required. This is what the credit assessor reads before she opens the deal.';
comment on column public.deals.bc_rework_count is
  'How many times this BC has been sent back. Never resets - a deal on its third rework is a thing somebody should see.';
comment on column public.deals.bc_rework_was_sent is
  'The bc_sent_at we cleared when sending it back, so the date the client was first emailed is never lost. Only the first one is kept.';

comment on column public.deals.lo_rework_at is
  'When a broker sent the lending options back to credit. Open while this is set and lo_completed_at is null.';
comment on column public.deals.lo_rework_by is
  'The broker who sent it back, by name. Not a join.';
comment on column public.deals.lo_rework_why is
  'One of six keys - see REWORK_REASONS in lib/send-it-back.ts.';
comment on column public.deals.lo_rework_note is
  'The broker''s own words, required.';
comment on column public.deals.lo_rework_count is
  'How many times the lending options have been sent back. Never resets.';
comment on column public.deals.lo_rework_was_sent is
  'The lo_sent_at we cleared when sending it back. Only the first one is kept.';

-- A CHECK OF WHAT YOU JUST RAN. Expect 12.
select count(*) as new_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'deals'
  and column_name like '%\_rework\_%';
