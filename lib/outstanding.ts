// WHAT THE LENDER ASKED FOR AFTER WE LODGED.
//
// Fabio, 29 Sep 2026: "call the stage outstanding because it will sit on
// outstanding under a conditional approval... it goes lodged, outstanding, and
// then pre-approval."
//
// THIS IS NOT THE DOCUMENTS BOX. That asks the CLIENT for what we need in order
// to lodge, before anything has gone to a bank. This is the list a lender hands
// back afterwards - a different list, a different audience, and a clock that
// matters a great deal more, because every day of it is a day the client thinks
// they are approved and we know they are not.
//
// WHY A LIST AND NOT A NOTE. A note in the log says "waiting on conditions" and
// tells nobody which ones, who is chasing, or what has already arrived. Three
// items where two are in and one is eleven days old is a completely different
// morning from three items asked for yesterday, and the board cannot tell them
// apart unless somebody counts them.
//
// ONE WRITER. `outstanding_items` is a JSON column and every function here
// returns a WHOLE new list for the caller to save in one go. The portal has been
// bitten twice by two writers sharing a blob - see lib/deal-structure.ts on
// splitDetail - and a half-saved condition list is a client not rung.

const txt = (v: any) => String(v ?? '').trim()

// Who the item is sitting with. Not decoration: it decides whether the answer to
// "why has this not moved" is a phone call to a client, a chase to a bank, or
// somebody in the office.
export type WaitingOn = 'client' | 'lender' | 'us'

export type OutstandingItem = {
  id: string
  what: string
  waitingOn: WaitingOn
  askedAt: string
  // Set the moment somebody ticks it. Nothing is ever removed from the list -
  // an item that came in is history worth keeping, not a row to delete.
  receivedAt?: string
  receivedBy?: string
}

export const WAITING_LABEL: Record<WaitingOn, string> = {
  client: 'the client',
  lender: 'the lender',
  us:     'us',
}

export function outstandingItems(deal: any): OutstandingItem[] {
  const raw = deal?.outstanding_items
  if (!Array.isArray(raw)) return []
  return raw
    .filter(x => x && txt(x.what))
    .map((x: any, i: number) => ({
      id: txt(x.id) || `o${i}`,
      what: txt(x.what),
      waitingOn: (['client', 'lender', 'us'].includes(txt(x.waitingOn))
        ? txt(x.waitingOn) : 'client') as WaitingOn,
      askedAt: txt(x.askedAt),
      receivedAt: txt(x.receivedAt) || undefined,
      receivedBy: txt(x.receivedBy) || undefined,
    }))
}

export function stillWaiting(deal: any): OutstandingItem[] {
  return outstandingItems(deal).filter(i => !i.receivedAt)
}

export function received(deal: any): OutstandingItem[] {
  return outstandingItems(deal).filter(i => !!i.receivedAt)
}

// EVERYTHING IS IN. Only true when there was something to wait for in the first
// place - an empty list is not a finished one, and a deal with no items
// recorded must never announce that its conditions are satisfied.
export function allReceived(deal: any): boolean {
  const all = outstandingItems(deal)
  return all.length > 0 && all.every(i => !!i.receivedAt)
}

// How long the oldest thing nobody has sent has been sitting. Null when there is
// nothing outstanding, or when nothing carries a date.
export function oldestWaitDays(deal: any, now = new Date()): number | null {
  const days = stillWaiting(deal)
    .map(i => daysSince(i.askedAt, now))
    .filter((d): d is number => d !== null)
  return days.length ? Math.max(...days) : null
}

function daysSince(iso: string, now: Date): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const d = Math.floor((now.getTime() - t) / 86400000)
  return d >= 0 ? d : 0
}

// "Waiting on the client for 2 of 3 items." Said the way somebody would say it,
// and it names WHO, because that is the only part that tells you what to do
// next. Two different people waited on is stated as both rather than picked
// between - guessing which one matters more is how the wrong person gets rung.
export function waitingLine(deal: any): string {
  const all = outstandingItems(deal)
  const open = stillWaiting(deal)
  if (all.length === 0) return ''
  // "All 1 item are in" - the verb has to agree too, not just the noun.
  if (open.length === 0) {
    return all.length === 1 ? 'All 1 item is in.' : `All ${all.length} items are in.`
  }

  const who = [...new Set(open.map(i => i.waitingOn))]
  const names = who.length === 1 ? WAITING_LABEL[who[0]]
    : who.length === 2 ? `${WAITING_LABEL[who[0]]} and ${WAITING_LABEL[who[1]]}`
    : `${who.slice(0, -1).map(w => WAITING_LABEL[w]).join(', ')} and ${WAITING_LABEL[who[who.length - 1]]}`

  const count = all.length === open.length
    ? `${open.length} item${open.length === 1 ? '' : 's'}`
    : `${open.length} of ${all.length} items`
  return `Waiting on ${names} for ${count}.`
}

// AMBER AT FIVE DAYS, RED AT TEN - the same numbers the board uses for this
// column, kept here so the deal card and the board cannot disagree. Read from
// lib/deal-age.ts rather than typed twice.
export function waitTone(days: number | null): 'ok' | 'warn' | 'late' {
  if (days === null) return 'ok'
  if (days >= 10) return 'late'
  if (days >= 5) return 'warn'
  return 'ok'
}

// --- writing --------------------------------------------------------------
// Each returns the WHOLE list. The caller saves it in one write.

export function withNewItem(deal: any, what: string, waitingOn: WaitingOn,
                            now = new Date()): OutstandingItem[] {
  const list = outstandingItems(deal)
  const clean = txt(what)
  if (!clean) return list
  return [...list, {
    id: `o${now.getTime().toString(36)}${list.length}`,
    what: clean, waitingOn, askedAt: now.toISOString(),
  }]
}

export function withReceived(deal: any, id: string, by: string,
                             now = new Date()): OutstandingItem[] {
  return outstandingItems(deal).map(i => i.id === id
    ? { ...i, receivedAt: now.toISOString(), receivedBy: txt(by) }
    : i)
}

// UNTICKING. Somebody ticks the wrong row, and without this the only way back is
// to delete the item and retype it - which loses when it was asked for, and with
// it the age that was the whole point.
export function withUnreceived(deal: any, id: string): OutstandingItem[] {
  return outstandingItems(deal).map(i => i.id === id
    ? { id: i.id, what: i.what, waitingOn: i.waitingOn, askedAt: i.askedAt }
    : i)
}

export function withoutItem(deal: any, id: string): OutstandingItem[] {
  return outstandingItems(deal).filter(i => i.id !== id)
}
