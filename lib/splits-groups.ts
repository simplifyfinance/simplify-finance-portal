// HOW THE COMMISSION SPLITS ARE GROUPED IN THE DROPDOWN.
//
// 19 Nov 2026. Fabio, with the mock beside the live screen: "see another
// example that the mock and reality are COMPLETELY DIFFERENT."
//
// He was right, and there were two faults under it.
//
// THE FIRST WAS THE DATA. commission_splits.kind defaults to 'referrer' and
// nobody had ever set it, so all fourteen arrangements read as referrers - the
// three "Simplify Finance Brokers" rows included, which are the opposite
// thing. One group, fourteen rows, two of them reading "Justin Cornock" and
// two reading "Navigate Advisors", with nothing to tell them apart. Fixed in
// the table on 19 Nov: 2 referrer, 3 broker_split, 3 firm, 6 other.
//
// THE SECOND WAS THE ELEMENT. The screen used the browser's own <select>,
// which the operating system draws. It cannot carry a styled heading, a tick,
// or a second line under a name - so the mock was never buildable with it, and
// I should have said so when I drew the mock instead of a fortnight later.
// See components/WhoSharesThisDeal.tsx, which draws its own list now.
//
// FOUR GROUPS, IN FABIO'S ORDER: "I like the way the dropdown box was
// separated, they wrote, they referrers, partner firms etc."

import { termsShort } from './split-order'
import { splitShortName, type Split } from './who-shares-this-deal'

export type Kind = 'referrer' | 'broker_split' | 'firm' | 'other'

/** The order they are offered in. Anything unrecognised falls in with 'other'. */
export const KIND_ORDER: Kind[] = ['referrer', 'broker_split', 'firm', 'other']

export const KIND_HEAD: Record<Kind, string> = {
  referrer: 'They referred it',
  broker_split: 'They wrote it',
  firm: 'Partner firms',
  other: 'Everything else',
}

/** The quiet half of the heading. Empty where the heading says it all. */
export const KIND_NOTE: Record<Kind, string> = {
  referrer: 'we wrote the loan',
  broker_split: 'broking under our licence',
  firm: '',
  other: '',
}

export function kindOf(v: any): Kind {
  const k = String(v ?? '').trim()
  return (KIND_ORDER as string[]).includes(k) ? (k as Kind) : 'other'
}

/**
 * WHAT THE SHUT BOX SAYS AFTER THE NAME.
 *
 * 19 Nov 2026. The first version put the group's own heading there, so a
 * chosen deal read "Justin Cornock - they referred it". Fabio: "it's a stupid,
 * in English doesn't make sense... just say he is the referrer."
 *
 * He is right. A heading over a list is a sentence about the list; the same
 * words beside one chosen name are a sentence about a person, and they come
 * out wrong. "the referrer" and "the broker" are what somebody would say out
 * loud about Justin.
 */
export function kindTail(v: any): string {
  const k = kindOf(v)
  return k === 'referrer' ? 'the referrer'
    : k === 'broker_split' ? 'the broker'
    : ''
}

export type Row = { split: Split; label: string; terms: string }
export type Group = { kind: Kind; head: string; note: string; rows: Row[] }

/**
 * THE LIST, GROUPED, WITH A SECOND LINE ONLY WHERE TWO ROWS READ THE SAME.
 *
 * 17 Nov 2026, Fabio: "I don't really need the splits showing, it's very
 * busy." So a row is a bare name - unless two rows in the list would read
 * identically, which is the one case where a bare name tells you nothing.
 *
 * THE TEST IS WITHIN A GROUP, NOT ACROSS THE LIST. Justin Cornock appears
 * twice - once as the man who referred it and once as the man who wrote it -
 * and the two headings say which is which better than any line underneath
 * could. The two Navigate Advisors rows are in the SAME group, so the heading
 * cannot help them, and they are the only two that get a line.
 *
 * AND IF THE TERMS ARE NOT RECORDED, IT FALLS BACK TO THE STORED NAME. On 19
 * Nov both Navigate Advisors rows had no upfront and no trail, so the line
 * that was meant to separate them would have been blank and the two rows
 * would still have been identical. The full name is at least a fact we hold.
 */
export function splitGroups(list: Split[]): Group[] {
  const rows = (list || []).map(s => ({ split: s, label: splitShortName(s.name) }))

  return KIND_ORDER
    .map(kind => {
      const mine = rows
        .filter(r => kindOf(r.split.kind) === kind)
        .sort((a, b) => a.label.localeCompare(b.label))

      const seen = new Map<string, number>()
      for (const r of mine) {
        const k = r.label.toLowerCase()
        seen.set(k, (seen.get(k) || 0) + 1)
      }

      const second = (r: { split: Split; label: string }): string => {
        if ((seen.get(r.label.toLowerCase()) || 0) < 2) return ''
        const terms = termsShort(r.split.lines)
        if (terms) return terms
        // Nothing recorded against either of them. The stored name is the one
        // fact left that differs, and a long name beats two identical rows.
        return r.split.name === r.label ? '' : r.split.name
      }

      return {
        kind,
        head: KIND_HEAD[kind],
        note: KIND_NOTE[kind],
        rows: mine.map(r => ({ split: r.split, label: r.label, terms: second(r) })),
      }
    })
    .filter(g => g.rows.length > 0)
}
