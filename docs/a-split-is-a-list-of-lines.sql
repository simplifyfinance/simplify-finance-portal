-- A SPLIT IS A LIST OF LINES, NOT ONE PAIR OF PERCENTAGES.
--
-- 27 Oct 2026, hours after the first version shipped. Fabio, looking at it:
-- "we need the ability of addint lines for upfront and trail so line one for
-- exmaple 20% simplify line 80% broker 1 and abilty to add third line".
--
-- He is right and the first shape was wrong. One pair of percentages can only
-- ever say what ONE party gets, so it could describe "the referrer takes 20%"
-- and nothing else - not who holds the other 80%, not a three-way split, not
-- an arrangement where the house, the referrer and the writing broker all take
-- a share. Those are the normal cases, not the edge ones.
--
-- SO AN ARRANGEMENT HOLDS LINES. Each line is a name, a share of the upfront
-- and a share of the trail:
--
--   [ { "who": "Simplify Finance",  "upfront": 20, "trail": 20 },
--     { "who": "Harrow Financial",  "upfront": 20, "trail": 20 },
--     { "who": "Mark Gallo",        "upfront": 60, "trail": 60 } ]
--
-- UPFRONT AND TRAIL ARE PER LINE because they are not always the same. A
-- referrer taking a cut of the upfront and none of the trail is a real
-- arrangement, and the old shape could not write it down.
--
-- THE OLD COLUMNS STAY. upfront_pct and trail_pct shipped this morning and
-- some rows already use them. Where `lines` is empty they are read as a single
-- line, so nothing that was already set stops working - see splitFromRow() in
-- lib/who-shares-this-deal.ts. Nothing is lost and nothing has to be retyped.
--
-- RUN ON STAGING FIRST, then live. Two columns, both nullable.

alter table public.commission_splits
  add column if not exists lines jsonb;

comment on column public.commission_splits.lines is
  'Who gets what: [{ who, upfront, trail }]. Each line is one party. Empty means the row predates lines and the old upfront_pct/trail_pct are read as a single line.';

-- AND THE DEAL KEEPS ITS OWN COPY OF THE WHOLE BREAKDOWN.
--
-- Same reason the single pair was copied this morning: renegotiating an
-- arrangement must not rewrite what a settled deal says was agreed. A pointer
-- at the row would do exactly that, silently, to every deal that ever used it.
alter table public.deals
  add column if not exists commission_split_lines jsonb;

comment on column public.deals.commission_split_lines is
  'The split''s lines as they stood when the broker chose it. Not read back from commission_splits - the arrangement can change, the deal must not.';

-- A CHECK OF WHAT YOU JUST RAN. Expect 1 and 1.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'commission_splits'
      and column_name = 'lines') as splits_lines,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'deals'
      and column_name = 'commission_split_lines') as deal_lines;
