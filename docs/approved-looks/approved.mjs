// THE APPROVED BC LOOK, AS ONE SOURCE.
//
// 3 Oct 2026. Fabio, for the fifth time: "ALWAYS START FROM PREAPPROVED LOOKS".
//
// Every mock before this one was written from scratch, and every one of them
// quietly dropped something he had already signed off - the rail, the mark, the
// stage bar, the split header band, the single email card. Same cause each time:
// I was retyping the agreed thing instead of carrying it.
//
// So the agreed thing lives here, lifted out of bc-mock.mjs - the builder behind
// the mock he approved - and nothing downstream retypes it. A mock imports
// CSS and the blocks it needs. If a block has to change, it changes HERE, once,
// and every mock changes with it.
//
// THE RULE: no mock may contain a copy of anything in this file.
import { readFileSync } from 'fs'
const here = f => readFileSync(new URL(f, import.meta.url), 'utf8')

/** The approved stylesheet, verbatim. Includes the dashed limits block, the
 *  split header band, the green tick, the dark pairs and the off-white panel. */
export const CSS = here('./approved.css')

// ---- the field helpers, exactly as the approved mock draws them -------------
// money boxes shade (BCForm.tsx NumberInput): filled = green edge on white,
// empty or zero = amber edge on #FEFBF5. Nothing else on the form shades.
export const M = (l, v) => `<label>${l}<div class="f money ${v && v !== '$0' ? 'done' : 'todo'}">${v || ''}</div></label>`
export const X = (l, v) => `<label>${l}<div class="f">${v || ''}</div></label>`          // plain text - never shades
export const S = (l, v) => `<label>${l}<div class="f sel">${v}</div></label>`            // select - never shades
export const A = (l, v) => `<label>${l}<div class="ta">${v}</div></label>`

/** A split: white card, grey header band, number in a circle, Remove on the right. */
export const splitCard = (n, label, rows) =>
  `<div class="fs splt"><div class="fh band"><span class="sn2">${n}</span>Split ${n} &mdash; ${label}<span class="rm">Remove</span></div><div class="sb">${rows}</div></div>`

/** The 15 BC templates, exact labels from lib/templates.ts. */
export const TEMPLATES = ['Refinance + equity release','Refinance only','OO purchase','OO purchase &mdash; LVR comparison',
'Investment purchase','Equity release + purchase','Buy / sell','First home buyer','Bridging loan','Family pledge',
'SMSF purchase','Construction loan','Debt recycling','Complex refinance','Custom (all fields)']

export const tplCard = (live = 'Complex refinance') => `<div class="fs"><div class="fh">BC template</div>
 <div class="tpl">${TEMPLATES.map(t => `<span class="tc${t === live ? ' on' : ''}">${t}</span>`).join('')}</div>
</div>`

/** The limits block: DASHED border, page-coloured, sits under the splits. */
export const limitsBlock = rows => `<div class="limwrap"><div class="fh sub">Limit approved against each property</div>
${rows}</div>`

export const limitRow = (addr, drawn, limit, undrawn) =>
 ` <div class="lim">
  <span class="lp">${addr}</span><span class="ld">drawn ${drawn}</span>
  <span class="f money done lf">${limit}</span><span class="lu">${undrawn || ''}</span>
 </div>`

/** One quiet line, not a card edge. */
export const divider = t => `<div class="divide"><span>${t}</span></div>`

/** THE EMAIL HALF IS ONE CARD. Checklist at the top, Notes as a rule inside it,
 *  Generate at the end. Never two cards - that is the thing that keeps getting
 *  lost. */
export const emailCard = ({ checklist, notes }) => `<div class="fs sendcard"><div class="fh">&ldquo;Based on your numbers&rdquo; checklist</div>
${checklist}
 <div class="addrow2"><span class="f addin">Add item...</span><span class="addbtn">Add</span></div>
 <div class="fh sub2">Notes</div>
${notes}
</div>

<div class="genrow"><span class="gen">Generate email</span></div>`

export const checkRow = t => ` <div class="ck3"><span class="tick">&#10003;</span>${t}<span class="rx">&times;</span></div>`

export const notesBlock = (summary, important, sig = 'Robin Clarke', brand = 'Simplify Finance') => `
 ${A('Broker summary notes (included in email)', summary)}
 ${A('Important things to note (included in email, one per line &mdash; pre-filled per template)', important)}
 <div class="g2c">${S('Broker signature', sig)}${S('Brand', brand)}</div>`

// ---- the page the mock is cut into -----------------------------------------
const MASTER = '/home/claude/one-inside-the-deal-v4.html'
const ICONS = {
  calc: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h8"/></svg>',
  chart: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
}

/** Cut a tab body into the approved whole page. Everything outside the panel -
 *  sidebar, mark, header, Client emails, prompt line, stage bar, the six boxes
 *  and the rail - comes from the master untouched. */
export function intoPage({ tab, icon, body, boxName, extraCss = '' }) {
  let s = readFileSync(MASTER, 'utf8')
  s = s.replace('<span class="pt">Fact Find</span>', `<span class="pt">${tab}</span>`)
  s = s.replace(s.slice(s.indexOf('<span class="pi">'), s.indexOf(`</span><span class="pt">${tab}`)),
                '<span class="pi">' + ICONS[icon])
  const a = s.indexOf('<div class="subnav">')
  const b = s.indexOf('<div class="rc chase2"')
  if (a < 0 || b < 0) throw new Error('the master has changed shape - cannot find the panel')
  const tail = s.slice(a, b)
  const gap = tail.slice(tail.lastIndexOf('</div>') + 6)
  s = s.slice(0, a) + body + '\n   </div>' + gap + s.slice(b)

  s = s.replace('<div class="bx on"><div class="ico">', '<div class="bx"><div class="ico">')
  const at = s.indexOf(`<div class="n">${boxName}</div>`)
  if (at < 0) throw new Error(`no box called ${boxName}`)
  const open = s.lastIndexOf('<div class="bx ">', at)
  s = s.slice(0, open) + '<div class="bx on">' + s.slice(open + '<div class="bx ">'.length)

  return s.replace('</style>', CSS + extraCss + '</style>')
}
