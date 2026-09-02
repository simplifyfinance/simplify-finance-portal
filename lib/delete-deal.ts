// DELETING A DEAL, AND WHY YOU PROBABLY SHOULD NOT.
//
// Deleting was a one-line browser confirm. It warned that the documents would go
// and that it could not be undone, which is true but not the useful thing to
// say: almost every deal somebody wants to delete is a deal that did not
// proceed, and the right answer to that is to mark it LOST. A lost deal keeps
// its reason, keeps counting in the reporting, can carry a follow-up date, and
// can be reopened when the client comes back. A deleted one takes the fact that
// the client ever existed with it.
//
// Fabio, 2 Sep 2026: "is there a warning befroe deleting saying cant be undone
// are you shure you dont mark it as lost?"
//
// So: deleting is for a deal created by mistake. This module says whether it is
// allowed at all, and what would actually be destroyed.

export type DeleteCheck = { allowed: true } | { allowed: false; because: string }

// Once compliance has gone to the credit team, the deal is a record of advice
// that left the building - it is not ours to erase. Same for a settled loan,
// which the trail book is built on. Both can still be marked lost if they died.
export function canDelete(deal: any): DeleteCheck {
  if (deal?.compliance_sent_at) {
    return {
      allowed: false,
      because: 'Compliance for this deal has already gone to the credit team, so it is a record of '
             + 'advice that left the building. It can be marked lost, but not deleted.',
    }
  }
  if (deal?.settled_at || deal?.status === 'settled') {
    return {
      allowed: false,
      because: 'This loan has settled. The commission and trail are built on it, so it cannot be deleted.',
    }
  }
  return { allowed: true }
}

// Said plainly, and specifically enough to change somebody's mind. A count of
// documents is not the frightening part; the fact find is.
export function whatIsLost(deal: any, documentCount = 0): string[] {
  const out: string[] = []
  const ff = deal?.fact_find_data || {}
  const applicants = (ff.applicants || []).length
  if (applicants > 0) {
    out.push(`The fact find — ${applicants} ${applicants === 1 ? 'applicant' : 'applicants'}, `
           + 'income, assets, liabilities')
  }
  if (deal?.bc_data && Object.keys(deal.bc_data).length > 0) out.push('The borrowing capacity workings')
  if (deal?.lo_data && Object.keys(deal.lo_data).length > 0) out.push('The lending options comparison')
  if (deal?.compliance_data && Object.keys(deal.compliance_data).length > 0) {
    out.push('The compliance write-up and the handover boxes')
  }
  if (documentCount > 0) {
    out.push(`${documentCount} attached ${documentCount === 1 ? 'document' : 'documents'}`)
  }
  // Always last, and always said: this is the one people forget.
  out.push('Any record that this client ever came to you')
  return out
}

// Typed, not clicked. A deal is somebody's file; one more deliberate act is
// proportionate, and it makes an accidental delete essentially impossible.
export const DELETE_WORD = 'DELETE'

export function deleteConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_WORD
}
