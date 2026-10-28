-- LEAVE DATES FOR THE PEOPLE WHO RECEIVE THE COMPLIANCE PACK.
--
-- 28 Oct 2026. Fabio: "we need to have the ability of if someone is off, it
-- will always allocate to the other. So if number one is off, it always goes to
-- number two. If number two is off, there's no overflow. It just keeps floating
-- to number one... So just put a warning somewhere."
--
-- IT BELONGS TO THE PERSON, NOT TO THE SETTING. Ellesse is away; the "first
-- compliance slot" is not. Put it on the setting and the dates stay behind when
-- somebody is swapped out, which is the version that quietly sends a fortnight
-- of packs to an empty desk.
--
-- The credit team already works exactly this way - credit_officers has
-- on_leave_from and on_leave_until, and lib/allocate-officer.ts skips anyone
-- whose range covers today. Same two column names here, so there is one idea in
-- this database called "on leave" rather than two.
--
-- SAFE TO RUN TWICE. Nothing is dropped and nothing is backfilled - every
-- existing row gets null, which means nobody is away, which is what was true
-- before this ran.
--
-- RUN THIS ON LIVE AND ON STAGING.

alter table user_profiles add column if not exists on_leave_from date;
alter table user_profiles add column if not exists on_leave_until date;

comment on column user_profiles.on_leave_from is
  'First day of leave, inclusive. Null means not away. Set from Settings. Read by lib/compliance-allocation.ts when deciding who receives the compliance pack.';

comment on column user_profiles.on_leave_until is
  'Last day of leave, inclusive. Null means not away. A range needs BOTH dates to count - one on its own is treated as not away, so a half-finished entry never diverts anybody''s work.';
