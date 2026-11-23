# The Sydney problem — what happened, and what I think

Written 23 November 2026 for Fabio De Castro, Simplify Finance
(Mortgage Specialists Pty Ltd, ACL 387025).

**This document is written to be argued with.** It is being put in front of
other reviewers on purpose. If you are one of them: please attack section 6,
which is where I think we are most exposed, and section 8, which is what I am
least sure about. I would rather be corrected now than on a Saturday night.

---

## 1. What happened

Simplify Finance runs an internal portal that handles mortgage broking end to
end — fact find, borrowing capacity, lender selection, compliance, lodgement,
settlement. Roughly sixteen staff. It holds names, dates of birth, address
history, employment, income, assets, liabilities, bank statements, payslips and
loan documents for several hundred Australian households.

The database is hosted on Supabase. **It is in Singapore (`ap-southeast-1`).**
The staging database is in Seoul (`ap-northeast-2`). Two other projects on the
same account — accounting, and an unrelated portal — are correctly in Sydney.

The owner has stated from the beginning of the project, repeatedly, that client
data stays in Australia. That is not what happened.

### The timeline

| When | What |
|---|---|
| 9–10 June 2026 | Project created and first connected to Supabase. The region is chosen once, at creation, and cannot be changed afterwards |
| 16 September 2026 | The region was **written down** in `docs/OUTSTANDING.md`: "production `brjytbuirbupatjtauhx` (Singapore), staging `jfgsyotmvwxeaohwdejv` (Seoul)" |
| 16 Sep – 22 Nov | Nothing happened. The line sat in the repository as a reference detail |
| 22 November 2026 | Found, while gathering facts for an external IT security review |

**Who chose Singapore is not established.** I cannot see it from here and I am
not going to assert it. What I can say is that the fact was recorded in a file
I wrote, and I never once connected it to what the owner had said about
Australia. Two months. That is the failure that matters, and it is mine.

### Why it may have been missed at creation

Supabase lists the region as **"Oceania (Sydney)"**. AWS, whose infrastructure
it runs on, calls the same region "Asia Pacific (Sydney)". Singapore appears in
the same list as "Southeast Asia (Singapore)". Somebody scanning that dropdown
for Australia or for Asia Pacific could reasonably skip past Oceania.

That is an explanation, not an excuse, and it is offered because a reviewer
will ask how it happened.

---

## 2. What the portal actually holds

This governs how seriously to take everything below.

- Client personal information: full name, date of birth, residential address
  history, email, phone, marital status, dependants
- Employment and income, including self-employed company figures
- Financial position: property, values, liabilities, limits, repayments
- Documents: bank statements, fact finds, payslips, lender correspondence
- Loan data: application references, approval dates, rates, structures
- Commission data, including splits with third-party firms
- Staff data

No card numbers, no bank account numbers, no money moves through it. It is a
file of credit-related personal information for several hundred households.

### The size of the problem, measured

| | |
|---|---|
| Tables | 58 |
| Row-level security policies | 114 |
| Auth users | 18 |
| Storage objects | 582 (136 MB) |
| Database | 146 MB |

**It is small.** The data moves in minutes. The difficulty is entirely in
correctness, not volume.

---

## 3. What the vendor has confirmed

From Supabase support, 23 November 2026, and their published documentation:

- **A project cannot change region.** It is bound to its hardware.
- **Supabase will not do the migration.** On the Pro plan it is self-serve.
- **"Restore to a new project" and the clone feature are useless here** — both
  keep the data in the source region.
- **The database backup does not contain storage files.** Those copy separately.
- **`supabase db dump` excludes the managed `auth`, `storage` and extension
  schemas by default.**
- **They will not estimate downtime.** Rehearse and measure it.

### And the part that changes the goal

Supabase's own legal pages state that **Supabase Pte. Ltd., a Singapore
company, is the primary data processor**, and **Supabase, Inc. in the United
States provides technical support and operational services**, with transfers to
Singapore and the United States under standard contractual clauses.

Their subprocessor list names **ActiveCampaign and Postmark, in the United
States**, for communications. The portal uses Supabase Auth to send password
resets and staff invitations, so those emails go through US infrastructure
today and will after the move unless custom SMTP is configured.

Where logs, analytics and point-in-time recovery data sit is **not documented
at all**, and nor are the jurisdictions from which Supabase staff access
customer data. All four have been put to them in writing and are unanswered.

**So the move does not achieve "nothing leaves Australia".** It achieves
"client data is stored in Australia", which is the question anybody actually
asks, and which is currently answered wrongly. That is still worth doing, but
the claim afterwards has to be the narrow one.

