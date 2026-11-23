# Moving the portal's database to Sydney

Written 23 November 2026. Plain English on purpose — meant to be read by
anyone, and handed to the IT reviewer or another tool to pick holes in.

**The situation.** The portal's database is in Singapore (`ap-southeast-1`).
It holds personal and financial information for Australian clients of an
Australian credit licensee. It should be in Sydney (`ap-southeast-2`).

| Project | Ref | Region | |
|---|---|---|---|
| simplify-finance-portal-claude | `brjytbuirbupatjtauhx` | ap-southeast-1 Singapore | production |
| Simplify Finance Portal — Staging | `jfgsyotmvwxeaohwdejv` | ap-northeast-2 Seoul | staging |

It was written down in `docs/OUTSTANDING.md` on 16 September 2026 and nobody
acted on it for two months.

---

## Status, 23 November 2026

**Nothing is being done yet.** Seven questions are with Supabase and a further
six about the parts staging cannot rehearse. Their answers change some of the
steps below, in particular whether the API keys stay the same. Wait for them.

Two things can be done this week regardless, and both are in Phase 4 under
"Before the weekend": set `READY_LINK_SECRET` in Vercel, and run the
information-gathering queries on production.

---

## The strategy

**Practise on staging. Production is not touched at all until staging has
proven the whole thing works.**

1. Move the Seoul staging project to Sydney, exactly as it is.
2. Bring that Sydney staging up to date so it matches production.
3. Run the robots against it for as long as it takes.
4. Then, and only then, do production on a weekend.

Staging has no client data, so there is nothing to lose while we learn. Every
command used on staging is the same command we will use on production.

**Nothing is ever copied INTO Korea.** Seoul is only ever copied out of. That
is the point of the exercise.

---

## What staging will NOT prove

Read this before starting, because these become the checklist for the real day.

| Cannot be tested on staging | Why | So on the day |
|---|---|---|
| The data moving | Staging has test data, not 146 MB of real records | Check row counts table by table, both sides |
| The 18 user accounts | Staging's users are not the staff | Check all 18 IDs match, and sign in with a real password before anyone is let back in |
| The 582 files | Staging has almost none | Count them, and open three documents from three different deals |
| The catch-up copy | Nothing is being written to staging while we work | Freeze writes properly, then re-copy, then re-check |
| Several people at once | Robots work alone | Watch the first hour after everyone is back |

All five have been put to Supabase in writing. Their answers go here when they
arrive.

---

# PHASE 1 — Move staging from Seoul to Sydney

This is the rehearsal of the real move. Same commands, nothing at stake.

**1.1** Create a new project in `ap-southeast-2`. Call it
`Simplify Finance Portal — Staging (Sydney)`.

**1.2** Find out what is enabled on Seoul, and turn the same things on in
Sydney before restoring anything. Restoring into a project missing an
extension fails.

```sql
select extname, extversion from pg_extension order by extname;
```

**1.3** Supabase say the target's default privileges can change the effective
permissions, and to revoke them before restoring if the existing permissions
matter. The exact statements have been asked for. **Do not start 1.4 until
that answer is in.**

**1.4** Dump Seoul. Three files. Use the direct connection, not the pooler —
the pooler breaks the bulk copy.

```
supabase db dump --remote=<SEOUL_CONNECTION_STRING> -f roles.sql  --role-only
supabase db dump --remote=<SEOUL_CONNECTION_STRING> -f schema.sql
supabase db dump --remote=<SEOUL_CONNECTION_STRING> -f data.sql \
  --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

**1.5** Load all three into Sydney, in order, in one transaction.

```
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname <SYDNEY_STAGING_CONNECTION_STRING>
```

`session_replication_role = replica` turns triggers off while data loads, so
nothing fires half-built.

**Expect errors. These are documented by Supabase, so they are normal:**

| Error | Fix |
|---|---|
| `must be owner of ...` or `supabase_admin` permission denied | Comment out the `ALTER ... OWNER TO "supabase_admin"` lines in `schema.sql` |
| `permission denied to grant role "postgres"` | Comment out the `GRANT "postgres" TO "cli_login_postgres"` line in `roles.sql` |
| anything about `cli_login_postgres` | `DROP ROLE IF EXISTS cli_login_postgres;` then retry |
| a custom login role cannot sign in | `alter user "THE_ROLE" with password 'something';` |

**Write down every error and every fix.** That list is the most useful thing
this phase produces, because the same errors appear on the real day.

**1.6** Bring across the bits the dump leaves out. Supabase confirmed
`supabase db dump` **excludes the managed `auth`, `storage` and extension
schemas by default.**

```
supabase db diff --remote=<SEOUL_CONNECTION_STRING> > changes.sql
```

Read `changes.sql` before running it. It should contain the rules on
`storage.objects`, including the reading-room one.

**1.7** Move the auth users. Set the new project's JWT secret to the same
value as Seoul's first — Supabase confirm that keeps existing sessions valid.
Practise it here, because on the real day this is the part that must not go
wrong.

**1.8** Copy the storage files using the script in Supabase's backup-restore
guide. Two known rough edges: it lists with a limit of 1000 and does not page
past it, and it uploads with `upsert: true`, overwriting anything at the same
path.

---

# PHASE 2 — Bring Sydney staging up to date

Staging has never matched production. Sixteen tables exist live that no file
in this repository describes, which is why it was parked.

Only now, with staging already in Sydney, does production's structure get
copied — and it goes to Sydney, never to Korea.

**2.1** Take the schema out of production. **Schema only. No client data goes
anywhere near staging.**

```
supabase db dump --remote=<SINGAPORE_CONNECTION_STRING> -f prod-roles.sql  --role-only
supabase db dump --remote=<SINGAPORE_CONNECTION_STRING> -f prod-schema.sql
```

**2.2** Load it into Sydney staging.

```
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file prod-roles.sql \
  --file prod-schema.sql \
  --dbname <SYDNEY_STAGING_CONNECTION_STRING>
