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

// The line that goes on the file when somebody unlocks a tab. Not friction for
// its own sake: "who changed the fact find after we lodged, and why" becomes a
// question with an answer.
export function unlockNote(tab: string, reason: string): string {
  const label = TAB_LABEL[tab] || tab
  const why = String(reason || '').trim()
  return `${label} unlocked and edited.${why ? ' ' + why : ''}`
}

// An unlock has to say why. A blank reason is the same as no record at all.
export function reasonIsEnough(reason: string): boolean {
  return String(reason || '').trim().length >= 4
}
