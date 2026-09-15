-- BRINGING STAGING UP TO DATE WITH PRODUCTION
--
-- 15 September 2026. The staging Supabase project has the core tables but its
-- schema stopped at roughly 17 August. Everything added since - row versions,
-- the history table that keeps overwritten work, internal notes, presence, the
-- document request recipient - was never applied to it.
--
-- This file is every schema script in docs/, in the order they were originally
-- run, concatenated. Each one was written to be safe to run twice, so running
-- the whole thing against a database that already has some of it is fine.
--
-- RUN THIS IN THE **STAGING** PROJECT'S SQL EDITOR. NOT PRODUCTION.
--
-- Two files are deliberately NOT included:
--   docs/rls_rollback_2026-08-19.sql - a rollback snapshot. It drops every
--     policy and recreates the ones from before the August security rewrite.
--     Running it would put OLD security rules on staging.
--   docs/migration-audit.sql - read only. Run it afterwards to confirm.
--
-- The only rows this deletes anywhere are presence heartbeats, which are
-- transient by design. No deal, client or document data is touched.
--
-- Generated from: 24 files.



-- ======================================================================
-- statements-schema.sql
-- ======================================================================

-- Statement analysis: two tables, run once in the Supabase SQL editor.
--
-- These hold client banking data. Visibility is not decided here twice: each
-- policy asks whether the signed-in user can see the deal, and the deals policy
-- answers. Row level security on deals applies inside that subquery, so a person
-- who cannot open a deal cannot read a single line of its statements.
--
-- Everything cascades from the deal. Deleting a deal deletes its statements.

create table if not exists public.deal_statement_uploads (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references public.deals(id) on delete cascade,
  file_name         text not null,
  source            text not null default 'cashdeck',
  uploaded_by       uuid references auth.users(id) on delete set null,
  uploaded_by_email text,
  uploaded_at       timestamptz not null default now(),
  client_name       text,
  period_from       date,
  period_to         date,
  days              integer,
  txn_count         integer,
  institutions      jsonb not null default '[]'::jsonb,
  accounts          jsonb not null default '[]'::jsonb,
  coverage_complete boolean,
  score             integer,
  analysis_version  integer not null default 1,
  analysis          jsonb not null default '{}'::jsonb
);

create table if not exists public.deal_statement_transactions (
  id               uuid primary key default gen_random_uuid(),
  upload_id        uuid not null references public.deal_statement_uploads(id) on delete cascade,
  deal_id          uuid not null references public.deals(id) on delete cascade,
  external_id      text,
  txn_date         date not null,
  description      text,
  merchant         text,
  account_number   text,
  account_name     text,
  institution      text,
  category         text,
  summary_category text,
  category_type    text,
  amount           numeric(14,2) not null
);

create index if not exists deal_statement_uploads_deal_idx
  on public.deal_statement_uploads (deal_id, uploaded_at desc);
create index if not exists deal_statement_txn_upload_idx
  on public.deal_statement_transactions (upload_id, txn_date);
create index if not exists deal_statement_txn_deal_idx
  on public.deal_statement_transactions (deal_id, txn_date);

alter table public.deal_statement_uploads      enable row level security;
alter table public.deal_statement_transactions enable row level security;

drop policy if exists "Statement uploads via deals" on public.deal_statement_uploads;
create policy "Statement uploads via deals"
  on public.deal_statement_uploads
  as permissive for all to authenticated
  using      (exists (select 1 from public.deals d where d.id = deal_statement_uploads.deal_id))
  with check (exists (select 1 from public.deals d where d.id = deal_statement_uploads.deal_id));

drop policy if exists "Statement transactions via deals" on public.deal_statement_transactions;
create policy "Statement transactions via deals"
  on public.deal_statement_transactions
  as permissive for all to authenticated
  using      (exists (select 1 from public.deals d where d.id = deal_statement_transactions.deal_id))
  with check (exists (select 1 from public.deals d where d.id = deal_statement_transactions.deal_id));

-- ---------------------------------------------------------------------------
-- Statement rules in Settings, and re-analysing without a re-upload.
-- Run this second, after the two tables above.
--
-- An analysis keeps the rules it was run under, so changing a threshold never
-- silently rewrites a file someone has already reviewed. parsed_meta holds the
-- account details and balances the transactions alone do not carry, which is
-- what lets a re-run rebuild the picture from the stored ledger.

alter table public.settings
  add column if not exists statement_rules jsonb;

alter table public.deal_statement_uploads
  add column if not exists rules         jsonb not null default '{}'::jsonb,
  add column if not exists parsed_meta   jsonb not null default '{}'::jsonb,
  add column if not exists reanalysed_at timestamptz;


-- ======================================================================
-- lo-flags-schema.sql
-- ======================================================================

-- Lending Options AI feedback loop (31 Aug 2026)
-- Run in the Supabase SQL editor. Safe to re-run.

-- Which stage a flag came from. Existing flags are all Compliance.
alter table public.compliance_flags
  add column if not exists stage text not null default 'compliance';

-- Promoted LO corrections. Kept separate from compliance_style_notes on purpose:
-- a correction about an LO recommendation must never change a Compliance answer.
alter table public.settings
  add column if not exists lo_style_notes jsonb;


