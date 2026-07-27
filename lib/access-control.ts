// Explicit allowlist — only these broker_keys may see team-wide deal data
// (Dashboard) or open any deal regardless of assignment (deal pages).
// Justin, Keanen, and any future broker added to the team must NOT be added
// here; they stay restricted to their own deals only.
// Comparison is case-insensitive since broker_key casing in the database
// isn't guaranteed to be lowercase.
export const TEAM_VIEW_BROKERS = ['fabio', 'mark']

export function hasTeamViewAccess(brokerKey: string | null): boolean {
  if (!brokerKey) return true // no personal book (Kylie, Alan) — always team view
  return TEAM_VIEW_BROKERS.includes(brokerKey.toLowerCase())
}
