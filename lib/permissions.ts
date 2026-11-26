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
  // Everybody. A deal sitting on the wrong person's name is a deal nobody is
  // doing, and asking an admin to move it is a queue in front of work that
  // takes one click. Fabio, 9 Sep 2026: "can you allow all team members to
  // reassign deals". Who moved it is recorded on the deal either way.
  reassignDeals:     ['admin', 'broker', 'staff'],
  viewCommissions:   ['admin'],
  // EVERYBODY, SINCE 26 NOV 2026 - and it used to be admin and brokers only.
  //
  // Catherine, on a Macquarie deal changed right after lodgement: "Credit (Mel)
  // isn't able to edit even when I unlock FYI - remains locked for her. I asked
  // her to send me the details to update as admin."
  //
  // That was the design: credit reads a lodged deal and asks a broker to change
  // it, so the change is made by somebody accountable for it. In practice it
  // made Catherine the typist for work Mel had already done, on a deal that
  // needed changing that day.
  //
  // Fabio, 26 Nov 2026: "I don't mind credit being able to unlock it. as long
  // we are recording everyhting on file notes history."
  //
  // WHICH IT ALREADY DOES, AND THAT IS THE WHOLE REASON THIS IS SAFE. The
  // unlock will not open without a typed reason, and components/TabLock.tsx
  // refuses to unlock at all if the file note cannot be written - "an
  // untraceable edit is worse than a locked tab". Nothing about the record
  // changes here; only who may stand in front of it.
  unlockLodgedDeal:  ['admin', 'broker', 'staff'],
} as const

// WHO CAN LOOK AT PREVIOUS VERSIONS OF A DEAL.
//
// Deliberately not a role. Every save now keeps a copy of what it replaced, and
// that pile is the whole history of a client's file - what a figure used to be,
// what somebody changed and when. Useful in the right hands and confusing in
// everybody else's, so it is two named people rather than a job title.
//
// Fabio, 7 Sep 2026: "do it next but only me and Kylie to see it."
//
// One line to change. Add an address here and that person can see it; take it
// out and they cannot.
export const HISTORY_PEOPLE = [
  'fabio@simplifyfinance.com.au',
  'kylie@simplifyfinance.com.au',
]

export function canSeeHistory(email: string | null | undefined): boolean {
  const e = String(email || '').trim().toLowerCase()
  return e !== '' && HISTORY_PEOPLE.includes(e)
}

export type Capability = keyof typeof CAPABILITIES

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false
  return (CAPABILITIES[capability] as readonly string[]).includes(role)
}
