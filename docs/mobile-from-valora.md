# How the ONE by Valora mobile version was built

A precise brief for reproducing the same mobile layout in another portal.
Source: commit `9b9b07f` — "Mobile shell: collapsing rail, record cards, stage tabs" (16 files, +465 / −84).

Stack: Next.js 15 (app router), React 19, Tailwind v4. Nothing else was installed: no UI library, no new dependencies.

---

## The rule that governs everything

**Desktop must stay pixel-identical.** Every mobile change is added *below* a breakpoint. Nothing above it is touched.

- `lg` (1024px) is the breakpoint for the **navigation** and the **pipeline board**
- `sm` (640px) is the breakpoint for **tables** and **page gutters**
- No component is duplicated. The same Sidebar renders in both places, and the same deal card renders in both board layouts.

There is no separate mobile site, no user-agent sniffing and no `useMediaQuery`. Everything is Tailwind responsive classes, so the server renders one HTML page and CSS decides what shows.

Viewport: Next.js adds `<meta name="viewport" content="width=device-width, initial-scale=1">` by default. Nothing was added. If your portal is not Next, check that tag exists first, or nothing below will work.

---

## Part 1 — The shell: the sidebar becomes a top bar and slide-over

### 1a. New file `components/Shell.tsx` (client component)

It replaces the old `<Sidebar/> + <main/>` flex wrapper in the signed-in layout.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import OneMark, { MARK_WIDTH } from '@/components/OneMark'   // ← your logo component
import type { SessionUser } from '@/lib/auth'

function initials(name: string | null, email: string) {
  const source = (name ?? email).trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || source.slice(0, 2).toUpperCase()
}

