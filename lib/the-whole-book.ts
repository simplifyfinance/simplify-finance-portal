// THE WHOLE BOOK, NOT THE FIRST THOUSAND OF IT.
//
// 2 Nov 2026. Fabio: "can you help me find deal cards for andrew leigh and
// sangeeta gudigar I dont seem to be able to locate it but they were there
// yesterday."
//
// They were. Both deals are in the database, both assigned to him, neither
// deleted. The deals screen asked for every deal at once, newest first, and
// the database answered with the newest thousand and said nothing about the
// rest. 1165 deals, so the oldest 165 never arrived - and the search found
// nothing because a search can only search what was fetched.
//
// 241 of those deals are real. He could see 92.
//
// A LIMIT THAT SAYS NOTHING IS THE DANGEROUS KIND. This board exists because
// nine deals once sat hidden in a state the portal refused to show, and every
// rule on it since - a filter is never quiet, a folded column still counts -
// comes from that. A silent row cap is the same failure wearing a server's
// clothes.
//
// SO EVERY ROW IS ASKED FOR, A PAGE AT A TIME, UNTIL A PAGE COMES BACK EMPTY.
//
// Not "until a short page", which is the obvious version and is wrong: the cap
// is the server's and we do not know it. Ask for a thousand on a server that
// caps at a hundred and the first page looks short, so the obvious version
// stops at a hundred rows and is quieter than the bug it replaces. Advancing by
// what actually came back, and stopping only on nothing, is right at any cap.

export const ASK = 1000

// A hard stop, so a server that somehow never returns an empty page cannot spin
// this forever. Twenty thousand is far past anything this business has; if it
// is ever hit, `truncated` says so rather than a screen quietly going short.
export const STOP_AT = 20000

export type Page<T> = { data: T[] | null; error: any }

export type Book<T> = {
  rows: T[]
  error: any
  // True when the rows are NOT the whole book: a failed page, or the hard stop.
  // Every caller has to be able to tell "nothing is there" from "I do not know".
  truncated: boolean
}

// THE ORDER MATTERS AND IT HAS TO BE A TOTAL ONE. Paging walks an ordered list
// by position, so two rows the database considers equal may swap between one
// page and the next - which skips one and repeats the other. Every caller
// orders by something unique, or by created_at AND id.
export async function everyRow<T>(
  page: (from: number, to: number) => PromiseLike<Page<T>>,
  stopAt = STOP_AT,
): Promise<Book<T>> {
  const rows: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await page(from, from + ASK - 1)
    // A FAILED PAGE IS NOT THE END OF THE BOOK. Returning what we have as if it
    // were complete is how 92 deals came to look like all of them.
    if (error) return { rows, error, truncated: true }
    const got = data || []
    rows.push(...got)
    if (got.length === 0) return { rows, error: null, truncated: false }
    from += got.length
    if (rows.length >= stopAt) return { rows, error: null, truncated: true }
  }
}
