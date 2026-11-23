# The six ways a number goes wrong

**Written 23 November 2026, for this portal and the next one.**

The security audit asks one question — *what can somebody reach without logging
in* — and asks it of every route into the database. That framing is what made it
work. The first version checked the faults we already knew about and missed
three more within the hour.

**This is the same idea for figures.** One question: *how can a number on screen
be wrong while everything looks fine?* There are six answers. Every one has
happened in this portal, or came within a week of it.

A portal you run a business on is not judged on whether it loads. It is judged
on whether the number is right, and a wrong number never announces itself.

---

## 1. Truncation — the server sends less than you asked for

Supabase returns at most 1,000 rows per read and reports **no error** for the
ones it withheld. A screen asking for a whole table is correct until the day
that table passes a thousand, and then it is quietly wrong.

**It has happened twice here.**

2 November 2026: *"can you help me find deal cards for andrew leigh and sangeeta
gudigar I dont seem to be able to locate it but they were there yesterday."*
They were. 1,165 deals; the newest thousand came back. 241 were real; 92 were
visible.

23 November 2026: Portfolio Review's plan read four months of trail — about
8,700 lines — and was handed 1,000. Most loans found no line and came back with
no balance, on a page whose figures reach clients.

**The second happened because the first fix was applied where the bug was, not
everywhere the shape was.** That is the whole lesson of this document.

**Caught by:** `lib/no-silent-thousand.test.ts` at build time, check 16 of
`docs/weekly-audit.sql` weekly, and `docs/do-the-numbers-match.sql` whenever you
want to compare a screen against the database.

**Fixed by:** `everyRow()` in `lib/the-whole-book.ts`, which pages until a page
comes back empty — and tells the caller when it could not finish, so the screen
can refuse rather than guess.

---

## 2. A write refused in silence

Postgres returns **zero rows and no error** when a security rule blocks an
insert or update. The code sees no error and says "Saved".

Belle and Ellesse reported that folded columns on the board never stayed folded.
The cause was a rule allowing only admins to update `user_profiles`: Fabio's
folds saved, nobody else's did, and nothing anywhere said so.

**Caught by:** `lib/checked-write.ts` — read the rows back and treat an empty
result as a failure. A fire-and-forget `.then(() => {})` does not.

---

## 3. A join that quietly drops rows

Joining on a column that is null for some records. The row does not come back
short — **it does not come back at all**, and no total mentions it.

23 November 2026: a portfolio review created by the book import had no
`client_id`. A query joining reviews to clients returned nothing for it, and the
answer looked like "there is no such review".

**Caught by:** section 3 of `docs/the-accuracy-check.sql`, which counts the rows
with null keys on every relationship that matters.

---

## 4. A join that quietly doubles rows

One row on the left, two on the right, and every sum doubles. **The answer stays
plausible**, which is what makes this the worst of the six.

A deal with two stage snapshots counted twice in a per-stage total. The same
commission line imported in two statements. One loan on two reviews.

**Caught by:** section 4 of `docs/the-accuracy-check.sql`.

---

## 5. A missing value summed as zero

*We do not know* and *nothing* are different answers, and a sum cannot tell them
apart. A property with no recorded balance adds £0 to the equity total. The
total is wrong and nothing looks broken.

**Caught by:** section 5 of `docs/the-accuracy-check.sql`, which counts the
unknowns behind every figure that gets summed.

**Avoided by:** never writing `coalesce(x, 0)` on a figure that is shown to
somebody. Show a blank, or say "not recorded". A zero is a claim.

---

## 6. A date in the wrong month

The database runs in UTC. The business runs in Sydney, eleven hours ahead.
Anything recorded in the first eleven hours of a Sydney day belongs to the
previous day in UTC — and at a month boundary, to the previous month.

A settlement at 9am Sydney on the 1st is the previous month if you ask UTC.
Month-end commission and lodgement figures move depending on which clock the
query used.

**Caught by:** section 6 of `docs/the-accuracy-check.sql`, which counts the rows
sitting in that gap.

---

## The two commands

Say either by name, any time.

| Command | File | What it answers |
|---|---|---|
| **"Run the numbers check"** | `docs/do-the-numbers-match.sql` | What the database actually holds behind every screen, so you can compare it to what the screen shows |
| **"Run the accuracy check"** | `docs/the-accuracy-check.sql` | All six faults above, in one table, with anything suspect at the top |

Both are read-only. Both are part of the Monday audit, so they run whether you
ask or not.

---

## For the next portal

**Build `everyRow` before the first list screen.** Not after somebody cannot
find a deal card.

**Never write `coalesce(figure, 0)` for anything a person reads.** A blank is
honest. A zero is a claim you cannot support.

**Every join gets its null keys counted** before anybody trusts the total.

**Store timestamps in UTC — and do every month boundary in the business's
timezone**, explicitly, in the query. Not in the application afterwards.

**A screen that cannot get the whole answer says so and shows nothing**, rather
than showing part of it. Portfolio Review's plan now refuses to build if it
cannot read every trail line. That is the standard, not the exception.

**And fix the class, not the instance.** Both times this portal shipped a wrong
figure, the pattern existed in five other places and only the reported one was
fixed. The test that fails the build is worth more than the fix.
