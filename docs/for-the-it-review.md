# Security review briefing

**Simplify Finance client portal**
**Prepared 23 November 2026 for Simplify Finance's IT advisers**
**Commercial in confidence**

---

## Purpose of this document

We commissioned an internal review of our client portal ahead of engaging you.
This document sets out what we looked at, what we found, what we have already
fixed, and what we believe still needs doing.

It is written so your time is spent on judgement rather than discovery. Where we
are uncertain, we say so.

---

## 1. What the portal is

A web application used by our staff to manage residential mortgage applications
from first enquiry through to settlement. It holds client financial
information: income, liabilities, assets, identification documents and loan
structures.

It is used by 18 staff accounts. It is not used by clients to log in; clients
interact only through individually signed links sent by email, which expire.

**How it is built and hosted**

| | |
|---|---|
| Application | Next.js, hosted on Vercel |
| Database and file storage | Supabase (managed PostgreSQL) |
| Outbound email | Resend |
| Source control | GitHub, private repository |
| Authentication | Email and password, plus a second factor |

There are no other integrations holding client data.

---

## 2. What was reviewed

- Every access rule on every database table and on file storage
- All 57 application endpoints, read individually
- The staff account list against the application's own team records
- Database extensions, scheduled jobs, triggers and stored secrets
- Where data is physically stored

The review was carried out on 23 November 2026 against the production system,
using read-only queries.

---

## 3. Findings

### 3.1 Client documents were accessible without authentication

**Severity: high. Resolved 23 November 2026.**

An access rule on the document storage container granted access to all
requesters without verifying identity. Combined with the default permissions
granted to the unauthenticated role, a party holding the application's public
API key — which is embedded in the published web application by design and is
readable from the page source — could have listed, downloaded, modified or
deleted files in that container.

The container held 581 files totalling 136 MB: generated Fact Find, Handover and
Broker Notes documents across approximately 145 applications.

**Mitigating factors.** The container was not publicly indexed or linked. An
attacker would have needed to identify the container name, which is not
disclosed anywhere public. We have no evidence the exposure was used.

**Cause.** The rule was created manually in the hosting provider's administrative
console during initial setup and therefore never appeared in source control or
in any code review.

**Remediation.** The rule has been replaced with one requiring an authenticated
session belonging to an active staff record. Verified in place.

**We would value your view on:** whether the available provider access logs are
sufficient to establish whether any unauthorised retrieval occurred, and whether
this meets a notification threshold under the Notifiable Data Breaches scheme.

### 3.2 A former staff member retained a working login

**Severity: medium. Resolved 23 November 2026.**

A staff member who left the business had her application record deleted rather
than archived. Deleting the record removes a person from the team screen but
does not disable the underlying login account. Her credentials remained valid.

Her last recorded sign-in was 21 October 2026, before her departure. There is no
record of any sign-in after that date.

**Cause.** Two removal paths existed. Only one disabled the login, and that
behaviour was added on 18 November 2026; anyone removed before that date
retained access regardless of the path used.

**Remediation.** The account has been disabled. All other 17 accounts were
checked and are current staff.

### 3.3 Authorisation rules test authentication rather than entitlement

**Severity: medium. Open.**

Approximately 60 database access rules grant access to any authenticated
session, without verifying that the session belongs to a current staff member.

This was immaterial while every login necessarily corresponded to a staff
member. Finding 3.2 demonstrates that assumption can fail. A session without a
corresponding staff record could have read and modified client contact records,
commission data, lender data and the staff directory. Loan application records
were not affected; those are separately restricted by assigned broker.

**Remediation plan.** A single entitlement check, applied across all affected
rules. This is a substantial change requiring careful testing and is scheduled
rather than immediate.

### 3.4 Unauthenticated application endpoints

**Severity: low to medium. Resolved 23 November 2026.**

Fifteen endpoints performed document processing and language-model calls without
any authentication check. Each was read individually and confirmed to operate
only on data supplied in the request; none retrieved stored client data. The
exposure was therefore cost abuse rather than data disclosure — a third party
could have invoked paid processing at our expense.

**Remediation.** All fifteen now require an authenticated active staff session.
An automated test prevents a further endpoint being added without one.

### 3.5 Data residency

**Severity: policy. Open.**

Our database and file storage are provisioned in the provider's Singapore
region. Our stated requirement from the outset was Australian data residency.

Our secondary environment is in Seoul. Two other systems in the group are
correctly in Sydney.

**Position.** Migration to the provider's Sydney region requires creating a new
project and migrating data; a region cannot be changed in place. We have raised
this with the provider and are awaiting a response on several technical points.
Our plan is to rehearse the migration on the secondary environment before
touching production, and to carry out production migration outside business
hours.

**For completeness:** moving to Sydney places data at rest in Australia. It does
not mean no data leaves Australia. The provider's contracting entity is
Singapore-based, support operations are United States-based, and authentication
emails are routed via United States providers. We would welcome your view on
whether this satisfies our obligations.

### 3.6 A documented control that was not operating

**Severity: low. Open.**

Our documentation described an hourly cleanup of temporary uploaded files. No
scheduler existed to invoke it, and the mechanism it used is blocked by the
provider in any case. The primary deletion path operates correctly and is
tested; this was a secondary safety net that did not exist.

---

## 4. Root cause

Three of the six findings share one pattern: a control that tested the
convenient condition rather than the correct one.

- *Is this request authenticated?* in place of *is this request entitled?*
- *Is this the documents container?* in place of *is this requester permitted?*
- *Have they been removed from the list?* in place of *can they still log in?*

Each was adequate when written and became inadequate as the system grew. None
was detected, because until 23 November 2026 no periodic review existed.

---

## 5. What we have put in place

**A weekly security audit, effective immediately.** Two scripted check sets —
one over the codebase, one over the database — run every Monday. Ten database
checks and four code checks. Both are read-only.

They test for: accounts without staff records, former staff retaining access,
rules granting unauthenticated access, tables with row-level security disabled,
public storage containers, administrator count changes, newly created accounts,
dormant accounts, credentials committed to source, and removal of existing
security tests.

**Engineering standards adopted** for this and future systems: a single
entitlement function used everywhere; no access rule may grant access
unconditionally; no access rule may be created outside source control; account
removal must be a single action that disables the login; and every remediated
fault must be accompanied by an automated test that prevents its reintroduction.

---

## 6. Where we would value your input

1. Whether finding 3.1 requires notification under the Notifiable Data Breaches
   scheme, and what evidence would be needed to reach a conclusion either way.
2. Whether provider access logs can establish retrieval activity for the period
   concerned, and how to preserve them.
3. Whether our data residency position (3.5) satisfies our obligations as a
   credit licensee, and what we should require contractually.
4. Whether our weekly audit coverage has material gaps.
5. Whether our authentication arrangements warrant strengthening beyond their
   present configuration.

---

## 7. Scope limitations

This review was conducted internally. It did not include penetration testing,
social engineering assessment, review of staff endpoint devices, or review of
our email and source control providers' own access arrangements. A clean result
against the checks described means those checks passed; it is not an assurance
that the system is secure.
