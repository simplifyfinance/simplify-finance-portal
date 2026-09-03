// WHAT THIS CLIENT HAS TO SEND US.
//
// One list of documents, worked out from the fact find rather than typed by a
// person. Built from Kylie and Alan's list, 3 Sep 2026, and the rules Fabio
// settled the same day.
//
// TWO THINGS TO HOLD ON TO BEFORE READING ANY OF IT:
//
// 1. THIS IS WORKED OUT FRESH, EVERY TIME. Nothing here is ever saved. Change a
//    client from PAYG to self-employed and the list changes with them. A list
//    saved at the moment the fact find was filled in would be wrong by the
//    afternoon - which is exactly the bug the BC email had, where a saved copy
//    outlived the scenario it was written for.
//
//    What IS saved, elsewhere, is only what a human decided: what they ticked,
//    what they unticked, what they added, what has come in. Those file under an
//    item's `key`, and a key that no longer appears is simply ignored - so
//    deleting a liability can never break the page.
//
// 2. AN UNANSWERED QUESTION IS NOT A "NO". If nobody has said whether a
//    self-employed applicant is a sole trader or a company, the answer is not
//    two documents and it is not five - it is "nobody has said", and the list
//    says so out loud. Guessing here means a client gets asked for the wrong
//    paperwork, which is worse than being told we do not know.

// Relative, not '@/lib/...'. There is no vitest config in this repo, so the
// alias resolves under Next and not under the test runner - which is how this
// file passed a typecheck and then failed the ship gate.
import { currentAddress, currentEmployment, fullName, notWorking, selfEmployed } from './fact-find'
import { needsCompanyFinancials, structureAnswered } from './fact-find-options'

// Lodge means the lender sees it - and lodge is automatically compliance too.
// Compliance means our file only. Fabio, 3 Sep 2026: "anything that is labeled
// lodge, it automatically is compliance."
export type DocFor = 'lodge' | 'compliance'

// WHEN IT GETS ASKED FOR - not a label on the document, but the moment it
// exists. You cannot ask for an exchanged contract on the day a client says
// yes, because there is no contract yet. The board already knows where a deal
// is, so nothing has to be remembered by a person.
export type DocRound = 'proceed' | 'offer_accepted' | 'formal_approval'

export type DocItem = {
  // Stable, and what a tick is filed under. Built from the fact find's own ids,
  // so it survives everything except deleting the thing it hangs off.
  key: string
  label: string
  detail?: string
  // Who or what it belongs to, and how the list groups.
  group: 'applicant' | 'property' | 'debts' | 'deal'
  groupKey: string
  groupLabel: string
  forWhat: DocFor
  round: DocRound
  // Ticked on sight. False means it sits there and a person decides - the
  // optional ones, and anything we are not sure enough about to assume.
  auto: boolean
  // Shown under the row when the reason is not obvious from the name.
  why?: string
  // The discharge. Asked before it joins the list, and if the answer is no it
  // comes back by itself at formal approval.
  askFirst?: boolean
  // Which bank's statements would cover this, if any. The matching against
  // loaded statements happens later; this is the hook it uses.
  coveredByBank?: string
}

// Something the list cannot answer because the fact find has a hole in it.
// Surfaced beside the documents rather than silently changing what is asked
// for.
export type DocGap = { key: string; message: string }

export type DocList = { items: DocItem[]; gaps: DocGap[] }

const has = (v: any) => String(v ?? '').trim() !== ''
const txt = (v: any) => String(v ?? '').trim()

// ---------------------------------------------------------------- the deal --

const REFINANCE_TEMPLATES = ['refinance_only', 'refinance_equity', 'investment_equity']

export function isRefinance(deal: any): boolean {
  if (REFINANCE_TEMPLATES.includes(txt(deal?.bc_data?.template))) return true
  // A template is a shape somebody picked; a loan marked "to be refinanced" is
  // a fact about the client. Either is enough.
  const props = deal?.fact_find_data?.properties || []
  return props.some((p: any) => (p?.loans || []).some((l: any) => txt(l?.status) === 'To be refinanced'))
}

export function isPurchase(deal: any): boolean {
  const t = txt(deal?.bc_data?.template)
  return !!t && !REFINANCE_TEMPLATES.includes(t) && t !== 'custom'
}

export function isSmsf(deal: any): boolean {
  return txt(deal?.bc_data?.template) === 'smsf'
}

// --------------------------------------------------------- per applicant ----

