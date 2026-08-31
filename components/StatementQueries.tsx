'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { describeAnswer, type Answer } from '@/lib/statement-answers'

// The statement queries and their answers, shown where people already look.
//
// Fabio, 31 Aug 2026: "where does the answers go". Nowhere — they lived on one
// row of the Statements tab and nothing else knew about them, which is not much
// better than the phone call they replaced. Internal notes on the fact find is
// the box that stays visible on every tab and already reaches SalesTrekker, so
// that is where they belong.
//
// Deliberately read-only. Internal notes is free text somebody types into: an
// answer appended into it could be edited or deleted by the next person to tidy
// the box, and two people saving at once would overwrite each other. The answers
// table stays the record; this shows it.

const LABELS: Record<string, string> = {
  salary_gap: 'Gap in the pay run',
  salary_variance: 'Salary against the fact find',
  income_stability: 'Income stability',
  cash_deposits: 'Cash deposits',
  dishonours: 'Dishonours',
  gambling: 'Gambling',
  coverage: 'Statement coverage',
  undisclosed_commitments: 'Commitments not declared',
  income_not_declared: 'Income not declared',
}

export default function StatementQueries({ dealId }: { dealId: string }) {
  const [answers, setAnswers] = useState<Answer[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowser()
      const { data } = await supabase.from('deal_statement_answers')
        .select('*').eq('deal_id', dealId).order('answered_at', { ascending: false })
      // One answer per question — the most recent. An earlier answer that was
      // later changed is history, not a second finding.
      const seen = new Set<string>()
      setAnswers(((data || []) as Answer[]).filter(a => {
        if (seen.has(a.item_key)) return false
        seen.add(a.item_key); return true
      }))
      setReady(true)
    })()
  }, [dealId])

  if (!ready || answers.length === 0) return null

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Statement queries answered ({answers.length})
        </span>
        <p className="text-[11px] text-gray-400 m-0 mt-0.5">
          Recorded on the Statements tab. Not client facing, and not used by the AI.
        </p>
      </div>
      {answers.map(a => (
        <div key={a.item_key} className="px-3 py-2 border-b border-gray-100 last:border-b-0">
          <p className="text-[11px] text-gray-400 m-0">{LABELS[a.item_key] || a.item_key}</p>
          <p className="text-[13px] text-gray-800 m-0">{describeAnswer(a)}</p>
          <p className="text-[11px] text-gray-400 m-0">
            {a.answered_by || 'recorded'} · {new Date(a.answered_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      ))}
    </div>
  )
}
