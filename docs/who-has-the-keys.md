# Who has the keys

**The monthly check the weekly audit cannot do.**

23 Nov 2026. Raised by the ONE by Valora portal while we were closing the
database, and it is right: **everything the weekly audit tests is inside the
portal. None of it applies to somebody who signs in to the platforms behind the
portal.**

An administrator on the Supabase account can open the table editor and read
every borrower's file. Not one of the rules written on 23 November stops them,
because those rules govern the portal's own connection and a person at the
dashboard is not using it.

Same for the other four. This is the front door, and the weekly audit only
checks the house.

---

## The five lists

Run on the **1st of each month**. About two minutes.

| Where | Exactly where to click | What they could do |
|---|---|---|
| **Supabase** | Organization → Team | **Read and change every record and every file.** This one matters most. |
| **Vercel** | Team → Members, **and the plan name at the top left** | Change the live portal, and read its secret keys |
| **GitHub** | `simplify-finance-portal` → Settings → Collaborators | Change the code |
| **Resend** | Team | Send email as Simplify Finance |
| **OneDrive** | The shared deal folders | Read the archived documents |

Open each one. Compare the names against the list below. **If a name is there
that is not below, remove it, then tell Claude who it was and when they left.**

---

## What the first check found — 23 November 2026

**Supabase had two members.** Fabio as Owner, and
`meg@simplifyfinance.com.au` as **Administrator**. Administrator reads every
record and every file from the dashboard, and no rule in the portal applies,
because she was not coming through the portal. She had no portal login at all.

**Removed the same day.** Recorded in `docs/approved-access.txt`.

Removing her ends her dashboard access. It does not invalidate the service role
key, which belongs to the project rather than to the person - but the Sydney
move creates a new project with new keys, which closes that by itself.

**Vercel is on the Hobby plan.** That is a personal, non-commercial account, so
there is no team list to check - it is Fabio only. It also means no team access
controls, no audit log and no SSO on the system that serves the portal and holds
its secret keys. **Check the plan name every month as well as the member list**,
because moving to a team plan changes who can be added without anyone saying so.

---

## Who is allowed

Fill this in on the first run. After that it is the list everything is compared
against, and a change to it is a change to a file in the repository — visible,
dated and reviewable, which is the point.

### Supabase
- Fabio De Castro
- _(fill in on first run)_

### Vercel
- Fabio De Castro
- _(fill in on first run)_

### GitHub
- Fabio De Castro
- _(fill in on first run)_

### Resend
- Fabio De Castro
- _(fill in on first run)_

### OneDrive — shared deal folders
- _(fill in on first run)_

---

## GitHub is checked automatically. The other four are not.

**GitHub** is the only one of the five with a genuinely read-only key, so
`scripts/weekly-audit.sh` checks it every Monday against the `github:` lines in
`docs/approved-access.txt`. Anyone with access who is not on that list comes
back as a FAIL with their name.

The key holds **Metadata: Read-only** and nothing else. It cannot read your
code and it cannot read your data. It lives in the Mac's keychain, never in the
repository and never in chat.

**The other four stay by hand, deliberately.**

*Supabase* has no read-only key. Its key can read every record and delete the
project. Storing one on a laptop to save two minutes a month creates a larger
risk than it removes.

*Vercel's* tokens are broader than read-only too.

*Resend* offers no way to read its team list at all.

*OneDrive* would need a Microsoft application registered first.

---

## Setting up the GitHub key — once, ten minutes

1. Go to **github.com/settings/personal-access-tokens/new**. That is your
   personal settings, not the repository's Settings tab.
2. Name it `simplify audit`. Expiration: a custom date one year out.
   Resource owner: `simplifyfinance`.
3. Repository access: **Only select repositories** → `simplify-finance-portal`.
4. Permissions: the page starts with none. Click **Add permissions** →
   **Metadata** → **Read-only**.
5. **Generate token.** Leave the page open.
6. Run this in Terminal FIRST, then copy the token — that way you are only
   handling one thing on the clipboard at a time:

   ```
   security add-generic-password -a "$USER" -s simplify-audit-github -w
   ```

   It waits. Paste the token, press Enter, paste again, press Enter.
   **Nothing appears on screen as you paste. That is normal.**

7. Run `./scripts/weekly-audit.sh`. The first run lists who has access. Put
   those names in `docs/approved-access.txt` and it says PASS from then on.

**If it comes back saying GitHub refused the key**, the token needs
**Administration: Read-only** added as well as Metadata. Some organisations
require it to list who has access. Add it at step 4 and make a new token.

**Renewing.** The key expires in a year and the audit will say so rather than
going quiet. Make a new one (steps 1 to 5), then:

```
security delete-generic-password -s simplify-audit-github
```

and repeat step 6.

---

## What to do with an unexpected name

1. **Remove them first.** Do not investigate with the access still live.
2. Tell Claude who it was, which account, and roughly when they would have been
   added.
3. For Supabase specifically, also check the provider's access logs for that
   period. They are kept for days rather than months, so it is worth doing the
   same day.
4. Update the list above.

---

## What this does not cover

- **It does not show what anyone did**, only who can. Activity logs are separate
  and short-lived.
- **It does not cover personal devices.** Somebody removed from the list may
  still have a laptop with a browser signed in.
- **It does not cover API keys and tokens** held by people rather than by the
  portal. Those are worth their own review, less often.
