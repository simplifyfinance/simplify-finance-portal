-- THE CLIENT'S OWN ANSWER ABOUT THE LENDER. 19 Oct 2026.
--
-- Until today the client's proceed page named no lender and recorded none, so
-- the only lender agreement on any deal was the box a broker ticks afterwards
-- on the lending options tab. These three columns hold what the CLIENT said.
--
-- Run on staging first, then live. Nothing here drops or rewrites anything, and
-- every existing deal keeps reading exactly as it does now: all three are null
-- on every row already in the table, which is the truth about those deals.

-- The bank the client confirmed on their own page. Null where they never
-- pressed it, and null where the recommendation was ambiguous - two options
-- from the same bank with nothing recording which - because a name nobody
-- chose is worse than no name. See lib/client-lender-choice.ts.
alter table public.deals add column if not exists lo_proceeded_lender text;

-- They pressed "I'd rather talk it through first" instead, or told us they
-- pressed proceed by mistake. The deal does NOT move on this - it flags here
-- and emails the assigned broker, copied to the office.
alter table public.deals add column if not exists lo_wants_call boolean;
alter table public.deals add column if not exists lo_wants_call_at timestamptz;