function applicantItems(a: any, i: number, ff: any, out: DocItem[], gaps: DocGap[]) {
  const id = txt(a?.id) || `a${i}`
  const who = fullName(a) || `Applicant ${i + 1}`
  const g = { group: 'applicant' as const, groupKey: id, groupLabel: who }

  out.push({ ...g, key: `id:${id}`, label: 'ID — licence, Medicare, passport',
    forWhat: 'lodge', round: 'proceed', auto: true })

  // Compliance wants two accounts and no more: where the money comes in and
  // where it goes out. Fabio, 3 Sep 2026: "all I want is the salary credit
  // account and the expenses account". Which account that is comes from the
  // statement analysis, not from us guessing, so this row carries no bank name.
  out.push({ ...g, key: `salary-account:${id}`, label: 'Salary credit account',
    detail: 'the account the salary is paid into',
    forWhat: 'compliance', round: 'proceed', auto: true })

  out.push({ ...g, key: `super:${id}`, label: 'Superannuation statement', detail: 'most recent',
    forWhat: 'compliance', round: 'proceed', auto: true })

  // Where they live is deliberately NOT here - see housingItems(). A couple at
  // one address share one tenancy agreement, and asking a client twice for the
  // same piece of paper is how a list loses its authority.
  employmentItems(a, id, who, g, out, gaps)
}

// ONE DOCUMENT PER HOME, NOT PER PERSON.
//
// Written per applicant first, which produced two tenancy agreements for one
// rented flat and two rent-free letters for one spare room. The document
// belongs to the address, so that is what it is keyed on.
function housingItems(ff: any, out: DocItem[]) {
  const homes = new Map<string, { key: string; kind: string; who: string[]; groupKey: string; groupLabel: string }>()

  for (const [i, a] of (ff?.applicants || []).entries()) {
    const kind = txt(currentAddress(a)?.residentialStatus)
    if (kind !== 'Renting' && kind !== 'Living with family') continue
    const id = txt(a?.id) || `a${i}`
    const who = fullName(a) || `Applicant ${i + 1}`
    // Same address AND same arrangement. Two people renting the same flat share
    // an agreement; one renting while the other lives with family do not.
    const addr = txt(currentAddress(a)?.address).toLowerCase().replace(/[^a-z0-9]/g, '')
    const home = `${kind}|${addr || id}`
    const found = homes.get(home)
    if (found) found.who.push(who)
    else homes.set(home, { key: addr || id, kind, who: [who], groupKey: id, groupLabel: who })
  }

  for (const h of homes.values()) {
    const covers = h.who.length > 1 ? ` — covers ${h.who.join(' and ')}` : ''
    const g = { group: 'applicant' as const, groupKey: h.groupKey, groupLabel: h.groupLabel }
    if (h.kind === 'Renting') {
      out.push({ ...g, key: `tenancy:${h.key}`, label: 'Tenancy agreement',
        why: `Currently renting${covers}`, forWhat: 'compliance', round: 'proceed', auto: true })
    } else {
      out.push({ ...g, key: `rent-free:${h.key}`, label: 'Living at home rent free letter',
        detail: 'our template', why: `Living with family${covers}`,
        forWhat: 'lodge', round: 'proceed', auto: true })
    }
  }
}

function employmentItems(a: any, id: string, who: string, g: any, out: DocItem[], gaps: DocGap[]) {
  const jobs = currentEmployment(a).filter((e: any) => !notWorking(e))
  if (jobs.length === 0) return

  const anyPayg = jobs.some((e: any) => !selfEmployed(e))
  const anySelf = jobs.some((e: any) => selfEmployed(e))

  if (anyPayg) {
    out.push({ ...g, key: `payslips:${id}`, label: 'Payslips × 2',
      forWhat: 'lodge', round: 'proceed', auto: true })
    out.push({ ...g, key: `income-statement:${id}`, label: 'Income statement',
      detail: 'full financial year', forWhat: 'lodge', round: 'proceed', auto: true })

    // Only where a bonus was actually recorded. Asking every PAYG client for a
    // bonus payslip is how a list stops being read.
    const bonus = (a?.income || []).some((inc: any) => has(inc?.bonusAmount) && Number(String(inc.bonusAmount).replace(/,/g, '')) > 0)
    if (bonus) {
      out.push({ ...g, key: `bonus-payslip:${id}`, label: 'Bonus payslip',
        why: 'Bonus income recorded', forWhat: 'lodge', round: 'proceed', auto: true })
    }
  }

  if (anySelf) {
    // Everybody self-employed needs these, whatever the structure.
    out.push({ ...g, key: `personal-tax:${id}`, label: 'Personal tax returns × 2',
      detail: 'most recent two', forWhat: 'lodge', round: 'proceed', auto: true })

    const job = jobs.find((e: any) => selfEmployed(e))
    if (!structureAnswered(job)) {
      // THE HOLE, NAMED. Two documents or five depends entirely on this, so the
      // list refuses to pick and says who it needs an answer about.
      gaps.push({
        key: `structure:${id}`,
        message: `Nobody has said whether ${who} is a sole trader or a company. That decides whether we ask for notices of assessment or for company returns, financials and BAS — so those are not on the list yet.`,
      })
      return
    }

    if (needsCompanyFinancials(job)) {
      out.push({ ...g, key: `company-tax:${id}`, label: 'Company tax returns × 2',
        forWhat: 'lodge', round: 'proceed', auto: true })
      out.push({ ...g, key: `company-financials:${id}`, label: 'Company financials × 2',
        detail: 'accountant prepared', forWhat: 'lodge', round: 'proceed', auto: true })
      // Optional: it sits there unticked and somebody decides. Fabio, 3 Sep
      // 2026: "Anything that is optional, so BAS and all that, it just sits
      // there and tick."
      out.push({ ...g, key: `bas:${id}`, label: 'BAS × 3', why: 'Optional — tick if you want them',
        forWhat: 'lodge', round: 'proceed', auto: false })
    } else {
      out.push({ ...g, key: `noa:${id}`, label: 'Notices of assessment × 2',
        forWhat: 'lodge', round: 'proceed', auto: true })
    }
  }
}

