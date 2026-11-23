# The settings that do not move

**Captured from LIVE on 23 November 2026, screen by screen.**

Everything in the database can be dumped and restored. **None of what follows
can.** It lives in the Supabase dashboard. Nothing exports it and nothing
restores it. If it is not written here, it is gone when we move to Sydney.

Each section says what LIVE reads today. On the night, open the same screen on
the Sydney project and make it match.

**Status: capture complete, 23 November 2026.** Every screen walked through and
recorded. Three settings were changed on the way rather than merely noted, and
each says so where it appears: minimum password length 6 to 10, leaked password
protection off to on, and "automatically expose new tables" on to off.

**Two things on this page are irreversible and must be checked BEFORE the
restore, not after:** the Postgres version and the database collation. Neither
can be changed once a project exists.

---

## 1. Authentication → URL Configuration

**Site URL**

```
https://one.simplifyfinance.com.au
```

**Redirect URLs** (2)

```
https://simplify-finance-portal.vercel.app/reset-password
https://one.simplifyfinance.com.au/**
```

**Why it matters most.** If the portal's address is not on the redirect list,
sign-in sends people to a page that refuses them and says almost nothing. This
is the one that locks the whole team out.

---

## 2. Authentication → Sign In / Providers → Email

| Setting | Live, 23 Nov 2026 |
|---|---|
| Enable email provider | **On** |
| Secure email change | **On** |
| Secure password change | Off |
| Require current password when updating | Off |
| Prevent use of leaked passwords | Off → **turned On, 23 Nov** |
| Minimum password length | 6 → **changed to 10, 23 Nov** |
| Password requirements | none selected |
| Enable magic links and email OTP | **On** |
| Email OTP expiration | 3600 seconds |

**Two deliberately left off.** "Require current password when updating" and
"Secure password change" both assume a signed-in person changing their own
password. This portal has no such screen - the only path is the reset link sent
by email, and somebody using a reset link cannot supply a password they do not
have. Turning either on would at best do nothing and at worst break password
resets for the whole team.

---

## 3. Authentication → Sessions

| Setting | Live, 23 Nov 2026 |
|---|---|
| Enforce single session per user | Off |
| Time-box user sessions | 0 - never |
| Inactivity timeout | 0 - never |
| Access token expiry | 3600 seconds |
| Detect and revoke compromised refresh tokens | **On** |
| Refresh token reuse interval | 10 seconds |

**Sessions never expire, deliberately.** Fabio, on the 2FA build: the portal
must not log people out silently and lose their work. The trade-off is that a
stolen laptop with an open browser stays signed in. The trusted-device 2FA
covers part of that. Revisit one day; not a migration decision.

---

## 4. Authentication → Emails

### SMTP

| Setting | Live, 23 Nov 2026 |
|---|---|
| Enable custom SMTP | **On** |
| Sender email address | `noreply@simplifyfinance.com.au` |
| Sender name | `Simplify Finance` |
| Host | `smtp.resend.com` |
| Port | 465 |
| Username | `resend` |
| Password | a Resend API key - **hidden, cannot be read back** |

### ⚠ THE 2AM PROBLEM, WRITTEN DOWN SO IT IS NOT ONE

**The SMTP password cannot be recovered from this screen.** It shows dots. It
is a Resend API key and Supabase will not show it again.

**So on the night: do not go looking for it.** Make a fresh key in Resend
(Resend → API Keys → Create), paste that into Sydney's SMTP password, and
afterwards delete the old key from Resend if nothing else uses it.

Budget two minutes for this. The failure if it is missed is silent - password
resets and invitations simply stop arriving, and the person who did not get one
does not know to complain.

### Templates

Six exist: Confirm sign up, Invite user, Magic link or OTP, Change email
address, Reset password, Reauthentication. **The portal only uses three** -
Invite user, Reset password and Change email address. The rest are for flows
this portal does not have.

**Checked 23 Nov 2026: Invite user and Reset password are both Supabase's
DEFAULT wording, unchanged.**

| Template | State |
|---|---|
| Invite user | Default. Subject "You've been invited" |
| Reset password | Default. Subject "Reset your password" |
| Change email address | not opened |
| Confirm sign up | unused |
| Magic link or OTP | unused |
| Reauthentication | unused |

**So there is nothing to carry across.** A new Sydney project ships with the
same defaults. This was worth checking rather than assuming - a customised
template is in no backup and would have been lost silently.

**Separately, not a migration matter:** an invitation to a financial services
portal that says only "You've been invited", with no mention of Simplify
Finance, reads as spam to whoever receives it. Worth branding one day.

