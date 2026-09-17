// WHOSE STATEMENT IS THIS?
//
// 17 Sep 2026, Fabio: a statement addressed to "Mark Anthony Gallo" was refused
// because the broker record says "Mark Gallo". A middle name is not a different
// person, and the team should not have to rename a broker to load a file.
//
// WHY IT WAS STRICT IN THE FIRST PLACE, AND STILL IS. An older rule matched on
// the first word of the name, so any invoice beginning "Fabio" would have been
// filed under Fabio De Castro's book - silently, and only visible later as a
// revenue figure that was wrong. So this does NOT take a first name and hope.
// It needs the first name AND the last name, and if two brokers answer to the
// same pair it refuses rather than picking one.

import { brokerKey, sameBroker } from './broker-key'

export type BrokerRow = { broker_key: string; name: string }

export type BrokerMatch =
  | { key: string; how: 'email' | 'name' | 'first-and-last' | 'broker-key'; matched: string }
  | { key: ''; how: 'none' | 'ambiguous'; matched: ''; candidates: string[] }

const clean = (v: any) =>
  String(v ?? '')
    .replace(/[’']/g, '')        // O'Brien and O’Brien are one person
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// "Fabio De Castro - Head Agreement Holder" is a title, not a different person.
export function withoutTitle(name: any): string {
  return clean(String(name ?? '').split(/\s+[-–—]\s+/)[0])
}

// The two ends of a name, with everything in between dropped. "Mark Anthony
// Gallo" and "Mark Gallo" both come back as "mark|gallo"; "Fabio De Castro" and
// "Fabio Antonio De Castro" both come back as "fabio|castro".
export function firstAndLast(name: any): string {
  const parts = withoutTitle(name).split(' ').filter(Boolean)
  if (parts.length < 2) return ''
  return `${parts[0]}|${parts[parts.length - 1]}`
}

export function matchBroker(
  invoice: { name?: any; email?: any },
  brokers: BrokerRow[],
  keyByEmail: Map<string, string>,
): BrokerMatch {
  const rows = (brokers || []).filter(b => b && b.broker_key)

  // 1. THE EMAIL, WHICH IDENTIFIES A PERSON EXACTLY.
  const email = String(invoice.email ?? '').trim().toLowerCase()
  const byEmail = email ? keyByEmail.get(email) : ''
  if (byEmail) return { key: brokerKey(byEmail), how: 'email', matched: email }

  const whole = withoutTitle(invoice.name)
  if (!whole) return { key: '', how: 'none', matched: '', candidates: [] }

  // 2. THE WHOLE NAME, EXACTLY AS THE BROKER IS RECORDED.
  const exact = rows.filter(b => clean(b.name) === whole)
  if (exact.length === 1) return { key: brokerKey(exact[0].broker_key), how: 'name', matched: exact[0].name }

  // 3. FIRST NAME AND LAST NAME, MIDDLE NAMES IGNORED. Only when it picks out
  //    exactly one broker - two people who share both is a question for a
  //    person, not a guess by an importer.
  const pair = firstAndLast(invoice.name)
  if (pair) {
    const near = rows.filter(b => firstAndLast(b.name) === pair)
    if (near.length === 1) return { key: brokerKey(near[0].broker_key), how: 'first-and-last', matched: near[0].name }
    if (near.length > 1) {
      return { key: '', how: 'ambiguous', matched: '', candidates: near.map(b => b.name) }
    }
  }

  // 4. THE BROKER KEY ITSELF, typed where a name was expected.
  //
  // ONLY ON A SINGLE WORD, and the ship gate is why. sameBroker() compares on
  // the FIRST WORD of each side, so handing it "Mark Anthony Gallo" would match
  // the key "mark" - the first-name-alone rule this file exists to refuse,
  // coming back in through the side door. A key is one word, so anything with a
  // space in it is a name and never gets here.
  if (!whole.includes(' ')) {
    const asKey = rows.find(b => sameBroker(b.broker_key, whole))
    if (asKey) return { key: brokerKey(asKey.broker_key), how: 'broker-key', matched: asKey.broker_key }
  }

  return { key: '', how: 'none', matched: '', candidates: [] }
}