// ---------------------------------------------------------- per property ----

function propertyItems(p: any, i: number, out: DocItem[]) {
  const id = txt(p?.id) || `p${i}`
  const label = txt(p?.address) || `Property ${i + 1}`
  const g = { group: 'property' as const, groupKey: id, groupLabel: label }

  // Any property held, whatever it is used for. Fabio, 3 Sep 2026: "Anytime you
  // own a property regardless of what it is, rates notice is something that we
  // need." Compliance only - it is never lodged.
  out.push({ ...g, key: `rates:${id}`, label: 'Council rates notice',
    forWhat: 'compliance', round: 'proceed', auto: true })

  if (txt(p?.ownershipType) === 'Investment') {
    out.push({ ...g, key: `rental-statement:${id}`, label: 'Rental statement',
      why: 'Investment property', forWhat: 'lodge', round: 'proceed', auto: true })
  }
}

// ------------------------------------------------------------- the debts ----

// Every one of these is a candidate to be crossed off by a client's loaded bank
// statements, which is why each carries the bank it belongs to.
function debtItems(ff: any, out: DocItem[]) {
  const g = { group: 'debts' as const, groupKey: 'debts', groupLabel: 'Debts' }

  for (const [i, l] of (ff?.liabilities || []).entries()) {
    const id = txt(l?.id) || `l${i}`
    const kind = txt(l?.liabilityType)
    const bank = txt(l?.lenderName)
    const named = (base: string) => bank ? `${base} — ${bank}` : base

    if (kind === 'Credit card') {
      out.push({ ...g, key: `cc-statement:${id}`, label: named('Credit card statement'),
        detail: 'last 3 months', coveredByBank: bank || undefined,
        forWhat: 'compliance', round: 'proceed', auto: true })
    } else if (kind === 'Car loan') {
      out.push({ ...g, key: `car-statement:${id}`, label: named('Car loan statement'),
        detail: 'last 6 months', coveredByBank: bank || undefined,
        forWhat: 'compliance', round: 'proceed', auto: true })
    } else if (kind === 'Personal loan') {
      out.push({ ...g, key: `personal-statement:${id}`, label: named('Personal loan statement'),
        detail: 'last 6 months', coveredByBank: bank || undefined,
        forWhat: 'compliance', round: 'proceed', auto: true })
    } else if (kind === 'HECS') {
      out.push({ ...g, key: `hecs:${id}`, label: 'HECS balance',
        forWhat: 'compliance', round: 'proceed', auto: true })
    }
    // Health Insurance and Other need no evidence of their own.
  }

  // Home loans hang off the property they are secured against, but they belong
  // in the debts group where somebody looking for a statement would go.
  for (const [pi, p] of (ff?.properties || []).entries()) {
    for (const [li, loan] of (p?.loans || []).entries()) {
      const id = txt(loan?.id) || `p${pi}l${li}`
      const bank = txt(loan?.lenderName)
      out.push({ ...g, key: `home-loan-statement:${id}`,
        label: bank ? `Home loan statement — ${bank}` : 'Home loan statement',
        detail: 'last 6 months', coveredByBank: bank || undefined,
        forWhat: 'lodge', round: 'proceed', auto: true })
    }
  }
}

// -------------------------------------------------------- the deal itself ---

