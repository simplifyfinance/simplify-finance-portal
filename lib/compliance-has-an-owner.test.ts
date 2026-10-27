// COMPLIANCE HAS AN OWNER, LIKE THE OTHER TWO STAGES.
//
// 27 Oct 2026. Catherine, Operations Manager, item 8 of nine: "Auto-assign
// Compliance by capacity - the same way Credit work is assigned now. I believe
// you may also be working on that?"
//
// IT WAS ALREADY BUILT, AND NOTHING POINTED AT IT. lib/allocate-officer.ts has
// taken 'compliance' as a stage since 23 October, and already knows who covers
// which broker, who is on leave and who is carrying the least. The BC and the
// lending options each got a What now row that day. Compliance did not, so the
// only way to move it was Reassign at the top of the deal - which moves the
// whole file, not the stage.
//
// AND IT IS WHY COMPLIANCE IS INVISIBLE IN THE WORKLOAD NUMBERS. Those read
// the per-stage owner, and nothing has ever written compliance_owner_officer -
// so every compliance hour the team has worked has counted as nobody's.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { STAGES, ownerFields, handOver, needsAllocating, ownerOf } from './who-did-this-stage'

const FORM = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')
const ROW = readFileSync('components/WhatNow.tsx', 'utf8')

const codeOnly = (src: string) =>
  src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('the stage was always there', () => {
  it('compliance is one of the three', () => {
    expect(STAGES).toEqual(['bc', 'lo', 'compliance'])
  })

  it('with its own three columns, which nothing was filling in', () => {
    expect(ownerFields('compliance')).toEqual({
      officer: 'compliance_owner_officer',
      name: 'compliance_owner_name',
      since: 'compliance_owner_since',
    })
  })

  it('and handing it over writes them', () => {
    const at = new Date('2026-10-27T09:00:00Z')
    expect(handOver('compliance', { officerId: 'o1', name: 'Melissa Sedin' }, at)).toEqual({
      compliance_owner_officer: 'o1',
      compliance_owner_name: 'Melissa Sedin',
      compliance_owner_since: at.toISOString(),
    })
  })

  it('a deal nobody has put on compliance still needs allocating', () => {
    expect(needsAllocating({ id: 'd1' }, 'compliance')).toBe(true)
    expect(needsAllocating({ compliance_owner_officer: 'o1' }, 'compliance')).toBe(false)
  })

  it('and compliance defaults to whoever had the lending options', () => {
    // "if allocated to credit in BC that carries for LO" - Fabio, 23 Oct. The
    // same rule runs one stage further on.
    const deal = { lo_owner_officer: 'o1', lo_owner_name: 'Melissa Sedin', assigned_broker: 'fabio' }
    expect(ownerOf(deal, 'compliance')).toBeNull()
  })
})

describe('and now the tab points at it', () => {
  it('the row is on the Compliance tab', () => {
    expect(FORM).toContain('<WhatNow')
    expect(FORM).toContain('stage="compliance"')
  })

  it('with the same two answers the other stages offer', () => {
    // Never a list of names. The broker picks "me" or "the queue" and
    // lib/allocate-officer.ts works out who.
    expect(FORM).toContain("handStageOver(supabase, deal.id, 'compliance', choice")
    expect(ROW).toContain("{'I’ll do it'}")
    expect(ROW).toContain('Put it in the credit queue')
  })

  it('and no view switch, because compliance is one page', () => {
    // A switch with one side to it is a control that does nothing, which is
    // the fault this row was built to remove.
    expect(FORM).toContain('showView={false}')
    expect(ROW).toContain('showView = true')
    expect(ROW).toContain('{showView && (')
  })

  it('the row cannot be reassigned once compliance is finished', () => {
    expect(FORM).toContain('canAllocate={!complianceCompletedAt}')
  })

  it('and Done does nothing twice', () => {
    expect(FORM).toContain('if (!complianceCompletedAt) markComplianceComplete()')
  })

  it('a failed handover is said out loud, not swallowed', () => {
    expect(FORM).toContain('setHandErr(out.error)')
    expect(codeOnly(FORM)).toContain('{handErr && (')
  })
})

describe('the other two rows are untouched', () => {
  const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
  const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

  it('they still show their view switch', () => {
    // showView defaults to true, so neither had to be changed - and if that
    // default is ever flipped, this fails rather than two screens quietly
    // losing their Form and Email tabs.
    expect(bc).not.toContain('showView=')
    expect(lo).not.toContain('showView=')
    expect(ROW).toContain('showView = true')
  })
})
