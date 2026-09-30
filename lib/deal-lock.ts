// What a lodged deal lets you change, and who may change it.
//
// Once a deal is with the lender the five tabs at the bottom - fact find,
// statements, BC, lending options, compliance - are a record of what was
// submitted. Reading them changes nothing and always did: clicking a tab writes
// only which tab you were last on. The risk was never navigation, it was that
// they stayed LIVE FORMS - somebody could type in one, or press Generate with
// AI, on a deal already sitting with an assessor.
//
// Fabio, 1 Sep 2026: "once the deal is sitting in lodged forwards ... those tabs
// at the bottom are read only."

import { isWithLender } from './deal-phase'

export function isLocked(deal: any): boolean {
  return isWithLender(deal)
}

// Admin and brokers only. A credit officer reads the same page with no unlock
// button; if something is wrong they add a file note asking for it to be
// changed - which is also a record, and a better one than a silent edit.
export function canUnlock(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'broker'
}

export const TAB_LABEL: Record<string, string> = {
  FactFind: 'Fact Find',
  Statements: 'Statements',
  BC: 'BC',
  LO: 'Lending options',
  Compliance: 'Compliance',
}

// THE LINE THAT GOES ON THE FILE WHEN SOMEBODY UNLOCKS A DEAL.
//
// Not friction for its own sake: "who changed this after we lodged, and why"
// becomes a question with an answer.
//
// ONE UNLOCK, NOT ONE PER TAB. Fabio, 30 Sep 2026: "you are lovking individual
// tabs if i need to reqword a deal card I want one button unlock and it allows
// me to evrythign on all tabs".
//
// He is right. Reworking a deal card is never one tab - a lender change touches
// the lending options and the compliance write-up, and a corrected income
// touches the fact find and the borrowing capacity. Per-tab unlocking meant
// three unlocks and three notes for one piece of work, which is three lines on
// the file describing one decision.
//
// The note no longer names a tab, because the unlock no longer is one.
export function unlockNote(reason: string): string {
  const why = String(reason || '').trim()
  return `Deal unlocked and edited.${why ? ' ' + why : ''}`
}

// An unlock has to say why. A blank reason is the same as no record at all.
export function reasonIsEnough(reason: string): boolean {
  return String(reason || '').trim().length >= 4
}
