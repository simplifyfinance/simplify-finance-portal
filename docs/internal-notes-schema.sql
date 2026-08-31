-- One internal notes field per deal (1 Sep 2026)
-- Run in the Supabase SQL editor. Read the SELECT first, then the UPDATEs.
--
-- There were three boxes labelled "Internal notes" — Fact Find, BC and Lending
-- Options — each saving to a different place, none aware of the others, and none
-- at all on Compliance where the write-up is drafted. This makes it one field.
--
-- Counted before writing this: 13 deals with fact find notes, 4 with BC notes,
-- 1 with LO notes, and exactly 1 deal holding both fact find and BC notes. So at
-- most 5 deals are touched and only one needs its two notes joined.

-- 1. The column.
alter table public.deals
  add column if not exists internal_notes text;

-- 2. LOOK BEFORE YOU MOVE ANYTHING. This changes nothing; it shows what the
--    updates below will do to each deal.
select id, deal_name,
       length(coalesce(fact_find_data->>'internalNotes','')) as ff_len,
       length(coalesce(bc_data->>'internalNotes',''))        as bc_len,
       length(coalesce(lo_data->>'internalNotes',''))        as lo_len
from public.deals
where coalesce(fact_find_data->>'internalNotes','') <> ''
   or coalesce(bc_data->>'internalNotes','')        <> ''
   or coalesce(lo_data->>'internalNotes','')        <> ''
order by deal_name;

-- 3. Fact find notes move across as they are. Nothing is joined here because
--    nothing is being overwritten — internal_notes is empty on every deal.
update public.deals
set internal_notes = fact_find_data->>'internalNotes'
where coalesce(fact_find_data->>'internalNotes','') <> ''
  and coalesce(internal_notes,'') = '';

-- 4. BC notes. Where the deal already has notes they are joined with a line
--    saying where the text came from, so anyone reading it later knows it was
--    not always one box. Where it has none, the BC text simply becomes them.
update public.deals
set internal_notes = case
      when coalesce(internal_notes,'') = '' then bc_data->>'internalNotes'
      else internal_notes || E'\n\n— moved from the BC tab''s own notes, 1 Sep 2026 —\n' || (bc_data->>'internalNotes')
    end
where coalesce(bc_data->>'internalNotes','') <> '';

-- 5. Lending Options notes, same rule.
update public.deals
set internal_notes = case
      when coalesce(internal_notes,'') = '' then lo_data->>'internalNotes'
      else internal_notes || E'\n\n— moved from the Lending Options tab''s own notes, 1 Sep 2026 —\n' || (lo_data->>'internalNotes')
    end
where coalesce(lo_data->>'internalNotes','') <> '';

-- 6. Check it landed. Every deal that had notes anywhere should now have them here.
select count(*) filter (where coalesce(internal_notes,'') <> '') as deals_with_notes
from public.deals;

-- The old fact_find_data/bc_data/lo_data internalNotes keys are deliberately left
-- in place. They cost nothing, and they are the only copy of what the text looked
-- like before the move if anything needs checking.
