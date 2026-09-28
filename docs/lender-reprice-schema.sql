-- HOW FAR THE LOAN CAN MOVE BEFORE THE PRICING HAS TO BE REDONE.
--
-- Fabio, 27 Sep 2026: "10% is only a St George Westpac and Bank of Melbourne
-- rule so in the document library complete that as you build the rule and leave
-- all other lenders as N/A and I will manually either input a figure or not
-- change so we dont ahve do to do 1 by one".
--
-- WHY THIS IS A COLUMN AND NOT CODE. The other lender rules - ninety days, who
-- can extend, whether a change goes in by email or through AOL - live in
-- lib/offer-accepted-rules.ts because they are facts the PORTAL has to
-- understand. This one is a number that changes when a bank changes its mind,
-- and nobody should wait ten minutes for a deploy to type it in. It sits in the
-- lender library beside the fee wording and the statement codes, and Fabio or
-- Katie edit it directly.
--
-- NULL MEANS N/A, AND N/A IS A REAL ANSWER. A lender with nothing recorded is
-- never given the most common rule - the deal says "no repricing rule is
-- recorded for Macquarie, check before you submit" instead. A wrong threshold is
-- worse than no threshold: it tells somebody the discount still holds when it
-- does not.
--
-- Safe to run twice. Nothing already typed is overwritten.

alter table public.lenders
  add column if not exists reprice_over_percent numeric;

comment on column public.lenders.reprice_over_percent is
  'The loan may move by up to this percentage, up or down, before this lender wants the pricing redone. NULL means no rule has been recorded, which the portal says out loud rather than guessing. A percentage only - no lender of ours works on a dollar figure.';

-- THE EIGHT WE HAVE BEEN TOLD ABOUT, and only those eight.
--
-- Fabio, 28 Sep 2026: "these are all the lenders that if pricing is wihtin 10%
-- up or down we dont need new pricing" - CBA, Bankwest, ANZ, St George,
-- Westpac, NAB - and then, asked about the two Westpac-group banks he had not
-- named: "bankSA and Bbak of Melbourne also 10%".
--
-- The first version of this file had three, and a comment explaining that
-- BankSA was deliberately left out. That was right at the time and is wrong
-- now. Left as a note rather than quietly rewritten, because the reason a rule
-- changed is worth as much as the rule.
--
-- Named exactly, not by pattern. `ilike 'westpac%'` would also catch a
-- "Westpac Equipment Finance" added next year, and a threshold applied to a
-- bank nobody checked is the thing this file exists to avoid.
--
-- `is null` on purpose: this fills a lender that has never been given a figure
-- and leaves alone any that somebody has since typed by hand. Running it again
-- after Fabio moves St George to 15 will not drag it back to 10.
update public.lenders
   set reprice_over_percent = 10
 where reprice_over_percent is null
   and name in ('CBA', 'Bankwest', 'ANZ', 'St George',
                'Westpac', 'NAB', 'Bank of Melbourne', 'BankSA');

-- What that just did, and what is left as N/A. Read this before closing the tab.
select name,
       coalesce(reprice_over_percent::text, 'N/A') as reprice_over
  from public.lenders
 where active
 order by reprice_over_percent nulls last, name;
