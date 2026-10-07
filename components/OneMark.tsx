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
  /** Run a ring around the dot, because the portal is fetching something.
   *  NOT a style choice - it is on while something is loading and off when it
   *  is not. See components/useBusy.ts. */
  busy?: boolean
  className?: string
}

export default function OneMark({ width, tone, withBy = true, busy = false, className }: Props) {
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

  // THE RING LIVES INSIDE THE DOT. See the note beside it below: the outer
  // edge of the stroke lands exactly on the dot's own edge, so a loading mark
  // is the same size as a still one and nothing on the page moves.
  const ringW = g.dot.r / 2
  const ringR = g.dot.r - ringW / 2
  const ringC = 2 * Math.PI * ringR

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
      {/* THE DOT IS THE ONLY PART OF THIS MARK THAT CAN MOVE.
          7 Oct 2026. Fabio asked for the O to load. It cannot: the wordmark is
          a flat PNG, so animating the letter would mean re-cutting the master
          artwork. The dot is drawn here, in code, and it is already the piece
          that carries meaning - its colour is the division identifier. So the
          dot is what loads.

          AND IT LOADS INSIDE ITSELF. The first version drew a stroked circle AT
          the dot's radius, which puts half the stroke width OUTSIDE it, over a
          filled disc that was still there underneath. Fabio: "the spinning
          wheel, it's actually going over the actual dot ... it just looks
          terrible." He is right - it was a spinner sitting on top of a dot
          rather than a dot that spins.

          The arithmetic that fixes it, and the whole of why the ring is drawn
          where it is:

            stroke width  w  = r / 2
            ring radius  rr  = r - w/2
            outer edge       = rr + w/2 = r, exactly the dot's own edge

          So the ring occupies precisely the circle the dot occupies. The mark
          keeps its size to the pixel, nothing is drawn outside it, and the left
          column does not shift while a page loads. The faint full ring behind
          the arc is the dot ghosted, not a disc - a disc would show through the
          hole in the middle and bring back the thing being fixed. */}
      {busy ? (
        <g>
          <circle cx={round3(g.dot.cx)} cy={round3(g.dot.cy)} r={round3(ringR)}
                  fill="none" stroke={DOT_COLOUR} strokeWidth={round3(ringW)} opacity="0.22" />
          <circle cx={round3(g.dot.cx)} cy={round3(g.dot.cy)} r={round3(ringR)}
                  fill="none" stroke={DOT_COLOUR} strokeWidth={round3(ringW)}
                  strokeLinecap="round"
                  strokeDasharray={`${round3(ringC * 0.26)} ${round3(ringC * 0.74)}`}
                  style={{ transformOrigin: `${round3(g.dot.cx)}px ${round3(g.dot.cy)}px`,
                           animation: 'ringrun .9s linear infinite' }} />
        </g>
      ) : (
        <circle cx={round3(g.dot.cx)} cy={round3(g.dot.cy)} r={round3(g.dot.r)} fill={DOT_COLOUR} />
      )}
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
  /** Waiting in the middle of a page. Smaller than the login mark - it is a
   *  thing you glance at, not the subject of the screen. See Loading.tsx. */
  loading: 132,
} as const
