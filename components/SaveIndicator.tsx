"use client"
import { indicatorLine, type SaveStatus } from '@/lib/save-indicator'

// WHY THERE IS A data-save ATTRIBUTE ON THIS.
//
// 17 Sep 2026. The robot caught 112 characters on screen, 31 in the database and
// this line saying "Saved". Reading the code afterwards could not tell whether
// the later save never ran or ran and was thrown away, and the evidence was
// already gone - Playwright empties test-results at the start of every run.
//
// A person reads the words. A test cannot read words reliably, and grepping the
// page for "Saved" finds a stamp without knowing whether it is this moment's or
// the last one's. This attribute is the same fact in a form a test can watch
// change: clean, saving, slow, failed. Nothing on screen moves.

// THE LINE BESIDE THE DEAL NAME. Quiet when everything is saved, a coloured pill
// only when somebody needs to notice before they close the tab. What it says and
// when is decided in lib/save-indicator.ts - nothing is worded here.

export function SaveIndicator({ status }: { status?: SaveStatus }) {
  if (!status) return null
  const line = indicatorLine(status)

  if (line.tone === 'quiet') {
    return (
      <span data-save={status.stage} className="text-xs text-gray-400 whitespace-nowrap">
        {status.stage === 'saving'
          ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5 align-middle animate-pulse" />
          : <span className="mr-1">&#10003;</span>}
        {line.text}
      </span>
    )
  }

  const skin = line.tone === 'bad'
    ? 'bg-red-100 text-red-700'
    : 'bg-amber-100 text-amber-800'

  return (
    <span data-save={status.stage} className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap ${skin}`}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
      {line.text}
    </span>
  )
}

// The sentence under the name. Only there when something is wrong, so it cannot
// push the form around on a normal day.
export function SaveIndicatorNote({ status }: { status?: SaveStatus }) {
  if (!status) return null
  const line = indicatorLine(status)
  if (!line.note) return null
  return (
    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
      {line.note}
      {line.technical && <span className="text-gray-400"> ({line.technical})</span>}
    </p>
  )
}

export default SaveIndicator
