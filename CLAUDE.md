# Simplify Finance portal — working rules

Read this before doing anything. These are not preferences; each one exists because
ignoring it caused a real incident.

## Confidentiality

All code, business logic, credentials, workflows, API integrations and implementation
details here are confidential intellectual property of Simplify Finance (Mortgage
Specialists Pty Ltd, ACL 387025). Nothing is shared, published, or referenced outside
the private repo `simplifyfinance/simplify-finance-portal` and the working chat.

## Shipping

- **Deploy only with `./scripts/ship.sh "message"`.** It builds, refuses to commit if
  the build fails, and pushes. Never hand-write a build-and-push chain: piping
  `npm run build` into `tail` returns tail's exit code, so a broken build reads as a
  success and gets pushed. That happened.
- Staging and production share one Supabase project. There is no safe database to
  experiment on. Test on **cloned** deals, never live client files.

## Never claim something worked without checking it

This is the single most repeated failure in this codebase. Four separate times a
success message was displayed by code that never verified anything:

- **Postgres returns zero rows and no error when a policy blocks a write.** Every
  write must `.select()` and check `rows.length`, not just `error`.
- Every `fetch` must check `res.ok` before reporting success, and surface the body.
- Never `.catch(() => {})` on anything a person is told succeeded.
- Autosave indicators must reflect a verified write, not an attempted one.

## One source of truth, always

- **The database decides who sees what.** No allowlists, role checks or team lists in
  the app. A hardcoded `TEAM_VIEW_BROKERS` silently overrode the database's grants and
  locked a broker out of deals she had been given.
- **The team is not a list in code.** Broker names, titles, CRNs, emails and Calendly
  links come from Settings → Broker profiles. Notification recipients come from
  Settings. A hardcoded map with `|| brokers['Fabio']` put the wrong broker's credit
  representative number on client-facing emails.
- **A form's fields belong to one list.** Two hand-written field lists drift, and did:
  thirteen fields reached the database but never the client email.
- If a value can't be resolved, **refuse and say so**. Never fall back to a named
  person, a zero, or an estimate. "Rate not confirmed" beats a plausible number.

## Working style

- One terminal command per message. A fenced block is always a runnable command and
  nothing else — never paste field lists, SQL or notes into one.
- SQL for Supabase is labelled as such, because it goes in the SQL editor, not the
  terminal.
- Prefer full file rewrites, or Python heredoc patches with `assert` on every anchor.
- **Never ask for passwords, connection strings or service role keys in chat.** Those
  are entered directly in Supabase or Vercel.
- Show design work before building it. Mockups use the real palette and real data.

## Decisions

`docs/decisions.md` is the record. Read it before proposing anything — a decision
already made is not reopened, and the user should never be asked the same question
twice.

Write a decision there **the moment it is made**, in the same commit as the work.
Chat history is compacted and summarised as sessions grow; a decision that lives only
in the conversation will be lost, and asking again wastes the user's time and erodes
trust.

`docs/backlog.md` is the current state of the work. Keep it current.

## Domain facts

- Australian financial year: 1 July to 30 June. Quarters align to it — Q1 is Jul-Sep.
  Jul 2026 is FY27.
- A part-finished period is never compared against complete ones. Compare the same
  months of earlier years, or say the period is still running.
- Loan amounts differ at lodgement, formal approval and settlement. Each stage keeps
  its own snapshot; commission is calculated on the settled amount.
- The ten years of history is a **business** total — only Fabio was a broker. Brokers
  are measured against their own targets, never against that history.
