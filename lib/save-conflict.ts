// TWO PEOPLE, ONE DEAL, ONE BLOB.
//
// All four forms on a deal - BC, Fact Find, Lending options, Compliance -
// autosave the WHOLE jsonb column a moment after any keystroke. With two people
// on the same deal that is last-write-wins on a shared document:
//
//   Katie fills in the rates            her browser writes lo_data
//   Fabio types anything at all         his browser writes lo_data, loaded
//                                       before those rates existed
//   the rates are gone                  no error, nothing on screen
//
// Fabio, 4 Sep 2026: "Katie put all the rates and repayments in but when it came
// to me some of the boxes were blank - so I had to do it again."
//
// The guard is the same on every tab, so it lives here rather than being written
// out four times. Before a write, check the column is still the one this form
// loaded. If it is not, DO NOT WRITE. Refusing to save is the safe failure;
// overwriting somebody's afternoon without telling them is not.
//
// WHAT THIS IS NOT. There is a window of milliseconds between the read and the
// write where a save could still land underneath. Closing it properly needs a
// version column and a conditional update. This turns a certainty into a rarity,
// which is worth having today - it is not a guarantee, and should not be
// described as one.

export type DealColumn = 'bc_data' | 'fact_find_data' | 'lo_data' | 'compliance_data'

// What this form believes the database holds. Compared like with like: the raw
// stored value, before any defaults the form applies on load.
export function snapshot(value: any): string {
  return JSON.stringify(value ?? null)
}

export async function someoneElseSaved(
  supabase: any,
  dealId: string,
  column: DealColumn,
  lastSeen: string | null,
): Promise<boolean> {
  // Nothing loaded yet, so there is nothing to conflict with.
  if (lastSeen === null) return false
  const { data, error } = await supabase.from('deals').select(column).eq('id', dealId).single()
  // A failed read is not evidence of a conflict. Let the write proceed and let
  // the write's own error handling deal with it - a form that silently stops
  // saving because the network hiccuped is worse than the problem.
  if (error) return false
  return snapshot(data?.[column]) !== lastSeen
}

// What the banner says. One wording, so all four tabs say the same thing.
export function conflictMessage(tab: string): { title: string; body: string } {
  return {
    title: `Somebody else has saved this ${tab} while you had it open`,
    body: 'Your screen is out of date, so nothing you have typed since has been saved — saving it would '
        + 'wipe out whatever they just entered. Reload to pick up their version. Anything you typed in the '
        + 'last few minutes will need typing again, so copy it somewhere first if you need it.',
  }
}
