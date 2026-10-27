// THE SENDER IS THE DEAL'S BROKER, AND THE STAGE OWNER MOVES WITH A REASSIGN.
//
// 27 Oct 2026, both off one screenshot from Fabio:
//
//   "When you are the broker the system is picking Marks email
//    signature....thats come through on two deals"
//   "Also Mel was assigned but it says Katie is doing this"
//
// Two faults, and neither was what it looked like.
//
// THE SIGNATURE was not wrong on the deal. Both deals had Fabio saved. The
// milestone email screen remembered the last person you sent as, in
// localStorage, and never looked at whose deal it was - so one choice, made
// once, signed every milestone email after it. It looked like two faults
// because it is one browser setting applied to every deal.
//
// THE CREDIT NAME was two columns and only one of them moved. A deal has an
// officer (assigned_credit_officer) and each stage has its own owner
// (bc_owner_officer, added 23 Oct so work can be credited to whoever did it).
// Reassigning wrote the first and left the second, so the row under the BC
// kept saying Katie for good.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const SENDER = readFileSync('app/(app)/templates/useSender.ts', 'utf8')
const SCREEN = readFileSync('components/MilestoneEmails.tsx', 'utf8')
const REASSIGN = readFileSync('app/api/reassign-credit-officer/route.ts', 'utf8')

const codeOnly = (src: string) =>
  src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('a client email signs as the broker on the deal', () => {
  it('the screen tells the sender whose deal it is', () => {
    expect(SCREEN).toContain("useSender('sf_milestone_sender_v1', deal?.assigned_broker)")
  })

  it('and the deal beats what the browser remembered', () => {
    expect(SENDER).toContain('if (wanted) { setBrokerKey(wanted); setLoaded(true); return }')
  })

  it('a key and a full name are the same broker', () => {
    // Deals store "fabio"; the list stores "Fabio de Castro". One of the two
    // deals in the screenshot had each. Both must resolve to the same person.
    expect(SENDER).toContain("import { brokerKey as brokerKeyOf } from '@/lib/broker-key'")
    expect(SENDER).toContain('brokerKeyOf(preferBrokerKey)')
  })

  it('and choosing somebody else on a deal does NOT become the next default', () => {
    // This is the fault, worn differently. One choice must not follow you
    // onto every other deal.
    const save = SENDER.slice(SENDER.indexOf('window.localStorage.setItem') - 400,
                              SENDER.indexOf('window.localStorage.setItem'))
    expect(save).toContain('if (wanted) return')
  })

  it('nor does "whoever is first in the list"', () => {
    expect(SENDER).toContain('if (brokerKey || wanted) return')
  })

  it('but the templates screens still remember, because there is no deal there', () => {
    // Picking who is writing is the whole job on those screens.
    expect(SENDER).toContain('export function useSender(storageKey: string, preferBrokerKey?: string)')
    expect(codeOnly(SENDER)).toContain('window.localStorage.setItem(storageKey')
  })
})

describe('reassigning credit moves the stage they are doing', () => {
  it('it writes the per-stage owner, not just the deal', () => {
    expect(REASSIGN).toContain("import { STAGES, ownerOf, handOver, stageIsDone } from '@/lib/who-did-this-stage'")
    expect(REASSIGN).toContain('Object.assign(patch, handOver(stage,')
  })

  it('a finished stage keeps whoever did it', () => {
    // The whole reason per-stage owners exist. A BC Katie wrote is Katie's
    // work however the deal moves afterwards, and the workload numbers are
    // built on exactly that.
    expect(REASSIGN).toContain('if (stageIsDone(deal, stage)) continue')
  })

  it('and a stage a broker is doing themselves is left alone', () => {
    // Reassigning credit does not take work off a broker.
    expect(REASSIGN).toContain('const heldByThePreviousOne = owner?.officerId && owner.officerId === previousOfficerId')
    expect(REASSIGN).toContain('if (owner && !heldByThePreviousOne) continue')
  })

  it('the deal is read whole, because the rule needs the whole ladder', () => {
    expect(REASSIGN).toContain(".select('*, clients(first_name, last_name)')")
  })
})
