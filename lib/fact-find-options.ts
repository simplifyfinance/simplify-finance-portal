// THE PICK LISTS THE FACT FIND OFFERS.
//
// These live here rather than inline in the form because the document checklist
// reads the same answers to decide what to ask a client for. A self-employed
// applicant needs two documents if they are a sole trader and five if they run
// a company; "Centrelink" and "child support" need different evidence from each
// other. Typed by hand into a free-text box, none of that is answerable.
//
// Fabio, 3 Sep 2026: "There is other taxable and nontaxable. So maybe we just
// stipulate what it is. Is that centrelink? Is that child support, that we can
// give a list."
//
// EVERY LIST HERE IS ADDITIVE. A value already sitting in a deal that is not on
// its list is still shown and still saved - see keptValue(). Changing a label
// below would silently orphan the deals already carrying the old wording, so
// add, and leave what is there alone.

// Sole trader or company decides five of the documents on the request list, and
// it is the single biggest gap the fact find had. Partnership and trust are here
// because they exist, not because the document rules split on them yet.
export const SELF_EMPLOYED_STRUCTURES = [
  'Sole trader',
  'Company',
  'Partnership',
  'Trust',
] as const

export const RESIDENCY_STATUSES = [
  'Australian citizen',
  'Permanent resident',
  'New Zealand citizen',
  'Temporary visa',
  'Non-resident',
] as const

// Rental income is deliberately NOT here. It is recorded against the property
// that earns it, which is the only place it can be tied to a rental statement.
// Putting it here as well would give us two answers to the same question.
export const OTHER_INCOME_TYPES = [
  'Centrelink',
  'Family tax benefit',
  'Child support',
  'Dividends',
  'Trust distribution',
  'Superannuation pension',
  'Annuity',
  'Government pension',
  'Board received',
  'Other',
] as const

// 'Shares' was missing, which is why a share statement could never be asked for
// automatically. 'Home Contents' stays because deals already carry it.
// WHAT KIND OF PROPERTY IT IS - which decides whether insurance evidence is
// needed. Fabio, 3 Sep 2026: "we only need the insurance for a single dwelling,
// or properties like houses that are not strata title."
//
// The fact find has asked this about properties a client already owns since the
// beginning. Nothing asked it about the one being BOUGHT, so the document
// checklist put insurance on every purchase to be safe and told you why. This
// is the same list, so the two screens cannot drift into different words for
// the same thing.
export const PROPERTY_SUBTYPES = [
  'House',
  'Unit',
  'Townhouse',
  'Land',
  'Commercial',
  'Rural',
  'Other',
] as const

export const ASSET_TYPES = [
  'Bank account',
  'Shares',
  'Super',
  'Vehicle',
  'Home Contents',
  'Other',
] as const

// Where the deposit comes from - a gift needs a gift letter, and nothing on the
// fact find could say so. It exists on the BC today, which is too late: by then
// the documents have already been asked for.
export const DEPOSIT_SOURCES = [
  'Savings',
  'Gift',
  'Sale of a property',
  'Sale of another asset',
  'Equity release',
  'Inheritance',
  'First Home Super Saver',
  'Other',
] as const

// A value already on a deal that is not on its list. Returned so the form can
// offer it as an extra option rather than silently snapping the record to
// something nobody chose - the failure that loses data quietly.
export function keptValue(current: string | null | undefined, list: readonly string[]): string | null {
  const v = String(current ?? '').trim()
  if (!v) return null
  return list.includes(v) ? null : v
}

// The options to render, in order, including whatever is already saved.
export function optionsFor(current: string | null | undefined, list: readonly string[]): string[] {
  const kept = keptValue(current, list)
  return kept ? [...list, kept] : [...list]
}

// --- what the document rules will ask ---------------------------------------

export function isSoleTrader(employment: any): boolean {
  return String(employment?.selfEmployedStructure ?? '').trim() === 'Sole trader'
}

// Company, partnership and trust all need the company-level paperwork - tax
// returns, financials, BAS. Sole traders do not. An unanswered structure is not
// a company: it is unanswered, and the checklist says so rather than guessing
// five documents into existence.
export function needsCompanyFinancials(employment: any): boolean {
  const s = String(employment?.selfEmployedStructure ?? '').trim()
  return s === 'Company' || s === 'Partnership' || s === 'Trust'
}

export function structureAnswered(employment: any): boolean {
  const s = String(employment?.selfEmployedStructure ?? '').trim()
  return SELF_EMPLOYED_STRUCTURES.includes(s as any)
}
