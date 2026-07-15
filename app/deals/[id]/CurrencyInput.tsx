"use client"
import { useState, useEffect } from 'react'

function formatCurrency(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return '$' + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function toRawDigits(formatted: string): string {
  return formatted.replace(/[^0-9]/g, '')
}

export default function CurrencyInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string
  onChange: (val: string) => void
  className?: string
  placeholder?: string
}) {
  const [display, setDisplay] = useState(formatCurrency(value))

  useEffect(() => {
    setDisplay(formatCurrency(value))
  }, [value])

  return (
    <input
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        const raw = toRawDigits(e.target.value)
        setDisplay(formatCurrency(raw))
        onChange(raw)
      }}
    />
  )
}
