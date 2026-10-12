# Paco — what he is, and how he learns

Version 1.0 · 12 October 2026 · ONE by Simplify · internal

Merged from Fabio's research brief, the Credit Policy AI Blueprint v1.0, and the Paco
already live in the portal.

---

## First, what Paco is — and stays

Paco is a parrot. He repeats what he has been told and he says who told him. He does not
work things out, he does not reason about your deal, and he never invents. That was the
point on the day he was built and it is the point now.

The blueprint that follows is **guidance for what he learns**, not a replacement for what he
is. He keeps the bubble on every page, the panel that opens over whatever you are doing, and
the Spanish hello. If a change would turn him into a system you have to go and use rather
than something that is just there, it is the wrong change.

**Rates are out of scope.** You have the rate sheet. Paco answers policy questions.

---

## The one rule everything hangs off

> Official written lender policy outranks everything else, and internal experience never
> silently overwrites official policy.

Taken from the blueprint, section 2. It is the sentence the whole design exists to enforce.

---

## Where Paco's knowledge comes from

Three sources. One is built, two are not.

**Past deals.** Live today. Every deal you have written, tagged, with the lender you chose
and what happened. Paco already reads these and cites them.

**Your team.** Someone knows something. They tell Paco. New.

**Lender documents and emails.** Credit manuals, policy pages, and the updates lenders send
you. New.

---

## How firm is it — the five tiers

Straight from the blueprint, section 3. Every single thing Paco knows carries one of these,
and he says which one every time he answers.

| Tier | What it is | How Paco uses it |
|---|---|---|
| **A** | Official lender credit manual or live policy page | The primary answer, subject to a currency check |
| **B** | Official written update, lender email, written BDM clarification | Can amend a rule, keeping its scope and effective date |
| **C** | Product guide, FAQ, public summary | Indicative only — never assume it is the whole policy |
| **D** | Verbal BDM feedback, our own experience | Practical intelligence. **Never becomes official policy on its own** |
| **E** | Third-party tools, community chat | A hint to go and check. Nothing more |

A tier D claim and a tier A claim about the same thing do not fight. Paco shows both and
says which is which.

---

## Who can add things — anyone

**Anyone on the team can tell Paco something, and it is live immediately.** No queue, no
waiting on one person, no backlog that grows while somebody is on leave.

The safeguard is not a gate. It is that **every single thing carries a name and a date**, and
Paco shows them every time he repeats it.

> "Macquarie will consider limited title."
> Team experience — Sam Fletcher, 12 Oct 2026. Not lender policy; confirm with the BDM.

The same applies to a document or a forwarded email: the person who put it there is the
person stamped on everything that came out of it. The act of forwarding a lender's email
*is* the human decision. There is no second one.

**Anyone can correct or retire anything**, and that is stamped too. Nothing is ever deleted —
a retired claim stays readable with the date it was retired and who retired it.

**Unapproved claims do not exist as a concept.** Nothing hides in a queue, so nobody ever
sees a different answer from anybody else.

---

## What every claim has to carry

From the blueprint, section 2 and section 7. Non-negotiable:

- the lender
- the rule, in plain words
- the conditions and exclusions
- **where it came from** — document and page, or heading, or the email and its date
- **the exact sentence it came from**, quoted, for anything taken out of a document
- the effective date, when the lender gives one
- when it was last checked
- who put it there, and when
- its tier

**Nothing extracted from a document is ever saved as a paraphrase.** The quote travels with
it. That is what makes a citation worth anything — you can open the page and read the
sentence yourself.

---

## Dates decide what is live

**A rule with a future effective date is not live until that date arrives.** Lenders announce
in October for November. Paco holds it, says it is coming and when, and starts using it on
the day.

**A rule that has been superseded stops being live and stays readable.** You can still ask
what the policy was in March.

**A rule nobody has checked in a long time gets hedged, not hidden.** Paco says when it was
last confirmed and lets you decide.

---

## How Paco answers

He searches what he has been told. He never recalls a document from memory — he looks it up
every time, because a citation you cannot open is not a citation.

Every answer carries: what he found, which tier, who said it, when, and a way to open the
source.

And he is specific about not knowing, which is more useful than a shrug:

- nothing recorded for that lender on that subject
- something recorded but it has gone stale
- two things recorded that disagree — **both shown, with their tiers and dates, and no
  attempt to pick a winner**

