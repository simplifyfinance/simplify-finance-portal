// WHO ELSE IS ON A PURCHASE, AND WHETHER WE CAN ACTUALLY REACH THEM.
//
// Fabio, 29 Sep 2026: "we should have a spot do solictors details so they also
// recieve apporval??? when it is a purchase". And: "add buers agent as well".
//
// A draft of the formal approval email said "we have let your solicitor and
// your buyers agent know". Nothing in the portal could have done that - there
// was nowhere to record a solicitor at all. So the rule this file exists to
// enforce is a small one and it is the whole point:
//
//   THE EMAIL NEVER SAYS ANYBODY WAS TOLD UNLESS THEY ARE ON THE COPY LINE OF
//   THE EMAIL DOING THE TELLING.
//
// Which means the sentence is decided by `email`, not by `name`. A solicitor we
// have a name for and no address for is somebody we have NOT told, however much
// it looks like we know them - and that is a gap worth showing on the send
// screen rather than a sentence worth printing.

const txt = (v: any) => String(v ?? '').trim()

// Deliberately loose. This is not a validator standing between somebody and
// their work - it is here to catch "rebecca at tohlegal" and a phone number
// typed into the wrong box, not to argue about what an address may contain.
export function looksLikeEmail(v: any): boolean {
  const s = txt(v)
  return s.length > 4 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export type Party = {
  who: 'solicitor' | 'buyers agent'
  name: string
  email: string
  phone: string
  // Recorded AND reachable. The only thing that puts them on an email.
  reachable: boolean
  // Recorded but not reachable - a name with no usable address. Shown before
  // the send, never discovered after it.
  gap: string
}

function party(who: Party['who'], name: any, email: any, phone: any): Party | null {
  const n = txt(name), e = txt(email)
  if (!n && !e) return null              // nobody on this deal. Not a gap.
  const ok = looksLikeEmail(e)
  return {
    who, name: n, email: e, phone: txt(phone),
    reachable: ok,
    gap: ok ? '' : e
      ? `${cap(who)} ${n || ''} has "${e}" recorded, which is not an email address — they will not be copied in`.replace('  ', ' ')
      : `${cap(who)}${n ? ` ${n}` : ''} has no email address recorded — they will not be copied in`,
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function solicitorOf(deal: any): Party | null {
  return party('solicitor', deal?.solicitor_name, deal?.solicitor_email, deal?.solicitor_phone)
}

export function buyersAgentOf(deal: any): Party | null {
  return party('buyers agent', deal?.buyers_agent_name, deal?.buyers_agent_email, deal?.buyers_agent_phone)
}

// Everybody recorded on the other side of this purchase, in the order they
// would be named.
export function otherSide(deal: any): Party[] {
  return [solicitorOf(deal), buyersAgentOf(deal)].filter((p): p is Party => p !== null)
}

// THE ONES THAT GO ON THE COPY LINE. Nothing else may.
export function copyTheseIn(deal: any): Party[] {
  return otherSide(deal).filter(p => p.reachable)
}

// What to say on the send screen before anybody presses anything.
export function otherSideGaps(deal: any): string[] {
  return otherSide(deal).filter(p => !p.reachable).map(p => p.gap)
}

// THE SENTENCE, OR NOTHING AT ALL.
//
// "We have let your solicitor and your buyers agent know that the loan is
// formally approved." Built only from the people actually being copied, so it
// cannot outrun the truth. Nobody reachable and there is no sentence.
export function toldTheOtherSide(deal: any): string {
  const them = copyTheseIn(deal)
  if (them.length === 0) return ''
  const names = them.length === 1
    ? `your ${them[0].who}`
    : `your ${them.map(p => p.who).join(' and your ')}`
  return `We have copied ${names} in on this email, so they have the approval too.`
}
