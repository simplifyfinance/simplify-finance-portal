-- THE TEXT IS NEVER LOST, AND A DOCUMENT COMES APART INTO ITS OWN SECTIONS.
--
-- Run this once in the Supabase SQL editor, STAGING FIRST, then live, AFTER
-- docs/lender-documents-schema.sql and docs/lender-policy-sections-and-tables.sql.
-- Safe to run twice: everything is "if not exists" or "create or replace".
--
-- 13 Oct 2026, written the night Fabio said: "if I cant build a simple file
-- where each banks informatiomn is there and can be searcehd what hope do i
-- have".
--
-- ---------------------------------------------------------------------------
-- WHAT WENT WRONG, SO IT CANNOT GO WRONG THE SAME WAY AGAIN
-- ---------------------------------------------------------------------------
--
-- Macquarie's guidelines were uploaded, stored, hashed and sitting in the
-- bucket, complete, all afternoon. Paco could not read one line of them. One
-- model call tried to carve the whole 57,000 character document into hundreds
-- of one-sentence rules, ran out of room, came back as truncated JSON, and
-- every rule in it was thrown away. The document existed. It was invisible.
--
-- The cause was an ordering mistake, not a parsing one. Everything downstream
-- depended on one fragile step succeeding, so when that step failed the
-- document may as well not have been uploaded.
--
-- THE ORDERING RULE THIS FILE EXISTS TO ENFORCE:
--
--   1. The text is stored, whole, and THAT is what "filed" means.
--   2. Splitting into sections is a separate step that may be retried.
--   3. Reading rules out of sections is a third step that may be retried.
--
-- A failure at 2 leaves a document that is still searchable by its words. A
-- failure at 3 leaves sections that can still be quoted. Nothing downstream
-- can ever again take the document away.
--
-- ---------------------------------------------------------------------------
-- WHY SECTIONS, AND WHY THEY ARE THE SIZE THEY ARE
-- ---------------------------------------------------------------------------
--
-- Measured against the documents we hold, 13 Oct 2026:
--
--   Macquarie Credit Guidelines v14.1   57,000 chars -> 25 sections, median ~540 tokens
--   NAB broker credit policy, 12 files 189,000 chars -> 135 sections, median ~200 tokens
--
-- Every one of those is already a complete, named, quotable rule set written
-- by the lender: "1A. Equity release and cash out", "10.2 PAYG Income". We do
-- not chop documents into fragments. We keep the lender's own pieces whole,
-- tables and exceptions still attached, and hand five of them to Paco - which
-- is between 1,000 and 15,000 tokens, comfortably inside one prompt.
--
-- ---------------------------------------------------------------------------
-- AND WHY THERE IS NOT A SINGLE DELETE IN THIS FILE
-- ---------------------------------------------------------------------------
--
-- Re-reading a document must be safe to do at 9pm on a Thursday. So a read is
-- a RUN, every section carries the run it came from, and a document points at
-- the one run that is live. A re-read writes a whole new run and only then
-- flips the pointer. If it fails halfway, the pointer never moves and the
-- previous read is still answering questions.
--
-- That is the same ordering rule again, one level down: a new attempt is never
-- allowed to destroy a working one.


-- ===========================================================================
-- 1. THE DOCUMENT KEEPS ITS OWN WORDS
-- ===========================================================================

alter table public.lender_documents
  -- The whole document as text, exactly as it was read out of the file. The
  -- original binary stays in the bucket and is still the thing of record; this
  -- is what can be searched and quoted without fetching and parsing a PDF
  -- every time somebody asks a question.
  add column if not exists body_text text not null default '',
  add column if not exists body_chars int not null default 0,
  add column if not exists body_stored_at timestamptz,

  -- WHICH READ IS LIVE. Null means nobody has successfully split this document
  -- yet - which is a normal state, not a broken one. The words are still here.
  add column if not exists current_read uuid,
  add column if not exists sectioned_at timestamptz,

  -- WHAT THE LAST ATTEMPT SAID WHEN IT FAILED, kept so the screen can show a
  -- reason instead of a zero. An afternoon was lost to "0 lines" meaning six
  -- different things.
  add column if not exists last_read_error text not null default '';

-- Word search over the whole document. This is the floor: even with no
-- sections and no rules, "which lender said anything about vacant land" is
-- answerable the moment the text is stored.
--
-- 'english' is named explicitly because a generated column has to be
-- immutable, and because the query side must use the same configuration or
-- the index is silently useless.
alter table public.lender_documents
  add column if not exists body_search tsvector
    generated always as (to_tsvector('english', coalesce(body_text, ''))) stored;

create index if not exists lender_documents_body_search_idx
  on public.lender_documents using gin (body_search);

-- The trigger pins the original file. It must NOT pin body_text, because
-- re-reading a PDF with a better parser is exactly the kind of improvement we
-- want to be able to make. The file and its hash stay fixed; our reading of it
-- may get better.
comment on column public.lender_documents.body_text is
  'The document as text. Storing this is what "filed" means - see docs/lender-policy-text-and-sections.sql.';


-- ===========================================================================
-- 2. THE SECTIONS
-- ===========================================================================

