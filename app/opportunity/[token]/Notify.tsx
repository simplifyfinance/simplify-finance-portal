'use client'
import { useEffect, useRef } from 'react'

// Fires once the page is really open in a browser. Scanners fetch the HTML but
// never run this, so a click here means a person.
export default function Notify({ token }: { token: string }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fetch('/api/opportunity-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => { /* the reader is not shown a failure they cannot act on */ })
  }, [token])
  return null
}
