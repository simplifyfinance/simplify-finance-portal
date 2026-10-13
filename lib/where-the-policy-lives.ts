// WHERE EACH LENDER'S CREDIT POLICY ACTUALLY LIVES.
//
// 13 Oct 2026. Fabio: "do you still have document on file that breaksdown some
// lenders info is availble on their website?" The honest answer was no. The
// blueprint's section 4 register had real links for seven lenders and thirty
// rows that said nothing but a homepage and the word "unverified".
//
// So every one was checked, live, that afternoon. This is what came back.
//
// THIS IS NOT POLICY AND MUST NEVER READ AS POLICY. Not one line here says what
// a bank will lend. It says where to go and look, which is our own note about a
// website, carrying the day we looked. Paco uses it in exactly one place: when
// he has nothing in writing for a bank, instead of stopping at "nothing
// recorded" he says where the thing he is missing can be found.
//
// IT GOES STALE BY DESIGN. Macquarie was version 13.1 in the blueprint and
// 14.1 by the time it was checked, inside twelve months, and nothing told
// anybody. The date below is the day a human-run check was done, and it is
// printed everywhere this is shown, so nobody mistakes a year-old note for a
// live fact.

export type Access =
  | 'public'   // readable today without a login
  | 'portal'   // exists, behind a broker login - somebody has to go and get it
  | 'none'     // nothing published, and no portal found. Ask a BDM.

export type Firmness =
  | 'policy'   // the lender's own credit policy or lending policy
  | 'guide'    // detailed, dated, useful - but a guide, and often says so

export type Source = {
  /** The lender, as the register names it. Matched loosely - see whereFor. */
  lender: string
  /** Other names the same bank goes by in our list. */
  also?: string[]
  access: Access
  /** Only meaningful when access is 'public'. */
  firmness?: Firmness
  /** One plain sentence: what is actually there. */
  what: string
  /** The address, for a public one. */
  url?: string
  /** The date or version printed ON the document, copied exactly. '' if none. */
  dated?: string
  /** Where to log in, for a portal one. */
  portal?: string
  /** Anything a person needs to know before trusting it. */
  note?: string
}

/** The day a person checked every link in this file. Shown wherever it is. */
export const REGISTER_CHECKED_ON = '2026-10-13'

