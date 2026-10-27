-- THE TEAM DIRECTORY, IN THE PORTAL INSTEAD OF A PDF ON THE SHARED DRIVE.
--
-- 27 Oct 2026. Catherine, Operations Manager, item 9 of nine: "Live group
-- directory - in the portal or Teams, instead of a PDF on the shared drive."
--
-- IT CANNOT BE BUILT FROM THE PEOPLE WHO LOG IN. The PDF covers SIMPLIFY GROUP
-- - 35 people across seven businesses, Australia and the Philippines - and
-- most of them have no portal login at all: the accountants, the buyers
-- agents, the processing team. user_profiles is who can sign in; this is who
-- we are. Two different lists, and merging them would mean inventing accounts
-- for people who do not need one.
--
-- SO IT IS ITS OWN TABLE, and the portal's job is only that the page is live:
-- one person changes a number and everybody has it, instead of a PDF that was
-- correct the day it was exported.
--
-- ADD, EDIT AND DELETE, ALL THREE. Fabio, 27 Oct 2026: "please alwasy have
-- ability to edit and delete and add". A directory row is a fact about today,
-- nothing else in the portal points at one, and somebody who has left should
-- come off it rather than linger greyed out. (Where a row IS pointed at from
-- elsewhere - a commission split a settled deal used - deleting it would break
-- that deal, and those are switched off instead. See docs/who-shares-this-
-- deal.sql.)
--
-- THE BUSINESS IS TEXT, NOT A SECOND TABLE. Seven today and an eighth would
-- otherwise be a migration. The screen offers the ones already in use and lets
-- a new one be typed.
--
-- RUN ON STAGING FIRST, then live. One new table. Nothing existing is touched.

