-- ============================================================================
-- PORTFOLIO REVIEW. THE TABLES.
--
-- Run in the Supabase SQL editor. STAGING FIRST, then LIVE.
-- Safe to run twice: everything is "if not exists" or "create or replace".
-- Nothing is deleted and no existing data is changed.
--
-- 15 October 2026.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS IS FOR
-- ---------------------------------------------------------------------------
--
-- Ten years of clients, most of whom have never been near this portal, who may
-- be sitting on equity they could use. Fabio works the numbers himself. The
-- portal's job is to hold the list, remember where each one got to, and stop
-- the same person being emailed twice.
--
-- ---------------------------------------------------------------------------
-- THE DECISION THIS FILE RESTS ON
-- ---------------------------------------------------------------------------
--
-- The imported book goes into `clients`. Not a second table of its own.
--
-- This codebase keeps making the same mistake and keeps writing it down: one
-- fact decided in two places, free to disagree. The lender name, the duty
-- state, the settings menu, the stamp duty label. "Who is a client" is exactly
-- that kind of fact, and a second clients table would mean a matching step
-- every time somebody converts, two sets of contact details, and a day when
-- the wrong one gets emailed.
--
-- The cost is real and is paid on screen, not here: the Clients page and the
-- deal pickers go from hundreds of rows to thousands, so both need a filter.
-- That is a smaller problem than two books.
--
-- ---------------------------------------------------------------------------
-- AND THE THING THAT WOULD HAVE MADE THE WHOLE IMPORT INVISIBLE
-- ---------------------------------------------------------------------------
--
-- `clients` has two select policies today: "Client visibility via deals", which
-- finds a client through a deal, and "Users can view their own newly created
-- clients", which matches created_by to the person asking.
--
-- An imported client HAS NO DEAL. So without section 2 below, every row this
-- import writes would be visible to exactly one person - whoever ran it - and
-- invisible to everyone else, including every broker whose clients they are.
-- Imported by a server-side key with no created_by, they would be visible to
-- nobody at all, and the import would look like it had silently done nothing.
--
-- That is not a thing to discover after loading ten years of clients.
-- ============================================================================


-- ===========================================================================
-- 1. WHAT A CLIENT NEEDS TO KNOW ABOUT ITSELF
-- ===========================================================================

alter table public.clients
  -- Came from the spreadsheet rather than from a deal. Drives the filter on
  -- the Clients page and the visibility policy in section 2.
  add column if not exists from_book boolean not null default false,

  -- Whose client they are. A deal carries assigned_broker; an imported row has
  -- no deal, so it has to carry its own. Set from the spreadsheet where it says
  -- so, otherwise from whoever ran the import.
  add column if not exists book_broker_key text,

  -- THE KEY THAT MAKES A SECOND IMPORT SAFE.
  --
  -- A stable fingerprint of the spreadsheet row - the loan account number where
  -- there is one, otherwise the name and email. Re-dropping the same file finds
  -- the row it wrote last time and updates it, instead of creating a second
  -- copy of every client. The NAB documents taught this: an import that can
  -- duplicate everything is an import nobody dares run twice.
  add column if not exists book_row_key text,
  add column if not exists book_imported_at timestamptz,
  add column if not exists book_import_run uuid,

  -- OPT OUT. Flagged by hand when a client replies and asks not to hear about
  -- this again. The list skips them and the send button is refused.
  add column if not exists portfolio_review_opt_out boolean not null default false,
  add column if not exists opt_out_date date;

-- One row per spreadsheet row, per import, enforced rather than hoped for.
-- Partial, because every client who came from a deal has a null key and there
-- are a great many of them.
create unique index if not exists clients_book_row_key_idx
  on public.clients (book_row_key) where book_row_key is not null;

create index if not exists clients_from_book_idx
  on public.clients (from_book) where from_book;

comment on column public.clients.book_row_key is
  'Fingerprint of the spreadsheet row this client came from. What makes a second import an update instead of a duplicate - see docs/portfolio-review-schema.sql.';


-- ===========================================================================
-- 2. SO THAT AN IMPORTED CLIENT CAN ACTUALLY BE SEEN
-- ===========================================================================
--
-- Added ALONGSIDE the two policies that exist. Row level security is additive:
-- a row is visible if any policy allows it, so nothing here takes away a
-- permission anybody has today. A client who came from a deal is still found
-- through that deal exactly as before.
--
-- The four role tests are the same ones the rest of the portal uses, so a
-- broker sees their own book and nobody else's.

drop policy if exists "Book client visibility" on public.clients;
create policy "Book client visibility" on public.clients
for select to authenticated using (
  from_book and (
    auth_role() = 'admin'
    or auth_sees_all_deals()
    or (auth_role() = 'broker' and lower(coalesce(book_broker_key, '')) = lower(auth_broker_key()))
  )
);

