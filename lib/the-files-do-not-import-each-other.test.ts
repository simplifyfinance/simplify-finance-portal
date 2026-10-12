import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'

// TWO FILES THAT IMPORT EACH OTHER WILL BITE EVENTUALLY.
//
// 12 Oct 2026. box-security.ts took variantOf() from box-one.ts. Then box one
// needed securitiesOf() from box-security, so it could name the three houses a
// refinance is secured against instead of saying "the security recorded on this
// deal" - and the two files imported each other.
//
// TypeScript is happy with that. So are these tests, because nothing is called
// while the modules load. A bundler is not reliably happy with it: one of the
// two ends up half-built and a function is undefined at runtime on one page and
// fine on another.
//
// That is not a hypothetical here. An evening was already lost to a compliance
// button that silently wrote nothing, and a circular import was the first thing
// that had to be ruled out.
//
// variantOf now lives in box-variant.ts, which imports nothing, and the only
// thing box-security still takes from box-one is a TYPE - erased when it
// compiles, so it leaves no runtime edge.
// EVERY FILE IN lib, NOT JUST THE COMPLIANCE BOXES.
//
// This started as a guard on box-*.ts. Within the hour the same fault was made
// again, in Paco - paco.ts imported claimsFor() from paco-knowledge.ts, which
// imported flat() back from paco.ts - and this test did not catch it because it
// was only looking at files beginning with "box". A guard that covers the one
// place you have already been burned is not a guard.
const FILES = readdirSync('lib')
  .filter(f => /\.ts$/.test(f) && !f.includes('.test.'))

// A plain import creates a runtime edge. `import type` does not.
function runtimeImports(file: string): string[] {
  const code = readFileSync(`lib/${file}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const out: string[] = []
  const re = /import\s+(type\s+)?([^'"]*?)from\s+'\.\/([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    const typeOnly = !!m[1] || /^\s*\{\s*type\s/.test(m[2]) && !/,/.test(m[2])
    if (!typeOnly) out.push(m[3])
  }
  return out
}

describe('no file imports another that imports it back', () => {
  it.each(FILES.map(f => [f]))('%s', (file) => {
    const mine = file.replace(/\.ts$/, '')
    for (const dep of runtimeImports(file)) {
      let back: string[] = []
      try { back = runtimeImports(`${dep}.ts`) } catch { continue }
      expect(back,
        `lib/${file} and lib/${dep}.ts import each other at runtime. ` +
        `Move the shared piece into a file of its own, as variantOf went to ` +
        `box-variant.ts, or make one side an \`import type\`.`
      ).not.toContain(mine)
    }
  })

  it.each([['box-variant.ts'], ['plain-words.ts']])(
    '%s is small enough to be shared by anybody', (f) => {
      expect(runtimeImports(f)).toEqual([])
    })

  // The thing the circle was created for in the first place.
  it('box one can still name the securities', () => {
    const code = readFileSync('lib/box-one.ts', 'utf8')
    expect(code).toContain("securitiesOf")
    expect(code).toContain('namedSecurities')
  })
})
