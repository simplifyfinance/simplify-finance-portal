// WHAT A PERSON DECIDED ABOUT THE DOCUMENT LIST.
//
// The list itself is worked out fresh from the fact find every time - see
// document-rules.ts, which stores nothing. This is the other half: the small
// number of things a human decided that the fact find cannot know.
//
// Three kinds of decision, and nothing else:
//   - a row the fact find ticked that somebody untucked, or the reverse
//   - a document somebody added that no rule would ever produce
//   - which of the added ones they later removed
//
// Saved as one jsonb column on the deal, keyed by the item's stable key, the
// same shape handover_progress uses. A key that no longer appears in the list is
// simply ignored, so deleting a liability can never break the page - it just
// takes its row with it.

import type { DocItem, DocFor } from './document-rules'

export type Decision = { ticked: boolean; at: string; by: string }

export type AddedDoc = {
  key: string
  label: string
  detail?: string
  forWhat: DocFor
  at: string
  by: string
}

export type DocProgress = {
  decisions?: Record<string, Decision>
  added?: AddedDoc[]
}

// A row as the screen renders it: the rule's version, plus whether it is
// actually ticked and whether a person is the reason.
export type DocRow = DocItem & { ticked: boolean; decidedBy?: string; addedByHand?: boolean }

const now = () => new Date().toISOString()

// Added rows carry a key of their own so a decision about one files the same way
// as a decision about a derived row. Time-based, because two people adding
// "accountant's letter" at once should get two rows, not one that overwrites.
export function addedKey(): string {
  return `added:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function progressOf(deal: any): DocProgress {
  const p = deal?.document_progress
  return (p && typeof p === 'object') ? p as DocProgress : {}
}

// THE ONE RULE THAT MATTERS HERE: a person's decision always beats the rule.
// If somebody unticked the bonus payslip, it stays unticked even though the fact
// find still says a bonus was recorded - they know something the fact find does
// not. And it stays unticked through every later change to the fact find,
// because the decision was about the document, not about the data.
export function rowsFor(items: DocItem[], progress: DocProgress): DocRow[] {
  const decisions = progress?.decisions || {}
  const derived: DocRow[] = items.map(item => {
    const d = decisions[item.key]
    return d
      ? { ...item, ticked: d.ticked, decidedBy: d.by }
      : { ...item, ticked: item.auto }
  })

  const added: DocRow[] = (progress?.added || []).map(a => {
    const d = decisions[a.key]
    return {
      key: a.key,
      label: a.label,
      detail: a.detail,
      group: 'deal' as const,
      groupKey: 'deal',
      groupLabel: 'This deal',
      forWhat: a.forWhat,
      round: 'proceed' as const,
      auto: true,
      why: `Added by ${a.by}`,
      ticked: d ? d.ticked : true,
      decidedBy: d?.by,
      addedByHand: true,
    }
  })

  return [...derived, ...added]
}

export function tickedCount(rows: DocRow[]): number {
  return rows.filter(r => r.ticked).length
}

// --- writing ---------------------------------------------------------------
//
// Every one of these returns a NEW progress object rather than changing the one
// it was given, so a failed save can be rolled back by throwing away the result.

export function withTick(progress: DocProgress, key: string, ticked: boolean, by: string): DocProgress {
  return {
    ...progress,
    decisions: { ...(progress.decisions || {}), [key]: { ticked, at: now(), by } },
  }
}

export function withAdded(progress: DocProgress, label: string, forWhat: DocFor, by: string, detail?: string): DocProgress {
  const clean = String(label ?? '').trim()
  if (!clean) return progress
  const doc: AddedDoc = { key: addedKey(), label: clean, forWhat, at: now(), by }
  if (detail && detail.trim()) doc.detail = detail.trim()
  return { ...progress, added: [...(progress.added || []), doc] }
}

// Only a row somebody added can be removed - a derived row is a fact about the
// deal, and the way to say no to one is to untick it.
export function withoutAdded(progress: DocProgress, key: string): DocProgress {
  const decisions = { ...(progress.decisions || {}) }
  delete decisions[key]
  return {
    ...progress,
    added: (progress.added || []).filter(a => a.key !== key),
    decisions,
  }
}

// --- the extras somebody can pick from -------------------------------------
//
// Free text alone gives you nine spellings of "accountant's letter", which is
// unreadable in an email and uncountable afterwards. This is the starting list;
// it is meant to grow, and typing something not on it is always allowed.
export const COMMON_EXTRAS: { label: string; forWhat: DocFor; detail?: string }[] = [
  { label: "Accountant's letter", forWhat: 'lodge' },
  { label: 'Bank statements — older period', forWhat: 'compliance', detail: 'say which months' },
  { label: 'Letter of employment', forWhat: 'lodge' },
  { label: 'Contract of employment', forWhat: 'lodge' },
  { label: 'Statement of position', forWhat: 'lodge' },
  { label: 'Trust deed', forWhat: 'lodge', detail: 'signed and certified' },
  { label: 'Separation or divorce papers', forWhat: 'compliance' },
  { label: 'Child support assessment', forWhat: 'compliance' },
  { label: 'Visa grant notice', forWhat: 'lodge' },
  { label: 'Sale contract — property being sold', forWhat: 'lodge' },
]
