// Single source of truth for roles and what each role may do.
//
// Change a capability HERE and nowhere else. These checks used to be written
// inline in roughly ten files, which is why adding a role was a large change
// and why the sidebar silently mislabelled anyone outside the original three.

export const ROLES = ['admin', 'broker', 'staff'] as const

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  broker: 'Broker',
  staff: 'Staff',
}

/** Display name for a role. Falls back to the raw value rather than guessing. */
export function roleLabel(role?: string | null): string {
  if (!role) return 'Unknown'
  return ROLE_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1)
}

/** Which roles hold which capability. Mirrors current behaviour exactly. */
export const CAPABILITIES = {
  sendClientEmails:  ['admin', 'broker'],
  manageAssignments: ['admin'],
  manageTeam:        ['admin'],
  reassignDeals:     ['admin'],
  viewCommissions:   ['admin'],
} as const

export type Capability = keyof typeof CAPABILITIES

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false
  return (CAPABILITIES[capability] as readonly string[]).includes(role)
}
