// EVERY COLOUR IN THE PORTAL, ONCE.
//
// 2 Oct 2026. Counted before writing this: the deal board alone had 37
// different colours typed into it by hand, and #2DBEFF appeared 361 times
// across 71 files. Nobody could change the nudge colour without finding five
// separate places that spelled it out and hoping that was all of them.
//
// That is the same fault as every bug we fixed in September - one fact with
// more than one home, free to drift apart. So this is the home.
//
// NOTHING LOOKS DIFFERENT TODAY. This file exists; the portal does not read it
// yet. The migration is the next ship, one screen at a time, and this file is
// what it migrates to.
//
// THE TAILWIND NAMES LIVE IN app/globals.css, under @theme, with these exact
// values. Two files is one too many - so lib/colours.test.ts reads both and
// fails the ship if they ever disagree. Change a colour here, change it there,
// or the build stops.

// ---------------------------------------------------------------- the brand

// Measured off the Simplify Finance artwork, not chosen. Same value as the dot
// on the ONE mark, so the logo and the interface cannot drift apart.
//
// IT IS A FILL, NEVER SMALL TEXT. On white it reads at 2.2 to 1, where 4.5 is
// the mark - unreadable. Buttons, bars, the active state, the mark: yes.
// Sentences: no, use brandInk.
export const BRAND = '#4FBBEA'

// The same blue, darkened until blue words on a light background can be read.
// 4.6 to 1 on white.
export const BRAND_INK = '#107EA8'

// The same blue, lightened for a dark panel. Not wired up until dark mode ships.
export const BRAND_LIFT = '#6FD3FF'

// What sits ON a brand-filled button. Near-black, 8.7 to 1 against the blue.
export const ON_BRAND = '#0F1115'

// The sidebar. Fixed by the brand spec and identical in both themes - it is the
// one thing on screen that never moves.
export const SIDEBAR = '#0F1115'

// --------------------------------------------------------------- the status
//
// FOUR COLOURS, EACH MEANING EXACTLY ONE THING.
//
//   chase    needs you today
//   waiting  the ball is with somebody else
//   done     finished
//   info     being worked on / selected
//
// Amber is deliberately absent. It was doing two jobs - "not filled in yet" and
// "ignored too long" - and the brown-amber and the rust-red it sat beside came
// out as the same olive to a red-green colourblind reader. Measured at 1.2 out
// of 100 apart, which is another way of writing "identical". Purple against the
// same red measures 24.

export const CHASE       = '#A3302A'
export const CHASE_BG    = '#FDF3F2'
export const CHASE_EDGE  = '#EBD1CE'

export const WAITING      = '#5B3A9E'
export const WAITING_BG   = '#F4F1FC'
export const WAITING_EDGE = '#DACFF1'

export const DONE      = '#117A45'
export const DONE_BG   = '#EFFAF4'
export const DONE_EDGE = '#BFE6D2'

export const INFO      = '#107EA8'
export const INFO_BG   = '#EAF7FE'
export const INFO_EDGE = '#BFE4F7'

// ------------------------------------------------------------ a washed card
//
// A card wearing a status wears it ALL THE WAY ROUND, lightly - never a stripe
// down one side, which reads as damage rather than a state. One and a half
// steps off white: far enough to see across the office, close enough that the
// client's name reads at 17 to 1 on the tint, exactly as it does on plain white.
//
// The chip inside a washed card goes white, or it vanishes into the card.

export const CARD_CHASE        = '#FDF4F3'
export const CARD_CHASE_EDGE   = '#EEC9C5'
export const CARD_WAITING      = '#F7F4FD'
export const CARD_WAITING_EDGE = '#D7CCF0'
export const CARD_DONE         = '#F2FBF6'
export const CARD_DONE_EDGE    = '#C6E7D5'

// ------------------------------------------------------------- the surfaces
//
// Off-white, and warm. The warmth is in the greys as well as the page - a cream
// panel under cool grey lettering looks dirty rather than warm.

export const PAGE      = '#F7F4EF'
export const PANEL     = '#FFFFFF'
export const CARD      = '#FFFFFF'
export const LINE      = '#E8E2D8'
export const LINE_SOFT = '#F1ECE4'
export const CARD_LINE = '#EBE5DB'

// ------------------------------------------------------------------ the ink

export const INK   = '#17140F'  // headings, names, money
export const BODY  = '#4D4841'  // anything you actually read
export const MUTED = '#6F6A62'  // labels and captions, 4.6 to 1 on the page
export const FAINT = '#A79F93'  // decoration only, never a word that matters

// --------------------------------------------------------------- dark mode
//
// NOT AN INVERSION, AND NOT WIRED UP YET. Dark mode is its own ship; these are
// here so that ship is a second list of values rather than a month of hunting.
//
// Two things were measured rather than guessed. The sidebar stays #0F1115, so
// the dark page had to be lifted away from it - at #15181B the two were 1.06 to
// 1 apart and the sidebar had no visible edge at all. And the obvious pastel
// green and red come out nearly identical to a colourblind reader on a dark
// panel, so the green is nudged towards mint until they separate.

export const DARK = {
  page:      '#1C2025',
  panel:     '#24282E',
  card:      '#2A2F36',
  line:      '#383E46',
  lineSoft:  '#30353C',
  cardLine:  '#3A4049',

  ink:   '#E9EDF1',
  body:  '#C2CAD2',
  muted: '#9AA4AE',
  faint: '#737E89',

  brand:   '#6FD3FF',
  chase:   '#FF8E7F',
  waiting: '#B49BF0',
  done:    '#6EE7B7',

  chaseBg:     '#3F2320', chaseEdge:   '#65362E',
  waitingBg:   '#282140', waitingEdge: '#45366E',
  doneBg:      '#123328', doneEdge:    '#215C4B',
  infoBg:      '#123143', infoEdge:    '#20556E',

  cardChase:       '#33241F', cardChaseEdge:   '#60352C',
  cardWaiting:     '#28213B', cardWaitingEdge: '#44356E',
  cardDone:        '#1A2B25', cardDoneEdge:    '#245B49',
} as const

// --------------------------------------------------------------- retired
//
// #2DBEFF was the portal's blue in 361 places and is not the brand's blue. It
// is listed here so the migration has something to search for, and so nobody
// reintroduces it from memory.
export const RETIRED = ['#2DBEFF'] as const
