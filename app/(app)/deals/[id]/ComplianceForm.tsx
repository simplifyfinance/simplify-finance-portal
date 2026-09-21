'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import SectionHeader from '@/components/SectionHeader'
import { isWithLender, splitsTotal } from '@/lib/deal-phase'
import { applicantsOf } from '@/lib/applicants'
import { PreflightPanel, PushForm } from '@/components/PushDialogs'
import { preflight, type Finding } from '@/lib/preflight'
import { defaultAnswers, type PushAnswers, type LiabilityChoice } from '@/lib/push-answers'
import { holdersFor, borrowerNotOnTitle, reasonRequired, LEGAL_ADVICE_LABEL,
         type TitleInfo, type LegalAdvice } from '@/lib/title'
import { hemStateOf, hemTotals, unansweredNote, type HemAnswer } from '@/lib/hem'
// One list, shared with the handover screen and both PDFs. This screen used
// to keep its own copy of it.
import { EXPENSE_CATEGORIES } from '@/lib/handover-view'

// The loan on this deal: what the LO settled on, or failing that the BC's splits
// added up. It used to fall back to the FIRST BC split, so a multi-split deal
// with no LO yet showed - and told the AI - half the loan.
const dealLoanAmount = (lo: any, bc: any): string => {
  if (lo?.loanAmount) return String(lo.loanAmount)
  const total = splitsTotal(bc?.splits)
  return total ? total.toLocaleString('en-AU') : ''
}
import { checkedWrite } from '@/lib/checked-write'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { dealFacts, factsBlock, dealPurpose } from '@/lib/deal-facts'
import { noteFacts, noteFreshness, reviewNotes, type NoteFacts, type NoteStamp,
         type NoteFreshness } from '@/lib/notes-freshness'
import { purposeSummary, dealRow } from '@/lib/deal-structure'
import { fundsToComplete } from '@/lib/funds-to-complete'
import { money } from '@/lib/money'
import { brokerNotes, type Assessor } from '@/lib/broker-notes'
import { comparisonBlock } from '@/lib/lender-comparison'
import { newGuard, adopt, saveGuarded } from '@/lib/save-conflict'
import { selfEmployedParagraphsFor } from '@/lib/self-employed-facts'
import { creditHistoryFacts, creditHistoryBlock } from '@/lib/credit-history-facts'
import { boxOne, type Gap } from '@/lib/box-one'
import { boxTwo, boxThree } from '@/lib/box-goals'
import { boxFour } from '@/lib/box-four'
import { boxSeven } from '@/lib/box-deposit'
import { boxEight } from '@/lib/box-credit'
import { boxNine } from '@/lib/box-security'
import { boxFive } from '@/lib/box-options'
import { boxSix } from '@/lib/box-power'
import { withDefaults } from '@/lib/record-defaults'
import { dealFigures, figureChanges, notesMentioning } from '@/lib/deal-figures'
import { useLiveColumn } from '@/components/useLiveColumn'
import { newOwnership, focusField, blurField, markDirty, keepOwned, settleSaved } from '@/lib/field-ownership'
import { useSaveIndicator } from '@/components/useSaveIndicator'
import { useDraft } from '@/components/useDraft'
import { merge3 } from '@/lib/deal-merge'
import DraftBanner from '@/components/DraftBanner'
import { recommendedOption } from '@/lib/recommended-option'
import type { SaveStatus } from '@/lib/save-indicator'
import { useKeepalive } from '@/components/useKeepalive'
import DealStructure from '@/components/DealStructure'
import { hasOffset as productHasOffset } from '@/lib/offset'
import { householdsOf, isOneHousehold, type HouseholdId } from '@/lib/households'
import { expensesFor, writeExpenses } from '@/lib/household-expenses'

type Applicant = { name: string; type: 'applicant' | 'guarantor' | 'company' | 'smsf' }

type RiskData = {
  adverseChanges: string
  beneficialChanges: string
  retirementAge: string
  repaymentMethod: string
  financialExperience: string
  interestRateConcern: string
  loanFlexibility: string
  jobSecurity: string
  propertyValueConcern: string
  emergencyFund: string
  maintainLifestyle: string
  adequateInsurance: string
  hasWill: string
  circumstancesImpact: string
  problemsMeetingCommitments: string
  officerInLiquidation: string
  unsatisfiedJudgements: string
  simultaneousApplications: string
  declaredBankrupt: string
}

type ProductReqs = {
  fixedRate: string
  variableRate: string
  fixedAndVariable: string
  principalAndInterest: string
  interestOnly: string
  interestInAdvance: string
  lineOfCredit: string
  offsetAccount: string
  redraw: string
  otherRequirements: string
  lowestCost: string
  approvedQuickly: string
  specificFeatures: string
  lenderPolicy: string
  branchFrequency: string
}

type ComplianceData = {
  entityType: string
  applicants: Applicant[]
  needsPrimary: string
  needsImmediate: string
  needsLongTerm: string
  requirementsType: string
  risks: Record<string, RiskData>
  productReqs: ProductReqs
  analysisComment: string
  optionsComment: string
  borrowingPowerComment: string
  depositComment: string
  creditHistoryComment: string
  securityComment: string
  // Who ends up on the title of the security, why a borrower is not on it, and
  // where independent legal advice stands. Optional: a deal written before this
  // existed simply has nothing here, and the tick boxes default to everyone on.
  title?: TitleInfo
  // No property identified yet. Makes "TBA" against the security the right
  // answer rather than an unfinished one, and says so on the handover.
  preApproval?: boolean
  applicationSubmissionComment: string
  expenses: Record<string, ExpenseEntry>
  // What each generated note was written from, so the tab can say when the deal
  // has moved on underneath it. Notes written before this existed have the old
  // two-field shape and are left alone - see lib/notes-freshness.ts.
  aiMeta: Record<string, NoteStamp>
  clientAgreedLender: string
  clientChosenLender: string
  clientChosenLenderOther: string
  clientChosenLenderReason: string
}

// THESE ANSWERS ARE PRE-POPULATED ON PURPOSE, AND THAT IS A DECISION.
//
// A new applicant arrives with the common answer already selected rather than
// blank - never bankrupt, no judgements, no adverse changes, has a will. So a
// deal nobody has opened this tab on still reads as a full set of client
// declarations, and there is no way from the record to tell an answer somebody
// gave from an answer the software wrote.
//
// I raised that on 10 Sep 2026 as a compliance risk and Fabio ruled on it:
//
//   "Just leave those questions because they're prepopulated is because we know
//    majority of the time the answers will be this way. But my credit team will
//    tick those boxes in any other way if the answers are different. So still
//    use the answers as your basis and do not start them empty."
//
// So they stay, the compliance notes read them as recorded answers, and
// preflight's "not answered" checks only ever fire on an applicant with no row
// at all. Written down because it is the kind of decision that gets quietly
// reversed by somebody who only sees the risk and not the reasoning.
const defaultRisk = (): RiskData => ({
  adverseChanges: 'No', beneficialChanges: 'No', retirementAge: '', repaymentMethod: '',
  financialExperience: 'Medium', interestRateConcern: 'Medium', loanFlexibility: 'Medium',
  jobSecurity: 'Medium', propertyValueConcern: 'Medium',
  emergencyFund: 'Yes', maintainLifestyle: 'Yes', adequateInsurance: 'Yes', hasWill: 'Yes', circumstancesImpact: 'No',
  problemsMeetingCommitments: 'No', officerInLiquidation: 'No', unsatisfiedJudgements: 'No',
  simultaneousApplications: 'No', declaredBankrupt: 'No'
})

// How a client says they will clear the debt. lib/box-four.ts turns each of
// these into a sentence, so a new option added here needs words adding there.
const REPAYMENT_METHODS = [
  'Repayment of loan prior to retirement',
  'Downsizing home',
  'Sale of assets',
  'Recurring income from superannuation',
  'Superannuation lump sum following retirement',
  'Savings',
  'Income from other investments',
  'Co-applicants income',
]

const defaultProductReqs = (): ProductReqs => ({
  fixedRate: '', variableRate: '', fixedAndVariable: 'Important',
  principalAndInterest: '', interestOnly: '', interestInAdvance: 'Do not want', lineOfCredit: 'Do not want',
  offsetAccount: '', redraw: '', otherRequirements: '',
  lowestCost: 'Somewhat important', approvedQuickly: 'Somewhat important',
  specificFeatures: 'Somewhat important', lenderPolicy: 'Somewhat important',
  branchFrequency: 'Rarely'
})

// `askHem` puts a toggle on the row and leaves the answer to the person writing
// the file. Only two, because lenders only disagree about two - a switch on all
// twenty-three would be twenty-three more chances to get one wrong.
//
// The KEYS never change. `primaryResidenceBodyCorp` is written into every deal
// already assessed; renaming it to match the label would orphan all of them.
// Australia says strata, so only the words on screen change.

type ExpenseEntry = {
  monthlyAmount: string
  splits: Record<string, string>
  comment: string
  // 'in' | 'out'. Absent means nobody has answered, which is a third thing and
  // is shown as such - see lib/hem.ts.
  hem?: string
}

function defaultExpenseSplit(applicants: Applicant[]): Record<string, string> {
  const n = applicants.length
  if (n === 0) return {}
  const pct = n === 1 ? '100' : (100 / n).toFixed(2).replace(/\.00$/, '')
  const result: Record<string, string> = {}
  applicants.forEach(a => { result[a.name] = pct })
  return result
}

function defaultExpenses(applicants: Applicant[], rentMonthlyAmount?: string): Record<string, ExpenseEntry> {
  const result: Record<string, ExpenseEntry> = {}
  EXPENSE_CATEGORIES.forEach(c => {
    const prefill = c.key === 'rent' && rentMonthlyAmount ? rentMonthlyAmount : ''
    result[c.key] = { monthlyAmount: prefill, splits: defaultExpenseSplit(applicants), comment: '' }
  })
  return result
}

function Toggle({ value, onChange, options, colors }: { value: string; onChange: (v: string) => void; options: string[]; colors?: string[] }) {
  return (
    <div className="flex gap-1">
      {options.map((opt, i) => {
        const isActive = value === opt
        const color = colors?.[i] || 'default'
        let cls = 'px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer '
        if (isActive) {
          if (color === 'green') cls += 'bg-green-50 text-green-700 border-green-300'
          else if (color === 'red') cls += 'bg-red-50 text-red-600 border-red-300'
          else if (color === 'amber') cls += 'bg-amber-50 text-amber-700 border-amber-300'
          else if (color === 'blue') cls += 'bg-blue-50 text-[#2DBEFF] border-blue-300'
          else cls += 'bg-[#343333] text-white border-[#343333]'
        } else {
          cls += 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
        }
        return <button key={opt} onClick={() => onChange(opt)} className={cls}>{opt}</button>
      })}
    </div>
  )
}

function ToggleRow({ label, value, onChange, options, colors, required }: { label: string; value: string; onChange: (v: string) => void; options: string[]; colors?: string[]; required?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700 flex-1 pr-4">{label}{required && !value && <span className="text-red-400 ml-1">*</span>}</span>
      <Toggle value={value} onChange={onChange} options={options} colors={colors} />
    </div>
  )
}


// THE NINE AI NOTES, NAMED ONCE. Two of the lists that used to hold these
// disagreed with each other, which is how a field can quietly stop being
// included in "Generate all fields" and nobody notices for a month.
const AI_FIELDS = [
  { key: 'needsPrimary', label: 'Primary reasons for seeking credit' },
  { key: 'needsImmediate', label: 'Immediate needs & objectives' },
  { key: 'needsLongTerm', label: 'Longer term' },
  { key: 'analysisComment', label: 'Analysis, assessment & applicant education' },
  { key: 'optionsComment', label: 'Options presented & recommendation' },
  { key: 'borrowingPowerComment', label: 'Borrowing power' },
  { key: 'depositComment', label: 'Deposit / equity' },
  { key: 'creditHistoryComment', label: 'Credit history' },
  { key: 'securityComment', label: 'Security comments' },
] as const

const AI_FIELD_LABEL: Record<string, string> =
  Object.fromEntries(AI_FIELDS.map(f => [f.key, f.label]))