---

## 4. The plan, and why this shape

Four phases. **Production is not touched until the entire process has been
performed successfully on a database that does not matter.**

**Phase 1 — move the staging project from Seoul to Sydney.** Exactly as it is.
This is a complete rehearsal of the real migration: same dump, same restore,
same auth migration, same storage copy. Staging holds no client data, so the
cost of getting it wrong is nothing.

**Phase 2 — bring that Sydney staging up to date against production.** Schema
only, no client records. Staging has never matched production, which is why it
was parked in September. This fixes a problem that exists independently of the
region.

**Phase 3 — run the 43 browser tests against it, repeatedly, over days.** Plus
manual work through every screen. Every failure here is a failure that would
otherwise have been discovered on production at eight o'clock on a Saturday.

**Phase 4 — production, on a weekend**, running steps that have all been
performed before.

### Why rehearse on staging rather than on a copy of production

The owner's call, and it is the right one. A copy of production would exercise
the data migration as well, but it would put real client records into a test
database for no good reason. Staging proves the process; the data, the users and
the files are the only parts left unrehearsed, and section 5 lists them.

---

## 5. What the rehearsal will not prove

Honest list. These become the first checks on the real day.

| Not testable on staging | Why | So on the day |
|---|---|---|
| The data moving | Staging has test data, not 146 MB of real records | Compare row counts table by table |
| The 18 user accounts | Staging's users are not the staff | Verify all 18 IDs identical; sign in with a real password before anyone is let in |
| The 582 files | Staging has almost none | Count, then open three documents from three different deals |
| The catch-up copy | Nothing is written to staging while we work | Freeze writes, re-copy, re-verify |
| Several people at once | Automated tests work alone | Watch the first hour |

All five have been put to Supabase in writing.

---

## 6. My concerns, ranked

**Attack this section.**

### 6.1 The security policies not surviving, silently

This is the one that keeps the list. A restore can bring every table and every
row across and leave the row-level security behind. The portal would look
completely normal — every screen works, every number is right — and the
database would be readable by anyone holding the public key.

This is not hypothetical. **On 12 November 2026 a table was created in this
production database by copying another one.** It inherited no policies, no
row-level security and no grants, and was readable by anyone with the public key
for six days. One table. A bad restore does that to all 58 at once.

Supabase have **declined to confirm in writing** that a schema dump definitely
emits the `CREATE POLICY` statements and the row-level-security switches for
every table. Their answer was that the documentation does not guarantee it.

**Mitigation:** `docs/both-sides-must-match.sql` compares table counts, policy
counts, row-level-security flags, grants and the full text of all 114 policies
across both databases. Nothing goes live until they are identical. The rehearsal
runs this first, so if dumps do drop policies we find out on staging.

**Residual risk:** the comparison is only as good as the queries in it. A second
pair of eyes on that file would be valuable.

### 6.2 One function that everything depends on

All 114 policies call a function named `auth_role()`. If it does not restore, or
restores with the wrong owner, every policy fails and nobody can do anything.

This fails loudly rather than silently, which makes it less dangerous than 6.1 —
but it would fail at the worst moment.

### 6.3 The user IDs

Eighteen accounts. Their IDs are referenced by eight tables with declared
foreign keys, by `user_profiles.id` — which is what every policy reads to
determine who you are — and by identifiers stored inside deal records that have
no foreign key at all and would therefore fail silently.

If the IDs change, the portal looks empty for everyone and the record of who did
what inside each deal points at nobody.

### 6.4 We do not have a complete description of production

`docs/OUTSTANDING.md` states that **sixteen tables exist in production with no
file anywhere that creates them.** The repository is therefore not a
specification of the database, which means:

- We must dump from the live database, never replay our own files
- We have no known-good document to verify the result against, other than the
  source database itself
- Nobody can say with certainty what else is in there

This is being fixed as part of the work — `scripts/pull-the-real-schema.sh`
writes production's real schema into the repository.

### 6.5 The rollback window is shorter than it feels

Until the first person saves something in Sydney, rolling back costs nothing:
change three values in Vercel and you are back on Singapore. **After that, going
back means losing whatever was done in between**, because Singapore is no longer
being updated.

I initially described the rollback as simply switching back, which was wrong.
Supabase corrected it and they are right.

### 6.6 One person has looked at this

Me. I have been wrong several times in the course of a single day's work on it:
I overstated how many client links were exposed, I wrote a verification query
that measured the wrong thing, and I argued for a rehearsal approach that was
worse than the owner's. Each was caught by being challenged.

