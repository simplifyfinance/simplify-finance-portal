"use client"
import { useActionState } from 'react'
import type { ProceedState } from './actions'

// THE BUTTON A CLIENT PRESSES.
//
// 24 Sep 2026. It used to be a plain submit inside a server-rendered form. It
// said nothing while it worked and nothing when it failed, so a client pressing
// it saw absolutely no change - which is how a month of failed saves went
// unnoticed by everybody including us.
//
// Three states now, and the client is never left guessing:
//   - waiting:  the button says so and cannot be pressed twice
//   - failed:   a sentence they can act on, and they can try again
//   - worked:   the page reloads showing what happens next
export default function ProceedButton({ action }: {
  action: (prev: ProceedState, form: FormData) => Promise<ProceedState>
}) {
  const [state, submit, pending] = useActionState<ProceedState, FormData>(action, { ok: true })

  return (
    <form action={submit} style={{ textAlign: 'center', marginBottom: '26px' }}>
      <button type="submit" disabled={pending} style={{
        backgroundColor: pending ? '#9ADFF8' : '#2DBEFF', color: '#fff', border: 0,
        padding: '13px 22px', borderRadius: '8px', fontSize: '15px', fontWeight: 700,
        cursor: pending ? 'default' : 'pointer', width: '100%',
      }}>
        {pending ? 'Just a moment…' : "Yes, let's proceed"}
      </button>
      {state.error && (
        <p style={{ color: '#B91C1C', fontSize: '13px', lineHeight: 1.5, margin: '12px 0 0' }}>
          {state.error}
        </p>
      )}
    </form>
  )
}