create table if not exists public.lender_policy_sections (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references public.lender_documents(id) on delete cascade,
  -- Carried as well as reachable, for the same reason the rules table carries
  -- it: every question starts with a lender.
  lender_id uuid not null references public.lenders(id) on delete cascade,

  -- WHICH READ THIS CAME FROM. A document's live sections are the ones whose
  -- read_run matches lender_documents.current_read. Nothing is ever deleted;
  -- an old run simply stops being pointed at.
  read_run uuid not null,

  -- Where it sits in the document, from 1, in the document's own order.
  ordinal int not null,

  -- The lender's own address for it: "10.2.1", "1A", or empty where they did
  -- not number their sections.
  number text not null default '',
  title text not null check (length(trim(title)) > 0),

  -- "10.2 PAYG Income > 10.2.1 Pay as you go - Full time and part time".
  -- A sub-section read alone does not say what it sits under, and a broker
  -- searching "income" should still find 10.2.1.
  path text not null default '',

  -- Set only when one oversized section had to be cut: "2 of 3". Said out loud
  -- in the citation, so a third of a section is never shown as the whole.
  part text not null default '',

  body text not null check (length(trim(body)) > 0),
  chars int not null default 0,

  -- THE LINE THAT MAKES A SECTION FINDABLE ON ITS OWN.
  --
  -- "Maximum LVR is 90%" is nearly useless as an index entry - 90% for what,
  -- at which lender? Both briefs call this contextual retrieval and both
  -- suggest a model should write it. It does not need one: the lender, the
  -- document and the section's own path say it exactly, for free, with no call
  -- that can fail.
  context text not null default '',

  -- A is the lender's own manual, B a lender email, C indicative, D ours.
  -- Set from how the document arrived, never typed by a person.
  tier text not null default 'A',
  constraint lender_policy_sections_tier_known check (tier in ('A','B','C','D')),

  -- Lenders announce in October for November. Same meaning as on the rules
  -- table: a section that has not started is held and said to be coming.
  effective_from date,
  effective_to date,

  created_at timestamptz not null default now(),

  constraint lender_policy_sections_one_per_place unique (document_id, read_run, ordinal)
);

create index if not exists lender_policy_sections_doc_idx
  on public.lender_policy_sections (document_id, read_run);
create index if not exists lender_policy_sections_lender_idx
  on public.lender_policy_sections (lender_id);

-- The context line and the body are indexed together, so a search for
-- "macquarie cash out" matches a section whose body never says "Macquarie".
alter table public.lender_policy_sections
  add column if not exists search tsvector
    generated always as (
      to_tsvector('english', coalesce(context, '') || ' ' || coalesce(body, ''))
    ) stored;

create index if not exists lender_policy_sections_search_idx
  on public.lender_policy_sections using gin (search);


-- ===========================================================================
-- 3. A SECTION IS WHAT THE DOCUMENT SAYS, SO IT CANNOT BE EDITED
-- ===========================================================================
--
-- Same reasoning as the quote trigger on lender_policy_rules. Anyone signed in
-- holds a key the browser can use; without this, a section's words could be
-- rewritten through it, and a quote that can be edited is not a quote.
--
-- effective_to is deliberately left editable: a date is our bookkeeping about
-- a section, not a claim about what the lender wrote.
create or replace function public.lender_policy_sections_are_fixed()
returns trigger
language plpgsql
as $$
begin
  if new.body        is distinct from old.body
  or new.title       is distinct from old.title
  or new.number      is distinct from old.number
  or new.path        is distinct from old.path
  or new.part        is distinct from old.part
  or new.context     is distinct from old.context
  or new.ordinal     is distinct from old.ordinal
  or new.read_run    is distinct from old.read_run
  or new.document_id is distinct from old.document_id
  or new.lender_id   is distinct from old.lender_id
  or new.created_at  is distinct from old.created_at then
    raise exception 'What a document says cannot be edited. Read the document again instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists lender_policy_sections_are_fixed on public.lender_policy_sections;
create trigger lender_policy_sections_are_fixed
  before update on public.lender_policy_sections
  for each row execute function public.lender_policy_sections_are_fixed();


-- ===========================================================================
-- 4. WHO MAY DO WHAT
-- ===========================================================================

alter table public.lender_policy_sections enable row level security;

drop policy if exists lender_policy_sections_read on public.lender_policy_sections;
create policy lender_policy_sections_read on public.lender_policy_sections
  for select to authenticated using (true);

drop policy if exists lender_policy_sections_write on public.lender_policy_sections;
create policy lender_policy_sections_write on public.lender_policy_sections
  for insert to authenticated with check (true);

drop policy if exists lender_policy_sections_touch on public.lender_policy_sections;
create policy lender_policy_sections_touch on public.lender_policy_sections
  for update to authenticated using (true) with check (true);

-- NO DELETE POLICY, ON PURPOSE. Row level security denies what it is not told
-- to allow, so the absence here is the rule rather than an oversight. An old
-- read is not deleted; the document simply stops pointing at it.


