// A spreadsheet of whatever is on screen.
//
// CSV rather than a real .xlsx: Excel opens it directly, it needs no library,
// and it is built in the browser so client names and loan references never make
// a round trip to a server to become a download.

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  // A leading =, +, - or @ makes Excel treat the value as a formula. Client
  // names and loan references are data, so they are quoted out of that.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  // The byte order mark is what makes Excel read it as UTF-8 rather than
  // mangling every name with an accent in it.
  const blob = new Blob(['﻿' + toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
