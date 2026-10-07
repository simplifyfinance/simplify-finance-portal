'use client'
import OneMark, { MARK_WIDTH } from '@/components/OneMark'

// WAITING, WITH THE MARK ON IT.
//
// 7 Oct 2026. Fabio: "when I'm clicking on deals, it says loading in the middle
// of the page. Why not use the same animation? Why not have the one by simplify
// there with the little spinning wheel? Let's make this visually appealing."
//
// He is right, and it is the same argument as the bar: the words "Loading
// deals..." in grey, centred in an empty page, are not a thing anybody reads as
// progress. The mark with its dot running is - and it is already the device the
// sidebar and the bar use, so the portal says "busy" one way rather than three.
//
// FOR A PAGE WHOSE SHAPE WE HAVE NOT DRAWN YET. Where a skeleton exists it is
// better than this, because it says what the page will be as well as that it is
// coming - see components/Skeleton.tsx. This is for the screens whose shape is
// still to be written, and for the ones where there is genuinely nothing to
// draw, like a board that may come back empty.
export default function Loading({ what, tone = 'light' }: { what?: string; tone?: 'light' | 'dark' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
      <OneMark width={MARK_WIDTH.loading} tone={tone} busy withBy={false} />
      {what && <p className="text-[12.5px] text-faint">{what}</p>}
    </div>
  )
}
