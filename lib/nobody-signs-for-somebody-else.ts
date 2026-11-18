// NOBODY SIGNS FOR SOMEBODY ELSE.
//
// 19 Nov 2026. Catherine, on a formal approval that reached her client: "Is
// coming from Melissa - her name and email sig - was that intentional, or
// should it be broker?" And Fabio, reading it: "I never want a staff member to
// impersonate a broker."
//
// Both halves of that were true at once. Every milestone email went out signed
// by whoever happened to press the button - so a credit assessor announcing a
// bank's decision signed it as herself, to a client who has never heard of
// her. And the final check-in went further: it had a dropdown that let anyone
// pick a broker and send AS him, name, signature and all.
//
// THE RULE, IN FABIO'S WORDS: "if it's the broker on the file, send an email
// as the broker. If it's anyone else, the signature should say the team as
// Simplify Finance and CC the broker."
//
// So there are exactly two signatures and no third:
//
//   THE BROKER     only when the broker on the file is the one sending it.
//                  His name, his address, his mobile. Nothing has changed for
//                  him - he is signing his own email.
//   THE TEAM       everybody else. "Simplify Finance", from the portal's own
//                  address, signed by the team. True, and it claims nothing.
//
// AND THE BROKER IS COPIED EITHER WAY, so the file's owner always has what his
// client was told. Fabio: "the broker is not being CC'd, and I don't like
// that." See brokerCopy() below - it is not a per-template flag, for the same
// reason copying the sender is not: a flag gets forgotten on the next template
// somebody adds.
//
// REPLIES GO TO THE BROKER. A client answering "what does condition 4 mean"
// should reach the person who owns the relationship, not whoever was clearing
// the approval queue that morning.

const txt = (v: any) => String(v ?? '').trim()

/** The portal's own address, used when the team signs rather than a person. */
export const TEAM_NAME = 'Simplify Finance'
export const TEAM_EMAIL = 'notifications@simplifyfinance.com.au'

/**
 * WHAT THE TEAM IS CALLED ON THIS PARTICULAR DEAL.
 *
 * Not always Simplify Finance. A deal carries its own brand and a second brand
 * has its own name, website and licence line - see lib/brand.ts. Signing every
 * email "the team at Simplify Finance" would put the wrong company at the foot
 * of a client's email, which is the same fault as signing it with the wrong
 * person's name.
 */
export function teamName(brandName?: string): string {
  const b = txt(brandName)
  return b ? `The team at ${b}` : `The team at ${TEAM_NAME}`
}

export type Who = { id?: string; name: string; email: string; phone: string }

export type BrokerOnFile = {
  /** Their name as the register holds it. */
  name: string
  /** From user_profiles via brokers.user_id. Empty where nobody linked them. */
  email: string
  phone: string
  /** The login this broker is, where there is one. */
  userId: string
}

/**
 * IS THE PERSON PRESSING SEND THE BROKER ON THIS FILE?
 *
 * Matched on the LOGIN, never on a name. Two people called Justin, a broker
 * key typed in a different case, a married name on one record and not the
 * other - every one of those is a way for a name match to say yes when it
 * should say no, and saying yes here means somebody signs as somebody else.
 */
export function isTheBroker(sender: Who | null, broker: BrokerOnFile | null): boolean {
  const id = txt(sender?.id)
  const his = txt(broker?.userId)
  return !!id && !!his && id === his
}

/**
 * WHO SIGNS THIS EMAIL. One of exactly two answers.
 *
 * A broker whose login is not linked to his broker record cannot be matched,
 * so the team signs and he is copied. That is the safe way round: the worst
 * case is an email that is a little less personal, rather than one that claims
 * to be from a man who did not write it.
 */
export function signerFor(sender: Who | null, broker: BrokerOnFile | null,
                          brandName?: string): Who {
  if (isTheBroker(sender, broker)) {
    return {
      id: txt(sender?.id),
      // His name off the register, which is how clients know him, rather than
      // whatever is typed in his portal profile.
      name: txt(broker?.name) || txt(sender?.name),
      email: txt(sender?.email),
      phone: txt(sender?.phone) || txt(broker?.phone),
    }
  }
  return { name: teamName(brandName), email: TEAM_EMAIL, phone: '' }
}

/** True where the team is signing - the screen says so before you press send. */
export function theTeamIsSigning(sender: Who | null, broker: BrokerOnFile | null): boolean {
  return !isTheBroker(sender, broker)
}

/**
 * THE BROKER'S COPY. Always, unless he is the one sending it.
 *
 * Empty where his login was never linked, which is a thing to fix in Settings
 * rather than something to invent an address for.
 */
export function brokerCopy(sender: Who | null, broker: BrokerOnFile | null): string[] {
  if (isTheBroker(sender, broker)) return []
  const to = txt(broker?.email)
  return to ? [to] : []
}

/**
 * WHERE A REPLY LANDS. The broker first, then whoever sent it.
 *
 * The client's relationship is with the broker and their answer belongs with
 * him. The sender is kept on the list because somebody has to see a bounce.
 */
export function replyTo(sender: Who | null, broker: BrokerOnFile | null): string[] {
  const out: string[] = []
  const his = txt(broker?.email)
  if (his) out.push(his)
  const mine = txt(sender?.email)
  if (mine && !out.includes(mine)) out.push(mine)
  return out
}

/**
 * WHAT THE SEND SCREEN SAYS ABOUT IT, so nobody is surprised by the signature.
 *
 * Said before the send, in the same place the other problems are listed -
 * because "this will go out as the team, not as you" is exactly the kind of
 * thing somebody should know while they can still stop.
 */
export function signatureNote(sender: Who | null, broker: BrokerOnFile | null,
                              brandName?: string): string {
  if (isTheBroker(sender, broker)) return ''
  const team = teamName(brandName)
  const name = txt(broker?.name)
  if (!name) {
    return `This goes out signed "${team}", not as you. No broker is recorded on this `
      + 'deal, so nobody is copied — set one on the fact find.'
  }
  const his = txt(broker?.email)
  return his
    ? `This goes out signed "${team}", not as you, with ${name} copied in. Replies go to him.`
    : `This goes out signed "${team}", not as you. ${name} has no email address on his `
      + 'record, so he cannot be copied — link his login in Settings, Team.'
}
