# Simplify — one platform, three portals

**How to turn the broking portal into the bones for accounting and finance**
24 August 2026 · read against `simplifyfinance/simplify-finance-portal` @ `e26e2a4`

---

## The principle

**Share the code. Never share the database.**

That single rule gives you everything you asked for. The hours already spent on auth, invites, roles, email, PDFs and ABN lookup get spent once and reused three times — while accounting client data and broking client data stay in separate Postgres instances with no network path between them, which is what "they don't integrate" has to mean when one business line is under ACL 387025 and the other is doing BAS work under a different set of obligations.

Three Supabase projects, all `ap-southeast-2`. One repo. No shared runtime, no shared API, no SSO between portals by default. The only thing that crosses a portal boundary is source code, at build time.

---

## What I found in the broking portal

Next.js 16, React 19, Tailwind 4, `@supabase/ssr`, Anthropic SDK, Resend, react-pdf. 88 TypeScript files. The code is in good shape — `lib/permissions.ts`, `lib/periods.ts` and the Supabase client factories are all better written than most of what I see, and the comments encode real incidents rather than restating the code.

But there are three things standing between you and a fast second portal, and only one of them is about code.

### 1. There are no database migrations — this is the actual blocker

The repo contains exactly one `.sql` file: `docs/rls_rollback_2026-08-19.sql`. Everything else — tables, RLS policies, triggers, grants — exists only inside the hosted Supabase project, built by hand in the SQL editor. `CLAUDE.md` confirms it: *"Staging and production share one Supabase project. There is no safe database to experiment on."*

You can copy every TypeScript file in this repo in an afternoon. You cannot copy the database. Standing up the accounting project today means rebuilding the schema and the policies from memory — and RLS is the one part where a mistake is a data breach rather than a bug.

**So the first move is not a package. It is `supabase/migrations/` in the broking repo.** Pull the live schema into a migration file, commit it, and from then on change the database only by writing a migration. That one step buys you four things at once: a repeatable way to stand up portals 2 and 3, a real staging project (nearly free once migrations exist), version history on your RLS, and the ability to lift the *common* tables into a shared migration package.

The Supabase CLI isn't on your PATH, though there's a `.supabase` directory in your home, so it may just need installing or linking.

```
brew install supabase/tap/supabase
cd ~/simplify-finance-portal
supabase init
supabase link --project-ref <your-project-ref>
supabase db pull                 # writes supabase/migrations/<ts>_remote_schema.sql
git add supabase/ && ./scripts/ship.sh "Schema under version control"
```

Read the generated file before committing — `db pull` captures policies and functions, but check that every RLS policy you expect is in there.

### 2. 2FA isn't built anywhere yet

I grepped the whole repo for `mfa`, `aal`, `totp`, `enroll` — nothing. That's good news for sequencing. **Build it once, in a shared package, and all three portals inherit it.** The failure mode to avoid is building TOTP inline in the broking app over the next fortnight and then porting it twice.

The same applies to the piece that matters most for accounting: real authenticated external users. Right now the only client-facing surface is `/proceed/[id]`, a public unauthenticated route keyed by ID. Accounting needs clients who log in, with MFA, scoped to one entity. That's mostly new code — so write it generic from the start and broking gets a proper client portal out of it too.

### 3. The design system isn't a layer yet

`app/globals.css` is six lines: a Tailwind import, a background colour, a font stack. The look lives as inline Tailwind classes across 88 files. That's fine for one app and expensive to share — extracting a component library from inline utility classes is a real job.

Don't do it yet. It's the one thing on this list that should wait until the accounting portal shows you which components genuinely repeat.

---

## What the bones actually are

Eight packages. I've mapped each to the files that exist today.

