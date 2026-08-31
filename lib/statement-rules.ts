import {
  BNPL_PROVIDERS, HIGH_COST_LENDERS, BENEFIT_TYPES, GAMBLING_MERCHANTS,
  REAL_ESTATE_AGENTS, REBATE_WORDS, LENDER_ALIASES,
} from './statement-watchlists'

// Everything the statement analysis uses to decide what to flag, in one shape.
//
// The defaults below are the lists the feature shipped with. Settings stores a
// copy; an empty or half-filled copy falls back field by field, so adding a new
// rule later never breaks a portal that was saved before it existed.
//
// An analysis stores the rules it was run under. That is deliberate: changing a
// threshold must not silently rewrite a file someone already reviewed. The deal
// notices the difference and offers to re-run instead.

export type NamedTerms = { name: string; terms: string[] }
export type BenefitRule = NamedTerms & { servicingUse: 'usually' | 'sometimes' | 'rarely' }

export type StatementRules = {
  cashThreshold: number        // dollars; cash in or out above this is shown
  savingsWindowDays: number    // how long money must sit to count as genuine savings
  gamblingPct: number          // share of credits at which gambling turns serious
  rentalTolerancePct: number   // how far under declared rent still reads as agent fees
  salaryQueryPct: number       // salary variance that turns the card amber
  salaryActionPct: number      // salary variance that turns it red
  bnpl: NamedTerms[]
  highCost: NamedTerms[]
  benefits: BenefitRule[]
  gambling: string[]
  agents: string[]
  rebates: string[]
  lenderAliases: NamedTerms[]
}

export const DEFAULT_RULES: StatementRules = {
  cashThreshold: 1000,
  savingsWindowDays: 90,
  gamblingPct: 5,
  rentalTolerancePct: 25,
  salaryQueryPct: 5,
  salaryActionPct: 15,
  bnpl: BNPL_PROVIDERS.map(p => ({ name: p.name, terms: [...p.match] })),
  highCost: HIGH_COST_LENDERS.map(p => ({ name: p.name, terms: [...p.match] })),
  benefits: BENEFIT_TYPES.map(b => ({ name: b.name, terms: [...b.match], servicingUse: b.servicingUse })),
  gambling: [...GAMBLING_MERCHANTS],
  agents: [...REAL_ESTATE_AGENTS],
  rebates: [...REBATE_WORDS],
  lenderAliases: Object.entries(LENDER_ALIASES).map(([name, terms]) => ({ name, terms: [...terms] })),
}

// An empty box is "not set", not zero. Reading it as zero was quietly turning
// every threshold into its minimum the first time settings were saved.
const num = (v: any, fallback: number, min: number, max: number): number => {
  if (v === null || v === undefined) return fallback
  const cleaned = String(v).replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return fallback
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

const strList = (v: any, fallback: string[]): string[] => {
  if (!Array.isArray(v)) return [...fallback]
  const out = v.map(x => String(x || '').trim()).filter(Boolean)
  return out.length ? out : [...fallback]
}

// A row with a name but no terms would match nothing and quietly do nothing, so
// it is dropped rather than kept as a row that looks like it is working.
const namedList = <T extends NamedTerms>(v: any, fallback: T[], extra?: (raw: any) => Partial<T>): T[] => {
  if (!Array.isArray(v)) return fallback.map(x => ({ ...x, terms: [...x.terms] }))
  const out = v.map((raw: any) => ({
    name: String(raw?.name || '').trim(),
    terms: Array.isArray(raw?.terms)
      ? raw.terms.map((t: any) => String(t || '').trim()).filter(Boolean)
      : String(raw?.terms || '').split(',').map(s => s.trim()).filter(Boolean),
    ...(extra ? extra(raw) : {}),
  })).filter((r: any) => r.name && r.terms.length) as T[]
  return out.length ? out : fallback.map(x => ({ ...x, terms: [...x.terms] }))
}

export function normaliseRules(raw: any): StatementRules {
  const r = raw && typeof raw === 'object' ? raw : {}
  const query = num(r.salaryQueryPct, DEFAULT_RULES.salaryQueryPct, 0, 100)
  const action = num(r.salaryActionPct, DEFAULT_RULES.salaryActionPct, 0, 100)
  return {
    cashThreshold: num(r.cashThreshold, DEFAULT_RULES.cashThreshold, 1, 1_000_000),
    savingsWindowDays: num(r.savingsWindowDays, DEFAULT_RULES.savingsWindowDays, 1, 3650),
    gamblingPct: num(r.gamblingPct, DEFAULT_RULES.gamblingPct, 0, 100),
    rentalTolerancePct: num(r.rentalTolerancePct, DEFAULT_RULES.rentalTolerancePct, 0, 100),
    salaryQueryPct: query,
    // The serious threshold must sit above the question one, or a variance could
    // be red and amber at once and the card would contradict itself.
    salaryActionPct: Math.max(action, query),
    bnpl: namedList(r.bnpl, DEFAULT_RULES.bnpl),
    highCost: namedList(r.highCost, DEFAULT_RULES.highCost),
    benefits: namedList<BenefitRule>(r.benefits, DEFAULT_RULES.benefits, raw2 => ({
      servicingUse: ['usually', 'sometimes', 'rarely'].includes(String(raw2?.servicingUse))
        ? raw2.servicingUse : 'sometimes',
    })),
    gambling: strList(r.gambling, DEFAULT_RULES.gambling),
    agents: strList(r.agents, DEFAULT_RULES.agents),
    rebates: strList(r.rebates, DEFAULT_RULES.rebates),
    lenderAliases: namedList(r.lenderAliases, DEFAULT_RULES.lenderAliases),
  }
}

const LABELS: Record<keyof StatementRules, string> = {
  cashThreshold: 'Large cash movement',
  savingsWindowDays: 'Genuine savings held for',
  gamblingPct: 'Gambling threshold',
  rentalTolerancePct: 'Rental fees allowance',
  salaryQueryPct: 'Salary — ask a question above',
  salaryActionPct: 'Salary — treat as serious above',
  bnpl: 'Buy now pay later providers',
  highCost: 'Small amount credit lenders',
  benefits: 'Government payments',
  gambling: 'Gambling merchants',
  agents: 'Real estate agents',
  rebates: 'Money coming back',
  lenderAliases: 'Lender names',
}

// What changed between the rules an analysis was run under and the rules now.
// Named in plain words, because it is shown to whoever has to decide whether
// re-running is worth it.
export function rulesChanged(before: any, after: any): string[] {
  const a = normaliseRules(before), b = normaliseRules(after)
  const out: string[] = []
  for (const key of Object.keys(LABELS) as (keyof StatementRules)[]) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) out.push(LABELS[key])
  }
  return out
}
