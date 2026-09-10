// BOXES TWO AND THREE — THE CLIENT'S GOALS, COMPOSED.
//
// Box 2: immediate needs and objectives, the next two years.
// Box 3: longer term needs and objectives, two to ten years.
//
// Same rules as box one (lib/box-one.ts), and the same three wordings picked
// from the deal so an audit never reads the same paragraph twice while one file
// never rewords itself. Nothing here is written by a model.
//
// WHAT THESE TWO BOXES ARE MADE OF.
//
// Their first source is the client's own words, from Fact Find -> Goals. When
// those are blank the box says so in capitals rather than describing goals
// nobody stated - which is what it used to do, at length.
//
// Box 3 has more than the goals to work with, and none of it was ever used:
//
//   - the number of dependants, from the fact find
//   - the retirement age and the intended repayment method, both recorded per
//     applicant on the Risks tab under "Exit strategy"
//   - and the one that matters: whether the loan term outlives the retirement
//     age they gave. The portal holds every number needed for that - their date
//     of birth, the term, their stated retirement age - and has never once put
//     them together. On the Chapman file the loan runs two years past the
//     retirement age on the record, and nothing anywhere says so.

import { splitsOf } from './deal-structure'
import { ageFrom, fullName } from './fact-find'
import { applicantsOf } from './applicants'
import { structureOf, variantOf, andList, type Gap } from './box-one'

const txt = (v: any) => String(v ?? '').trim()
const shout = (s: string) => `** ${s} **`

export type Box = { text: string; gaps: Gap[]; variant: 1 | 2 | 3 }

// Their sentence keeps its own full stop; ours is added only when they did not
// write one.
function quoted(said: string): string {
  const t = said.replace(/\s+/g, ' ').trim()
  return `"${t}${/[.!?]$/.test(t) ? '' : '.'}"`
}

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const countInWords = (n: string) => COUNT[Number(txt(n))] ?? txt(n)

// ---------------------------------------------------------------------------
// BOX TWO — the next two years
// ---------------------------------------------------------------------------
//
// The point of this box, in Fabio's words on 10 Sep 2026: "really trying to
// analyse if there is anything that has been flagged over the next two years."
//
// So it is the broker's own account of the client's plans, and then everything
// on the deal that is going to CHANGE inside that window - a fixed rate ending,
// an interest only period ending, a property being sold, a pre-approval to be
// used. Every one of those is a date the portal already holds and has never
// mentioned in a compliance note.

// "Nothing is expected to go wrong in the next two years" is a claim about a
// client, and it used to be asserted on every file. It is not asserted here: the
// Risks tab asks both of these questions outright, and this reports the answers.
// Fabio, 10 Sep 2026, choosing this over an always-on sentence.
export type Outlook = { clear: boolean; flagged: string[]; unanswered: string[] }

export function outlook(deal: any): Outlook {
  const risks = deal?.compliance_data?.risks || {}
  const flagged: string[] = []
  const unanswered: string[] = []
  let answered = 0
  for (const a of applicantsOf(deal, deal?.bc_data || {})) {
    const r = risks[a.name] || {}
    const first = a.name.split(' ')[0]
    for (const [key, what] of [['adverseChanges', 'adverse changes to their financial situation'],
                               ['circumstancesImpact', 'circumstances that may impact their financial commitments']]) {
      const ans = txt((r as any)[key]).toLowerCase()
      if (!ans) { unanswered.push(`${first} — ${what}`); continue }
      answered++
      if (ans !== 'no') flagged.push(`${first} has declared ${what}`)
    }
  }
  return { clear: answered > 0 && flagged.length === 0 && unanswered.length === 0, flagged, unanswered }
}