const when = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU',
    { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

// One place, four call sites. The confidence and source chips were written out
// four times, so the freshness flag would have had to be too - and the fourth
// copy is always the one that gets missed.
// `onAccept` is the manual override: "I have read this and it is still right"
// (or "I have already fixed the one number by hand"). It brings the stamp up to
// date and does not touch a word of the text. Fabio, 8 Sep 2026: "I'd rather
// have a manual override, to avoid losing all data if we choose to quickly
// change a figure ourselves to get rid of the warning sign."
//
// It lives in here rather than beside each textarea because there are four
// copies of that block, and the fourth copy is always the one that gets missed.
function NoteMeta({ meta, freshness, onAccept }: { meta?: NoteStamp; freshness: NoteFreshness; onAccept?: () => void }) {
  const conf = meta?.confidence || ''
  const stale = freshness.state === 'stale'
  const checked = !!meta?.checkedAt
  if (!conf && !meta?.source && !stale && !checked && freshness.state !== 'fresh') return null
  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {conf && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          conf.toLowerCase().includes('high') ? 'bg-green-50 text-green-600' :
          conf.toLowerCase().includes('low') ? 'bg-red-50 text-red-600' :
          'bg-amber-50 text-amber-600'
        }`}>{conf} confidence</span>
      )}
      {meta?.source && <span className="text-[10px] text-gray-400">Source: {meta.source}</span>}
      {stale && (
        <span className="text-[10px] font-medium text-[#8A6218] bg-[#FDF6EC] border border-[#EBD9BE] rounded px-1.5 py-0.5">
          written before {freshness.changes[0]}
        </span>
      )}
      {stale && onAccept && (
        <button onClick={onAccept}
          title="Leaves every word as it is and brings the stamp up to date"
          className="text-[10px] font-medium text-[#7A5F17] bg-white border border-[#EBD9BE] rounded px-1.5 py-0.5 hover:bg-[#FBF5EA] transition">
          This one still reads right
        </button>
      )}
      {freshness.state === 'fresh' && freshness.at && !checked && (
        <span className="text-[10px] text-gray-400">written {when(freshness.at)} · matches the deal</span>
      )}
      {/* Checked by hand and regenerated are different claims on a regulated
          document, so the file says which one happened, and who. */}
      {freshness.state === 'fresh' && checked && (
        <span className="text-[10px] text-gray-400">
          checked by hand{meta?.checkedBy ? ` by ${meta.checkedBy}` : ''} · {when(meta?.checkedAt)}
        </span>
      )}
    </div>
  )
}

function AIButton({ onClick, loading, label = 'Generate with AI' }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="mt-2 text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v4M9 17v4M3 9h4M17 9h4M9 9l6 6M15 9l-6 6" />
      </svg>
      <span>{loading ? 'Generating...' : label}</span>
    </button>
  )
}

export default function ComplianceForm({ deal, onSaveStatus, onDataChange, onDealPatched, whoElseHere, me }: { whoElseHere?: string; me?: { id?: string | null; name?: string | null };
  deal: any
  onSaveStatus?: (s: SaveStatus) => void
  // THE PAGE KEEPS A COPY OF THE DEAL, AND THIS TAB NEVER TOLD IT ANYTHING.
  //
  // 18 Sep 2026, Richard Lake. Mellissa filled the whole Compliance tab in, left
  // the tab and came back to a blank one - blank notes, blank living expenses,
  // blank risk answers. Kylie could open the same deal and see all of it, which
  // is the whole story in one sentence: the record was never in any danger, the
  // SCREEN was rebuilt from the wrong copy.
  //
  // The deal page loads the row once and holds it. Tabs are rendered with
  // `{stage === 'Compliance' && ...}`, so leaving one destroys the form and
  // coming back builds a new one from that held copy. Fact Find, BC and LO each
  // hand their saved record back up so the copy stays current - FactFindForm
  // :490, LOForm :796 and :873, BCForm :976. Compliance was the only one of the
  // four that did not, so its copy stayed as it was when the deal was opened,
  // and a rebuilt tab showed a record from before any of the work was done.
  //
  // Every record this screen puts up goes through here.
  onDataChange?: (d: ComplianceData) => void
  // The deal structure block writes compliance_data itself; this lets the page
  // know, so the screen does not sit on a stale copy until a reload.
  onDealPatched?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()

  // WHAT THE NOTES WERE WRITTEN FROM. Six headline facts, every figure on the
  // fact find by name, and a fingerprint of the whole block for anything those
  // two miss. Before the named figures existed, a credit card limit moving came
  // out as "something in the fact find changed" - see lib/deal-figures.ts.
  // Taken of whichever deal it is handed, because a box composed from the
  // record as it is RIGHT NOW must be stamped with those facts and not with the
  // ones the page happens to be holding. See freshDeal() below.
  const factsOf = (from: any): NoteFacts => {
    const lo = from?.lo_data || {}
    const row = dealRow(from)
    // The chosen OPTION. Matching on the bank's name alone took whichever of
    // two same-bank products came first. See lib/recommended-option.ts.
    const rec = recommendedOption(lo) || lo.lenders?.[0] || {}
    const funds = fundsToComplete(from)
    return noteFacts({
      lender: String(lo.recommendedLender || ''),
      loanAmount: money(dealLoanAmount(lo, from?.bc_data || {})),
      purpose: purposeSummary(from),
      fundsToComplete: funds.applies && funds.workable ? (funds.toFind > 0 ? money(funds.toFind) : 'nil') : '',
      approval: row.preApproval ? 'a pre-approval' : 'a formal approval',
      product: String(rec.productName || ''),
    }, factsBlock(dealFacts(from)), dealFigures(from))
  }

  const nowFacts: NoteFacts = useMemo(() => factsOf(deal), [deal])

  // WHO THE BANK RINGS. The deal's ASSIGNED credit assessor, not whoever is
  // logged in - the broker generates these notes as often as the assessor does,
  // and a submission telling a lender to ring the broker about a credit question
  // is worse than the block of names this replaces.
  const [assessor, setAssessor] = useState<Assessor | null>(null)
  useEffect(() => {
    if (!deal?.assigned_credit_officer) { setAssessor(null); return }
    supabase.from('credit_officers').select('name, phone').eq('id', deal.assigned_credit_officer).maybeSingle()
      .then(({ data }) => setAssessor(data ? { name: (data as any).name || '', phone: (data as any).phone || '' } : null))
  }, [deal?.assigned_credit_officer])

  // Whose copy is on screen, and whether writing it would cost anybody
  // anything — see lib/save-conflict.ts.
  // Seeded below, once shape() exists - see the note in FactFindForm. It has to
  // hold what the SCREEN holds, and the screen is shaped.
  const guardRef = useRef<ReturnType<typeof newGuard> | null>(null)
  // WHICH BOX IS IN USE RIGHT NOW. See lib/field-ownership.ts. This tab has
  // eleven free text boxes, nine of them the regulated write-ups.
  const ownRef = useRef(newOwnership())
  // NO NOTES ABOUT OTHER PEOPLE.
  //
  // There were three: "their fields came in", "you were behind", "you saved
  // over theirs". Every one existed because the two screens did not agree and
  // somebody had to be told after the fact. With live editing they agree as it
  // happens, so there is nothing left to report - you watch the number change
  // instead of being told that it did.
  // Fabio, 8 Sep 2026: "I don't want any warnings. I just want it to work."
  //
  // Real errors are untouched: a refused wipe, or a save that did not land,
  // still show beside the deal name - those are things that went wrong, not
  // things somebody else did.

  const [styleNotes, setStyleNotes] = useState<string[]>([])
  const [flaggingField, setFlaggingField] = useState<string | null>(null)
  const [flagNote, setFlagNote] = useState('')
  const [flagSubmitting, setFlagSubmitting] = useState(false)

  async function submitFlag(fieldKey: string, fieldLabel: string) {
    if (!flagNote.trim()) return
    setFlagSubmitting(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('compliance_flags').insert({
      deal_id: deal.id,
      field_key: fieldKey,
      field_label: fieldLabel,
      note: flagNote.trim(),
      flagged_by: userData?.user?.email || 'unknown'
    })
    setFlagSubmitting(false)
    if (error) {
      alert('Error submitting flag: ' + error.message)
      return
    }
    setFlaggingField(null)
    setFlagNote('')
  }

  useEffect(() => {
    supabase.from('settings').select('compliance_style_notes').eq('id', 'singleton').single().then(({ data }) => {
      if (data?.compliance_style_notes?.length) setStyleNotes(data.compliance_style_notes)
    })
  }, [])
  const saveKey = `compliance_${deal.id}`
  const bc = deal.bc_data || {}
  const lo = deal.lo_data || {}

  // The fact find, not the BC. This used to require `bc.joint === 'Yes' &&
  // bc.jointFirstName` - and jointFirstName is built when the BC email is
  // generated and never written into bc_data, so the second applicant was never
  // added to ANY joint deal. See lib/applicants.ts.
  const getApplicants = (): Applicant[] => applicantsOf(deal, bc) as Applicant[]

  // A SAVED RECORD IS TRUSTED FOR WHAT IT HOLDS, NOT FOR WHAT IT IS MISSING.
  //
  // 10 Sep 2026, Wesley Perrott: the compliance tab would not load at all. Its
  // compliance_data was a real object - written by the deal structure block,
  // which saves securityAddress and the split detail into the same column - but
  // it had never held applicants, risks, productReqs or expenses, because nobody
  // had opened this tab.
  //
  // This function returned that record untouched the moment it was non-empty. So
  // the very first render reached `d.applicants.map(...)` on undefined and the
  // whole page died: "This page couldn't load", every other tab fine. The effect
  // below that fills the applicants in runs AFTER the first render, so it never
  // got the chance.
  //
  // Every deal whose structure block was filled in before the compliance tab was
  // opened is in this state. The defaults are built first now and the saved
  // record laid over the top, so a missing section is a blank section rather
  // than a broken page. Nothing saved is ever discarded.
  // EVERY RECORD THAT REACHES THIS SCREEN COMES THROUGH HERE.
  //
  // 10 Sep 2026, the second half of the Wesley Perrott failure. The first fix
  // guarded the record the page opens with. It did not guard the FOUR other
  // ways a record gets onto this screen - the re-read below, an adopt, a merge,
  // and somebody else's live save - and the re-read is the one that was killing
  // the tab. It fetched compliance_data fresh and called setD on it raw:
  //
  //     const loaded = { ...(data.compliance_data as ComplianceData) }
  //     setD(loaded)
  //
  // Wesley's record is {preApproval, securityAddress} and nothing else, so the
  // render after that read d.applicants[0] off undefined. That is why the crash
  // did not move when the first fix shipped, and why it arrived a moment AFTER
  // the tab opened rather than on the first render.
  //
  // So there is now one door. Anything from the database is shaped on the way
  // in, wherever it came from. The guard is still given the record EXACTLY as
  // stored - shaping is for the screen, never for what we claim to have read.
  const shape = (incoming: any): ComplianceData => {
    const stored: any = (incoming && Object.keys(incoming).length > 0) ? incoming : null
    const apps = getApplicants()
    const risks: Record<string, RiskData> = {}
    apps.forEach(a => { risks[a.name] = defaultRisk() })

    const loLenders = lo.lenders || []
    const hasVariable = loLenders.some((l: any) => l.variablePI?.enabled || l.variableIO?.enabled)
    const hasFixed = loLenders.some((l: any) => l.fixedPI?.enabled || l.fixedIO?.enabled)
    // Same rule as the write-up and the comparison - lib/offset.ts. The old
    // test here missed a lowercase "no" and anything worded "No offset".
    const hasOffset = loLenders.some((l: any) => productHasOffset(l.offsetAccount))
    const approvalMentioned = (lo.additionalNotes || '').toLowerCase().includes('turnaround') || (lo.additionalNotes || '').toLowerCase().includes('approval')

    const pReqs = defaultProductReqs()
    if (hasVariable) pReqs.variableRate = 'Important'
    if (hasFixed) pReqs.fixedRate = 'Important'
    if (!hasFixed && hasVariable) pReqs.fixedRate = 'Not important'
    if (hasOffset) pReqs.offsetAccount = 'Important'
    pReqs.redraw = 'Important'
    pReqs.principalAndInterest = loLenders.some((l: any) => l.variablePI?.enabled || l.fixedPI?.enabled) ? 'Important' : 'Not important'
    pReqs.interestOnly = loLenders.some((l: any) => l.variableIO?.enabled || l.fixedIO?.enabled) ? 'Important' : 'Not important'
    if (approvalMentioned) pReqs.approvedQuickly = 'Most important'

    const ff = deal.fact_find_data || {}
    const ffApp = (ff.applicants || [])[0] || {}
    const currentAddress = (ffApp.addresses || []).find((a: any) => a.isCurrent)
    let rentMonthlyAmount = ''
    if (currentAddress && (currentAddress.residentialStatus === 'Renting' || currentAddress.residentialStatus === 'Boarding') && currentAddress.housingExpenseAmount) {
      const amount = Number(currentAddress.housingExpenseAmount) || 0
      rentMonthlyAmount = currentAddress.housingExpenseFrequency === 'Weekly'
        ? Math.round(amount * 52 / 12).toString()
        : amount.toString()
    }

    const blank: ComplianceData = {
      entityType: 'Individual(s)',
      applicants: apps,
      needsPrimary: '', needsImmediate: '', needsLongTerm: '',
      // Was decided by whether the scenario NAME contained "investment", so a
      // refinance releasing equity for an investment was filed Owner occupied.
      // Now read from the splits, the properties and what is being bought.
      requirementsType: dealPurpose(deal).binary,
      risks,
      productReqs: pReqs,
      analysisComment: '', optionsComment: '', borrowingPowerComment: '',
      depositComment: '', creditHistoryComment: '', securityComment: '',
      applicationSubmissionComment: '',
      expenses: defaultExpenses(apps, rentMonthlyAmount),
      aiMeta: {},
      clientAgreedLender: '',
      clientChosenLender: '',
      clientChosenLenderOther: '',
      clientChosenLenderReason: ''
    }

    // See lib/record-defaults.ts for the Wesley Perrott failure this prevents,
    // and its tests for every shape a saved record has turned up in.
    const shaped = withDefaults<ComplianceData>(stored, blank, {
      applicants: 'arrayNotEmpty',   // the page reads d.applicants[0] on the first render
      risks: 'object',
      productReqs: 'object',
      expenses: 'object',
      aiMeta: 'object',
    })

    // WHO IS ON THE DEAL IS NOT STORED STATE. IT IS DERIVED, EVERY TIME.
    //
    // 14 Sep 2026. The robot caught box one writing two names on the first press
    // and one on the second, on the same deal, seconds apart:
    //
    //   "Kylie Searle and TestFabioKylie Test are borrowing..."
    //   "TestFabioKylie Test is borrowing..."
    //
    // Nobody touched the fact find in between. What happened is that a saved
    // compliance record from before the second applicant existed carries its own
    // one-name `applicants` array, and withDefaults quite correctly keeps a
    // stored array that is present and non-empty. So every door that re-shapes a
    // record - the first render, the live column, an adopt, a merge, the mount
    // re-read - quietly put the OLD list back, and whichever press landed after
    // one of those named one borrower.
    //
    // The effect below already says out loud that this list is derived: it
    // overwrites `applicants` with applicantsOf(deal) whenever the fact find
    // changes. It just could not win a race against a read that arrived later.
    //
    // On a joint file that is the Chapman failure all over again - two people
    // borrowing, a compliance pack naming one, and a handover going to the lender
    // that way. Fabio, 2 Sep 2026: "it is always should be both and on the
    // handover." So the fact find wins here, permanently, and the race has
    // nothing left to decide.
    //
    // Risks are keyed by applicant NAME, so a name that is only now appearing
    // needs its own blank set - otherwise the render reads risks[name] off
    // undefined, which is exactly how Wesley crashed.
    const derivedRisks = { ...(shaped.risks || {}) }
    apps.forEach(a => { if (!derivedRisks[a.name]) derivedRisks[a.name] = defaultRisk() })

    // requirementsType is the SAME KIND OF THING and was three lines away: the
    // effect below forces it from dealPurpose(deal) on every deal change, so it
    // is derived too, and a stored copy restoring itself is the same race. Owner
    // occupied against investment decides how the whole pack reads.
    return { ...shaped, applicants: apps, risks: derivedRisks,
             requirementsType: dealPurpose(deal).binary }
  }

  const initData = (): ComplianceData => shape(deal?.compliance_data)
  // Now that shape() exists. Once, on the first render.
  if (!guardRef.current) guardRef.current = newGuard(shape(deal?.compliance_data))
  const guard = guardRef.current

  const [d, setD] = useState<ComplianceData>(initData)
  // WHAT THIS SCREEN HELD WHEN IT OPENED, and what it holds right now. The late
  // read below uses the two to tell "nobody has touched this" from "somebody has
  // typed, or pressed a button" - see that effect for what went wrong without it.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const atOpen = useRef<string | null>(null)
  if (atOpen.current === null) atOpen.current = JSON.stringify(d)
  const liveD = useRef<ComplianceData>(d)
  liveD.current = d

  // EVERY RECORD THIS SCREEN PUTS UP GOES TO THE PAGE TOO. See onDataChange at
  // the top of this file for the Richard Lake failure this closes.
  //
  // Read through a ref, and never re-made. The autosave is a useCallback that
  // holds on to this, and the effect that debounces the save lists that callback
  // as a dependency - so a function that changed identity on every render would
  // clear and restart the 700ms timer on every render, and a form being
  // re-rendered steadily would never save at all. Worth the extra three lines.
  const reportUp = useRef(onDataChange)
  reportUp.current = onDataChange
  const putOnScreen = useCallback((next: ComplianceData) => {
    setD(next)
    reportUp.current?.(next)
  }, [])

  // SOMEBODY ELSE JUST SAVED. Their fields land on this screen without
  // disturbing a single thing this person has typed - see
  // components/useLiveColumn.ts for the rule, and lib/live-deal.ts for why.
  useLiveColumn({ dealId: deal.id, column: 'compliance_data', meId: me?.id, guard,
                  current: () => d, apply: v => putOnScreen(shape(keepOwned(v, liveD.current, ownRef.current))), shape })

  // ONE LAST WRITE AS THE PAGE GOES. See components/useKeepalive.ts.
  useKeepalive({ dealId: deal.id, column: 'compliance_data', own: ownRef.current, current: () => liveD.current })


  useEffect(() => {
    const freshApps = getApplicants()
    const freshRequirementsType = dealPurpose(deal).binary
    const ffLive = deal.fact_find_data || {}
    const loLive = deal.lo_data || {}
    setD(prev => {
      const newRisks = { ...prev.risks }
      freshApps.forEach(a => { if (!newRisks[a.name]) newRisks[a.name] = defaultRisk() })
      return {
        ...prev,
        applicants: freshApps,
        requirementsType: freshRequirementsType,
        risks: newRisks,
        needsPrimary: prev.needsPrimary || ffLive.loanPurpose || '',
        needsImmediate: prev.needsImmediate || ffLive.goals2Years || '',
        needsLongTerm: prev.needsLongTerm || ffLive.goals10Years || '',
        clientAgreedLender: prev.clientAgreedLender || loLive.clientAgreedLender || '',
        clientChosenLender: prev.clientChosenLender || loLive.clientChosenLender || '',
        clientChosenLenderOther: prev.clientChosenLenderOther || loLive.clientChosenLenderOther || '',
        clientChosenLenderReason: prev.clientChosenLenderReason || loLive.clientChosenLenderReason || '',
      }
    })
  }, [deal.bc_data, deal.fact_find_data, deal.lo_data])
  const [activeApplicant, setActiveApplicant] = useState(0)

  // Everything the fact find has recorded as a debt, offered for ticking. The
  // team was being asked "what is closing?" in Slack after the pack had gone.
  const factFindLiabilities = (): LiabilityChoice[] => {
    const ff = deal.fact_find_data || {}
    const rows: LiabilityChoice[] = []
    for (const l of (ff.liabilities || [])) {
      const bits = [l.lenderName, l.limitAmount ? `limit $${l.limitAmount}` : (l.balance ? `$${l.balance}` : '')]
      rows.push({ id: String(l.id || rows.length), label: l.liabilityType || 'Liability',
                  detail: bits.filter(Boolean).join(' · '), closing: false })
    }
    // A property loan being refinanced is a liability closing at settlement, and
    // it is the one everybody forgets because it lives under the property.
    for (const prop of (ff.properties || [])) {
      for (const loan of (prop.loans || [])) {
        const bits = [loan.lenderName, loan.balance ? `balance $${loan.balance}` : '']
        rows.push({ id: String(loan.id || `p${rows.length}`), label: 'Home loan',
                    detail: [prop.address, bits.filter(Boolean).join(' · ')].filter(Boolean).join(' · '), closing: false })
      }
    }
    return rows
  }

  const [pushAnswers, setPushAnswers] = useState<PushAnswers>(
    () => (deal.push_answers as PushAnswers) || defaultAnswers(deal, factFindLiabilities()))
  const [showPushForm, setShowPushForm] = useState(false)
  const [findings, setFindings] = useState<Finding[]>([])
  const [showPreflight, setShowPreflight] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  // THE SAVE LINE beside the deal name. What it says, and when it is allowed to
  // say it, lives in components/useSaveIndicator.ts - shared, so BC cannot end up
  // telling Kylie a different story from the Fact Find.
  const save = useSaveIndicator(onSaveStatus)
  // A COPY OF UNSAVED WORK THAT SURVIVES THE TAB DYING. Kept only while the
  // database does not have it, offered rather than applied, and never written
  // to the database by anything here. See lib/draft-store.ts.
  const draft = useDraft({ meId: me?.id, dealId: deal.id, column: 'compliance_data',
                           stored: shape(deal.compliance_data) })
  const [showValidation, setShowValidation] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [stage, setStage] = useState<'needs' | 'risks' | 'product' | 'comments' | 'expenses'>('needs')

  // WHICH HOUSEHOLD IS ON SCREEN.
  //
  // One household - almost every deal - and none of this appears: no tabs, no
  // labels, one set of categories, exactly as it has always been. The tabs only
  // exist once somebody has said on the Fact Find that there is a second
  // household. See lib/households.ts.
  const households = useMemo(() => householdsOf(deal.fact_find_data), [deal.fact_find_data])
  const oneHousehold = households.length <= 1
  const [household, setHousehold] = useState<HouseholdId>('1')
  // An applicant moved out of the household being looked at, or a household was
  // put back together, and the tab is now pointing at nothing.
  useEffect(() => {
    if (!households.some(h => h.id === household)) setHousehold('1')
  }, [households, household])

  // What this tab is looking at, and whose percentage columns belong on it. On a
  // one household deal both are exactly what they have always been: the record
  // in compliance_data.expenses, and every applicant on the deal.
  const shownExpenses = useMemo(() => expensesFor(d, household), [d, household])
  const peopleHere: string[] = useMemo(() => {
    if (oneHousehold) return d.applicants.map((a: Applicant) => a.name)
    const here = households.find(h => h.id === household)
    return here ? here.people.map(p => p.name) : []
  }, [oneHousehold, households, household, d.applicants])
  const [complianceCompletedAt, setComplianceCompletedAt] = useState<string | null>(deal.compliance_completed_at || null)

  // WHAT THE RECORD ACTUALLY HOLDS, NOT WHAT THE PAGE WAS RENDERED WITH.
  //
  // The page is rendered on the server, so by the time it reaches the browser
  // somebody may already have saved this tab. This re-read catches that.
  //
  // It has to tell the save guard, though. The guard was started from the
  // server's copy; replacing what is on screen without moving it means the guard
  // believes the record is something it is not, and the next keystroke looks
  // like a collision that nobody caused. That produced a banner out of thin air.
  //
  // THE GUARD IS GIVEN WHAT THE SCREEN HOLDS, WHICH IS THE SHAPED RECORD.
  //
  // This said the opposite - "EXACTLY what the database held, before the
  // defaults below, or it would never match the stored record" - and that was
  // the whole mistake. What gets SAVED is the shaped record, so the guard has to
  // hold the shaped record or "has anybody typed?" is asked of two different
  // kinds of thing and always answers yes. saveGuarded now puts the stored
  // record through shape() before comparing, so this matches it.
  //
  // AND IT NEVER PUTS ITSELF OVER SOMETHING SOMEBODY HAS ALREADY DONE.
  //
  // 14 Sep 2026, found by the robot. This read is a network round trip, and the
  // tab is usable the moment it appears. Press "Write from the deal" inside that
  // window and the freshly composed paragraph was replaced by whatever was last
  // saved - on the test deal, a version written when it had ONE applicant, so a
  // joint file silently went back to naming one borrower. Typing in that window
  // was reverted the same way.
  //
  // Exactly the fault the internal notes box had, in a second place: a late read
  // that puts the database on screen regardless of what has happened since.
  //
  // The GUARD is still told, always - it has to know what the record holds even
  // when the screen keeps what is on it, or the next save reads as a collision
  // nobody caused. Only the SCREEN is left alone.
  useEffect(() => {
    supabase.from('deals').select('compliance_data').eq('id', deal.id).single().then(({ data }) => {
      if (data?.compliance_data && Object.keys(data.compliance_data).length > 0) {
        // shape(), not a spread. A record written by the deal structure block
        // has no applicants, no risks and no expenses in it, and this screen
        // renders all three. Wesley Perrott, 10 Sep 2026.
        const stored = shape(data.compliance_data)
        adopt(guard, stored)

        // NOTHING HAS HAPPENED HERE YET. Put the record up, as it always did.
        if (JSON.stringify(liveD.current) === atOpen.current) { putOnScreen(stored); return }

        // SOMETHING HAS. AND GIVING UP HERE IS WHAT COST MELLISSA AN AFTERNOON.
        //
        // 21 Sep 2026. This used to return at this point - leave the screen
        // alone, say nothing - and the reasoning was sound: never write over
        // what somebody is in the middle of typing.
        //
        // It fires far more often than it was meant to. The effect above fills
        // needsPrimary, needsImmediate and needsLongTerm from the fact find the
        // instant this form mounts, so `liveD` has already moved before the
        // round trip comes back, on every single open, with nobody having
        // touched a key. The repair therefore almost never ran - and least of
        // all on the screens that needed it, because a tab that opened from a
        // stale copy is exactly the one somebody is about to type into.
        //
        // The robot has it on the record: type on Compliance, change tab, come
        // back, and the box holds a version from two runs ago. Saved: yes. On
        // screen: no.
        //
        // So it no longer chooses between the two. It MERGES them - the same
        // three-way merge two people editing one deal already go through. What
        // was on screen when this form opened is the base, the database is
        // theirs, what is on screen now is mine. Anything typed here wins;
        // everything the record holds that this screen never had arrives around
        // it. See lib/deal-merge.ts.
        try {
          const merged = merge3(JSON.parse(atOpen.current as string), stored, liveD.current)
          // Not ok means the same field was changed in both, which this cannot
          // settle on its own. Leave the screen alone, exactly as before.
          if (merged.ok) putOnScreen(shape(merged.merged))
        } catch { /* a base that will not parse is no base. Leave the screen. */ }
      }
    })
  }, [])

  // Name to id, so the lender the client accepted can be recorded on the deal.
  const [lenderIdByName, setLenderIdByName] = useState<Record<string, string>>({})
  useEffect(() => {
    supabase.from('lenders').select('id, name').then(({ data }) => {
      const byName: Record<string, string> = {}
      ;(data || []).forEach((l: any) => { byName[String(l.name || '').trim().toLowerCase()] = l.id })
      setLenderIdByName(byName)
    })
  }, [])

  // WRITE IT NOW, NOT IN 700 MILLISECONDS - AND NEVER THROW IT AWAY.
  //
  // This effect used to end with `return () => clearTimeout(t)`. Changing tab
  // takes the form off the screen, which runs that cleanup, which CANCELS a save
  // that has not fired yet. Work was not overwritten and not lost in a collision
  // - it was thrown away by us, every time somebody changed tab within 700ms of
  // typing. See LOForm for the Aaron Hooper case that found it, 14 Sep 2026.
  const writeNow = useCallback(async () => {
    // The lender the CLIENT actually accepted goes onto the deal.
    //
    // Compliance already asks whether they took the recommendation or chose
    // something else. Until now that answer stayed inside compliance_data, so
    // `deals.lender_id` — which the commission maths, the clawback window and
    // the settlement board all read — kept whatever the LO recommended, even
    // when the client went elsewhere.
    const chosenName = liveD.current.clientAgreedLender === 'No'
      ? (liveD.current.clientChosenLender === '__other__' ? liveD.current.clientChosenLenderOther : liveD.current.clientChosenLender)
      : ''
    const chosenId = chosenName ? lenderIdByName[String(chosenName).trim().toLowerCase()] : null

    ;(async () => {
      // The payload as it is at THIS moment. settleSaved below compares it
      // against the screen as it will be when the save returns.
      const payload = liveD.current
      const token = save.starting()
      const out = await saveGuarded({
        supabase, dealId: deal.id, column: 'compliance_data', guard, savedBy: me, tabLabel: 'Compliance', value: payload, shape,
        patch: chosenId ? { lender_id: chosenId } : undefined,
        // Nothing typed here yet and somebody else has saved: take their
        // version rather than telling this person off for looking at a deal.
        // Shaped, so it is exactly what a fresh load would have put on screen.
        onAdopt: stored => { if (stored) putOnScreen(shape(keepOwned(stored, liveD.current, ownRef.current))) },
        // Their fields, folded onto a screen somebody is typing into. A state
        // update, not a rebuild - nobody loses the sentence they are writing.
        onMerge: merged => putOnScreen(shape(keepOwned(merged, liveD.current, ownRef.current))),
      })
      if (out.kind === 'superseded') return
      if (out.kind === 'error') { console.error('Compliance autosave:', out.message); save.failed(out.message, out.technical); return }
      // 'settled' and 'behind' mean the database had nothing to do: in sync, but no
      // moment worth putting a time on.
      save.landed(token, out.kind === 'saved' || out.kind === 'merged' || out.kind === 'overwrote')
      // It is in the database now, so the copy has done its job.
      draft.clear()
      // AND THE PAGE IS TOLD. Without this the page's copy of compliance_data
      // stays as it was when the deal was opened, and changing tab and coming
      // back rebuilds this form from it. See onDataChange at the top.
      reportUp.current?.(payload)
      settleSaved(ownRef.current, payload, liveD.current)
    })()
  }, [deal.id, me, lenderIdByName, guard, save])

  const flush = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    void writeNow()
  }, [writeNow])

  useEffect(() => {
    // The database is the only store - no localStorage copy. Debounced because
    // this previously wrote on every keystroke, and the row count is checked
    // because a refused write returns zero rows with no error.
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // The save line stops saying "saved" NOW, not in 700ms. See
    // components/useSaveIndicator.ts - the first run of this effect is the form
    // arriving on screen and does not count.
    save.changed()
    draft.keep(liveD.current)
    saveTimer.current = setTimeout(() => { void writeNow() }, 700)
  }, [d, writeNow, save])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      // TAKEN OFF SCREEN. Whatever is pending goes NOW. This used to cancel it.
      flush()
    }
  }, [flush])

  function updateRisk(applicant: string, field: keyof RiskData, value: string) {
    setD(prev => ({ ...prev, risks: { ...prev.risks, [applicant]: { ...prev.risks[applicant], [field]: value } } }))
  }

  function updateProductReqs(field: keyof ProductReqs, value: string) {
    setD(prev => ({ ...prev, productReqs: { ...prev.productReqs, [field]: value } }))
  }

  // EVERY EXPENSE WRITE GOES THROUGH HERE.
  //
  // Household 1 is compliance_data.expenses and stays there - every deal ever
  // assessed has its figures in that field and nothing is migrated. Households
  // two and three go in expensesByHousehold. See lib/household-expenses.ts.
  function patchExpenses(key: string, change: (entry: any) => any) {
    setD(prev => {
      const current = expensesFor(prev, household)
      const entry = current[key] ?? { monthlyAmount: '', comment: '', splits: {} }
      const next = { ...current, [key]: change(entry) }
      return { ...prev, ...writeExpenses(prev, household, next) } as any
    })
  }

  function updateExpense(key: string, field: 'monthlyAmount' | 'comment', value: string) {
    patchExpenses(key, entry => ({ ...entry, [field]: value }))
  }

  function setExpenseHem(key: string, answer: HemAnswer | '') {
    patchExpenses(key, entry => ({ ...entry, hem: answer }))
  }

  function updateExpenseSplit(key: string, applicantName: string, value: string) {
    // A saved record keeps its own expenses object, so a category added to
    // EXPENSE_CATEGORIES after that record was written is simply not in it. The
    // row still renders, and typing in it used to read .splits off undefined -
    // the same shape as the Wesley crash. patchExpenses defaults the entry.
    patchExpenses(key, entry => ({ ...entry, splits: { ...(entry?.splits || {}), [applicantName]: value } }))
  }

  // Every question on the Risks tab. Used to tell "nobody has started this
  // applicant" apart from "somebody answered some of it".
  const RISK_KEYS = ['financialExperience', 'interestRateConcern', 'loanFlexibility', 'jobSecurity',
                     'propertyValueConcern', 'adverseChanges', 'beneficialChanges', 'retirementAge',
                     'repaymentMethod', 'emergencyFund', 'maintainLifestyle', 'adequateInsurance',
                     'hasWill', 'circumstancesImpact', 'problemsMeetingCommitments',
                     'officerInLiquidation', 'unsatisfiedJudgements', 'simultaneousApplications',
                     'declaredBankrupt']

  const riskStarted = (name: string): boolean => {
    const r: any = d.risks[name]
    return !!r && RISK_KEYS.some(k => String(r[k] || '').trim())
  }

  function validateBeforePush(): string[] {
    const errors: string[] = []
    if (!d.needsPrimary) errors.push('Needs & objectives — Primary reasons not filled')
    if (!d.needsImmediate) errors.push('Needs & objectives — Immediate needs not filled')
    if (!d.needsLongTerm) errors.push('Needs & objectives — Long term needs not filled')
    d.applicants.forEach(a => {
      const r = d.risks[a.name]
      if (!r || !RISK_KEYS.some(k => String((r as any)[k] || '').trim())) {
        errors.push(`${a.name} — no risk questions answered at all. Every applicant is asked, not one of them.`)
        return
      }
      if (!r.adverseChanges) errors.push(`${a.name} — Adverse changes not answered`)
      if (!r.beneficialChanges) errors.push(`${a.name} — Beneficial changes not answered`)
      if (!r.retirementAge) errors.push(`${a.name} — Retirement age not filled`)
      if (!r.problemsMeetingCommitments) errors.push(`${a.name} — Credit history: problems meeting commitments not answered`)
      if (!r.officerInLiquidation) errors.push(`${a.name} — Credit history: officer in liquidation not answered`)
      if (!r.unsatisfiedJudgements) errors.push(`${a.name} — Credit history: unsatisfied judgements not answered`)
      if (!r.simultaneousApplications) errors.push(`${a.name} — Credit history: simultaneous applications not answered`)
      if (!r.declaredBankrupt) errors.push(`${a.name} — Credit history: declared bankrupt not answered`)
    })
    if (!d.analysisComment) errors.push('Broker comments — Analysis & assessment not filled')
    if (!d.optionsComment) errors.push('Broker comments — Options & recommendation not filled')
    if (!d.borrowingPowerComment) errors.push('Broker comments — Borrowing power not filled')
    if (!d.depositComment) errors.push('Broker comments — Deposit/equity not filled')
    if (!d.creditHistoryComment) errors.push('Broker comments — Credit history not filled')
    if (!d.securityComment) errors.push('Broker comments — Security not filled')
    return errors
  }

  // BOX ONE IS COMPOSED, NOT GENERATED.
  //
  // Every sentence is assembled from a recorded field - see lib/box-one.ts.
  // There is no model in it, so it cannot invent a purpose, a feature or a
  // figure, and the same deal reads the same way every time it is written. The
  // other eight boxes are untouched.
  const [boxGaps, setBoxGaps] = useState<Record<string, Gap[]>>({})

  // The three needs and objectives boxes, all composed the same way.
  const COMPOSERS: Record<string, (deal: any) => { text: string; gaps: Gap[] }> = {
    needsPrimary: boxOne,
    needsImmediate: boxTwo,
    needsLongTerm: boxThree,
    analysisComment: boxFour,
    depositComment: boxSeven,
    creditHistoryComment: boxEight,
    securityComment: boxNine,
    optionsComment: boxFive,
    borrowingPowerComment: boxSix,
  }

  // THE RECORD AT THE MOMENT THE BUTTON IS PRESSED.
  //
  // 16 Sep 2026. These boxes composed from the copy of the deal the page was
  // handed when it drew. Yesterday's fix made each tab report its edits up, so
  // one person moving between tabs composes from what they just typed - but
  // that covers one person in one window.
  //
  // It does not cover the credit officer. She is in the same deal in her own
  // window putting the rates in while the broker has Compliance open; his page
  // was loaded before her work existed, and nothing about her saving reaches
  // him, because live editing is off on purpose. He presses the button and gets
  // regulated wording composed from a deal twenty minutes old, with nothing on
  // screen to say so.
  //
  // A compliance box is the one thing in this portal that must never be built
  // from a copy. So it reads the four records back before it writes a word.
  async function freshDeal(): Promise<{ deal: any; fromRecord: boolean }> {
    const { data, error } = await supabase.from('deals')
      .select('fact_find_data,bc_data,lo_data,compliance_data')
      .eq('id', deal.id).maybeSingle()
    // A failed read is not a reason to refuse to write the box - that would be
    // the portal getting in the way over a network hiccup. It falls back to the
    // page's copy, which is exactly what this did before, and SAYS SO in the
    // stamp so the file records which of the two happened.
    if (error || !data) return { deal, fromRecord: false }
    return { deal: { ...deal, ...data }, fromRecord: true }
  }

  async function compose(field: string) {
    setGenerating(prev => ({ ...prev, [field]: true }))
    try {
      const { deal: from, fromRecord } = await freshDeal()
      const r = COMPOSERS[field](from)
      const facts = factsOf(from)
      setBoxGaps(prev => ({ ...prev, [field]: r.gaps }))
      setD(prev => ({ ...prev, [field]: r.text,
        aiMeta: { ...prev.aiMeta, [field]: {
          confidence: r.gaps.length === 0 ? 'High' : 'Medium',
          source: (r.gaps.length === 0
            ? 'Composed from the deal - fact find, BC and lending options'
            : 'Composed from the deal. Not recorded: ' + r.gaps.map(g => g.what).join('; '))
            + (fromRecord ? '' : ' (read from this screen - the saved record could not be reached)'),
          at: new Date().toISOString(), facts } } }))
    } finally {
      setGenerating(prev => ({ ...prev, [field]: false }))
    }
  }

  async function generateField(field: string) {
    if (COMPOSERS[field]) { await compose(field); return }
    setGenerating(prev => ({ ...prev, [field]: true }))
    const recLender = recommendedOption(lo) || lo.lenders?.[0] || {}
    // The model is told plainly how many people this loan is for. It used to be
    // handed one joined-up string and wrote about "her" on a couple's file.
    const context = {
      applicantCount: d.applicants.length,
      applicantNames: d.applicants.map(a => a.name),
      howToRefer: d.applicants.length > 1
        ? `This is a JOINT application for ${d.applicants.length} applicants: ${d.applicants.map(a => a.name).join(' and ')}. `
          + `Write in the plural - "the applicants", "they", "their". Do not use "she", "her", "he" or "his" `
          + `except where a fact belongs to one of them alone.`
        : `This is a single applicant: ${d.applicants?.[0]?.name || 'the applicant'}. The singular is correct.`,
      clientName: d.applicants.map(a => a.name).join(' and '),
      loanAmount: dealLoanAmount(lo, bc),
      purchasePrice: bc.purchasePrice || '',
      deposit: bc.deposit || '',
      loanType: bc.template || '',
      incomeBase: bc.incomeBase || '',
      incomeOther: bc.incomeOther || '',
      incomeRental: bc.incomeRental || '',
      lender: recLender.lenderName || '',
      product: recLender.productName || '',
      rate: recLender.variablePI?.rate || recLender.fixedPI?.rate || '',
      recommendedLender: (() => {
        if (d.clientAgreedLender === 'No') {
          const chosen = d.clientChosenLender === '__other__' ? d.clientChosenLenderOther : d.clientChosenLender
          return chosen || lo.recommendedLender || ''
        }
        return lo.recommendedLender || ''
      })(),
      originalRecommendedLender: lo.recommendedLender || '',
      clientAgreedLender: d.clientAgreedLender || '',
      clientChosenLenderReason: d.clientChosenLenderReason || '',
      recommendationNote: lo.recommendationNote || '',
      allLenders: (lo.lenders || []).map((l: any) => `${l.lenderName} ${l.productName}`).join(', '),
      applicationFee: recLender.applicationFee || '',
      annualFee: recLender.annualFee || '',
      offsetAccount: recLender.offsetAccount || '',
      // `redraw` used to sit here as recLender.redraw, which does not exist -
      // not on a lender option, not in the lender library, nowhere. So every
      // deal ever generated told the model "Redraw = not specified", and since
      // the prompts forbid naming a feature that is not confirmed, no compliance
      // note could ever mention redraw even on a product that has it. A feature
      // nobody records is not a feature to ask about.
      needsPrimary: d.needsPrimary,
      needsImmediate: d.needsImmediate,
      needsLongTerm: d.needsLongTerm,
      risks: JSON.stringify(d.risks),
      productReqs: JSON.stringify(d.productReqs),
      criteriaUsed: (lo.criteriaUsed || []).join(', '),
      additionalNotes: lo.additionalNotes || '',
      existingLoan: bc.existingLoanBal || '',
      dependants: bc.dependants || '0',
      ccLimit: bc.ccLimit || '',
      suburb: bc.suburb || '',
      propertyType: bc.propertyType || '',
      loanPurpose: (deal.fact_find_data || {}).loanPurpose || '',
      goals2Years: (deal.fact_find_data || {}).goals2Years || '',
      goals10Years: (deal.fact_find_data || {}).goals10Years || '',
    }

    const prompts: Record<string, string> = {
      needsPrimary: `CRM FIELD: Primary reasons for seeking credit / your needs and objectives

Cover: purpose of the loan (owner occupied / investment) and why; loan amount and term and why; any specific features, lenders, interest rate types or repayment types requested and why; any flexibility on the client's stated needs and objectives; savings held / retention of savings and why; any personal circumstances that may affect the loan (financial circumstances, employment, family status); whether the client is a first home buyer.

Client: ${context.clientName}. Loan: $${context.loanAmount} for ${context.loanType}. Property location (may be a suburb or a state): ${context.suburb}. Income: $${context.incomeBase} base. Recommended lender: ${context.recommendedLender}, product: ${context.product}. Confirmed product features: Offset account = ${context.offsetAccount || 'not specified'}. Client's own stated purpose for this loan: "${context.loanPurpose || 'not recorded'}". IMPORTANT: only reference a specific loan feature (e.g. offset account) as a benefit if it is confirmed present above — if a feature is not present, describe the general benefit (e.g. reducing debt through extra repayments) without naming a feature the product doesn't have. Write 4-6 sentences, no dot points.`,

      needsImmediate: `CRM FIELD: Immediate needs and objectives — within the next two years (e.g. holiday, purchases, renovations, savings, protect the family, etc)

Cover: what the client might want to achieve in the next 2 years and how it may affect the loan — overseas travel, starting a family, upgrading or changing property, investments.

Client: ${context.clientName}. Loan type: ${context.loanType}. Recommended product features: Offset account = ${context.offsetAccount || 'not specified'}. Client's own stated 2-year goals: "${context.goals2Years || 'not recorded'}". IMPORTANT: only reference a specific loan feature as helping achieve a goal if it is confirmed present above — otherwise describe the general benefit without naming a feature the product doesn't have. Write 3-4 sentences, no dot points.`,

      needsLongTerm: `CRM FIELD: Longer term needs and objectives — between 2 to 10 years (e.g. repay mortgage, buy a new car, education expenses, purchase investment property, retirement planning, etc)

Cover: reducing the home loan and why/how quickly; dependants — commencing or finishing schooling, childcare costs, affordability; retiring before the end of the requested loan term and how this may affect the loan; vehicle or recreational vehicle upgrade and potential timing.

Client: ${context.clientName}. Dependants: ${context.dependants}. Recommended product features: Offset account = ${context.offsetAccount || 'not specified'}. Client's own stated 2-10 year goals: "${context.goals10Years || 'not recorded'}". IMPORTANT: only reference a specific loan feature as helping achieve a goal if it is confirmed present above — otherwise describe the general benefit without naming a feature the product doesn't have. Write 3-4 sentences, no dot points.`,

      analysisComment: `CRM FIELD: Analysis, assessment and applicant education comments
${selfEmployedParagraphsFor(deal).length > 0
  ? '\nA SELF-EMPLOYED INCOME ASSESSMENT HAS ALREADY BEEN WRITTEN and will be placed above whatever you produce. '
    + 'Do not describe how the self-employed income was assessed, do not restate the assessment method, the financial '
    + 'years, the net profit, the add-backs or the assessed figure. Refer to the income only as already assessed.\n'
  : ''}
Write three clearly labelled sections using bold subheadings:

ANALYSIS — cover: purpose of the loan and loan amount; what the client is hoping to achieve short and long term; overview of the client's situation; ages of applicants and whether an exit strategy is required; residential status (renting, boarding, and history); family status and ages of dependants; employment type, income, stability and any recent/upcoming changes; assets and liabilities including any changes (e.g. credit cards being closed or paid out); financial habits (savings held); financial awareness (loan terms, repayments, interest rates); credit history.

ASSESSMENT — cover: the client's personal and financial position including employment stability; the client's wants versus what they actually need; the client's goals, objectives, priorities and preferences; specific requirements (lender, features, repayment type); lender policy, serviceability and borrowing capacity; security type and any postcode restrictions; turnaround times and security property type considerations.

APPLICANT EDUCATION — cover: the level of financial understanding driving the education needed; any mitigants (e.g. the client's situation may limit what's available to them); client wants versus needs; how loan types and features work; repayment types and requirements; any complex scenarios (guarantor, exit strategy, foreseeable changes); applicable fees and charges; government schemes or promotional offers; cashback offers; costs of refinancing/extending loan term; professional packages; fixed rates and break costs; pre-approval requirements; seniors' loans if applicable.

Cover only what the facts above support. Where a section has little to go on, say so in a sentence rather than filling it.`,

      optionsComment: `CRM FIELD: Options presented and recommendation comments

Explain why the recommended product is in the client's best interests, against the other options actually researched.

THE LENDERS CONSIDERED, WITH THEIR NUMBERS

${comparisonBlock(lo).join('\n')}

HOW TO USE THAT

- Work through the research criteria the client said mattered. They are the reason these lenders were shortlisted, so the recommendation is judged against them and not against price alone.
- Where the recommended lender IS the cheapest or the fastest or the only one with the feature, say so and name the figure.
- Where it is NOT — every line under "WHERE THE RECOMMENDATION IS NOT THE CHEAPEST OR BEST" — address that line directly. Name the cheaper lender, name the difference, and say what the client gets in return that justifies it. If nothing in the facts justifies it, say plainly that the recommendation is not the cheapest on that measure and the reason is not recorded. Do not invent a reason.
- Compare only on what is listed above. If a rate, a fee or a feature is not there for a lender, it is not recorded — do not assume it is nil, and do not assume it is worse.

Broker's own recommendation note: ${context.recommendationNote || 'not recorded'}. ${context.clientAgreedLender === 'No' ? `The client did not proceed with the original recommendation and instead selected ${context.recommendedLender}, for the following stated reason: "${context.clientChosenLenderReason || 'not recorded'}". Explain both why the original lender was recommended AND why the client's final choice is understood and documented, referencing their stated reason.` : `The client agreed with and proceeded with the recommended lender.`}`,

      borrowingPowerComment: `CRM FIELD: Borrowing power comments

Explain the client's ability to repay the loan from what is recorded: the income by type and by applicant, the liabilities as listed, the assets held, and the LVR.

Maximum borrowing capacity and debt-to-income ratio are NOT recorded anywhere in this portal and are not to be mentioned. Fabio, 3 Sep 2026: "it's never gonna be present, so I don't want that to be part of the compliance notes." Do not state them, do not estimate them, and do not note their absence — they are simply not part of this field.

If the LVR is on the NOT RECORDED list, say so rather than estimating one.`,

      depositComment: `CRM FIELD: Deposit/Equity comments

Explain the deposit if this is a purchase, or the equity usage if this is a refinance/equity release/cashout — must reference the client's savings position and where funds for completion come from.

Use the FUNDS TO COMPLETE working above — it is calculated from the recorded figures. Name the deposit source. Keep it to a sentence or two.`,

      creditHistoryComment: `CRM FIELD: Credit history comments

Client: ${context.clientName}.

${creditHistoryBlock(creditHistoryFacts(d.risks as any, d.applicants))}

Write it as a sentence or two. Cover what is recorded above and nothing else.`,

      securityComment: `CRM FIELD: Security (property) comments

Add the security if it is a refinance, or write TBA for a pre-approval — must reference the security in question.

Security address as recorded on the deal: ${dealRow(deal).securityAddress || 'not recorded'}. Property type: ${context.propertyType}. Location: ${context.suburb}.

Use the security address exactly as recorded. On a pre-approval it will already read "TBA — <state or suburb>", which is the correct answer: there is no property yet. Do not rewrite it, do not add an address, and do not guess a suburb. One sentence only.`,
    }

    try {
      const res = await fetch('/api/generate-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // How many people this loan is for goes in front of EVERY field, rather
        // than being edited into nine prompt strings one at a time.
        body: JSON.stringify({
          prompt: context.howToRefer + '\n\n' + (prompts[field] || ''),
          // EVERYTHING WE ACTUALLY KNOW, read live from the fact find rather
          // than from the handful of numbers copied onto the BC months ago.
          // This is the fix for "the notes are not picking up the correct data".
          facts: factsBlock(dealFacts(deal)),
          styleNotes,
        })
      })
      const data = await res.json()
      const raw = data.text || ''
      if (raw) {
        const answerMatch = raw.match(/ANSWER:\s*([\s\S]*?)(?:\n\s*CONFIDENCE:|$)/i)
        const confidenceMatch = raw.match(/CONFIDENCE:\s*([\s\S]*?)(?:\n\s*SOURCE:|$)/i)
        const sourceMatch = raw.match(/SOURCE:\s*([\s\S]*?)$/i)
        let answer = answerMatch ? answerMatch[1].trim() : raw.trim()

        // THE SELF-EMPLOYED INCOME IS COMPOSED, NOT WRITTEN.
        //
        // Compliance said nothing at all about how a self-employed income was
        // arrived at, which on a self-employed file is the most questioned part
        // of the whole application. It is now assembled from the recorded fields
        // - the structure, the method, the years, the add-backs, whether the
        // business is profitable - and put in front of whatever the model wrote,
        // word for word. A model asked to describe an income assessment will
        // paraphrase a figure sooner or later; this cannot.
        // See lib/self-employed-facts.ts.
        if (field === 'analysisComment') {
          const composed = selfEmployedParagraphsFor(deal)
          if (composed.length > 0) answer = composed.join('\n\n') + '\n\n' + answer
        }
        const confidence = confidenceMatch ? confidenceMatch[1].trim() : ''
        const source = sourceMatch ? sourceMatch[1].trim() : ''
        // Stamped with what it was written from, at the moment it was written.
        setD(prev => ({ ...prev, [field]: answer,
          aiMeta: { ...prev.aiMeta, [field]: { confidence, source, at: new Date().toISOString(), facts: nowFacts } } }))
      }
    } catch (e) { console.error(e) }
    setGenerating(prev => ({ ...prev, [field]: false }))
  }

  // COMPOSED, NOT GENERATED. There is no model in this - see lib/broker-notes.ts
  // for why. Every sentence is assembled from a recorded value, so it needs no
  // network call and cannot invent an employer name.
  const notes = useMemo(() => brokerNotes(deal, assessor), [deal, assessor])

  function writeBrokerNotes() {
    if (!notes.ready) return
    setD(prev => ({ ...prev, applicationSubmissionComment: notes.text }))
  }

  async function generateAll() {
    for (const f of AI_FIELDS.map(x => x.key)) { await generateField(f) }
  }

  // THE NOTES ARE PROSE, AND PROSE DOES NOT UPDATE ITSELF.
  //
  // Nine paragraphs are written from the deal as it stands and saved. Change the
  // lender afterwards and every figure on screen updates while the prose still
  // names the old one - which on a regulated file is worse than a blank field,
  // because a blank field is obviously unfinished.
  //
  // A warning, never a block. Fabio, 3 Sep 2026, asked for (a): he is the one
  // who knows whether the change actually matters.
  // WHICH NOTES ACTUALLY CARRY THE OLD FIGURE.
  //
  // A change makes every note that was written before it "stale", but only some
  // of them have the number written into them. Fabio, 8 Sep 2026: "if I refresh,
  // I don't want it to start completely everything again."
  //
  // A pointer, not a guarantee - it can find a figure in the text, it cannot
  // know that "the card is being closed" is about the card that moved. The
  // wording on screen says so.
  const figureChangeDetail = useMemo(() => {
    const stamped = Object.values(d.aiMeta || {}).find((m: any) => m?.facts?.figures)?.facts?.figures
    const boxes = AI_FIELDS.map(f => ({ key: f.key, label: f.label, text: String((d as any)[f.key] || '') }))
    return figureChanges(stamped, dealFigures(deal)).map(c => ({
      sentence: c.sentence,
      mentionedIn: notesMentioning(c, boxes),
    }))
  }, [d, deal])

  const notesReview = useMemo(
    () => reviewNotes(AI_FIELDS.map(f => ({ field: f.key, text: (d as any)[f.key] })), d.aiMeta, nowFacts),
    [d, nowFacts])

  const freshnessOf = (key: string): NoteFreshness =>
    noteFreshness((d as any)[key], d.aiMeta?.[key], nowFacts)

  // "They still read right". Re-stamps a stale note against the deal as it is
  // now WITHOUT touching a word of the text, so a note somebody has already
  // corrected by hand stops asking - and the next real change is still caught.
  //
  // Signed, because on a regulated document "somebody read this and confirmed
  // it" is a different claim from "the model rewrote it", and six months from
  // now the file has to be able to tell them apart.
  function acceptedStamp(existing?: NoteStamp): NoteStamp {
    return { ...(existing || {}), facts: nowFacts, checkedBy: me?.name || '', checkedAt: new Date().toISOString() }
  }

  // One box. The whole point of the override: change a figure yourself, clear
  // that one warning, and keep every word of the other eight notes.
  function acceptNote(key: string) {
    setD(prev => ({ ...prev, aiMeta: { ...prev.aiMeta, [key]: acceptedStamp(prev.aiMeta?.[key]) } }))
  }

  function acceptNotesAsTheyAre() {
    setD(prev => {
      const meta = { ...prev.aiMeta }
      for (const key of notesReview.staleFields) meta[key] = acceptedStamp(meta[key])
      return { ...prev, aiMeta: meta }
    })
  }

  async function regenerateStale() {
    for (const key of notesReview.staleFields) { await generateField(key) }
  }

  async function generateNeeds() {
    const fields = ['needsPrimary', 'needsImmediate', 'needsLongTerm']
    for (const f of fields) { await generateField(f) }
  }

  async function markComplianceComplete() {
    const nowIso = new Date().toISOString()
    const { data: rows, error } = await supabase.from('deals')
      .update({ compliance_completed_at: nowIso }).eq('id', deal.id).select('id')
    if (error) { alert('Error marking compliance complete: ' + error.message); return }
    if (!rows || rows.length === 0) {
      alert('NOT SAVED - compliance was not marked complete and the notification was not sent. Do not close this tab.')
      return
    }
    setComplianceCompletedAt(nowIso)
    // The notification is awaited and checked. If it fails the user is told, because
    // otherwise the message claims an email went out that never left the building.
    try {
      const res = await fetch('/api/notify-salestrekker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, trigger: 'push_to_salestrekker' })
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        alert('Compliance is marked complete, but the notification email FAILED to send'
          + (detail ? ' (' + detail.slice(0, 200) + ')' : '')
          + '. Please tell the compliance team directly.')
        return
      }
      alert('Compliance complete - the compliance team has been notified that this deal is ready to be issued.')
    } catch (e: any) {
      alert('Compliance is marked complete, but the notification email FAILED to send ('
        + (e?.message || 'network error') + '). Please tell the compliance team directly.')
    }
  }

  const [downloading, setDownloading] = useState('')
  const pdfBaseName = String((deal as any).deal_name || (deal as any).name || (deal as any).title || 'deal').replace(/[^A-Za-z0-9_-]+/g, '_')

  // The three documents in the pack. Named once so the route, the label and the
  // error message cannot disagree about which one failed.
  const PDF_KINDS = {
    summary:      { route: '/api/generate-summary-pdf',      label: 'Fact Find' },
    compliance:   { route: '/api/generate-compliance-pdf',   label: 'Handover' },
    broker_notes: { route: '/api/generate-broker-notes-pdf', label: 'Broker Notes' },
  } as const

  async function downloadPdf(kind: keyof typeof PDF_KINDS) {
    setDownloading(kind)
    try {
      const res = await fetch(PDF_KINDS[kind].route, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: deal.id })
      })
      if (!res.ok) { alert('Could not generate the ' + PDF_KINDS[kind].label + ' PDF. Nothing was downloaded.'); return }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Both PDFs name themselves after the client - "Fact Find - Natasha
      // Chapman & Richard Chapman.pdf" - so the name the server chose is used
      // rather than the deal record's, which is not a client's name.
      const sent = res.headers.get('Content-Disposition') || ''
      const named = /filename="([^"]+)"/.exec(sent)?.[1]
      a.download = named || (pdfBaseName + '-' + kind + '.pdf')
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Could not generate the ' + kind + ' PDF: ' + (e?.message || 'network error'))
    } finally {
      setDownloading('')
    }
  }

  const [showPositionPrompt, setShowPositionPrompt] = useState(false)
  const [positionChoices, setPositionChoices] = useState<Record<string, boolean>>({})
  const linkableApplicants = ((deal.fact_find_data || {}).applicants || []).filter((a: any) => a.clientId)

  async function updateClientPosition(applicant: any) {
    const ffLive = deal.fact_find_data || {}
    const ownedProperties = (ffLive.properties || []).filter((p: any) => !!p.ownership?.[applicant.id])
    const ownedLiabilities = (ffLive.liabilities || []).filter((l: any) => !!l.ownership?.[applicant.id])
    const ownedAssets = (ffLive.assets || []).filter((a: any) => !!a.ownership?.[applicant.id])
    return await checkedWrite(supabase.from('clients').update({
      position_properties: ownedProperties,
      position_liabilities: ownedLiabilities,
      position_assets: ownedAssets,
      position_updated_at: new Date().toISOString(),
      position_updated_from_deal_id: deal.id
    }).eq('id', applicant.clientId), `${applicant.firstName || 'That applicant'}'s position`)
  }

  async function finalizePush() {
    // The position carried onto the client record is what the next deal for this
    // person starts from. Failing silently here means the next fact find quietly
    // begins from stale figures, so compliance is NOT marked complete until it
    // has actually been written.
    for (const applicant of linkableApplicants) {
      if (positionChoices[applicant.id]) {
        const problem = await updateClientPosition(applicant)
        if (problem) { alert(problem + ' Compliance has not been marked complete.'); return }
      }
    }
    setShowPositionPrompt(false)
    markComplianceComplete()
  }

  // Empty boxes first, then what the writing itself says, then what credit needs
  // to be told. Three gates, in the order somebody can actually act on them.
  function handlePushToSalesTrekker() {
    const errors = validateBeforePush()
    if (errors.length > 0) {
      setValidationErrors(errors)
      setShowValidation(true)
      return
    }
    const found = preflight(deal, d, EXPENSE_CATEGORIES)
    if (found.length > 0) { setFindings(found); setShowPreflight(true); return }
    openPushForm()
  }

  function openPushForm() {
    setShowPreflight(false)
    // Re-read the fact find's liabilities every time rather than trusting what
    // was saved: a debt added since the last push should appear, and one already
    // ticked should stay ticked.
    setPushAnswers(prev => {
      const fresh = factFindLiabilities()
      const was = new Map((prev.liabilities || []).map(l => [l.id, l.closing]))
      return { ...prev, liabilities: fresh.map(l => ({ ...l, closing: was.get(l.id) ?? l.closing })) }
    })
    setShowPushForm(true)
  }

  // The answers are written with the deal, not after it. If this fails, nothing
  // has been marked complete and nothing has been emailed.
  async function confirmPush() {
    setPushing(true)
    const patch: any = {
      push_answers: { ...pushAnswers, pushedAt: new Date().toISOString() },
      is_urgent: !!pushAnswers.urgent,
      compliance_needed_by: pushAnswers.complianceNeededBy || null,
    }
    const problem = await checkedWrite(supabase.from('deals').update(patch).eq('id', deal.id), 'The push answers')
    setPushing(false)
    if (problem) { alert(problem + ' Nothing has been pushed.'); return }
    setShowPushForm(false)
    if (linkableApplicants.length > 0) {
      setPositionChoices(Object.fromEntries(linkableApplicants.map((a: any) => [a.id, true])))
      setShowPositionPrompt(true)
    } else {
      markComplianceComplete()
    }
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2DBEFF]"
  const currentApplicant = d.applicants?.[activeApplicant]
  const currentRisk = d.risks[currentApplicant?.name] || defaultRisk()

  // Once the deal is LODGED this tab is a record, not a workbench. Generating a
  // write-up with AI, or pushing to SalesTrekker again, is offering to redo
  // something that already happened - and the push re-emails both PDFs to the
  // compliance team for a deal that is already with the lender.
  //
  // Folded, not removed. The write-up is a regulated document and it does get
  // corrected after the fact, so it stays one click away and stays editable.
  const past = isWithLender(deal)
  const [showWriteUp, setShowWriteUp] = useState(!past)
  const sentOn = deal.compliance_sent_at || deal.compliance_completed_at || complianceCompletedAt

  const stages = ['needs', 'risks', 'product', 'comments', 'expenses'] as const
  const stageLabels = { needs: 'Needs & objectives', risks: 'Risks', product: 'Product requirements', comments: 'Broker comments', expenses: 'Living expenses' }

  // AN EMPTY APPLICANT LIST IS FINE HERE, AND IS LEFT ALONE.
  //
  // 10 Sep 2026. There was a panel here saying "nobody has been added to this
  // deal". Fabio: "I don't see the point. In the past, if I click on it, it was
  // just empty anyway. I just want the compliance to be empty."
  //
  // He was right, and the code says so: NOTHING below reads the applicant while
  // the page is being drawn. Every read of currentApplicant.name sits inside an
  // onChange, which only runs when somebody types. So an empty list renders an
  // empty tab, exactly as it always did, and a sign would be telling somebody
  // about a problem they do not have.
  //
  // MISSING is what killed Wesley's tab, not EMPTY, and they are not the same:
  // d.applicants[0] on [] is simply undefined, while the same line on undefined
  // throws and takes the page with it. shape() guarantees the key exists and the
  // ?. above means a reach can never throw. That is the whole fix.

  return (
    // LEAVING A BOX WRITES IT, rather than waiting 700ms and hoping nobody
    // changes tab in between.
    <div className="space-y-4" onBlurCapture={() => flush()}>
      {draft.offer && (
        <DraftBanner at={draft.offer.at}
          onRestore={() => { setD(shape(draft.offer!.value)); draft.taken() }}
          onDiscard={draft.dismiss} />
      )}
      {past && (
        <div className="bg-white border border-[#CFE6D5] rounded-xl px-4 py-3.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[.06em] bg-[#F1F7F3] border border-[#CFE6D5] text-[#25794C] rounded-full px-2.5 py-[3px]">
              Compliance sent
            </span>
            <span className="text-[13px] text-[#6E665C]">
              {sentOn ? new Date(sentOn).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              {' '}&middot; both PDFs emailed to the compliance team
            </span>
            <button onClick={() => setShowWriteUp(v => !v)}
              className="ml-auto text-[12.5px] text-[#2DBEFF] hover:underline">
              {showWriteUp ? 'Hide the write-up' : 'Show the write-up'}
            </button>
          </div>
          <p className="text-[11.5px] text-[#A29889] mt-2 mb-0">
            This deal is lodged. The write-up is kept here and can still be corrected, but nothing
            on this tab moves the deal along any more &mdash; it is tracked in After compliance and
            Settlement above.
          </p>
        </div>
      )}

      {(!past || showWriteUp) && (<>
      {/* Stage tabs */}
      <div className="flex bg-white border border-gray-100 rounded-xl p-1 gap-1">
        {stages.map(s => (
          <button key={s} onClick={() => setStage(s)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${stage === s ? 'bg-[#343333] text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            {stageLabels[s]}
          </button>
        ))}
      </div>

      {/* THE DEAL, AS ONE BLOCK. Replaces the four-field "pre-filled from BC
          & LO" strip that used to sit here, and it is the same component the
          Lending options tab shows - one record, no second copy to drift.
          Fabio, 3 Sep 2026: "that will replace these 2 section in LO and
          Compliance (static across)". */}
      <DealStructure deal={deal} onUpdated={onDealPatched} />

      {/* Compliance actions */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            {past ? (
              /* The deal is already with the lender. Pressing this would re-email
                 both PDFs to the compliance team for something that went weeks
                 ago, so it is not a button any more. */
              <div className="text-[13px] text-[#6E665C]">
                <span className="font-semibold text-[#2E2A26]">Already pushed to SalesTrekker.</span>
                <div className="text-[11.5px] text-[#A29889] mt-1 max-w-[52ch]">
                  This deal is lodged. If the write-up genuinely has to go again, send it from the
                  PDFs rather than pushing the deal a second time.
                </div>
              </div>
            ) : (
              <>
                <button onClick={handlePushToSalesTrekker}
                  className="bg-[#343333] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#2a2a2a] transition inline-flex items-center gap-2">
                  Push to SalesTrekker
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                </button>
                <div className="text-[11.5px] text-[#A29889] mt-2.5 max-w-[46ch]">Marks compliance complete and emails both PDFs to the compliance team.</div>
                {complianceCompletedAt && <div className="text-[11.5px] text-green-600 mt-1">✓ Compliance completed</div>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* The PDFs are the record. This is what people type from - copying
                out of a PDF loses the bold and breaks words across lines. */}
            <a href={`/deals/${deal.id}/handover`}
              className="bg-[#141C24] border border-[#141C24] text-white rounded-lg px-3.5 py-2 text-[12.5px] font-semibold hover:bg-[#28323c] transition inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="9" height="11" rx="1.5"/><path d="M11 13v1H2V4h1"/></svg>
              Open to copy
            </a>
            <button onClick={() => downloadPdf('summary')} disabled={!!downloading}
              className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5 disabled:opacity-40">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M3 13h10"/></svg>
              {downloading === 'summary' ? 'Preparing...' : 'Fact Find PDF'}
            </button>
            <button onClick={() => downloadPdf('compliance')} disabled={!!downloading}
              className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5 disabled:opacity-40">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M3 13h10"/></svg>
              {downloading === 'compliance' ? 'Preparing...' : 'Handover PDF'}
            </button>
            <button onClick={() => downloadPdf('broker_notes')} disabled={!!downloading}
              className="bg-[#FAF7F2] border border-[#E8E1D6] text-[#6E665C] rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#F4EEE4] hover:text-[#2E2A26] transition inline-flex items-center gap-1.5 disabled:opacity-40">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M3 13h10"/></svg>
              {downloading === 'broker_notes' ? 'Preparing...' : 'Broker Notes'}
            </button>
          </div>
        </div>
      </div>

      {/* THE DEAL MOVED AFTER THE NOTES WERE WRITTEN.
          A warning, never a block - Fabio picked (a): he is the one who knows
          whether the change matters. It sits above the stage content rather than
          inside one, because the nine notes are spread across two stages and a
          warning you can navigate away from is not a warning. */}
      {notesReview.staleFields.length > 0 && (
        <div className="border border-[#EBD9BE] bg-[#FDF6EC] rounded-xl px-4 py-3.5 mb-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <h4 className="m-0 mb-1 text-[13.5px] font-semibold text-[#221F1B]">
                ⚠ {notesReview.staleFields.length === 1
                  ? 'One note was'
                  : `${notesReview.staleFields.length} notes were`} written before the deal changed
              </h4>
              <p className="m-0 text-[12.5px] text-[#8A6218]">
                {notesReview.staleFields.length === 1 ? 'It still says' : 'They still say'} what
                {notesReview.staleFields.length === 1 ? ' it said' : ' they said'} at the time. Nothing has been
                rewritten — that is yours to decide. Each note below has its own
                <b className="text-[#221F1B]"> This one still reads right</b> button, for when you have fixed a figure
                yourself and only that note needs clearing.
              </p>
              <ul className="mt-1.5 mb-0 pl-5 text-[12.5px] text-[#8A6218]">
                {notesReview.changes.map((c, i) => {
                  // Where that figure is written down, so nobody has to redo
                  // nine notes to fix one.
                  const where = figureChangeDetail.find(f => f.sentence === c)?.mentionedIn || []
                  return (
                    <li key={i} className="mb-1">
                      {c}
                      {where.length > 0 && (
                        <span className="block text-[12px] text-[#A08A5B]">
                          That figure appears in: <b className="text-[#7A5F17]">{where.join(', ')}</b>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {figureChangeDetail.some(f => f.mentionedIn.length > 0) && (
                <p className="m-0 mt-1.5 text-[12px] text-[#A08A5B]">
                  Only where the figure itself is written down — a note can be about something without quoting it.
                </p>
              )}
              <p className="m-0 mt-1.5 text-[12px] text-[#8A6218]">
                {notesReview.writtenAt && <>Oldest written <b className="text-[#221F1B]">{when(notesReview.writtenAt)}</b> · </>}
                {notesReview.staleFields.map(f => AI_FIELD_LABEL[f] || f).join(', ')}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={regenerateStale} disabled={Object.values(generating).some(Boolean)}
                className="bg-[#221F1B] text-white rounded-lg px-3 py-1.5 text-[12.5px] hover:bg-[#3a3733] transition disabled:opacity-40 whitespace-nowrap">
                {Object.values(generating).some(Boolean) ? 'Rewriting…' : `Rewrite ${notesReview.staleFields.length === 1 ? 'it' : `those ${notesReview.staleFields.length}`}`}
              </button>
              {/* Re-stamps them against the deal as it is now, without touching a
                  word - for notes somebody has already corrected by hand. There
                  is the same button on each individual note, for clearing one. */}
              <button onClick={acceptNotesAsTheyAre}
                className="bg-white border border-[#EBD9BE] text-[#7A5F17] rounded-lg px-3 py-1.5 text-[12.5px] hover:bg-[#FBF5EA] transition whitespace-nowrap">
                They all still read right
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE: Needs & Objectives */}
      {stage === 'needs' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <SectionHeader title="Needs & objectives" />
              <AIButton onClick={generateNeeds} loading={['needsPrimary', 'needsImmediate', 'needsLongTerm'].some(f => generating[f])} label="Write all three from the deal" />
            </div>
            {[
              { key: 'needsPrimary', label: 'Primary reasons for seeking credit' },
              { key: 'needsImmediate', label: 'Immediate needs & objectives — next 2 years' },
              { key: 'needsLongTerm', label: 'Longer term — 2 to 10 years' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-4">
                <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                <textarea spellCheck="true" aria-label={label} className={inp + ' min-h-[100px] resize-y'} value={(d as any)[key]}
                  onFocus={() => focusField(ownRef.current, key)}
                  onBlur={() => blurField(ownRef.current, key)}
                  onChange={e => { markDirty(ownRef.current, key); setD(prev => ({ ...prev, [key]: e.target.value })) }}
                  placeholder="Click Write from the deal, or type it yourself..." />
                <AIButton onClick={() => generateField(key)} loading={generating[key]}
                  label={COMPOSERS[key] ? 'Write from the deal' : undefined} />
                <button onClick={() => { setFlaggingField(flaggingField === key ? null : key); setFlagNote('') }} className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
                {flaggingField === key && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} placeholder="What's wrong with this field?" value={flagNote} onChange={e => setFlagNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => submitFlag(key, label)} disabled={flagSubmitting || !flagNote.trim()} className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">{flagSubmitting ? 'Submitting...' : 'Submit flag'}</button>
                      <button onClick={() => { setFlaggingField(null); setFlagNote('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
                {(boxGaps[key] || []).length > 0 && (
                  <div className="mt-2 bg-red-50 border border-red-200 border-l-[3px] border-l-red-600 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-red-800 mb-1">Recorded nowhere — these must be filled in before this file is submitted</p>
                    {(boxGaps[key] || []).map(g => (
                      <p key={g.what} className="text-xs text-red-700">· {g.what} — <span className="text-red-500">{g.where}</span></p>
                    ))}
                  </div>
                )}
                <NoteMeta meta={d.aiMeta?.[key]} freshness={freshnessOf(key)} onAccept={() => acceptNote(key)} />
              </div>
            ))}
            <div className="mt-2">
              <label className="text-xs font-medium text-gray-500 block mb-2">Requirements type</label>
              <Toggle value={d.requirementsType} onChange={v => setD(prev => ({ ...prev, requirementsType: v }))}
                options={['Owner occupied', 'Investment']} colors={['blue', 'blue']} />
            </div>
          </div>
        </div>
      )}

      {/* STAGE: Risks */}
      {stage === 'risks' && (
        <div className="space-y-4">
          {/* Applicant tabs */}
          <div className="flex gap-2 items-center flex-wrap">
            {d.applicants.map((a, i) => {
              const started = riskStarted(a.name)
              return (
                <button key={i} onClick={() => setActiveApplicant(i)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition flex items-center gap-2 ${
                    activeApplicant === i ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5'
                    : started ? 'border-gray-200 text-gray-400'
                    : 'border-[#EFD3CB] text-[#AD4227] bg-[#FBEDE9]'}`}>
                  {a.name}
                  {!started && <span className="text-[10px] font-bold uppercase tracking-[.05em]">not started</span>}
                </button>
              )
            })}
          </div>
          {/* These questions are asked of every applicant, never one of them.
              On a joint deal the second tab is the one that gets forgotten. */}
          {d.applicants.length > 1 && d.applicants.some(a => !riskStarted(a.name)) && (
            <div className="text-[12.5px] rounded-lg border border-[#EFD3CB] bg-[#FBEDE9] text-[#8A3A2A] px-3 py-2">
              These questions are asked of <b>every</b> applicant.
              {' '}{d.applicants.filter(a => !riskStarted(a.name)).map(a => a.name).join(' and ')}
              {' '}{d.applicants.filter(a => !riskStarted(a.name)).length === 1 ? 'has' : 'have'} not been started.
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
            <SectionHeader title={`Risks — ${currentApplicant?.name}`} />

            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Financial situation</div>
              <ToggleRow label="Adverse changes to financial situation?" value={currentRisk.adverseChanges}
                onChange={v => updateRisk(currentApplicant.name, 'adverseChanges', v)}
                options={['Yes', 'No']} colors={['red', 'green']} required />
              <ToggleRow label="Beneficial changes to financial situation?" value={currentRisk.beneficialChanges}
                onChange={v => updateRisk(currentApplicant.name, 'beneficialChanges', v)}
                options={['Yes', 'No']} colors={['green', 'green']} required />
            </div>

            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Exit strategy</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Retirement age</label>
                  <input className={inp} value={currentRisk.retirementAge} onChange={e => updateRisk(currentApplicant.name, 'retirementAge', e.target.value)} placeholder="e.g. 65" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Repayment method</label>
                  <select className={inp} value={currentRisk.repaymentMethod} onChange={e => updateRisk(currentApplicant.name, 'repaymentMethod', e.target.value)}>
                    <option value="">— select —</option>
                    {/* "Other" was removed on 10 Sep 2026. Nobody had ever chosen
                        it - checked against every deal - and a retirement strategy
                        recorded as "other" tells an assessor nothing.

                        A STORED ANSWER IS NEVER DROPPED FROM THE LIST. This was the
                        only select on the tab without that guard: retire an option
                        and any deal holding it renders blank, then the next autosave
                        writes the blank over a real answer. The fact find has done it
                        this way for months; this now matches. */}
                    {[...REPAYMENT_METHODS,
                      ...(currentRisk.repaymentMethod && !REPAYMENT_METHODS.includes(currentRisk.repaymentMethod)
                          ? [currentRisk.repaymentMethod] : [])]
                      .map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Financial security</div>
              {[
                { key: 'financialExperience', label: 'Level of financial experience' },
                { key: 'interestRateConcern', label: 'Concern about interest rate movements' },
                { key: 'loanFlexibility', label: 'Importance of loan flexibility (offset/redraw)' },
                { key: 'jobSecurity', label: 'Concern about job security' },
                { key: 'propertyValueConcern', label: 'Concern about property value fluctuations' },
              ].map(({ key, label }) => (
                <ToggleRow key={key} label={label} value={(currentRisk as any)[key]}
                  onChange={v => updateRisk(currentApplicant.name, key as keyof RiskData, v)}
                  options={['Low', 'Medium', 'High']} colors={['green', 'amber', 'red']} />
              ))}
              {[
                { key: 'emergencyFund', label: 'Emergency fund / liquid asset or insurance for loss of income?' },
                { key: 'maintainLifestyle', label: 'Maintain commitments if partner unable to earn?' },
                { key: 'adequateInsurance', label: 'Adequate insurance for loan repayments if unable to work?' },
                { key: 'hasWill', label: 'Do you have a will?' },
                { key: 'circumstancesImpact', label: 'Any circumstances that may impact financial commitments?' },
              ].map(({ key, label }) => (
                <ToggleRow key={key} label={label} value={(currentRisk as any)[key]}
                  onChange={v => updateRisk(currentApplicant.name, key as keyof RiskData, v)}
                  options={['Yes', 'No']} colors={['green', 'red']} />
              ))}
            </div>

            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Credit history <span className="normal-case text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium ml-1">⚠ Team must answer — from the client's declarations</span></div>
              {[
                { key: 'problemsMeetingCommitments', label: 'Problems meeting fixed commitments including mobile payments?' },
                { key: 'officerInLiquidation', label: 'Officer/shareholder of company where liquidator appointed?' },
                { key: 'unsatisfiedJudgements', label: 'Unsatisfied judgements in court?' },
                { key: 'simultaneousApplications', label: 'Simultaneously applied to other credit providers?' },
              ].map(({ key, label }) => (
                <ToggleRow key={key} label={label} value={(currentRisk as any)[key]}
                  onChange={v => updateRisk(currentApplicant.name, key as keyof RiskData, v)}
                  options={['Yes', 'No']} colors={['red', 'green']} required />
              ))}
              <ToggleRow label="Ever declared bankrupt?" value={currentRisk.declaredBankrupt}
                onChange={v => updateRisk(currentApplicant.name, 'declaredBankrupt', v)}
                options={['Yes', 'No', 'Yes discharged']} colors={['red', 'green', 'amber']} required />
            </div>
          </div>
        </div>
      )}

      {/* STAGE: Product Requirements */}
      {stage === 'product' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <SectionHeader title="Product requirements" badge="AI pre-filled from LO" />

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Rate type</div>
            {[
              { key: 'variableRate', label: 'Variable rate' },
              { key: 'fixedRate', label: 'Fixed rate' },
              { key: 'fixedAndVariable', label: 'Fixed and variable rate' },
            ].map(({ key, label }) => (
              <ToggleRow key={key} label={label} value={(d.productReqs as any)[key]}
                onChange={v => updateProductReqs(key as keyof ProductReqs, v)}
                options={['Important', 'Not important', 'Do not want']} colors={['blue', 'default', 'red']} />
            ))}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Repayment type</div>
            {[
              { key: 'principalAndInterest', label: 'Principal and interest' },
              { key: 'interestOnly', label: 'Interest only' },
              { key: 'interestInAdvance', label: 'Interest in advance' },
              { key: 'lineOfCredit', label: 'Line of credit' },
            ].map(({ key, label }) => (
              <ToggleRow key={key} label={label} value={(d.productReqs as any)[key]}
                onChange={v => updateProductReqs(key as keyof ProductReqs, v)}
                options={['Important', 'Not important', 'Do not want']} colors={['blue', 'default', 'red']} />
            ))}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Product type</div>
            {[
              { key: 'offsetAccount', label: 'Offset account' },
              { key: 'redraw', label: 'Redraw' },
            ].map(({ key, label }) => (
              <ToggleRow key={key} label={label} value={(d.productReqs as any)[key]}
                onChange={v => updateProductReqs(key as keyof ProductReqs, v)}
                options={['Important', 'Not important', 'Do not want']} colors={['blue', 'default', 'red']} />
            ))}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">What is important to you</div>
            {[
              { key: 'lowestCost', label: 'Lowest overall loan cost' },
              { key: 'approvedQuickly', label: 'Loan approved quickly' },
              { key: 'specificFeatures', label: 'Specific loan features' },
              { key: 'lenderPolicy', label: 'Lender policy / borrowing capacity' },
            ].map(({ key, label }) => (
              <ToggleRow key={key} label={label} value={(d.productReqs as any)[key]}
                onChange={v => updateProductReqs(key as keyof ProductReqs, v)}
                options={['Most important', 'Somewhat important', 'Least important']} colors={['blue', 'default', 'default']} />
            ))}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">Branch access</div>
            <ToggleRow label="How often do you go to a branch?" value={d.productReqs.branchFrequency}
              onChange={v => updateProductReqs('branchFrequency', v)}
              options={['All the time', 'Sometimes', 'Rarely']} colors={['blue', 'blue', 'default']} />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Other requirements</label>
            <textarea spellCheck="true" aria-label="Other requirements" className={inp + ' min-h-[80px] resize-y'} value={d.productReqs.otherRequirements}
              onFocus={() => focusField(ownRef.current, 'productReqs.otherRequirements')}
              onBlur={() => blurField(ownRef.current, 'productReqs.otherRequirements')}
              onChange={e => { markDirty(ownRef.current, 'productReqs.otherRequirements'); updateProductReqs('otherRequirements', e.target.value) }}
              placeholder="Any other requirements not already stated..." />
          </div>
        </div>
      )}

      {/* STAGE: Broker Comments */}
      {stage === 'comments' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Broker comments" badge="AI generated" />
              <AIButton onClick={generateAll} loading={Object.values(generating).some(Boolean)} label="Generate all fields" />
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-2">Client agreement (captured when moving from LO to Compliance)</label>
              {d.clientAgreedLender ? (
                <div className="text-sm text-[#343333]">
                  {d.clientAgreedLender === 'Yes' ? (
                    <span>✓ Client agreed with the recommended lender ({lo.recommendedLender || 'not yet recommended'})</span>
                  ) : (
                    <div className="space-y-1">
                      <p>Client chose a different lender: <span className="font-medium">{d.clientChosenLender === '__other__' ? d.clientChosenLenderOther : d.clientChosenLender}</span></p>
                      {d.clientChosenLenderReason && <p className="text-gray-500">Reason: {d.clientChosenLenderReason}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Not yet captured — this is recorded automatically when the deal moves from LO to Compliance.</p>
              )}
            </div>

            {[
              { key: 'analysisComment', label: 'Analysis, assessment & applicant education' },
              { key: 'optionsComment', label: 'Options presented & recommendation' },
              { key: 'borrowingPowerComment', label: 'Borrowing power' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-4">
                <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                <textarea spellCheck="true" aria-label={label} className={inp + ' min-h-[120px] resize-y'} value={(d as any)[key]}
                  onFocus={() => focusField(ownRef.current, key)}
                  onBlur={() => blurField(ownRef.current, key)}
                  onChange={e => { markDirty(ownRef.current, key); setD(prev => ({ ...prev, [key]: e.target.value })) }}
                  placeholder="Click Generate with AI or type manually..." />
                <AIButton onClick={() => generateField(key)} loading={generating[key]}
                  label={COMPOSERS[key] ? 'Write from the deal' : undefined} />
                <button onClick={() => { setFlaggingField(flaggingField === key ? null : key); setFlagNote('') }} className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
                {flaggingField === key && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} placeholder="What's wrong with this field?" value={flagNote} onChange={e => setFlagNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => submitFlag(key, label)} disabled={flagSubmitting || !flagNote.trim()} className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">{flagSubmitting ? 'Submitting...' : 'Submit flag'}</button>
                      <button onClick={() => { setFlaggingField(null); setFlagNote('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
                <NoteMeta meta={d.aiMeta?.[key]} freshness={freshnessOf(key)} onAccept={() => acceptNote(key)} />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'depositComment', label: 'Deposit / equity' },
                { key: 'creditHistoryComment', label: 'Credit history', warning: '⚠ Confirm credit history with the client' },
              ].map(({ key, label, warning }) => (
                <div key={key} className="mb-4">
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    {label} {warning && <span className="text-[10px] text-amber-500">{warning}</span>}
                  </label>
                  <textarea spellCheck="true" aria-label={label} className={inp + ' min-h-[100px] resize-y'} value={(d as any)[key]}
                    onFocus={() => focusField(ownRef.current, key)}
                    onBlur={() => blurField(ownRef.current, key)}
                    onChange={e => { markDirty(ownRef.current, key); setD(prev => ({ ...prev, [key]: e.target.value })) }}
                    placeholder="Click Generate..." />
                  <AIButton onClick={() => generateField(key)} loading={generating[key]}
                    label={COMPOSERS[key] ? 'Write from the deal' : undefined} />
                <button onClick={() => { setFlaggingField(flaggingField === key ? null : key); setFlagNote('') }} className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
                {flaggingField === key && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} placeholder="What's wrong with this field?" value={flagNote} onChange={e => setFlagNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => submitFlag(key, label)} disabled={flagSubmitting || !flagNote.trim()} className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">{flagSubmitting ? 'Submitting...' : 'Submit flag'}</button>
                      <button onClick={() => { setFlaggingField(null); setFlagNote('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
                <NoteMeta meta={d.aiMeta?.[key]} freshness={freshnessOf(key)} onAccept={() => acceptNote(key)} />
                </div>
              ))}
            </div>

            {/* A pre-approval has no security yet, so the box below says TBA and
                that is correct. Marked here so nothing downstream treats it as
                an unfinished form. */}
            <label className="flex items-start gap-3 mb-4 border border-gray-100 rounded-lg px-3.5 py-3 cursor-pointer hover:bg-[#FBFCFD]">
              <input type="checkbox" className="mt-0.5" checked={!!d.preApproval}
                onChange={e => setD(prev => ({ ...prev, preApproval: e.target.checked }))} />
              <span>
                <span className="block text-[13px] font-medium text-[#343333]">This is a pre-approval — no security identified yet</span>
                <span className="block text-[11.5px] text-gray-400 mt-0.5">
                  &ldquo;TBA&rdquo; in the Security box stops being flagged, and the handover says the property is still to be found.
                </span>
              </span>
            </label>

            {/* Who ends up on the title.
                The portal recorded ownership of properties a client already had
                and nothing at all about the security being bought - so two
                people could borrow $1.7m on a property going into one name, and
                nothing noticed. The lender always asks; the answer belongs here. */}
            {(() => {
              const names = d.applicants.map(a => a.name)
              const info: TitleInfo = d.title || {}
              const holders = holdersFor(info, names)
              const setTitle = (patch: Partial<TitleInfo>) =>
                // The reconciled list always wins over whatever was saved: an applicant
                // added since the last save must not be dropped by writing a reason.
                setD(prev => ({ ...prev, title: { ...prev.title, holders, ...patch } }))
              const setHolder = (name: string, patch: any) =>
                setTitle({ holders: holders.map(h => h.name === name ? { ...h, ...patch } : h) })
              const mismatch = borrowerNotOnTitle({ ...info, holders }, names)
              const needReason = reasonRequired({ ...info, holders }, names)
              return (
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Who will be on the title?</label>
                  {holders.map(h => (
                    <div key={h.name}
                      className={`flex items-center gap-3 px-3 py-2 border rounded-lg mb-1.5 ${h.onTitle ? 'border-gray-100 bg-white' : 'border-gray-100 bg-[#FBFCFD]'}`}>
                      <input type="checkbox" checked={h.onTitle} onChange={e => setHolder(h.name, { onTitle: e.target.checked })} />
                      <span className={`text-[13px] text-[#343333] ${h.onTitle ? 'font-medium' : ''}`}>{h.name}</span>
                      <span className="ml-auto flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Share</span>
                        <input className="border border-gray-200 rounded-lg px-2 py-1 text-[13px] w-[74px]"
                          value={h.share} onChange={e => setHolder(h.name, { share: e.target.value })} />
                      </span>
                    </div>
                  ))}

                  {mismatch && (
                    <div className={`mt-2 border rounded-lg px-3.5 py-3 ${needReason ? 'border-[#F5C2C2] bg-[#FDF0EF]' : 'border-[#EBD9BE] bg-[#FDF6EC]'}`}>
                      <div className={`text-[12.5px] font-semibold mb-1.5 ${needReason ? 'text-[#8A3A3A]' : 'text-[#8A6218]'}`}>
                        {holders.filter(h => !h.onTitle).map(h => h.name).join(' and ')}
                        {holders.filter(h => !h.onTitle).length === 1 ? ' is ' : ' are '}
                        borrowing but will not be on title.
                      </div>
                      <label className="text-[11px] text-gray-500 block mb-1">Why are they on the loan, and what benefit do they get from it?</label>
                      <textarea spellCheck="true" className={inp + ' min-h-[64px] resize-y bg-white'}
                        value={info.reason || ''} onChange={e => setTitle({ reason: e.target.value })}
                        placeholder="e.g. spouse, will live in the property as their principal place of residence…" />
                      <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                        <span className="text-[11px] text-gray-500">Independent legal advice</span>
                        <span className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                          {(['not_required', 'arranged', 'not_yet'] as LegalAdvice[]).map((v, i) => (
                            <button key={v} type="button" onClick={() => setTitle({ legalAdvice: v })}
                              className={`text-[11.5px] px-2.5 py-1 ${i ? 'border-l border-gray-200' : ''} ${
                                info.legalAdvice === v ? 'bg-[#343333] text-white font-semibold' : 'text-[#8a9099]'}`}>
                              {LEGAL_ADVICE_LABEL[v]}
                            </button>
                          ))}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#a08a5e] mt-2 italic">
                        This only appears when the borrowers and the owners are not the same people. Match them and it goes away.
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Security (property)</label>
                <textarea spellCheck="true" aria-label="Security comments" className={inp + ' min-h-[80px] resize-y'} value={d.securityComment}
                  onFocus={() => focusField(ownRef.current, 'securityComment')}
                  onBlur={() => blurField(ownRef.current, 'securityComment')}
                  onChange={e => { markDirty(ownRef.current, 'securityComment'); setD(prev => ({ ...prev, securityComment: e.target.value })) }}
                  placeholder="TBA or enter address..." />
                {/* THE LABEL COMES FROM THE COMPOSER LIST, NOT FROM A STRING HERE.
                    10 Sep 2026: box nine shipped wired up and this button still
                    said "Generate with AI", so the robot timed out looking for
                    "Write from the deal". Box four did exactly this on 10 Sep
                    too - the same mistake twice, in the one place it is not
                    derived. */}
                <AIButton onClick={() => generateField('securityComment')} loading={generating['securityComment']}
                  label={COMPOSERS['securityComment'] ? 'Write from the deal' : undefined} />
                <button onClick={() => { setFlaggingField(flaggingField === 'securityComment' ? null : 'securityComment'); setFlagNote('') }} className="mt-2 ml-2 text-xs text-gray-400 hover:text-amber-500 underline">Flag an issue</button>
                {flaggingField === 'securityComment' && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <textarea spellCheck="true" className={inp + ' min-h-[60px] resize-y bg-white'} placeholder="What's wrong with this field?" value={flagNote} onChange={e => setFlagNote(e.target.value)} autoFocus />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => submitFlag('securityComment', 'Security (property)')} disabled={flagSubmitting || !flagNote.trim()} className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 disabled:opacity-40">{flagSubmitting ? 'Submitting...' : 'Submit flag'}</button>
                      <button onClick={() => { setFlaggingField(null); setFlagNote('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
                <NoteMeta meta={d.aiMeta?.['securityComment']} freshness={freshnessOf('securityComment')} onAccept={() => acceptNote('securityComment')} />
              </div>
              {/* THE ONLY BOX ON THIS TAB THAT LEAVES THE BUILDING.
                  Everything else here is between us, the client and compliance.
                  This is copied into the lender's application portal and read by
                  a credit assessor, so it is composed to a fixed structure from
                  recorded facts rather than written by a model. */}
              <div className="col-span-2">
                {/* LOUD, AND ABOVE THE BOX. This is the only field on the tab
                    that leaves the building, and it is the one field here that
                    no model writes. Fabio, 3 Sep 2026: "let's just make sure it
                    really screams out that they have to complete this section.
                    This is not done by AI." */}
                <div className="border-2 border-[#2DBEFF] bg-[#F4FCFF] rounded-lg px-3.5 py-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-[13px] font-bold text-[#2E2A26]">Application submission notes</label>
                    <span className="text-[10.5px] font-extrabold tracking-[.06em] uppercase text-[#08252F] bg-[#2DBEFF] rounded px-2 py-[3px]">
                      Goes to the lender
                    </span>
                  </div>
                  <p className="m-0 mt-1.5 text-[12px] leading-[1.55] text-[#0B5E8A]">
                    <b className="text-[#08252F]">This is the only box on this tab the bank reads.</b>{' '}
                    It is not written by AI — every sentence is copied from the deal.
                    <b className="text-[#08252F]"> Press Compose below</b>, read what it writes, and fix anything
                    that is not right before you push.
                  </p>
                </div>
                <textarea spellCheck="true" aria-label="Broker notes for the credit team" className={inp + ' min-h-[190px] resize-y font-[13px]'} value={d.applicationSubmissionComment}
                  onFocus={() => focusField(ownRef.current, 'applicationSubmissionComment')}
                  onBlur={() => blurField(ownRef.current, 'applicationSubmissionComment')}
                  onChange={e => { markDirty(ownRef.current, 'applicationSubmissionComment'); setD(prev => ({ ...prev, applicationSubmissionComment: e.target.value })) }}
                  placeholder="Press Compose, or type your own..." />
                {notes.ready ? (
                  <button onClick={writeBrokerNotes}
                    className="mt-2 text-sm text-[#2DBEFF] border border-[#2DBEFF] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition inline-flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                    </svg>
                    {d.applicationSubmissionComment ? 'Compose again' : 'Compose from the file'}
                  </button>
                ) : (
                  /* Refuse and name what is missing, rather than leaving
                     [employer name] in something bound for a bank portal.
                     Fabio, 3 Sep 2026: "refuse, and name what is missing." */
                  <div className="mt-2 border border-[#EBD9BE] bg-[#FDF6EC] rounded-lg px-3.5 py-3">
                    <p className="m-0 text-[12.5px] font-semibold text-[#221F1B]">
                      These notes cannot be composed yet
                    </p>
                    <p className="m-0 mt-0.5 text-[11.5px] text-[#8A6218]">
                      They go to the lender, so nothing is written until every figure in them is a recorded fact.
                    </p>
                    <ul className="mt-1.5 mb-0 pl-5 text-[12px] text-[#8A6218]">
                      {notes.missing.map((m, i) => <li key={i} className="mb-0.5">{m}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              
              {complianceCompletedAt && <span className="ml-3 text-green-600">✓ Compliance completed</span>}
            </span>
          </div>
        </div>
      )}

      {/* STAGE: Living Expenses */}
      {stage === 'expenses' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <SectionHeader title="Living expenses" badge="household monthly" />
            {/* ONE TAB PER HOUSEHOLD, and none at all when there is one.
              *
              * Twenty-two categories times three is sixty-six rows, and stacking
              * them buries the last household where nobody scrolls. Tabs hide
              * things though, and on this screen an unanswered category is a red
              * dot - so each tab carries its own count of what is still open, and
              * the strip at the bottom adds every household up. Nothing can be
              * missed by being on the wrong tab. */}
            {!oneHousehold && (
              <div className="flex gap-2 flex-wrap items-center mb-3.5">
                {households.map(h => {
                  const open = hemTotals(EXPENSE_CATEGORIES, expensesFor(d, h.id) as any).unanswered
                  const on = h.id === household
                  return (
                    <button key={h.id} onClick={() => setHousehold(h.id)}
                      className={`border rounded-lg px-3 py-1.5 flex items-center gap-2 transition ${
                        on ? 'border-[#141C24] bg-[#141C24]' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                      <span className={`text-[12.5px] font-semibold ${on ? 'text-white' : 'text-[#3A434C]'}`}>
                        Household {h.id}
                      </span>
                      <span className={`text-[11px] max-w-[150px] truncate ${on ? 'text-[#B9C1C9]' : 'text-gray-400'}`}
                            title={h.people.map(p => p.name).join(', ')}>
                        {h.people.map(p => p.name).join(', ') || 'nobody'}
                        {Number(h.dependants) > 0 ? ` \u00b7 ${h.dependants} dep` : ''}
                      </span>
                      <span className={`text-[10px] font-bold rounded-full px-2 py-[1px] border ${
                        open > 0 ? 'bg-[#FDF0EF] text-[#B04A4A] border-[#F5C2C2]'
                                 : 'bg-[#EFF9F2] text-[#15803D] border-[#BFE3CC]'}`}>
                        {open > 0 ? `${open} to answer` : 'done'}
                      </span>
                    </button>
                  )
                })}
                <span className="text-[11.5px] text-gray-400">set on the Fact Find</span>
              </div>
            )}
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />In HEM</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Not in HEM</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-[#DC5B5B] bg-white inline-block" />Not answered yet</span>
            </div>
            <div className="flex flex-col gap-2">
              {EXPENSE_CATEGORIES.map(cat => {
                const entry = shownExpenses?.[cat.key] || { monthlyAmount: '', splits: {}, comment: '' }
                const hem = hemStateOf(cat, entry)
                const open = hem === 'unanswered'
                return (
                  <div key={cat.key} className={`border rounded-lg p-3 ${
                    open ? 'border-[#F5C2C2] bg-[#FDF0EF]' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 ${
                        open ? 'border-2 border-[#DC5B5B] bg-white'
                        : hem === 'in' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-sm font-medium text-[#343333]">{cat.label}</span>
                      {open && <span className="text-[11px] font-semibold text-[#B04A4A]">needs an answer</span>}
                      {/* Only the two rows lenders disagree about. Everything else
                          is settled and shows nothing, so the toggles that ARE
                          here mean something. */}
                      {cat.askHem && (
                        <span className="ml-auto inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                          {([['', 'Not answered'], ['in', 'In HEM'], ['out', 'Outside HEM']] as const).map(([value, label], vi) => (
                            <button key={label} type="button"
                              onClick={() => setExpenseHem(cat.key, value as HemAnswer | '')}
                              className={`text-[11.5px] px-2.5 py-1 transition ${vi ? 'border-l border-gray-200' : ''} ${
                                (value === '' ? open : entry.hem === value)
                                  ? 'bg-[#343333] text-white font-semibold'
                                  : 'text-[#8a9099] hover:bg-gray-50'}`}>
                              {label}
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 items-end" style={{ gridTemplateColumns: `160px repeat(${peopleHere.length}, 1fr) 1fr` }}>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Monthly amount</label>
                        <input className={inp} value={entry.monthlyAmount} onChange={e => updateExpense(cat.key, 'monthlyAmount', e.target.value)} />
                      </div>
                      {peopleHere.map(name => (
                        <div key={name}>
                          <label className="text-xs text-gray-400 block mb-1">{name} %</label>
                          <input className={inp} value={entry.splits?.[name] || ''} onChange={e => updateExpenseSplit(cat.key, name, e.target.value)} />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Comment</label>
                        <input className={inp} value={entry.comment} onChange={e => updateExpense(cat.key, 'comment', e.target.value)} placeholder="Optional note..." />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {(() => {
            // One reader, in lib/hem.ts, so the dots on the rows and the money in
            // the boxes cannot tell different stories.
            const { all: totalAll, inHem: totalHem, notInHem: totalNotHem, unanswered } =
              hemTotals(EXPENSE_CATEGORIES, shownExpenses as any)
            return (
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <SectionHeader title={oneHousehold ? 'Totals (monthly)' : `Household ${household} totals (monthly)`} />
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Total expenses</div>
                    <div className="text-xl font-semibold text-[#343333]">${totalAll.toLocaleString('en-AU')}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 mb-1">Total living expenses (in HEM)</div>
                    <div className="text-xl font-semibold text-green-700">${totalHem.toLocaleString('en-AU')}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-500 mb-1">Total living expenses (not in HEM)</div>
                    <div className="text-xl font-semibold text-red-600">${totalNotHem.toLocaleString('en-AU')}</div>
                  </div>
                </div>
                {unanswered > 0 && (
                  <div className="mt-3 rounded-lg border border-[#F5C2C2] bg-[#FDF0EF] px-3 py-2 text-[12.5px] text-[#8A3A3A]">
                    {unansweredNote(unanswered)}
                  </div>
                )}

                {/* EVERY HOUSEHOLD, WHICHEVER TAB IS OPEN.
                  *
                  * Two homes are never silently added into one figure: each is
                  * on its own line and the combined figure is on its own line
                  * under them, so an assessor reading this sees both. */}
                {!oneHousehold && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="text-[10px] font-bold tracking-[.08em] uppercase text-gray-400 mb-2">
                      Every household
                    </div>
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="text-[9.5px] uppercase tracking-[.06em] text-gray-400">
                          <th className="text-left font-semibold pb-1.5 pr-3">Household</th>
                          <th className="text-left font-semibold pb-1.5 pr-3">Who</th>
                          <th className="text-right font-semibold pb-1.5 pr-3">Total</th>
                          <th className="text-right font-semibold pb-1.5 pr-3">In HEM</th>
                          <th className="text-right font-semibold pb-1.5 pr-3">Not in HEM</th>
                          <th className="text-right font-semibold pb-1.5">To answer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {households.map(h => {
                          const t = hemTotals(EXPENSE_CATEGORIES, expensesFor(d, h.id) as any)
                          return (
                            <tr key={h.id} className="border-t border-[#F6F8F9]">
                              <td className="py-1.5 pr-3 text-[#2E3439]">Household {h.id}</td>
                              <td className="py-1.5 pr-3 text-gray-500 max-w-[200px] truncate"
                                  title={h.people.map(p => p.name).join(', ')}>
                                {h.people.map(p => p.name).join(', ') || 'nobody'}
                              </td>
                              <td className="py-1.5 pr-3 text-right">${t.all.toLocaleString('en-AU')}</td>
                              <td className="py-1.5 pr-3 text-right text-green-700">${t.inHem.toLocaleString('en-AU')}</td>
                              <td className="py-1.5 pr-3 text-right text-red-600">${t.notInHem.toLocaleString('en-AU')}</td>
                              <td className={`py-1.5 text-right ${t.unanswered > 0 ? 'text-[#B04A4A] font-semibold' : 'text-gray-300'}`}>
                                {t.unanswered > 0 ? t.unanswered : '\u2014'}
                              </td>
                            </tr>
                          )
                        })}
                        {(() => {
                          const sum = households.reduce((acc, h) => {
                            const t = hemTotals(EXPENSE_CATEGORIES, expensesFor(d, h.id) as any)
                            return { all: acc.all + t.all, inHem: acc.inHem + t.inHem,
                                     notInHem: acc.notInHem + t.notInHem, unanswered: acc.unanswered + t.unanswered }
                          }, { all: 0, inHem: 0, notInHem: 0, unanswered: 0 })
                          return (
                            <tr className="border-t border-gray-200 font-semibold text-[#1F2328]">
                              <td className="py-1.5 pr-3">All {households.length}</td>
                              <td className="py-1.5 pr-3 text-gray-500 font-normal">the whole application</td>
                              <td className="py-1.5 pr-3 text-right">${sum.all.toLocaleString('en-AU')}</td>
                              <td className="py-1.5 pr-3 text-right text-green-700">${sum.inHem.toLocaleString('en-AU')}</td>
                              <td className="py-1.5 pr-3 text-right text-red-600">${sum.notInHem.toLocaleString('en-AU')}</td>
                              <td className={`py-1.5 text-right ${sum.unanswered > 0 ? 'text-[#B04A4A]' : 'text-gray-300'}`}>
                                {sum.unanswered > 0 ? sum.unanswered : '\u2014'}
                              </td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Validation Modal */}
      {showValidation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="text-base font-semibold mb-1 text-[#343333]">⚠ Fields require attention</div>
            <p className="text-sm text-gray-500 mb-4">The following fields are empty. Please complete them before pushing to SalesTrekker, or confirm to proceed anyway.</p>
            <div className="space-y-2 mb-5">
              {validationErrors.map((err, i) => (
                <div key={i} className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowValidation(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Go back & complete
              </button>
              <button onClick={() => {
                setShowValidation(false)
                if (linkableApplicants.length > 0) {
                  setPositionChoices(Object.fromEntries(linkableApplicants.map((a: any) => [a.id, true])))
                  setShowPositionPrompt(true)
                } else {
                  markComplianceComplete()
                }
              }}
                className="px-4 py-2 text-sm bg-[#343333] text-white rounded-lg font-medium hover:bg-[#2a2a2a]">
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreflight && (
        <PreflightPanel
          findings={findings}
          dealName={d.applicants.map(a => a.name).join(' & ') || deal.deal_name}
          onOpen={box => {
            // The box name says which tab it lives on, so the panel takes you
            // there rather than leaving you to hunt for it.
            const goto = box === 'Living expenses' ? 'expenses'
              : box === 'Risks' ? 'risks'
              : ['Primary reasons for seeking credit', 'Immediate needs & objectives — next 2 years', 'Longer term — 2 to 10 years'].includes(box) ? 'needs'
              : 'comments'
            setStage(goto as any)
            setShowPreflight(false)
          }}
          onProceed={openPushForm}
          onFix={fix => {
            if (fix !== 'preApproval') return
            // The same tick as the checkbox under Security, made where the
            // question was actually asked. The autosave carries it to the deal.
            // The checks then RE-RUN against the corrected data rather than the
            // finding simply being hidden - if something else is wrong, it still
            // gets said.
            const next = { ...d, preApproval: true }
            setD(next)
            const left = preflight(deal, next, EXPENSE_CATEGORIES)
            setFindings(left)
            if (left.length === 0) openPushForm()
          }}
          onCancel={() => setShowPreflight(false)} />
      )}

      {showPushForm && (
        <PushForm
          deal={deal}
          dealName={d.applicants.map(a => a.name).join(' & ') || deal.deal_name}
          answers={pushAnswers}
          setAnswers={setPushAnswers}
          busy={pushing}
          onPush={confirmPush}
          onCancel={() => setShowPushForm(false)} />
      )}

      {showPositionPrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[460px] shadow-xl">
            <div className="text-base font-semibold mb-1 text-[#343333]">Update client financial position?</div>
            <p className="text-sm text-gray-500 mb-4">This refreshes each applicant's saved assets, liabilities, and properties based on this deal's Fact Find.</p>
            <div className="flex flex-col gap-3 mb-5">
              {linkableApplicants.map((a: any) => (
                <div key={a.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-[#343333]">{a.firstName} {a.lastName}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPositionChoices(prev => ({ ...prev, [a.id]: true }))}
                      className={`px-3 py-1 text-xs rounded-lg border ${positionChoices[a.id] ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>
                      Yes
                    </button>
                    <button onClick={() => setPositionChoices(prev => ({ ...prev, [a.id]: false }))}
                      className={`px-3 py-1 text-xs rounded-lg border ${positionChoices[a.id] === false ? 'border-[#2DBEFF] text-[#2DBEFF] bg-[#2DBEFF]/5' : 'border-gray-200 text-gray-500'}`}>
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={finalizePush}
                className="px-4 py-2 text-sm bg-[#343333] text-white rounded-lg font-medium hover:bg-[#2a2a2a]">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}
