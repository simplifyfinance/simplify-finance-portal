// THE COLOUR ON A DEAL CARD IS WHOEVER IN CREDIT OWNS IT.
//
// 18 Nov 2026. Fabio, after three days of mock-ups: "Just make every deal card
// white, and every deal card that is sitting with Melissa and every deal card
// that's sitting with Katie, there are colors. I don't understand what the
// problem is."
//
// He was right and I had invented a problem. There is no settings screen and no
// new column in the database. Three names, three colours, written down here.
//
// WHAT THIS REPLACES. Until today the card was painted by its state - red when
// it was past its chase time, purple when it was waiting on somebody. Those are
// gone from the board. A colour answers ONE question and this is now the
// question: whose desk is this on. Chasing is a small red chip and nothing
// else, which is the whole of what Fabio asked for on 22 Oct: "these needs
// chasign are just documents missing etc so havign them in the deal card in red
// and binoculars is enough".
//
// AND THE OLD RULE IS NOT CONTRADICTED. Fabio, 1 Sep 2026: "credit is grey
// broker with colour". Colour still answers one question in each place - the
// CARD is credit, the AVATAR is the broker. Two questions, two places, never
// the same ink saying both.

/** Pink, violet, bronze. Fabio named all three, and bronze is not gold. */
const BY_NAME: Record<string, string> = {
  katie: '#E23D93',
  mellissa: '#6D5DF6',
  melissa: '#6D5DF6',
  dinisha: '#B5762F',
}

// Anybody else in credit gets one of these, the same one every time. Far enough
// apart to tell across a desk, and none of them close to the three above or to
// the green a deal turns when the client says yes.
const SPARE = ['#0E6FA0', '#B25A33', '#5B4B8A', '#0F6E6E', '#7A2E2E', '#3B5BA5']

/** The first name, lowercased. What the map is keyed on. */
function firstName(name: any): string {
  return String(name || '').trim().split(/\s+/)[0].toLowerCase()
}

/**
 * THE COLOUR, OR NULL FOR A CARD NOBODY IN CREDIT HAS YET.
 *
 * Null is the answer, not a missing one: a card stays white until it is
 * allocated, so an unallocated deal is visible as unallocated from across the
 * room. Fabio: "Everything else is blank until we allocate it to credit."
 */
export function creditColour(name: any): string | null {
  const first = firstName(name)
  if (!first) return null
  if (BY_NAME[first]) return BY_NAME[first]
  // Stable, never random - a board that repainted itself on each load would be
  // unreadable, and the same person must be the same colour on every screen.
  let h = 0
  for (let i = 0; i < first.length; i++) h = (h * 31 + first.charCodeAt(i)) >>> 0
  return SPARE[h % SPARE.length]
}

/** The green a card turns when the client has agreed to proceed. */
export const AGREED = '#1C9A63'

/**
 * HOW A CARD WEARS A COLOUR: a wash, a border, and nothing else.
 *
 * One and a half steps off the card's own background - far enough to see across
 * the office, close enough that the client's name still reads on top of it. It
 * is mixed against the theme's own card colour rather than against white, so
 * the same line works in the dark theme without a second set of numbers.
 *
 * 18 Nov 2026, and twice before that: NOT A STRIPE DOWN ONE SIDE, and not a
 * coloured corner. Fabio: "you just color the corner of it. You didn't color
 * the whole card." The whole card, lightly.
 */
/**
 * THE SHADOW IS PART OF THE COLOUR, AND IT IS HANDED OVER AS TWO VARIABLES.
 *
 * 18 Nov 2026. The mock sits every card on a soft shadow tinted with the
 * owner's colour, and lifts it into a deeper one on hover. That is most of what
 * makes the board read as cards rather than coloured rectangles.
 *
 * Fabio: "the shading is still not showing. It doesn't lift up when I'm
 * hovering the arrow on top of the deal card."
 *
 * THE FIRST ATTEMPT HANDED THE RESTING SHADOW BACK AS AN INLINE boxShadow, AND
 * THAT IS WHY NOTHING HAPPENED. An inline style beats a class, hover or not, so
 * the hover shadow could never win. Measured in a real browser against the real
 * compiled stylesheet: the card lifted 2px and the shadow never moved.
 *
 * So both shadows come back as custom properties and the card wears them
 * through classes - shadow-[var(--sh)] and hover:shadow-[var(--shh)] - which
 * are both classes, so :hover wins the way it is supposed to.
 */
export function cardSkin(colour: string | null): Record<string, string> {
  const plain = '0 1px 2px rgba(20,20,15,.05), 0 10px 20px -14px rgba(20,20,15,.32)'
  if (!colour) return {
    background: 'var(--color-card)',
    borderColor: 'var(--color-card-line)',
    '--sh': plain,
    '--shh': '0 3px 7px rgba(20,20,15,.09), 0 22px 34px -16px rgba(20,20,15,.46)',
  }
  const tint = (p: number, base: string) =>
    `color-mix(in srgb, ${colour} ${p}%, ${base})`
  return {
    background: tint(15, 'var(--color-card)'),
    borderColor: tint(40, 'var(--color-card-line)'),
    '--sh': `0 1px 2px rgba(20,20,15,.05), 0 12px 22px -14px ${tint(46, 'rgba(20,20,15,.42)')}`,
    '--shh': `0 3px 7px rgba(20,20,15,.08), 0 24px 36px -16px ${tint(56, 'rgba(20,20,15,.5)')}`,
  }
}
