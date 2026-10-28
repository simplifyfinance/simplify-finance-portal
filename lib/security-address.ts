import { securitiesOf } from './box-security'
import { andList } from './and-list'

// WHAT THIS LOAN IS SECURED AGAINST, IN WORDS, FROM WHEREVER IT IS RECORDED.
//
// 28 Oct 2026, on Nader Gharsa's file. The broker notes went to the compliance
// team saying "Security address: Not recorded". The address was recorded - on
// the fact find, against the property, which is where the broker had put it and
// where the Simplify One portal shows it.
//
// The document was reading one box: compliance_data.securityAddress. One fact,
// two homes, and each document looking in only one of them.
//
// "NOT RECORDED" HAS TO MEAN NOT RECORDED. A document that prints it over
// something the portal knows is worse than one that prints nothing: it sends a
// file back for data that is already there, and it teaches everybody reading it
// that the warning is noise. The next time it is real, nobody looks.
//
// SO THE TYPED BOX STILL WINS. Somebody typing an address into Compliance is
// answering this question directly, and a deal can be secured against something
// that is not on the fact find at all. Only when nothing has been typed does
// this fall back to what the fact find already knows - the same securities the
// compliance pack and the deal structure count, from lib/box-security.ts, so
// three documents cannot name three different properties.

const txt = (v: any) => String(v ?? '').trim()

/**
 * The security address for a document to print, or '' when there genuinely
 * isn't one. Several securities are named together rather than reduced to the
 * first, because a pack naming one of three properties is wrong in a way that
 * reads as right.
 */
export function securityAddressOf(deal: any): string {
  const typed = txt(deal?.compliance_data?.securityAddress)
  if (typed) return typed

  const found = securitiesOf(deal)
    .map(s => txt(s.address))
    .filter(Boolean)
  // The same property can arrive twice - once ticked on the BC, once inferred
  // from a refinancing loan against it - and naming it twice reads as two.
  const unique = [...new Set(found)]
  return unique.length ? andList(unique) : ''
}