-- ======================================================================
-- proceed-source-schema.sql
-- ======================================================================

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


-- ======================================================================
-- statement-answers-schema.sql
-- ======================================================================

-- Answers to the statement worklist (31 Aug 2026)
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- One row per answer. Kept against the DEAL, not the upload, so an answer
-- survives new statements being loaded and re-analysed — the whole point is that
-- a question already answered is never asked twice. upload_id is recorded for
-- provenance so it is possible to see that an answer predates the current file.
--
-- These are file notes for the credit team. Nothing here is passed to the AI or
-- written into an LO or compliance document.

create table if not exists public.deal_statement_answers (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  upload_id    uuid references public.deal_statement_uploads(id) on delete set null,
  item_key     text not null,
  reason_id    text not null,
  reason_label text not null,
  note         text,
  answered_by  text,
  answered_at  timestamptz not null default now()
);

create index if not exists deal_statement_answers_deal_idx
  on public.deal_statement_answers (deal_id, item_key, answered_at desc);

alter table public.deal_statement_answers enable row level security;

drop policy if exists "Statement answers via deals" on public.deal_statement_answers;
create policy "Statement answers via deals"
  on public.deal_statement_answers
  as permissive for all to authenticated
  using      (exists (select 1 from public.deals d where d.id = deal_statement_answers.deal_id))
  with check (exists (select 1 from public.deals d where d.id = deal_statement_answers.deal_id));


-- ======================================================================
-- statement-overrides-schema.sql
-- ======================================================================

-- Overruling a line in the Audit tab (31 Aug 2026)
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- The Audit tab was read-only, which made it half a tool: you could see that a
-- figure was wrong and then had to come back to have the code changed. These are
-- the corrections a person makes on the line itself.
--
-- `signature` is what the line IS — same day, same wording, same cents — so a
-- correction is not lost when a client re-sends their statements and CashDeck
-- renumbers the rows.
--
-- Standing "always treat this payer this way" rules live in
-- settings.statement_payer_rules, not here, because they apply to every client
-- and have to be visible and removable in one place.