| Package | From the broking repo | Notes |
|---|---|---|
| **`@simplify/auth`** | `lib/supabase-server.ts`, `lib/supabase-browser.ts`, `lib/supabase.ts`, `lib/supabase-admin.ts`, `middleware.ts`, `app/login/`, `app/reset-password/`, `app/api/delete-user/` | `supabase.ts` and `supabase-browser.ts` are the same function twice — consolidate on the way in. `middleware.ts` becomes `createAuthMiddleware({ publicRoutes })`; the only thing that varies between portals is that list. **Add TOTP enrolment, AAL2 gating and step-up re-auth here, not in an app.** The comments in `supabase.ts` and `supabase-admin.ts` are hard-won — carry them across verbatim. |
| **`@simplify/tenancy`** | `lib/permissions.ts` | 35 lines and exactly the right shape already. Generalise to `createPermissions({ roles, capabilities })` — broking passes `admin/broker/staff`, accounting passes `owner/preparer/reviewer/client_admin/client_user`. Also the home for the RLS helper SQL (`is_aal2()`, `is_staff()`, `can_read_entity()`). |
| **`@simplify/db-core`** | *nothing yet — see blocker 1* | Shared migrations that every portal runs to get the same shape of its **own** tables: profiles, memberships, roles, audit log, source files, overrides. Same schema, three isolated databases. |
| **`@simplify/au`** | `lib/periods.ts`, `app/api/abn-lookup/route.ts`, `lib/googleMaps.ts`, `app/(app)/deals/[id]/AbnAutocomplete.tsx`, `AddressAutocomplete.tsx`, `CurrencyInput.tsx` | The best free win on the list. `periods.ts` already models the Australian FY correctly with UTC-safe `YYYY-MM-DD` arithmetic — BAS quarters align to the same FY, so accounting uses it unchanged. ABN Lookup is already wired with a GUID and is exactly what the accounting portal needs to check whether a supplier was GST-registered. **One extension needed:** the current route returns `AbnStatus` and `EntityTypeName` but not the `Gst` registration period from `AbnDetails` — you need that field to know an input tax credit is claimable. |
| **`@simplify/notify`** | The inline Resend `fetch` in `app/api/invite-user/`, `notify-proceed/`, `notify-broker-stage-complete/`, `send-lo-email/`, `send-next-steps-email/`, `notify-salestrekker/` | Currently the same `fetch('https://api.resend.com/emails')` block copy-pasted across six routes, each with several KB of inline HTML. Package the send; leave the templates in the app — the branding and copy are genuinely per-portal. |
| **`@simplify/extract`** | `app/api/extract-fact-find/route.ts`, `app/api/extract-lender/route.ts` | Document → structured fields via the Anthropic SDK. This is the same shape as "analyse a tax return" and "read a bank statement", which is most of your accounting roadmap. Generalise to `extract(document, schema)` with the schema passed in. |
| **`@simplify/docs-pdf`** | `app/api/generate-compliance-pdf/route.tsx`, `app/api/generate-summary-pdf/route.tsx` | react-pdf document builder. Accounting needs a signed workpaper PDF; the layout primitives are the same. |
| **`@simplify/ui`** | `components/Sidebar.tsx`, `app/(app)/layout.tsx`, `app/globals.css` | **Defer.** Take the shell (rail, layout, nav shape) when you build accounting's shell, and let the component library accrete from things you actually copy twice. |

### The bones that aren't code

`CLAUDE.md`, `AGENTS.md`, `docs/decisions.md`, `docs/backlog.md` and `scripts/ship.sh` are as valuable as anything above, and cheaper to move.

`CLAUDE.md` is largely domain-neutral — the confidentiality clause, the "never claim something worked without checking it" rules, the one-source-of-truth rules, the working style. Only the *Domain facts* section is broking-specific, and even there the Australian financial year note applies verbatim to accounting. Split it: a shared `CLAUDE.md` at the repo root, a short app-specific one in each app carrying only that app's domain facts.

`ship.sh` needs one change when you go multi-app: **build every app before pushing.** Right now it builds one. In a monorepo, a change to `@simplify/auth` can break broking — which is live and running your business — while you're working on accounting. The build gate is what stops that reaching production.

---

## Repo structure

Keep the existing repo and its history. Move the app into `apps/broking/` rather than starting a new repo.

