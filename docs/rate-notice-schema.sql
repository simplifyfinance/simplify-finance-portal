-- THE RBA NOTICE, AND WHO HAS PASSED IT ON.
--
-- Fabio, 30 Sep 2026: a disclaimer on every client email that quotes a rate,
-- because the RBA has moved and the banks will take two or three weeks to follow
-- - then off again, and ready to do the whole thing again next decision.
--
-- TWO PIECES, AND THE SECOND IS THE INTERESTING ONE.
--
-- settings.rate_notice holds the notice: the words, the decision it is about,
-- and when to review it. One row, one writer, and losing it costs a retype - the
-- right shape for a blob, unlike lender_rules next door where two people answer
-- different questions about different banks at the same moment.
--
-- THE LENDER SIDE IS A DATE, NOT A TICK. Fabio, 30 Sep 2026: "if I say for
-- exmaple Macquarie bank decion 30 septemebt and rate will increase on the 21st
-- of October I need the disclaiumer to go out on all Macquaire emails until the
-- 21st of October AFTER THAT date the disclaimer disapear".
--
-- A bank names the day when it announces, weeks ahead. So rate_notice_from holds
-- that day and the notice ends itself on it - nobody has to be at their desk on
-- the morning for a client email to be right.
--
-- rate_notice_for holds WHICH DECISION that date answers, and that is what makes
-- the next one free: change settings.rate_notice.decisionDate and not one
-- lender's stamp matches any more, so every bank goes back to carrying the
-- notice and last quarter's dates cannot leak into this quarter.
--
-- Nothing is written to any lender to do that. A clear-down loop is something
-- that can be half-finished, and seven banks silently exempt because a reset was
-- interrupted is exactly the failure this shape makes impossible.
--
-- EVERYBODY CAN TICK ONE. Fabio, 30 Sep 2026: "anyone can do this as it is a
-- team effort". So the name goes on it rather than a permission - somebody has
-- to be askable when a tick turns out to be wrong.
--
-- Safe to run twice. Nothing already stored is touched.

alter table public.settings
  add column if not exists rate_notice jsonb;

comment on column public.settings.rate_notice is
  'The RBA rate notice on client emails: { on, text, decisionDate, reviewBy }. decisionDate is what lenders.rate_notice_for is matched against - change it and every lender goes back to carrying the notice. Read by lib/rate-notice.ts.';

alter table public.lenders
  add column if not exists rate_notice_for  text,
  add column if not exists rate_notice_from date,
  add column if not exists rate_notice_by   text,
  add column if not exists rate_notice_at   timestamptz;

comment on column public.lenders.rate_notice_for is
  'WHICH RBA decision this lender''s announced date answers. Matches settings.rate_notice.decisionDate while current; anything else is last quarter''s news and is ignored.';
comment on column public.lenders.rate_notice_from is
  'The day this lender''s change takes effect, as they announced it. Client emails quoting this lender carry the notice up to this date and stop on it, by themselves.';
comment on column public.lenders.rate_notice_by is
  'Who ticked it. Everybody can, so somebody has to be askable when it turns out to be wrong.';

-- WHERE IT STANDS. Run this any time somebody asks what clients are being told.
select l.name,
       coalesce(l.rate_notice_for, '—')                       as announced_for,
       coalesce(l.rate_notice_from::text, '—')                as takes_effect,
       coalesce(l.rate_notice_by, '—')                        as recorded_by,
       case
         when (s.rate_notice ->> 'on') is distinct from 'true' then 'notice is off'
         when l.rate_notice_for is distinct from (s.rate_notice ->> 'decisionDate')
           then 'NOTICE SHOWN — nothing announced for this decision'
         when l.rate_notice_from <= current_date then 'no notice — in force since ' || l.rate_notice_from
         else 'notice until ' || l.rate_notice_from || ', then it stops by itself'
       end                                                    as right_now
  from public.lenders l
  cross join (select rate_notice from public.settings where id = 'singleton') s
 order by right_now, l.name;
