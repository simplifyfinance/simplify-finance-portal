# The chain

**Fabio, 12 October 2026, after an afternoon of six separate faults that turned
out to be one missing idea:**

> "since day one the logic is we have fact find information, we use THAT
> information to do BC which the structure we are suggesting to the client. If I
> say a loan of 800K against a house of 1M, that is the logic here. YES LO is
> where we look for rates but the rates are BASED ON what the BC set up, HENCE
> WHY we ask client agree to proceed to next step and then compliance. There is
> NO REASON the code should miss that."
>
> "look at every deal, a flow of everything interconnected all the way to
> settlement. That is the point."

This file is that logic, written down. Every change to this portal is checked
against it. If a change needs one of these rules bent, the rule is wrong and
gets argued with here first — not quietly worked around in a file.

---

## The chain runs one way

**Fact find** — what is true about the client. Income, properties, existing
loans, liabilities. Facts are entered here and nowhere else.

**Borrowing capacity** — what we are proposing, worked out from those facts.
$800,000 against a $1,000,000 house. How many splits, what each one is for,
which property secures it. **This is the structure.**

**The client agrees to proceed** — the gate between proposing something and
pricing it.

**Lending options** — which lender, at what rate, **for that structure**. The
rates being offered are rates for what the borrowing capacity set up. This stage
prices the deal. It does not design it.

**Compliance** — the written record of all of the above, and of why. It
describes. It never invents.

**Lodgement and settlement** — the same deal, still carrying the same structure,
all the way out the door.

One direction. Each stage inherits from the one before it.

---

## One owner each

| Stage | Owns |
|---|---|
| Fact find | the facts |
| Borrowing capacity | the structure — amounts, splits, purposes, securities |
| Lending options | the pricing — lender, product, rate, fees, turnaround |
| Compliance | the wording |

Nobody downstream quietly owns something upstream. A later stage holding its own
copy of an earlier stage's answer is a bug waiting for a date.

---

## The five rules

**1. Information flows one way, and downstream never silently drifts.**
Where a later stage shows something an earlier stage owns, it reads it rather
than keeping a copy. A copy is allowed only where it is refreshed every time the
record loads.

**2. A later stage never invents a fact an earlier one did not record.**
Missing is said out loud — "NOT RECORDED" — never filled in with something
plausible. This is the difference between a compliance pack and a liability.

**3. When two stages disagree, the owner wins, and it is fixed rather than
reported.**
A warning that a person has to resolve by hand, on every deal, forever, is not a
safeguard. It is a to-do list nobody is holding. Where the owner is known, the
owner's answer is applied.

**4. Nothing that reaches a client or a regulator is switched on or off by a
flag that can flip without anyone seeing.**
A paragraph that silently stops printing is worse than one that was never
written, because nobody is looking for it.

**5. Things are joined by what they are, not by what they are called.**
A label is a description. An id, or a position, is the thing. Two loans with the
same name are still two loans.

---

## The afternoon this came from

Six faults, found between lunch and midnight on 12 October 2026. Not six
accidents — five rule breaks.

| What went wrong | Rule |
|---|---|
| The lending options tab stuck on the purchase email template on a refinance, so it asked for a purchase price, a deposit and stamp duty, and worked out a 100% LVR | 1 |
| Six splits on the borrowing capacity never reached the lending options, because one keystroke months earlier had frozen that list for good | 1 |
| The buffer paragraph stopped going to clients, switched off by a label on an email | 4 |
| The borrowing capacity drew purchase boxes on a refinance, and a figure typed into one would have put a purchase into a compliance pack | 2 |
| The compliance pack said "principal and interest" on a deal that was half interest only, then said "interest only" two sentences later | 2 |
| Ticking one offset ticked three, because the tick was stored by the split's name and three houses carried the same two names | 5 |

Every one of them was invisible until somebody happened to read the output.

---

## What this means in practice

- A downstream stage that cannot show an upstream answer correctly is fixed at
  the join, not patched at the symptom.
- Any client-facing or regulated sentence that can be suppressed gets a test
  that walks every scenario and fails the ship when it goes quiet. See
  `lib/the-buffer-note-goes-out.test.ts` and `lib/rate-notice-everywhere.test.ts`
  for the shape.
- Any rule about which scenarios something applies to is a named list, never
  "anything that is not X". Inferred lists are how complex refinance ended up
  missing from six of them on the same day.
- A guard that protects work must protect the FIELDS somebody typed, never the
  whole record. See `mergeWithBc` in the lending options form: the structure
  follows the borrowing capacity, and the lending options' own answers survive.