When a rule cannot be confirmed he says **"Not verified — check with the lender or BDM"** and
names the exact thing to check.

**He is a triage aid.** Not a credit decision, not a lender commitment, not serviceability,
and not a substitute for best interests duty. That line appears on every lender comparison
he gives, not just in this document.

---

## The lender update inbox

**Forward lender updates to a dedicated address and they load into Paco.**

The address lives on a **subdomain** — something like `policy@paco.simplifyfinance.com.au` —
because receiving mail needs an MX record, and putting one on your main domain would
interfere with your normal email. A subdomain keeps them completely separate.

Resend handles this and you already use Resend to send. Same account, same keys, nothing new
to secure.

What happens when an email arrives:

1. The original and every attachment are stored, unmodified, with a hash.
2. Who forwarded it is recorded — that is the name that goes on anything extracted.
3. The lender and the type of change are identified.
4. Attachments are read by the same route that already reads lender PDFs for the library.
5. What it claims is shown **beside whatever it contradicts**, if anything.
6. It goes in, stamped, at tier B.

**An email from an unknown sender is held and flagged rather than loaded.**

---

## Two things that are security, not features

**Document and email text is data, never instructions.** A lender PDF or a forwarded email
containing something like "ignore your previous instructions" must have no effect whatsoever.
Everything read out of a source is treated as untrusted text to be quoted, never as something
to obey. This is in the blueprint's acceptance tests and it belongs there.

**No client details in the shared knowledge base.** No names, no application numbers, no
financial documents. A policy insight is about a lender, not about a borrower.

---

## What we are not building

**No crawling of lender websites or broker portals.** The blueprint lists daily scheduled
fetching — and then, in its own open decisions, asks what each lender actually permits
regarding automated fetching, copying and indexing. That question sits underneath the whole
pipeline and it is a commercial and contractual one, not a technical one. Upload and
forwarded email are unambiguous: they sent it to you. Crawling is a separate decision for
another day.

**No vector database.** Structured rules and searchable text, in Postgres. For a handful of
lenders this is faster and it can explain itself. Add embeddings when retrieval actually
fails, not in anticipation.

**No confidence score.** A number between nought and one gets trusted without being read.
The tier says where a claim came from, which is a fact, not a guess.

**No ranking lenders by anything commercial.** Policy fit only.

---

## The tests that come before the features

From the blueprint, section 16. These become real guard tests, the same way everything else
in this portal is guarded:

- An answer cites a real source, at the right version, and never a made-up one
- A future-dated rule stays inactive until its date
- Two sources that disagree produce both answers, never a silent winner
- An older document cannot replace a newer rule
- Team experience is never presented as lender policy
- A numeric boundary — LVR at exactly 80% — is evaluated by code, not by a model
- A source containing hostile instructions changes nothing about how Paco behaves
- A question missing something decisive gets asked back, not guessed at

---

## Build order

**One. Team knowledge.** The box in Paco's panel: lender, what you know, tier, done. Live
immediately, stamped. Paco answers from it alongside the deals he already reads. Smallest
useful thing, and it is the half that makes Paco yours rather than a document reader.

**Two. Documents.** Upload a credit manual. Original preserved and hashed. Extracted into
rules that must quote. Paco answers from them at tier A. Start with the two sources the
research actually verified — the Macquarie credit guidelines PDF and the AMP policy library.

**Three. The inbox.** The subdomain, the MX record, forwarded lender updates landing at
tier B with the forwarder's name on them.

**Four. Everything else**, and only if the first three get used.

---

## Still to decide

**A named policy owner.** Not an approver — you have ruled out approval — but someone whose
job it is to notice when something has gone stale. Policy stated confidently and wrongly is
worse than no policy. This is the one thing in the blueprint's open decisions I would not
skip.

**What each lender permits** regarding storing and internally sharing their credit manual.
Your licence, your relationships, and worth a conversation before the library gets large.

**How stale is stale.** My suggestion: tier A rules go amber at twelve months, tier B at six,
tier D at three. You know how fast your lenders move.

---

Sources for the email setup: [Resend inbound introduction](https://resend.com/docs/dashboard/inbound/introduction) · [Resend inbound custom domains](https://resend.com/docs/dashboard/inbound/custom-domains)
