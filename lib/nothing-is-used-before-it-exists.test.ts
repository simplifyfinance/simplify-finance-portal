import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

// A VARIABLE USED ABOVE THE LINE THAT CREATES IT.
//
// 24 Sep 2026. The deal page crashed with
//
//   ReferenceError: Cannot access 'fillingGaps' before initialization
//
// on every deal that had been marked settled. The declaration sat three lines
// BELOW the list that read it:
//
//   .filter(s => !deal.settled_at || fillingGaps)      <- line 103
//   const [fillingGaps, setFillingGaps] = useState(false)   <- line 106
//
// IT HID FOR A DAY because of the `||`. On a deal that is not settled the first
// half is true, Javascript never looks at the second half, and nothing happens.
// The moment a deal IS settled it looks, and the page dies. Typecheck does not
// catch it, the build does not catch it, and 2,391 tests did not catch it -
// because no test had ever rendered a settled deal.
//
// This reads every screen and fails the ship if a piece of React state is used
// above the line that creates it. It is a small check for a whole family of
// crashes that only ever appear on the one record nobody tried.

const ROOTS = ['app', 'components']

function screens(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '_to_delete') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) screens(p, out)
    else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p)
  }
  return out
}

// `const [thing, setThing] = useState(...)` and friends.
const DECLARES = /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*[A-Za-z_$][\w$]*\s*\]\s*=\s*(?:useState|useReducer|useActionState)\b/g

describe('nothing is used above the line that creates it', () => {
  const root = join(__dirname, '..')

  it('finds the screens at all', () => {
    // A check that silently reads nothing passes for ever and protects nothing.
    const all = ROOTS.flatMap(r => screens(join(root, r)))
    expect(all.length).toBeGreaterThan(30)
  })

  it('no screen reads a piece of state before it exists', () => {
    const broken: string[] = []

    for (const file of ROOTS.flatMap(r => screens(join(root, r)))) {
      const src = readFileSync(file, 'utf8')
      const lines = src.split('\n')

      for (const m of src.matchAll(DECLARES)) {
        const name = m[1]
        const declaredAt = src.slice(0, m.index).split('\n').length

        // ONLY INSIDE THE COMPONENT THAT OWNS IT.
        //
        // A helper further up the file may have its own `const d`, and that is
        // a different `d`. Scanning the whole file called those a clash. The
        // search starts at the function the state belongs to.
        let from = 0
        for (const f of src.slice(0, m.index).matchAll(/^\s*(?:export\s+)?(?:default\s+)?function\s/gm)) {
          from = src.slice(0, f.index).split('\n').length - 1
        }

        for (let i = from; i < declaredAt - 1; i++) {
          const line = lines[i]
          // Comments and strings are not reads. The note explaining a bug will
          // name the thing, and `'use client'` at the top of every screen
          // contains the word "client", which is a real variable elsewhere.
          const code = line
            .replace(/\/\/.*$/, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/'(?:[^'\\]|\\.)*'/g, "''")
            .replace(/"(?:[^"\\]|\\.)*"/g, '""')
            .replace(/`(?:[^`\\]|\\.)*`/g, '``')
          // IT ONLY COUNTS IF THE LINE RUNS STRAIGHT AWAY.
          //
          // `function setConstructionCost() { ... landValue ... }` above the
          // line that creates landValue is perfectly safe - the function is not
          // called until later. A callback handed to .filter or .map is not:
          // that runs the moment the line is reached, which is exactly how the
          // settled-deal crash happened.
          const runsNow = /\.(filter|map|reduce|sort|some|every|find|findIndex|flatMap|forEach)\s*\(/.test(code)
            || (!/=>/.test(code) && !/\bfunction\b/.test(code))
          if (!runsNow) continue

          // A type or interface declaration names fields, it does not read them.
          if (/^\s*(export\s+)?(type|interface)\b/.test(code)) continue
          // Not a read either: `thing:` and `thing?:` are keys in an object or a
          // type, and `.thing` is a property on something else that happens to
          // share the name.
          if (!new RegExp(`(?<![.\\w$])${name}\\b(?!\\s*\\??\\s*:)`).test(code)) continue
          // An import or a type is not a read.
          if (/^\s*import\b/.test(code)) continue
          broken.push(`${file.slice(root.length + 1)}: ${name} is read on line ${i + 1} but created on line ${declaredAt}`)
          break
        }
      }
    }

    expect(broken, broken.join('\n')).toEqual([])
  })
})
