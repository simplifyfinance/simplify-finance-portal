"use client"
import { useState, useEffect, useRef } from 'react'

type AbnResult = {
  abn: string
  businessName: string
  status: string
  entityType: string
}

export default function AbnAutocomplete({
  value,
  onChange,
  onSelect,
}: {
  value: string
  onChange: (val: string) => void
  onSelect: (result: AbnResult) => void
}) {
  const [results, setResults] = useState<AbnResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!value || value.trim().length < 3) {
      setResults([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/abn-lookup?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setResults(data.results || [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div ref={wrapRef} className="relative">
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        value={value}
        placeholder="Search ABN or business name"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {loading && (
        <div className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-md max-h-56 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.abn}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
              onClick={() => {
                onSelect(r)
                setOpen(false)
              }}
            >
              <div className="font-medium">{r.businessName}</div>
              <div className="text-xs text-gray-400">ABN {r.abn} — {r.status}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
