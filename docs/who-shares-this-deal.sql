-- WHO SHARES THIS DEAL, AND ON WHAT TERMS.
--
-- 27 Oct 2026. Fabio: "there is not where in compliance that we can select
-- commissions for that deal so I rather build a section in settings so we can
-- load all commisions by name so broker can seelect in Fact Find Stage what
-- commission split to select so it carries accross to handover notes".
--
-- And Catherine, Operations Manager, the same morning, on one broker writing a
-- deal for another: "capture the right branding and the specific referrer, and
-- carry both through to compliance."
--
-- Two requests, one answer. A split is a named arrangement - an outside
-- referrer paid a share, or two of our own brokers sharing a deal - and it is
-- the same shape either way.
--
-- THIS IS MONEY GOING OUT. It is not the commission library in Settings, which
-- is what the BANKS PAY US - upfront, trail and clawback per lender, in
-- public.commission_rates. These two must never be confused, which is why this
-- table is named for the question it answers rather than for the word
-- "commission".
--
-- NOTHING IS CALCULATED YET, DELIBERATELY. This records the arrangement and
-- carries it to the people who need to see it. Turning it into dollars means
-- joining it to what a lender actually paid, which is the commissions screen
-- and a bigger job that should not hold this one up.

-- ---------------------------------------------------------------------------
-- THE LIST
-- ---------------------------------------------------------------------------

create table if not exists public.commission_splits (
  id          uuid primary key default gen_random_uuid(),
  -- What the broker picks it by. "Harrow Financial Planning", or
  -- "Mark writes for Justin".
  name        text not null,
  -- 'referrer' - somebody outside the business who sent us the deal.
  -- 'broker_split' - two of ours sharing one deal.
  kind        text not null default 'referrer',
  -- Who, in person. Free text: a referrer is a company with a contact in it,
  -- and a broker split is two names. Not a join - see the note below.
  who         text,
  contact_email text,
  -- The share THEY get, not the share we keep. Nulls are not zero: a share
  -- nobody has recorded is unknown, and must not read as "they get nothing".
  upfront_pct numeric(5,2),
  trail_pct   numeric(5,2),
  notes       text,
  -- SWITCHED OFF, NEVER DELETED. A split a deal already used has to keep
  -- existing or that deal stops making sense. False takes it out of the
  -- dropdown and leaves every deal that used it exactly as it is.
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz
);

comment on table public.commission_splits is
  'Named arrangements for sharing a deal - a referrer paid a share, or two brokers splitting one. Money going OUT. What the banks pay US is public.commission_rates.';
comment on column public.commission_splits.kind is
  'referrer | broker_split. Both are the same shape; the word changes what the screen calls it.';
comment on column public.commission_splits.upfront_pct is
  'The share THEY get of the upfront, as a percentage. Null means nobody has recorded it - which is not the same as zero.';
comment on column public.commission_splits.active is
  'False hides it from the dropdown. Rows are never deleted: a deal that used one has to keep making sense.';

create index if not exists commission_splits_active_idx
  on public.commission_splits (active, name);

alter table public.commission_splits enable row level security;

-- Everybody signed in can read the list - the broker picking one on the fact
-- find needs it, and so does the credit assessor reading the handover.
drop policy if exists commission_splits_read on public.commission_splits;
create policy commission_splits_read on public.commission_splits
  for select to authenticated using (true);

-- Changing the list is a Settings action.
drop policy if exists commission_splits_write on public.commission_splits;
create policy commission_splits_write on public.commission_splits
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- WHAT THE DEAL REMEMBERS
-- ---------------------------------------------------------------------------
--
-- THE DEAL KEEPS ITS OWN COPY OF THE TERMS, not just a pointer at the row.
--
-- Percentages get renegotiated. If a deal only stored the id, editing a split
-- in Settings would silently rewrite history on every deal that ever used it -
-- a settled deal would start claiming a share nobody agreed to at the time.
--
-- So the id says which arrangement, and the four columns beside it say what it
-- said ON THE DAY somebody chose it. The same reason bc_owner_name sits beside
-- bc_owner_officer: the name on the screen must not change because a register
-- changed underneath it.
--
-- NO FOREIGN KEY on commission_split_id. Same decision as
-- docs/who-did-each-stage.sql, and for the same afternoon's reason.

alter table public.deals
  add column if not exists commission_split_id      uuid,
  add column if not exists commission_split_name    text,
  add column if not exists commission_split_kind    text,
  add column if not exists commission_split_upfront numeric(5,2),
  add column if not exists commission_split_trail   numeric(5,2),
  add column if not exists commission_split_at      timestamptz,
  add column if not exists commission_split_by      text,
  -- ANSWERED "NOBODY" IS AN ANSWER. It is different from never having been
  -- asked, and compliance needs to tell those apart - one is a deal that is
  -- ours alone, the other is a deal nobody has checked.
  add column if not exists commission_split_none    boolean;

comment on column public.deals.commission_split_id is
  'Which arrangement in public.commission_splits. Null with commission_split_none true means answered: this deal is all ours.';
comment on column public.deals.commission_split_name is
  'The arrangement''s name as it stood when it was chosen. Kept so editing the list in Settings cannot rewrite a settled deal.';
comment on column public.deals.commission_split_upfront is
  'The share they got of the upfront, as agreed on the day. Not read back from the list.';
comment on column public.deals.commission_split_none is
  'True where somebody answered "nobody - this one is all ours". Null means nobody has been asked yet, which compliance shows in red.';

-- A CHECK OF WHAT YOU JUST RAN. Expect 8 and 1.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'deals'
      and column_name like 'commission\_split%') as new_deal_columns,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'commission_splits') as new_table;
