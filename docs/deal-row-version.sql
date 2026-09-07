-- THE DATABASE ITSELF REFUSES A STALE SAVE.
--
-- Everything built so far asks nicely: the browser reads the deal, decides the
-- save is safe, and then writes it. There is a gap of milliseconds between the
-- reading and the writing where somebody else's save can still land underneath,
-- and nothing in the browser can close it - by the time it knows, it has already
-- written.
--
-- One number closes it. Every whole-record save on a deal writes
--
--     ... where id = <the deal> and row_version = <the number I read a moment ago>
--
-- so if anybody has saved in between, the number no longer matches and the write
-- touches NOTHING. Postgres decides, not the browser, and it decides at the
-- instant of writing. The browser then reads the deal again, folds the two lots
-- of work together as it already does, and writes again.
--
-- Only the saves that write a whole record bump this - the four deal tabs, the
-- deal structure block, the document ticks, the handover ticks. A timestamp or a
-- deal name does not, so marking a BC as sent can never interrupt somebody
-- typing in the fact find.
--
-- RUN THIS BEFORE DEPLOYING THE CODE THAT USES IT. The code copes with the
-- column not being there yet - it falls back to the old behaviour rather than
-- failing to save - but until the column exists the gap is still open.
--
-- Safe to run twice. Nothing already stored is touched, and every existing deal
-- starts at zero.

alter table deals add column if not exists row_version bigint not null default 0;

comment on column deals.row_version is
  'Bumped by every whole-record save (the four deal tabs, deal structure, document and handover ticks). A save writes only if this still matches what it read, so two people cannot overwrite each other in the gap between reading and writing. Timestamps and names do not touch it.';