export default function Shell({
  user, signOutAction, children,
}: {
  user: SessionUser
  signOutAction: () => Promise<void>
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Tapping a nav link must land you on the page, not behind an open menu.
  useEffect(() => setOpen(false), [pathname])

  // Escape closes the menu; the page behind must not scroll under the overlay.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <div className="flex min-h-screen items-stretch">
      {/* Desktop: the permanent rail, unchanged */}
      <div className="hidden lg:block">
        <Sidebar user={user} signOutAction={signOutAction} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone and tablet: the rail becomes a sticky top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-rail px-4 py-2.5 text-paper lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            className="-ml-1 shrink-0 rounded-sm p-1 text-white"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path d="M3.5 6.5h15M3.5 11h15M3.5 15.5h15"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <OneMark width={MARK_WIDTH.loading} tone="dark" />

          <span className="ml-auto flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full bg-wine-soft text-[10px] font-bold text-wine">
            {initials(user.fullName, user.email)}
          </span>
        </header>

        {/* The slide-over: a dimmed backdrop plus the SAME Sidebar */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button aria-label="Close navigation" onClick={() => setOpen(false)}
                    className="absolute inset-0 bg-ink/45" />
            <div className="absolute inset-y-0 left-0 w-[min(260px,78%)] shadow-[8px_0_28px_rgba(0,0,0,.25)]">
              <Sidebar user={user} signOutAction={signOutAction} />
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
```

**Why the hamburger is an SVG:** the first version used three `<span>`s at `h-[1.8px]`. Fractional heights can round to zero on some screens, so the button existed but was invisible. A stroked SVG cannot disappear that way. Do not use divs for the hamburger.

### 1b. Change the signed-in layout (`app/(app)/layout.tsx`)

```diff
-import Sidebar from '@/components/Sidebar'
+import Shell from '@/components/Shell'
 ...
-    <div className="flex min-h-screen items-stretch">
-      <Sidebar user={user} signOutAction={signOut} />
-      <div className="min-w-0 flex-1">{children}</div>
-    </div>
+    <Shell user={user} signOutAction={signOut}>
+      {children}
+    </Shell>
```

The layout stays a **server** component. It resolves the user server-side and passes it down. Only `Shell` is `'use client'`.

### 1c. One-line change to `components/Sidebar.tsx`

The rail had its width, stickiness and height hard-coded. Those move behind `lg:`, so the same component fills the slide-over panel on mobile:

```diff
-<nav className="w-[232px] shrink-0 bg-rail flex flex-col gap-5 py-6 sticky top-0 h-screen overflow-y-auto">
+<nav className="flex h-full w-full shrink-0 flex-col gap-5 overflow-y-auto bg-rail py-6 lg:sticky lg:top-0 lg:h-screen lg:w-[232px]">
```

That is the only change to the Sidebar.

---

## Part 2 — Page gutters

Every page section used `mx-8` (32px each side). On a 390px phone that wastes 16% of the width. Find and replace across all pages:

| Before | After |
|---|---|
| `mx-8` on section cards, error banners, empty states | `mx-4 sm:mx-8` |
| `px-8` on the board wrapper | `px-4 sm:px-8` |

And in `components/PageHeader.tsx`:

```diff
-<header className="flex flex-wrap items-end gap-4 px-8 pt-7 pb-5">
+<header className="flex flex-wrap items-end gap-4 px-4 pt-6 pb-5 sm:px-8 sm:pt-7">
```

`flex-wrap` was already there, so the action buttons drop under the title on narrow screens without any extra work.

Files touched in this sweep: dashboard, deal page, DealFacts, Securities, StageBar, new deal, pipeline, partners, partner detail, users, PageHeader.

---

## Part 3 — Tables become stacked record cards

A six-column table does not fit on a 400px screen. Squeezing the columns turns every cell into a two-character sliver, and side-scrolling to read someone's name makes the portal feel broken. So below `sm` the same data renders as cards. **No field is dropped.**

### 3a. New file `components/Record.tsx` (server-safe, no `'use client'`)

```tsx
export function RecordList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5 px-4 py-4 sm:hidden">{children}</div>
}

export function Record({
  title, subtitle, badge, fields, footer,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** The one thing that must stay beside the name, e.g. Valora / Partner */
  badge?: React.ReactNode
  fields?: { label: string; value: React.ReactNode }[]
  footer?: React.ReactNode
}) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-sm border border-line bg-surface px-3.5 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13.5px] font-bold">{title}</p>
          {subtitle && <p className="break-words text-[11.5px] text-ink-3">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {fields && fields.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-2">
          {fields.map((f) => (
            <div key={f.label} className="flex min-w-0 gap-1.5">
              <dt className="font-semibold text-ink-3">{f.label}</dt>
              <dd className="m-0 min-w-0">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {footer && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line-2 pt-2.5">{footer}</div>
      )}
    </article>
  )
}
```

The card's hierarchy: **name leads → identifying detail under it → badge pinned right → remaining columns as labelled pairs → status and action share a footer.**

### 3b. How each table was converted (the same three steps every time)

1. Hide the table below `sm`:
   - if the table is wrapped in a div: `overflow-x-auto` → `hidden overflow-x-auto sm:block`
   - if the table is bare: `<table className="w-full ...">` → `<table className="hidden w-full ... sm:table">`
2. Directly after it, render `<RecordList>` mapping over **the same rows array**, with the same links and the same formatting helpers.
3. Repeat the empty state inside `RecordList`, because the table's empty row is hidden too.

Example, Users page:

```tsx
<RecordList>
  {(users ?? []).map((u: any) => (
    <Record
      key={u.id}
      title={u.full_name ?? u.email}
      subtitle={u.full_name ? u.email : undefined}
      badge={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold ...">
               {u.scope === 'valora' ? 'Valora' : 'Partner'}
             </span>}
      fields={[
        { label: 'Role', value: u.role },
        { label: 'Firm', value: u.partners?.trading_name ?? '—' },
      ]}
      footer={<>
        <StatusCell status={statusFor(u)} />
        <div className="ml-auto"><ReinviteButton ... /></div>
      </>}
    />
  ))}
  {(users ?? []).length === 0 && (
    <p className="py-8 text-center text-[13px] text-ink-3">Nobody yet. Invite your first person above.</p>
  )}
</RecordList>
```

The three tables converted were Users, Partners (firm list) and Partner detail (files introduced). Apply the same pattern to every table in your portal.

---

## Part 4 — Pipeline board becomes stage tabs

Nine side-scrolling kanban columns work with a mouse and fail with a thumb, because you can't see where you are. Below `lg` the columns become tabs, and one stage shows at a time.

### 4a. Extract the deal card into one component

The card markup was inline inside the column `.map()`. It was lifted into a local `Card` component in `pipeline/page.tsx`, so **both** layouts render the identical card. Do this first.

### 4b. New file `app/(app)/pipeline/StageTabs.tsx` (client component)

```tsx
'use client'
import { useState } from 'react'

export default function StageTabs({
  stages,
}: {
  stages: { key: string; label: string; count: number; amount: string; cards: React.ReactNode }[]
}) {
  // Open on the first stage that has work in it, not on an empty "Enquiry".
  const [active, setActive] = useState(() => {
    const first = stages.findIndex((s) => s.count > 0)
    return first === -1 ? 0 : first
  })
  const current = stages[active]

  return (
    <div className="flex flex-col gap-3 px-4 pb-2 lg:hidden">
      <div role="tablist" aria-label="Pipeline stages"
           className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {stages.map((s, i) => (
          <button key={s.key} role="tab" aria-selected={i === active} onClick={() => setActive(i)}
            className={[
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold',
              i === active ? 'border-wine bg-wine text-white' : 'border-line bg-surface text-ink-3',
            ].join(' ')}>
            {s.label}
            <span className={i === active ? 'money opacity-80' : 'money text-ink-3'}>{s.count}</span>
          </button>
        ))}
      </div>

      {current && (
        <>
          <header className="flex items-baseline gap-2">
            <h2 className="text-[13px] font-bold">{current.label}</h2>
            <span className="money text-[11.5px] text-ink-3">{current.count}</span>
            {current.count > 0 && (
              <span className="money ml-auto text-[11.5px] text-ink-3">{current.amount}</span>
            )}
          </header>
          <div className="flex flex-col gap-2.5">
            {current.count > 0 ? current.cards : (
              <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-[12px] text-ink-3">
                Nothing at this stage
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

Design decisions to keep:
- **Every tab shows its count**, so you can still see where work has piled up while viewing one column. That is the whole point of a board.
- **It opens on the first non-empty stage.** A board that opens on an empty column looks broken.
- The tab row bleeds to the screen edge (`-mx-4 px-4`) and scrolls sideways. Only the pills scroll, never the page.

### 4c. Wire it into the server page

The server page computes the stages and passes **already-rendered cards** as `ReactNode`. The client component never fetches anything.

```tsx
<>
  <StageTabs
    stages={LIVE.map((stage) => {
      const inStage = live.filter((d: any) => d.stage === stage.key)
      const cents = inStage.reduce((t: number, d: any) => t + (d.facility_limit_cents ?? 0), 0)
      return {
        key: stage.key,
        label: stage.label,
        count: inStage.length,
        amount: formatMoney(cents),
        cards: inStage.map((d: any) => <Card key={d.id} d={d} />),
      }
    })}
  />

  {/* Desktop board, unchanged apart from the visibility classes */}
  <div className="mb-6 hidden overflow-x-auto px-4 pb-2 sm:px-8 lg:block">
    ... existing columns, now rendering <Card d={d} /> ...
  </div>
</>
```

---

## Part 5 — Things that were not changed (deliberately)

- The deal page's **stage bar** already had `overflow-x-auto`, so it scrolls sideways on its own. Only its gutter changed.
- **Forms** were not restructured. Their grids already collapse because they use `grid-cols-1 sm:grid-cols-2`-style classes. Check yours. Any fixed `grid-cols-3` without a breakpoint prefix needs one.
- **Client-facing documents** (term sheets, the PDFs) are print layouts and are not part of the responsive shell.

---

## Checklist to reproduce in another portal

1. Confirm the viewport meta tag exists.
2. Create `Shell.tsx`, swap it into the signed-in layout, and move the Sidebar's width, sticky and height classes behind `lg:`.
3. Sweep every page: `mx-8` → `mx-4 sm:mx-8`, `px-8` → `px-4 sm:px-8`, plus the page header.
4. Create `Record.tsx`. For every table: hide it below `sm`, add a `RecordList` over the same rows, and repeat the empty state.
5. If there's a kanban board: extract the card, add `StageTabs`, and hide the board below `lg`.
6. Check every form grid has a `sm:` or `md:` prefix on its column count.
7. Test at **390px** (iPhone), **768px** (iPad portrait) and **1280px** (desktop). Desktop must look exactly as it did before.
8. Run `npm run build` before pushing. A `'use client'` component that imports server-only code fails only at build time, not in `tsc`.

## Adapting to another portal

- Class names such as `bg-rail`, `text-wine`, `bg-wine-soft`, `border-line`, `text-ink-3`, `rounded-card`, `card-shadow` and `money` are **this portal's Tailwind theme tokens**. Map them to the other portal's tokens. The structure and breakpoints are what matter.
- `OneMark` is this portal's logo component. Substitute the other portal's own logo.
- `SessionUser` needs `fullName` and `email` for the initials badge.
