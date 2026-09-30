-- THE MOBILE UNDER A SIGN-OFF.
--
-- Every milestone email ends with the name of whoever sent it, the brand, an
-- email address and a mobile - because a client reading "your loan is formally
-- approved" at 8pm wants a number, not a reply form. Fabio, 29 Sep 2026, on
-- whether the signature should be the sender or the broker: "B match send and
-- sognature".
--
-- credit_officers.phone already exists for the number a bank's assessor rings.
-- This is the other one: the number a CLIENT rings, belonging to whoever pressed
-- send. Different person, different audience, so a different column rather than
-- one number doing two jobs.
--
-- NOTHING BREAKS WITHOUT IT. A profile with no number simply has no mobile line
-- in the signature - lib/milestone-email-parts.ts has always guarded it - and
-- app/api/send-milestone-email asks for this column and carries on without it if
-- it is not there yet. So this can be run before the deploy or after it.
--
-- Safe to run twice. Nothing already stored is touched.

alter table public.user_profiles
  add column if not exists phone text;

comment on column public.user_profiles.phone is
  'Direct mobile for this person, printed under their name on client emails they send from the portal. Maintained in Settings. Empty is fine - the signature leaves the line out.';

-- WHO HAS ONE. Anybody who sends a client email and shows blank here will sign
-- off without a number.
select full_name,
       case when coalesce(phone, '') = '' then 'no number' else 'has one' end as mobile
  from public.user_profiles
 order by mobile, full_name;
