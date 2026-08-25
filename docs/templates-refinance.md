# Handoff brief — Templates tab (refinance email generator)

Paste this whole file into the Claude chat that has the portal context.
It explains what exists, what's been verified, and what's left to do.

Confidential IP of Simplify Finance (Mortgage Specialists Pty Ltd, ACL 387025).

---

## What this is

A new **Templates** tab in the Simplify Finance portal. The team types a
client's name, email and loan figures; the page calculates the refinance
saving, renders a formatted HTML email, and gives them a two-click send:
copy the email, then open their mail client with recipient, BCC and subject
already filled.

There is a P&I variant (owner-occupier, framed around monthly saving and
paying the loan off sooner) and an IO variant (investor, framed around
cashflow improvement).

## What this deliberately is NOT

An earlier version of this design had a full campaign pipeline — records in a
table, stages, call attempts, outcomes, a manager dashboard. **That has been
dropped.** Workflow, SMS automation and performance tracking all happen in
SalesTrekker instead.

The practical consequences, which matter for how you build this:

- **No database table.** Nothing persists. No migration, no RLS policies.
- **No Supabase dependency on this page at all.**
- **No role gating.** Nothing to secure, because nothing is stored.
- The only persisted state is the sender's own defaults (their name, Calendly
  link, landing page link, BCC address) in `localStorage`.

If anyone suggests adding a table for this, the answer is no — that was
considered and consciously rejected.

## How tracking works

The BCC field holds the SalesTrekker email-capture address. Because the email
is sent from the broker's own mailbox with that address BCC'd, SalesTrekker
logs it against the record automatically. No second step, no sync job, no
webhook. This is why the mailto link must carry the BCC.

---

## Files

Four files. Three are finished and verified; one is UI you may want to adjust.

### `lib/refinance-calculations.ts` — verified, don't change the maths

Pure functions, zero dependencies.

- `calculateRefinance(input)` returns repayments, monthly/annual/period
  savings, net cash position, and (P&I only) months saved if repayments are
  held at the current level.
- `monthlyRepaymentPI` uses the standard amortising formula
  `P·r / (1 − (1+r)^−n)`.
- `monthlyRepaymentIO` is `balance × rate ÷ 12`.
- Throws `RefinanceInputError` with a human-readable message on bad input.
- `priorityScore()` exists for ranking a list by monthly saving. Unused right
  now — harmless, and useful if a queue is ever added.

**Verification already done.** The formula was checked against the published
ASIC MoneySmart figure ($500,000 at 6.00% over 30 years = $2,997.75 — matches
to the cent) and cross-checked against an independent month-by-month
amortisation simulation. The term-reduction figure was verified two ways
(closed form and simulation) and agrees within one month.

One subtlety worth knowing: repayments rounded to the nearest cent leave about
$3 outstanding at the end of the stated term, so a simulation clears at month
325 rather than 324. That is correct behaviour — real lenders adjust the final
payment. The test asserts ±1 month rather than an exact match.

### `lib/refinance-calculations.test.ts` — vitest

18 assertions: reference figures, P&I outputs, IO outputs, amortisation
cross-check, input guards, net cash position.

Check whether the project already has a test runner before installing one:
`grep -i -E "vitest|jest" package.json`. If neither is present, ask Fabio
before adding a dependency.

### `lib/refinance-email-template.ts` — verified

- `buildRefinanceEmail(input, ctx)` returns `{ subject, html, plainText }`.
- `buildMailtoUrl({ to, bcc, subject })` returns the mailto link.
- `buildRefinanceSms(input, ctx)` returns SMS wording (226 chars, two
  segments, includes a STOP opt-out).

**Email HTML constraints — do not break these.** Nested `<table>` elements
with `role="presentation"`, inline styles only, 600px max width, web-safe font
stack. No flexbox, no grid, no `<style>` block, no CSS classes, no
`border-radius: 50%` badges. These all fail in Outlook, Gmail or Apple Mail.
This was learned the hard way on the SalesTrekker checklist email. The output
is programmatically checked against each of these.

**Two bugs already found and fixed** — don't reintroduce them:
1. `URLSearchParams` encodes spaces as `+`, which Outlook renders literally in
   the subject line. The code uses `encodeURIComponent` and builds the query
   string manually.
2. Clipboard writes need both `text/html` and `text/plain`, and the
   `ClipboardItem` must be constructed synchronously inside the click handler
   or Safari rejects it.

### `app/(app)/templates/page.tsx` + `RefinanceTemplateForm.tsx` — review this

Server component plus client component. Written without seeing the existing
codebase, so **check these against the house patterns**:

- Route group is assumed to be `app/(app)/`.
- Plain `<input>` elements are used rather than the existing `CurrencyInput`
  component. Swapping them in is probably right — but note `CurrencyInput` had
  a decimal-stripping bug that was fixed once already, so verify rates like
  `6.29` survive it before switching.
- Tailwind classes are generic; adjust to match the rest of the portal.
- The layout was not run past Fabio as a mockup. **Show him a mockup before
  changing anything design-related** — that's the standing rule.

---

## Content rules baked into the templates

These are compliance decisions, not styling. Don't strip them.

- **Every email carries an assumptions disclaimer** naming ACL 387025, stating
  the figures are estimates and a guide only, listing what they assume
  (accurate balance/rate/term, repayments on schedule, rate unchanged), and
  stating it is general information, not credit assistance, and not an offer.
- **No lender is named and no product is recommended.** The email invites a
  conversation. That keeps it marketing rather than credit assistance.
- **The IO email never claims a term reduction.** No principal is being repaid,
  so the claim would be false.
- **The IO email flags tax deductibility but never quantifies it**, and points
  the client to their accountant. Quantifying deductibility in a bulk send
  would be tax advice going out under the ACL.
- **Repayment type is locked per email.** P&I compares to P&I, IO to IO.
  Comparing a current IO repayment against a new P&I quote produces an enormous
  and entirely fictional saving.

---

## Steps

1. Copy the three `lib/` files into `lib/`.
2. Create `app/(app)/templates/` and add both component files.
3. Add a "Templates" item to the sidebar nav, matching the existing pattern.
4. Run the tests, then `npm run build`.
5. Deploy and test on the live Vercel URL — never localhost.
6. End-to-end check: generate an email, copy it, open the mail client, confirm
   the BCC is populated, paste, and send to yourself. Open it in **both Gmail
   and Outlook** before it goes near a client.

## Known limitation, by design

`mailto:` cannot carry an HTML body — that's the spec, not a gap in the code.
Hence copy-then-open rather than one button. The alternatives were considered:
`.eml` download (breaks on webmail) and sending via Resend (doesn't land in the
broker's Sent items, and replies need a reply-to header). Copy-and-paste was
chosen because it works for everyone regardless of mail client and keeps the
send in the broker's own hands.

## Next templates

Refinance is the first of several. When adding more, keep
`refinance-calculations.ts` and `refinance-email-template.ts` as the model:
calculation logic separate from presentation, both independently testable, and
the shared email shell (header, footer, disclaimer, buttons) factored out so
every template inherits the compliance wording automatically.
