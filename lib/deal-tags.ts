// WHAT MADE THIS DEAL HARD.
//
// 12 Oct 2026. The one thing about a deal that nothing in this portal records,
// and the one thing somebody will search on two years later.
//
// WHY IT IS NOT A SECOND "WHY THIS LENDER" BOX. The Lending Options tab already
// holds every lender considered, which one was recommended, the broker's own
// words on why, whether the client overrode it and the reason they gave - and
// the deal itself records whether it was lodged, approved or declined. Asking
// anybody to type a reason again would be a second door onto recommendationNote,
// and it would be filled in with "best rate".
//
// What none of that says is "the TITLE was the problem". A recommendation note
// explains why a product suits a client, because that is what it is for. It
// never names the obstacle - so the obstacle is the only thing worth adding, and
// it is worth adding as taps rather than prose.
//
// GROUPED, BECAUSE TWENTY-SIX IN A ROW IS A WALL. The five groups are how a
// broker already sorts what is awkward about a deal: the security, the income,
// the structure, the credit, and everything else.
//
// NOTHING IS REQUIRED. A deal with nothing unusual gets no tags, and Paco learns
// nothing from it - which is correct, because there is nothing to learn.

export type TagGroup = { group: string; tags: string[] }

export const TAG_GROUPS: TagGroup[] = [
  { group: 'The security', tags: [
    'Limited title', 'Company title', 'Rural / acreage', 'High density',
    'Off the plan', 'Strata defects', 'Dual occupancy',
  ] },
  { group: 'The income', tags: [
    'Casual income', 'Self-employed under 2 yrs', 'Contract income',
    'Overtime / allowances', 'Foreign income', 'Trust income',
  ] },
  { group: 'The structure', tags: [
    'SMSF', 'Company or trust borrower', 'Guarantor', 'Construction',
    'Bridging', 'Multiple securities',
  ] },
  { group: 'The credit', tags: [
    'Credit impairment', 'Debt consolidation', 'ATO debt', 'Exiting private lending',
  ] },
  { group: 'Other', tags: [
    'Serviceability', 'Turnaround', 'Cashback', 'Policy exception granted',
  ] },
]

// Every tag, flat. The order is the order on screen, which is the order a broker
// reads them in - so a list built from this reads the same way.
export const ALL_TAGS: string[] = TAG_GROUPS.flatMap(g => g.tags)

// HOW PEOPLE ACTUALLY ASK FOR THESE.
//
// 12 Oct 2026. Paco matches a question against this list by words, not by a
// model's judgement - so the list has to know that somebody asking about "self
// employed" means the tag that reads "Self-employed under 2 yrs", and that
// nobody types "SMSF" when they mean "self managed super fund" half the time.
//
// ONLY WORDS THAT MEAN THE SAME THING. This is not a place to widen a tag: an
// alias that is merely RELATED makes Paco answer a question nobody asked, which
// is the same failure as inventing. "Acreage" belongs to rural; "regional" does
// not, because a regional townhouse is not an acreage.
export const TAG_ALIASES: Record<string, string[]> = {
  'Limited title':             ['limited and qualified title', 'qualified title', 'limited titles'],
  'Company title':             ['company titles'],
  'Rural / acreage':           ['rural', 'acreage', 'rural residential', 'hobby farm'],
  'High density':              ['high rise', 'highrise', 'inner city apartment'],
  'Off the plan':              ['otp', 'off plan'],
  'Strata defects':            ['strata defect', 'building defects', 'defective strata'],
  'Dual occupancy':            ['dual occ', 'granny flat', 'secondary dwelling'],
  'Casual income':             ['casual', 'casual employment'],
  'Self-employed under 2 yrs': ['self employed', 'selfemployed', 'self employed under 2 years',
                                'under two years self employed'],
  'Contract income':           ['contractor', 'contract employment', 'fixed term contract'],
  'Overtime / allowances':     ['overtime', 'allowances', 'shift allowance', 'penalty rates'],
  'Foreign income':            ['overseas income', 'foreign currency income'],
  'Trust income':              ['distributions from a trust'],
  'SMSF':                      ['self managed super', 'self managed super fund', 'super fund purchase'],
  'Company or trust borrower': ['company borrower', 'trust borrower', 'corporate trustee'],
  'Guarantor':                 ['family guarantee', 'guarantee', 'security guarantee'],
  'Construction':              ['construction loan', 'building a home', 'knock down rebuild'],
  'Bridging':                  ['bridging loan', 'bridge', 'peak debt'],
  'Multiple securities':       ['multiple security', 'cross collateralised', 'two securities'],
  'Credit impairment':         ['bad credit', 'default', 'credit default', 'impaired credit'],
  'Debt consolidation':        ['consolidation', 'consolidating debt', 'debt consol'],
  'ATO debt':                  ['tax debt', 'ato'],
  'Exiting private lending':   ['private lender', 'private lending', 'caveat loan'],
  'Serviceability':            ['servicing', 'borrowing capacity', 'service'],
  'Turnaround':                ['turnaround times', 'sla', 'fast approval', 'quick approval'],
  'Cashback':                  ['cash back', 'rebate'],
  'Policy exception granted':  ['exception', 'policy exception', 'escalation'],
}

const txt = (v: any) => String(v ?? '').trim()

// WHAT THIS DEAL IS TAGGED WITH, AND NOTHING ELSE.
//
// Read through the known list rather than handed back as stored. A tag that was
// renamed or retired stops being returned rather than lingering as a string
// nobody can search for - and a deal saved before this existed has none, which
// is the same as a deal nobody tagged. Both are "we do not know", and neither is
// "nothing was hard".
export function tagsOf(lo: any): string[] {
  const raw = Array.isArray(lo?.dealTags) ? lo.dealTags : []
  const have = new Set(raw.map(txt))
  return ALL_TAGS.filter(t => have.has(t))
}

// Toggling one, kept here so the screen and anything else that needs it cannot
// disagree about the order. The result follows ALL_TAGS, never click order.
export function toggleTag(current: any, tag: string): string[] {
  const now = new Set(tagsOf({ dealTags: current }))
  if (now.has(tag)) now.delete(tag)
  else if (ALL_TAGS.includes(tag)) now.add(tag)
  return ALL_TAGS.filter(t => now.has(t))
}

// "Limited title and Turnaround", for saying back what was picked.
export function tagLine(tags: string[]): string {
  const list = tagsOf({ dealTags: tags })
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

// WHICH GROUP A TAG BELONGS TO, or empty for one that is no longer offered.
export function groupOf(tag: string): string {
  return TAG_GROUPS.find(g => g.tags.includes(txt(tag)))?.group || ''
}
