-- PUTTING A DEAL BACK IN FACT FIND BY HAND.
--
-- Every other backwards move on the board clears a timestamp - the pre-approval
-- date, the lodgement date - because that timestamp is the only reason the deal
-- had moved on. Fact Find is the exception: a deal leaves it because somebody
-- typed into the fact find, and no card dropped on a board should delete a
-- client's answers.
--
-- Fabio, 3 Sep 2026: "if I wanna drag a deal card from BC back to fact find, I
-- need it to happen. Just make it happen."
--
-- The old `deals.stage` column was exactly this idea done badly - a string
-- written from six places that drifted until the board had to stop reading it.
-- This one stays honest three ways: it can only move a deal BACKWARDS, it
-- records the phase the deal was in when it was set so it expires by itself the
-- moment the deal genuinely moves on, and the card says it was placed by hand.

alter table deals add column if not exists phase_override text;
alter table deals add column if not exists phase_override_from text;
alter table deals add column if not exists phase_override_at timestamptz;

comment on column deals.phase_override is
  'A board column somebody dragged this deal into, when nothing could be cleared to put it there. Backwards only. Ignored once phase_override_from stops matching the deal''s derived phase.';
comment on column deals.phase_override_from is
  'The derived phase at the moment the card was placed. When the deal moves on, this stops matching and the override is ignored - so a hand placement can never hide a deal in the wrong column indefinitely.';

comment on column deals.phase_override_at is
  'When the card was placed. Any work recorded after this ends the placement - a hand move never suspends the rules, it only survives while nothing has happened.';
