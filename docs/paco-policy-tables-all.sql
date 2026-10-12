-- PACO'S LENDER POLICY TABLES - EVERYTHING, IN ORDER.
--
-- Run this in the Supabase SQL editor. Staging, then live.
-- Safe to run twice, and safe to run on an environment that already has
-- part of it: every statement is "if not exists" or "or replace".
--
-- It is the base tables followed by the sections-and-tables change, joined
-- into one file so there is no order to get wrong.

-- ===================== PART ONE: THE TABLES =====================

--
-- Run this once in the Supabase SQL editor. Staging first, then live.
-- Safe to run twice: everything is "if not exists".
--
-- 13 Oct 2026. The first source is our own deals, which he already reads. The
-- second is what the team tells him (paco_knowledge). This is the third, and it
-- is the one that outranks the other two - blueprint section 2: official written
-- lender policy beats everything else, and our own experience never silently
-- overwrites it.
--
-- TWO TABLES, AND THE SPLIT MATTERS.
--
--   lender_documents     the file itself, kept exactly as supplied, for ever
--   lender_policy_rules  what was read out of it, each one quoting its sentence
--
-- NOT "lender_rules". THAT NAME IS TAKEN, and finding out the hard way is why
-- this note exists. public.lender_rules is the "What we have learned" table -
-- lender_id, key, value, set_by - read by components/LenderRules.tsx and by the
-- milestone emails. The first version of this file tried to create a second
-- table with that name. "create table if not exists" did not complain, it
-- simply did nothing, and the failure only surfaced two statements later on an
-- index naming a column the REAL table has never had:
--
--   ERROR: 42703: column "status" does not exist
--
-- Live threw it and staging did not, because the two are not in the same state.
-- Worse than the error: the policy names collided too, so a few lines further
-- on this script would have dropped and replaced the live policies on a table
-- it had nothing to do with. Everything here is now prefixed lender_policy_.
--
-- Paco never answers from a document. He answers from a rule, and every rule
-- carries the sentence it came from and the page it is on, so the person asking
-- can open the PDF and read it themselves. A citation you cannot open is not a
-- citation.


-- ===========================================================================
-- THE DOCUMENT
-- ===========================================================================
create table if not exists public.lender_documents (
  id uuid primary key default gen_random_uuid(),

  lender_id uuid not null references public.lenders(id) on delete cascade,

  -- What it is, in their words: "Credit guidelines", "Policy library".
  title text not null check (length(trim(title)) > 0),

  -- Where the original sits in the lender-documents bucket, and what it was
  -- called when it arrived. The path is ours; the name is theirs.
  file_path text not null check (length(trim(file_path)) > 0),
  file_name text not null default '',
  pages int,

  -- THE HASH IS NOT DECORATION. It is how we can say, later and under
  -- question, that the file a rule was read out of is the same file that is
  -- sitting there now. Blueprint section 7.
  sha256 text not null check (length(sha256) = 64),

  -- WHO PUT IT THERE. The act of uploading a lender's manual is the human
  -- decision, so this name travels onto everything read out of it.
  uploaded_by uuid not null references auth.users(id),
  uploaded_by_name text not null default '',
  created_at timestamptz not null default now(),

  -- REPLACED, NEVER DELETED. A newer credit guide does not erase the one
  -- before it - it points back at it, the old rules end, and you can still ask
  -- what the policy was in March.
  supersedes uuid references public.lender_documents(id),

  -- When somebody last confirmed this is still the current version. A rule
  -- nobody has checked in a long time gets hedged, not hidden.
  last_checked_at timestamptz not null default now(),
  last_checked_by_name text not null default ''
);

create index if not exists lender_documents_lender_idx on public.lender_documents (lender_id);
create index if not exists lender_documents_live_idx on public.lender_documents (lender_id) where supersedes is null;


