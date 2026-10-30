import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { brokerToStartWith } from './whose-deal-is-it'

// A DEAL BELONGS TO A BROKER, NOT TO WHOEVER IS SIGNED IN.
//
// 29 Oct 2026. Fabio, on two deals in two days that went out under the wrong
// name: "all deals created are still picking up Mark as the broker and not who
// the broker is when the deal is created, we need to keep changing it."
//
// It was not Mark. The New deal box opened with the CREATOR's own name already
// in it, so Patrick Cleary came out under Fabio because Fabio made it, and the
// Emma White one came out under Mark because Mark did. The fortnight's book
// read 418 fabio, 20 mark, 11 justin - a list of who was signed in.

const PAGE = readFileSync('app/(app)/deals/page.tsx', 'utf8')

describe('WHO THE BOX OPENS ON', () => {
  it('nobody, for an admin', () => {
    // Fabio, Kylie, Alan and Mark make deals that belong to other people.
    expect(brokerToStartWith('admin', 'Fabio')).toBe('')
    expect(brokerToStartWith('admin', 'mark')).toBe('')
  })

  it('and nobody, for staff', () => {
    expect(brokerToStartWith('staff', 'katie')).toBe('')
    expect(brokerToStartWith('staff', null)).toBe('')
  })

  it('BUT A BROKER MAKING THEIR OWN DEAL SEES NO CHANGE', () => {
    // No dropdown is drawn for them at all, and their own name is the answer.
    expect(brokerToStartWith('broker', 'justin')).toBe('justin')
    expect(brokerToStartWith('broker', 'keanen')).toBe('keanen')
  })

  it('and a broker with no key recorded is still asked', () => {
    expect(brokerToStartWith('broker', '')).toBe('')
    expect(brokerToStartWith('broker', null)).toBe('')
  })

  it('and an unknown role is asked, not assumed', () => {
    expect(brokerToStartWith('', 'fabio')).toBe('')
    expect(brokerToStartWith(null, 'fabio')).toBe('')
    expect(brokerToStartWith('Broker', 'fabio'), 'a role is a stored value, not a label').toBe('')
  })
})

describe('AND THE FORM ASKS BEFORE IT WILL CREATE', () => {
  it('Create is held back while nobody has answered', () => {
    // The guard has been there all along. It was never reached, because the
    // box was never empty.
    expect(PAGE).toContain('!deal.assigned_broker')
  })

  it('and the page no longer fills the box with the login', () => {
    expect(PAGE).not.toContain("assigned_broker: brokerKey || ''")
    expect(PAGE).toContain('brokerToStartWith(userRole, brokerKey)')
  })

  it('AND THE DROPDOWN STILL OPENS ON A QUESTION', () => {
    expect(PAGE).toContain('— select broker —')
  })

  it('and a broker is still never shown it', () => {
    expect(PAGE).toContain("userRole !== 'broker' && (")
  })
})
