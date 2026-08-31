// Named providers the analysis has to recognise by name, because a bank statement
// gives no other signal. Kept in one file so they can be read at a glance and
// moved into Settings later without hunting through logic.
//
// Matching is on a normalised merchant or description: lower case, letters and
// digits only. "AFTERPAY *ORDER 12345" and "Afterpay Pty Ltd" both hit "afterpay".

export const BNPL_PROVIDERS: { name: string; match: string[] }[] = [
  { name: 'Afterpay',        match: ['afterpay'] },
  { name: 'Zip Pay',         match: ['zippay', 'zipmoney', 'zipco', 'zipau'] },
  { name: 'Klarna',          match: ['klarna'] },
  { name: 'humm',            match: ['hummgroup', 'hummpay', 'certegy'] },
  { name: 'Openpay',         match: ['openpay'] },
  { name: 'Latitude Pay',    match: ['latitudepay', 'latitudefin'] },
  { name: 'PayPal Pay in 4', match: ['paypalpayin', 'paypalcredit'] },
  { name: 'Brighte',         match: ['brighte'] },
  { name: 'Payright',        match: ['payright'] },
  { name: 'Wisr',            match: ['wisr'] },
  { name: 'Plenti',          match: ['plenti', 'ratesetter'] },
]

// Small amount credit contracts and wage-advance apps. These are not given their
// own card; they are named correctly wherever a commitment is listed, because a
// commitment showing as "unknown lender" is worse than useless.
export const HIGH_COST_LENDERS: { name: string; match: string[] }[] = [
  { name: 'Nimble',        match: ['nimble'] },
  { name: 'Cigno',         match: ['cigno'] },
  { name: 'Wallet Wizard', match: ['walletwizard', 'creditcorp'] },
  { name: 'MoneyMe',       match: ['moneyme'] },
  { name: 'Cash Converters', match: ['cashconverters', 'cashies'] },
  { name: 'Sunshine Loans', match: ['sunshineloans'] },
  { name: 'Jacaranda',     match: ['jacarandafin'] },
  { name: 'Fair Go Finance', match: ['fairgofinance'] },
  { name: 'Speckle',       match: ['specklefin'] },
  { name: 'Beforepay',     match: ['beforepay'] },
  { name: 'MyPayNow',      match: ['mypaynow'] },
]

// Credits that are money coming back rather than money earned.
export const REBATE_WORDS = [
  'medicare benefit', 'mcare benefit', 'medicare rebate', 'refund', 'reversal',
  'chargeback', 'rebate', 'cashback', 'ato refund', 'tax refund', 'reimbursement',
]

export const GAMBLING_MERCHANTS = [
  'sportsbet', 'tabltd', 'tablimited', 'tabcorp', 'ladbrokes', 'bet365', 'neds',
  'pointsbet', 'unibet', 'betfair', 'palmerbet', 'dabble', 'topsport', 'bluebet',
  'playup', 'elitebet', 'betr', 'picklebet', 'lottoland', 'thelott', 'ozlotteries',
  'keno', 'crowncasino', 'starcasino', 'skycity', 'pokerstars', 'draftkings',
]

export const REAL_ESTATE_AGENTS = [
  'raywhite', 'ljhooker', 'mcgrath', 'raineandhorne', 'raineahorne', 'belleproperty',
  'harcourts', 'firstnational', 'professionals', 'laingsimmons', 'laingandsimmons',
  'richardsonwrench', 'stonerealestate', 'century21', 'remax', 'barryplant',
  'jelliscraig', 'nelsonalexander', 'hockingstuart', 'rentalbond',
  'propertymanagement', 'realestate', 'realty',
]

export const GOVERNMENT_PAYERS = [
  'centrelink', 'servicesaustralia', 'departmentofhumanservices', 'humanservices',
  'dva', 'departmentofveterans', 'veteransaffairs', 'familyassistance',
]

