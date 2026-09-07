-- WHO SAVED IT, NOT WHO IS STANDING THERE.
--
-- The red save banner could only ever say "somebody else is editing this",
-- because the only thing it had to go on was the presence table - who has the
-- deal open RIGHT NOW. Fabio, 7 Sep 2026: "BC says there's someone there and we
-- don't know who??"
--
-- Naming from presence answers the wrong question. On the deal he was looking
-- at, the person who saved was Kylie, and she had closed the tab thirty six
-- minutes earlier. Presence had nothing to say and the banner said "somebody".
--
-- So the save writes down who did it, in the same statement that writes the
-- record. Then the banner can name the person whether they are still in the deal
-- or went home at five.
--
-- Written ONLY by the whole-record saves - the four deal tabs. A timestamp or a
-- deal name does not touch it, so this always means "who last typed something
-- into this deal", which is the question being asked.
--
-- RUN THIS BEFORE DEPLOYING THE CODE THAT USES IT. The code copes with the
-- columns not being there - it falls back to naming from presence, which is what
-- it did before - but the banner cannot name somebody who has left until they
-- exist.
--
-- Safe to run twice. Nothing already stored is touched.

alter table deals add column if not exists last_saved_by   uuid;
alter table deals add column if not exists last_saved_name text;
alter table deals add column if not exists last_saved_tab  text;

comment on column deals.last_saved_name is
  'Who last saved one of the four deal tabs, and on which tab (last_saved_tab). Read by the save conflict banner so it can name the person even after they have closed the deal. Written only by whole-record saves - see lib/save-conflict.ts.';
