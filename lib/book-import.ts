// READING THE BOOK OUT OF A SPREADSHEET.
//
// 15 Oct 2026. Ten years of deals exported from the CRM, 796 rows, 656
// clients, and the portal has never met most of them.
//
// Everything here is a function of its arguments. No database, no fetch, no
// clock. The screen does the writing; this works out WHAT to write, and
// lib/book-import.test.ts holds it to the real shapes the export produces.
//
// ---------------------------------------------------------------------------
// THE THREE THINGS THAT MAKE THIS HARDER THAN IT LOOKS
// ---------------------------------------------------------------------------
//
// 1. IT IS ONE ROW PER DEAL, NOT PER CLIENT. 796 rows are 656 people. One
//    client has eight rows. Anything that treats a row as a person counts the
//    same person eight times.
//
// 2. THE BALANCE DOUBLE-COUNTS, AND SUMMING IT IS WRONG. The export matched
//    deals to commission loans, and a loan that funded two deals appears on
//    both rows - then a third row carries the SUM of three loans including
//    those two. Measured on the real file: the naive total is $220.8m, the
//    truth is $208.4m. Overstated by $12.5m. Only eleven clients are affected
//    and the worst is out by $6m - and those eleven are the multi-property
//    investors, which is to say exactly the people this whole project is for.
//    Get this wrong and the best candidates look like they have no equity and
//    drop off the list.
//
// 3. THE NAME IS A GROUP, NOT A PERSON. "Contact - group data - full name"
//    holds every applicant, comma separated: 140 of the 656 are one person,
//    225 are two, 64 are three, and one has fourteen. That is where the second
//    applicant on the deal comes from.

// ---------------------------------------------------------------------------
// WHAT WE NEED OUT OF THE SHEET
// ---------------------------------------------------------------------------
//
// `guess` is matched against the header with everything but letters and digits
// stripped, so "Commission\nLoan ID(s)" and "commission loan ids" are the same
// thing. First guess that hits wins, which is why they are ordered from most
// specific to least - "loanids" must be tried before "loan".

export type FieldKey =
  | 'contact' | 'dealRef' | 'owner' | 'settlementDate'
  | 'lender' | 'loanAmount' | 'loanIds' | 'currentBalance'
  | 'address' | 'postcode' | 'state' | 'propertyType' | 'zoning'
  | 'value' | 'ownershipType'

export type Field = {
  key: FieldKey
  label: string
  /** Without this the import cannot run at all. */
  required?: boolean
  guess: string[]
  why: string
}

export const FIELDS: Field[] = [
  { key: 'contact', label: 'Client name', required: true,
    guess: ['contactgroupdatafullname', 'fullname', 'contact', 'client', 'borrower'],
    why: 'Every applicant, comma separated. The first one becomes the client.' },
  { key: 'dealRef', label: 'Deal reference', required: true,
    guess: ['dealref', 'dealid', 'reference', 'ref'],
    why: 'Unique per row. What makes a second import an update instead of a copy.' },
  { key: 'owner', label: 'Broker',
    guess: ['dealowner', 'owner', 'broker'],
    why: 'Whose client they are. Decides who can see them.' },
  { key: 'settlementDate', label: 'Settled',
    guess: ['settlementdate', 'settled', 'datesettled'],
    why: 'How old the figures are. Older usually means more growth since.' },
  { key: 'lender', label: 'Lender',
    guess: ['lender', 'bank', 'funder'], why: 'Who holds the loan.' },
  { key: 'loanAmount', label: 'Loan at settlement',
    guess: ['totalloanamount', 'loanamount', 'loan'], why: 'What they borrowed.' },
  { key: 'loanIds', label: 'Commission loan IDs',
    guess: ['commissionloanids', 'loanids', 'loanid', 'commissionloan'],
    why: 'How a balance is tied to a loan. Without it balances cannot be de-duplicated.' },
  { key: 'currentBalance', label: 'Balance now',
    guess: ['currentbalance', 'balance', 'outstanding'],
    why: 'What they owe. Only a seed - the commission statements keep it current.' },
  { key: 'address', label: 'Property address', required: true,
    guess: ['security1address', 'securityaddress', 'address', 'property'],
    why: 'One property per row. The same address on two rows is one property.' },
  { key: 'postcode', label: 'Postcode',
    guess: ['security1postcode', 'postcode', 'postalcode'], why: '' },
  { key: 'state', label: 'State',
    guess: ['security1state', 'state'], why: '' },
  { key: 'propertyType', label: 'Property type',
    guess: ['securityproperty1type', 'security1type', 'propertytype'], why: '' },
  { key: 'zoning', label: 'Zoning',
    guess: ['security1zoning', 'zoning'], why: '' },
  { key: 'value', label: 'Value at settlement',
    guess: ['security1value', 'securityvalue', 'value', 'propertyvalue'],
    why: 'What it was worth then. Not what it is worth now.' },
  { key: 'ownershipType', label: 'Owner occupied or investment',
    guess: ['security1ownershiptype', 'ownershiptype', 'ownership', 'occupancy'],
    why: 'Only investments are counted towards equity.' },
]

