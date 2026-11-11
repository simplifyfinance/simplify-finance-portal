'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import CannotAction from '@/components/CannotAction'
import { stageFor } from '@/lib/my-work'
import { type Stage } from '@/lib/who-did-this-stage'

// ONLY THE PERSON HOLDING IT IS OFFERED THIS.
//
// Alan's item 3. "I cannot action this" belongs to whoever has the deal in
// their queue - not to the broker, who already has Send it back, and not to
// anybody passing through.
//
// The deal page knows the signed-in user; a stage is owned by a credit
// officer, which is a different id. That lookup is the whole of this file, so
// components/CannotAction.tsx can be handed a stage and tested without one.

export default function CreditCannotAction({ deal, me, onDone }: {
  deal: any
  me?: { id?: string | null; name?: string }
  onDone?: (patch: any) => void
}) {
  const supabase = createSupabaseBrowser()
  const [officerId, setOfficerId] = useState<string | null>(null)
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    let alive = true
    const userId = String(me?.id || '')
    if (!userId) { setAsked(true); return }
    void supabase.from('credit_officers').select('id')
      .eq('user_id', userId).eq('active', true).maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setOfficerId((data as any)?.id || null)
        setAsked(true)
      })
    return () => { alive = false }
  }, [me?.id])

  if (!asked || !officerId) return null
  const stage: Stage | null = stageFor(deal, officerId)
  if (!stage) return null

  return <CannotAction deal={deal} stage={stage} me={me} onDone={onDone} />
}
