import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { can } from './permissions'

// REASSIGNING A BROKER, WHERE SOMEBODY WOULD LOOK FOR IT.
//
// 17 Sep 2026, Fabio: "need to be able to edit and reassign broker on the deal
// card." It was already possible - on the BC or LO tab, under Preview & share,
// at the bottom of the email preview. Meanwhile the deal card header showed
// Broker and Credit officer next to each other, and only one of them could be
// changed.

const header = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
const control = readFileSync('app/(app)/deals/[id]/BrokerAssignment.tsx', 'utf8')
const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

describe('the deal card header', () => {
  it('carries the control, not a label', () => {
    expect(header).toMatch(/<BrokerAssignment[^>]*chip/)
    expect(header, 'the header is printing the broker as plain text again')
      .not.toMatch(/uppercase text-\[#A29889\]">Broker<\/span>/)
  })

  it('hands it the live deal, so a reassignment shows without a reload', () => {
    expect(header).toMatch(/currentBroker=\{dealData\.assigned_broker\}/)
  })

  it('sits beside the credit officer, which already worked this way', () => {
    expect(header).toMatch(/<CreditOfficerAssignment/)
  })
})

describe('one control, not three', () => {
  it('BC no longer carries its own copy', () => {
    expect(bc).not.toMatch(/<BrokerAssignment/)
    expect(bc).not.toMatch(/import BrokerAssignment/)
  })

  it('LO no longer carries its own copy', () => {
    expect(lo).not.toMatch(/<BrokerAssignment/)
    expect(lo).not.toMatch(/import BrokerAssignment/)
  })
})

describe('the control itself', () => {
  it('has a header form and keeps the old one', () => {
    expect(control).toMatch(/chip\?: boolean/)
    expect(control).toMatch(/Reassign</)
  })

  it('still writes through the route that records who moved it', () => {
    expect(control).toMatch(/\/api\/reassign-broker/)
  })

  it('shows the name from the register, never the stored key', () => {
    expect(control).toMatch(/nameFor\(assignedBroker\)/)
  })

  it('never offers the broker who is already on it', () => {
    expect(control).toMatch(/filter\(b => !sameBroker\(b\.key, assignedBroker\)\)/)
  })
})

describe('who may do it is unchanged', () => {
  // Fabio, 9 Sep 2026: "can you allow all team members to reassign deals."
  it('admin, broker and staff can all reassign', () => {
    for (const role of ['admin', 'broker', 'staff']) expect(can(role, 'reassignDeals')).toBe(true)
  })

  it('and a credit officer still cannot', () => {
    expect(can('credit_officer', 'reassignDeals')).toBe(false)
  })
})
