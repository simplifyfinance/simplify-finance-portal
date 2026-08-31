-- Who pressed "the client agreed", and when (31 Aug 2026)
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Two doors set client_proceeded: the client pressing Proceed on their own page,
-- and one of us pressing "Client agreed" on the BC or LO tab because they rang.
-- Both wrote the same thing, so afterwards there was no way to tell them apart.
--
-- Deliberately no default. NULL means "we did not record it", and every deal that
-- existed before today is NULL. The button says so plainly rather than crediting
-- the client on no evidence.

alter table public.deals
  add column if not exists proceeded_source text,
  add column if not exists proceeded_by text,
  add column if not exists lo_proceeded_source text,
  add column if not exists lo_proceeded_by text;
