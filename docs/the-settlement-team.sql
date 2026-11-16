-- WHOSE JOB IT IS, NOT WHO MAY LOOK.
--
-- 18 Nov 2026. The "settlement team this morning" box on the admin Today asked
-- the database for everybody with sees_settlements and got eight people: the
-- two who work settlements, a credit assessor, and five staff who have the tab
-- so they can read it.
--
-- Fabio: "Denisha, she's a credit assessor. She's a credit officer. Why is she
-- even here? We had this conversation. Who are these people?"
--
-- He was right, and the mistake has a name: a permission was used as a job
-- title. sees_settlements answers "may this person open the screen". It has
-- never answered "is this person's work settlements", and the two lists are not
-- the same shape - one grows every time somebody needs to look something up.
--
-- SO THE JOB GETS ITS OWN COLUMN, ticked in Settings -> Team like every other
-- seat, and the box asks for that.
--
-- RUN ON STAGING FIRST, then live. One column with a default, and two rows
-- ticked. Nothing existing is changed or dropped.

alter table public.user_profiles
  add column if not exists settlements_team boolean not null default false;

update public.user_profiles
   set settlements_team = true
 where full_name in ('Belle Nunez', 'Julian Kok');

comment on column public.user_profiles.settlements_team is
  'Works in settlements. Not a permission - sees_settlements says who may look, this says whose job it is, and who owes a plan each morning. Ticked in Settings -> Team, read by components/SettlementsBand.tsx and components/SettlementDay.tsx.';
