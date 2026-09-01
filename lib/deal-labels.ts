// What a deal IS, worked out from the deal rather than typed onto it.
//
// Fabio, 1 Sep 2026: "find a way to prepopulate labels based on BC and LO". A
// label somebody types is a label that drifts — the deal changes from a purchase
// to a refinance and the chip still says purchase forever. These are derived, so
// they cannot be wrong for long.
//
// Two chips, not one, because a deal has two independent facts about it: what
// kind of transaction it is, and what the property is for. "Purchase" and
// "Owner occupied" are both true at once, and squashing them into one label
// loses whichever one you drop.

export type TypeId = 'purchase' | 'refinance' | 'equity_release' | 'construction' | 'unknown'
export type UseId = 'owner_occupied' | 'investment' | 'smsf' | 'unknown'

export const TYPE_LABEL: Record<TypeId, string> = {
  purchase: 'Purchase',
  refinance: 'Refinance',
  equity_release: 'Equity release',
  construction: 'Construction',
  unknown: '',
}

export const USE_LABEL: Record<UseId, string> = {
  owner_occupied: 'Owner occupied',
  investment: 'Investment',
  smsf: 'SMSF',
  unknown: '',
}

// Defaults. Every one is overridable from Settings — these are only the starting
// point, and nothing on a card is colour alone: the word is always in the chip,
// so a colourblind reader, a printout or a phone in sunlight loses nothing.
export const TYPE_COLOUR: Record<TypeId, string> = {
  purchase:       '#0E6FA0',
  refinance:      '#1E7A4A',
  equity_release: '#0F6E6E',
  construction:   '#946017',
  unknown:        '#7A7266',
}

export const USE_COLOUR: Record<UseId, string> = {
  owner_occupied: '#5B4B8A',
  investment:     '#A3376B',
  smsf:           '#B25A33',
  unknown:        '#7A7266',
}

// BC templates carry both facts. Mapped once, here, rather than guessed at by
// every screen that wants to show a chip.
const FROM_TEMPLATE: Record<string, { type?: TypeId; use?: UseId }> = {
  refinance_equity:    { type: 'equity_release', use: 'owner_occupied' },
  refinance_only:      { type: 'refinance' },
  oo_purchase:         { type: 'purchase', use: 'owner_occupied' },
  oo_lvr_compare:      { type: 'purchase', use: 'owner_occupied' },
  investment_purchase: { type: 'purchase', use: 'investment' },
  investment_equity:   { type: 'equity_release', use: 'investment' },
  buy_sell:            { type: 'purchase' },
  fhb:                 { type: 'purchase', use: 'owner_occupied' },
  bridging:            { type: 'purchase' },
  family_pledge:       { type: 'purchase', use: 'owner_occupied' },
  smsf:                { type: 'purchase', use: 'smsf' },
  construction:        { type: 'construction' },
}

const TYPE_WORDS: [RegExp, TypeId][] = [
  [/equity\s*release/i, 'equity_release'],
  [/refinanc/i,         'refinance'],
  [/construct/i,        'construction'],
  [/purchase|buy/i,     'purchase'],
]
const USE_WORDS: [RegExp, UseId][] = [
  [/smsf|super/i,                    'smsf'],
  [/invest/i,                        'investment'],
  [/owner.?occupied|\boo\b|\bppor\b/i, 'owner_occupied'],
]

// The settlement fields win when they exist: they were set at lodgement, which is
// later and more certain than anything chosen at BC. Then the BC template. Then
// whatever words are on the deal itself.
export function typeOf(deal: any): TypeId {
  const txn = String(deal?.transaction_type || '')
  if (txn === 'purchase') return 'purchase'
  if (txn === 'refinance') return 'refinance'
  if (txn === 'equity_release') return 'equity_release'
  if (txn === 'construction') return 'construction'

  const tpl = FROM_TEMPLATE[String(deal?.bc_data?.template || '')]
  if (tpl?.type) return tpl.type

  const hay = `${deal?.deal_type || ''} ${deal?.deal_name || ''}`
  for (const [re, id] of TYPE_WORDS) if (re.test(hay)) return id
  return 'unknown'
}

export function useOf(deal: any): UseId {
  const use = String(deal?.property_use || '')
  if (use === 'owner_occupied' || use === 'investment' || use === 'smsf') return use as UseId

  const tpl = FROM_TEMPLATE[String(deal?.bc_data?.template || '')]
  if (tpl?.use) return tpl.use

  const hay = `${deal?.deal_type || ''} ${deal?.deal_name || ''}`
  for (const [re, id] of USE_WORDS) if (re.test(hay)) return id
  return 'unknown'
}

export type Chip = { id: string; label: string; colour: string }

// What goes on the card. An empty array is honest — a brand new deal genuinely is
// not any of these yet, and a chip reading "Unknown" is noise.
export function chipsFor(deal: any, overrides?: { type?: Partial<Record<TypeId, string>>; use?: Partial<Record<UseId, string>> }): Chip[] {
  const out: Chip[] = []
  const t = typeOf(deal)
  if (t !== 'unknown') out.push({ id: t, label: TYPE_LABEL[t], colour: overrides?.type?.[t] || TYPE_COLOUR[t] })
  const u = useOf(deal)
  if (u !== 'unknown') out.push({ id: u, label: USE_LABEL[u], colour: overrides?.use?.[u] || USE_COLOUR[u] })
  return out
}

// A broker's colour comes from Settings when someone has picked one. Until then a
// stable one derived from their key, so the board is readable on day one and
// nobody has to set nine colours before it is useful. Same key, same colour,
// every time — never random, or the board would repaint on each load.
const FALLBACK = ['#3B5BA5', '#B25A33', '#1E7A4A', '#5B4B8A', '#0F6E6E', '#A3376B', '#946017', '#0E6FA0']
export function brokerColour(key: string, overrides?: Record<string, string>): string {
  const k = String(key || '').trim().toLowerCase()
  if (!k) return '#7A7266'
  if (overrides?.[k]) return overrides[k]
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return FALLBACK[h % FALLBACK.length]
}

// A chip needs three colours from one: the text, a wash behind it, and a border.
// Derived so Settings only ever has to store one value per label.
export function chipStyle(colour: string): { color: string; background: string; borderColor: string } {
  return { color: colour, background: colour + '14', borderColor: colour + '38' }
}