export type Mapping = Partial<Record<FieldKey, string>>

const flat = (s: any): string => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Which column is which, guessed from the headers.
 *
 * A guess, offered for correction - never a decision. The screen shows every
 * one of these with the column beside it and the person says yes.
 */
export function guessMapping(headers: any[]): Mapping {
  const flatHeads = (headers || []).map(h => ({ raw: String(h ?? ''), flat: flat(h) }))
  const taken = new Set<string>()
  const out: Mapping = {}
  for (const f of FIELDS) {
    for (const g of f.guess) {
      const hit = flatHeads.find(h => h.flat && !taken.has(h.raw) &&
                                      (h.flat === g || h.flat.includes(g)))
      if (hit) { out[f.key] = hit.raw; taken.add(hit.raw); break }
    }
  }
  return out
}

export function whatIsMissing(m: Mapping): string[] {
  return FIELDS.filter(f => f.required && !m[f.key]).map(f => f.label)
}

// ---------------------------------------------------------------------------
// READING A CELL
// ---------------------------------------------------------------------------

const txt = (v: any): string => {
  if (v === null || v === undefined) return ''
  // An Invalid Date is still `instanceof Date`, and toISOString() throws on one
  // - RangeError: Invalid time value. That took a whole SFG commission
  // statement down on 18 Oct 2026; see the long note in lib/sfg.ts. Same shape,
  // same guard, so one bad cell costs its own row and nothing more.
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
  }
  if (typeof v === 'object') {
    // ExcelJS hands back { text, hyperlink } for a linked cell and
    // { richText: [...] } for a formatted one.
    if ('text' in v) return String((v as any).text ?? '').trim()
    if ('result' in v) return String((v as any).result ?? '').trim()
    if (Array.isArray((v as any).richText)) {
      return (v as any).richText.map((r: any) => String(r?.text ?? '')).join('').trim()
    }
  }
  return String(v).trim()
}

