import type { Note } from './deal-notes'

// WHAT KIND OF ENTRY IS THIS?
//
// 29 Oct 2026, for the File notes tab's filter.
//
// WORKED OUT, NOT STORED. public.deal_notes has `kind` already - 'note' for
// something a person typed, 'system' for something the portal wrote - and that
// is the distinction that MATTERS, because it is the one that decides whether
// anybody can be asked to stand behind the wording.
//
// The filter wants a finer cut than that: an email, the client doing something,
// the portal moving the deal. Adding a second column for it would mean a value
// that can disagree with the sentence beside it the first time somebody writes
// a note by hand. So it is read off the row instead, and if it reads one of
// them wrong the only cost is which chip it appears under.
export type NoteFilter = 'all' | 'email' | 'client' | 'typed' | 'portal'

export const FILTERS: { key: NoteFilter; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'email', label: 'Emails' },
  { key: 'client', label: 'What the client did' },
  { key: 'typed', label: 'Typed by us' },
  { key: 'portal', label: 'The portal' },
]

export function kindOf(n: Pick<Note, 'kind' | 'body' | 'detail'>): NoteFilter {
  // Anything a person typed is theirs, whatever it says in it.
  if (String(n?.kind) !== 'system') return 'typed'
  // An entry carrying the wording of an email IS an email. The sentence can be
  // phrased a hundred ways; the wording being there cannot.
  if (String(n?.detail || '').trim()) return 'email'
  const body = String(n?.body || '').toLowerCase()
  if (/\bemailed\b|\bemail sent\b|\bsent to the client\b/.test(body)) return 'email'
  if (/\bclient agreed\b|\banswered\b|\bthrough the client link\b|\bclient pressed\b/.test(body)) return 'client'
  return 'portal'
}
