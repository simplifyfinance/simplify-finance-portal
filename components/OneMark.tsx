// THE "ONE by Simplify" MARK.
//
// 2 Oct 2026. One component, used everywhere the mark appears, so there is one
// mark rather than one per screen. Hand it a width and whether the surface
// behind it is light or dark; everything else is fixed by lib/one-mark.ts and
// is not a choice this component offers.
//
// THE LETTERING IS ARTWORK, NOT TYPE. It is placed as two transparent PNGs. The
// only drawn thing is the dot, because the dot's colour says which part of the
// business this is - and the broking portal's is the Simplify blue, read from
// lib/colours.ts so the mark and the buttons cannot drift apart.
//
// There is no "nudge it a bit" prop on purpose. If the mark looks wrong, the
// master artwork is re-measured and lib/one-mark.ts is corrected.

import {
  ART, DOT_COLOUR, oneMarkGeometry, oneMarkHeight, oneMarkViewBox,
  round3, SCALE, W, type MarkTone,
} from '@/lib/one-mark'

type Props = {
  /** How wide to draw it, in pixels. The height follows and is never chosen. */
  width: number
  /** What is behind it. 'dark' gives white lettering, 'light' near-black. */
  tone: MarkTone
  /** Leave the "by Simplify" line off. Only for spaces too small to read it. */
  withBy?: boolean
  className?: string
}

export default function OneMark({ width, tone, withBy = true, className }: Props) {
  const g = oneMarkGeometry(W, SCALE.screen)
  const art = ART[tone]

  // Without "by Simplify" the canvas stops at whichever is lower, the wordmark
  // or the dot - otherwise the mark carries a band of empty space where the
  // missing line used to be and looks badly centred.
  const shortH = Math.max(g.word.y + g.word.h, g.dot.d)

  const viewBox = withBy
    ? oneMarkViewBox(W, SCALE.screen)
    : `0 0 ${round3(g.canvasW)} ${round3(shortH)}`
  const height = withBy
    ? oneMarkHeight(width, SCALE.screen)
    : round3(width * (shortH / g.canvasW))

  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={round3(width)}
      height={height}
      viewBox={viewBox}
      role="img"
      aria-label="ONE by Simplify"
    >
      <title>ONE by Simplify</title>
      <image href={art.word} x={round3(g.word.x)} y={round3(g.word.y)}
             width={round3(g.word.w)} height={round3(g.word.h)} />
      {withBy && (
        <image href={art.by} x={round3(g.by.x)} y={round3(g.by.y)}
               width={round3(g.by.w)} height={round3(g.by.h)} />
      )}
      <circle cx={round3(g.dot.cx)} cy={round3(g.dot.cy)} r={round3(g.dot.r)} fill={DOT_COLOUR} />
    </svg>
  )
}

// Named so a reader of the call site can see the size was decided once, in the
// brand work, rather than typed into whatever screen needed a logo that day.
export const MARK_WIDTH = {
  /** The top of the left-hand column. A quarter of the base canvas. */
  sidebar: 169.635,
  /** The login card. Big enough to be the thing you see, small enough that the
   *  card still reads as a form rather than a poster. */
  login: 210,
} as const
