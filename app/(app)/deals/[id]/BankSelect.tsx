"use client"
import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const supabase = createSupabaseBrowser()

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
  const [isOther, setIsOther] = useState(false)

  useEffect(() => {
    supabase.from('lenders').select('name').order('name').then(({ data }) => {
      if (data?.length) {
        const uniqueNames = Array.from(new Set(data.map((l: any) => l.name).filter(Boolean)))
        setBanks(uniqueNames as string[])
      }
    })
  }, [])

  useEffect(() => {
    if (value && banks.length > 0 && !banks.includes(value)) {
      setIsOther(true)
    }
  }, [value, banks])

  return (
    <div className="flex gap-2">
      <select
        className={className}
        value={isOther ? '__other__' : (banks.includes(value) ? value : '')}
        onChange={(e) => {
          if (e.target.value === '__other__') {
            setIsOther(true)
            onChange('')
          } else {
            setIsOther(false)
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
      {isOther && (
        <input
          className={className}
          placeholder="Bank name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