function dealItems(deal: any, ff: any, out: DocItem[], gaps: DocGap[]) {
  const g = { group: 'deal' as const, groupKey: 'deal', groupLabel: 'This deal' }

  // One household account, not one per person - most couples run their spending
  // through the same one, and the statement analysis says which.
  out.push({ ...g, key: 'expenses-account', label: 'Expenses account',
    detail: 'the account the household spending runs through',
    forWhat: 'compliance', round: 'proceed', auto: true })

  // One deposit, one gift letter - written by whoever is giving the money. This
  // was per applicant to begin with, which asked a couple for two letters about
  // one gift. Where there really are two gifts, the assessor adds the second.
  if (txt(ff?.depositSource) === 'Gift') {
    out.push({ ...g, key: 'gift-letter', label: 'Gift letter', detail: 'our template',
      why: 'The deposit is coming from a gift',
      forWhat: 'lodge', round: 'proceed', auto: true })
  }

  if (isRefinance(deal)) {
    // Usually asked up front, sometimes deliberately not. Rather than choosing
    // for them, it asks - and a no does not lose it. Fabio, 3 Sep 2026: "make it
    // a rule that do you wanna ask for discharge now, yes or no? And if it's no,
    // please make sure that is part of the formal approval process."
    out.push({ ...g, key: 'discharge', label: 'Discharge of mortgage',
      why: 'Ask for this now? If not, it comes back by itself when the loan is formally approved.',
      forWhat: 'compliance', round: 'proceed', auto: false, askFirst: true })
  }

  if (isSmsf(deal)) {
    out.push({ ...g, key: 'smsf-deed', label: 'SMSF trust deed', detail: 'signed and certified',
      forWhat: 'lodge', round: 'proceed', auto: true })
    out.push({ ...g, key: 'smsf-tax', label: 'SMSF tax returns × 2',
      why: 'If the fund is already established', forWhat: 'lodge', round: 'proceed', auto: false })
    out.push({ ...g, key: 'bare-trust-deed', label: 'Bare trust deed', detail: 'signed and certified',
      why: 'Once the property has been found',
      forWhat: 'lodge', round: 'offer_accepted', auto: true })
  }

  if (isPurchase(deal)) {
    out.push({ ...g, key: 'contract-of-sale', label: 'Updated contract of sale',
      forWhat: 'lodge', round: 'offer_accepted', auto: true })

    // Only a standalone dwelling. Fabio, 3 Sep 2026: "we only need the insurance
    // for a single dwelling, or properties like houses that are not strata
    // title." The fact find records this for properties a client already owns,
    // but nothing yet records it for the one being bought.
    const buying = txt(deal?.bc_data?.purchasePropertySubtype)
    if (!buying) {
      gaps.push({
        key: 'purchase-property-type',
        message: 'Nobody has recorded whether the property being bought is a house or strata, so insurance evidence is on the list to be safe. A house needs it; a unit or townhouse does not.',
      })
      out.push({ ...g, key: 'insurance', label: 'Insurance — certificate of currency',
        why: 'On the list because the property type has not been recorded',
        forWhat: 'lodge', round: 'offer_accepted', auto: true })
    } else if (buying === 'House') {
      out.push({ ...g, key: 'insurance', label: 'Insurance — certificate of currency',
        why: 'The property being bought is a house, not strata',
        forWhat: 'lodge', round: 'offer_accepted', auto: true })
    }
  }
}

// ------------------------------------------------------------------ build ---

export function documentsFor(deal: any): DocList {
  const ff = deal?.fact_find_data || {}
  const items: DocItem[] = []
  const gaps: DocGap[] = []

  for (const [i, a] of (ff.applicants || []).entries()) applicantItems(a, i, ff, items, gaps)
  housingItems(ff, items)
  for (const [i, p] of (ff.properties || []).entries()) propertyItems(p, i, items)
  debtItems(ff, items)
  dealItems(deal, ff, items, gaps)

  return { items, gaps }
}

// What is actually asked for at this moment in the deal's life. Everything else
// is real, it just is not due yet.
export function documentsDue(deal: any, round: DocRound): DocList {
  const all = documentsFor(deal)
  return { items: all.items.filter(d => d.round === round), gaps: all.gaps }
}

// Grouped for display, in the order somebody would read them: each person, then
// each property, then the debts, then the deal.
export function groupedDocuments(items: DocItem[]): { key: string; label: string; items: DocItem[] }[] {
  const order = ['applicant', 'property', 'debts', 'deal']
  const groups = new Map<string, { key: string; label: string; group: string; items: DocItem[] }>()
  for (const d of items) {
    const g = groups.get(d.groupKey)
      || { key: d.groupKey, label: d.groupLabel, group: d.group, items: [] }
    g.items.push(d)
    groups.set(d.groupKey, g)
  }
  return [...groups.values()]
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
    .map(({ key, label, items }) => ({ key, label, items }))
}
