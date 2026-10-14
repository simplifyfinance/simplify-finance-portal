-- THE SEARCH, AFTER ACTUALLY MEASURING IT.
--
-- Run this once in the Supabase SQL editor, STAGING FIRST, then live, AFTER
-- docs/lender-policy-text-and-sections.sql. Safe to run twice.
--
-- 14 Oct 2026. Fabio: "I rather you really spend time on it before we move
-- ahead as this has wasted hours of my time."
--
-- So before any of this went near his database, the whole thing was stood up
-- on a real Postgres with the real schema, loaded with the real Macquarie
-- guidelines through the real splitter - 56,999 characters, 25 sections - and
-- asked fifteen questions a broker would actually ask.
--
-- The first version got SEVEN of them wrong, including two that returned
-- nothing at all. None of that would have shown up in a unit test, because
-- every piece worked; it was the ranking that did not. What follows is the
-- three things that measurement changed.
--
-- ---------------------------------------------------------------------------
-- ONE. THE TITLE HAD NO WEIGHT, SO FREQUENCY WON.
-- ---------------------------------------------------------------------------
--
-- Ask "cash out" and the top answer was "3G Commitments, Negative gearing" -
-- above the section literally called "1A Equity release and cash out".
--
-- Two reasons, both invisible from the outside. "out" is an English stopword,
-- so the query is really just 'cash'. And 3G says "cash" eleven times (cash
-- flow, net cash) against 1A's three. The context line naming the section was
-- indexed in exactly the same breath as the body, so being the section ABOUT
-- cash out counted for nothing against saying the word more often.
--
-- Now the context line is weight A and the body weight B. What a section is
-- called outranks how often it repeats a word.
--
-- ---------------------------------------------------------------------------
-- TWO. EVERY WORD WAS REQUIRED, SO REAL QUESTIONS RETURNED NOTHING.
-- ---------------------------------------------------------------------------
--
-- "can a casual worker borrow" returned zero rows. websearch_to_tsquery ANDs
-- every word: 'casual' & 'worker' & 'borrow'. The document covers casual
-- income perfectly well, but no single section contains all three words, so
-- the honest-looking answer was "nothing recorded" - which is a lie, and the
-- worst kind, because it is indistinguishable from the truthful one.
--
-- So it asks for all the words first, and only if that finds nothing does it
-- ask for any of them. `loosened` comes back true when that happened, so the
-- screen can say "nothing matched all of that, so here is the closest" rather
-- than presenting a looser answer as a precise one.
--
-- ---------------------------------------------------------------------------
-- THREE. LONG SECTIONS WON ON VOLUME.
-- ---------------------------------------------------------------------------
--
-- ts_rank_cd rewards density and takes no account of length. Swapping to
-- ts_rank with normalisation 1 - divide by 1 + log(length) - took the question
-- set from 8 right to 14 right out of 15, with all 15 inside the top two.
--
-- Fourteen rather than fifteen is deliberate. "what LVR can I go to with LMI"
-- puts 1A a hair above 1D, and both come back, because Paco is handed the top
-- FIVE sections and not the top one. Chasing the last one would be tuning to a
-- single document.
--
-- AND WHAT IS STILL TRUE. "crypto currency as a deposit" finds nothing on the
-- strict pass because the word appears nowhere in the document. That is the
-- right answer and it must stay the right answer.


-- ===========================================================================
-- 1. WHAT A SECTION IS CALLED OUTRANKS WHAT IT REPEATS
-- ===========================================================================
--
-- The column is generated, so it cannot be altered in place - it is dropped
-- and rebuilt. Nothing is lost: every value in it is derived from context and
-- body, which are untouched.
alter table public.lender_policy_sections drop column if exists search;

