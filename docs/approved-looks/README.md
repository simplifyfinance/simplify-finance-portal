# The approved looks

Every mock-up Fabio has signed off, in the repo where it cannot be lost.

## Why these are here

Until 5 Oct 2026 these lived only in `Claude outputs/`, which `.gitignore`
ignores — so weeks of his work existed in one folder on one laptop, with no
copy on GitHub and nothing pointing at it. Fabio: "ive spent a lot of time
mocking statement FF/ BC ad LO tabs I cannot loose thast."

They are the specification. Not a picture of one — the thing itself. When the
portal and one of these disagree, the mock is right and the portal is behind.

## What each one is

| File | What it settles |
|---|---|
| `one-inside-the-deal-v4.html` | the deal page itself: breadcrumb, name row, prompt band, stage bar, the five tabs as cards, Next action, and the rail |
| `one-bc-tab.html` | the BC tab |
| `bc.html` | BC rebuilt out of the agreed blocks, so nothing was redrawn by hand |
| `lo.html` | Lending options |
| `ds.html` | three deal-structure densities. **B** was chosen — two lines per split |
| `mods.html` | three rate-module layouts. **3** was chosen — chips at the top, panels below |
| `st-page.html` | Statements |
| `approved.mjs`, `approved.css` | the agreed blocks themselves. Import these; never retype an agreed piece |

The screenshots are deliberately not here. They are a megabyte each and they
rebuild from the HTML in seconds.

## How this connects to the code

`lib/the-look.ts` lists every piece of every mock and either the proof it is in
the portal or `null` while it is not. `lib/the-look.test.ts` checks every claim
and fails if a mock named in that list has gone missing from this folder.

Open any of these in a browser. They carry their own styles and work offline.
