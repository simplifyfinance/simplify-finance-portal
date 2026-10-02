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
// THE MIGRATION HAS STARTED. 2 Oct 2026: the left-hand column and the login
// screen are the first two screens to read from here. Everything else still has
// its colours typed into it by hand and is still to come, one ship at a time -
// the off-white surfaces, then the blue, then the washed cards.
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

// A BOX YOU TYPE INTO IS NOT A BOX YOU READ.
//
// On light it is the same white as the card, so FIELD looks like a duplicate of
// CARD and nearly was not given a name. It earns one in dark, where the field
// has to be DARKER than the card it sits in or it reads as a button. One name,
// two values; the alternative is a screen full of exceptions.
//
// The edge is harder than LINE for the same reason - at LINE the fields on the
// login card stopped looking like fields and the form read as a paragraph.
export const FIELD      = '#FFFFFF'
export const FIELD_LINE = '#DCD5C9'

// ------------------------------------------------------------------ the ink

export const INK   = '#17140F'  // headings, names, money
export const BODY  = '#4D4841'  // anything you actually read
export const MUTED = '#6F6A62'  // labels and captions, 4.6 to 1 on the page
export const FAINT = '#A79F93'  // decoration only, never a word that matters

// --------------------------------------------------------- the grey it wears
//
// 2 Oct 2026. THE PORTAL HAD TWO GREYS AND DID NOT KNOW IT.
//
// Counted before writing this: 465 places asked Tailwind for a grey - 254 of
// them text-gray-400, 211 text-gray-500 - across 38 files. Tailwind's greys are
// COOL. Our page, our lines and our ink are WARM. A cool grey caption on a warm
// off-white page does not read as neutral, it reads as dirty, and that is the
// single biggest reason the portal never quite looked like the brand.
//
// The obvious fix was to edit 465 places. That is 38 files by hand, and a
// hundred chances to mistype a colour. So instead the NAMES are redefined:
// Tailwind reads --color-gray-400 out of app/globals.css, and in this portal
// that is warm. All 465 become right at once, and the next person who reaches
// for text-gray-500 out of habit gets the right colour rather than a dirty one.
//
// SPELT THE AMERICAN WAY ON PURPOSE. Everything else here is "colour". These
// are "gray" because they have to match the class names Tailwind generates, and
// a ramp named grey-400 would quietly produce nothing at all.
//
// Where a step already has a name above it IS that name, not the same hex typed
// a second time. Only 300 and 700 are new, because nothing else needed them.

export const GRAY_50  = '#FAF7F2'   // a panel a shade off the page
export const GRAY_100 = LINE_SOFT
export const GRAY_200 = LINE
export const GRAY_300 = '#D3CCBF'   // a harder edge than LINE; new
export const GRAY_400 = FAINT
export const GRAY_500 = MUTED
export const GRAY_600 = BODY
export const GRAY_700 = '#332F29'   // between body and ink; new
export const GRAY_800 = INK

// --------------------------------------------------------------- dark mode
//
// NOT AN INVERSION. Every value here was chosen against the surface it sits on.
//
// EVERY KEY IS THE NAME OF A COLOUR ABOVE, in camelCase - page, brandInk,
// cardChaseEdge. That is not tidiness: lib/colours.test.ts turns each key into
// the CSS name and checks it against the dark block in app/globals.css, both
// directions. A key that is not the name of a light colour fails the ship.
//
// WHAT IS DELIBERATELY ABSENT. sidebar, brand and onBrand are not here, because
// they do not change. The left-hand column is the same near-black in both
// themes - it is the one fixed thing on screen - and the brand blue is a FILL,
// which works on either. Only the blue used for WORDS has to move, and that is
// brandInk.
//
// Three things were measured rather than guessed. The sidebar stays #0F1115, so
// the dark page had to be lifted away from it - at #15181B the two were 1.06 to
// 1 apart and the sidebar had no visible edge at all. The obvious pastel green
// and red come out nearly identical to a colourblind reader on a dark panel, so
// the green is nudged towards mint until they separate. And a field has to be
// DARKER than the card it sits on - on dark, an input lighter than its card
// reads as a button.

export const DARK = {
  page:      '#1C2025',
  panel:     '#24282E',
  card:      '#2A2F36',
  line:      '#383E46',
  lineSoft:  '#30353C',
  cardLine:  '#3A4049',
  field:     '#1A1E23',
  fieldLine: '#3C434C',

  ink:   '#E9EDF1',
  body:  '#C2CAD2',
  muted: '#9AA4AE',
  faint: '#737E89',

  // The same blue, lifted - not a different blue. Written as the constant so
  // there is one value, not two that happen to match today.
  brandInk: BRAND_LIFT,
  info:     BRAND_LIFT,

  chase:   '#FF8E7F',
  waiting: '#B49BF0',
  done:    '#6EE7B7',

  chaseBg:     '#3F2320', chaseEdge:   '#65362E',
  waitingBg:   '#282140', waitingEdge: '#45366E',
  doneBg:      '#123328', doneEdge:    '#215C4B',
  infoBg:      '#123143', infoEdge:    '#20556E',

  // THE RAMP TURNS OVER. In light, gray-50 is nearly white and gray-800 is
  // nearly black; in dark it is the other way up, because a caption is a
  // caption whichever theme it is in. The steps that match a surface above are
  // checked against it by lib/colours.test.ts rather than trusted to match.
  gray50:  '#24282E',  // = panel
  gray100: '#30353C',  // = lineSoft
  gray200: '#383E46',  // = line
  gray300: '#4A515A',
  gray400: '#737E89',  // = faint
  gray500: '#9AA4AE',  // = muted
  gray600: '#C2CAD2',  // = body
  gray700: '#D5DCE3',
  gray800: '#E9EDF1',  // = ink

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