alter table public.lender_policy_sections
  add column search tsvector generated always as (
    -- A: "Macquarie — Credit Guidelines v14.1 — 1A Equity release and cash out"
    setweight(to_tsvector('english', coalesce(context, '')), 'A') ||
    -- B: the section's own words
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored;

drop index if exists lender_policy_sections_search_idx;
create index lender_policy_sections_search_idx
  on public.lender_policy_sections using gin (search);


-- ===========================================================================
-- 2. ALL THE WORDS, THEN ANY OF THEM
-- ===========================================================================
--
-- DROPPED, NOT REPLACED. `create or replace function` cannot change a return
-- type, and this adds `loosened`. Running the create alone against a database
-- that already has the old one fails with "cannot change return type of
-- existing function" - which is exactly what happened the first time this was
-- tried, on the test database rather than on yours.
drop function if exists public.paco_find_sections(uuid, text, int, date);

create function public.paco_find_sections(
  p_lender uuid,
  p_query  text,
  p_limit  int default 5,
  p_today  date default current_date
)
returns table (
  section_id uuid,
  document_id uuid,
  title    text,
  number   text,
  path     text,
  part     text,
  body     text,
  tier     text,
  chars    int,
  score    real,
  -- True when nothing matched all the words and this is the any-of-them pass.
  -- Said out loud so a looser answer is never presented as a precise one.
  loosened boolean
)
language sql
stable
set search_path = public
as $$
  with asked as (
    select websearch_to_tsquery('english', p_query) as strict
  ),
  pair as (
    -- The loose form is built from the strict one's own text, so every word is
    -- already normalised and escaped by Postgres. Nothing from the question
    -- reaches tsquery as raw text.
    select strict, nullif(replace(strict::text, '&', '|'), '')::tsquery as loose
    from asked
  ),
  live as (
    select s.* from public.lender_policy_sections s
    join public.lender_documents d on d.id = s.document_id
    where s.lender_id = p_lender
      and s.read_run = d.current_read
      and (s.effective_from is null or s.effective_from <= p_today)
      and (s.effective_to   is null or s.effective_to   >  p_today)
  ),
  tight as (
    select exists (select 1 from live, pair where live.search @@ pair.strict) as any_strict
  ),
  pick as (
    select case when tight.any_strict then pair.strict else pair.loose end as q,
           not tight.any_strict as loosened
    from pair, tight
  )
  select live.id, live.document_id, live.title, live.number, live.path,
         live.part, live.body, live.tier, live.chars,
         -- 1 = divide by 1 + log(length). Without it a long section wins on
         -- volume alone, which is how negative gearing beat equity release.
         ts_rank(live.search, pick.q, 1) as score,
         pick.loosened
  from live, pick
  where pick.q is not null and live.search @@ pick.q
  order by score desc, live.ordinal
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;


-- ===========================================================================
-- 3. THE SAME TREATMENT ACROSS EVERY LENDER AT ONCE
-- ===========================================================================
--
-- "Which lenders allow cash out above 80%" is the question that cannot be
-- answered by handing over one document, and it needs the same ranking or it
-- will put the wrong bank first.
drop function if exists public.paco_find_sections_anywhere(text, int, date);

create function public.paco_find_sections_anywhere(
  p_query text,
  p_limit int default 12,
  p_today date default current_date
)
returns table (
  section_id uuid, lender_id uuid, document_id uuid,
  title text, number text, path text, body text, tier text,
  score real, loosened boolean
)
language sql
stable
set search_path = public
as $$
  with asked as (select websearch_to_tsquery('english', p_query) as strict),
  pair as (
    select strict, nullif(replace(strict::text, '&', '|'), '')::tsquery as loose from asked
  ),
  live as (
    select s.* from public.lender_policy_sections s
    join public.lender_documents d on d.id = s.document_id
    where s.read_run = d.current_read
      and (s.effective_from is null or s.effective_from <= p_today)
      and (s.effective_to   is null or s.effective_to   >  p_today)
  ),
  tight as (select exists (select 1 from live, pair where live.search @@ pair.strict) as any_strict),
  pick as (
    select case when tight.any_strict then pair.strict else pair.loose end as q,
           not tight.any_strict as loosened
    from pair, tight
  )
  select live.id, live.lender_id, live.document_id, live.title, live.number,
         live.path, live.body, live.tier,
         ts_rank(live.search, pick.q, 1) as score, pick.loosened
  from live, pick
  where pick.q is not null and live.search @@ pick.q
  order by score desc, live.lender_id, live.ordinal
  limit greatest(1, least(coalesce(p_limit, 12), 40));
$$;


-- ===========================================================================
-- 4. AND THE FLOOR, RANKED THE SAME WAY
-- ===========================================================================
--
-- Documents whose words match, for a lender whose documents have not been
-- split - or whose splitting failed. This is what makes a failed read a worse
-- answer rather than no answer.
drop function if exists public.paco_find_documents(uuid, text, int);

create function public.paco_find_documents(
  p_lender uuid, p_query text, p_limit int default 3
)
returns table (
  document_id uuid, title text, body_chars int, sectioned boolean,
  score real, loosened boolean
)
language sql
stable
set search_path = public
as $$
  with asked as (select websearch_to_tsquery('english', p_query) as strict),
  pair as (
    select strict, nullif(replace(strict::text, '&', '|'), '')::tsquery as loose from asked
  ),
  live as (select * from public.lender_documents where lender_id = p_lender),
  tight as (select exists (select 1 from live, pair where live.body_search @@ pair.strict) as any_strict),
  pick as (
    select case when tight.any_strict then pair.strict else pair.loose end as q,
           not tight.any_strict as loosened
    from pair, tight
  )
  select live.id, live.title, live.body_chars,
         (live.current_read is not null) as sectioned,
         ts_rank(live.body_search, pick.q, 1) as score, pick.loosened
  from live, pick
  where pick.q is not null and live.body_search @@ pick.q
  order by score desc
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

grant execute on function public.paco_find_sections(uuid, text, int, date) to authenticated;
grant execute on function public.paco_find_sections_anywhere(text, int, date) to authenticated;
grant execute on function public.paco_find_documents(uuid, text, int) to authenticated;
