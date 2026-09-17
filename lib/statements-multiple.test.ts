import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE WIRING. lib/statement-combine.test.ts holds the rules and proves analyse()
// reads a combined ledger; this checks the screen actually asks for every set,
// because a rule nothing calls is a comment.
//
// 17 Sep 2026, Fabio: "bank statements tab we can only drop 1 set of statements
// we need multiple."

const src = readFileSync('components/StatementAnalysis.tsx', 'utf8')

describe('the Statements tab', () => {
  it('NEVER asks the database for one upload again', () => {
    expect(src, 'the tab is back to showing only the newest set, and the rest are invisible')
      .not.toMatch(/deal_statement_uploads'\)\.select\('\*'\)[\s\S]{0,160}\.limit\(1\)/)
  })

  it('reads the ledger for the deal, not for one workbook', () => {
    expect(src).toMatch(/deal_statement_transactions'\)\.select\('\*'\)\s*\n?\s*\.eq\('deal_id'/)
  })

  it('works the analysis out across every set', () => {
    expect(src).toMatch(/analyse\(\s*\n?\s*combine\(list as any, all as any\)/)
  })

  it('shows the stored analysis if the combine ever fails, and says so', () => {
    expect(src).toMatch(/const a = combined \?\? upload\?\.analysis/)
    expect(src).toMatch(/could not be worked out/)
  })

  it('takes more than one file, and says nothing is replaced', () => {
    expect(src, 'the drop zone is single file again').not.toMatch(/multiple=\{false\}/)
    expect(src).toMatch(/Nothing already loaded is replaced/)
  })

  it('loads files one at a time rather than firing them all at a server', () => {
    expect(src).toMatch(/for \(const file of files\)/)
  })

  it('keeps the sets that worked when one of them fails', () => {
    expect(src).toMatch(/of \$\{files\.length\} loaded/)
  })

  it('gives every set its own Remove', () => {
    expect(src).toMatch(/onClick=\{\(\) => remove\(u\.id\)\}/)
  })

  it('names the cost before removing anything', () => {
    expect(src).toMatch(/removalCost\(/)
    expect(src).toMatch(/transaction\$\{cost\.transactions === 1 \? '' : 's'\}/)
    expect(src).toMatch(/leaves a gap/)
  })

  it('can say which person an account belongs to', () => {
    expect(src).toMatch(/peopleByAccount\(/)
  })
})
