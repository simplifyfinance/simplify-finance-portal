-- WHICH MIGRATIONS ARE ACTUALLY LIVE?
--
-- Every .sql file in docs/ is written to be safe to run twice ("add column if
-- not exists"), so the honest way to find out what has been applied is to ask
-- the database rather than to remember. This asks.
--
-- READ ONLY. It creates nothing, changes nothing and drops nothing. Paste it
-- into the Supabase SQL editor and run it.
--
-- Anything listed as MISSING means that docs/<file> has not been run against
-- this database yet. Run that file, then run this again and it should be clean.
-- A file with no rows at all below has nothing to check - see the note at the
-- bottom for the ones that only touch policies or jsonb.

with expected(file, kind, tbl, col) as (values
  ('deal-board-schema.sql',           'column', 'brokers',                 'colour'),
  ('deal-board-schema.sql',           'column', 'settings',                'deal_board'),
  ('deal-phase-schema.sql',           'column', 'deals',                   'compliance_sent_at'),
  ('deal-stages-schema.sql',          'column', 'deals',                   'offer_accepted_at'),
  ('deal-stages-schema.sql',          'column', 'deals',                   'contracts_returned_at'),
  ('deal-stages-schema.sql',          'column', 'deals',                   'settlement_booked_at'),
  ('deal-stages-schema.sql',          'column', 'user_profiles',           'board_folds'),
  ('docs-received-schema.sql',        'column', 'deals',                   'docs_received_at'),
  ('docs-received-schema.sql',        'column', 'deals',                   'docs_received_by'),
  ('docs-received-schema.sql',        'column', 'deals',                   'docs_assessor_due_at'),
  ('docs-received-schema.sql',        'column', 'deals',                   'docs_assessor_email_id'),
  ('docs-received-schema.sql',        'column', 'settings',                'docs_file_notification_user_id'),
  ('docs-received-schema.sql',        'column', 'settings',                'docs_delay_minutes'),
  ('document-requests-schema.sql',    'column', 'deals',                   'document_progress'),
  ('fact-find-documents-schema.sql',  'column', 'lenders',                 'statement_codes'),
  ('handover-progress-schema.sql',    'column', 'deals',                   'handover_progress'),
  ('handover-schema.sql',             'column', 'deals',                   'push_answers'),
  ('handover-schema.sql',             'column', 'deals',                   'is_urgent'),
  ('handover-schema.sql',             'column', 'deals',                   'compliance_needed_by'),
  ('internal-notes-schema.sql',       'column', 'deals',                   'internal_notes'),
  ('lender-fee-wording.sql',          'column', 'lenders',                 'legal_fee_label'),
  ('lo-flags-schema.sql',             'column', 'compliance_flags',        'stage'),
  ('lo-flags-schema.sql',             'column', 'settings',                'lo_style_notes'),
  ('notes-alerts-schema.sql',         'table',  'deal_notes',              null),
  ('notes-alerts-schema.sql',         'table',  'deal_alerts',             null),
  ('notes-alerts-schema.sql',         'column', 'deals',                   'finance_clause_date'),
  ('phase-override-schema.sql',       'column', 'deals',                   'phase_override'),
  ('phase-override-schema.sql',       'column', 'deals',                   'phase_override_from'),
  ('phase-override-schema.sql',       'column', 'deals',                   'phase_override_at'),
  ('proceed-source-schema.sql',       'column', 'deals',                   'proceeded_source'),
  ('proceed-source-schema.sql',       'column', 'deals',                   'proceeded_by'),
  ('proceed-source-schema.sql',       'column', 'deals',                   'lo_proceeded_source'),
  ('proceed-source-schema.sql',       'column', 'deals',                   'lo_proceeded_by'),
  ('settled-amount-schema.sql',       'column', 'deals',                   'lodged_total'),
  ('settled-amount-schema.sql',       'column', 'deals',                   'lodged_splits'),
  ('settled-amount-schema.sql',       'column', 'deals',                   'settled_total'),
  ('settled-amount-schema.sql',       'column', 'deals',                   'settled_splits'),
  ('statement-answers-schema.sql',    'table',  'deal_statement_answers',  null),
  ('statement-overrides-schema.sql',  'table',  'deal_statement_overrides', null),
  ('statement-overrides-schema.sql',  'column', 'settings',                'statement_payer_rules'),
  ('statements-schema.sql',           'table',  'deal_statement_uploads',  null),
  ('statements-schema.sql',           'table',  'deal_statement_transactions', null),
  ('statements-schema.sql',           'column', 'settings',                'statement_rules'),
  ('statements-schema.sql',           'column', 'deal_statement_uploads',  'rules'),
  ('statements-schema.sql',           'column', 'deal_statement_uploads',  'parsed_meta'),
  ('statements-schema.sql',           'column', 'deal_statement_uploads',  'reanalysed_at')
),

checked as (
  select
    e.file,
    case when e.kind = 'table' then e.tbl else e.tbl || '.' || e.col end as expects,
    case
      when e.kind = 'table'  then (t.table_name  is not null)
      when e.kind = 'column' then (c.column_name is not null)
    end as present
  from expected e
  left join information_schema.tables t
    on e.kind = 'table'
   and t.table_schema = 'public'
   and t.table_name = e.tbl
  left join information_schema.columns c
    on e.kind = 'column'
   and c.table_schema = 'public'
   and c.table_name = e.tbl
   and c.column_name = e.col
)

select
  case when present then 'live' else 'MISSING — run this file' end as status,
  file  as "docs/ file to run",
  expects as "what it should have created"
from checked
order by present asc, file, expects;

-- NOT CHECKED HERE, because there is nothing to check:
--
--   rls_rollback_2026-08-19.sql   policies, not shape
--   the row level security policies and indexes inside the files above -
--     a column existing does not prove its policy was created, and a policy is
--     not something this query can sensibly report on
--
-- And the parts of fact-find-documents-schema.sql that need no migration at
-- all: residency, deposit source, self-employed structure and the tidied
-- income list all live inside deals.fact_find_data, which is one jsonb column
-- that already exists.
