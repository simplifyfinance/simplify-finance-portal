// The handover document: what is on it, in what order, and how the text is
// broken up so it can be printed.
//
// The compliance PDF printed every field as one run-on line - "Analysis: ..."
// followed by "Options considered: ..." - which is impossible to copy cleanly.
// The team's overseas staff open this document and paste each answer into the
// box of the same name in SalesTrekker, so the document is now a list of boxes
// that match those fields exactly.
//
// Fabio, 2 Sep 2026: "the boxes are labelled as per salestrekker so leave the
// name of the boxes that is on purpose."

export type Box = { key: string; label: string }

// The order they appear on screen, which is the order they appear here, which is
// the order somebody works down them. Security and Ownership sit together
// because they are the same question asked two ways.
export const NEEDS_BOXES: Box[] = [
  { key: 'needsPrimary', label: 'Primary reasons for seeking credit' },
  { key: 'needsImmediate', label: 'Immediate needs & objectives — next 2 years' },
  { key: 'needsLongTerm', label: 'Longer term — 2 to 10 years' },
]
export const COMMENT_BOXES: Box[] = [
  { key: 'analysisComment', label: 'Analysis, assessment & applicant education' },
  { key: 'optionsComment', label: 'Options presented & recommendation' },
  { key: 'borrowingPowerComment', label: 'Borrowing power' },
  { key: 'depositComment', label: 'Deposit / equity' },
  { key: 'creditHistoryComment', label: 'Credit history' },
  { key: 'securityComment', label: 'Security (property)' },
  { key: '__title', label: 'Ownership and title' },
  { key: 'applicationSubmissionComment', label: 'Application submission' },
]

// "Handover - Natasha Chapman & Richard Chapman.pdf"
//
// Named for the people, not for the deal record. The person filing it is looking
// for a client, and `Natasha_Chapman_Richard_Chapman_Purchase_2026-compliance`
// is not a client's name.
export function handoverFileName(applicantNames: string[], fallbackDealName?: string): string {
  const names = (applicantNames || []).map(n => String(n || '').trim()).filter(Boolean)
  const who = names.length
    ? (names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1])
    : String(fallbackDealName || 'Deal').replace(/_/g, ' ')
  // Only the characters a file system will not take. Spaces and ampersands are
  // fine and are what makes the name readable.
  return `Handover - ${who}`.replace(/[\/\\:*?"<>|]/g, '-').slice(0, 180) + '.pdf'
}

// --- the writing ------------------------------------------------------------
//
// The AI writes markdown into these fields: **ANALYSIS**, **$1,700,000**, and
// `---` between sections. Printed raw, the client's own staff paste literal
// asterisks into SalesTrekker. So the markup is turned into real bold on the
// page, and a copy of the page gives clean text.

export type Run = { text: string; bold: boolean }
export type Block = { kind: 'para'; runs: Run[] } | { kind: 'rule' }

export function parseBlocks(text: any): Block[] {
  const raw = String(text ?? '').replace(/\r\n?/g, '\n')
  if (!raw.trim()) return []
  return raw.split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean)
    .map<Block>(b => (/^-{3,}$/.test(b) ? { kind: 'rule' } : { kind: 'para', runs: parseRuns(b) }))
}

// **bold** becomes a bold run. An unmatched pair of asterisks is left as typed
// rather than swallowing the rest of the paragraph.
export function parseRuns(line: string): Run[] {
  const out: Run[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false })
    out.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false })
  return out.filter(r => r.text.length > 0)
}

// What a run of text says with the markup gone - used for the plain-text half of
// anything that is copied rather than printed.
export function plainText(text: any): string {
  return parseBlocks(text)
    .map(b => (b.kind === 'rule' ? '' : b.runs.map(r => r.text).join('')))
    .filter(Boolean)
    .join('\n\n')
}

export function hasContent(text: any): boolean {
  return String(text ?? '').trim().length > 0
}