/** A number out of a cell that may be a number, '$620,000', or nothing. */
export function num(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = txt(v).replace(/[^0-9.\-]/g, '')
  if (!s || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 'YYYY-MM-DD' out of a cell, or empty. Never a Date, so nothing can drift. */
export function day(v: any): string {
  if (v instanceof Date) {
    // Built from the LOCAL parts. toISOString() would move an early-morning
    // date back a day in Australia - the same trap lib/portfolio-review.ts
    // was bitten by on 15 Oct 2026.
    const p = (n: number) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  const s = txt(v)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s) || /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  if (!m) return ''
  return m[0].includes('/') ? `${m[3]}-${m[2]}-${m[1]}` : `${m[1]}-${m[2]}-${m[3]}`
}

// ---------------------------------------------------------------------------
// THE PEOPLE IN A NAME
// ---------------------------------------------------------------------------

export type Person = { first: string; last: string; whole: string }

/**
 * "Jane Harkness, Peter Vostok" becomes two people.
 *
 * A company or a trust is left whole - "Harkness Family Super Pty Ltd" is one
 * applicant with no surname, and splitting it on the spaces would invent a
 * person called Family Super.
 */
const ENTITY = /\b(pty|ltd|limited|trust|trustee|super|smsf|holdings|nominees)\b/i

export function peopleIn(name: any): Person[] {
  const whole = txt(name)
  if (!whole) return []
  if (ENTITY.test(whole)) return [{ first: whole, last: '', whole }]
  return whole.split(/\s*,\s*|\s+&\s+|\s+and\s+/i)
    .map(p => p.trim()).filter(Boolean)
    .map(p => {
      const bits = p.split(/\s+/)
      return bits.length === 1
        ? { first: bits[0], last: '', whole: p }
        : { first: bits.slice(0, -1).join(' '), last: bits[bits.length - 1], whole: p }
    })
}

/** The key two spellings of the same group must share. */
export function clientKey(name: any): string {
  return txt(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// ONE CLIENT, BUILT FROM THEIR ROWS
// ---------------------------------------------------------------------------

export type BookProperty = {
  address: string
  postcode: string
  state: string
  propertyType: string
  zoning: string
  /** What it was worth at settlement. NOT what it is worth now. */
  valueAtSettlement: number | null
  investor: boolean
  settled: string
  lender: string
  loanAtSettlement: number | null
  loanIds: string[]
}

export type BookClient = {
  key: string
  /** Every applicant, in the order the CRM had them. */
  people: Person[]
  /** The whole string, kept so nothing is lost in the parsing. */
  groupName: string
  brokerKey: string
  dealRefs: string[]
  properties: BookProperty[]
  /** De-duplicated. See balanceOf. */
  owes: number | null
  /** The most recent settlement across all their deals. */
  lastSettled: string
  /** On the book means a commission statement still pays on at least one loan. */
  onTheBook: boolean
}

const idsIn = (v: any): string[] =>
  txt(v).split(/[,;]/).map(s => s.trim()).filter(Boolean)

/**
 * WHAT A CLIENT ACTUALLY OWES.
 *
 * Each row carries a balance and the loan ids that balance covers. The same
 * loan turns up on more than one row, and a row covering three loans holds the
 * sum of all three - so adding the column up counts loans twice.
 *
 * A balance belongs to a SET of loan ids. Where one set sits entirely inside
 * another, the bigger set already contains it and the smaller one is dropped.
 * What is left is added up.
 *
 * Measured on the real export: naive $220,831,180, this $208,352,905.
 */
export function balanceOf(rows: { loanIds: string[]; balance: number | null }[]): number | null {
  const sets = new Map<string, { ids: Set<string>; amount: number }>()
  for (const r of rows) {
    if (!r.loanIds.length || r.balance === null) continue
    const ids = new Set(r.loanIds)
    const k = [...ids].sort().join('|')
    const had = sets.get(k)
    // The same set twice is the same money, not twice the money.
    if (!had || r.balance > had.amount) sets.set(k, { ids, amount: r.balance })
  }
  if (sets.size === 0) return null
  const all = [...sets.values()]
  const keep = all.filter(a =>
    !all.some(b => b !== a && a.ids.size < b.ids.size && [...a.ids].every(i => b.ids.has(i))))
  return keep.reduce((t, k) => t + k.amount, 0)
}

export function groupByClient(rows: any[], m: Mapping): BookClient[] {
  const get = (r: any, k: FieldKey) => (m[k] ? r?.[m[k] as string] : undefined)
  const by = new Map<string, BookClient>()
  const bal = new Map<string, { loanIds: string[]; balance: number | null }[]>()

  for (const r of rows || []) {
    const groupName = txt(get(r, 'contact'))
    const key = clientKey(groupName)
    if (!key) continue

    let c = by.get(key)
    if (!c) {
      c = { key, groupName, people: peopleIn(groupName), brokerKey: '',
            dealRefs: [], properties: [], owes: null, lastSettled: '', onTheBook: false }
      by.set(key, c)
      bal.set(key, [])
    }

    const ref = txt(get(r, 'dealRef'))
    if (ref && !c.dealRefs.includes(ref)) c.dealRefs.push(ref)

    const owner = txt(get(r, 'owner'))
    // First broker named wins, so a client does not change hands because their
    // rows came back in a different order.
    if (owner && !c.brokerKey) c.brokerKey = owner

    const settled = day(get(r, 'settlementDate'))
    if (settled > c.lastSettled) c.lastSettled = settled

    bal.get(key)!.push({ loanIds: idsIn(get(r, 'loanIds')), balance: num(get(r, 'currentBalance')) })

    const address = txt(get(r, 'address'))
    if (address) {
      const same = c.properties.find(p => p.address.toLowerCase() === address.toLowerCase())
      const ids = idsIn(get(r, 'loanIds'))
      if (same) {
        // THE SAME ADDRESS ON TWO ROWS IS ONE PROPERTY, refinanced or split.
        // The loans accumulate; the value stays the one we already had unless
        // this row is the newer settlement.
        for (const i of ids) if (!same.loanIds.includes(i)) same.loanIds.push(i)
        if (settled > same.settled) {
          same.settled = settled
          same.lender = txt(get(r, 'lender')) || same.lender
          const v = num(get(r, 'value'))
          if (v !== null) same.valueAtSettlement = v
        }
      } else {
        c.properties.push({
          address,
          postcode: txt(get(r, 'postcode')),
          state: txt(get(r, 'state')),
          propertyType: txt(get(r, 'propertyType')),
          zoning: txt(get(r, 'zoning')),
          valueAtSettlement: num(get(r, 'value')),
          // ANYTHING NOT SAID TO BE AN INVESTMENT IS TREATED AS A HOME.
          // Counting a home's equity would inflate the figure and the email
          // would be wrong, so silence errs towards not counting it.
          investor: /invest/i.test(txt(get(r, 'ownershipType'))),
          settled,
          lender: txt(get(r, 'lender')),
          loanAtSettlement: num(get(r, 'loanAmount')),
          loanIds: ids,
        })
      }
    }
  }

  for (const [key, c] of by) {
    c.owes = balanceOf(bal.get(key) || [])
    c.onTheBook = c.owes !== null
  }
  return [...by.values()]
}

// ---------------------------------------------------------------------------
// WHAT MAKES SOMEBODY WORTH OPENING
// ---------------------------------------------------------------------------

/**
 * Equity already showing, at settlement values, with NO growth assumed.
 *
 * A floor, never an estimate. The real figure is almost always higher because
 * these values are up to six years old - which is the point: if the floor is
 * already worth a conversation, the truth certainly is.
 *
 * Returns null when there is nothing to work it out from, which is different
 * from zero and has to stay different: zero means "no equity", null means
 * "we do not know", and only one of those should drop somebody down the list.
 */
export function headroom(c: BookClient, lvr = 0.8): number | null {
  if (c.owes === null) return null
  const value = c.properties
    .filter(p => p.investor && p.valueAtSettlement !== null)
    .reduce((t, p) => t + (p.valueAtSettlement as number), 0)
  if (value <= 0) return null
  return Math.round(value * lvr - c.owes)
}

/** Biggest headroom first; unknown and nothing-showing last, in that order. */
export function worthOpeningFirst(list: BookClient[], lvr = 0.8): BookClient[] {
  return [...list].sort((a, b) => {
    const ha = headroom(a, lvr), hb = headroom(b, lvr)
    if (ha === null && hb === null) return a.groupName.localeCompare(b.groupName)
    if (ha === null) return 1
    if (hb === null) return -1
    return hb - ha
  })
}

// ---------------------------------------------------------------------------
// WHAT GETS WRITTEN
// ---------------------------------------------------------------------------

/**
 * The client's position, in the shape the portal already stores it.
 *
 * NOT a new table. clients.position_properties is where a position lives, it
 * is what the client page draws, it is what docs/client-loans-view.sql reads,
 * and it is what the Rate exposure and LVR exposure reports are built on. Put
 * the book here and those two reports stop being about the handful of clients
 * the portal happens to know and start being about all 656.
 */
export function positionProperties(c: BookClient): any[] {
  return c.properties.map(p => ({
    address: p.address,
    value: p.valueAtSettlement === null ? '' : String(p.valueAtSettlement),
    ownershipType: p.investor ? 'Investment' : 'Owner occupied',
    postcode: p.postcode,
    state: p.state,
    propertyType: p.propertyType,
    loans: p.lender || p.loanAtSettlement !== null ? [{
      lenderName: p.lender,
      limitAmount: p.loanAtSettlement === null ? '' : String(p.loanAtSettlement),
      // NO BALANCE HERE, ON PURPOSE.
      //
      // The spreadsheet's balance is per CLIENT once de-duplicated, and it
      // cannot be split back across properties - a row covering three loans
      // gives one number for all three. Writing a guess into each property
      // would be inventing a figure. The balance that matters is the one the
      // commission statements carry, loan by loan, every month.
      balance: '',
      status: 'Active',
    }] : [],
  }))
}

/** The one key that makes a second import an update rather than a copy. */
export function rowKeyFor(c: BookClient): string {
  return `book:${c.key}`
}

export type Decision = 'new' | 'matched' | 'maybe'

export type Planned = {
  client: BookClient
  decision: Decision
  /** The portal client this is believed to be, when there is one. */
  existingId?: string
  /** Why it is only a maybe. Shown to the person; never guessed past. */
  doubt?: string
  headroom: number | null
}

/**
 * What the import is about to do, BEFORE it does any of it.
 *
 * Nothing in here writes. The screen shows this, the person reads it, and only
 * then does anything happen. An import that can quietly create a second copy
 * of a thousand clients is an import nobody dares run twice - which is the
 * lesson the lender library taught the hard way.
 */
export function planTheImport(
  book: BookClient[],
  existing: { id: string; first_name: string; last_name: string; book_row_key?: string | null }[],
  lvr = 0.8,
): Planned[] {
  const byKey = new Map<string, string>()
  const byName = new Map<string, string[]>()
  for (const e of existing || []) {
    if (e.book_row_key) byKey.set(e.book_row_key, e.id)
    const n = clientKey(`${e.first_name || ''} ${e.last_name || ''}`)
    if (n) byName.set(n, [...(byName.get(n) || []), e.id])
  }

  return worthOpeningFirst(book, lvr).map(c => {
    const key = rowKeyFor(c)
    const already = byKey.get(key)
    if (already) {
      return { client: c, decision: 'matched', existingId: already, headroom: headroom(c, lvr) }
    }
    // The first applicant is the one the portal would hold as the client.
    const first = c.people[0]
    const hits = first ? (byName.get(clientKey(`${first.first} ${first.last}`)) || []) : []
    if (hits.length === 1) {
      return {
        client: c, decision: 'maybe', existingId: hits[0], headroom: headroom(c, lvr),
        doubt: 'Same name as a client already in the portal. Is it the same person?',
      }
    }
    if (hits.length > 1) {
      return {
        client: c, decision: 'maybe', headroom: headroom(c, lvr),
        doubt: `${hits.length} clients in the portal share this name.`,
      }
    }
    return { client: c, decision: 'new', headroom: headroom(c, lvr) }
  })
}

export function countThePlan(plan: Planned[]) {
  return {
    all: plan.length,
    fresh: plan.filter(p => p.decision === 'new').length,
    matched: plan.filter(p => p.decision === 'matched').length,
    maybe: plan.filter(p => p.decision === 'maybe').length,
    onTheBook: plan.filter(p => p.client.onTheBook).length,
    worthOpening: plan.filter(p => (p.headroom ?? 0) > 150000).length,
  }
}
