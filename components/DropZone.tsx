'use client'
import { useState, useRef } from 'react'

// One drop zone for the whole portal. Drag files onto it, or click to choose.
// Always hands back an array, so a caller that only wants one file takes the first
// rather than every caller reimplementing multi-select.
export default function DropZone({
  onFiles, accept, multiple = true, disabled = false, busy = false,
  title, hint, compact = false,
}: {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  busy?: boolean
  title: string
  hint?: string
  compact?: boolean
}) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  function take(list: FileList | null) {
    if (!list || list.length === 0) return
    const files = Array.from(list)
    onFiles(multiple ? files : files.slice(0, 1))
    if (input.current) input.current.value = ''    // so the same file can be picked twice
  }

  const state = disabled || busy
    ? 'opacity-60 pointer-events-none border-[#E8E1D6]'
    : over
      ? 'border-[#2DBEFF] bg-[#EAF7FE]'
      : 'border-[#E8E1D6] hover:border-[#BFE6F9] hover:bg-[#FCFAF6]'

  return (
    <label
      onDragOver={e => { e.preventDefault(); if (!disabled && !busy) setOver(true) }}
      onDragEnter={e => { e.preventDefault(); if (!disabled && !busy) setOver(true) }}
      onDragLeave={e => { e.preventDefault(); setOver(false) }}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled && !busy) take(e.dataTransfer.files) }}
      className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl cursor-pointer transition ${state} ${compact ? 'px-4 py-4' : 'px-5 py-8'}`}
    >
      <svg className={`text-[#A29889] ${compact ? 'w-4 h-4' : 'w-6 h-6'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
      </svg>
      <span className={`font-semibold text-[#2E2A26] ${compact ? 'text-[12px]' : 'text-[13.5px]'}`}>
        {busy ? 'Working…' : over ? 'Drop them here' : title}
      </span>
      {hint && <span className="text-[11.5px] text-[#A29889] text-center">{hint}</span>}
      <input ref={input} type="file" accept={accept} multiple={multiple} className="hidden"
        disabled={disabled || busy} onChange={e => take(e.target.files)} />
    </label>
  )
}
