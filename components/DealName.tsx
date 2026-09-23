"use client"
import { splitOnCommonStart } from '@/lib/same-clients'

// A DEAL NAME WITH THE PART THAT MATTERS IN FRONT OF YOU.
//
// 23 Sep 2026. Two deals for the Hameed household sat next to each other:
//
//   Hameed Abdul Jabbar & Suleka Hameed Sadiq Equity 2026
//   Hameed Abdul Jabbar & Suleka Hameed Sadiq Land/Construction 2027
//
// Forty-two identical characters, and the two words that tell them apart come
// last, in the same weight as everything before them. Forty minutes went on
// believing a credit officer's work had been wiped.
//
// The whole name is still here, in the same place, in the same order. Only the
// shared opening is dimmed. A deal with no twin has nothing to share, so it
// renders exactly as it did before this existed.
export default function DealName({ name, others, className }: {
  name: string
  // The other names to compare against - usually the same clients' other deals.
  others: string[]
  className?: string
}) {
  const { shared, tail } = splitOnCommonStart(name, others)
  if (!shared) return <span className={className}>{name}</span>
  return (
    <span className={className}>
      <span className="text-[#A8B0B7] font-normal">{shared}</span>{tail}
    </span>
  )
}
