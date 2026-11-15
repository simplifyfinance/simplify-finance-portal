// WHO HAS YOU NOW.
//
// 17 Nov 2026. The formal approval email is also the welcome - the spec makes
// them one email - so it has to say who the client deals with from here.
//
// IT IS A CHOICE, NOT A LOOKUP, AND IT TOOK FOUR GOES TO GET THERE.
//
// 1. Named the broker, the credit officer and the compliance owner off the
//    deal. Fabio: "we dont need to introduce the credit person where did you
//    get that from?" The credit officer's work is finished before this email
//    exists, and the client has no idea what compliance is.
//
// 2. Introduced whoever was sending it, by name. Fabio: "do they intorduce the
//    perosnal by name???" No - the email is SIGNED by them. A third-person
//    introduction above a first-person signature reads as though somebody else
//    wrote it about them.
//
// 3. Worked the settlements people out from the sees_settlements flag and used
//    those. Fabio: "cant broker choose to introduce people could be belle could
//    julian". A broker sending a formal approval knows who is picking the file
//    up; the record does not.
//
// 4. This one. The sender picks, from the whole team. The settlements people
//    arrive pre-selected because they are the usual answer - "Julian and Belle
//    is generally what we like to introduce" - and are unticked on the day
//    somebody is away. The default lives in Settings, Team, which is already
//    maintained, rather than two names written into an email builder.
//
// WHY THIS MATTERS MORE THAN IT LOOKS. The sentence said "I'll be looking after
// your settlement from here". True when settlements send it. False when Kylie
// or the broker does - and a client who believes it replies to the wrong person
// for three weeks, which nobody here would see.
const txt = (v: any) => String(v ?? '').trim()

export type Person = {
  /** user_profiles.id, so a pick can be written onto the deal. */
  id: string
  name: string
  email?: string
  /** sees_settlements - ticked in Settings, Team. Decides the default. */
  settlements?: boolean
}

/** Just the first name - how a client thinks of their broker. */
export function firstNameOf(full: any): string {
  return txt(full).split(/\s+/)[0] || ''
}

/**
 * WHO ARRIVES PRE-SELECTED.
 *
 * Everyone with the settlements box ticked. Nobody is hardcoded: if the team
 * changes, Settings changes, and this follows without a ship.
 */
export function suggestedContacts(team: Person[]): Person[] {
  return (team || []).filter(p => p.settlements && txt(p.name))
}

/**
 * THE TEAM, SETTLEMENTS FIRST.
 *
 * The usual answer at the top, everyone else under it - a broker introducing
 * somebody unusual still has to be able to find them.
 */
export function pickOrder(team: Person[]): Person[] {
  const named = (team || []).filter(p => txt(p.name))
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name)
  return [...named.filter(p => p.settlements).sort(byName),
          ...named.filter(p => !p.settlements).sort(byName)]
}

/** "Belle Tran and Julian Kok" / "Belle Tran, Julian Kok and Marco Ferreira" */
export function namesInWords(names: string[]): string {
  const list = (names || []).map(txt).filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/**
 * IS THE ONLY PERSON BEING INTRODUCED THE ONE SIGNING IT?
 *
 * Matched on email, because two people can share a first name and nobody's
 * display name is reliably spelled the same in two tables.
 *
 * ONE PERSON, NOT "AMONG THEM". Belle sending an email that introduces Belle
 * and Julian cannot say "I'll be looking after your settlement" - half of that
 * is Julian's work. It says both names instead.
 */
export function isSendingThemselves(contacts: Person[], senderEmail: any): boolean {
  const list = (contacts || []).filter(p => txt(p.name))
  const me = txt(senderEmail).toLowerCase()
  if (list.length !== 1 || !me) return false
  return txt(list[0].email).toLowerCase() === me
}

export type Handover = {
  /** The people being introduced, in the order they were picked. */
  contacts: Person[]
  /** The address the email is going out from. */
  senderEmail?: any
  /** The broker on the deal, for the closing clause. */
  brokerName?: any
}

/**
 * THE HANDOVER, IN ONE SENTENCE.
 *
 * Never empty: with nobody picked it still says something true about the team,
 * which is what a broker who does not know yet should be sending.
 */
export function handoverLine(h: Handover): string {
  const people = (h.contacts || []).filter(p => txt(p.name))
  const who = namesInWords(people.map(p => p.name))
  const broker = firstNameOf(h.brokerName)
  const tail = broker ? ` ${broker} is still across the file if you need them.` : ''

  if (!who) {
    return 'Our settlements team will look after it from here and will be in touch shortly with your '
      + 'loan documents.' + tail
  }
  if (isSendingThemselves(people, h.senderEmail)) {
    return 'I’ll be looking after your settlement from here, so I’m your first point of '
      + 'contact until the money moves.' + tail
  }
  return `${who} will be looking after your settlement from here, and will be in touch shortly. `
    + `${people.length > 1 ? 'They are' : 'They are'} your first point of contact until the money `
    + `moves.` + tail
}

/**
 * THE ONE WARNING THIS EMAIL CARRIES.
 *
 * From the spec: "a reminder not to take new credit before settlement". Last in
 * the email on purpose - a client who reads nothing else reads the last thing -
 * and it names the three things that actually catch people out rather than
 * saying "any new credit", which sounds like it means a mortgage.
 *
 * NOT A SCARE. A bank re-checks the file before settlement and a new liability
 * can change what was approved. Said plainly, with a way out: ring us first.
 */
export const NO_NEW_CREDIT =
  'Please don’t take on any new credit before settlement — a new card, a car loan, '
  + 'even a buy now pay later account. Your lender re-checks everything before the money moves, '
  + 'and a new debt can change what has been approved. If something is unavoidable, call us first '
  + 'and we will work out where it leaves us.'
