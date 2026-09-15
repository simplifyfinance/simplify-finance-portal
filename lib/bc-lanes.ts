// THE BC COLUMN, IN TWO LANES.
//
// Fabio, 15 Sep 2026: he wanted to see, from the board, when a BC has actually
// gone to the client for review. The question he asks when he looks at that
// column is "how many are still on us, and how many are sitting with clients" -
// and until now the column answered neither. Every card looked the same whether
// it had been sent that morning or had not been written yet.
//
// Nothing new is recorded for this. deals.bc_sent_at has been written since the
// Send to client button existed; it simply never reached the board.
//
// WHAT COUNTS AS SENT. The date is written when somebody presses "Send to
// client" in the portal, which also puts the email on the clipboard and opens
// Outlook addressed to the applicants. Pressing "Copy for Outlook" on its own
// does NOT count - copying is not sending, and a card that moved lane because
// somebody looked at an email would be worse than one that did not move at all.

export type Lane = { key: 'preparing' | 'sent'; label: string; items: any[] }

export function bcLanes(cards: any[]): Lane[] {
  const preparing = cards.filter(d => !d?.bc_sent_at)
  const sent = cards.filter(d => !!d?.bc_sent_at)
  // A lane with nothing in it is a heading over empty space. Only the lanes that
  // have cards are named - and on a column where everything is in one state,
  // that single heading still says which state it is.
  return ([
    { key: 'preparing', label: 'Being prepared', items: preparing },
    { key: 'sent', label: 'With the client', items: sent },
  ] as Lane[]).filter(l => l.items.length > 0)
}

// The cards in lane order, so the existing list can stay one list and simply
// draw a heading where the lane changes.
export function inLaneOrder(cards: any[]): any[] {
  return bcLanes(cards).flatMap(l => l.items)
}

export function laneOf(deal: any): 'preparing' | 'sent' {
  return deal?.bc_sent_at ? 'sent' : 'preparing'
}

// "sent 11 Sep". Empty for a card that has not been sent, so nothing has to
// decide whether to show it.
export function sentOn(deal: any): string {
  const at = deal?.bc_sent_at
  if (!at) return ''
  const d = new Date(at)
  if (isNaN(d.getTime())) return ''
  return `sent ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
}
