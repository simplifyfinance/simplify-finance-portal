// THE FIVE COLUMNS THAT ARE 84% OF A DEAL, AND TODAY BARELY READS THEM.
//
// 18 Nov 2026. Fabio: "when I press today, it takes a good 10 seconds, maybe a
// little bit more, to load... is there anything that you can scatter through the
// coding to make sure speed is not compromised?"
//
// It is not the number of deals. 280 real deals weigh 3,575 kB, and five
// columns are 3,099 kB of that:
//
//   bc_data          882 kB   read for ONE fact: is it empty
//   fact_find_data   833 kB   read for ONE fact: has anybody typed anything real
//   lo_data          738 kB   read for ONE fact: have the options started, and a split total
//   compliance_data  538 kB   not read on Today or Settlements at all
//   internal_notes   108 kB   not read on Today or Settlements at all
//
// So the page was shipping three megabytes of fact finds, BCs and lending
// options across the wire to answer three yes/no questions and one number.
//
// TWO ASKS INSTEAD OF ONE. The light columns for every deal, because the
// month's figures count deals that settled long ago. The heavy ones only for
// deals anybody can still act on - 88 of 280 are live - and a settled deal
// keeps them for six months, because amountOf() falls back to a split total off
// lo_data when nothing better was ever recorded.
//
// NOTHING IS HAND-PICKED. LIGHT is every column in docs/deals-columns.txt
// except the five, and lib/the-light-list-is-whole.test.ts holds the two
// together - so a migration that adds a column fails the suite until it is
// listed, rather than quietly going missing off a screen. That is the same
// failure scripts/check-deal-columns.sh exists to prevent.

/** The five that are only ever read for a fact that fits in a word. */
export const HEAVY = [
  'bc_data',
  'compliance_data',
  'fact_find_data',
  'internal_notes',
  'lo_data',
] as const

/**
 * A DEAL SOMEBODY CAN STILL DO SOMETHING ABOUT.
 *
 * Lost is lost. Settled is counted, not worked - but its figures are still read
 * for six months, which is longer than any month a screen reports on.
 *
 * ONLY LIGHT COLUMNS ARE ASKED ABOUT HERE. This decides who gets the heavy
 * ones, so it cannot need them itself.
 */
export function stillWorthTheDetail(deal: any, now: Date = new Date()): boolean {
  const txt = (v: any) => String(v ?? '').trim()
  if (txt(deal?.status) === 'lost') return false
  const settled = txt(deal?.settled_at)
  if (!settled) return true
  const t = Date.parse(settled)
  if (!Number.isFinite(t)) return true   // an unreadable date is not a reason to thin it
  return now.getTime() - t < 180 * 86_400_000
}

/** The ids to ask the heavy columns for, in one go. */
export function whoNeedsTheDetail(deals: any[], now: Date = new Date()): string[] {
  return (deals || [])
    .filter(d => stillWorthTheDetail(d, now))
    .map(d => String(d?.id ?? ''))
    .filter(Boolean)
}

/**
 * PUT THE HEAVY COLUMNS BACK ON THE ROWS THEY BELONG TO.
 *
 * The merge adds, it never replaces: a deal that did not get them keeps every
 * other field it had. A missing blob reads as absent, which is what every
 * caller already handles - `deal?.lo_data || {}`.
 */
export function withTheDetail(light: any[], heavy: any[]): any[] {
  if (!heavy?.length) return light || []
  const by = new Map((heavy || []).map(h => [String(h?.id ?? ''), h]))
  return (light || []).map(d => {
    const extra = by.get(String(d?.id ?? ''))
    return extra ? { ...d, ...extra } : d
  })
}