export const WHERE_THE_POLICY_LIVES: Source[] = [
  // ---- public, and a real credit policy ---------------------------------
  {
    lender: 'Macquarie', access: 'public', firmness: 'policy',
    what: 'Residential Home Loans Credit Guidelines, 41 pages. Product, character, capacity, collateral and construction.',
    url: 'https://www.macquarie.com.au/assets/bfs/documents/broker/mortgages/macquarie_broker-credit-guidelines.pdf',
    dated: 'Version 14.1, last updated 10 September 2026',
  },
  {
    lender: 'Firstmac', access: 'public', firmness: 'policy',
    what: 'Property Lending Policy (Broker), about 100 pages. Residential and SMSF, serviceability, security, valuations, low doc and bridging.',
    url: 'https://www.firstmac.com.au/media/pdf/brokers/Firstmac-Residential-Lending-Policy.pdf',
    dated: 'Version 2026-09 (1.0), change log 21 September 2026',
  },
  {
    lender: 'MyState', access: 'public', firmness: 'policy',
    what: 'Mortgage Lending Procedure, broker version. Servicing floor and buffer, income types, LVR, security and guarantors.',
    url: 'https://brokers.mystate.com.au/credit-policy/',
    dated: 'Broker version 1.0a, effective 1 July 2026',
  },
  {
    lender: 'Auswide', access: 'public', firmness: 'policy',
    what: 'The same document MyState publishes. Since the merger it covers both banks and says so on its face.',
    url: 'https://brokers.mystate.com.au/wp-content/uploads/broker_home_lending_procedure.pdf',
    dated: 'Broker version 1.0a, effective 1 July 2026',
    note: 'File it under Auswide as well, or Paco will say he has nothing for this bank.',
  },
  {
    lender: 'Pepper', also: ['Pepper Money'], access: 'public', firmness: 'policy',
    what: 'Product guide carrying full servicing and lending policy sections, backed by public policy pages for credit history, income, self employed, alt doc, investor, construction and securities.',
    url: 'https://www.pepperbroker.com.au/content/dam/aubroker/broker-au-documents-nc/pepper-money-retail-product-guide.pdf',
    dated: 'V7, effective 21 August 2026',
  },
  {
    lender: 'AMP', also: ['AMP Bank'], access: 'public', firmness: 'policy',
    what: 'An A to Z policy library as web pages, about 35 topics, with a deep SMSF section. The best public source any bank on this list has.',
    url: 'https://distributor.amp.com.au/policies',
    dated: '',
    note: 'No version and no date anywhere on it. The page only says it is updated regularly, so the day we read it is the only date there will ever be.',
  },
  {
    lender: 'Bank Australia', access: 'public', firmness: 'policy',
    what: 'A Credit Underwriting Policy PDF linked straight off the public broker page.',
    url: 'https://www.bankaust.com.au/broker-partners',
    dated: '',
    note: 'The PDF itself could not be opened to confirm its date, and their broker accreditations are paused. Low priority.',
  },

  // ---- public, detailed, but a guide ------------------------------------
  {
    lender: 'MA Money', access: 'public', firmness: 'guide',
    what: 'Residential and Vacant Land Rate and Product Guide. LVR tables, postcode categories, credit impairment, arrears, bankruptcy, PAYG and self employed verification, DSCR and buffers.',
    url: 'https://www.mamoney.com.au/brokers/resources/rate-product-information/residential-guide/',
    dated: '9 October 2026',
  },
  {
    lender: 'RedZed', access: 'public', firmness: 'guide',
    what: 'Product and Rate Guide. Carries LVR caps, defaults, bankruptcy and Part IX, ATO debt, arrears, ABN tenure, full, alt and lease doc, and living expenses.',
    url: 'https://assets.redzed.com/download/d2d89728851911efaaa8368884597301',
    dated: 'v6, October 2026',
  },
  {
    lender: 'Thinktank', access: 'public', firmness: 'guide',
    what: 'Residential Lending Information and Rates. LVR caps and the stressed servicing test. No credit history section.',
    url: 'https://thinktank.au/wp-content/uploads/2025/02/Thinktank-Resi-Info-and-Rates-v20261006.pdf',
    dated: 'v20261006, effective 6 October 2026',
    note: 'Their domain moved. thinktank.net.au now redirects to thinktank.au.',
  },
  {
    lender: 'La Trobe', also: ['La Trobe Finance', 'La Trobe Financial'], access: 'public', firmness: 'guide',
    what: 'Residential lending term sheet. LVR tiers, risk grades A to C3, full and lite doc evidence, and a life event approach to credit history.',
    url: 'https://www.latrobefinancial.com.au/app/uploads/latrobefinancial-residential-lending-term-sheet.pdf',
    dated: 'reference 03B_005_300626',
    note: 'Almost no rates and no serviceability figures.',
  },
  {
    lender: 'Bank of Sydney', access: 'public', firmness: 'guide',
    what: 'Residential Lending Guidelines. Borrowers, income, servicing, LVRs, security, cash out, VOI and the LMI waiver professions.',
    url: 'https://www.banksyd.com.au/globalassets/documents/pdfs/broker/2025.11bosbroker-lending-guidelines.pdf',
    dated: 'Version 2025.4, November 2025',
    note: 'Says on its own face that it is not the full policy, and it is a year old.',
  },
  {
    lender: 'Bluestone', also: ['Bluestone Home Loans'], access: 'public', firmness: 'guide',
    what: 'Online credit policy as a web page. Borrower eligibility, income, credit impairment, LVR, serviceability, cash out, securities and SMSF.',
    url: 'https://bluestone.com.au/online-credit-policy',
    dated: 'Last updated 10 November 2025',
    note: 'The page says it is a guide only and to go to the BDM for the full policy.',
  },
  {
    lender: 'Westpac', access: 'public', firmness: 'guide',
    what: 'A "Policy made simple" summary page. LMI waivers, self employed and investor positions.',
    url: 'https://westpac.com.au/brokers/policy',
    dated: '',
    portal: 'BrokerHub',
    note: 'The page itself says to go to BrokerHub for the actual Credit Policy. Thin, and undated.',
  },
  {
    lender: 'St George', also: ['St.George', 'StGeorge'], access: 'public', firmness: 'guide',
    what: 'A "Policy made simple" summary page, the same Westpac Group template.',
    url: 'https://www.stgeorge.com.au/broker/policy',
    dated: '',
    portal: 'BrokerHub',
    note: 'Points at BrokerHub for the real policy. Undated.',
  },

  // ---- behind a login ----------------------------------------------------
  { lender: 'NAB', access: 'portal', portal: 'NAB Broker portal',
    what: 'Nothing public. Two searches found only aggregator summaries and consumer credit guides.' },
  { lender: 'CBA', also: ['Commonwealth Bank', 'CommBank'], access: 'portal', portal: 'CommBroker',
    what: 'Pricing, turnaround times and the serviceability calculator all sit behind it. Only the Financial Services Guide is public.' },
  { lender: 'ANZ', access: 'portal', portal: 'ANZ Broker Portal, anz-originator.com.au',
    what: 'The public broker page carries an LMI waiver fact sheet and cashback terms. Nothing else.' },
  { lender: 'Bank of Melbourne', access: 'portal', portal: 'BrokerHub',
    what: 'Public side is a product flyer. Same hub as Westpac and St George.' },
  { lender: 'BankSA', access: 'portal', portal: 'BrokerHub, not confirmed',
    what: 'No BankSA broker page surfaced at all. Almost certainly the same hub, but nobody has confirmed it.' },
  { lender: 'Bankwest', access: 'portal', portal: 'lending.bankwest.com.au',
    what: 'Public side is an accreditation form and the Financial Services Guide.' },
  { lender: 'Bank of Queensland', also: ['BOQ'], access: 'portal', portal: 'boqbroker.powerappsportals.com',
    what: 'BOQ states outright that the portal holds policy details and requirements.' },
  { lender: 'Bendigo', also: ['Bendigo Bank'], access: 'portal', portal: 'Bendigo Broker Portal',
    what: 'Public side is fact sheets, a document checklist and a serviceability calculator.' },
  { lender: 'Adelaide Bank', access: 'portal', portal: 'brokers.adelaidebank.com.au',
    what: 'Same group as Bendigo but a separate broker site and no shared public policy. Partner Assist is their phone line for policy.' },
  { lender: 'ING', access: 'portal', portal: 'broker.ing.com.au',
    what: 'Public product sheets are features rather than criteria and carry no dates. The serviceability calculator is public.' },
  { lender: 'Liberty', also: ['Liberty Financial'], access: 'portal', portal: 'Liberty IQ, iq.liberty.com.au',
    what: 'Every product card on the public page says to log in for full details.' },
  { lender: 'ubank', access: 'portal', portal: 'Broker Access',
    what: 'Nothing public beyond the consumer credit guide and target market determinations.' },
  { lender: 'People First', also: ["People's Choice", 'Heritage', 'Heritage Bank'], access: 'portal',
    portal: 'People First secure broker portal',
    what: 'Heritage and People’s Choice are one entity now and Heritage’s broker site is only a transition page.',
    note: 'File under one name, not two.' },
  { lender: 'P&N Bank', also: ['PN Bank'], access: 'portal', portal: 'P&N Broker Hub',
    what: 'The resources page says product and policy information is on the hub, which is not linked publicly.' },

  // ---- nothing to chase --------------------------------------------------
  { lender: 'Suncorp', also: ['Suncorp Bank'], access: 'none',
    what: 'No Suncorp-hosted broker page could be confirmed at all.',
    note: 'Ask your BDM where the policy actually lives before sending anybody looking.' },
  { lender: 'ORDE', also: ['ORDE Financial'], access: 'none',
    what: 'Their own site returned nothing indexed. The only public guide found is a copy on an aggregator’s site dated 13 September 2022.',
    note: 'Four ORDE broker product guides are already in Fabio’s Downloads, the newest 1 July 2026. Use those.' },
  { lender: 'Resimac', access: 'none',
    what: 'A public product guide and per-product spec sheets exist, but not one carries a version or an effective date.',
    note: 'Undated is unusable for policy. Treat what is there as a rate sheet.' },
  { lender: 'Great Southern Bank', access: 'none',
    what: 'No broker hub, no policy document, nothing but trade press and consumer determinations.' },
  { lender: 'Teachers Mutual', also: ['Teachers Mutual Bank', 'TMBank'], access: 'none',
    what: 'A broker hub exists but its resources page blocks automated reading, and they push policy changes through aggregator bulletins instead of publishing.' },
  { lender: 'Gateway', also: ['Gateway Bank'], access: 'none',
    what: 'Checklists and accreditation links only. Every page says to contact your BDM.' },
  { lender: 'Bank First', access: 'none',
    what: 'A broker accreditation form exists, so they do take brokers, but there is no broker section and no published policy.' },
  { lender: 'Beyond Bank', access: 'none',
    what: 'No broker section found. The credit guide that surfaces is the consumer one, not a credit policy.' },
  { lender: 'Police Bank', access: 'none',
    what: 'No broker channel evident at all.',
    // THE ONE THAT NEARLY GOT THROUGH. Searching for Police Bank's broker
    // underwriting guidelines returns a real, correctly titled, properly
    // formatted PDF - and it belongs to BankVic. A person can make that
    // mistake in ten seconds, so a machine certainly can, which is why nothing
    // in this portal files a document under a name read out of the document.
    note: 'Careful. Searching for their broker underwriting guidelines returns a real document that belongs to BankVic, a different bank.' },
  { lender: 'BankVic', access: 'none',
    what: 'Not checked in the sweep. Their broker underwriting guidelines do turn up in search, but under Police Bank’s name.',
    note: 'Worth five minutes before anybody files it under the wrong bank.' },
  { lender: 'Australian Military Bank', access: 'none',
    what: 'Products, DHOAS and a rate card are published. No assessment criteria anywhere.' },
]

