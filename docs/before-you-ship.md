# Before anything that changes the screen goes out

Agreed with Fabio, 9 Sep 2026, after a week in which three bugs reached the
team that no test in this repo could ever have caught:

- the deal page jumping under somebody who was typing
- Katie showing as present in a deal she had left hours earlier
- letters vanishing from the broker summary notes while Kylie wrote them

Every check that runs on `ship.sh` — broker keys, email HTML, database writes,
whole-record writes, 1193 tests, the build — is a check on the code. Not one of
them opens the page, types in a box, or puts two people in a deal at once. All
three of those bugs would have been obvious within two minutes of doing so.

Fabio: "How do we stop the bugs?"

## The rule

**Nothing that changes what somebody sees is handed over to ship until it has
been opened in a real browser and used.** Not described, not reasoned about,
not covered by a unit test. Opened, clicked, typed into.

Where two people are involved, that means two windows, signed in as two people,
at the same time.

## What that looks like in practice

1. The change is written and the six gates pass, as before.
2. It is opened in a browser on the live deployment or a preview of it, and the
   thing that changed is actually done — the box typed in, the button pressed,
   the second window opened.
3. Only then is the ship command handed over, and the hand-over says plainly
   whether step 2 happened and what was seen. If it did not happen, it says
   that instead, so Fabio can decide whether to ship blind.

## And the other half

**One thing per ship.** The batch on 8 Sep carried live editing, the presence
rewrite, the layout change and the removal of the warnings. When letters started
disappearing, neither of us could tell which of the four had done it. Small
ships, one subject each, so a problem names its own cause.

## What this rule does not cover

It is discipline, not machinery. It holds exactly as long as it is kept. The
machinery version — a robot that opens a browser, types into a deal, opens a
second window as another person and fails the ship if anything is lost or moves
— is the next thing, and until it exists this document is the only thing
standing between a screen bug and the team.
