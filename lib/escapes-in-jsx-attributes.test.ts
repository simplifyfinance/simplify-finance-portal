import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// A BACKSLASH ESCAPE INSIDE A JSX ATTRIBUTE IS NOT AN ESCAPE. IT IS TEXT.
//
// 1 Oct 2026. The Statements tab told the team:
//
//   As many as you like — one applicant's bank, then the other's.
//
// In every normal string in this codebase — is an em dash - the compiler
// turns it into one. In a JSX attribute written with quotes it is not a string
// at all, it is JSX attribute text, and the five characters print exactly as
// typed. The same line one inch away inside {braces} would have been fine.
//
// That difference is invisible when you read the code, which is why it sat on
// a page for weeks. So nothing reads it any more - this does.

const EXCLUDE = ['node_modules', '.next', '_to_delete', '.git']

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.includes(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) tsxFiles(path, out)
    else if (path.endsWith('.tsx')) out.push(path)
  }
  return out
}

// name="..." or name='...' with no spaces around the = is a JSX attribute.
// A plain assignment (const x = "...") is written with spaces, so it is left
// alone - and anything inside {braces} is a real string and is none of our
// business.
const ATTRIBUTE = /(?:^|[\s{])([a-zA-Z][a-zA-Z0-9]*)=("[^"]*"|'[^']*')/g

describe('what a JSX attribute prints is what was typed in it', () => {
  const files = tsxFiles('.')

  it('finds the pages to check', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('and not one of them hides a backslash escape in an attribute', () => {
    const found: string[] = []
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//')) return
        for (const m of line.matchAll(ATTRIBUTE)) {
          if (/\\(u[0-9a-fA-F]{4}|n|t|x[0-9a-fA-F]{2})/.test(m[2])) {
            found.push(`${file}:${i + 1}  ${m[1]}=${m[2]}`)
          }
        }
      })
    }
    expect(found, `these print the backslash instead of the character:\n${found.join('\n')}`)
      .toEqual([])
  })
})

describe('the line that started it', () => {
  it('says it with a dash', () => {
    const src = readFileSync('components/StatementAnalysis.tsx', 'utf8')
    expect(src).toContain('As many as you like — one applicant')
    expect(src).not.toContain('As many as you like \\u2014')
  })
})
