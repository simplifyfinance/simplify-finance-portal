// COPYING ONE APPLICANT'S ADDRESS HISTORY ONTO ANOTHER.
//
// Couples almost always share an address, and typing it twice is both slow and
// a chance to get the two records subtly different. The Fact Find has had a
// "Copy address from Applicant 1" button for a while, but it named nobody, said
// nothing about what it was about to do, and REPLACED whatever the second
// applicant already had with no warning and no way back. Fabio, 2 Sep 2026:
// "I want that to copy accross to applicant or better yet copy history button".
//
// This decides which of three things the screen should offer. The screen draws
// it; the rules live here so they can be tested without a browser.
//
// Deliberately all-or-nothing rather than a tick box per address: the common
// case is "they live together, and always have", and the rare case is answered
// by editing afterwards.

export type AddressLike = {
  id?: string
  address?: string
  isCurrent?: boolean
  startDate?: string
  endDate?: string
}

// An address row that exists but has no address typed into it is the blank one
// the form starts with. It is not history, and it is not something anybody
// would mind losing.
export function recorded(list: AddressLike[] | undefined | null): AddressLike[] {
  return (list || []).filter(a => String(a?.address || '').trim() !== '')
}

export type CopyPlan =
  // The other applicant has nothing recorded either, so there is nothing to
  // offer. The screen says why rather than showing a button that does nothing.
  | { kind: 'nothing' }
  // Safe: this applicant has typed nothing, so copying cannot lose anything.
  | { kind: 'offer'; count: number }
  // Copying would delete what is already here. The screen has to say so, and
  // name what goes, before anybody presses it.
  | { kind: 'replace'; count: number; removing: string[] }

export function copyPlan(from: AddressLike[], to: AddressLike[]): CopyPlan {
  const source = recorded(from)
  if (source.length === 0) return { kind: 'nothing' }
  const existing = recorded(to)
  if (existing.length === 0) return { kind: 'offer', count: source.length }
  return {
    kind: 'replace',
    count: source.length,
    removing: existing.map(a => String(a.address || '').trim()),
  }
}

// A copy, not a reference: two applicants who share an address today can move
// apart tomorrow, and editing one must never edit the other. New ids for the
// same reason - the form keys rows by id.
export function copyAddresses<T extends AddressLike>(from: T[], newId: () => string): T[] {
  return recorded(from).map(a => ({ ...a, id: newId() } as T))
}
