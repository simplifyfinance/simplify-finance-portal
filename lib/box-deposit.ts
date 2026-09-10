import { money, readMoney } from './money'
import { fundsToComplete, refinancedDebt } from './funds-to-complete'
import { dealRow, splitsOf, isMixed } from './deal-structure'
import { applicantsOf } from './applicants'
import { variantOf, andList, type Gap } from './box-one'

// BOX SEVEN — DEPOSIT / EQUITY.
//
// NOTHING HERE IS WORKED OUT. Every figure comes off the deal structure block,
// which is the thing on the screen: dealRow() and fundsToComplete() are what
// draws it. If the block is right, this box is right, and it can never quote a
// number the person reading it cannot see.
//
// Fabio, 10 Sep 2026: "it is all in the deal structure, nothing needs to be
// guessed" — after I read the BC's 80/90/95 target dropdown, mistook it for the
// LVR, and told him his own BC was unreliable. The block was showing the correct
// 32.4% the whole time.
//
// WHICH STORY THE BOX TELLS DEPENDS ON WHAT THE DEAL DOES, not on the scenario's
// name — a scenario picked wrongly at the start should not put the wrong words in
// a compliance note. His rule, in his words:
//
//   purchase                     talk about the deposit
//   refinance dollar for dollar  talk about the equity position
//   refinance with cash out      talk about the equity released
//   release funding a purchase    the release IS the deposit
//
// The equity release is NOT lending minus payout. There is an "Equity release
// amount" box on the BC and it is the only authority — which also disposes of
// the question of how small a difference counts as cash out. It does not.

const txt = (v: any) => String(v ?? '').trim()
const shout = (s: string) => `** ${s} **`
const num = (v: any) => readMoney(v) ?? 0

export type Box = { text: string; gaps: Gap[]; variant: 1 | 2 | 3 }

export type Shape = 'purchase' | 'refinance' | 'cashout' | 'release_and_purchase' | 'unknown'

// WHAT THE DEAL ACTUALLY DOES.
//
// Read from three recorded things: is there a purchase price, is there an equity
// release amount, and is there debt being paid out. refinancedDebt() is the same
// function the deal structure block uses for its "existing loan" figure - it is
// read directly here because the block zeroes that field on a deal that also
// buys, and case D needs it.
export function shapeOf(deal: any): Shape {
  const bc = deal?.bc_data || {}
  const buying = num(bc.purchasePrice) > 0 || num(bc.newPurchasePrice) > 0
  const release = num(bc.equityRelease) > 0
  const payout = refinancedDebt(deal) > 0

  if (buying && release) return 'release_and_purchase'
  if (buying) return 'purchase'
  if (release) return 'cashout'
  if (payout) return 'refinance'
  return 'unknown'
}

// THE BC'S OWN FOUR ANSWERS, not the fact find's eight.
//
// The scenario is where this deal's deposit was priced, so its answer wins. The
// fact find's list is longer and is used only when the BC box is empty.
//
// "Combination" means two different things depending on the scenario: savings and
// equity on a purchase, savings and a gift on a buy/sell. Both store the same
// word, so the scenario decides how it reads.
const BC_SOURCE_WORDS: Record<string, string> = {
  Savings: 'is held in savings',
  Equity: 'is coming from equity in an existing property',
  Gift: 'is a gift',
}

const FF_SOURCE_WORDS: Record<string, string> = {
  'Savings': 'is held in savings',
  'Gift': 'is a gift',
  'Sale of a property': 'is coming from the sale of a property',
  'Sale of another asset': 'is coming from the sale of another asset',
  'Equity release': 'is coming from an equity release',
  'Inheritance': 'is coming from an inheritance',
  'First Home Super Saver': 'is coming from the First Home Super Saver scheme',
}

