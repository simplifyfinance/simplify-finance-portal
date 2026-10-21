-- ============================================================================
-- LOCKING THE FRONT DOOR. THE TABLES.
--
-- Run in the Supabase SQL editor. STAGING FIRST, then LIVE.
-- Safe to run twice: everything is "if not exists" or "create or replace".
-- Nothing is deleted and no existing data is changed.
--
-- 21 October 2026.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS IS FOR
-- ---------------------------------------------------------------------------
--
-- Fabio: "We now have a lot of personal information there and we need to lock
-- in the system... I don't want to be in a position, which I had multiple
-- times, that I leave the portal open and it stays open overnight."
--
-- Password, then a six digit code by email. The browser is then trusted for
-- thirty days, so the code is for a new machine or once a month. Sixty minutes
-- idle and a twelve hour cap end the overnight session.
--
-- ---------------------------------------------------------------------------
-- NOBODY CAN READ EITHER OF THESE TABLES. THAT IS THE POINT.
-- ---------------------------------------------------------------------------
--
-- Row level security is ON and there are NO policies. A table with RLS on and
-- no policy is readable by nobody through the anon or authenticated key - not
-- the owner, not an admin, not a broker. Only the service role key, which lives
-- in Vercel and never reaches a browser, can touch them.
--
-- That is deliberate and it is not an oversight to be "fixed" later. A sign-in
-- code that any logged-in user could read is not a second factor, it is a
-- second copy of the first one.
--
-- AND NOTHING IS STORED AS ITSELF. The code and the trust token are hashed
-- with a per-row salt before they are written, so a copy of this table is not
-- a way into anybody's account.
-- ============================================================================


-- ===========================================================================
-- 1. THE CODES
-- ===========================================================================

create table if not exists public.auth_codes (
  id uuid primary key default gen_random_uuid(),

  -- The Supabase user this code was made for. Deleting a user takes their
  -- codes with them; an orphaned code is a key to a door that moved.
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Kept beside the id for the rate limit, which asks "how many have we sent
  -- to this person in the last hour" without needing to join anything.
  email text not null,

  -- WHAT WE HOLD IS A HASH, NEVER THE CODE. See hashSecret in
  -- lib/two-factor.ts - SHA-256 over "<salt>:<code>".
  code_hash text not null,
  salt text not null,

  expires_at timestamptz not null,

  -- Counted up on every wrong guess. Five and the code is dead, which is what
  -- stops somebody working through a million six digit numbers.
  attempts int not null default 0,

  -- Set the moment it works. A code is for ONE sign-in: without this, a code
  -- sitting in a mailbox stays valid for its whole ten minutes however many
  -- times it is used, including by whoever else can read that mailbox.
  used_at timestamptz,

  -- For reading afterwards if something looks wrong. Not used by any rule.
  requested_ip text,
  requested_agent text,

  created_at timestamptz not null default now()
);

create index if not exists auth_codes_user_idx on public.auth_codes (user_id, created_at desc);
create index if not exists auth_codes_live_idx on public.auth_codes (user_id, used_at, expires_at);

comment on table public.auth_codes is
  'Sign-in codes, hashed. Service role only - RLS is on with no policies on purpose.';


-- ===========================================================================
-- 2. THE TRUSTED BROWSERS
-- ===========================================================================
--
-- Thirty days, so a code is for a new machine rather than every morning. The
-- password is still typed every single time: this skips the SECOND factor, not
-- the first.

create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Hashed, same reason as the code above. The browser holds the only copy.
  token_hash text not null,
  salt text not null,

  expires_at timestamptz not null,

  -- SO A PERSON CAN BE TOLD WHAT THEY ARE SIGNING OUT. "Chrome on a Mac, last
  -- used this morning" is a sentence somebody can act on; a uuid is not.
  label text not null default '',
  last_seen_at timestamptz not null default now(),

  -- Set when somebody presses Sign out everywhere. The row is kept rather than
  -- deleted so there is a record that the laptop was cut off, and when.
  revoked_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists trusted_devices_user_idx on public.trusted_devices (user_id, revoked_at, expires_at);

comment on table public.trusted_devices is
  'Browsers that have passed a code in the last 30 days. Service role only.';


-- ===========================================================================
-- 3. LOCKED TO THE SERVICE ROLE
-- ===========================================================================
--
-- RLS on, no policies. Read the note at the top of this file before adding one.

alter table public.auth_codes      enable row level security;
alter table public.trusted_devices enable row level security;

-- Belt and braces: even without a policy, no grant means no route in.
revoke all on public.auth_codes      from anon, authenticated;
revoke all on public.trusted_devices from anon, authenticated;


-- ===========================================================================
-- 4. TIDYING UP AFTER ITSELF
-- ===========================================================================
--
-- A code is useless ten minutes after it is made and a trust is useless thirty
-- days after it is given. Neither needs keeping, and a table of dead secrets is
-- a liability with no upside.
--
-- Called from the send route, which is the only thing that runs often enough to
-- matter and rare enough not to care about the cost.

create or replace function public.sweep_expired_auth()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_codes
   where created_at < now() - interval '2 days';
  delete from public.trusted_devices
   where expires_at < now() - interval '7 days';
$$;

revoke all on function public.sweep_expired_auth() from anon, authenticated;


-- ===========================================================================
-- 5. DID IT WORK
-- ===========================================================================

select 'auth_codes' as what, count(*) as how_many, 1 as expected
from information_schema.tables
where table_schema = 'public' and table_name = 'auth_codes'
union all
select 'trusted_devices', count(*), 1
from information_schema.tables
where table_schema = 'public' and table_name = 'trusted_devices'
union all
select 'both locked (rls on)', count(*), 2
from pg_tables
where schemaname = 'public'
  and tablename in ('auth_codes', 'trusted_devices')
  and rowsecurity = true
union all
-- MUST BE ZERO. A policy on either table is somebody having "fixed" the thing
-- that makes this a second factor at all.
select 'policies on them (must be 0)', count(*), 0
from pg_policies
where schemaname = 'public' and tablename in ('auth_codes', 'trusted_devices');
