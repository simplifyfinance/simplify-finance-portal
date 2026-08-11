"use client"
import { useState, useEffect } from 'react'

function toRawDigits(formatted: string | undefined | null): string {
  if (!formatted) return ''
  // Keep digits and decimal points only
  let cleaned = String(formatted).replace(/[^0-9.]/g, '')
  // Collapse multiple decimal points down to just the first one
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  // Limit to 2 decimal places
  const [intPart, decPart] = cleaned.split('.')
  if (decPart !== undefined) {
    return intPart + '.' + decPart.slice(0, 2)
  }
  return cleaned
}

function formatCurrency(raw: string | undefined | null): string {
  if (!raw) return ''
  const str = String(raw)
  const dotIndex = str.indexOf('.')
  const intPart = dotIndex === -1 ? str : str.slice(0, dotIndex)
  const decPart = dotIndex === -1 ? undefined : str.slice(dotIndex + 1)
  const digits = intPart.replace(/[^0-9]/g, '')
  if (!digits && decPart === undefined) return ''
  const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return '$' + formattedInt + (decPart !== undefined ? '.' + decPart : '')
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
