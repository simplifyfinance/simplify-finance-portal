# Client portal — security review summary

**Simplify Finance · Mortgage Specialists Pty Ltd · ACL 387025**
**23 November 2026 · Commercial in confidence**

We carried out an internal security review of our client portal on 23 November
2026. This is a summary of what we looked at, what we found, and what has been
done about it.

---

## What the portal is

A web application used by our staff to manage residential mortgage applications
from enquiry through to settlement. It is used by 18 staff accounts. Clients do
not log in; they interact only through individually signed links that expire.

| | |
|---|---|
| Application | Next.js, hosted on Vercel |
| Database and file storage | Supabase (managed PostgreSQL) |
| Outbound email | Resend |
| Source control | GitHub, private repository |
| Sign-in | Email and password, plus a second factor |

---

## What was reviewed

- Every route into the database: tables, views, materialised views, functions
  and file storage
- All 57 application endpoints, read individually
- The staff account list against the application's own team records
- Database extensions, scheduled jobs, triggers and stored secrets
- Where data is physically stored

Carried out against the production system using read-only queries.

---

## What was found, and what was done

| Finding | Action taken | Status |
|---|---|---|
| A storage rule did not verify the requester's identity. | Replaced with a rule requiring an authenticated session belonging to an active staff record. | Closed 23 Nov 2026 |
| A database view returned commission and loan records without applying the underlying access rules. | View set to run with the caller's permissions. Public access revoked. | Closed 23 Nov 2026 |
| A database function returned pipeline records and was callable without authentication. | Execute permission revoked from unauthenticated and public roles. | Closed 23 Nov 2026 |
| Thirteen further functions were callable without authentication, two of which perform deletions. | All revoked. Access retained for the application server and for authenticated staff where required. | Closed 23 Nov 2026 |
| A departed staff member's login remained enabled, because her record had been deleted rather than archived. | Account disabled. All other 17 accounts checked and confirmed as current staff. | Closed 23 Nov 2026 |
| Fifteen application endpoints performed document processing without an authentication check. | All now require an authenticated active staff session. An automated test prevents another being added without one. | Closed 23 Nov 2026 |
| A number of database access rules grant access to any authenticated session rather than verifying current staff entitlement. | A single entitlement check is being applied across the affected rules. | In progress |
| Our database is provisioned in the provider's Singapore region. Our requirement is Australian data residency. | Migration to the Sydney region planned, to be rehearsed on our secondary environment and carried out outside business hours. | Planned |

---

## Why these arose

The platform grants access by default. A newly created database function is
callable by any party unless permission is explicitly revoked; a newly created
table is reachable by the unauthenticated role on the same basis; and a database
view applies the underlying access rules only where a specific option is set.

In each case the open state is the default and closing it is a separate,
deliberate step. None of the findings above resulted from an incorrect action.
They resulted from steps that were never taken, and no periodic review existed
to detect them.

---

## What has been put in place

**The platform defaults have been changed.** New functions are no longer
callable by unauthenticated parties, and new tables and sequences are no longer
granted to the unauthenticated role. Existing grants have been revoked. This
setting is recorded as a required step for any new environment, including the
planned Sydney migration.

**A weekly security audit, effective immediately.** Two scripted check sets run
every Monday, one over the codebase and one over the database. Nineteen checks
in total. Both are read-only.

The principal check enumerates everything reachable without authentication
across all five routes into the database — tables, views, materialised views,
functions and storage. It is written this way because our first version checked
tables only, and three of the findings above were not in tables.

**Engineering standards adopted** for this and future systems:

- A single entitlement check, used by every endpoint and every access rule.
- No access rule may grant access unconditionally.
- No database object may be created outside source control.
- Every view must be created with caller permissions.
- Every function must have public execute revoked on creation.
- No materialised view may hold client data.
- Removing a staff member is one action, and it disables the login.
- Every remediated fault is accompanied by an automated test preventing its
  reintroduction.

---

## Scope limitations

This review was conducted internally. It did not include penetration testing,
assessment of staff endpoint devices, or review of our email and source control
providers' own access arrangements. A clean result against the checks described
means those checks passed; it is not an assurance that the system is secure.
