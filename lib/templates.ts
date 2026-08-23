// One source of truth for scenario names. Keys are what the database stores and must never
// change - investment_equity is written into every deal that has used that scenario, so
// renaming it would mean migrating live data to fix a word nobody outside the code sees.
// Labels are what the team reads. Every screen displaying a scenario reads from here.
export const TEMPLATE_LABELS: Record<string, string> = {
  refinance_equity:    'Refinance + equity release',
  refinance_only:      'Refinance only',
  oo_purchase:         'OO purchase',
  oo_lvr_compare:      'OO purchase \u2014 LVR comparison',
  investment_purchase: 'Investment purchase',
  investment_equity:   'Equity release + purchase',
  buy_sell:            'Buy / sell',
  fhb:                 'First home buyer',
  bridging:            'Bridging loan',
  family_pledge:       'Family pledge',
  smsf:                'SMSF purchase',
  construction:        'Construction loan',
  custom:              'Custom (all fields)',
}

export function templateLabel(key?: string | null): string {
  if (!key) return ''
  return TEMPLATE_LABELS[key] || key
}