---

## 5. Authentication → Attack Protection

| Setting | Live, 23 Nov 2026 |
|---|---|
| Enable Captcha protection | Off |
| Prevent use of leaked passwords | **Enabled** (turned on 23 Nov) |

**CAPTCHA deliberately left off.** Eighteen staff, no public sign-up. The rate
limits below do most of that work, and CAPTCHA would add friction to every
sign-in every morning. Revisit only if the sign-in page starts being attacked.

---

## 6. Authentication → Rate Limits

All Supabase defaults. Nothing has been changed.

| Setting | Live, 23 Nov 2026 |
|---|---|
| Sending emails | 30 per hour |
| Sending SMS | 30 per hour |
| Token refreshes | 150 per 5 min per IP (1,800/hour) |
| Token verifications | 30 per 5 min per IP (360/hour) |
| Anonymous users | 30 per hour per IP |
| Sign-ups and sign-ins | 30 per 5 min per IP (360/hour) |
| Web3 sign-ups and sign-ins | 30 per 5 min per IP |
| Minimum interval per user | 60 seconds between emails to the same person |

**The 30 emails per hour is the one to watch.** It covers Supabase's own auth
emails - invitations and password resets - not the portal's client emails, which
go through Resend directly. Inviting more than 30 people in an hour would hit
it. With 18 staff that will not happen.

**Token refreshes at 150 per 5 minutes is per IP address.** Everyone in one
office shares one address. Eighteen people with hour-long tokens is nowhere near
it, but it is the limit that would bite first if the team grew a lot.

## 7. Authentication → Multi-Factor

| Setting | Live, 23 Nov 2026 |
|---|---|
| TOTP (app authenticator) | Enabled |
| Maximum factors per user | 10 |
| SMS / phone | Disabled |
| Phone OTP length | 6 |

All defaults. **The portal does not use Supabase's MFA at all** - it has its own
second factor, with codes in `auth_codes` sent through Resend, and its own
trusted-device handling. So this screen is enabled but unused. Match it in
Sydney anyway; there is no reason to differ.

---

## 8. Settings → Infrastructure

**It is called Infrastructure, not "Compute and Disk".**

| | Live, 23 Nov 2026 |
|---|---|
| Compute size | **Micro** |
| Region | `ap-southeast-1` — Southeast Asia (Singapore) |
| Read replicas | none |
| Database size | 161.1 MB |
| Write-ahead log | 112 MB |
| System | 169.9 MB |
| Disk used | 6% |
| CPU | 4–12% |
| Memory | 55–57% |
| Connections | 17 of 60 |

**Create Sydney as Micro.** Same size means same connection limit and same
statement timeout, so nothing but the address changes. Resize later if wanted -
not during a migration.

**Memory is the tightest of the four**, at 57%. Not a problem; worth knowing if
the team grows.

**No read replicas**, so nothing extra to recreate.

---

## 9. Settings → Data API

**It is called Data API, under INTEGRATIONS in the settings sidebar - not
"API".**

| Setting | Live, 23 Nov 2026 |
|---|---|
| Exposed schemas | 2 of 2 |
| Exposed tables | reads "0 of 58" - see below |
| Exposed functions | reads "0 of 34" - see below |
| Automatically expose new tables | On → **turned Off, 23 Nov** |
| Extra search path | `public`, `extensions` |
| **Max rows** | **1,000** |
| Pool size | configured automatically from the compute size |

**"0 of 58 tables exposed" is not what it sounds like.** It counts tables
somebody has toggled by hand, and nobody ever has. Access comes from the
automatic setting below it, not from that list. Worth knowing before somebody
reads it as "nothing is exposed".

**"Automatically expose new tables" was On.** Supabase's own text under it
recommends turning it off. It is the same born-open default that produced four
holes on 23 Nov: any table created from then on becomes reachable through the
API without anyone deciding it should be. Turned off; existing tables
unaffected.

**MAX ROWS IS 1,000 AND IT IS A PER-PROJECT SETTING.** Every screen in this
portal behaves differently if Sydney is created with a different value. It is
also the cause of the Portfolio Review defect found the same day - a read of
~8,700 trail lines was handed 1,000 with no error. **Set Sydney to 1,000 to
match, then re-run the accuracy checks there**, because matching row counts
between two projects proves nothing when both truncate identically. See
`docs/the-six-ways-a-number-goes-wrong.md`.

## 10. Settings → General

| | Live, 23 Nov 2026 |
|---|---|
| Project name | `simplify-finance-portal-claude` |
| Project ID | `brjytbuirbupatjtauhx` |
| Region | `ap-southeast-1` — Southeast Asia (Singapore) |
| Postgres | **17.6** |