-- ===========================================================================
-- 5. THE SEARCH
-- ===========================================================================
--
-- Word search only, deliberately, for now. Credit policy is full of exact
-- terms - LVR, LMI, DTI, "genuine savings", "90%" - and word search is the
-- stronger half on exactly those. Meaning search (pgvector) is designed for in
-- the next step and goes on the same rows, fused by rank, once we have
-- measured where word search actually misses. Both briefs call hybrid search
-- non-negotiable and they are right about the destination; they are not right
-- that it has to be built before anything works.
--
-- ts_rank_cd cannot use an index, which is fine: it only ever ranks rows the
-- WHERE clause already matched.

-- Live sections for a lender, best match first.
create or replace function public.paco_find_sections(
  p_lender uuid,
  p_query  text,
  p_limit  int default 5,
  p_today  date default current_date
)
returns table (
  section_id  uuid,
  document_id uuid,
  title       text,
  number      text,
  path        text,
  part        text,
  body        text,
  tier        text,
  chars       int,
  score       real
)
language sql
stable
set search_path = public
as $$
  select s.id, s.document_id, s.title, s.number, s.path, s.part, s.body, s.tier, s.chars,
         ts_rank_cd(s.search, websearch_to_tsquery('english', p_query)) as score
  from public.lender_policy_sections s
  join public.lender_documents d on d.id = s.document_id
  where s.lender_id = p_lender
    -- Only the read that is live. This is the whole point of read_run.
    and s.read_run = d.current_read
    -- A section that has not started yet is not an answer. Paco handles
    -- "coming" separately, the same way he already does for rules.
    and (s.effective_from is null or s.effective_from <= p_today)
    and (s.effective_to   is null or s.effective_to   >  p_today)
    and s.search @@ websearch_to_tsquery('english', p_query)
  order by score desc, s.ordinal
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

-- THE FLOOR. Documents whose words match, for a lender whose documents have
-- not been split yet - or whose splitting failed. This is what makes a failed
-- read a degraded answer instead of no answer.
create or replace function public.paco_find_documents(
  p_lender uuid,
  p_query  text,
  p_limit  int default 3
)
returns table (
  document_id uuid,
  title       text,
  body_chars  int,
  sectioned   boolean,
  score       real
)
language sql
stable
set search_path = public
as $$
  select d.id, d.title, d.body_chars,
         (d.current_read is not null) as sectioned,
         ts_rank_cd(d.body_search, websearch_to_tsquery('english', p_query)) as score
  from public.lender_documents d
  where d.lender_id = p_lender
    and d.body_search @@ websearch_to_tsquery('english', p_query)
  order by score desc
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

-- ACROSS EVERY LENDER AT ONCE. "Which lenders allow cash out above 80%" is the
-- question that cannot be answered by handing over one document, and it is the
-- reason a search layer had to exist at all.
create or replace function public.paco_find_sections_anywhere(
  p_query text,
  p_limit int default 12,
  p_today date default current_date
)
returns table (
  section_id  uuid,
  lender_id   uuid,
  document_id uuid,
  title       text,
  number      text,
  path        text,
  body        text,
  tier        text,
  score       real
)
language sql
stable
set search_path = public
as $$
  select s.id, s.lender_id, s.document_id, s.title, s.number, s.path, s.body, s.tier,
         ts_rank_cd(s.search, websearch_to_tsquery('english', p_query)) as score
  from public.lender_policy_sections s
  join public.lender_documents d on d.id = s.document_id
  where s.read_run = d.current_read
    and (s.effective_from is null or s.effective_from <= p_today)
    and (s.effective_to   is null or s.effective_to   >  p_today)
    and s.search @@ websearch_to_tsquery('english', p_query)
  order by score desc, s.lender_id, s.ordinal
  limit greatest(1, least(coalesce(p_limit, 12), 40));
$$;

grant execute on function public.paco_find_sections(uuid, text, int, date) to authenticated;
grant execute on function public.paco_find_documents(uuid, text, int) to authenticated;
grant execute on function public.paco_find_sections_anywhere(text, int, date) to authenticated;


-- ===========================================================================
-- 6. WHAT A DOCUMENT IS ACTUALLY IN, SAID PLAINLY
-- ===========================================================================
--
-- This view exists so the Library screen can never again show a tile with a
-- document behind it and a bare "0" in front of it. Every document is in
-- exactly one of four honest states and the screen says which.
-- security_invoker: a view runs as its OWNER by default in Postgres 15, which
-- would read straight past the row level security on the tables underneath.
-- This makes it run as whoever is asking, which is the only safe default for
-- anything the browser can reach.
create or replace view public.lender_document_state
with (security_invoker = true) as
select
  d.id,
  d.lender_id,
  d.title,
  d.body_chars,
  d.last_read_error,
  coalesce(c.n, 0) as live_sections,
  case
    when d.body_chars = 0            then 'no words yet'
    when d.current_read is null      then 'words only, not split'
    when coalesce(c.n, 0) = 0        then 'split produced nothing'
    else                                  'ready'
  end as state
from public.lender_documents d
left join lateral (
  select count(*)::int as n
  from public.lender_policy_sections s
  where s.document_id = d.id and s.read_run = d.current_read
) c on true;

grant select on public.lender_document_state to authenticated;
