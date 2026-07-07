'use client'
import { useEffect, useRef } from 'react'
import { loadGoogleMaps } from '@/lib/googleMaps'

export default function AddressAutocomplete({ value, onChange, placeholder, className }: {
  value: string
  onChange: (address: string) => void
  placeholder?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(() => {
      if (cancelled || !inputRef.current || !(window as any).google) return
      autocompleteRef.current = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'au' },
        fields: ['formatted_address'],
        types: ['address']
      })
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace()
        if (place?.formatted_address) onChange(place.formatted_address)
      })
    }).catch(() => {
      // Silently fall back to plain text entry if the script fails to load
    })
    return () => { cancelled = true }
  }, [])

  return (
    <input
      ref={inputRef}
      className={className}
      placeholder={placeholder || 'Search address'}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}
