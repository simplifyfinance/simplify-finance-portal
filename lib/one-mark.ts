// THE "ONE by Simplify" MARK, AS NUMBERS.
//
// 2 Oct 2026. NOTHING HERE IS TYPESET. The word "ONE" and the words "by
// Simplify" are artwork - four tightly cropped transparent PNGs in public/ -
// and this file only says where to put them. The one thing that is drawn is
// the dot, because the dot's colour is the division identifier and so it cannot
// live inside a shared image file.
//
// EVERY NUMBER IS A FRACTION OF W, TAKEN FROM THE CONSTRUCTION SPEC. They were
// measured off the master artwork. NOTHING IS ADJUSTED BY EYE. If a lock-up
// looks wrong the master is re-measured and these are corrected - they are
// never nudged, because a nudge here and a nudge there is how a logo stops
// being one logo.
//
// lib/one-mark.test.ts locks all of it, including the self-check below.

import { BRAND } from './colours'

// ---------------------------------------------------------------- the spec

export const WORDMARK_H = 0.326667
export const WORDMARK_Y = 0.0513
export const BY_W       = 0.4253     // before scale
export const BY_ASPECT  = 0.189744   // height = width x this
export const BY_Y       = 0.406167
export const DOT_D      = 0.1145
export const DOT_X      = 1.0164
export const CANVAS_W   = 1.1309

// 1.0 is the approved master proportion. At interface sizes "by Simplify"
// becomes unreadable at 1.0, so anything on a screen runs at 1.6. One scale per
// asset, never two inside one mark.
export const SCALE = { screen: 1.6, print: 1.0 } as const

// The dot says which part of the business this is. The broking portal is
// Simplify Finance, so it wears the Simplify blue - the same value the rest of
// the interface calls BRAND, from lib/colours.ts, so the mark and the buttons
// cannot drift apart.
export const DOT_COLOUR = BRAND

// W only fixes the internal coordinates of the SVG; the rendered size comes
// from the width attribute. 600 matches the master artwork's own width and
// keeps the numbers readable.
export const W = 600

// ------------------------------------------------------------- the geometry

export type MarkBox = { x: number; y: number; w: number; h: number }
export type MarkGeometry = {
  canvasW: number
  canvasH: number
  word: MarkBox
  by: MarkBox
  dot: { d: number; x: number; y: number; cx: number; cy: number; r: number }
}

// Hand it a width and a scale; it answers with every box. Pure, so the numbers
// can be checked without rendering anything.
export function oneMarkGeometry(width = W, scale: number = SCALE.screen): MarkGeometry {
  const byW = BY_W * width * scale
  const byH = byW * BY_ASPECT
  const dotD = DOT_D * width
  const dotX = DOT_X * width

  const g: MarkGeometry = {
    canvasW: CANVAS_W * width,
    // As tall as the bottom of "by Simplify". Taken from its y position rather
    // than adding four gaps up, which would carry four roundings.
    canvasH: BY_Y * width + byH,
    word: { x: 0, y: WORDMARK_Y * width, w: width, h: WORDMARK_H * width },
    // RIGHT-ALIGNED TO THE WORDMARK. Its right edge is flush with the right
    // edge of the "e". This is the mistake everybody makes with this mark, so
    // it is written as a subtraction rather than a measured offset.
    by: { x: width - byW, y: BY_Y * width, w: byW, h: byH },
    dot: { d: dotD, x: dotX, y: 0, cx: dotX + dotD / 2, cy: dotD / 2, r: dotD / 2 },
  }

  // THE SELF-CHECK. The dot's right edge IS the right edge of the canvas:
  // 1.0164 + 0.1145 comes to 1.1309. If that ever stops being true, somebody
  // has changed one constant without the other and the mark is already wrong.
  const dotRight = g.dot.x + g.dot.d
  if (Math.abs(dotRight - g.canvasW) > 0.001 * width) {
    throw new Error(
      `ONE mark: the dot's right edge (${dotRight}) does not meet the canvas width (${g.canvasW}). ` +
      `DOT_X + DOT_D must equal CANVAS_W.`
    )
  }
  return g
}

// Rounded the same way everywhere, so the SVG this produces is byte-identical
// run to run and a diff shows real changes only.
export const round3 = (n: number) => Math.round(n * 1000) / 1000

// The viewBox every rendered mark shares, as a string.
export function oneMarkViewBox(width = W, scale: number = SCALE.screen): string {
  const g = oneMarkGeometry(width, scale)
  return `0 0 ${round3(g.canvasW)} ${round3(g.canvasH)}`
}

// The height to render at, for a given rendered width. The mark is placed by
// width - the height follows, and is never chosen.
export function oneMarkHeight(renderedWidth: number, scale: number = SCALE.screen): number {
  const g = oneMarkGeometry(W, scale)
  return round3(renderedWidth * (g.canvasH / g.canvasW))
}

// ---------------------------------------------------------------- the files
//
// Tightly cropped, transparent, and the dot is NOT in them. Two tones, because
// the lettering is white on a dark surface and near-black on a light one -
// never one tone with an opacity on it.

export const ART = {
  dark:  { word: '/one-word-white.png', by: '/one-by-white.png' },
  light: { word: '/one-word-ink.png',   by: '/one-by-ink.png' },
} as const

export type MarkTone = keyof typeof ART
