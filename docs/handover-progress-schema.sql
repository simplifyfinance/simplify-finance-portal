-- The handover screen: which boxes have been copied into SalesTrekker.
--
-- Fabio, 2 Sep 2026, choosing to have the ticks remembered: "Yes, remember it".
-- Without this the green ticks last only while the tab is open, so a staff
-- member who is interrupted starts again, and a second person picking the file
-- up cannot see what has already been done.
--
-- Shape: { "<card key>": { "at": "<iso timestamp>", "by": "<full name>" } }
-- The card keys come from lib/handover-view.ts - 'analysisComment',
-- 'applicant:a2', 'property:0' and so on. A key that no longer exists is simply
-- ignored, so deleting a liability cannot break the page.

alter table deals add column if not exists handover_progress jsonb default '{}'::jsonb;

comment on column deals.handover_progress is
  'Which handover/fact-find boxes have been copied into SalesTrekker, and by whom. Written by the handover screen.';

-- Anyone who can already update a deal can tick a box. There is no separate
-- permission here on purpose: the same team does the work.