```

Same errors as 1.5, same fixes.

**2.3** Run the diff against production for the auth and storage rules.

```
supabase db diff --remote=<SINGAPORE_CONNECTION_STRING> > prod-changes.sql
```

**2.4** Prove Sydney staging now matches production. Run
`docs/both-sides-must-match.sql` on production and on Sydney staging, and
compare.

Ignore the row counts — staging has different data. Everything else must match:

- 58 tables
- 114 policies
- **Tables with row level security OFF: 0 on both**
- The grants for `anon`, `authenticated` and `service_role`
- The policy text, word for word

**If the policies do not match, stop.** That is the whole risk of this
project, and finding it here, on staging, is exactly why we are doing it this
way.

**2.5** Point a copy of the portal at Sydney staging. A Vercel preview
deployment with three values changed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nothing else changes.

---

# PHASE 3 — Let the robots loose

Only start this once Phase 2 has shown Sydney staging matching production.

**3.1** Run the full browser suite against Sydney staging.

```
cd ~/simplify-finance-portal && ./scripts/check-browser.sh
```

43 tests. Run it repeatedly, over days. Every failure is a thing we would have
discovered on production at eight o'clock on a Saturday night.

**3.2** Work it by hand as well. The robots do not look at everything:

- Sign in, including the emailed code
- Open a deal, every tab
- Open a document from the list
- Fold a board column, open a deal, come back — is it still folded
- Drop a PDF on a reader and see it come back
- Open a client link
- Open the compliance tab and generate a pack

**3.3** Write down everything that broke and what fixed it. That list plus the
Phase 1 error list is the script for the real day.

**3.4** Check `auth_role()` works in Sydney. **Every one of the 114 policies
calls it.** If it is missing or owned by the wrong role, nothing works for
anybody. Same for `save_my_board_view`, `sweep_the_reading_room`,
`deal_exists` and `auth_credit_officer_id`.

---

# PHASE 4 — Production, on a weekend

Only start this when Phase 3 has been clean for several runs.

## Before the weekend

### Set `READY_LINK_SECRET` in Vercel. Not optional.

Three of the four client pages — `/ready`, `/answers`, `/opportunity` — open
from a signed link we email. The line that signs them, in `lib/ready-link.ts`:

```
process.env.READY_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
```

`READY_LINK_SECRET` is not set anywhere in this repository. So unless it was
added to Vercel by hand, those links are signed with the **service role key**,
which changes with the new project.

Supabase have **not** confirmed the new project's keys would be identical even
if we reuse the JWT secret. So assume they change.

What happens if we do nothing: every one of those links already sitting in a
client's inbox stops working at cutover. No error our end. The client clicks
and gets nothing.

**Do this:** copy the current service role key value out of Vercel, add it as
`READY_LINK_SECRET`, redeploy. Two minutes. `/proceed` is fine — it uses a
deal id, not a token.

### Run these on production and keep the answers

```sql
select extname, extversion from pg_extension order by extname;
select * from cron.job;                    -- harmless error if not installed
select * from supabase_functions.hooks;    -- harmless error if not installed
select count(*) from vault.secrets;        -- harmless error if not installed
select id, email, created_at from auth.users order by created_at;
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
```

If `vault.secrets` returns rows, the encryption key must be copied **while
Singapore is still alive.**

## The day

**4.1** Create the production Sydney project. Enable the same extensions.

**4.2** Tell the team. Nobody opens the portal until you say.

**4.3** Stop everything that writes, and put the portal into maintenance.
Supabase were specific: setting the database read-only is only a soft freeze
and is not enough on its own.

**4.4** Run Phase 1's steps against production — dump, restore, diff, auth
users. You have done every one of them before on staging.

**4.5** Copy the 582 files.

**4.6** Run `both-sides-must-match.sql` on both. **Every number identical,
including the row counts this time.** One difference and we stop.

**4.7** The five things staging could not prove, in order:

1. Row counts match, table by table
2. All 18 user IDs match
3. Sign in as a real person with their existing password
4. 582 files present; open three documents from three different deals
5. The catch-up copy brought across anything saved since

**4.8** Change the three values in Vercel. Redeploy.

**4.9** Smoke test before anyone is let in: sign in with the code, open a deal,
open a document, fold a column and come back, open a client link emailed before
the move, save something and confirm it saved.

**4.10** Let everyone back in. Watch the first hour.

---

# After

**Leave Singapore switched on for two weeks.** Do not pause it, do not delete
it. It costs money and it is worth it.

**Understand the rollback honestly.** Until the first person saves something in
Sydney, rolling back costs nothing — change the three Vercel values back. After
that, going back means losing whatever was done in between, because Singapore
is no longer being updated. The free rollback window closes at the first save,
not at the end of the day.

**Then** delete Seoul.

---

# What "in Australia" will actually mean

Do not tell the IT reviewer that nothing leaves Australia. It will not be true.

**Will be in Australia:** the database, the Auth service, storage objects, and
backups alongside them. That is where the client records live, and it is the
bulk of it.

**Will not be:** Supabase's primary data processor is **Supabase Pte. Ltd., a
Singapore company**. **Supabase, Inc. in the United States** provides support
and operational services. Data transfers to Singapore and the US happen under
standard contractual clauses. That is the corporate structure, not a setting.

**Also not:** the emails Supabase Auth sends. The portal uses Supabase to send
**password resets** and **staff invitations** — their subprocessor list names
ActiveCampaign and Postmark in the United States. Pointing Supabase Auth at our
own SMTP, using the Resend account we already pay for, would take those off US
providers. Worth doing at the same time.

**Not documented at all:** where logs and analytics are held, where
point-in-time recovery data sits, and which jurisdictions Supabase staff access
data from. All four have been put to them in writing.

The honest sentence is: **client data is stored in Australia.** That will be
true, and it is the question anybody actually asks.

---

# Every integration, and whether it is affected

| Thing | Affected? | Why |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Changes** | New project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Changes** | New project |
| `SUPABASE_SERVICE_ROLE_KEY` | **Changes** | New project |
| `READY_LINK_SECRET` | **Must be set first** | Or it falls back to the service key |
| `AUTH_COOKIE_SECRET` and the 2FA timings | No | Ours, not Supabase's |
| Resend | No | Separate service |
| Anthropic, x.ai | No | Separate services |
| Google Places, ABN lookup | No | Separate services |
| SalesTrekker | No | Email-based |
| GitHub, Vercel hosting | No | Code, not data |
| `/proceed` links already sent | No | Uses a deal id |
| `/ready`, `/answers`, `/opportunity` links | **Yes, unless `READY_LINK_SECRET` is set first** | Signed tokens |
| Edge Functions | None exist | — |
| Realtime, pg_cron, webhooks | None found — confirm live | — |
| Vault / pgsodium | None found — confirm live | If any, copy the key while Singapore is alive |

---

# What breaks if we get it wrong

| If this goes wrong | What you see | How bad |
|---|---|---|
| Policies not restored | Portal looks completely normal, and anyone with the public key can read everything | Worst case. This is what the comparison exists to catch |
| `auth_role()` missing | Nothing works for anyone, every screen empty | Loud and obvious |
| User IDs changed | Portal looks empty for everyone; "who did this" goes blank | Severe, and partly silent |
| Grants missing | Screens blank, or open | Mixed |
| `READY_LINK_SECRET` not set first | Client links already emailed silently stop working | Silent, and the client sees it first |
| Storage paths altered | Documents will not open | Noticed quickly |
| Password hashes not carried | 18 people reset their passwords | Annoying, not dangerous |
| Someone works during cutover | Their work is lost | Avoided by the weekend |

---

# Open with Supabase

Asked and not yet answered:

1. **If we reuse the JWT secret, are the new anon and service keys byte-for-byte
   identical?** They say the docs do not state it. Chase this — if yes, the
   cutover becomes a single URL change.
2. Does `supabase db dump` emit `CREATE POLICY` and the row-level-security
   switches for public tables — yes or no.
3. The exact statements to revoke default privileges on the target before
   restoring.
4. Does custom SMTP remove ActiveCampaign and Postmark from the auth email path.
5. Where logs, analytics, point-in-time recovery data and support access
   actually sit for a Sydney project.
6. Whether any Australian contracting entity exists.
7. Any limit on running both projects for two weeks.