-- ===========================================================================
-- THE RULES READ OUT OF IT
-- ===========================================================================
create table if not exists public.lender_policy_rules (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references public.lender_documents(id) on delete cascade,
  -- Carried as well as reachable through the document. Every question Paco is
  -- asked starts with a lender, and a join on every one of them to find out
  -- which bank a rule belongs to is work for nothing.
  lender_id uuid not null references public.lenders(id) on delete cascade,

  -- The rule in plain words.
  says text not null check (length(trim(says)) > 0),

  -- AND THE SENTENCE IT CAME FROM, WORD FOR WORD.
  --
  -- not null, and checked, because this is the whole difference between a
  -- citation and a claim. Nothing extracted from a document is ever saved as a
  -- paraphrase - the quote travels with it, so you can open the page and read
  -- it yourself. A rule that cannot quote its own sentence is not a rule we
  -- are willing to put in front of a credit assessor.
  quote text not null check (length(trim(quote)) > 0),
  page int,
  heading text not null default '',

  -- The same tag list the whole portal shares (lib/deal-tags.ts), so a
  -- question that finds deals and team notes finds these too.
  tags text[] not null default '{}',

  -- Out of a lender's own manual this is A. The column exists because the same
  -- table will hold tier B when a forwarded lender email arrives - phase three.
  tier text not null default 'A',
  constraint lender_policy_rules_tier_known check (tier in ('A','B','C','D')),

  -- DATES DECIDE WHAT IS LIVE.
  --
  -- Lenders announce in October for November. A rule with a future
  -- effective_from is NOT live until that date arrives: Paco holds it, says it
  -- is coming and when, and starts using it on the day. effective_to is set
  -- when a newer document supersedes it, and it stays readable afterwards.
  effective_from date,
  effective_to date,

  -- NOTHING REACHES PACO UNTIL A PERSON HAS LOOKED AT IT.
  --
  -- This is the one place in Paco with a queue, and it is deliberate. A team
  -- note is one person saying one thing in their own words, under their own
  -- name - that is live immediately, because the name IS the safeguard. This is
  -- a machine reading 142 rules out of a PDF and presenting them as the
  -- lender's own written policy, which is the highest thing Paco has. Those two
  -- do not deserve the same door.
  status text not null default 'proposed',
  constraint lender_policy_rules_status_known check (status in ('proposed','live','ended','rejected')),

  decided_by uuid references auth.users(id),
  decided_by_name text not null default '',
  decided_at timestamptz,
  -- Why it was turned down, kept - so the same bad reading does not come back
  -- next month with nobody remembering it was looked at and rejected.
  rejected_why text not null default '',

  created_at timestamptz not null default now()
);

create index if not exists lender_policy_rules_lender_idx on public.lender_policy_rules (lender_id, status);
create index if not exists lender_policy_rules_doc_idx    on public.lender_policy_rules (document_id);
create index if not exists lender_policy_rules_tags_idx   on public.lender_policy_rules using gin (tags);
-- Paco's actual question: this lender, live, not future-dated.
create index if not exists lender_policy_rules_live_idx   on public.lender_policy_rules (lender_id) where status = 'live';


-- ===========================================================================
-- WHO MAY DO WHAT
-- ===========================================================================
alter table public.lender_documents enable row level security;
alter table public.lender_policy_rules     enable row level security;

-- Everyone signed in can read both. It is the firm's shared knowledge.
drop policy if exists lender_documents_read on public.lender_documents;
create policy lender_documents_read on public.lender_documents
  for select to authenticated using (true);

drop policy if exists lender_policy_rules_read on public.lender_policy_rules;
create policy lender_policy_rules_read on public.lender_policy_rules
  for select to authenticated using (true);

-- Everyone signed in can add a document, stamped with themselves. uploaded_by
-- must be the person uploading, so nobody can file a manual under another name.
drop policy if exists lender_documents_write on public.lender_documents;
create policy lender_documents_write on public.lender_documents
  for insert to authenticated with check (uploaded_by = auth.uid());

drop policy if exists lender_documents_touch on public.lender_documents;
create policy lender_documents_touch on public.lender_documents
  for update to authenticated using (true) with check (true);

drop policy if exists lender_policy_rules_write on public.lender_policy_rules;
create policy lender_policy_rules_write on public.lender_policy_rules
  for insert to authenticated with check (true);

drop policy if exists lender_policy_rules_decide on public.lender_policy_rules;
create policy lender_policy_rules_decide on public.lender_policy_rules
  for update to authenticated using (true) with check (true);

-- NO DELETE POLICY ON EITHER, ON PURPOSE. Row level security denies anything
-- without one, so the absence here is the rule rather than an oversight. A
-- document is superseded; a rule is ended or rejected. Both stay readable.


-- ===========================================================================
-- WHAT A ROW MAY STILL CHANGE AFTER IT IS WRITTEN
-- ===========================================================================
--
-- The update policies above say WHO, and cannot say WHICH COLUMNS. Without
-- this, anyone signed in could rewrite a quote through the key the browser
-- already holds - and a quote that can be edited is not a quote. The citation
-- is the whole product here, so the database refuses.
create or replace function public.lender_policy_rules_quote_is_fixed()
returns trigger
language plpgsql
as $$
begin
  if new.says     is distinct from old.says
  or new.quote    is distinct from old.quote
  or new.page     is distinct from old.page
  or new.heading  is distinct from old.heading
  or new.document_id is distinct from old.document_id
  or new.lender_id   is distinct from old.lender_id
  or new.created_at  is distinct from old.created_at then
    raise exception 'What a document says cannot be edited. Reject this rule and read the document again.';
  end if;
  return new;
end;
$$;

drop trigger if exists lender_policy_rules_quote_is_fixed on public.lender_policy_rules;
create trigger lender_policy_rules_quote_is_fixed
  before update on public.lender_policy_rules
  for each row execute function public.lender_policy_rules_quote_is_fixed();

