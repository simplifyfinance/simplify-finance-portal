// SOMEBODY OFFERING TO TELL HIM SOMETHING IS NOT A QUESTION.
//
// 13 Oct 2026. Fabio typed "Can I give you the answer and you file on
// library?" and Paco matched the word savings and handed back an unrelated NAB
// rule about family loans. He was being offered knowledge and he answered as
// though he had been asked for it.
//
// NO MODEL IS CALLED TO WORK THIS OUT, and that is deliberate - see the note at
// the top of lib/paco.ts. Nothing here reads a credit policy or writes a
// sentence about lending. It reads the shape of what a PERSON said about
// themselves: am I being asked something, or am I being offered something.
// Getting that wrong costs a clumsy reply, never a wrong rule.
//
// AND HE SAYS WHERE IT WILL LAND. "File it on the library" is the natural
// thing to assume and it is not what happens: the library holds documents the
// lender wrote, and what you tell him is a team note with your name on it.
// Those two are never allowed to read as the same kind of thing, so he says so
// the moment he is offered one.

const flat = (v: any): string =>
  (typeof v === 'string' ? v : v == null ? '' : String(v))
    .toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

// FIRST PERSON, EVERY ONE OF THEM. "Can I tell you" is an offer; "can you tell
// me" is a question, and the only thing separating them is who is doing the
// telling.
const OFFERS = [
  'can i tell you', 'can i give you', 'can i add', 'can i put',
  'let me tell you', 'let me give you', 'let me add',
  'i can tell you', 'i can give you', 'i can add',
  "i'll tell you", 'i will tell you', "i'll give you", 'i will give you',
  'i want to tell you', 'i want to add', 'i need to add',
  'i know the answer', 'i have the answer', 'i got the answer',
  'i know this one', 'i know what',
  'shall i tell you', 'should i tell you', 'do you want me to tell',
  'want me to tell you', 'want me to add',
  'file this', 'note this', 'record this', 'remember this', 'save this',
  'add this to', 'put this in',
]

// THE ONES THAT LOOK LIKE AN OFFER AND ARE A QUESTION. Checked first, because
// "what can you tell me about NAB" contains none of the above but near misses
// are cheap to guard and expensive to get wrong.
const ACTUALLY_ASKING = [
  'can you tell me', 'can you give me', 'what can you tell',
  'tell me about', 'tell me what', 'tell me how', 'tell me if',
  'do you know', 'what do you know',
]

export type Offer = {
  /** Somebody is offering to tell him something, not asking him something. */
  offered: boolean
  /** The lender they named, if they named one. */
  lender: string
}

/**
 * Is this person offering knowledge rather than asking for it.
 *
 * `lenders` is the list of names he could recognise; the one named in the
 * sentence comes back so the note form can be filled in rather than asked for.
 */
export function offeringToTell(question: any, lenders: any[] = []): Offer {
  const said = flat(question)
  if (!said) return { offered: false, lender: '' }
  for (const ask of ACTUALLY_ASKING) if (said.includes(ask)) return { offered: false, lender: '' }
  const offered = OFFERS.some(o => said.includes(o))
  if (!offered) return { offered: false, lender: '' }

  let lender = ''
  for (const l of Array.isArray(lenders) ? lenders : []) {
    const name = flat(l)
    // Short names have to match whole, or "amp" finds itself inside a word.
    if (!name) continue
    const whole = new RegExp(`(^| )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`)
    if (whole.test(said)) { lender = String(l); break }
  }
  return { offered: true, lender }
}

/** What he says back. Two lines: yes, and where it will actually land. */
export const YES_TELL_ME =
  'Sí — tell me. It goes in with your name and today’s date, and I repeat it word for word.'

export const NOT_THE_LIBRARY =
  'It lands as a team note, not in the library. The library holds what the lender wrote down; ' +
  'this is what we have seen. I show both, and I never let ours read as theirs.'
