import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A NOTE TO OURSELVES IS NOT WORDS ON A CLIENT'S SCREEN.
//
// 16 Nov 2026. Half a paragraph of my own working notes was printed in the
// middle of the deal page, in grey, between the warnings and the stage bar:
//
//   // WHO IS HOLDING IT, BY NAME. // 16 Nov 2026 - this printed "With
//   13544bdc-ef74-41d2-bae4-..." on a real deal, because
//   deals.assigned_credit_officer is an ID, not a name...
//
// It built. Every one of the nine thousand tests passed. It was only found
// because the page was photographed and looked at.
//
// WHY IT HAPPENED. Inside a component's markup a note has to be wrapped in
// {/* ... */}. A plain // line is not a note there - it is TEXT, and React
// prints it like any other words. I had moved a note out of a place it could
// not sit and dropped it one line too low.
//
// This reads the markup of the screens people look at and fails if a note is
// sitting where words go.

const SCREENS = [
  'app/(app)/deals/[id]/DealPageClient.tsx',
  'components/DealTabCards.tsx',
  'components/DealRail.tsx',
  'components/DealFile.tsx',
  'components/TheBubble.tsx',
  'components/DocumentsBox.tsx',
  'components/DealPrompts.tsx',
  'components/ClientAgreed.tsx',
  'components/SomethingWrong.tsx',
  'components/DealLinks.tsx',
]

// THE SHAPE OF THE FAULT, not "a // anywhere near some markup".
//
// A note inside a piece of JavaScript - the body of an arrow function, a map,
// a list of props - is perfectly fine and there are hundreds of them. The line
// before one of those ends with an opener: `{`, `(`, `=> {`, `,`.
//
// A note that will be PRINTED sits where a child element goes: the line before
// it closes something (`>`, `/>`, `}`, `*/}`) and the line after it opens a tag
// (`<`). That pair is the fault and nothing else is.
function strayNotes(src: string): string[] {
  const from = src.indexOf('\n  return (')
  if (from < 0) return []
  const lines = src.slice(from).split('\n')
  const out: string[] = []

  const prev = (i: number) => {
    for (let j = i - 1; j >= 0; j--) if (lines[j].trim()) return lines[j].trim()
    return ''
  }
  const next = (i: number) => {
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue
      if (/^\/\/ /.test(lines[j].trim())) continue
      return lines[j].trim()
    }
    return ''
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!/^ {4,}\/\/ /.test(line)) continue
    // Only the FIRST line of a run is judged; the rest belong to it.
    if (/^ {4,}\/\/ /.test(lines[i - 1] || '')) continue
    const before = prev(i)
    const after = next(i)
    const closesJsx = /(\/?>|\*\/\}|\}|\))$/.test(before) && !/[({,[]$/.test(before)
    if (closesJsx && after.startsWith('<')) out.push(line.trim())
  }
  return out
}

describe('no working note is printed at a person', () => {
  it.each(SCREENS)('%s', (f) => {
    const stray = strayNotes(readFileSync(f, 'utf8'))
    expect(stray, stray.length
      ? `${stray.length} line(s) of notes would be PRINTED ON THE PAGE in ${f}.\n`
        + `Wrap them in {/* ... */}, or move them above the return.\n  `
        + stray.join('\n  ')
      : '').toEqual([])
  })
})

// AND IT REALLY WOULD HAVE CAUGHT IT. The exact lines that reached the live
// page on 16 Nov 2026, run through the same function.
describe('the thing that got through', () => {
  const WHAT_HAPPENED = [
    'export default function X() {',
    '  return (',
    '    <div>',
    '      <TestDealBand deal={deal} />',
    '      // WHO IS HOLDING IT, BY NAME.',
    '      // 16 Nov 2026 - this printed "With 13544bdc-ef74-..." on a real deal.',
    '      <Bubble tone="done" title="Where it is">',
    '      </Bubble>',
    '    </div>',
    '  )',
    '}',
  ].join('\n')

  it('is caught', () => {
    expect(strayNotes(WHAT_HAPPENED).length).toBe(1)
  })

  it('and a note inside a piece of JavaScript is left alone', () => {
    const FINE = [
      'export default function X() {',
      '  return (',
      '    <div>',
      '      {(() => {',
      '        // An ID is not a name. If all we have is an ID, say nothing.',
      '        return <span>ok</span>',
      '      })()}',
      '    </div>',
      '  )',
      '}',
    ].join('\n')
    expect(strayNotes(FINE)).toEqual([])
  })
})
