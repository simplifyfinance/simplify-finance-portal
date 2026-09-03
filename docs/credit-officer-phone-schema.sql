-- THE NUMBER A BANK'S ASSESSOR RINGS.
--
-- The broker notes that go into a lender's application portal open with a line
-- telling the assessor who to call about this file. The habit was to paste a
-- block with every credit assessor's name and number in it and leave the bank
-- to work out which one. Fabio, 3 Sep 2026: "we're smarter than that. You know
-- who the assessor is."
--
-- We do - deals.assigned_credit_officer already says which one. What was missing
-- was somewhere to keep their phone number, so this is it. Maintained in
-- Settings, Credit team, beside the name, rather than written into the code:
-- a number in the code is a number nobody can fix at 6pm on a Friday.
--
-- Safe to run twice. Nothing already stored is touched.

alter table credit_officers
  add column if not exists phone text;

comment on column credit_officers.phone is
  'Direct number for this credit assessor. Printed at the top of the broker notes that go to the lender.';