export function depositSourceOf(deal: any): { source: string; words: string } {
  const bc = deal?.bc_data || {}
  const fromBc = txt(bc.depositSource)
  if (fromBc) {
    if (fromBc === 'Combination') {
      const buySell = txt(bc.template) === 'buy_sell'
      return { source: fromBc,
        words: buySell ? 'is a combination of savings and a gift'
                       : 'is a combination of savings and equity' }
    }
    if (BC_SOURCE_WORDS[fromBc]) return { source: fromBc, words: BC_SOURCE_WORDS[fromBc] }
  }
  const fromFf = txt(deal?.fact_find_data?.depositSource)
  if (fromFf && FF_SOURCE_WORDS[fromFf]) return { source: fromFf, words: FF_SOURCE_WORDS[fromFf] }
  // A source on the record that is on neither list - somebody's own words, or the
  // fact find's "Other". Stated rather than dropped, and never reworded.
  if (fromBc || fromFf) return { source: fromBc || fromFf, words: `is recorded as "${fromBc || fromFf}"` }
  return { source: '', words: '' }
}

// The sentence about where the money is from, and the gift letter that follows it.
export function depositSourceLine(deal: any): { parts: string[]; gaps: Gap[] } {
  const parts: string[] = []
  const gaps: Gap[] = []
  const { source, words } = depositSourceOf(deal)

  if (!words) {
    parts.push(shout('NOT RECORDED — where the deposit is coming from.'))
    gaps.push({ what: 'Deposit source', where: 'Borrowing capacity' })
    return { parts, gaps }
  }
  parts.push(`The deposit ${words}.`)

  // A gift needs a letter on file. The BC already says so on screen when Gift is
  // chosen; this carries it into the note rather than leaving it on one tab.
  if (/gift/i.test(source)) {
    parts.push('A gift letter will be required on file before settlement.')
  }

  // Two tabs, two answers. Not a missing answer - a disagreement, which is worth
  // saying rather than silently preferring one.
  const bcSource = txt(deal?.bc_data?.depositSource)
  const ffSource = txt(deal?.fact_find_data?.depositSource)
  if (bcSource && ffSource && bcSource !== ffSource
      && !(bcSource === 'Equity' && ffSource === 'Equity release')) {
    parts.push(shout(`The scenario records the deposit source as ${bcSource} and the fact find records it as ${ffSource}.`))
    gaps.push({ what: `Deposit source disagrees — ${bcSource} on the scenario, ${ffSource} on the fact find`,
                where: 'Borrowing capacity' })
  }
  return { parts, gaps }
}

// LVR, AND LMI ONLY WHERE THE PORTAL ASKS ABOUT IT.
//
// The BC asks whether LMI applies only once the calculated LVR is over 80%. So
// at or under 80% this says nothing about LMI at all - claiming "no LMI is
// payable" would be this box's own conclusion rather than anybody's answer.
export function lvrLine(deal: any): { parts: string[]; gaps: Gap[] } {
  const parts: string[] = []
  const gaps: Gap[] = []
  const row = dealRow(deal)
  const bc = deal?.bc_data || {}

  if (row.lvr === null) {
    parts.push(shout(`NOT RECORDED — the loan to value ratio cannot be stated because ${row.lvrWhy || 'the figures behind it are incomplete'}.`))
    gaps.push({ what: 'Loan to value ratio', where: 'Deal structure' })
    return { parts, gaps }
  }

  parts.push(`The loan to value ratio is ${row.lvr}%.`)
  if (row.lvr <= 80) return { parts, gaps }

  const status = txt(bc.lmiApplicable)
  if (!status) {
    parts.push(shout(`NOT RECORDED — whether lenders mortgage insurance applies at ${row.lvr}%.`))
    gaps.push({ what: 'LMI status', where: 'Borrowing capacity' })
  } else if (/waived/i.test(status)) {
    parts.push('Lenders mortgage insurance has been waived.')
  } else {
    const est = num(bc.lmi)
    parts.push(est > 0
      ? `Lenders mortgage insurance is applicable and has been estimated at ${money(est)}.`
      : `Lenders mortgage insurance is applicable. ${shout('NOT RECORDED — the LMI estimate.')}`)
    if (est <= 0) gaps.push({ what: 'LMI estimate', where: 'Borrowing capacity' })
  }
  return { parts, gaps }
}

