import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE CAPTURE HAPPENS AT SETTLEMENT, OR IT IS WORTH VERY LITTLE.
//
// Before 22 Sep 2026 a client's financial position was only ever recorded at
// the compliance push - weeks before the deal was lodged, let alone settled - and
// when a deal was marked lost. Both record the position as the client DECLARED
// it, which by definition does not contain the loan we then wrote for them.
//
// A client book made only of those can never answer "who is with ubank",
// because our own settlements are not in it. That is the whole point of the
// database, so this test guards the moment.

const settlement = readFileSync('app/(app)/deals/[id]/DealSettlement.tsx', 'utf8')
const prompt = readFileSync('components/PositionAtSettlement.tsx', 'utf8')
const rule = readFileSync('lib/client-position.ts', 'utf8')

describe('marking a deal settled asks about the client record', () => {
  it('the settlement screen raises it', () => {
    expect(settlement, 'nothing asks about the client position at settlement')
      .toContain('<PositionAtSettlement')
    expect(settlement, 'it is not tied to the settled stage')
      .toMatch(/stage\.snap === 'settled'[\s\S]{0,60}setAskPosition\(true\)/)
  })

  it('every screen reads the one rule, not its own copy of it', () => {
    expect(prompt).toContain("from '@/lib/client-position'")
    expect(prompt, 'the prompt works out ownership for itself').toContain('positionFor(factFind, a')
  })
})

describe('what the save will and will not do', () => {
  it('it is checked, because a refused write returns no error', () => {
    expect(prompt).toContain('checkedWrite(')
  })

  it('it refuses to leave a client holding nothing', () => {
    expect(prompt).toContain('wouldEmptyTheClient(')
    expect(prompt).toContain('emptyRefusal(')
  })

  it('it writes the history row as well as the snapshot, and checks it', () => {
    // The table has existed since the portal was built and had never been
    // written to once, so its policy has never been exercised. A refusal
    // returns zero rows and no error - invisible on the first settlement and
    // broken for months after.
    expect(prompt, 'no history is kept').toContain("from('client_positions').insert(")
    expect(prompt, 'the history does not say where it came from')
      .toContain("captured_from: 'settlement'")
    expect(prompt, 'the history write is not checked')
      .toMatch(/checkedWrite\(supabase\.from\('client_positions'\)/)
  })

  // Refusing to record a client's position because the history table would not
  // take a copy loses the thing that matters to keep the thing that is nice to
  // have. So it warns and carries on.
  it('a history row that will not write does not lose the position', () => {
    expect(prompt).toContain('historyWarning')
    expect(prompt).toContain('The position itself WAS saved')
  })

  it('it records where the position came from and who saved it', () => {
    expect(prompt).toContain("position_source: 'settlement'")
    expect(prompt).toContain('position_updated_by:')
  })

  it('it tells the person what would change before they answer', () => {
    // A yes/no with nothing behind it is a guess.
    expect(prompt).toMatch(/next\.properties\.length/)
    expect(prompt).toMatch(/next\.unconfirmed > 0/)
  })
})

// TWO MOMENTS. NOT THREE.
//
// Fabio, 23 Sep 2026: "this question only comes out in 2 occasions - we mark the
// deal as lost, meaning we have all updated financials and for whatever reason
// the deal doesn't settle, so assets and liabilities (excluding the new loan)
// should be the new position of the client - OR when the deal settles, meaning
// assets and liabilities are updated WITH the new loan."
//
// Compliance was a third, and the wrong one: weeks before lodgement, figures
// still moving, no loan in existence - and because it ran on every push it was
// the most likely thing to be the newest record on a client.
describe('a client position is recorded at exactly two moments', () => {
  const compliance = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')
  const close = readFileSync('app/(app)/deals/[id]/CloseDeal.tsx', 'utf8')

  it('the compliance push does not ask, and does not write', () => {
    expect(compliance, 'the compliance push is recording positions again')
      .not.toContain('showPositionPrompt')
    expect(compliance, 'compliance writes a client position again')
      .not.toContain('position_updated_at')
  })

  it('closing a deal records it, with no loan on it', () => {
    expect(close).toContain("position_source: 'deal closed'")
    expect(close).toContain("captured_from: 'deal closed'")
  })

  it('closing a deal uses the same rule as settlement, not its own copy', () => {
    expect(close).toContain("from '@/lib/client-position'")
    expect(close).toContain('positionFor(ff, applicant)')
    // The old version filtered ownership by hand with !!ownership[id], which
    // read '0' as ownership and dropped anything nobody had ticked.
    expect(close, 'the close panel is working out ownership for itself again')
      .not.toContain('!!x?.ownership?.[applicant.id]')
  })

  it('closing a deal is checked, and will not empty a client', () => {
    expect(close).toContain('checkedWrite(')
    expect(close).toContain('wouldEmptyTheClient(')
  })
})

describe('the rule it all rests on', () => {
  it('nought per cent is not ownership', () => {
    // '0' is a truthy string in Javascript, so the old `!!ownership[id]` handed
    // the asset to somebody recorded as owning none of it.
    expect(rule).toContain('Number.isFinite(n) && n > 0')
  })

  it('an unassigned item reaches everybody rather than nobody', () => {
    expect(rule).toContain('ownershipConfirmed')
  })

  it('a value is never halved to make a share', () => {
    expect(rule).toMatch(/share: number \| null/)
  })
})
