import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// EVERY ROUTE THAT COSTS MONEY OR HOLDS THE MASTER KEY ASKS WHO YOU ARE.
//
// 23 Nov 2026. The first run of scripts/weekly-audit.sh found fourteen routes
// with no sign-in check at all and four that checked only that you held a
// login. Every one of the fourteen calls a paid model: anybody on the internet
// who found the address could run them and the bill was Fabio's.
//
// They are fixed. This is what stops the fifteenth being written.
//
// WHAT IT REFUSES: a route that reaches for a paid model or the admin client
// without lib/only-staff.ts beside it. Adding one to the list below is a
// deliberate act with a reason written next to it, which is the point.
//
// See docs/the-security-audit.md.

const API = join(process.cwd(), 'app', 'api')

// ROUTES THAT MAY NOT ASK, AND WHY. Every line is a decision, not an oversight.
const ALLOWED: Record<string, string> = {
  '2fa/send':   'runs before sign-in is finished; checks the user id, which is all it can',
  '2fa/verify': 'the same - this IS the sign-in',
  'version':    'returns a build number and nothing else',
}

function routes(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...routes(full, prefix ? `${prefix}/${name}` : name))
    } else if (name === 'route.ts') {
      out.push(prefix)
    }
  }
  return out
}

// COMMENTS ARE NOT CODE. This test has tripped on its own prose before - a
// comment naming a function counted as calling it. So they go first.
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('every route that costs money or holds the master key asks who you are', () => {
  const found = routes(API)

  it('finds the routes at all', () => {
    expect(found.length).toBeGreaterThan(40)
  })

  for (const r of found) {
    // A client reaches these from a signed link, not a login. They have their
    // own checks - see lib/ready-link.ts and lib/answers-link.ts.
    if (/^(ready|answers|proceed|opportunity)/.test(r)) continue

    it(`${r}`, () => {
      const code = codeOnly(readFileSync(join(API, r, 'route.ts'), 'utf-8'))

      const costsMoney = /anthropic|messages\.create|openai/i.test(code)
      const holdsTheKey = /createSupabaseAdmin/.test(code)
      if (!costsMoney && !holdsTheKey) return

      if (ALLOWED[r]) {
        expect(ALLOWED[r].length).toBeGreaterThan(10)
        return
      }

      // EITHER WAY OF ASKING COUNTS, because both read the staff record rather
      // than the login. lib/only-staff.ts is the one to use in new work - it
      // also refuses a record marked past, which a bare lookup does not. The
      // older routes below ask through lib/permissions.ts and can() instead,
      // and they were checked by hand on 23 Nov 2026.
      const asks = /onlyStaff/.test(code) || /user_profiles/.test(code)
      expect(asks,
        `app/api/${r}/route.ts reaches for ${costsMoney ? 'a paid model' : 'the admin client'} `
        + 'without lib/only-staff.ts. Add `const { refusal } = await onlyStaff(); if (refusal) '
        + 'return refusal` as its first two lines, or add it to ALLOWED in this test with the '
        + 'reason written out.').toBe(true)
    })
  }
})
