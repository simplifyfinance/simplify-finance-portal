-- SECTIONS INSTEAD OF PAGES, AND A TABLE ROW KEPT AS A ROW.
--
-- Run this once in the Supabase SQL editor, staging then live, AFTER
-- docs/lender-documents-schema.sql. Safe to run twice.
--
-- 13 Oct 2026, after reading NAB's twelve broker credit policy chapters. 345
-- table rows across them, and the tables hold the answers brokers actually ask
-- for. The first version of this schema assumed a rule is one sentence on one
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
