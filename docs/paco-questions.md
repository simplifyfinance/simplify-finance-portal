# The questions we measure Paco against

**14 Oct 2026.** Fabio: *"I rather you really spend time on it before we move ahead as this has wasted hours of my time."*

This is the set that found three ranking faults before they reached the portal. It is not a unit test — it needs a database with a real lender document in it — so it lives here as the thing to run by hand after any change to how the library searches.

## How to run it

Load one lender's document through the Library, then in the Supabase SQL editor:

```sql
select number, title, round(score::numeric, 4) as score, loosened
from paco_find_sections('<lender id>', 'cash out', 5);
```

## The set, against Macquarie Residential Home Loans Credit Guidelines v14.1

56,999 characters, 25 sections. Measured 14 Oct 2026.

| # | Question | Should land on | Result |
|---|---|---|---|
| 1 | cash out | 1A Equity release and cash out | correct |
| 2 | equity release restrictions above 80% LVR | 1D Maximum LVR | correct |
| 3 | self employed income two years financials | 3C Income, Self-Employed | correct |
| 4 | can a casual worker borrow | 2A Borrowers | correct, loosened |
| 5 | genuine savings | 2E Contributions and Genuine Savings | correct |
| 6 | what is the maximum LVR | 1D Maximum LVR | correct |
| 7 | living expenses | 3H Commitments, Living expenses | correct |
| 8 | guarantor | 2A Borrowers | correct |
| 9 | crypto currency as a deposit | **nothing — it is not in the document** | **see below** |
| 10 | what LVR can I go to with LMI | 1D Maximum LVR | 1D is second, 1A first |
| 11 | does Macquarie accept rental income from Airbnb | 3D Income, Rental | correct, loosened |
| 12 | exit strategy for a 55 year old | 3I Mature Age and Exit Strategy | correct |
| 13 | construction loan progress payments | Construction Loans | correct |
| 14 | credit report defaults | 2D Credit reports | correct |
| 15 | how long is an approval valid | Guidelines Overview | correct, loosened |
| 16 | residency non resident borrower | 2B Residency Matrix | correct |

14 of 16 land on the right section first. All 16 are in the top two, which is what matters, because Paco is handed the top five.

## The three faults this set found

**The title had no weight.** "cash out" returned 3G Commitments, Negative gearing ahead of the section literally called 1A Equity release and cash out. "out" is an English stopword so the query is just `cash`, and 3G says it eleven times against 1A's three. Fixed by weighting the context line A and the body B.

**Every word was required.** "can a casual worker borrow" returned nothing at all, because `websearch_to_tsquery` ANDs every word and no one section holds all three. Returning nothing on a document that covers casual income is the worst possible answer: it is indistinguishable from the truth. Fixed by asking for all the words first and any of them second.

**Long sections won on volume.** `ts_rank_cd` rewards density and ignores length. Swapping to `ts_rank` with normalisation 1 took the set from 8 right to 14 right.

## Question 9, and why it is the important one

**crypto currency as a deposit** should find nothing. The word appears zero times in the document. On the strict pass it correctly finds nothing — and then the loose fallback matches "deposit" and returns 2E Contributions and Genuine Savings.

That is the fallback damaging the one behaviour both implementation briefs call the highest-value thing to get right: declining to answer.

**So the rule, and it is not optional:**

> A loosened result is never presented as an answer. Paco says nothing in this lender's policy matches the question, and offers the closest sections as something to look at — not as the answer.

`paco_find_sections` returns `loosened` for exactly this. If the answering layer ignores that flag, Paco will confidently answer a question about crypto with a section about genuine savings, and it will look completely convincing.

## What this set does not cover yet

One lender. One document. No team notes, no lender emails, no conflicting versions, no cross-lender questions. Those need their own rows here before anyone calls the library finished.
