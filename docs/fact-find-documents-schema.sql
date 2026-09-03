-- GROUNDWORK FOR THE DOCUMENT REQUEST LIST.
--
-- Two of the three changes need no migration at all: residency, the deposit
-- source, the self-employed structure, the "Shares" asset type and the tidied
-- other-income list all live inside deals.fact_find_data, which is one jsonb
-- column that already exists. Nothing has to be added for them, and nothing
-- already saved is touched - a deal written before today simply has no answer
-- to the new questions, and the checklist says so rather than guessing.
--
-- The one real column is on the lender library.

-- WHAT A BANK CALLS ITSELF ON A STATEMENT.
--
-- The statement analysis reports institutions as short codes - "CBA", "ING" -
-- while the fact find records the lender's full name from this same library.
-- Nothing could match the two, so a client's statements could never be used to
-- cross a document off the request list. This is the translation, kept where
-- the team already maintains lenders rather than buried in code.
--
-- Comma separated, because one bank arrives under more than one code.
alter table lenders add column if not exists statement_codes text;

comment on column lenders.statement_codes is
  'What this lender appears as on a bank statement, comma separated (e.g. "CBA, CommBank"). Used to tell whether a client''s loaded statements already cover an account, so the document request list can cross it off.';