**That is the strongest argument for this document existing.**

### 6.7 It will be done tired, on a weekend, by one person

Operationally this is the most ordinary risk and the most commonly fatal one.
Mitigations: everything rehearsed, a written runbook, a script that refuses to
restore over production, and a verification that must pass before anyone is let
back in.

### 6.8 What the move does not achieve

See section 3. If the owner tells his reviewer "everything is in Australia", he
will be wrong a second time. The claim has to be "client data is stored in
Australia".

---

## 7. What is being done about each

| Concern | Mitigation | Enough? |
|---|---|---|
| Policies lost silently | Full comparison of both databases before cutover; rehearsed on staging first | Probably — wants review |
| `auth_role()` | Explicitly checked in Phase 3 | Yes |
| User IDs | All 18 compared before anyone is let in; Supabase asked how to verify beforehand | Awaiting their answer |
| No complete schema | `pull-the-real-schema.sh` writes production's real schema into the repo | Yes, and overdue |
| Rollback window | Stated plainly in the runbook; Singapore stays up for two weeks | Yes |
| One reviewer | This document | In progress |
| Weekend fatigue | Rehearsed steps, written runbook, refusal guard on the restore script | Reasonable |
| Partial residency | Written questions to Supabase; honest wording for the reviewer | Yes |

---

## 8. What I am least sure about

Please challenge these specifically.

1. **Whether a schema dump reliably includes row-level security.** Unanswered by
   the vendor. The entire verification approach is built on the assumption that
   if it does not, the comparison catches it. Is that sufficient?

2. **Whether the API keys change.** If reusing the JWT secret produces identical
   anon and service keys, the cutover becomes a single URL change and several
   risks disappear. Supabase say the documentation does not state it. Unanswered.

3. **The storage copy.** Supabase publish a script. It lists objects with a limit
   of 1000 and does not paginate past it, and it overwrites by path. With 582
   objects we are under the limit, but I have not seen anyone report running it
   at scale and I would not assume it is complete without verifying.

4. **Whether the staging rehearsal is representative enough.** Staging is
   smaller, has different data, and fewer users. Does rehearsing on it genuinely
   de-risk production, or does it create false confidence?

5. **Sequences and identity columns.** After a data-only restore, do they resume
   at the correct position? If not, the first insert after cutover collides.
   Asked, unanswered.

6. **Whether we should move at all**, given the processor is a Singapore entity
   regardless. My view is yes, because where data is stored is the question
   anyone asks and it is currently answered wrongly. I would like that view
   tested.

---

## 9. Questions for a reviewer

If you are reading this as a second opinion, these are the ones I would most
value.

1. Is the two-database comparison sufficient to prove a restore is safe, or is
   there a better check?
2. Is there an approach to this migration we have not considered?
3. What commonly goes wrong in Supabase region migrations that is not in
   section 6?
4. Is the staging-first rehearsal representative, or false comfort?
5. For an Australian credit licensee: what disclosure obligations arise from
   client data having been held offshore for roughly five months?
6. Should anything else be done in the same maintenance window, or is one
   change at a time correct?

---

## 10. Where things stand

**Nothing has been executed.** No database has been touched.

**Done:** the problem found and measured; the vendor engaged, with thirteen
questions outstanding across three emails; a written runbook
(`docs/moving-the-database-to-sydney.md`); a verification script
(`docs/both-sides-must-match.sql`); two executable scripts with a guard that
refuses to run against production (`scripts/pull-the-real-schema.sh`,
`scripts/bring-staging-up-to-date.sh`); 18 automated tests covering that guard.

**Waiting on:** Supabase's answers, particularly on the API keys and on whether
dumps include row-level security.

**Can be done regardless:** pinning the link-signing secret in Vercel, and
gathering facts from the production database about extensions, scheduled jobs
and encrypted secrets.

**Measured exposure on client-facing links:** one link sent on 26 October that
never expires, plus an unknown but small number of question links that expire
28 days after sending. The portal does not record the three emails that carry
those, which is a separate gap worth fixing.

---

## 11. The uncomfortable summary

A business that has said since June that its client data stays in Australia has
been running for five months on a database in Singapore, with staging in South
Korea. It was written down in the project's own documentation in September and
nobody acted on it, including me.

It is fixable in one weekend, the data is small, and the process is
well-trodden. The real risk is not the move. It is doing the move badly and
leaving 114 security policies behind on a database full of other people's
financial information.

That is what everything above is built to prevent, and it is what a second
reviewer should test hardest.
