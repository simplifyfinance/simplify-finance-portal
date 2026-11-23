# Moving the Simplify Finance portal to Sydney — the complete picture

**Assembled 23 November 2026. Everything measured, not assumed.**
**Commercial in confidence — Mortgage Specialists Pty Ltd, ACL 387025.**

This is the document to hand to a reviewer. Every number in it was read from the
live production database on 23 November 2026. Where something is not known, it
says so.

**Section 12 is the list of questions for the reviewer.** Read that first if
time is short.

---

## 1. What this is and why it is happening

A client portal for an Australian mortgage broker, holding the financial
positions, identification and loan documents of roughly 145 live applications
and a book of about 1,900 clients.

Its database and file storage are in Supabase's **Singapore** region
(`ap-southeast-1`). The business requirement, stated from the first day of the
project, was Australian data residency. Nobody noticed for five months.

The secondary environment is in **Seoul** (`ap-northeast-2`). Two other systems
in the group are correctly in **Sydney** (`ap-southeast-2`).

A Supabase project's region cannot be changed. The only route is a new project
in Sydney plus a migration.

---

## 2. The agreed order

1. Finish learning the live system (this document)
2. Review by independent tools — the reason this document exists
3. Bring the Seoul staging project up to date from production (schema only)
4. Move staging from Seoul to Sydney — **the rehearsal**
5. Run the automated browser suite against Sydney staging
6. Production, in a quiet window

**Nothing touches production until the rehearsal has been done end to end.**

---

## 3. The system

| | |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript 5 strict, Tailwind v4 |
| Hosting | Vercel |
| Database and storage | Supabase, Postgres **17.6** |
| Outbound email | Resend, also used as Supabase's SMTP provider |
| Source control | GitHub, private |
| Sign-in | Email and password, plus a second factor with trusted devices |
| Staff accounts | 18 |

Deployment is a single script: guards, 9,533 unit tests, build, 43 browser
tests, commit, push. About eight minutes.

---

## 4. What is actually being moved — measured 23 Nov 2026

### Size

| | |
|---|---|
| Database | 146 MB |
| Largest table | `deal_history`, 79 MB, **21,479 rows** |
| Next largest | `deal_statement_transactions` 18 MB, `commission_lines` 13 MB |
| Deals | **306** (296 not test) |
| Clients | **1,911** |
| Storage | 585 objects, 137 MB across 3 buckets |

### Structure

| | |
|---|---|
| Tables | 51, every one with row level security on, every one with a primary key |
| Views | 7, six set to run with the caller's permissions |
| Materialised views | 0 |
| Policies | ~114 |
| Functions | 34 |
| Triggers | 11 ours, the rest Supabase's own |
| Foreign keys | ~70 |
| Check constraints | ~35 |
| Indexes | ~150, of which 20 on `deals` |
| Sequences | 2 — `deal_history_id_seq` (~20,250), `deal_stage_events_id_seq` |
| Enum types | 0 |

### Extensions — all stock, all available in any new project

`pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`

**No `pg_cron`. No `pg_net`.** Nothing in the database runs on a schedule and
nothing calls out to another system. No database webhooks exist. This removes a
whole category of migration risk.

### Live updates

**One table** is published for realtime: `deals`. Replica identity is default on
every table.

### Storage

| Bucket | Files | Size | Public | Size limit | Type limit |
|---|---|---|---|---|---|
| `deal-documents` | 581 | 136 MB | No | none | none |
| `lender-documents` | 4 | 911 kB | No | none | none |
| `reading-room` | transient | — | No | none | none |

**No bucket sets a file size or type limit.** Cheap hardening to add in Sydney.

### Database configuration

| | |
|---|---|
| Postgres | 17.6 — Sydney must be this or newer |
| Collation / ctype | `en_US.UTF-8` |
| Encoding | UTF8 |
| Timezone | UTC — the application converts to Sydney time in code, so the move shifts no displayed date |
| Statement timeout | 120 s — comes from the compute size |
| Max connections | 60 — comes from the compute size |


### Four risks closed by measurement, 23 Nov 2026

Raised in external review, settled by counting rather than by argument.

| Raised | Measured | Consequence |
|---|---|---|
| The `supabase_vault` root key is unrecoverable and must be copied in Phase 0 | `vault.secrets` = **0 rows** | Nothing is in the vault. The step disappears |
| `pg_graphql` may be a sixth unaudited route into the database | **Not installed** | Closed |
| Policies or functions branching on the key's role claim change behaviour silently on the new keys | **0 policies, 0 functions** - checked for `auth.role()`, `auth.jwt()`, `request.jwt.claims` and `current_setting` | The key change is a credential swap and nothing more |
| `pg_stat_statements` may expose query text containing client names | **No grants to `anon` or `authenticated`** | Closed |

**Residual risk on the key change is one thing:** the two Realtime
subscriptions and the 24-hour connection limit. Both are on `deals`, both
inside the signed-in area. The rehearsal settles it.

### Nothing stored points at the current project

Every text and JSON column in every table was scanned for `supabase.co`.
**Zero rows.** No saved address has to be rewritten.

---

## 5. What a restore does NOT bring across

This is the part that makes migrations fail quietly.

| Thing | Consequence if missed |
|---|---|
| **Storage policies** (7 of them) | Sydney starts with no rules on storage at all |
| **The realtime publication** | `deals` stops pushing live updates. Nothing errors. Two people in a deal stop seeing each other |
| **Sequence values** | If `deal_history_id_seq` resets to 1, the first save fails on a duplicate key |
| **Platform default privileges** | A new project grants the not-logged-in role access by default. See section 7 |
| **Every dashboard setting** | See `docs/the-settings-that-do-not-move.md` |
| **The SMTP password** | Cannot be read back. A fresh Resend key is made on the night |
| **API keys and project address** | Three Vercel variables change. `READY_LINK_SECRET` must not |

