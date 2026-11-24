# Sixth reply — we found the mechanism

23 November 2026

You asked the right question and it turned out to be answerable from the
repository in about ten minutes: *what was doing the deleting, and does it still
exist?*

It exists. It is a trash icon.

## 1. The October mechanism, identified

There is exactly one code path in the entire application that deletes a deal.
It is `deleteDeal(id)` in the deals screen. It is reached from a trash icon
rendered on every row of the deal list, next to a copy icon. There is no bulk
delete, no admin route, no script, and no scheduled job. I grepped for every
`.delete()` call in the codebase; nothing else touches `deals`.

So October was not a program. It was somebody clicking, repeatedly, across about
a dozen days.

Three things follow, and the third is the one that matters.

### The blocks are smaller than they look

`deal_history.deal_id` is declared `references deals(id) on delete cascade`. So
one deleted deal takes its entire edit history with it, and a deal that has been
worked on for weeks carries a lot of history rows.

That reframes the numbers. A contiguous block of 601 missing `deal_history` ids
is not 601 deals. It is the combined history of however many deals were deleted
in that sitting — plausibly single figures. Your four large blocks
(601, 547, 474, 434) are four sittings, not four thousand records of intent.

This does not make the deletions fine. It makes them *comprehensible*: a person
working through a list, not a runaway process. And it means the count of real
deals lost is much smaller than the gap arithmetic suggests — which is the one
place where our joint reasoning was running too hot.

### The orphan mechanism is in the same function, and it is a missing `if`

```ts
const { data: docs } = await browser.from('deal_documents')
  .select('id, file_path').eq('deal_id', id)
if (docs && docs.length > 0) {
  const paths = docs.map((d: any) => d.file_path)
  await browser.storage.from('deal-documents').remove(paths)   // <- result discarded
  const { data: gone, error: docErr } = await browser.from('deal_documents')
    .delete().eq('deal_id', id).select('id')
  ...
}
```

The storage removal is awaited and its result is thrown away. The record deletion
immediately after it *is* checked, and aborts the whole operation if it fails.

So the function is careful about the half it can see and blind to the half it
cannot. If the storage call fails or partially fails — one path wrong, one object
locked, a transient error — the files stay, the records go, the deal goes, and
nobody is told. The operator sees a clean deletion.

That is your two orphaned fact finds, exactly. Not a mystery, not a second
actor: one unchecked return value.

You were right that they are evidence, and right about what they are evidence
*of* — real deals with real client documents were deleted. We withdraw "nothing
real was lost"; it was never supportable and we should not have written it. What
we would now say instead is narrower and defensible: *we can identify the
mechanism, we can bound the volume, and we cannot yet name the records.*

### The access question — and a correction to our own alarm

Before writing this we expected to find the deals table governed by one of the
sixty authentication-only rules, which would have made the October question
"any of eighteen people, one click, no server record." We checked instead of
assuming, and that is not what is there.

The deals table carries a proper entitlement rule. Deletion is covered by a
policy whose condition is the same visibility test used for reading: you may act
on a deal if you are senior enough to see everything, or it is assigned to your
broker key, or you are its credit officer. That is an entitlement check, not an
authentication check, and it is one of the better-written rules in the schema.

So the October deletions were performed by somebody who was entitled to delete
those particular deals. That narrows the population considerably and changes the
character of the finding: this is a records-retention and change-control problem,
not an access-control breach. We would rather report that correction than let a
sharper claim stand.

What the same query did surface needs care, because the obvious reading of it is
wrong and we made that mistake first.

Twelve tables in the public schema carry a policy whose condition is the literal
`true`. Five of them are commission tables — splits, referral lines, trail
resolutions, trail gone-reasons and statement exclusions. We flagged those as an
inconsistency beside the restricted `commission_lines` and
`commission_statements`. They are not. They are two different things that share a
word.

Per-deal commission detail — the structure of a deal, what is payable on it, how
it splits — is open to every member of staff by design. Support staff and
administrators all need it to process the deal in front of them, and withholding
it would stop the business working. The restricted tables are the whole-of-book
analysis: the trail and upfront reporting that assesses the performance of the
entire loan book. That distinction is deliberate, it is correctly implemented
today, and an auditor reading only the table names would get it backwards.

We record it here because it is the kind of finding that looks like a
misconfiguration from the outside and is in fact a considered access model. The
lesson for the audit regime is that a rule of `true` is not self-evidently a
defect; it is a question about who the data is for, and only the business can
answer it.

That leaves seven genuinely open tables: the three portfolio-review tables, three
lender reference tables, and the staff directory. Those are being reviewed on
their merits rather than assumed wrong.

## 2. The monitor — your allowlist design is adopted

You were right and the baseline-of-1 is gone. The check now names the retained
file explicitly, so it reads zero, the exception is visible to anyone reading the
query, and one new orphan fails it.

The retained fact find is being dealt with on its own terms rather than as
monitoring furniture. "We kept it so the check reads 1" was not a lawful basis
and we are not going to pretend otherwise.

## 3. The 400 becomes an alert

Adopted without amendment. Any 4xx GET against an object path is somebody trying
the door we closed; a daily count with a page on non-zero costs one query against
a log we already retain. You are right that it converts a fixed vulnerability into
a monitored one, and right that the same logic applies to failed sign-ins.

## 4. Residency — the honest sentence

Adopted. The sentence is *stored in Australia, accessed from four countries,
processed under contract*, and the privacy policy will say so rather than stopping
at the first clause.

The access-model question — individual logins or a shared one for the offshore
team — is now folded into the entitlement work, because you are right that you
cannot decide who sees what without knowing who is looking. A shared login would
also make the October question unanswerable, which is its own argument.

## 5. Where this leaves us

Four things changed since the last note, and only one of them is about Sydney.

1. **The deletion mechanism is identified.** One trash icon on the deal list,
   one function, no script. Still live, and the operator gets no warning when the
   storage half fails. Code fix this week.
2. **The orphan mechanism is identified** — one discarded return value in that
   same function. Same change.
3. **The volume is smaller than the gap arithmetic implied**, because
   `deal_history` cascades. Tens of deals, not hundreds.
4. **A method correction.** We read twelve `true` policies as twelve defects and
   five of them are the access model working as intended. Per-deal commission
   detail is open to all staff deliberately; the whole-of-book analysis is
   restricted and already correct. Seven tables remain genuinely open and are
   being reviewed individually.

The fourth is the one worth carrying into your own practice. A permissive policy
is not a finding on its own — it is a question for the business about who the
data is for. We asked it three times before we listened to the answer.

The migration itself we still read as the least risky part, and nothing here
changes that — all four travel with the data regardless of which continent it
sits on. We are proceeding with the staging rehearsal and will send the measured
storage time and the canary comparison when we have them.

Thank you for the push on "what ran it." We would not have gone looking today
without it, and the ten minutes it took turned up both the mechanism and a
finding neither of us had on the list.