create table if not exists public.deal_statement_overrides (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  upload_id   uuid references public.deal_statement_uploads(id) on delete set null,
  external_id text,
  signature   text,
  treat_as    text not null,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists deal_statement_overrides_deal_idx
  on public.deal_statement_overrides (deal_id, external_id);

alter table public.deal_statement_overrides enable row level security;

drop policy if exists "Statement overrides via deals" on public.deal_statement_overrides;
create policy "Statement overrides via deals"
  on public.deal_statement_overrides
  as permissive for all to authenticated
  using      (exists (select 1 from public.deals d where d.id = deal_statement_overrides.deal_id))
  with check (exists (select 1 from public.deals d where d.id = deal_statement_overrides.deal_id));

-- Standing corrections, applied to every file.
alter table public.settings
  add column if not exists statement_payer_rules jsonb;


-- ======================================================================
-- internal-notes-schema.sql
-- ======================================================================

-- One internal notes field per deal (1 Sep 2026)
-- Run in the Supabase SQL editor. Read the SELECT first, then the UPDATEs.
--
-- There were three boxes labelled "Internal notes" — Fact Find, BC and Lending
-- Options — each saving to a different place, none aware of the others, and none
-- at all on Compliance where the write-up is drafted. This makes it one field.
--
-- Counted before writing this: 13 deals with fact find notes, 4 with BC notes,
-- 1 with LO notes, and exactly 1 deal holding both fact find and BC notes. So at
-- most 5 deals are touched and only one needs its two notes joined.

-- 1. The column.
alter table public.deals
  add column if not exists internal_notes text;

-- 2. LOOK BEFORE YOU MOVE ANYTHING. This changes nothing; it shows what the
--    updates below will do to each deal.
select id, deal_name,
       length(coalesce(fact_find_data->>'internalNotes','')) as ff_len,
       length(coalesce(bc_data->>'internalNotes',''))        as bc_len,
       length(coalesce(lo_data->>'internalNotes',''))        as lo_len
from public.deals
where coalesce(fact_find_data->>'internalNotes','') <> ''
   or coalesce(bc_data->>'internalNotes','')        <> ''
   or coalesce(lo_data->>'internalNotes','')        <> ''
order by deal_name;

-- 3. Fact find notes move across as they are. Nothing is joined here because
--    nothing is being overwritten — internal_notes is empty on every deal.
update public.deals
set internal_notes = fact_find_data->>'internalNotes'
where coalesce(fact_find_data->>'internalNotes','') <> ''
  and coalesce(internal_notes,'') = '';

-- 4. BC notes. Where the deal already has notes they are joined with a line
--    saying where the text came from, so anyone reading it later knows it was
--    not always one box. Where it has none, the BC text simply becomes them.
update public.deals
set internal_notes = case
      when coalesce(internal_notes,'') = '' then bc_data->>'internalNotes'
      else internal_notes || E'\n\n— moved from the BC tab''s own notes, 1 Sep 2026 —\n' || (bc_data->>'internalNotes')
    end
where coalesce(bc_data->>'internalNotes','') <> '';

-- 5. Lending Options notes, same rule.
update public.deals
set internal_notes = case
      when coalesce(internal_notes,'') = '' then lo_data->>'internalNotes'
      else internal_notes || E'\n\n— moved from the Lending Options tab''s own notes, 1 Sep 2026 —\n' || (lo_data->>'internalNotes')
    end
where coalesce(lo_data->>'internalNotes','') <> '';

-- 6. Check it landed. Every deal that had notes anywhere should now have them here.
select count(*) filter (where coalesce(internal_notes,'') <> '') as deals_with_notes
from public.deals;

-- The old fact_find_data/bc_data/lo_data internalNotes keys are deliberately left
-- in place. They cost nothing, and they are the only copy of what the text looked
-- like before the move if anything needs checking.


-- ======================================================================
-- deal-phase-schema.sql
-- ======================================================================

-- The deal board: one canonical phase (1 Sep 2026)
-- Run in the Supabase SQL editor. Read step 2 before running step 3.
--
-- Pushing compliance to SalesTrekker used to set status = 'completed', and the
-- deals list hides anything completed. So a loan vanished the moment compliance
-- went out — before it was lodged, approved or settled. On 1 Sep 2026 that was
-- NINE of twenty-one deals, none of them lodged, the oldest eight business days
-- old, with no way to tell a loan progressing nicely from one that had fallen over.
--
-- A deal is now finished when it SETTLES or when it DIES. Nothing else is an ending.

-- 1. When compliance actually went out.
alter table public.deals
  add column if not exists compliance_sent_at timestamptz;

-- 2. LOOK FIRST. Every deal the old rule marked completed. These are the nine.
--    They are about to reappear on the board in the "Compliance sent" column.
select deal_name,
       compliance_completed_at::date as compliance_done,
       lodged_at::date, preapproval_at::date, formal_approval_at::date, settled_at::date
from public.deals
where status = 'completed'
order by compliance_completed_at;

-- 3. Backfill. The date compliance was finished is the best record we have of when
--    it was sent — they happened in the same action.
update public.deals
set compliance_sent_at = coalesce(compliance_sent_at, compliance_completed_at)
where status = 'completed'
  and compliance_completed_at is not null;

-- 4. Retire the status. A deal that genuinely settled keeps its settled_at and is
--    read as settled from that; nothing else was ever really complete.
update public.deals
set status = 'in_progress'
where status = 'completed'
  and settled_at is null;

-- 5. Check. Nine deals should now carry a compliance_sent_at and no longer be
--    hidden, and nothing should still be sitting on the retired status.
select
  count(*) filter (where compliance_sent_at is not null) as compliance_sent,
  count(*) filter (where status = 'completed')           as still_completed,
  count(*) filter (where status = 'lost')                as lost,
  count(*) filter (where settled_at is not null)         as settled
from public.deals;


-- ======================================================================
-- deal-board-schema.sql
-- ======================================================================

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


-- ======================================================================
-- settled-amount-schema.sql
-- ======================================================================

-- Lodged and settled amounts get their own boxes, and the existing deals are
-- repaired from the snapshots that already hold the truth.
-- Fabio, 1 Sep 2026. Run in the Supabase SQL editor.
--
-- WHY: a loan's amount changes all the way along - BC, LO, compliance, lodged,
-- formal. Two of those are kept forever: what was LODGED and what SETTLED.
-- Commission is paid on what settled.
--
-- What was actually happening: all three of Mark as lodged, Mark as settled and
-- the Lending options autosave wrote the same single column, loan_amount.
-- Whichever ran last won. The LO autosave had no dirty flag either, so merely
-- OPENING the Lending options tab on a settled deal replaced what settled with
-- the old estimate 700 milliseconds later - and every screen that reports
-- settled volume falls through to loan_amount, so all of them would have
-- silently changed.
--
-- The four columns below are read in eight places (the pipeline, broker targets,
-- monthly actuals, the settlements list, the commission panel, the reconcile
-- screen, amountOf and the commission calculation) and were written in none.

-- 1. The boxes.
alter table deals add column if not exists lodged_total   numeric;
alter table deals add column if not exists lodged_splits  jsonb;
alter table deals add column if not exists settled_total  numeric;
alter table deals add column if not exists settled_splits jsonb;

-- 2. The repair. Every Mark as lodged and Mark as settled already wrote a
--    snapshot with the real total and every split, so nothing was ever lost -
--    no screen was reading it. Copying it onto the deal fills the columns that
--    every reader prefers, which also CORRECTS any deal whose loan_amount was
--    already overwritten by an opened LO.
update deals d
set lodged_total  = s.total_amount,
    lodged_splits = s.splits
from deal_stage_snapshots s
where s.deal_id = d.id
  and s.stage = 'lodged'
  and d.lodged_total is null;

update deals d
set settled_total  = s.total_amount,
    settled_splits = s.splits
from deal_stage_snapshots s
where s.deal_id = d.id
  and s.stage = 'settled'
  and d.settled_total is null;

-- 3. What the repair did. Any row where these disagree was a deal displaying
--    the wrong amount until a moment ago.
select d.deal_name,
       d.lodged_total,
       d.settled_total,
       d.loan_amount,
       d.settled_total - d.loan_amount as was_out_by
from deals d
where d.settled_total is not null
  and d.settled_total is distinct from d.loan_amount
order by abs(d.settled_total - d.loan_amount) desc;


-- ======================================================================
-- notes-alerts-schema.sql
-- ======================================================================

-- File notes, alerts, and the finance clause date.
-- Fabio, 1 Sep 2026. Run in the Supabase SQL editor BEFORE deploying.
--
-- Three kinds of note, split by HOW THEY END - not by how they feel:
--   pinned  never ends. It is deals.internal_notes, which already exists.
--   note    ends the moment it is written. That is deal_notes below.
--   alert   ends when somebody resolves it, or its date passes. deal_alerts.
--
-- An "urgent" tickbox nobody ever unticks turns everything red inside a month
-- and the colour stops meaning anything, so urgency has an end built into it.

-- 1. The finance clause. On a purchase this is the date the client loses their
--    deposit if finance is not approved, and the portal has never held it.
alter table deals add column if not exists finance_clause_date date;

-- 2. The file note log. Append only - nothing is ever overwritten, because the
--    history is the whole value when a lender disputes a timeline or a client
--    says nobody called them.
create table if not exists deal_notes (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deals(id) on delete cascade,
  body        text not null,
  -- 'note' typed by a person, 'system' written by the portal (lodged, unlocked).
  kind        text not null default 'note',
  author_id   uuid,
  author_name text,
  created_at  timestamptz not null default now()
);
create index if not exists deal_notes_deal_idx on deal_notes(deal_id, created_at desc);

-- 3. Alerts. An alert must have an owner and a way to close it, or it is just a
--    note in red.
create table if not exists deal_alerts (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deals(id) on delete cascade,
  title       text not null,
  owner_name  text,
  due_on      date,
  resolved_at timestamptz,
  resolved_by text,
  author_id   uuid,
  author_name text,
  created_at  timestamptz not null default now()
);
create index if not exists deal_alerts_deal_idx on deal_alerts(deal_id) where resolved_at is null;

-- 4. Row level security. Without this, both tables are readable by anyone with
--    the anon key. Visibility follows the DEAL: the subquery runs as the signed
--    in user, so the existing policies on deals decide it and there is no second
--    copy of those rules to drift.
alter table deal_notes  enable row level security;
alter table deal_alerts enable row level security;

drop policy if exists deal_notes_rw on deal_notes;
create policy deal_notes_rw on deal_notes
  for all to authenticated
  using      (exists (select 1 from deals d where d.id = deal_notes.deal_id))
  with check (exists (select 1 from deals d where d.id = deal_notes.deal_id));

drop policy if exists deal_alerts_rw on deal_alerts;
create policy deal_alerts_rw on deal_alerts
  for all to authenticated
  using      (exists (select 1 from deals d where d.id = deal_alerts.deal_id))
  with check (exists (select 1 from deals d where d.id = deal_alerts.deal_id));


-- ======================================================================
-- deal-stages-schema.sql
-- ======================================================================

-- Three more stages, and a place to remember folded board columns.
-- Run in the Supabase SQL editor. Safe to run twice.
--
-- WHY
--
-- Offer accepted was a whole process inside Preapproved that the board could not
-- see: a client whose offer on a property had been accepted - with a price and a
-- settlement date - looked identical to a client still house hunting.
--
-- Contracts returned and Settlement booked were `settlement_step`, ONE column
-- holding ONE of them, with no date, visible only inside the Settlement panel.
-- Three things were wrong with that. They are not exclusive - a deal can have
-- its contracts back and its settlement booked. Nothing recorded WHEN either
-- happened, so loan docs could sit returned for three weeks unnoticed. And on
-- the board those deals looked exactly like a deal formally approved this
-- morning.
--
-- settlement_step is kept and still written, because the settlements board reads
-- it for its chip. It now holds the FURTHEST of the two.

alter table deals add column if not exists offer_accepted_at      timestamptz;
alter table deals add column if not exists contracts_returned_at  timestamptz;
alter table deals add column if not exists settlement_booked_at   timestamptz;

-- Which board columns this person has folded away. Per person: a fold is a view,
-- never a setting, and one person hiding a column must not hide it for anybody
-- else. An empty array, or no column at all, means nothing is folded.
alter table user_profiles add column if not exists board_folds jsonb not null default '[]'::jsonb;

-- The backfill.
--
-- Deals already carrying a step get a date, taken from when the settlement team
-- last touched the record. That is the closest thing to the truth that exists -
-- the step itself was never dated - and it is better than leaving these deals
-- sitting in Formal on a board that now has a column for exactly where they are.
--
-- Only the step actually recorded is filled in. A deal marked 'settlement_booked'
-- does NOT get a contracts_returned_at: the old field could only hold one of the
-- two, so we do not know whether the contracts came back, and inventing a date
-- for a thing nobody recorded is how a board starts lying.
update deals
   set contracts_returned_at = coalesce(settlement_updated_at, formal_approval_at, lodged_at)
 where settlement_step = 'contracts_returned'
   and contracts_returned_at is null;

update deals
   set settlement_booked_at = coalesce(settlement_updated_at, formal_approval_at, lodged_at)
 where settlement_step = 'settlement_booked'
   and settlement_booked_at is null;

-- What the backfill did, and what is now on the board.
select settlement_step,
       count(*)                                              as deals,
       count(contracts_returned_at)                          as have_contracts_date,
       count(settlement_booked_at)                           as have_booked_date
  from deals
 where settled_at is null
 group by settlement_step
 order by settlement_step nulls first;


-- ======================================================================
-- handover-schema.sql
-- ======================================================================

-- What credit is asked when a deal is pushed to SalesTrekker, and the urgency
-- that comes out of it. Run in the Supabase SQL editor. Safe to run twice.
--
-- These questions were being asked in Slack, in email, or not at all - and the
-- answers decide what the credit team does first. They live on the deal now, so
-- a second push does not start from a blank form and nothing is asked twice.

alter table deals add column if not exists push_answers jsonb;

-- Urgency is two real columns rather than a key inside push_answers, because the
-- BOARD reads them on every card to decide the order. A sort that has to parse
-- JSON on every deal is a sort that gets quietly dropped later.
alter table deals add column if not exists is_urgent boolean not null default false;
alter table deals add column if not exists compliance_needed_by date;

-- The flag ends at lodgement, and that is enforced in code (isUrgentNow) rather
-- than by a job that clears the column - a deal that is un-lodged by mistake
-- should get its flag back, and a nightly sweep could not give it back.
create index if not exists deals_urgent_idx on deals (is_urgent) where is_urgent;

-- Ownership of the security - who goes on the title, why a borrower is not on
-- it, and where independent legal advice stands - lives inside compliance_data
-- as `title`. That column is already jsonb, so there is nothing to add for it.

select count(*) filter (where is_urgent) as urgent_now,
       count(*) filter (where push_answers is not null) as have_push_answers,
       count(*) as deals
  from deals;


-- ======================================================================
-- handover-progress-schema.sql
-- ======================================================================

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


-- ======================================================================
-- lender-fee-wording.sql
-- ======================================================================

-- WHAT EACH BANK CALLS THE FEE CHARGED AT SETTLEMENT.
--
-- The portal called it "Legal fee" everywhere, which is Bankwest's word for it.
-- Almost every other lender says "settlement fee", and a few charge nothing
-- beyond the government registration fees. A lending options email that says
-- "Legal fee: $200" against CBA names a fee the client will not find on CBA's
-- own paperwork.
--
-- Fabio, 2 Sep 2026, with the list below: "any chance you can change the wording
-- on the library for all banks so I dotn ahve to do one by one".
--
-- The wording lives on the LENDER, so every product underneath it inherits it.
-- Null means "Legal fee", which is what every lender said before this existed -
-- so a lender not listed here is unchanged.

alter table lenders add column if not exists legal_fee_label text;

comment on column lenders.legal_fee_label is
  'What this lender calls the fee charged at settlement - "Settlement fee" for most, "Legal fee" for Bankwest. Null means Legal fee. Shown on the lending options email, the fact find and the handover.';

-- ---------------------------------------------------------------------------
-- STEP 1 - the wording, from Fabio's list.
--
-- Matched on the name as the library holds it, case-insensitively and ignoring
-- full stops, so "St George" and "St.George" both match. Run it and read the
-- count it reports: if a lender is named differently in your library it will not
-- be updated, and the SELECT underneath shows which.
-- ---------------------------------------------------------------------------
update lenders set legal_fee_label = 'Settlement fee'
where regexp_replace(lower(name), '[^a-z]', '', 'g') in (
  'cba', 'anz', 'stgeorge', 'ing', 'westpac', 'suncorp', 'bankofmelbourne',
  'bankaustralia', 'macquarie', 'mebank', 'nab', 'ubank'
);

update lenders set legal_fee_label = 'Legal fee'
where regexp_replace(lower(name), '[^a-z]', '', 'g') = 'bankwest';

-- Which lenders in your library still have no wording set. Anything on Fabio's
-- list that appears here is named differently in the library - fix the name or
-- set the wording by hand in Settings -> Lender library.
select name, coalesce(legal_fee_label, 'Legal fee (default)') as calls_it
from lenders
order by legal_fee_label nulls first, name;

-- ---------------------------------------------------------------------------
-- STEP 2 - the amounts. OPTIONAL, and destructive: it overwrites the fee on
-- EVERY product of that lender. Only run it if the fee really is the same across
-- all of a bank's products. Check what you have first:
--
--   select l.name, p.product_name, p.legal_fee
--   from lender_products p join lenders l on l.id = p.lender_id
--   order by l.name, p.product_name;
--
-- Then uncomment the ones you want.
-- ---------------------------------------------------------------------------
-- update lender_products p set legal_fee = v.fee from (values
--   ('bankwest',        '$350'),
--   ('cba',             '$200'),
--   ('anz',             '$160'),
--   ('stgeorge',        '$100'),
--   ('ing',             '$350'),
--   ('westpac',         '$100'),
--   ('suncorp',         'None - government fees only'),
--   ('bankofmelbourne', '$100'),
--   ('bankaustralia',   'None - government fees only'),
--   ('macquarie',       '$350'),
--   ('mebank',          '$150'),
--   ('nab',             'None - government registration fees only'),
--   ('ubank',           '$250')
-- ) as v(slug, fee)
-- where p.lender_id in (
--   select id from lenders where regexp_replace(lower(name), '[^a-z]', '', 'g') = v.slug
-- );


-- ======================================================================
-- docs-received-schema.sql
-- ======================================================================

-- DOCUMENTS RECEIVED, AND THE GAP BEFORE THE ASSESSOR IS TOLD.
--
-- One press on the Lending options tab emails the person who files the documents
-- straight away, and the credit assessor half an hour later. The wait exists
-- because telling both at once sends the assessor to a folder full of
-- IMG_4471.jpg. Fabio, 2 Sep 2026: "how about we delay message to credit by 30
-- min normally the time cris to label docs".
--
-- The wait is held by Resend, not by us: the assessor's email is handed over at
-- the moment the button is pressed, with the time it should go. Nothing of ours
-- has to still be awake half an hour later.

alter table deals add column if not exists docs_received_at timestamptz;
alter table deals add column if not exists docs_received_by text;
alter table deals add column if not exists docs_assessor_due_at timestamptz;
alter table deals add column if not exists docs_assessor_email_id text;

comment on column deals.docs_received_at is
  'When the client''s supporting documents were marked received. Claimed atomically, so two people pressing at once send one pair of emails.';
comment on column deals.docs_received_by is
  'Who marked them received.';
comment on column deals.docs_assessor_due_at is
  'When Resend will send the assessor "the documents are ready". Null with docs_received_at set means the send could not be queued - the deal shows that in red.';
comment on column deals.docs_assessor_email_id is
  'Resend''s id for that queued email, so it can be called off while it is still in the future.';

-- Settings: who files, and how long the gap is. Both changeable in
-- Settings -> Notifications without a code change. There is deliberately no
-- setting for who hears second: it is always the credit officer allocated to the
-- deal, and a deal without one cannot be marked at all.
alter table settings add column if not exists docs_file_notification_user_id uuid;
alter table settings add column if not exists docs_delay_minutes integer default 30;

comment on column settings.docs_file_notification_user_id is
  'Who is emailed to rename and file the documents, the moment they are marked received.';
comment on column settings.docs_delay_minutes is
  'Minutes between the two emails. 30 by default, 0 sends both at once, capped at 240.';


-- ======================================================================
-- phase-override-schema.sql
-- ======================================================================

-- PUTTING A DEAL BACK IN FACT FIND BY HAND.
--
-- Every other backwards move on the board clears a timestamp - the pre-approval
-- date, the lodgement date - because that timestamp is the only reason the deal
-- had moved on. Fact Find is the exception: a deal leaves it because somebody
-- typed into the fact find, and no card dropped on a board should delete a
-- client's answers.
--
-- Fabio, 3 Sep 2026: "if I wanna drag a deal card from BC back to fact find, I
-- need it to happen. Just make it happen."
--
-- The old `deals.stage` column was exactly this idea done badly - a string
-- written from six places that drifted until the board had to stop reading it.
-- This one stays honest three ways: it can only move a deal BACKWARDS, it
-- records the phase the deal was in when it was set so it expires by itself the
-- moment the deal genuinely moves on, and the card says it was placed by hand.

alter table deals add column if not exists phase_override text;
alter table deals add column if not exists phase_override_from text;
alter table deals add column if not exists phase_override_at timestamptz;

comment on column deals.phase_override is
  'A board column somebody dragged this deal into, when nothing could be cleared to put it there. Backwards only. Ignored once phase_override_from stops matching the deal''s derived phase.';
comment on column deals.phase_override_from is
  'The derived phase at the moment the card was placed. When the deal moves on, this stops matching and the override is ignored - so a hand placement can never hide a deal in the wrong column indefinitely.';

comment on column deals.phase_override_at is
  'When the card was placed. Any work recorded after this ends the placement - a hand move never suspends the rules, it only survives while nothing has happened.';


-- ======================================================================
-- fact-find-documents-schema.sql
-- ======================================================================

-- GROUNDWORK FOR THE DOCUMENT REQUEST LIST.
--
-- Two of the three changes need no migration at all: residency, the deposit
-- source, the self-employed structure, the "Shares" asset type and the tidied
-- other-income list all live inside deals.fact_find_data, which is one jsonb
-- column that already exists. Nothing has to be added for them, and nothing
-- already saved is touched - a deal written before today simply has no answer
-- to the new questions, and the checklist says so rather than guessing.
--
-- The one real column is on the lender library.

-- WHAT A BANK CALLS ITSELF ON A STATEMENT.
--
-- The statement analysis reports institutions as short codes - "CBA", "ING" -
-- while the fact find records the lender's full name from this same library.
-- Nothing could match the two, so a client's statements could never be used to
-- cross a document off the request list. This is the translation, kept where
-- the team already maintains lenders rather than buried in code.
--
-- Comma separated, because one bank arrives under more than one code.
alter table lenders add column if not exists statement_codes text;

comment on column lenders.statement_codes is
  'What this lender appears as on a bank statement, comma separated (e.g. "CBA, CommBank"). Used to tell whether a client''s loaded statements already cover an account, so the document request list can cross it off.';


-- ======================================================================
-- document-requests-schema.sql
-- ======================================================================

-- WHAT A PERSON DECIDED ABOUT THE DOCUMENT LIST.
--
-- The list of documents itself is NOT stored. It is worked out from the fact
-- find every time the page is opened (lib/document-rules.ts), so changing a
-- client from PAYG to self-employed changes what we ask them for. A list saved
-- when the fact find was filled in would be wrong by the afternoon.
--
-- This column holds only the small number of things a human decided, which no
-- rule could know:
--
--   {
--     "decisions": {
--       "<item key>": { "ticked": true, "at": "<iso>", "by": "<full name>" }
--     },
--     "added": [
--       { "key": "added:...", "label": "Accountant's letter",
--         "forWhat": "lodge", "at": "<iso>", "by": "<full name>" }
--     ]
--   }
--
-- Keys are derived and stable - "payslips:<applicant id>", "rates:<property
-- id>". A key that no longer appears in the list is simply ignored, so deleting
-- a liability takes its row away and cannot break the page. Same shape and same
-- reasoning as deals.handover_progress.
alter table deals add column if not exists document_progress jsonb;

comment on column deals.document_progress is
  'Human decisions about the document request list: which rows were ticked or unticked, and any documents added by hand. The list itself is derived from fact_find_data and never stored.';


-- ======================================================================
-- credit-officer-phone-schema.sql
-- ======================================================================

-- THE NUMBER A BANK'S ASSESSOR RINGS.
--
-- The broker notes that go into a lender's application portal open with a line
-- telling the assessor who to call about this file. The habit was to paste a
-- block with every credit assessor's name and number in it and leave the bank
-- to work out which one. Fabio, 3 Sep 2026: "we're smarter than that. You know
-- who the assessor is."
--
-- We do - deals.assigned_credit_officer already says which one. What was missing
-- was somewhere to keep their phone number, so this is it. Maintained in
-- Settings, Credit team, beside the name, rather than written into the code:
-- a number in the code is a number nobody can fix at 6pm on a Friday.
--
-- Safe to run twice. Nothing already stored is touched.

alter table credit_officers
  add column if not exists phone text;

comment on column credit_officers.phone is
  'Direct number for this credit assessor. Printed at the top of the broker notes that go to the lender.';


-- ======================================================================
-- deal-presence-schema.sql
-- ======================================================================

-- WHO ELSE IS IN THIS DEAL CARD.
--
-- One row per person per deal, rewritten every twenty seconds while their deal
-- page is open. Anybody whose row has not been touched for a minute has closed
-- the tab and stops being shown.
--
-- Fabio, 4 Sep 2026: "I like the warning saying someone is on this deal card...
-- I don't wanna lock it to the point that they can't edit, but it will say."
--
-- This LOCKS NOTHING. It is read to draw a banner and for no other purpose. The
-- only thing that ever refuses a write is the save guard in lib/save-conflict.ts,
-- and only at the moment somebody's work would actually be lost.
--
-- The tab matters: each tab writes its own jsonb column, so two people on
-- different tabs cannot touch each other's work. The banner says which tab, so
-- the usual answer is "you two are fine".
--
-- Safe to run twice. Nothing already stored is touched.

create table if not exists deal_presence (
  deal_id    uuid not null references deals(id) on delete cascade,
  user_id    uuid not null,
  full_name  text,
  tab        text,
  last_seen  timestamptz not null default now(),
  primary key (deal_id, user_id)
);

create index if not exists deal_presence_deal_idx on deal_presence (deal_id, last_seen desc);

alter table deal_presence enable row level security;

-- Everybody signed in can see who is in a deal, and write only their own row.
-- Presence is not sensitive - it is a name and a tab - and the whole point is
-- that colleagues can see each other.
drop policy if exists deal_presence_read on deal_presence;
create policy deal_presence_read on deal_presence
  for select to authenticated using (true);

drop policy if exists deal_presence_write_own on deal_presence;
create policy deal_presence_write_own on deal_presence
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists deal_presence_update_own on deal_presence;
create policy deal_presence_update_own on deal_presence
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists deal_presence_delete_own on deal_presence;
create policy deal_presence_delete_own on deal_presence
  for delete to authenticated using (user_id = auth.uid());

comment on table deal_presence is
  'Advisory only. Who has a deal card open, refreshed every 20s, stale after 60s. Locks nothing.';


-- ======================================================================
-- deal-row-version.sql
-- ======================================================================

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


-- ======================================================================
-- deal-last-saved-by.sql
-- ======================================================================

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


-- ======================================================================
-- deal-history.sql
-- ======================================================================

-- THE PORTAL REMEMBERS WHAT IT REPLACED.
--
-- Alexis_Janes_INV_Preapp_2026, 7 Sep 2026. A finished BC was replaced by an
-- almost empty one. The work was not recoverable from anywhere: the daily backup
-- was taken hours before it was typed, point in time recovery is not on the
-- plan, and every save in this portal overwrites what was there with no copy
-- kept. Fabio: "I cannot have the basic data be lost moving forward."
--
-- That was the real hole. Not the bug that emptied the form - the fact that ONE
-- bad save was permanent. Nothing else in this codebase can promise that a save
-- is always correct. This can promise that a wrong one costs a minute.
--
-- Every whole-record save writes the version it is about to replace in here
-- first. The record itself carries on being the single live copy; this is the
-- pile of everything it used to be.
--
-- IT DOES NOT KEEP EVERY KEYSTROKE. The tabs autosave a second after any change,
-- so keeping all of them would be tens of thousands of near identical rows. It
-- keeps a version every few minutes, and ALWAYS keeps one when a save is about
-- to remove content - which is the only case anybody ever wants back.
--
-- Safe to run twice. Nothing already stored is touched.

create table if not exists deal_history (
  id            bigserial primary key,
  deal_id       uuid not null references deals(id) on delete cascade,
  -- 'bc_data', 'fact_find_data', 'lo_data', 'compliance_data'.
  column_name   text not null,
  -- What the record held BEFORE the save that created this row.
  data          jsonb,
  -- Roughly how much was filled in, so a person scanning the list can see at a
  -- glance which version is the full one. Written by the app, not computed here,
  -- so it counts the same way the app does.
  filled        integer,
  replaced_at   timestamptz not null default now(),
  replaced_by   uuid,
  replaced_by_name text
);

create index if not exists deal_history_deal_idx
  on deal_history (deal_id, column_name, replaced_at desc);

alter table deal_history enable row level security;

-- Everybody signed in can read the history of a deal and add to it. It is the
-- same information as the deal itself, one step older.
drop policy if exists deal_history_read on deal_history;
create policy deal_history_read on deal_history
  for select to authenticated using (true);

drop policy if exists deal_history_write on deal_history;
create policy deal_history_write on deal_history
  for insert to authenticated with check (true);

comment on table deal_history is
  'What each deal tab held before it was last saved over. Written by lib/deal-history.ts on every whole-record save. Nothing here is ever read by the app automatically - it exists so a lost afternoon costs a minute.';


-- ======================================================================
-- deal-presence-v2.sql
-- ======================================================================

-- WHO IS IN A DEAL, TOLD HONESTLY.
--
-- The first version of this table kept one row PER PERSON PER DEAL, deleted the
-- old row when somebody moved on, and let each browser decide who had gone
-- stale using its own clock. On 8 Sep 2026 it held twenty two rows: Ellie on
-- eight deals at once, Katie on four, one row four and a half days old. Nobody
-- had been in eight deals. The deletes were simply not landing, and the only
-- thing that ever cleared a ghost was making the person log out.
--
-- Fabio, 8 Sep 2026: "I need to understand that if Katie or anyone now changes
-- deal card is this going to register she is NOT on the deal?"
--
-- Three changes, so the answer is yes and stays yes:
--
--   1. ONE ROW PER PERSON. A person is in one deal at a time, so moving to
--      another deal OVERWRITES their row. There is nowhere for an old row to
--      live, so a leftover is not something that can fail - it is something
--      that cannot exist.
--
--   2. THE DATABASE STAMPS THE TIME, AND THE DATABASE DECIDES WHO HAS GONE.
--      Five laptops with five clocks cannot agree on what "a minute ago" means.
--      One clock can.
--
--   3. THE TABLE SWEEPS ITSELF. Every heartbeat clears anything older than a
--      day, so it can never silt up again.
--
-- Safe to run twice.

-- --- 1. one row per person ---------------------------------------------------

-- Keep only each person's most recent row before the key changes under them.
delete from deal_presence a
  using deal_presence b
 where a.user_id = b.user_id
   and a.last_seen < b.last_seen;

alter table deal_presence drop constraint if exists deal_presence_pkey;
alter table deal_presence add primary key (user_id);

-- --- 2. the heartbeat, stamped by the server ---------------------------------

create or replace function presence_beat(p_deal uuid, p_tab text, p_name text)
returns void
language plpgsql
as $$
begin
  insert into deal_presence (user_id, deal_id, full_name, tab, last_seen)
  values (auth.uid(), p_deal, p_name, p_tab, now())
  on conflict (user_id) do update
    set deal_id   = excluded.deal_id,
        full_name = excluded.full_name,
        tab       = excluded.tab,
        last_seen = now();

  -- Costs nothing and means the table can never silt up again.
  delete from deal_presence where last_seen < now() - interval '1 day';
end $$;

-- --- 3. who else is here, decided by the server clock ------------------------

create or replace function presence_others(p_deal uuid)
returns table (user_id uuid, full_name text, tab text, seconds_ago integer)
language sql
stable
as $$
  select p.user_id, p.full_name, p.tab,
         floor(extract(epoch from (now() - p.last_seen)))::integer
    from deal_presence p
   where p.deal_id = p_deal
     and p.user_id <> auth.uid()
     and p.last_seen > now() - interval '60 seconds'
   order by p.last_seen desc
$$;

-- --- leaving, when the browser gets the chance to say so ---------------------
--
-- Not relied on. A closed laptop never calls it, which is exactly why the
-- sixty second expiry above is the real mechanism. This just makes the common
-- case instant.
create or replace function presence_leave()
returns void
language sql
as $$
  delete from deal_presence where user_id = auth.uid();
$$;

grant execute on function presence_beat(uuid, text, text) to authenticated;
grant execute on function presence_others(uuid)           to authenticated;
grant execute on function presence_leave()                to authenticated;

comment on table deal_presence is
  'One row per person: which deal they have open, which tab, and when they were last really there. Stamped and expired by the server clock only - see docs/deal-presence-v2.sql. Advisory. Locks nothing.';
