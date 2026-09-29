-- WHAT WE HAVE LEARNED ABOUT A LENDER, ASKED ONCE.
--
-- Fabio, 29 Sep 2026: "dont worry about bank non bank lets build a rules based
-- on each ledner to learn as we seelct if preapprovalc na extended etc".
--
-- He is right that a bank / non-bank tickbox was the wrong shape. The
-- pre-approval email needs to know whether postcodes are restricted and whether
-- a DocuSign certificate is wanted; the formal approval needs to know how
-- contracts are issued; the extension email needs to know whether this lender
-- extends at all. Every one of those is the same kind of fact: true of a LENDER,
-- not of a deal, and nobody should be typing it per client.
--
-- WHY NOT A COLUMN EACH. reprice_over_percent is a column and that was right for
-- one number. Five is a migration and a deploy every time somebody thinks of a
-- question, which means nobody adds one, which means the answers stay in
-- people's heads - exactly where they were before the portal existed.
--
-- A ROW PER ANSWER, NOT A BLOB PER LENDER. Two people answering two different
-- questions on two deals at the same moment must not overwrite each other. This
-- codebase has been bitten twice by a shared JSON blob with two writers - see
-- the single-writer note in lib/deal-structure.ts.
--
-- NULL IS NOT AN ANSWER, AND NO ROW MEANS ASK. A lender nobody has answered for
-- is never handed the most common answer. That is the rule reprice_over_percent
-- already follows, and it is precisely what stops a non-bank pre-approval going
-- out with no postcode warning in it.
--
-- Safe to run twice.

create table if not exists public.lender_rules (
  lender_id  uuid        not null references public.lenders(id) on delete cascade,
  -- The question, as lib/lender-rules.ts names it. Nothing here validates the
  -- key: the catalogue lives in code so a question can be added without a
  -- migration, which is the whole point of this table.
  key        text        not null,
  value      text        not null,
  -- SOMEBODY HAS TO BE ASKABLE when a rule turns out to be wrong. A number with
  -- no name behind it gets argued about instead of corrected.
  set_by     text,
  set_at     timestamptz not null default now(),
  -- A rule used on seven deals is worth trusting. One set once in a hurry is
  -- worth checking before it goes in front of a client.
  used       integer     not null default 0,
  primary key (lender_id, key)
);

alter table public.lender_rules enable row level security;

-- The same reach as the lender library itself: everybody signed in reads it, and
-- everybody signed in may answer a question. These are facts about banks, not
-- about clients - there is nothing here to keep from a colleague, and a rule one
-- person cannot fix is a rule that stays wrong.
drop policy if exists lender_rules_read on public.lender_rules;
create policy lender_rules_read on public.lender_rules
  for select to authenticated using (true);

drop policy if exists lender_rules_write on public.lender_rules;
create policy lender_rules_write on public.lender_rules
  for insert to authenticated with check (true);

drop policy if exists lender_rules_update on public.lender_rules;
create policy lender_rules_update on public.lender_rules
  for update to authenticated using (true) with check (true);

comment on table public.lender_rules is
  'One answer per lender per question, learned the first time a template needs it. The questions themselves live in lib/lender-rules.ts so a new one costs no migration. No row means nobody has answered - which means ask, never assume.';

select l.name,
       count(r.key) as answered
  from public.lenders l
  left join public.lender_rules r on r.lender_id = l.id
 group by l.name
 order by answered desc, l.name;
