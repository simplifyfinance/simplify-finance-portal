"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function BankSelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (val: string) => void
  className?: string
}) {
  const [banks, setBanks] = useState<string[]>([])
  const [customMode, setCustomMode] = useState(false)

  useEffect(() => {
    supabase.from('lenders').select('name').order('name').then(({ data }) => {
      if (data?.length) {
        const uniqueNames = Array.from(new Set(data.map((l: any) => l.name).filter(Boolean)))
        setBanks(uniqueNames as string[])
      }
    })
  }, [])

  useEffect(() => {
    if (value && !banks.includes(value) && value !== '') {
      setCustomMode(true)
    }
  }, [value, banks])

  if (customMode) {
    return (
      <div className="flex gap-1">
        <input
          className={className}
          placeholder="Bank name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="text-xs text-gray-400 hover:text-gray-600 px-1"
          onClick={() => { setCustomMode(false); onChange('') }}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <select
      className={className}
      value={banks.includes(value) ? value : ''}
      onChange={(e) => {
        if (e.target.value === '__other__') {
          setCustomMode(true)
          onChange('')
        } else {
          onChange(e.target.value)
        }
      }}
    >
      <option value="">Select bank</option>
      {banks.map((bank) => (
        <option key={bank} value={bank}>{bank}</option>
      ))}
      <option value="__other__">Other</option>
    </select>
  )
}