// Benefit names, most specific first - the first hit wins, so "family tax benefit"
// must be tested before the bare "centrelink" that also appears on the line.
export const BENEFIT_TYPES: { name: string; match: string[]; servicingUse: 'usually' | 'sometimes' | 'rarely' }[] = [
  { name: 'Family Tax Benefit',   match: ['familytaxbene', 'familytaxbenefit', 'ftb'], servicingUse: 'usually' },
  { name: 'Child Care Subsidy',   match: ['childcaresubsidy', 'ccs'], servicingUse: 'rarely' },
  { name: 'Child support',        match: ['childsupp', 'childsupport', 'csa'], servicingUse: 'sometimes' },
  { name: 'Age Pension',          match: ['agepension'], servicingUse: 'usually' },
  { name: 'Disability Support Pension', match: ['disabilitysupport', 'dsp'], servicingUse: 'usually' },
  { name: 'Carer Payment',        match: ['carerpayment', 'carerallowance'], servicingUse: 'sometimes' },
  { name: 'Parenting Payment',    match: ['parentingpayment'], servicingUse: 'sometimes' },
  { name: 'Paid Parental Leave',  match: ['paidparental', 'parentalleavepay', 'ppl'], servicingUse: 'sometimes' },
  { name: 'JobSeeker',            match: ['jobseeker', 'newstart'], servicingUse: 'rarely' },
  { name: 'Youth Allowance',      match: ['youthallowance'], servicingUse: 'rarely' },
  { name: 'Austudy or Abstudy',   match: ['austudy', 'abstudy'], servicingUse: 'rarely' },
  { name: 'DVA payment',          match: ['dva', 'veteransaffairs'], servicingUse: 'usually' },
]

export const SALARY_WORDS = [
  'payroll', 'salary', 'salaries', 'wages', 'wage', 'payrun', 'pay run', 'paycycle',
  'employee pay', 'staffpay', 'netpay', 'net pay', 'remuneration',
]

export const DISHONOUR_WORDS = [
  'dishonour', 'dishonor', 'returned unpaid', 'rtn unpaid', 'return unpaid',
  'payment returned', 'insufficient funds', 'unpaid item', 'reversal fee',
  'direct debit return', 'declined - insufficient', 'failed payment',
]

export const INTERNAL_TRANSFER_WORDS = [
  'linked account', 'internal transfer', 'transfer to savings', 'transfer from savings',
  'own account', 'between accounts',
]

// Lender names that appear differently on a statement and on a fact find.
// Used only to decide whether a commitment was declared, never to invent one.
export const LENDER_ALIASES: Record<string, string[]> = {
  'commonwealth bank': ['cba', 'commbank', 'commonwealth'],
  'national australia bank': ['nab'],
  'westpac': ['westpac', 'wbc'],
  'st george': ['stgeorge', 'stg'],
  'anz': ['anz'],
  'macquarie': ['macquarie', 'macq'],
  'ing': ['ing', 'ingdirect'],
  'bankwest': ['bankwest'],
  'suncorp': ['suncorp'],
  'bank of queensland': ['boq', 'bankofqueensland'],
  'me bank': ['mebank'],
  'ubank': ['ubank'],
  'latitude': ['latitude', 'gemvisa', 'gomastercard'],
  'toyota finance': ['toyotafinance', 'toyotafin'],
  'now finance': ['nowfinance'],
  'pepper money': ['peppermoney', 'pepper'],
  'liberty financial': ['libertyfin', 'liberty'],
  'societyone': ['societyone'],
  'harmoney': ['harmoney'],
  'american express': ['amex', 'americanexpress'],
  'citi': ['citibank', 'citi'],
  'hsbc': ['hsbc'],
}

export function normKey(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Short codes must match a whole word, never a substring. "ppl" is inside
// "apple", "ing" is inside almost everything, and "dva" is inside "advantage" -
// each of those produced a wrong finding on a real file before this split existed.
export function matchesAny(haystack: string, needles: string[]): boolean {
  const norm = normKey(haystack)
  const words = String(haystack || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return needles.some(n => {
    const k = normKey(n)
    if (!k) return false
    if (k.length <= 4) return words.includes(k)
    return norm.includes(k)
  })
}
