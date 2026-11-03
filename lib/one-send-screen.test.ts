import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { TEMPLATES, SENT_FROM_ITS_OWN_STEP } from './milestone-emails'

// ONE SEND SCREEN, TWO DOORS INTO IT.
//
// The milestone emails are reachable from the deal card and from the Templates
// page. The tempting shortcut is a second screen on the Templates side, and it
// would drift: the one on the deal would get the next fix and the other would
// keep the bug. That is the mistake this codebase has paid for more than once -
// the lender name, the duty state, the settings menu.

const strip = readFileSync('components/MilestoneEmails.tsx', 'utf8')
const door = readFileSync('components/MilestoneFromTemplates.tsx', 'utf8')
const page = readFileSync('app/(app)/templates/TemplatesClient.tsx', 'utf8')

describe('the Templates page opens the screen that already exists', () => {
  it('the screen is exported rather than copied', () => {
    expect(strip).toContain('export function SendScreen')
  })

  it('and the Templates door imports it', () => {
    expect(door).toContain("import { SendScreen } from '@/components/MilestoneEmails'")
    expect(door).toContain('<SendScreen')
  })

  // THE GUARD. A second screen over here is the failure this test exists for.
  it('and does not build one of its own', () => {
    expect(door).not.toContain('function SendScreen')
    expect(door).not.toContain('send-milestone-email')
  })
})

describe('the three on the page are the three on the deal', () => {
  it('come from the one list, so neither side can gain or lose one', () => {
    expect(page).toContain("from '@/lib/milestone-emails'")
    // BOTH LISTS ON THE PAGE ARE DERIVED FROM IT, not typed out.
    //
    // 21 Oct 2026. This used to look for `MILESTONE_TEMPLATES.map(` and stop
    // there, which was the same thing while the page offered every template.
    // One of them is now sent only from its own step - see
    // SENT_FROM_ITS_OWN_STEP - so the page splits the list in two. What matters
    // has not changed: neither side may gain or lose a template by hand, and
    // the split has to be made by the named rule rather than by an id typed
    // into this page.
    expect(page).toContain('MILESTONE_TEMPLATES\n  .filter(t => !SENT_FROM_ITS_OWN_STEP.includes(t.id))')
    expect(page).toContain('MILESTONE_TEMPLATES\n  .filter(t => SENT_FROM_ITS_OWN_STEP.includes(t.id))')
    for (const t of TEMPLATES) {
      if (SENT_FROM_ITS_OWN_STEP.includes(t.id)) continue
      expect(page, `${t.id} has been dropped from the Templates page without a rule`)
        .toContain(`${t.id}:`)
    }
  })

  it('and every one of them has words on the card', () => {
    for (const t of TEMPLATES) {
      expect(page, `${t.id} has no blurb on the Templates page`).toContain(`${t.id}:`)
    }
  })
})

describe('the picker behaves like the strip on the deal', () => {
  it('lists what cannot send yet rather than hiding it', () => {
    expect(door).toContain("item?.state !== 'not_yet'")
    expect(door).toContain('item?.note')
  })

  it('ready first, then sent, then not yet', () => {
    expect(door).toContain("s === 'ready' ? 0 : s === 'sent' ? 1 : 2")
  })

  it('and never offers a test deal as if it were business', () => {
    expect(door).toContain('realDealsOnly(')
  })
})

// --- the deal picker actually loads deals -----------------------------------
//
// 1 Oct 2026. Fabio typed a client's name into the picker and got "No deal
// matches that". The search was fine; the list behind it was empty. The query
// ordered by updated_at, which deals do not have, so Supabase returned an error
// and no rows - and the error was thrown away, so a broken screen and a word
// that matches nothing said exactly the same thing.
describe('the deal picker loads deals, and says so when it cannot', () => {
  it('orders by the column every other deals query uses', () => {
    expect(door).toContain(".order('created_at'")
    expect(door).not.toContain("'updated_at'")
  })

  // THE REAL GUARD. Not "created_at is spelled right" but "this query sorts by
  // a column deals actually have" - the next one somebody invents fails here
  // too. Only the deals queries: a file is free to sort lenders by name.
  //
  // 2 Nov 2026: this used to insist on created_at and nothing else, which was
  // the right rule while every deals query was "the newest ones". Paging broke
  // that honestly. A read narrowed to lodged deals pages in lodged order, and
  // every paged read needs a tiebreak or two rows the database considers equal
  // swap between pages - which skips one and repeats the other. So the rule is
  // now the thing it was always standing in for: a real column off this list,
  // which is short on purpose. See lib/the-whole-book.ts.
  const ORDERABLE = ['created_at', 'id', 'lodged_at', 'settled_at', 'compliance_pack_at']

  it('and no deals query anywhere sorts by a column deals do not have', () => {
    const files = execSync(
      `grep -rl "from('deals')" --include=*.ts --include=*.tsx app lib components`,
      { encoding: 'utf8' },
    ).split('\n').filter(Boolean)
    expect(files.length).toBeGreaterThan(3)
    let checked = 0
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      // Everything from one from('deals') up to the next from(, which is as far
      // as that query's chain can reach.
      for (const chunk of src.split(`from('deals')`).slice(1)) {
        const chain = chunk.split(`from('`)[0]
        // EVERY order in the chain, not just the first: the tiebreak is a sort
        // on deals too, and a tiebreak on a column that does not exist fails
        // exactly the same way the original updated_at did.
        for (const sorted of chain.matchAll(/\.order\('([a-z_]+)'/g)) {
          checked++
          expect(ORDERABLE, `${f} sorts deals by ${sorted[1]}`).toContain(sorted[1])
        }
      }
    }
    expect(checked).toBeGreaterThan(2)
  })

  it('keeps the error instead of swallowing it', () => {
    expect(door).toContain('{ data, error }')
    expect(door).toContain('setLoadError(')
  })

  it('and a failed load does not read as an empty search', () => {
    expect(door).toContain('The deals could not be loaded')
    expect(door).toContain('!loadError && rows.length === 0')
  })
})
