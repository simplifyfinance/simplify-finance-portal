'use client'
import { TONE } from '@/lib/tone'

// Long lists start short. Five rows is enough to see the shape; twenty is
// enough to work from; the full list scrolls inside its own box rather than
// pushing everything else off the page.
export const STEPS = [5, 20] as const

export default function RowLimit({
  shown, total, limit, onChange,
}: {
  shown: number
  total: number
  limit: number
  onChange: (n: number) => void
}) {
  if (total <= STEPS[0]) return null
  const next = limit < 20 && total > 20 ? 20 : total
  return (
    <div className="px-3 py-2.5 border-t flex items-center gap-3 text-[11.5px]"
         style={{ borderColor: TONE.hair, color: TONE.label }}>
      <span>Showing {shown} of {total}</span>
      {limit < total && (
        <button onClick={() => onChange(next)} className="font-medium" style={{ color: TONE.accent }}>
          {next >= total ? `Show all ${total}` : `Show ${next}`}
        </button>
      )}
      {limit >= total && total > STEPS[0] && (
        <button onClick={() => onChange(STEPS[0])} className="font-medium" style={{ color: TONE.accent }}>
          Show fewer
        </button>
      )}
    </div>
  )
}