drop policy if exists "Book client editing" on public.clients;
create policy "Book client editing" on public.clients
for update to authenticated using (
  from_book and (
    auth_role() = 'admin'
    or auth_sees_all_deals()
    or (auth_role() = 'broker' and lower(coalesce(book_broker_key, '')) = lower(auth_broker_key()))
  )
) with check (true);


-- ===========================================================================
-- 3. THE REVIEW
-- ===========================================================================
--
-- One row per client per round of reviewing. Next year's review is a NEW row,
-- not an edit of this one, so last year's figures and what came of them are
-- still readable. Same reasoning as a read run on a policy document: a new
-- attempt never destroys the one before it.
--
-- MONEY IS NUMERIC HERE, not text as typed.
--
-- The client position stores money as it was typed, commas and all, and
-- docs/client-loans-view.sql spends thirty lines converting it back. That was
-- the right call for a field a person fills in free-form and the wrong one for
-- figures we have to add up: the whole point of the validation rule is that
-- equity release plus savings equals the deposit, and '$130,000'::numeric
-- throws. The screen formats with lib/money.ts on the way out, which is the
-- standing rule and is about display, not storage.

create table if not exists public.portfolio_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,

  -- WHERE IT GOT TO. The order is the order of the work.
  status text not null default 'not_reviewed',
  constraint portfolio_reviews_status_known check (status in (
    'not_reviewed',       -- on the list, nobody has looked
    'valuation_checked',  -- current values found
    'numbers_done',       -- the figures below are filled in
    'template_sent',      -- the email has gone, and that is a fact not a guess
    'client_responded',   -- they answered
    'closed'              -- finished, see outcome
  )),

  -- Only set when status is 'closed'. Every one of them sets a next review
  -- date, because "not now" is almost never "not ever".
  outcome text,
  constraint portfolio_reviews_outcome_known check (outcome is null or outcome in (
    'converted',       -- became a deal, see linked_deal_id
    'not_suitable',    -- the numbers do not work yet
    'declined',        -- they said no
    'no_response'      -- chased and never heard back
  )),

  reviewer uuid,
  reviewed_at timestamptz,
  -- WHEN TO COME BACK. The list is sorted on this. Never null once a review
  -- has been closed - see the trigger in section 6.
  next_review_date date,

  -- THE FIGURES FABIO WORKED OUT. Entered, not calculated, except where said.
  --
  -- figures_date is what the email tells the client their numbers are based
  -- on. For an imported client it is the month of the commission statement the
  -- balances came from, which is recent and true - NOT the date the
  -- spreadsheet was loaded, which could be years behind the balances.
  figures_date date,
  purchase_range_min numeric(14,2),
  purchase_range_max numeric(14,2),
  purchase_price numeric(14,2),
  stamp_duty numeric(14,2),
  loan_amount numeric(14,2),
  equity_release numeric(14,2),
  savings_contribution numeric(14,2),

  -- Which property the equity comes out of. Named in the email, so it must be
  -- one of this review's own properties - checked in section 6.
  equity_property_id uuid,

  -- FOR THE CALL, NEVER FOR THE CLIENT. The lender type lives here. Nothing in
  -- this column is ever merged into an email.
  internal_notes text not null default '',

  -- SENT MEANS SENT. Written by the send route after the mail has gone, never
  -- by the browser, so "Template sent" cannot mean "I pressed a button".
  email_sent_at timestamptz,
  email_sent_by uuid,

  -- Set when the review turns into a deal.
  linked_deal_id uuid references public.deals(id) on delete set null,

  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_reviews_client_idx
  on public.portfolio_reviews (client_id);
create index if not exists portfolio_reviews_due_idx
  on public.portfolio_reviews (next_review_date) where status <> 'closed';
create index if not exists portfolio_reviews_status_idx
  on public.portfolio_reviews (status);

-- One open review per client. A second one is a mistake, not a feature: two
-- open reviews means two people working the same client and the real risk of
-- the same person being emailed twice.
create unique index if not exists portfolio_reviews_one_open_idx
  on public.portfolio_reviews (client_id) where status <> 'closed';


-- ===========================================================================
-- 4. THE PROPERTIES, AS THEY STOOD WHEN THE REVIEW WAS DONE
-- ===========================================================================
--
-- Hung off the review and not off the client, deliberately. A review is a
-- snapshot: these were the balances, these were the values, this is what we
-- told them. Next year's review gets its own rows. Overwriting them would
-- leave an email in a client's inbox quoting figures that no longer exist
-- anywhere.