---

## 6. The security audit of the same day, and why it belongs in this document

On 23 November, while gathering the above, the portal was audited properly for
the first time. It found **four ways into the database from the open internet**,
with no login:

1. A storage rule with no identity check — 581 client documents readable
2. A view that bypassed row level security — the commission book, with client
   names, loan references and balances
3. A function callable by anyone — the entire pipeline: deal names, loan
   amounts, commissions, splits, in one request
4. Thirteen further functions callable without a login, two of which delete

Plus a departed staff member whose login still worked, fifteen application
endpoints with no authentication check, and roughly sixty database rules that
check *authentication* rather than *entitlement*.

**All closed on the day except the sixty rules**, which are tracked.

**Why a reviewer needs this.** Every one of those faults existed because the
platform's defaults are open and closing them is a separate step. **A new Sydney
project starts with those same defaults.** If the migration restores data into a
project nobody has closed first, the portal arrives in Australia with the same
four holes it started with.

Full record: `docs/the-security-audit.md`.

---

## 7. Therefore: Sydney must be closed before it is filled

Run on the new project **before the restore**:

```sql
alter default privileges in schema public
  revoke execute on functions from public, anon;
alter default privileges in schema public
  revoke all on tables from anon;
alter default privileges in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
```

And **after the restore, before anyone uses it**:

```sql
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
```

Then `docs/weekly-audit.sql`. **Check 1 must read 0.** If it reads anything
else, the new project is reachable without a login and nothing else about the
migration matters until it is not.

---

## 8. What "in Australia" will actually mean

Stated plainly because it will be asked.

Moving to `ap-southeast-2` puts **data at rest** in Sydney. It does not mean no
data leaves Australia:

- Supabase's contracting entity is Singapore-based
- Supabase support operations are United States-based
- Authentication emails route through United States providers
- Vercel serves the application from its own edge network

The move achieves data residency for the database and files. It does not achieve
data sovereignty end to end, and the documentation should not claim it does.

---

## 9. Timing — honestly

The database is 146 MB. Restoring it is minutes.

**The documents are the unknown.** 585 files, 137 MB, copied between two
projects. This has not been measured and is not being guessed at — the staging
rehearsal will produce a real number.

**The binding constraint is not duration.** It is that writes must stop while
the dump is taken, or anything saved afterwards is lost. The window is: stop
writes, move, verify, let people back in.

A weekend was assumed. Overnight may be sufficient. **That decision waits for
the rehearsal's measured number**, not for an estimate.

---

## 10. Open with Supabase

Thirteen questions were sent to Supabase support. The one that matters most:

**Can the JWT signing secret be carried to the new project, so that the anon and
service role keys come out byte-identical?** If yes, the Vercel key swap becomes
trivial and existing sessions may survive. If no, every staff member signs in
again — which is acceptable but must be planned.

No substantive reply yet.

---

## 11. Known open items, carried deliberately

| Item | Status |
|---|---|
| ~60 rules checking authentication rather than entitlement | Open, tracked, large |
| `sweep_the_reading_room()` cannot work — Supabase blocks deleting storage rows from SQL | Open; the primary delete path works and is tested |
| Two functions run with owner rights without a fixed search path | Open, small |
| `lender-documents` storage rules check only that you are signed in | Open, low risk |
| No bucket sets a file size or type limit | Open, cheap to fix in Sydney |
| Dashboard settings capture | In progress — see `docs/the-settings-that-do-not-move.md` |

---

## 12. Questions for the reviewer

These are the things a second opinion would be most valuable on.

1. **Is the rehearsal-first order right?** Staging is in Seoul and holds no
   client data. The plan is to move it to Sydney first and learn there. Is
   anything important *not* provable that way?

2. **What is the safest way to copy 585 storage objects between two Supabase
   projects**, and how should the copy be verified — count, byte size, checksum?

3. **How should the cutover be sequenced** so that no write is lost between the
   dump and the switch-over? Is a read-only window the right mechanism, and how
   is one imposed on a Supabase project?

4. **What is the realistic rollback** if Sydney is wrong at 3am? The old project
   still exists and still holds the data — is reverting the Vercel variables
   genuinely sufficient, and what makes it not sufficient?

5. **Have we missed anything that a restore does not carry?** Section 5 is our
   list. What is not on it?

6. **Is there any route into a Postgres/Supabase database we have not
   enumerated?** Section 6 names five: tables, views, materialised views,
   functions, storage. Is that complete?

7. **Does moving to `ap-southeast-2` satisfy Australian data residency
   obligations for a credit licensee**, given section 8?

8. **Is the sixty-rules remediation safe to do before the move, or after?**
   Doing it first means migrating a known-good state. Doing it after means not
   changing two things at once.

---

## 13. The other documents

| File | What it is |
|---|---|
| `docs/moving-the-database-to-sydney.md` | The runbook, phase by phase |
| `docs/the-settings-that-do-not-move.md` | Every dashboard setting, captured from live |
| `docs/both-sides-must-match.sql` | The after-restore comparison |
| `docs/the-security-audit.md` | The full security record and the weekly routine |
| `docs/weekly-audit.sql` | 15 checks, run against both sides |
| `docs/who-has-the-keys.md` | Who can reach the data from outside the portal |
| `docs/day-one.md` | What to do on a new portal before anything else |