const flat = (v: any): string =>
  (typeof v === 'string' ? v : v == null ? '' : String(v)).toLowerCase().replace(/[^a-z0-9]/g, '')

// SHORT NAMES MATCH EXACTLY, LONGER ONES MAY CONTAIN. "AMP" has to be AMP, or
// it starts matching anything with those three letters in it. "Bank of
// Queensland" can match "BOQ Bank of Queensland" either way round.
const SHORT = 4

function hits(key: string, asked: string): boolean {
  const k = flat(key), a = flat(asked)
  if (!k || !a) return false
  if (k.length <= SHORT || a.length <= SHORT) return k === a
  return k === a || k.includes(a) || a.includes(k)
}

/**
 * The register's row for a lender, by whatever name our list calls it.
 *
 * Returns null rather than guessing. A bank we have no row for is a bank
 * nobody looked at, which is a different thing from a bank with nothing.
 */
export function whereFor(lenderName: any): Source | null {
  const asked = flat(lenderName)
  if (!asked) return null
  for (const s of WHERE_THE_POLICY_LIVES) {
    if (hits(s.lender, asked)) return s
    for (const other of s.also || []) if (hits(other, asked)) return s
  }
  return null
}

/** One line for a tile: what is there, in as few words as it takes. */
export function sourceLine(s: Source | null): string {
  if (!s) return ''
  if (s.access === 'portal') return `Behind a login — ${s.portal || 'their broker portal'}`
  if (s.access === 'none') return 'Nothing published. Ask a BDM.'
  return s.firmness === 'policy'
    ? `Public credit policy${s.dated ? ` — ${s.dated}` : ', undated'}`
    : `Public guide, not the policy${s.dated ? ` — ${s.dated}` : ''}`
}

/**
 * What Paco says when he has nothing in writing for a bank.
 *
 * NOT an answer to the question. It is the next step, so a dead end becomes a
 * job somebody can do. Every line of it is stamped with the day a person
 * checked, because this file is a note about websites and websites move.
 */
export function whereToGetIt(lenderName: any): string {
  const s = whereFor(lenderName)
  if (!s) return ''
  const when = ` (our own check, ${REGISTER_CHECKED_ON})`
  if (s.access === 'public') {
    const kind = s.firmness === 'policy' ? 'publishes its credit policy' : 'publishes a lending guide'
    return `${s.lender} ${kind} publicly${s.dated ? `, ${s.dated}` : ''}. ` +
      `Nobody has put it in the library yet${s.url ? `: ${s.url}` : ''}.${when}`
  }
  if (s.access === 'portal') {
    return `${s.lender} keeps its policy behind ${s.portal || 'a broker login'}. ` +
      `Somebody has to go in and pull it out.${when}`
  }
  return `${s.lender} publishes nothing we could find. Ask the BDM.${when}`
}
