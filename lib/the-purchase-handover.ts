// WHERE THE PURCHASE HANDOVER IS FILED, AND WHAT IT IS CALLED.
//
// Small on purpose. The page itself is lib/purchase-handover.ts; this is only
// the two answers every caller needs and must not disagree about - the path it
// is stored under and the name it carries.
//
// ITS OWN PATH. Fabio, 21 Oct 2026: "remenr this is a new docuemtn on document
// tabs do not delete old handover". The handover lives at
// `<dealId>/compliance.pdf` and nothing here goes near it. One press of this
// replaces the previous purchase handover on the same deal, and only that.

import { contractPrice } from './contract-figures'

const txt = (v: any) => String(v ?? '').trim()

export const PURCHASE_HANDOVER_KIND = 'purchase_handover'
export const purchaseHandoverPath = (dealId: string) => `${dealId}/${PURCHASE_HANDOVER_KIND}.pdf`

/**
 * "Purchase handover - Natasha Chapman & Richard Chapman.pdf"
 *
 * Named for the people, like handoverFileName in lib/handover.ts, and led by
 * what it is so the two sort together and read apart in the documents list.
 */
export function purchaseHandoverName(applicantNames: string[], fallbackDealName?: string): string {
  const names = (applicantNames || []).map(n => txt(n)).filter(Boolean)
  const who = names.length
    ? (names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1])
    : txt(fallbackDealName || 'Deal').replace(/_/g, ' ')
  // Only the characters a file system will not take.
  return `Purchase handover - ${who}`.replace(/[\/\\:*?"<>|]/g, '-').slice(0, 180) + '.pdf'
}

/**
 * WHETHER THERE IS A PURCHASE TO HAND OVER AT ALL.
 *
 * A price paid, and nothing else. Not a stage, not a tick: the price is the
 * fact that makes this document possible, and it is the one thing on it that
 * cannot be left blank. Every other gap prints as not recorded.
 *
 * A deal without one gets no button, rather than a button that would build a
 * page of blanks.
 */
export function thereIsAPurchase(deal: any): boolean {
  return contractPrice(deal) > 0
}