create table if not exists public.directory_people (
  id         uuid primary key default gen_random_uuid(),
  business   text not null default 'Simplify Finance',
  name       text not null,
  role       text,
  email      text,
  phone      text,
  -- 'AU' or 'PH'. Free text because a third office is a fact, not a migration.
  location   text,
  -- Within a business. The PDF had an order somebody chose and it carried
  -- meaning - directors last, which is how that team reads itself.
  sort_order integer not null default 100,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

comment on table public.directory_people is
  'Everybody across the Simplify Group, whether or not they can sign in. Replaces the Team Directory PDF. user_profiles is who has a login; this is who we are.';
comment on column public.directory_people.business is
  'Which of the group''s businesses. Text rather than a join so an eighth is a row, not a migration.';
comment on column public.directory_people.location is
  'AU or PH. Free text for the same reason.';
comment on column public.directory_people.sort_order is
  'Order within a business. The PDF had one and it meant something.';

create index if not exists directory_people_business_idx
  on public.directory_people (business, sort_order, name);

alter table public.directory_people enable row level security;

-- EVERYBODY SIGNED IN CAN READ IT. That is the entire point - offshore,
-- credit and brokers all finding a number without asking somebody.
drop policy if exists directory_people_read on public.directory_people;
create policy directory_people_read on public.directory_people
  for select to authenticated using (true);

-- And anybody signed in can keep it current. Fabio asked for add, edit and
-- delete without a gate: a directory somebody has to ask an admin to correct
-- is a directory that goes stale, which is the PDF again.
drop policy if exists directory_people_write on public.directory_people;
create policy directory_people_write on public.directory_people
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- WHAT IS ON THE PDF TODAY
-- ---------------------------------------------------------------------------
--
-- Seeded once, so nobody retypes 30 rows. Safe to run twice: it inserts only
-- where the table is empty.
--
-- SOME ROWS ON THE PDF HAVE NO NAME. One reads "B", one reads "(", and four
-- are blank with only a location. They are not invented here - they are left
-- out, and the count below will come up short of the 35 the PDF claims. That
-- gap is real and worth somebody looking at rather than papering over.

insert into public.directory_people (business, name, role, email, phone, location, sort_order)
select * from (values
  ('Simplify Group',        'Meg Malicdem',       'Projects Officer',                 'meg@simplifyfinance.com.au',        '(02) 9564 8604', 'AU', 10),

  ('Simplify Accounting',   'Brad Milovic',       'Senior Accountant',                'brad@simplifyaccounting.com.au',    '0475 623 538',   'AU', 10),
  ('Simplify Accounting',   'Maksim Gusavac',     'Accountant',                       'maksim@simplifyaccounting.com.au',  '0415 167 796',   'AU', 20),

  ('Simplify Asset',        'James Cerolini',     'Director',                         'james@simplifyfinance.com.au',      '0428 074 112',   'AU', 10),
  ('Simplify Asset',        'Michael Perry',      'Credit & Ops Officer',             'michael@simplifyfinance.com.au',    '0484 622 119',   'AU', 20),
  ('Simplify Asset',        'Emma Cerolini',      'Settlements & Compliance Officer', 'emma@simplifyfinance.com.au',       '0402 905 416',   'AU', 30),
  ('Simplify Asset',        'Nicole Kalatzis',    'ROAM Relationship Support',        'nicole@simplifyfinance.com.au',     '0402 845 302',   'AU', 40),
  ('Simplify Asset',        'Ryan Diaz',          'Processing & Admin Officer',       'finance@simplifyfinance.com.au',    null,             'PH', 50),
  ('Simplify Asset',        'Dejan Bratic',       'Broker',                           'dejan@simplifyfinance.com.au',      '0402 565 700',   'AU', 60),
  ('Simplify Asset',        'Jarryd O''Brien',    'Lead & Marketing Officer',         'jarryd@simplifyfinance.com.au',     null,             'AU', 70),

  ('Simplify Broking',      'Justin Cornock',     'Broker',                           'justin@simplifyfinance.com.au',     '0421 008 048',   'AU', 10),
  ('Simplify Broking',      'Keanen Wood',        'Broker',                           'keanen@simplifyfinance.com.au',     '0415 796 282',   'AU', 20),

  ('Simplify Finance',      'Belle Nu'||chr(241)||'ez', 'Settlements Officer',        'settlements@simplifyfinance.com.au','(02) 9466 2465', 'PH', 10),
  ('Simplify Finance',      'Cris Po',            'Client Services Officer',          'cris@simplifyfinance.com.au',       '(02) 9466 2471', 'PH', 20),
  ('Simplify Finance',      'Ellie Morella',      'Client Services Officer',          'ellie@simplifyfinance.com.au',      '(02) 5119 8073', 'PH', 30),
  ('Simplify Finance',      'Ellese Cabuga',      'Client Services Officer',          'ellesse@simplifyfinance.com.au',    '(02) 8074 7761', 'PH', 40),
  ('Simplify Finance',      'Ria Catangui',       'Broker Support Officer',           'ria@simplifyfinance.com.au',        '(02) 8074 7794', 'PH', 50),
  ('Simplify Finance',      'Dinisha Devadason',  'Credit Support Manager',           'dinisha@simplifyfinance.com.au',    '(02) 8074 7765', 'AU', 60),
  ('Simplify Finance',      'Mellissa Sedin',     'Credit Support Manager',           'mellissa@simplifyfinance.com.au',   '(02) 7228 3834', 'AU', 70),
  ('Simplify Finance',      'Julian Kok',         'Settlements Manager',              'julian@simplifyfinance.com.au',     '0480 801 976',   'AU', 80),
  ('Simplify Finance',      'Katie Amos',         'Credit Support Manager',           'katie@simplifyfinance.com.au',      '(02) 9466 2496', 'AU', 90),
  ('Simplify Finance',      'Kylie Searle',       'Broker',                           'kylie@simplifyfinance.com.au',      '0429 228 148',   'AU', 100),
  ('Simplify Finance',      'Alan Hemmings',      'General Manager',                  'alan@simplifyfinance.com.au',       '0405 855 933',   'AU', 110),
  ('Simplify Finance',      'Mark Gallo',         'Director/Broker',                  'mark@simplifyfinance.com.au',       '0421 788 220',   'AU', 120),
  ('Simplify Finance',      'Fabio De Castro',    'Director/Broker',                  'fabio@simplifyfinance.com.au',      '0432 489 152',   'AU', 130),

  ('Simplify Processing',   'Catherine McFarlane','Director',                         'catherine@simplifyprocessing.com.au','0419 938 870',  'AU', 10),
  ('Simplify Processing',   'Wella Avilla',       'Broker Support Officer',           'wella@simplifyprocessing.com.au',   '63 995 582 2123','PH', 20),

  ('Simplify Buyers Agency','John Halliday',      'Director',                         'john@simplifyba.com.au',            '0407 248 619',   'AU', 10),
  ('Simplify Buyers Agency','Aaron Borg',         'Buyers Agent',                     'aaron@simplifyba.com.au',           '0401 306 868',   'AU', 20)
) as seed
where not exists (select 1 from public.directory_people);

-- A CHECK OF WHAT YOU JUST RAN. Expect 29 people across 7 businesses.
-- The PDF says 35; the six missing are the rows on it with no name.
select count(*) as people, count(distinct business) as businesses
from public.directory_people;
