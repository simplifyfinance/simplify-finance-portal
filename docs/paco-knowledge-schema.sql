-- PACO'S NOTEBOOK — what the team tells him.
--
-- Run this once in the Supabase SQL editor. Staging first, then live.
-- Safe to run twice: everything is "if not exists".
--
-- 12 Oct 2026. Paco's second source. The first is our own deals, which he
-- already reads; the third is lender documents, which come later.
--
-- ANYONE CAN ADD ONE AND IT IS LIVE IMMEDIATELY. Fabio: "anyone can update paco
-- but we data stmap and mark which person did". There is no approval column
-- here on purpose - the safeguard is the stamp, not a gate. See docs/paco.md.
--
-- AND NOTHING IS EVER DELETED. A note that turns out to be wrong is retired:
-- retired_at is filled in, it stops being answered with, and it stays readable.
-- There is deliberately no delete policy below.

create table if not exists public.paco_knowledge (
  id uuid primary key default gen_random_uuid(),

  -- The lender it is about. A name rather than a foreign key: a BDM can tell you
  -- something about a lender before anybody has set that lender up in the
  -- library, and losing the note because the row does not exist yet would be
  -- exactly the wrong trade.
  lender text not null check (length(trim(lender)) > 0),

  -- Exactly what the person typed. Paco quotes this, word for word. It is never
  -- summarised, tidied or blended with another note - see lib/paco-knowledge.ts.
  said text not null check (length(trim(said)) > 0),

  -- Which subjects it is about, from the one tag list the whole portal shares
  -- (lib/deal-tags.ts), so a question that finds deals finds notes too.
  tags text[] not null default '{}',

  -- How firm it is. Blueprint section 3.
  --   B  in writing from the lender - an email, a written BDM clarification
  --   D  our experience - what we saw, or what a BDM said on a call
  -- A and C arrive with the lender documents and are not typed by hand.
  tier text not null default 'D',
  constraint paco_knowledge_tier_known check (tier in ('A','B','C','D')),

  -- Where it came from, in their own words: "email from BDM John, 3 Oct".
  source text not null default '',

  -- THE STAMP. Who said it and when. This is the whole safeguard, so both are
  -- required and neither is editable afterwards by anything in the portal.
  said_by uuid not null references auth.users(id),
  said_by_name text not null default '',
  created_at timestamptz not null default now(),

  -- Retired rather than deleted.
  retired_at timestamptz,
  retired_by uuid references auth.users(id),
  retired_by_name text not null default '',
  retired_why text not null default ''
);

-- Found by lender, and by the tags, which is how every question arrives.
create index if not exists paco_knowledge_lender_idx on public.paco_knowledge (lower(lender));
create index if not exists paco_knowledge_tags_idx   on public.paco_knowledge using gin (tags);
create index if not exists paco_knowledge_live_idx   on public.paco_knowledge (retired_at) where retired_at is null;

alter table public.paco_knowledge enable row level security;

-- EVERYONE SIGNED IN CAN READ. It is the firm's shared knowledge; a note only
-- one person can see is a note nobody benefits from.
drop policy if exists paco_knowledge_read on public.paco_knowledge;
create policy paco_knowledge_read on public.paco_knowledge
  for select to authenticated using (true);

-- EVERYONE SIGNED IN CAN ADD ONE, AND IT IS STAMPED WITH THEM. said_by must be
-- the person adding it, so nobody can put a note in under somebody else's name.
drop policy if exists paco_knowledge_write on public.paco_knowledge;
create policy paco_knowledge_write on public.paco_knowledge
  for insert to authenticated with check (said_by = auth.uid());

-- EVERYONE CAN RETIRE ONE, including somebody else's - if it is wrong it is
-- wrong, and who noticed does not matter. What may be changed is the retirement
-- and nothing else: the note itself, its tier and its stamp are fixed once
-- written, which is what makes the stamp worth anything.
drop policy if exists paco_knowledge_retire on public.paco_knowledge;
create policy paco_knowledge_retire on public.paco_knowledge
  for update to authenticated using (true) with check (true);

-- AND THE SENTENCE ABOVE IS ENFORCED HERE, NOT JUST MEANT.
--
-- The policy says who may update. It cannot say WHICH COLUMNS, so on its own it
-- would let anyone signed in rewrite said, tier, or the name on a note - through
-- the API key the browser already holds, without going near our own code. A
-- stamp that can be edited is not a stamp, and this table has no approval queue
-- precisely because the stamp is the safeguard. So the database refuses it.
create or replace function public.paco_knowledge_only_retire()
returns trigger
language plpgsql
as $$
begin
  if new.lender      is distinct from old.lender
  or new.said        is distinct from old.said
  or new.tags        is distinct from old.tags
  or new.tier        is distinct from old.tier
  or new.source      is distinct from old.source
  or new.said_by     is distinct from old.said_by
  or new.said_by_name is distinct from old.said_by_name
  or new.created_at  is distinct from old.created_at then
    raise exception 'A note cannot be changed once written. Retire it and add a new one.';
  end if;

  -- Retiring is a one-way door too. Un-retiring would put a note somebody had
  -- judged wrong back into Paco's answers with no record that it ever left.
  if old.retired_at is not null and new.retired_at is distinct from old.retired_at then
    raise exception 'That note is already retired.';
  end if;

  return new;
end;
$$;

drop trigger if exists paco_knowledge_only_retire on public.paco_knowledge;
create trigger paco_knowledge_only_retire
  before update on public.paco_knowledge
  for each row execute function public.paco_knowledge_only_retire();

-- NO DELETE POLICY, ON PURPOSE. Row level security denies anything without one,
-- so the absence below is the rule rather than an oversight.
