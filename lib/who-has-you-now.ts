// WHO HAS YOU NOW.
//
// 17 Nov 2026. The formal approval email is also the welcome - the spec makes
// them one email, because both congratulate, both introduce the team and both
// say what happens next.
//
// IT INTRODUCES ONE PERSON, NOT FOUR.
//
// The first version named the broker, the credit officer and the compliance
// owner, from the communication breakdown's "choose which team members appear".
// Fabio, reading it: "we dont need to introduce the credit person where did you
// get that from?"
//
// He is right. The credit officer's work is finished before this email exists,
// and naming them hands the client a person they have no reason to contact. The
// compliance owner is worse - the client has no idea what compliance is.
//
// AND IT IS WRITTEN IN THE FIRST PERSON.
//
// The second version had the sender introduced by name: "Belle Tran is running
// your settlement". Fabio: "do they intorduce the perosnal by name???" - and
// no, they do not, because the email is signed by Belle Tran. A third-person
// introduction above a first-person signature reads as though somebody else
// wrote it about her.
//
// So the sender says "I", the signature does the naming, and the only other
// person mentioned is the broker - by first name, because the client already
// knows them and will ring them anyway if nobody says otherwise.
const txt = (v: any) => String(v ?? '').trim()

/** Just the first name - how a client thinks of their broker. */
export function firstNameOf(full: any): string {
  return txt(full).split(/\s+/)[0] || ''
}

/**
 * THE HANDOVER, IN ONE SENTENCE.
 *
 * With no broker recorded it is the first half alone, which is still true and
 * still useful.
 */
export function handoverLine(brokerName: any): string {
  const broker = firstNameOf(brokerName)
  const mine = 'I’ll be looking after your settlement from here, so I’m your first point of '
    + 'contact until the money moves.'
  return broker ? `${mine} ${broker} is still across the file if you need them.` : mine
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
