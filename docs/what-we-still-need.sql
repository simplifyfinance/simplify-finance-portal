-- WHAT WE STILL NEED FROM THE CLIENT.
--
-- 27 Oct 2026. Catherine, Operations Manager, on why deals keep coming back
-- from credit: address history and employment history short of three years,
-- home contents, the car, super, shares, marital status, dependants and their
-- ages. Fabio, looking at the mock: "this is absolute perfect so lets build".
--
-- NEARLY ALL OF IT IS ALREADY IN THE FACT FIND and none of it has ever been
-- turned into a question a client could answer, because there has never been
-- anywhere to put a question that is not a document request.
--
-- SO WHAT IS SAVED HERE IS ALMOST NOTHING. The questions themselves are worked
-- out fresh from the fact find every time - fill the gap and the question is
-- gone, nobody has to remember to take it out. See lib/what-we-still-need.ts.
-- Only what a HUMAN did is stored, and that is these three columns.
--
-- RUN ON STAGING FIRST, then live. Two columns, both nullable, nothing moved.

-- 1. WHEN EACH QUESTION FIRST WENT OUT, AND WHAT A PERSON DID TO IT.
--
-- Keyed by the question's own key:
--
--   { "address_history:a1": { "askedAt": "2026-10-14T...", "ask": "Priya - where did you live before September 2024?" },
--     "by_hand:mk3x9a":     { "askedAt": "2026-10-14T...", "closedAt": "2026-10-20T...", "closedBy": "Melissa Sedin" } }
--
-- THE DATE IS THE ONE THING THAT CANNOT BE WORKED OUT AGAIN. It is why the
-- lending options email can say "I asked about this on 14 October" instead of
-- sending the same sentence twice. It is never moved once set - the FIRST ask
-- is the one that counts for how long somebody has been waiting.
--
-- The sentence is kept beside it for the same reason a deal keeps its own copy
-- of a commission split: the gap it came from will be gone, and a closed
-- question still has to read as something a year later.
alter table public.deals
  add column if not exists questions_state jsonb;

comment on column public.deals.questions_state is
  'Per question key: when it first went out, whether a person ticked it off and who. The questions themselves are worked out from the fact find, never stored - see lib/what-we-still-need.ts.';

-- 2. QUESTIONS SOMEBODY TYPED THEMSELVES.
--
-- Fabio, asked whether credit should be able to add their own: "yes I want them
-- to ask questions as well".
--
--   [ { "key": "by_hand:mk3x9a", "ask": "Is the Brunswick place still tenanted?",
--       "help": "", "addedBy": "Melissa Sedin", "addedAt": "2026-10-24T..." } ]
--
-- ON THE DEAL, NOT IN SETTINGS. "Is the Brunswick place still tenanted" is
-- about one file. A question bank nobody prunes is noise on every deal inside a
-- month. If the same one keeps being typed, that is the signal it belongs in
-- the fact find as a real field - which is a better reason to add a field than
-- guessing up front.
alter table public.deals
  add column if not exists questions_added jsonb;

comment on column public.deals.questions_added is
  'Questions a person typed on this deal: [{ key, ask, help, addedBy, addedAt }]. These cannot close themselves - the portal has no idea what would answer them - so a person ticks them off.';

-- 3. THERE IS NO THIRD COLUMN, AND THAT IS THE POINT.
--
-- The link a client opens to answer these is SIGNED and carries the deal and
-- its expiry inside itself, exactly like the Ready and Opportunity links that
-- already work - see lib/answers-link.ts. Nothing is stored, so there is no
-- token table to look up, no row to go stale, and no column that can disagree
-- with the link somebody is holding.
--
-- Fabio, 27 Oct 2026: "Link expires in 4 weeks." The date is inside the token.

-- A CHECK OF WHAT YOU JUST RAN. Expect 2.
select count(*) as new_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'deals'
  and column_name in ('questions_state', 'questions_added');