/** Every column public.deals has, except the five. */
export const LIGHT: readonly string[] = [
  'assigned_broker',
  'assigned_credit_officer',
  'attn_settlements',
  'bc_completed_at',
  'bc_owner_name',
  'bc_owner_officer',
  'bc_owner_since',
  'bc_rework_at',
  'bc_rework_by',
  'bc_rework_count',
  'bc_rework_note',
  'bc_rework_was_sent',
  'bc_rework_why',
  'bc_scenarios',
  'bc_self_assigned',
  'bc_sent_at',
  'broker_first_name',
  'broker_priority',
  'buyers_agent_email',
  'buyers_agent_name',
  'buyers_agent_phone',
  'changes_since_lodgement',
  'client_chose_scenario',
  'client_chose_scenario_at',
  'client_id',
  'client_proceeded',
  'close_note',
  'close_reason',
  'closed_at',
  'closed_by',
  'commission_paid',
  'commission_paid_at',
  'commission_received',
  'commission_split_at',
  'commission_split_by',
  'commission_split_id',
  'commission_split_kind',
  'commission_split_lines',
  'commission_split_name',
  'commission_split_none',
  'commission_split_trail',
  'commission_split_upfront',
  'compliance_completed_at',
  'compliance_finalised',
  'compliance_finalised_at',
  'compliance_needed_by',
  'compliance_owner_name',
  'compliance_owner_officer',
  'compliance_owner_since',
  'compliance_pack_at',
  'compliance_pack_user_id',
  'compliance_pack_user_name',
  'compliance_sent_at',
  'confirmed_settlement_date',
  'contract_deposit',
  'contract_funding_at',
  'contract_funding_by',
  'contract_funding_choice',
  'contract_loan_amount',
  'contract_price',
  'contract_stamp_duty',
  'contracts_returned_at',
  'created_at',
  'credit_assigned_at',
  'credit_order',
  'deal_name',
  'deal_type',
  'deposit_paid',
  'deposit_paid_at',
  'discharge_note',
  'discharge_ready',
  'docs_assessor_due_at',
  'docs_assessor_email_id',
  'docs_issued_at',
  'docs_received_at',
  'docs_received_by',
  'docs_returned_at',
  'document_progress',
  'documents_built_at',
  'documents_built_by',
  'documents_built_from',
  'emails_sent',
  'expected_settlement_date',
  'expected_upfront',
  'finance_clause_date',
  'formal_approval_at',
  'funds_to_complete_at',
  'funds_to_complete_checked',
  'handover_progress',
  'id',
  'is_test',
  'is_urgent',
  'last_saved_by',
  'last_saved_name',
  'last_saved_tab',
  'last_tab',
  'last_touched_at',
  'lead_source',
  'lender',
  'lender_id',
  'lender_ref',
  'lender_reference',
  'lender_solicitor',
  'lender_solicitor_ref',
  'lo_client_proceeded',
  'lo_completed_at',
  'lo_owner_name',
  'lo_owner_officer',
  'lo_owner_since',
  'lo_proceeded_at',
  'lo_proceeded_by',
  'lo_proceeded_lender',
  'lo_proceeded_source',
  'lo_rework_at',
  'lo_rework_by',
  'lo_rework_count',
  'lo_rework_note',
  'lo_rework_was_sent',
  'lo_rework_why',
  'lo_self_assigned',
  'lo_sent_at',
  'lo_wants_call',
  'lo_wants_call_at',
  'loan_amount',
  'loan_docs_signing',
  'lodged_at',
  'lodged_splits',
  'lodged_total',
  'lodgement_plan',
  'lodgement_week',
  'lodgement_week_at',
  'lodgement_week_by',
  'next_action',
  'next_action_done_at',
  'next_action_due',
  'notes',
  'offer_accepted_at',
  'offer_io_years',
  'offer_product',
  'offer_rate',
  'offer_repayment_type',
  'offer_term_years',
  'onedrive_link',
  'outstanding_at',
  'outstanding_by',
  'outstanding_items',
  'outstandings',
  'phase',
  'phase_override',
  'phase_override_at',
  'phase_override_from',
  'preapproval_at',
  'priority_at',
  'priority_by',
  'priority_day',
  'priority_why',
  'proceeded_at',
  'proceeded_by',
  'proceeded_source',
  'property_use',
  'purchase_address',
  'purpose',
  'push_answers',
  'push_log',
  'questions_added',
  'questions_state',
  'review_sent',
  'review_sent_at',
  'row_version',
  'salestrekker_bcc',
  'salestrekker_card_id',
  'salestrekker_created_at',
  'salestrekker_link',
  'settled_at',
  'settled_splits',
  'settled_total',
  'settlement_booked_at',
  'settlement_checklist',
  'settlement_documents',
  'settlement_note',
  'settlement_stage',
  'settlement_stage_at',
  'settlement_state',
  'settlement_step',
  'settlement_trail',
  'settlement_updated_at',
  'settlement_updated_by',
  'solicitor_email',
  'solicitor_name',
  'solicitor_phone',
  'stage',
  'status',
  'stuck_at',
  'stuck_by_name',
  'stuck_reason',
  'stuck_why',
  'transaction_type',
  'urgent_at',
  'urgent_by',
  'urgent_by_name',
  'urgent_why',
  'valuations_ordered',
]

/** What goes in .select() - the light columns, as PostgREST wants them. */
export const LIGHT_SELECT = LIGHT.join(', ')

/** What the second ask selects. */
export const HEAVY_SELECT = ['id', ...HEAVY].join(', ')

/**
 * A REPORT READS THE WHOLE YEAR, so it cannot thin out old settlements.
 *
 * Lodged and settled counts money going back months, and amountOf() falls back
 * to a split total off lo_data when nothing better was recorded - so that one
 * blob stays. The other four are 2,361 kB of fact finds, BCs, compliance and
 * internal notes that no report has ever read.
 */
export const REPORT_SELECT = [...LIGHT, 'lo_data'].join(', ')
