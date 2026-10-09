// WHAT THE SALE PROCEEDS ARE GOING INTO.
//
// 9 Oct 2026. A buy and sell deal where the clients sell, and then BUILD rather
// than buy an existing dwelling. The sale half is identical; what the money
// lands in is not.
//
// This is an ANSWER ON THE BUY / SELL TEMPLATE, not a template of its own. The
// sale price, the agent fees, the loan being discharged, the net proceeds and
// anything added on top are the same questions either way, and the Deposit box
// is built from them. Changing the template would throw the splits away and ask
// the broker to retype a sale they had already recorded.
//
// The same shape as landFunding in lib/construction.ts, and for the same
// reason: a question inside a scenario that decides which boxes are asked for,
// what the email says, and which arithmetic runs.

export type SaleProceedsUse = 'buy' | 'build'

export const SALE_PROCEEDS_USE: { value: SaleProceedsUse; label: string }[] = [
  { value: 'buy',   label: 'Buying a home' },
  { value: 'build', label: 'Building a home' },
]

const txt = (v: any) => String(v ?? '').trim()

// ANYTHING THAT IS NOT "build" IS A PURCHASE, including a record saved before
// today. Every buy and sell written before this existed was a purchase, so the
// absent answer and the old behaviour are the same thing.
export function saleProceedsUseOf(bc: any): SaleProceedsUse {
  return txt(bc?.saleProceedsUse) === 'build' ? 'build' : 'buy'
}

// A buy and sell whose proceeds are funding a build.
export function isSellAndBuild(bc: any): boolean {
  return txt(bc?.template) === 'buy_sell' && saleProceedsUseOf(bc) === 'build'
}

// IS THERE A BUILD ON THIS DEAL AT ALL. The construction template, or a buy and
// sell that has been answered this way. Everything that used to ask "is the
// template construction" asks this instead, so the two cannot drift apart.
export function buildsSomething(bc: any): boolean {
  return txt(bc?.template) === 'construction' || isSellAndBuild(bc)
}

// THE PRICE OF THE THING BEING BOUGHT - AND NOTHING, ON A BUILD.
//
// A deal switched from buying to building keeps the purchase price it was typed
// with. The box is no longer on screen and the figure is no longer true, but
// blanking what somebody typed because they answered a question is its own kind
// of wrong - they may switch back. So the field stays and the READERS ask here,
// which is the same answer without destroying anything.
export function purchasePriceOf(bc: any): string {
  return isSellAndBuild(bc) ? '' : txt(bc?.purchasePrice)
}