// Stamp duty and the funds to complete, on a purchase. Both come off the same
// strip that already compares the deposit against the completion figure to the
// dollar - so a disagreement is reported, never reconciled here.
export function completionLine(deal: any): { parts: string[]; gaps: Gap[] } {
  const parts: string[] = []
  const gaps: Gap[] = []
  const bc = deal?.bc_data || {}
  const f = fundsToComplete(deal)

  const duty = num(bc.stampDuty) || num(bc.newPurchaseStampDuty)
  const state = txt(bc.dutyState)
  if (duty > 0) {
    parts.push(state
      ? `Stamp duty of ${money(duty)} has been allowed for in ${state}.`
      : `Stamp duty of ${money(duty)} has been allowed for.`)
  } else {
    parts.push(shout('NOT RECORDED — stamp duty on this purchase.'))
    gaps.push({ what: 'Stamp duty', where: 'Borrowing capacity' })
  }

  if (!f.applies || !f.workable) return { parts, gaps }

  if (f.deposit === null) {
    parts.push(`The funds required to complete come to ${money(f.toFind)}.`)
    return { parts, gaps }
  }
  if (f.depositAgrees) {
    parts.push(`The funds required to complete come to ${money(f.toFind)}, which agrees with the deposit recorded on the scenario.`)
  } else {
    parts.push(shout(`The funds required to complete come to ${money(f.toFind)} and the deposit recorded on the scenario is ${money(f.deposit)}.`))
    gaps.push({ what: 'Funds to complete does not match the deposit', where: 'Borrowing capacity' })
  }
  return { parts, gaps }
}

// The clients' own position on the exposure. Fabio's wording, 10 Sep 2026:
// "customers have enough of a equity position to proceed with the refinance, and
// they're comfortable with the exposure against the asset."
//
// Stated as the clients' position, not as this box's assessment of it.
const EXPOSURE: Record<1 | 2 | 3, string> = {
  1: 'The clients hold a sufficient equity position in the security to proceed and are comfortable with the level of exposure against the asset.',
  2: 'The clients have sufficient equity in the security to proceed and are comfortable with the level of exposure against the asset.',
  3: 'The clients hold enough equity in the security to proceed and are comfortable with the exposure against the asset.',
}

function whoIs(deal: any): { who: string; plural: boolean } {
  const apps = applicantsOf(deal, deal?.bc_data || {})
  const first = apps.map(a => txt((a as any).firstName || (a as any).name).split(' ')[0]).filter(Boolean)
  if (first.length === 0) return { who: 'The clients', plural: true }
  if (first.length === 1) return { who: first[0], plural: false }
  return { who: andList(first), plural: true }
}