create table if not exists public.portfolio_review_properties (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.portfolio_reviews(id) on delete cascade,
  -- Carried as well as reachable, same reason as on the policy sections: every
  -- question starts with a client.
  client_id uuid not null references public.clients(id) on delete cascade,

  ordinal int not null default 1,
  address text not null check (length(trim(address)) > 0),

  -- Owner occupied properties are SHOWN and NOT COUNTED. You need the whole
  -- portfolio to have the conversation; counting the home's equity would
  -- inflate the figure and the email would be wrong.
  investor boolean not null default true,

  -- FROM THE SPREADSHEET. History, and it never changes.
  original_value numeric(14,2),
  original_loan numeric(14,2),

  -- FROM THE COMMISSION STATEMENT, and this is the piece that keeps itself
  -- current. balance_as_at is the statement month, which is what makes
  -- figures_date an honest sentence in the email.
  current_balance numeric(14,2),
  balance_as_at date,
  loan_ref text,
  lender_raw text,

  -- LOOKED UP BY HAND in version one. Domain, realestate.com.au, a desktop
  -- val. The source and the date are stored because an estimate without either
  -- is a number nobody can stand behind in three months.
  estimated_current_value numeric(14,2),
  valuation_source text,
  valuation_date date,

  -- Worked out on screen and written down, so the email and the review agree
  -- forever even if the rule behind it changes.
  usable_equity numeric(14,2),

  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists portfolio_review_properties_review_idx
  on public.portfolio_review_properties (review_id);
create index if not exists portfolio_review_properties_client_idx
  on public.portfolio_review_properties (client_id);


-- ===========================================================================
-- 5. WHAT HAPPENED, AND WHEN TO TRY AGAIN
-- ===========================================================================
--
-- The part that turns a mailout into a worklist. Most clients will not reply
-- to the email; the work is the phone calls afterwards. Without this the list
-- is useful once and then goes stale.

create table if not exists public.portfolio_review_contacts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.portfolio_reviews(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,

  happened_on date not null default current_date,
  kind text not null default 'call',
  constraint portfolio_review_contacts_kind_known check (kind in (
    'email', 'call', 'text', 'meeting', 'note'
  )),

  what text not null default '',
  -- Only on the attempt that got somewhere. Left null on "no answer".
  outcome text,

  -- WHEN TO TRY AGAIN. The list's "to chase today" count is this column.
  next_action_on date,

  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_review_contacts_review_idx
  on public.portfolio_review_contacts (review_id, happened_on desc);
create index if not exists portfolio_review_contacts_next_idx
  on public.portfolio_review_contacts (next_action_on) where next_action_on is not null;


-- ===========================================================================
-- 6. THE RULES THE DATABASE KEEPS, SO A SCREEN CANNOT FORGET THEM
-- ===========================================================================

create or replace function public.portfolio_reviews_hold_the_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  -- A CLOSED REVIEW ALWAYS COMES BACK. Fabio's rule, and the reason the whole
  -- thing is worth building: "not now" is almost never "not ever". Twelve
  -- months unless somebody chose a date.
  if new.status = 'closed' then
    if new.outcome is null then
      raise exception 'A closed review needs an outcome.';
    end if;
    if new.next_review_date is null then
      new.next_review_date := current_date + interval '12 months';
    end if;
  end if;

  -- The email names one property. It must be one of THIS review's.
  if new.equity_property_id is not null
     and not exists (
       select 1 from public.portfolio_review_properties p
       where p.id = new.equity_property_id and p.review_id = new.id
     ) then
    raise exception 'The equity property must be one of the properties on this review.';
  end if;

  -- SENT IS NOT A STATUS SOMEBODY TYPES. email_sent_at is written by the send
  -- route once the mail has actually gone; the status follows the fact rather
  -- than the other way round.
  if new.status = 'template_sent' and new.email_sent_at is null then
    raise exception 'Template sent is set by the send, not by hand.';
  end if;

  return new;
end;
$$;

drop trigger if exists portfolio_reviews_hold_the_rules on public.portfolio_reviews;
create trigger portfolio_reviews_hold_the_rules
  before insert or update on public.portfolio_reviews
  for each row execute function public.portfolio_reviews_hold_the_rules();


-- ===========================================================================
-- 7. WHO MAY DO WHAT
-- ===========================================================================
--
-- Reads and writes for anyone signed in, matching the rest of the portal: the
-- same team does the work, and the safeguard is that nothing can be deleted
-- and that what was sent is recorded by the server.
--
-- NO DELETE POLICY ON ANY OF THE THREE, on purpose. Row level security denies
-- what it is not told to allow, so the absence is the rule. A review that went
-- nowhere is closed, never removed - it is the record of a client we have
-- already contacted, which is exactly the thing we must not lose.

alter table public.portfolio_reviews            enable row level security;
alter table public.portfolio_review_properties  enable row level security;
alter table public.portfolio_review_contacts    enable row level security;

drop policy if exists portfolio_reviews_read on public.portfolio_reviews;
create policy portfolio_reviews_read on public.portfolio_reviews
  for select to authenticated using (true);
drop policy if exists portfolio_reviews_write on public.portfolio_reviews;
create policy portfolio_reviews_write on public.portfolio_reviews
  for insert to authenticated with check (true);
drop policy if exists portfolio_reviews_touch on public.portfolio_reviews;
create policy portfolio_reviews_touch on public.portfolio_reviews
  for update to authenticated using (true) with check (true);

drop policy if exists portfolio_review_properties_read on public.portfolio_review_properties;
create policy portfolio_review_properties_read on public.portfolio_review_properties
  for select to authenticated using (true);
drop policy if exists portfolio_review_properties_write on public.portfolio_review_properties;
create policy portfolio_review_properties_write on public.portfolio_review_properties
  for insert to authenticated with check (true);
drop policy if exists portfolio_review_properties_touch on public.portfolio_review_properties;
create policy portfolio_review_properties_touch on public.portfolio_review_properties
  for update to authenticated using (true) with check (true);

drop policy if exists portfolio_review_contacts_read on public.portfolio_review_contacts;
create policy portfolio_review_contacts_read on public.portfolio_review_contacts
  for select to authenticated using (true);
drop policy if exists portfolio_review_contacts_write on public.portfolio_review_contacts;
create policy portfolio_review_contacts_write on public.portfolio_review_contacts
  for insert to authenticated with check (true);
drop policy if exists portfolio_review_contacts_touch on public.portfolio_review_contacts;
create policy portfolio_review_contacts_touch on public.portfolio_review_contacts
  for update to authenticated using (true) with check (true);


-- ===========================================================================
-- 8. ONE ROW PER REVIEW, READY FOR THE LIST
-- ===========================================================================
--
-- The list screen needs the client, the property count, where it got to, and
-- when it is next due, and it must not load the whole book into a browser to
-- work them out. That is precisely how the Rate exposure and LVR exposure tabs
-- next door were built, and it is why a property value with a comma in it once
-- knocked rows off a report silently.
--
-- security_invoker IS NOT OPTIONAL. Without it the view runs as its creator and
-- hands every broker the whole book straight around the policies above.

create or replace view public.portfolio_review_list
with (security_invoker = true)
as
select
  r.id                       as review_id,
  r.client_id,
  c.first_name, c.last_name,
  c.email, c.phone,
  c.from_book,
  c.book_broker_key,
  c.portfolio_review_opt_out as opted_out,
  r.status, r.outcome,
  r.reviewed_at, r.next_review_date,
  r.figures_date,
  r.purchase_range_min, r.purchase_range_max,
  r.email_sent_at, r.linked_deal_id,
  (select count(*) from public.portfolio_review_properties p
     where p.review_id = r.id)                               as properties,
  (select count(*) from public.portfolio_review_properties p
     where p.review_id = r.id and p.investor)                as investment_properties,
  (select coalesce(sum(p.usable_equity), 0)
     from public.portfolio_review_properties p
     where p.review_id = r.id and p.investor)                as usable_equity,
  (select count(*) from public.portfolio_review_contacts t
     where t.review_id = r.id and t.kind = 'call')           as calls,
  (select max(t.happened_on) from public.portfolio_review_contacts t
     where t.review_id = r.id)                               as last_contact,
  -- THE ONE THE MONDAY LIST SORTS ON. The earliest thing waiting: a chase that
  -- is due, or the review coming round again.
  least(
    (select min(t.next_action_on) from public.portfolio_review_contacts t
       where t.review_id = r.id and t.next_action_on is not null),
    r.next_review_date
  )                                                          as due_on
from public.portfolio_reviews r
join public.clients c on c.id = r.client_id;


-- ===========================================================================
-- 9. THE WORDS THAT ARE NOT IN THE CODE
-- ===========================================================================
--
-- "Why I'm reaching out now" is market commentary. It will be wrong by March
-- and it must be changeable without a ship. It lives on the settings singleton
-- with everything else that is edited rather than written.

alter table public.settings
  add column if not exists portfolio_review_market_text text not null default '';

comment on column public.settings.portfolio_review_market_text is
  'The "Why I am reaching out now" paragraph in the portfolio review email. Edited in Settings, never in code.';


-- ===========================================================================
-- 10. WHAT IT LOOKS LIKE NOW. Reads only - nothing below changes anything.
-- ===========================================================================

select 'columns added to clients' as what, count(*) as how_many
from information_schema.columns
where table_schema = 'public' and table_name = 'clients'
  and column_name in ('from_book','book_broker_key','book_row_key','book_imported_at',
                      'book_import_run','portfolio_review_opt_out','opt_out_date');

select 'tables created' as what, count(*) as how_many
from information_schema.tables
where table_schema = 'public'
  and table_name in ('portfolio_reviews','portfolio_review_properties','portfolio_review_contacts');

select 'the list view answers' as what, count(*) as how_many
from public.portfolio_review_list;
