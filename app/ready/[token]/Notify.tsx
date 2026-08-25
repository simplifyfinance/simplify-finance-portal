'use client'
import { useEffect, useRef } from 'react'

// The broker notice is sent from here, once the page is genuinely open in a
// browser. A mail scanner fetches the HTML but never runs this, so it cannot
// raise a false "ready to proceed". The client sees nothing either way.
export default function Notify({ token }: { token: string }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fetch('/api/ready-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => { /* the client is not shown a failure they cannot act on */ })
  }, [token])
  return null
}
