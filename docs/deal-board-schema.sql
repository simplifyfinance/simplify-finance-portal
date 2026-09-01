-- Deal board settings: broker colours, label colours, stale thresholds.
-- Fabio, 1 Sep 2026. Run in the Supabase SQL editor BEFORE deploying.
--
-- Both are additive. A portal with neither filled in behaves exactly as it does
-- today: every read falls back to the same defaults the code already used.

-- 1. A broker's colour belongs to the broker, the same way their CR number does,
--    so it follows them onto the board, the peek panel, and anything built later
--    without a second list to keep in step.
alter table brokers
  add column if not exists colour text;

-- 2. Label colours and stale thresholds are one setting, saved and read together.
--    Shape:
--      { "type": { "purchase": "#0E6FA0", ... },
--        "use":  { "investment": "#A3376B", ... },
--        "thresholds": { "lodged": { "long": 3, "nudge": 5 }, "formal": null } }
--    A phase written as null means "stop ageing this column" — NOT "use the
--    default". That is the only way to switch one off.
alter table settings
  add column if not exists deal_board jsonb;