export function boxTwo(deal: any): Box {
  const ff = deal?.fact_find_data || {}
  const bc = deal?.bc_data || {}
  const v = variantOf(deal?.id)
  const gaps: Gap[] = []
  const who = andList(applicantsOf(deal, bc).map(a => a.name.split(' ')[0]))
  const parts: string[] = []

  // --- the broker's account of what the client said ------------------------
  const said = txt(ff.goals2Years)
  if (said) {
    parts.push([
      `Asked what they want to achieve over the next two years, ${who} said: ${quoted(said)}`,
      `In their own words, ${who} described their plans for the next two years as: ${quoted(said)}`,
      `${who} were asked about the next two years and told us: ${quoted(said)}`,
    ][v - 1])
  } else {
    parts.push(shout([
      `NOT RECORDED — ${who} have not been asked what they want to achieve over the next two years, or the answer has not been written down. The fact find question is blank and must be completed before this file is submitted.`,
      `NOT RECORDED — nothing has been recorded about what these clients are planning over the next two years. That question is blank on the fact find and needs answering before submission.`,
      `NOT RECORDED — the clients' short term goals are missing from the fact find. They must be asked and recorded before this file goes any further.`,
    ][v - 1]))
    gaps.push({ what: "The clients' goals for the next two years", where: 'Fact Find → Goals — next 2 years' })
  }

  // --- what the repayment type is for, which is always worth saying --------
  const s = structureOf(deal)
  if (s.interestOnly) {
    parts.push([
      `The focus over the next two years is managing cash flow, which is why interest only repayments were chosen.`,
      `Interest only repayments were selected because managing cash flow is the priority over this period.`,
      `Cash flow is the priority over the next two years, and interest only repayments were chosen on that basis.`,
    ][v - 1])
  } else if (s.principalAndInterest) {
    parts.push([
      `With principal and interest repayments the focus over this period is reducing the debt from day one.`,
      `The loan is principal and interest, so the aim from day one is bringing the debt down.`,
      `Principal and interest repayments mean the debt starts reducing immediately, which is the objective over this period.`,
    ][v - 1])
  }

  // --- the dates inside the window ----------------------------------------
  const fixedYrs = Number(s.fixedYears)
  if (s.fixed && Number.isFinite(fixedYrs) && fixedYrs > 0 && fixedYrs <= 2) {
    parts.push(`The fixed rate period of ${fixedYrs} year${fixedYrs === 1 ? '' : 's'} ends inside this window. This was discussed with the client, who is aware the rate will change at that point.`)
  }
  const ioYrs = Number(s.ioYears)
  if (s.interestOnly && Number.isFinite(ioYrs) && ioYrs > 0 && ioYrs <= 2) {
    parts.push(`The interest only period of ${ioYrs} year${ioYrs === 1 ? '' : 's'} ends inside this window. The client will put a budget together to ensure they can adjust to the higher repayment when the loan converts to principal and interest.`)
  }

  const selling = (ff.properties || []).filter((p: any) => /sold|sell/i.test(txt(p?.futureUse)))
  for (const p of selling) {
    parts.push(`Their property at ${txt(p?.address) || 'the address on the fact find'} is recorded as being sold, so that sale falls inside this period.`)
  }
  for (const p of (ff.properties || [])) {
    const use = txt(p?.futureUse)
    if (/will become/i.test(use)) {
      parts.push(`${txt(p?.address) || 'A property on the fact find'} is recorded as ${use.toLowerCase()} after settlement, which is a change of use inside this period.`)
    }
  }

  if (deal?.compliance_data?.preApproval) {
    parts.push(`This is a pre-approval, so the immediate objective is finding a suitable property and proceeding to a full application within the approval period.`)
  }
  if (txt(bc.bridgingPeriod)) {
    parts.push(`The bridging period of ${txt(bc.bridgingPeriod)} falls entirely inside this window, and the loan is expected to reduce to the end debt within it.`)
  }
  if (txt(bc.template) === 'construction') {
    parts.push(`This is a construction loan, so the build and its progress draws fall inside this period, with repayments rising as each draw is taken.`)
  }

  // --- retirement, only if it lands inside the next two years --------------
  const r2 = retirementLines(deal, 0, 2, v)
  parts.push(...r2.parts)
  gaps.push(...r2.gaps)

  // --- and whether anything has been flagged -------------------------------
  const o = outlook(deal)
  if (o.flagged.length) {
    parts.push(shout(`FLAGGED — ${andList(o.flagged)}. This must be addressed before submission.`))
    gaps.push({ what: 'A change in circumstances has been declared', where: 'Compliance → Risks → Financial situation' })
  } else if (o.clear) {
    parts.push([
      `${who} have confirmed no adverse changes to their financial situation and no circumstances expected to impact their commitments, so there are no foreseeable personal or financial circumstances within the next two years expected to adversely affect the proposed structure or the repayment obligations.`,
      `On their own declarations there are no adverse changes to their financial situation and nothing expected to impact their commitments — so no foreseeable personal or financial circumstances over the next two years should adversely affect the proposed structure or the repayments.`,
      `Both questions on changes to their circumstances were answered no, so there are no foreseeable personal or financial circumstances within the next two years expected to affect the proposed structure or the repayment obligations.`,
    ][v - 1])
  } else if (o.unanswered.length) {
    parts.push(shout(`NOT RECORDED — the questions on changes to their circumstances have not been answered for ${andList([...new Set(o.unanswered.map(u => u.split(' — ')[0]))])}, so it cannot be stated that nothing is expected to affect the repayments.`))
    gaps.push({ what: 'Changes in circumstances not answered', where: 'Compliance → Risks → Financial situation' })
  }

  return { text: parts.join(' '), gaps, variant: v }
}

