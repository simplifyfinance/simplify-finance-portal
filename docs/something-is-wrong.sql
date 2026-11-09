-- SOMETHING'S WRONG HERE.
--
-- 17 Aug 2026. Alan's November brief, item 5, and his clarification: "It's a
-- correction workflow: someone on the team spots something wrong, they flag it
-- in the portal, Cath gets copied in, and she checks that the fix has actually
-- been applied so the same error doesn't come back. Close the loop, don't
-- repeat the mistake."
--
-- NOT A LOG AND NOT A SCOREBOARD. There is no count anywhere, no name against
-- a mistake, and no monthly total. The list exists to be emptied.
--
-- THREE STATES, FROM THREE DATES. Raised, fixed, checked - the same pattern as
-- every stage on a deal, for the same reason: a date says when as well as
-- whether, and nothing has to be kept in step with anything else.
--
-- FIXED AND CHECKED ARE NOT THE SAME THING. Somebody says they fixed it; until
-- the person who owns the correction has looked, it is not done. That gap is
-- the whole of what Alan asked for.

create table if not exists deal_flags (
  id            uuid primary key default gen_random_uuid(),

  -- NULL ON A LIBRARY FLAG. A wrong fee is usually spotted in the lender
  -- library rather than on somebody's deal, and a flag raised there has no
  -- deal behind it. That is not a gap, it is the point.
  deal_id       uuid references deals(id) on delete set null,

  -- Which screen it was seen on: 'Fact find', 'Lending options', 'Lender
  -- library' and so on. Free text rather than an enum, because a screen added
  -- next month must not need a migration before anybody can flag it.
  where_at      text not null,

  -- 'library' is wrong for everybody until it is fixed. 'deal' is this file
  -- only. The difference decides what gets looked at first.
  scope         text not null default 'deal' check (scope in ('library', 'deal')),

  description   text not null,

  raised_by     uuid,
  raised_by_name text,
  raised_at     timestamptz not null default now(),

  -- Someone has made the change.
  fixed_at      timestamptz,
  fixed_by_name text,

  -- And someone has confirmed it is actually there. This is the one that
  -- closes it.
  checked_at    timestamptz,
  checked_by_name text,

  -- SENT BACK. "Not fixed yet" clears fixed_at and records why, so the trail
  -- shows a fix that did not hold rather than quietly rewinding.
  sent_back_at  timestamptz,
  sent_back_why text,

  created_at    timestamptz not null default now()
);

create index if not exists deal_flags_open on deal_flags(checked_at, raised_at);
create index if not exists deal_flags_deal on deal_flags(deal_id, raised_at);

comment on table deal_flags is
  'Something wrong spotted on a screen, and the loop that closes it: raised, fixed, checked. Not a log and not a count. See lib/something-is-wrong.ts.';

alter table deal_flags enable row level security;

-- Anyone signed in can raise one and read them. Deliberate: the person who
-- spots a wrong fee is whoever happened to be looking at it.
drop policy if exists deal_flags_read on deal_flags;
create policy deal_flags_read on deal_flags
  for select to authenticated using (true);

drop policy if exists deal_flags_raise on deal_flags;
create policy deal_flags_raise on deal_flags
  for insert to authenticated with check (true);

drop policy if exists deal_flags_work on deal_flags;
create policy deal_flags_work on deal_flags
  for update to authenticated using (true);

-- ---------------------------------------------------------------------------
-- WHO IS TOLD. A setting, not a name in the code.
--
-- Fabio, 17 Aug 2026: "change to tell management not Catherine in case she
-- moves on". The last time a list of names went into the code it was ten
-- lenders and their approval terms, and correcting one meant a ship.
--
-- Comma separated, read by the route that sends. Empty means nobody is
-- emailed and the flag still appears on the list, which is the honest
-- behaviour rather than silently dropping it.
-- ---------------------------------------------------------------------------
alter table settings
  add column if not exists flag_recipients text;

update settings set flag_recipients = 'info@simplifyfinance.com.au'
  where id = 'singleton' and flag_recipients is null;
