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

## The clock is Sydney's

The database stores UTC and that is correct. What is not correct is a date
reaching a human without being turned back into the office's day first.

- **Before saying anything about when something happened, work out the local
  time.** 13 Nov 2026: a card saved at 10:02am Sydney is recorded as 23:02 the
  previous day. It was read as "last night", a member of staff was nearly
  challenged about working at eleven at night, and an hour went into an
  investigation pointed the wrong way.
- Every date shown to anybody goes through `lib/same-date-everywhere.ts`, which
  resolves in `Australia/Sydney` on both the server and the browser.
- `scripts/check-one-clock.sh` counts the places still asking the machine. The
  number only goes down.
- **Never a fixed offset.** Sydney is UTC+11 in November and UTC+10 in June, so
  a hardcoded +10 is wrong for half the year — and only shows up in one season.

## A typed string is never an identity

The same fault, three times in two days:

- A loan split filed under its typed **label**, so two splits named after the
  house read as one loan and a client's $192,000 looked missing.
- Compliance answers filed under an applicant's **name**, which orphans the
  moment anyone corrects a spelling.
- Security decided from a scenario **template** in two files that each worked it
  out alone, so a wrong LVR reached a lender and a compliance pack by two routes.

Use ids. A name is something a person types and retypes; it is a label to print,
never a key to look up by.

## A step that can fail silently is the worst kind

13 Nov 2026, Jayver Varghese. The push to SalesTrekker was pressed, no email
went, and the portal wrote nothing — so a deal somebody had pushed and a deal
nobody had touched were identical in the database. It took three SQL queries and
the Supabase request logs, at midnight, and it came close to being a conversation
with a member of staff about whether she was telling the truth.

- **Any step that matters leaves a mark on the record**: attempted at, by whom,
  worked or failed. Written *before* the thing is tried, so a failure in the
  middle leaves the attempt behind.
- **A popup is not a record.** It vanishes when it is clicked.
- Nobody should have to interview their staff to find out whether a button worked.

## Working is not the same as clicking

13 Nov 2026. A credit officer saved a compliance card at 3:11pm and the portal
signed her out for inactivity at 3:14pm. Her tab carried on talking to the
database with no credentials for an hour, every read came back empty, and the
screen looked completely normal.

- **A save counts as being at the desk.** It cannot happen without a person.
- Reading, writing notes on paper and doing sums at a desk is working. A timeout
  that can fire on a working person must lose nothing and must say so at once.
- **The idle rule is 60 full minutes with nothing touched, typed or saved.**
  Nothing may make it shorter.
- When the portal signs somebody out, the tab says so within a minute and their
  work is already written to their own browser before the message draws.

## When the data and a person's account disagree

Assume the software failed. Say what the record shows and what it cannot show,
and never phrase a finding so it reads as an accusation. "The email was never
sent" is a fact. "She did not press the button" is not the same sentence, and
the second one costs a relationship.

## Never state a cause you have not proved

Say "I don't know yet" and name the one check that would settle it. Reproduce
rather than argue. Check your own test fixtures before blaming the system — an
empty result from a fixture you built proves nothing about production.

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