// ---------------------------------------------------------------------------
// BOX THREE — two to ten years, and the exit strategy nobody was checking
// ---------------------------------------------------------------------------

export type Retirement = {
  who: string
  ageNow: number | null
  retiresAt: number | null
  method: string
  ageAtEnd: number | null
  // The loan is still running after the age they said they would stop working.
  outlives: boolean
  // Years from today until the age they gave. Fabio, 10 Sep 2026: "only talk
  // about retirement strategy if it falls within the period" - so a client
  // retiring in twenty-eight years is not a two-year objective and not a
  // ten-year one either, and neither box mentions it.
  yearsAway: number | null
}

export function retirementPicture(deal: any): { term: number | null; people: Retirement[] } {
  const bc = deal?.bc_data || {}
  const ff = deal?.fact_find_data || {}
  const risks = deal?.compliance_data?.risks || {}
  const termTxt = splitsOf(deal).map(s => txt(s.termYears)).find(Boolean) || txt(bc.loanTerm)
  const term = /^\d+$/.test(termTxt) ? Number(termTxt) : null

  const people: Retirement[] = []
  for (const a of (ff.applicants || [])) {
    const name = fullName(a)
    if (!name) continue
    const r = risks[name] || {}
    const retireTxt = txt(r.retirementAge)
    const retiresAt = /^\d+$/.test(retireTxt) ? Number(retireTxt) : null
    const ageNow = ageFrom(a?.dob)
    const ageAtEnd = ageNow !== null && term !== null ? ageNow + term : null
    people.push({
      who: name.split(' ')[0],
      ageNow, retiresAt,
      method: txt(r.repaymentMethod),
      ageAtEnd,
      outlives: ageAtEnd !== null && retiresAt !== null && ageAtEnd > retiresAt,
      yearsAway: ageNow !== null && retiresAt !== null ? retiresAt - ageNow : null,
    })
  }
  return { term, people }
}

// THE RETIREMENT LINES, FOR WHICHEVER BOX OWNS THE WINDOW.
//
// Box 2 gets it when they retire inside two years; box 3 when it falls between
// two and ten. Further out than that and neither box says anything - it is not
// an objective for the period being written about.
//
// The exit strategy shout is attached to the same window. When somebody retires
// in twenty-eight years the loan may still outlive them, and that belongs in the
// analysis rather than here.
function retirementLines(deal: any, from: number, to: number, v: 1 | 2 | 3):
    { parts: string[]; gaps: Gap[] } {
  const { term, people } = retirementPicture(deal)
  const parts: string[] = []
  const gaps: Gap[] = []
  for (const p of people) {
    if (p.yearsAway === null || p.yearsAway < from || p.yearsAway > to) continue
    const bits = [`${p.who} intends to retire at ${p.retiresAt}, which falls inside this period`]
    if (p.method) bits.push(`and intends to repay the loan by ${p.method.toLowerCase()}`)
    parts.push(bits.join(', ') + '.')
    if (p.outlives && term !== null) {
      parts.push(shout([
        `EXIT STRATEGY — over a ${term} year term ${p.who} would be ${p.ageAtEnd} at the end of the loan, past the retirement age of ${p.retiresAt} recorded on this file. An exit strategy is required and must be evidenced.`,
        `EXIT STRATEGY — the ${term} year term runs to ${p.who}'s age ${p.ageAtEnd}, beyond the stated retirement age of ${p.retiresAt}. This file needs an evidenced exit strategy.`,
        `EXIT STRATEGY — at the end of the ${term} year term ${p.who} would be ${p.ageAtEnd}, which is after the retirement age of ${p.retiresAt} on the record. An exit strategy must be documented and evidenced.`,
      ][v - 1]))
      gaps.push({ what: `${p.who} retires before the loan ends — exit strategy required`, where: 'Compliance → Risks → Exit strategy' })
    }
  }
  return { parts, gaps }
}

