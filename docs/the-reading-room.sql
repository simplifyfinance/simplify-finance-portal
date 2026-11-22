-- ===========================================================================
-- THE READING ROOM: WHERE A BIG DOCUMENT WAITS WHILE IT IS READ
-- ===========================================================================
--
-- 22 Nov 2026. Belle, trying to upload the unsigned and signed loan documents
-- on a refinance:
--
--     Unexpected token 'R', "Request En"... is not valid JSON
--
-- "Request En" is "Request Entity Too Large". Vercel refuses any request body
-- over 4.5 MB and answers in plain text; the screen called res.json() on it
-- and showed the parser's complaint. Because the PDF is sent as base64, which
-- is a third bigger than the file, the real ceiling was a PDF of about 3.3 MB.
-- A signed loan document pack is routinely larger than that, so the biggest
-- job the settlements team has - Fabio, 17 Nov: "the biggest task we have in
-- our team is to make sure the rates is correct" - was the one the portal
-- could not do.
--
-- It was never only the contracts. Four drop zones send a PDF the same way:
-- loan contracts, signed loan documents, the fact find and payslips.
--
-- THE FILE STILL IS NOT KEPT. Fabio, 17 Nov 2026: "when I say throw away as we
-- dont need to store the documents after reading but obviously we retain all
-- data." That rule has not changed and this bucket does not bend it in spirit:
-- the PDF goes in, the reader picks it up, and the reader deletes it before it
-- answers - in a finally, so a document that cannot be read is deleted too.
-- Fabio approved this on 22 Nov knowing the file exists for the length of one
-- read.
--
-- THREE THINGS KEEP IT HONEST, because "it deletes itself afterwards" is a
-- promise that is only as good as the code that keeps it:
--
--   1. The reader deletes in a finally. See app/api/read-loan-contract.
--   2. lib/the-reading-room-is-emptied.test.ts refuses a reader that uploads
--      without a delete beside it.
--   3. sweep_the_reading_room() below removes anything older than an hour,
--      whatever happened to the request that put it there.
--
-- NOBODY CAN READ ANOTHER PERSON'S DROP. A person may put a file in their own
-- folder and nothing else - no select, no list, no update. Only the reader,
-- which runs with the service role, can take one out.
--
-- Run this on LIVE and on STAGING.

-- ---------------------------------------------------------------------------
-- 1. THE BUCKET
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reading-room', 'reading-room', false)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 2. YOU MAY PUT A FILE IN YOUR OWN FOLDER. THAT IS ALL.
-- ---------------------------------------------------------------------------
--
-- The path is <auth.uid()>/<something>.pdf and the policy checks the first
-- folder against the caller. A browser that writes somebody else's uid into
-- the path is refused by the database, not by us.
--
-- There is deliberately NO select policy. A person cannot read back even their
-- own drop: there is no reason to, and a bucket you can read is a bucket
-- somebody can be talked into reading out of.
drop policy if exists reading_room_put_your_own on storage.objects;
create policy reading_room_put_your_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reading-room'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ---------------------------------------------------------------------------
-- 3. AND IT IS EMPTIED, WHATEVER HAPPENED
-- ---------------------------------------------------------------------------
--
-- The reader deletes what it read. This is for the request that never got
-- there - a browser closed mid-upload, a function that died, a deploy in the
-- middle of a read. An hour is long enough that it can never race a live read
-- and short enough that nothing sits here.
--
-- Call it from the same place sweep_expired_auth() is called.
create or replace function public.sweep_the_reading_room()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  gone integer;
begin
  with removed as (
    delete from storage.objects
     where bucket_id = 'reading-room'
       and created_at < now() - interval '1 hour'
    returning 1
  )
  select count(*) into gone from removed;
  return gone;
end;
$$;

revoke all on function public.sweep_the_reading_room() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. DID IT WORK
-- ---------------------------------------------------------------------------
select 'bucket reading-room' as what, count(*) as how_many, 1 as expected
from storage.buckets where id = 'reading-room'

union all
select 'and it is private', count(*), 1
from storage.buckets where id = 'reading-room' and public = false

union all
select 'put-your-own policy', count(*), 1
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname = 'reading_room_put_your_own'

union all
-- NOBODY MAY READ OUT OF IT. If this is ever more than 0, somebody added a
-- select policy and the reading room became a filing cabinet.
select 'policies that can READ it', count(*), 0
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and cmd in ('SELECT', 'ALL')
  and qual like '%reading-room%'

union all
select 'the sweep', count(*), 1
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'sweep_the_reading_room';