-- And the original file is the original file.
create or replace function public.lender_documents_original_is_fixed()
returns trigger
language plpgsql
as $$
begin
  if new.file_path   is distinct from old.file_path
  or new.sha256      is distinct from old.sha256
  or new.lender_id   is distinct from old.lender_id
  or new.uploaded_by is distinct from old.uploaded_by
  or new.created_at  is distinct from old.created_at then
    raise exception 'The original document cannot be swapped. Upload a new one; it supersedes this.';
  end if;
  return new;
end;
$$;

drop trigger if exists lender_documents_original_is_fixed on public.lender_documents;
create trigger lender_documents_original_is_fixed
  before update on public.lender_documents
  for each row execute function public.lender_documents_original_is_fixed();


-- ===========================================================================
-- THE BUCKET
-- ===========================================================================
-- Private, beside deal-documents, same rules. Originals are never modified.
insert into storage.buckets (id, name, public)
values ('lender-documents', 'lender-documents', false)
on conflict (id) do nothing;

drop policy if exists lender_policy_docs_read on storage.objects;
create policy lender_policy_docs_read on storage.objects
  for select to authenticated using (bucket_id = 'lender-documents');

drop policy if exists lender_policy_docs_write on storage.objects;
create policy lender_policy_docs_write on storage.objects
  for insert to authenticated with check (bucket_id = 'lender-documents');

-- ============ PART TWO: SECTIONS INSTEAD OF PAGES, AND ROWS ============

-- page. Both halves of that are wrong for a real credit policy.

-- 1. A SECTION, NOT A PAGE.
--
-- Fabio: "there is no need to ever reference a page thats not relevant just
-- mention section of policy". He is right, and it is not a compromise - these
-- came off the NAB broker portal as web pages with no pages at all, and "10.7"
-- is a more precise address than "page 38" ever was.
alter table public.lender_policy_rules drop column if exists page;
alter table public.lender_policy_rules
  add column if not exists section text not null default '';

-- 2. A QUOTE CAN BE A TABLE ROW, KEPT AS A ROW.
--
-- The income shading rule is a row in a three column table:
--
--   | Income Type | Income Shading | Verification Period |
--   | Commissions | 20%            | 6 Months            |
--
-- Flattened to prose that becomes "Commissions 20% 6 Months", and which number
-- is the shading and which is the period is anybody's guess. The valuation
-- table is worse: quoting the cell gives "Up to and including 95%**", a
-- citation that looks complete and means nothing without the loan purpose, the
-- valuation type, the five excluded property types and the value cap sitting on
-- the same row. A broker would believe it.
alter table public.lender_policy_rules
  add column if not exists row_headers text[] not null default '{}',
  add column if not exists row_cells   text[] not null default '{}';

-- A rule still cannot exist without showing where it came from. That has not
-- softened - it has widened to cover tables.
alter table public.lender_policy_rules alter column quote drop not null;
alter table public.lender_policy_rules alter column quote set default '';
alter table public.lender_policy_rules drop constraint if exists lender_policy_rules_quote_check;
alter table public.lender_policy_rules drop constraint if exists lender_policy_rules_shows_its_source;
alter table public.lender_policy_rules
  add constraint lender_policy_rules_shows_its_source check (
    length(trim(coalesce(quote, ''))) > 0
    or coalesce(array_length(row_cells, 1), 0) > 0
  );

-- 3. A RULE CAN NAME THE RULES IT LEANS ON.
--
-- 10.2.1 says verify using documents that meet the 10.1 criteria. Answering
-- with 10.2.1 alone is answering half the question.
alter table public.lender_policy_rules
  add column if not exists depends_on text[] not null default '{}';

-- 4. THE NUMBER THAT DECIDES, READ OUT AS A NUMBER.
--
-- Blueprint section 16: a numeric boundary - an LVR at exactly 80% - is
-- evaluated by code, not by a model reading a sentence and hoping.
alter table public.lender_policy_rules
  add column if not exists max_lvr numeric,
  add column if not exists min_value numeric,
  add column if not exists max_value numeric;

-- 5. AND THE EXCLUSIONS THAT LIVE INSIDE ONE CELL.
--
-- "All property types excluding: settlement greater than 90 days; or vacant
-- land; or off the plan; or new dwellings; or authenticity doubts" is five
-- exclusions in a single cell. One long string is unsearchable; a list is not.
alter table public.lender_policy_rules
  add column if not exists excludes text[] not null default '{}';

-- And the trigger pins the new columns too: what a document says still cannot
-- be edited after it is written.
create or replace function public.lender_policy_rules_quote_is_fixed()
returns trigger
language plpgsql
as $$
begin
  if new.says        is distinct from old.says
  or new.quote       is distinct from old.quote
  or new.section     is distinct from old.section
  or new.row_headers is distinct from old.row_headers
  or new.row_cells   is distinct from old.row_cells
  or new.heading     is distinct from old.heading
  or new.document_id is distinct from old.document_id
  or new.lender_id   is distinct from old.lender_id
  or new.created_at  is distinct from old.created_at then
    raise exception 'What a document says cannot be edited. Reject this rule and read the document again.';
  end if;
  return new;
end;
$$;