export function boxSeven(deal: any): Box {
  const v = variantOf(deal?.id)
  const bc = deal?.bc_data || {}
  const row = dealRow(deal)
  const shape = shapeOf(deal)
  const { who, plural } = whoIs(deal)
  const is = plural ? 'are' : 'is'
  const hold = plural ? 'hold' : 'holds'

  const parts: string[] = []
  const gaps: Gap[] = []
  const take = (r: { parts: string[]; gaps: Gap[] }) => { parts.push(...r.parts); gaps.push(...r.gaps) }

  const lending = row.totalLending
  const price = num(bc.purchasePrice) || num(bc.newPurchasePrice)
  const deposit = num(bc.deposit) || num(bc.newPurchaseDeposit)
  const release = num(bc.equityRelease)
  const payout = refinancedDebt(deal)

  if (shape === 'purchase') {
    if (deposit > 0 && price > 0) {
      parts.push(v === 1
        ? `${who} ${is} contributing a deposit of ${money(deposit)} towards a purchase price of ${money(price)}, with lending of ${money(lending)} against the property.`
        : v === 2
        ? `The purchase price is ${money(price)}, of which ${who} ${is} contributing ${money(deposit)} as a deposit and ${money(lending)} is being borrowed.`
        : `${who} ${is} putting ${money(deposit)} towards a purchase price of ${money(price)} and borrowing ${money(lending)}.`)
    } else {
      if (price <= 0) gaps.push({ what: 'Purchase price', where: 'Borrowing capacity' })
      if (deposit <= 0) gaps.push({ what: 'Deposit', where: 'Borrowing capacity' })
      parts.push(shout(`NOT RECORDED — ${andList([price <= 0 ? 'the purchase price' : '', deposit <= 0 ? 'the deposit' : ''].filter(Boolean))}.`))
    }
    take(depositSourceLine(deal))
    take(lvrLine(deal))
    take(completionLine(deal))
  }

  else if (shape === 'refinance') {
    parts.push(v === 3
      ? `This refinances the existing debt dollar for dollar. No deposit or contribution is required, as the new lending of ${money(lending)} replaces the existing balance of ${money(payout)} being paid out.`
      : `This is a refinance of the existing debt dollar for dollar. No deposit or contribution is required, as the new lending of ${money(lending)} replaces the existing balance of ${money(payout)} being paid out.`)
    parts.push(EXPOSURE[v])
    take(lvrLine(deal))
  }

  else if (shape === 'cashout') {
    parts.push(v === 2
      ? `${who} ${is} releasing ${money(release)} of equity from the security. Total lending of ${money(lending)} is made up of ${money(payout)} to pay out the existing debt and the ${money(release)} equity release.`
      : `${who} ${is} releasing ${money(release)} of equity from the security. Of the total lending of ${money(lending)}, ${money(payout)} pays out the existing debt and ${money(release)} is the equity release.`)
    parts.push('No deposit or contribution is required, as the funds are drawn from the equity in the property.')
    parts.push(purposeSentence(deal))
    parts.push(EXPOSURE[v])
    take(lvrLine(deal))
  }

  else if (shape === 'release_and_purchase') {
    parts.push(`${who} ${is} releasing ${money(release)} of equity from the existing property, and that release is the contribution towards the purchase price of ${money(price)}. No cash contribution is being made from ${plural ? 'their' : 'their'} own funds.`)
    const purchaseSplit = splitsOf(deal).filter(s => s.funds === 'purchase')
      .reduce((t, s) => t + num(s.amount), 0)
    if (isMixed(deal) && splitsOf(deal).some(s => !s.funds)) {
      parts.push(shout('NOT RECORDED — what each split does, so the lending cannot be broken down.'))
      gaps.push({ what: 'What each split does — funds the purchase, pays out debt, or releases equity',
                  where: 'Deal structure' })
    } else {
      parts.push(`Total lending of ${money(lending)} is made up of ${money(payout)} to pay out the existing debt, the ${money(release)} equity release, and ${money(purchaseSplit)} funding the purchase.`)
    }
    take(completionLine(deal))
    take(lvrLine(deal))
  }

  else {
    parts.push(shout('NOT RECORDED — this deal records neither a purchase price, an equity release, nor any debt being paid out, so there is nothing to say about the deposit or the equity position.'))
    gaps.push({ what: 'The deal structure has no purchase, release or payout recorded', where: 'Deal structure' })
  }

  return { text: parts.filter(Boolean).join(' '), gaps, variant: v }
}

// What the released money is for. From the split's own purpose - owner occupied
// or investment - and never inferred from the scenario's name.
function purposeSentence(deal: any): string {
  const row = dealRow(deal)
  if (row.ooTotal > 0 && row.invTotal > 0) return 'The lending is split between owner occupied and investment purposes.'
  if (row.invTotal > 0) return 'The released funds are recorded as being for investment purposes.'
  if (row.ooTotal > 0) return 'The released funds are recorded as being for owner occupied purposes.'
  return shout('NOT RECORDED — whether the lending is owner occupied or investment.')
}
