-- WHAT EACH BANK CALLS THE FEE CHARGED AT SETTLEMENT.
--
-- The portal called it "Legal fee" everywhere, which is Bankwest's word for it.
-- Almost every other lender says "settlement fee", and a few charge nothing
-- beyond the government registration fees. A lending options email that says
-- "Legal fee: $200" against CBA names a fee the client will not find on CBA's
-- own paperwork.
--
-- Fabio, 2 Sep 2026, with the list below: "any chance you can change the wording
-- on the library for all banks so I dotn ahve to do one by one".
--
-- The wording lives on the LENDER, so every product underneath it inherits it.
-- Null means "Legal fee", which is what every lender said before this existed -
-- so a lender not listed here is unchanged.

alter table lenders add column if not exists legal_fee_label text;

comment on column lenders.legal_fee_label is
  'What this lender calls the fee charged at settlement - "Settlement fee" for most, "Legal fee" for Bankwest. Null means Legal fee. Shown on the lending options email, the fact find and the handover.';

-- ---------------------------------------------------------------------------
-- STEP 1 - the wording, from Fabio's list.
--
-- Matched on the name as the library holds it, case-insensitively and ignoring
-- full stops, so "St George" and "St.George" both match. Run it and read the
-- count it reports: if a lender is named differently in your library it will not
-- be updated, and the SELECT underneath shows which.
-- ---------------------------------------------------------------------------
update lenders set legal_fee_label = 'Settlement fee'
where regexp_replace(lower(name), '[^a-z]', '', 'g') in (
  'cba', 'anz', 'stgeorge', 'ing', 'westpac', 'suncorp', 'bankofmelbourne',
  'bankaustralia', 'macquarie', 'mebank', 'nab', 'ubank'
);

update lenders set legal_fee_label = 'Legal fee'
where regexp_replace(lower(name), '[^a-z]', '', 'g') = 'bankwest';

-- Which lenders in your library still have no wording set. Anything on Fabio's
-- list that appears here is named differently in the library - fix the name or
-- set the wording by hand in Settings -> Lender library.
select name, coalesce(legal_fee_label, 'Legal fee (default)') as calls_it
from lenders
order by legal_fee_label nulls first, name;

-- ---------------------------------------------------------------------------
-- STEP 2 - the amounts. OPTIONAL, and destructive: it overwrites the fee on
-- EVERY product of that lender. Only run it if the fee really is the same across
-- all of a bank's products. Check what you have first:
--
--   select l.name, p.product_name, p.legal_fee
--   from lender_products p join lenders l on l.id = p.lender_id
--   order by l.name, p.product_name;
--
-- Then uncomment the ones you want.
-- ---------------------------------------------------------------------------
-- update lender_products p set legal_fee = v.fee from (values
--   ('bankwest',        '$350'),
--   ('cba',             '$200'),
--   ('anz',             '$160'),
--   ('stgeorge',        '$100'),
--   ('ing',             '$350'),
--   ('westpac',         '$100'),
--   ('suncorp',         'None - government fees only'),
--   ('bankofmelbourne', '$100'),
--   ('bankaustralia',   'None - government fees only'),
--   ('macquarie',       '$350'),
--   ('mebank',          '$150'),
--   ('nab',             'None - government registration fees only'),
--   ('ubank',           '$250')
-- ) as v(slug, fee)
-- where p.lender_id in (
--   select id from lenders where regexp_replace(lower(name), '[^a-z]', '', 'g') = v.slug
-- );