Sydney must be 17.6 or newer - a restore goes into the same version or a newer
one, never an older one.

---

## 10a. Settings → API Keys — THE FORMAT IS CHANGING

| | Live, 23 Nov 2026 |
|---|---|
| Legacy keys (`eyJ…` JWTs) | in use by the portal |
| Publishable key (`sb_publishable_…`) | exists, unused |
| Secret key (`sb_secret_…`) | exists, unused |
| Dashboard notice | **"Legacy API keys will be retired in early 2027"** |

**A Supabase project created today does not issue legacy keys at all.** Since
1 November 2025, new and restored projects get the publishable and secret keys
only. So the Sydney key change is **not a swap - it is a format change.**

**What was checked, and came back clean:**

| | |
|---|---|
| Hand-built `Authorization: Bearer <supabase key>` headers | **none** - all ten matches are the Resend key |
| Policies or functions reading the token's role | **zero**, by `auth.role()`, `auth.jwt()`, `request.jwt.claims` or `current_setting` |
| Anything storing a storage object ID | **none** - documents are referenced by path |

**So the change is a credential swap and nothing more**, with one residual: two
Realtime subscriptions on `deals`, and new-key Realtime connections expire after
24 hours without a signed-in user. Both are inside the signed-in area, so this
is expected to be fine and is a rehearsal gate rather than a worry.

---

## 10b. Vercel — and this one is not a Supabase setting at all

**There was no `vercel.json` until 23 Nov 2026**, which means Vercel ran every
server-side operation in **Washington DC**. Every loan contract, tax return and
payslip the portal reads was read by code executing in the United States.

Now pinned:

```json
{ "regions": ["syd1"] }
```

`lib/the-portal-runs-in-australia.test.ts` fails the build if it is removed,
because deleting it breaks nothing visible.

**Plan: Hobby.** Vercel's non-commercial tier - no team access control, no
SSO, and no data processing agreement with the company holding the database
service role key. Tracked in `docs/OUTSTANDING.md`. Upgrading is a billing
change and it is ahead of the migration, not behind it.

---

## 11. The keys, in Vercel

A new project means a new address and new keys. Nothing carries over.

| Variable | What happens |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Change to the Sydney address |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Change to the Sydney key |
| `SUPABASE_SERVICE_ROLE_KEY` | Change to the Sydney key |
| `READY_LINK_SECRET` | **LEAVE EXACTLY AS IT IS** |

**`READY_LINK_SECRET` signs the links already sitting in clients' inboxes.**
Change it and every one of them stops working. It was set on 23 Nov 2026 for
precisely this reason - so that the service role key could change without taking
those links with it.

Redeploy after changing them.

---

## 12. Who could reach the data from outside the portal

Checked 23 Nov 2026, prompted by the ONE by Valora portal raising that the
weekly audit tests the portal and not the platform accounts behind it.

| Account | Found | Action |
|---|---|---|
| **Supabase** | Two members: Fabio (Owner) and **meg@simplifyfinance.com.au (Administrator)** | **Meg removed 23 Nov 2026.** She had full read access to every record and file, and no portal login at all. No portal rule applied to her |
| **Vercel** | **Hobby plan** — a personal account, so no team list. Fabio only | See below |
| GitHub | not yet checked | |
| Resend | not yet checked | |
| OneDrive | not yet checked | |

**On Meg.** Removing her ends her dashboard access. It does not invalidate the
service role key, which belongs to the project rather than to her - but the
Sydney move creates a new project with new keys, so that closes itself. The
client links survive it because `READY_LINK_SECRET` was separated from the
service role key on 23 Nov.

**On Vercel's Hobby plan.** It is Vercel's non-commercial tier. This is a
financial services portal used by 18 staff. Practically it means no team access
controls, no audit log and no SSO, on a plan whose terms this use sits outside.
Not urgent, but an IT reviewer will ask.

---

## 13. Before anyone uses Sydney

| Check | How |
|---|---|
| Nothing reachable without a login | `docs/weekly-audit.sql` check 1 reads 0 |
| Defaults closed before the restore | check 15 reads 0 |
| Everything came across | `docs/both-sides-must-match.sql` |
| The seven storage rules recreated | they are in no backup - see the runbook |
| `deals` back in the live-updates publication | otherwise the board stops updating silently |
| Sequences carry their real values, not 1 | otherwise the first save fails on a duplicate |
| Sign out, sign in with 2FA, open a deal, open a document | by hand |
| Robots pass | `./scripts/check-browser.sh` |
