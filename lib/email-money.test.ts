import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

// Two faults that reached client-facing emails and were invisible in review.
// This reads the source rather than the output, because the whole problem was
// that the output looked fine until one field happened to be empty.

function sourceFiles(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }   // a folder that is not there yet
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === '.git' || name === '_to_delete') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

const ROOT = process.cwd()
const FILES = ['app', 'lib', 'components'].flatMap(d => sourceFiles(join(ROOT, d)))

// A guard that silently scanned nothing would pass forever.
if (FILES.length < 20) throw new Error(`Only ${FILES.length} source files were found — the guard is not looking where it thinks it is.`)

describe('money in a client email', () => {
  // '$' + x || ''  parses as  ('$' + x) || ''  because + binds tighter than ||.
  // '$' + undefined is "$undefined", which is truthy, so the fallback never runs
  // and the client is sent "$undefined". It happened on 34 lines across seven
  // templates. The fix is a bracket: '$' + (x || '').
  it('never leaves a dollar sign concatenated outside its own fallback', () => {
    const bad = /'\$' \+ [A-Za-z0-9_?.[\]]+\s*\|\|/
    const hits: string[] = []
    for (const f of FILES) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (bad.test(line)) hits.push(`${f.replace(ROOT + '/', '')}:${i + 1}  ${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits, `Write '$' + (value || '') instead:\n${hits.join('\n')}`).toEqual([])
  })

  // "$0 — first home buyer exemption" was written into a file through an
  // unquoted shell heredoc. The shell expanded $0 to the name of the shell, and
  // the string became "/bin/zsh — first home buyer exemption". It sat there
  // unnoticed because the precedence bug above stopped the fallback ever running.
  it('carries no wreckage from an unquoted shell heredoc', () => {
    const bad = /\/bin\/(?:ba|z)?sh|\/Users\/[a-z]/i
    const hits: string[] = []
    for (const f of FILES) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (bad.test(line)) hits.push(`${f.replace(ROOT + '/', '')}:${i + 1}  ${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits, `A shell expanded something it should not have:\n${hits.join('\n')}`).toEqual([])
  })

  // THE THIRD FAULT, AND THE ONE THAT ACTUALLY REACHED A CLIENT.
  //
  // Sticking a dollar sign in front of a stored value is right for exactly as
  // long as every value arrives already comma-formatted. On 3 Sep 2026 one did
  // not - the BC filled its existing loan balance from the fact find with
  // String() - and $1,279,283.98 went out as $1279283.98.
  //
  // The 104 call sites in the two email generators now go through money(), and
  // this is what keeps them there. money('') is '' rather than a lonely dollar
  // sign, and money('1279283.98') is $1,279,283.98 whatever was stored.
  it('builds no dollar figure by hand in a client email', () => {
    const EMAIL_TEMPLATES = FILES.filter(f => /generate-(lo-)?email\/route\.ts$/.test(f))
    expect(EMAIL_TEMPLATES.length, 'the email templates moved — this guard is looking at nothing')
      .toBeGreaterThanOrEqual(2)

    const byHand = [
      /'\$' \+/,        // '$' + value
      /"\$" \+/,        // "$" + value
      /\$\$\{/,          // $${value} inside a template literal
    ]
    const hits: string[] = []
    for (const f of EMAIL_TEMPLATES) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return          // the comments explain the old way
        if (byHand.some(re => re.test(line))) {
          hits.push(`${f.replace(ROOT + '/', '')}:${i + 1}  ${line.trim().slice(0, 100)}`)
        }
      })
    }
    expect(hits, `Use money(value) from lib/money.ts:\n${hits.join('\n')}`).toEqual([])
  })

  // Number('620,000') is NaN. The deal summary PDF printed "$0" for most of the
  // money on a file this way; the client page printed "$NaN" against every
  // property value; the LVR report dropped every property with a comma in it and
  // looked like it had nothing to say; and the SMSF flag, which compares a super
  // balance to $250,000, had never once fired. The forms store money
  // comma-formatted; readMoney() is what reads it.
  //
  // Deliberately NOT checking `amount`. That name belongs to the statement
  // transactions and the broker targets as well, where it is a numeric column
  // straight out of Postgres and Number() is exactly right. A guard that cries
  // wolf on a dozen correct lines gets switched off, so this only names the
  // fields the FORMS own.
  it('never passes stored money straight to Number()', () => {
    const bad = /Number\((?:[a-z]\w*\??\.)?(?:value|balance|limitAmount|deposit|purchasePrice|stampDuty)\b/
    const hits: string[] = []
    for (const f of FILES) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return
        if (bad.test(line)) hits.push(`${f.replace(ROOT + '/', '')}:${i + 1}  ${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits, `Number() cannot read "620,000" — use readMoney():\n${hits.join('\n')}`).toEqual([])
  })
})