export function boxThree(deal: any): Box {
  const ff = deal?.fact_find_data || {}
  const bc = deal?.bc_data || {}
  const v = variantOf(deal?.id)
  const gaps: Gap[] = []
  const who = andList(applicantsOf(deal, bc).map(a => a.name.split(' ')[0]))
  const parts: string[] = []

  // --- their own words, or the absence of them ----------------------------
  const said = txt(ff.goals10Years)
  if (said) {
    parts.push([
      `Asked about the next two to ten years, ${who} said: ${quoted(said)}`,
      `In their own words, ${who} described their longer term plans as: ${quoted(said)}`,
      `${who} were asked about the two to ten year horizon and told us: ${quoted(said)}`,
    ][v - 1])
  } else {
    parts.push(shout([
      `NOT RECORDED — ${who} have not been asked about their goals over the next two to ten years, or the answer has not been written down. The fact find question is blank and must be completed before this file is submitted.`,
      `NOT RECORDED — nothing has been recorded about these clients' longer term plans. That question is blank on the fact find and needs answering before submission.`,
      `NOT RECORDED — the clients' two to ten year goals are missing from the fact find. They must be asked and recorded before this file goes any further.`,
    ][v - 1]))
    gaps.push({ what: "The clients' goals for two to ten years", where: 'Fact Find → Goals — 2 to 10 years' })
  }

  // --- dependants ----------------------------------------------------------
  const deps = txt(ff.dependants) || txt(bc.dependants)
  if (deps && deps !== '0') {
    parts.push([
      `They have ${countInWords(deps)} dependant${deps === '1' ? '' : 's'}, so schooling and childcare costs over this period will bear on what they can afford; the ages of the dependants are not recorded.`,
      `With ${countInWords(deps)} dependant${deps === '1' ? '' : 's'} the cost of schooling and childcare over the coming years is a live consideration for affordability. Their ages are not recorded on the fact find.`,
      `${countInWords(deps).replace(/^./, c => c.toUpperCase())} dependant${deps === '1' ? ' is' : 's are'} recorded, which will affect household costs across this period. No ages have been recorded for them.`,
    ][v - 1])
  }

  // --- what the repayment type does over this period -----------------------
  const s3 = structureOf(deal)
  if (s3.principalAndInterest && !s3.interestOnly) {
    parts.push([
      `Principal and interest repayments continue to reduce the overall debt position across this period, building equity in the security as they go.`,
      `Over these years the principal and interest repayments keep reducing the overall debt position and building equity in the property.`,
      `The loan stays on principal and interest, so the overall debt position continues to reduce across this period and equity continues to build.`,
    ][v - 1])
  }

  // --- retirement, only if it lands inside two to ten years ----------------
  const r3 = retirementLines(deal, 2, 10, v)
  parts.push(...r3.parts)
  gaps.push(...r3.gaps)

  // A missing retirement age is still a gap the team must close - it just does
  // not belong in the prose, since without it there is nothing to say.
  for (const p of retirementPicture(deal).people) {
    if (p.retiresAt === null) {
      gaps.push({ what: `Retirement age for ${p.who}`, where: 'Compliance → Risks → Exit strategy' })
    }
  }

  return { text: parts.join(' '), gaps, variant: v }
}