```
simplify-platform/                    (renamed from simplify-finance-portal)
├── CLAUDE.md                         shared working rules
├── pnpm-workspace.yaml
├── packages/
│   ├── auth/                         clients · middleware · TOTP · AAL2
│   ├── tenancy/                      roles · capabilities · RLS helpers
│   ├── db-core/                      shared migrations
│   ├── au/                           ABN · periods · address · currency
│   ├── notify/                       Resend
│   ├── extract/                      Anthropic document → fields
│   ├── docs-pdf/                     react-pdf
│   └── ui/                           (later)
├── apps/
│   ├── broking/     → Supabase project A  → its own Vercel project
│   ├── accounting/  → Supabase project B  → its own Vercel project
│   └── finance/     → Supabase project C  → later
└── scripts/ship.sh                   builds ALL apps, then pushes
```

Each app keeps its own `.env.local` with its own Supabase URL, anon key and service role key. Nothing in `packages/` ever reads an environment variable directly — it takes config as arguments, so an app can't accidentally reach another app's project.

A user who is both a broking client and an accounting client has two accounts. That is the design, not an oversight. If you later want one login across portals, that's a deliberate decision with its own consent story — and it's much easier to add later than to unpick.

---

## Sequencing

The mistake here is stopping broking to build a platform. You'd be abstracting from one example, and you'd abstract the wrong things.

**Step 1 — migrations, this week (~1 day).** Blocker 1 above. Do this even if you never build another portal; it's what gives you a staging database and a recoverable schema.

**Step 2 — set up the monorepo, before accounting starts (~2–3 days).** `git mv` everything into `apps/broking/`, add the workspace, and extract only the four packages with no domain in them at all: `auth`, `tenancy`, `au`, `notify`. Ship broking from the new structure and confirm it still builds and deploys before you write a line of accounting code. Don't touch `ui`.

**Step 3 — build 2FA in `@simplify/auth`, then turn it on in broking (~3–4 days).** Broking is your proving ground: it has real users, and you'll find the enrolment and recovery edge cases there rather than in front of an accounting client. Accounting then gets working, tested MFA on day one.

**Step 4 — extract on second use, during accounting.** This is the rule that matters. Every time you're about to copy a file from `apps/broking` into `apps/accounting`, stop and move it into a package instead, then point broking at the package. Actual second use is the only reliable signal about what's genuinely general — better than any guess either of us makes now.

By the time you start the finance portal, the packages will have been proven against two different domains, and portal 3 should cost a fraction of portal 1.

---

## What this means for the accounting portal

The BAS plan I wrote sits on top of this cleanly, with two changes worth noting.

The **ABN Lookup route already exists** — that's exception rule 11 (supplier not registered for GST, so no input tax credit) already most of the way built, needing only the `Gst` field added to the response.

The **document extraction pattern already exists** — `extract-fact-find` reads a document into structured fields with the Anthropic SDK. That is the same mechanism as reading a tax return, and a better long-term answer for messy Xero exports than more regex.

The Depth analyser stays what I said it was: a donor for its illion parsers and payee-normalisation code, not a foundation. It doesn't belong in `packages/` — it belongs inside `apps/accounting` as a domain module, because nothing in broking or finance wants it.

---

## Two risks

**A monorepo means broking can break while you're working on accounting.** Broking is live and running the business. Mitigations, in order of importance: `ship.sh` builds every app before it pushes; extract a package only when you can immediately verify broking still works; and get the staging Supabase project standing up as soon as migrations exist, so RLS changes are testable somewhere that isn't production.

**Confidentiality across business lines.** `AGENTS.md` scopes confidentiality to the broking repo under ACL 387025. Once accounting client data is in the same repository — even in a separate database — that notice needs rewriting to cover both, and the accounting side needs its own privacy collection notice. Bank statements collected for lending and bank statements collected for BAS work are collected for different primary purposes; the databases being separate is what makes that defensible, and it's worth writing down why.

---

## What I'd do next

Say the word and I'll write the migration bootstrap and the monorepo move as a step-by-step you can run in the terminal — the `db pull`, the workspace files, the `git mv`, the `ship.sh` change, and the first package extraction, in the order that keeps broking deployable at every step.

The one thing I'd want to confirm first: whether the broking repo gets renamed in place to `simplify-platform`, or a fresh monorepo is created with broking imported into it. Renaming in place is my recommendation — it keeps your commit history and your existing Vercel connection, and a repo rename on GitHub leaves a redirect behind so nothing breaks.
