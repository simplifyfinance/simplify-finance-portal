import { everyRow } from '@/lib/the-whole-book'
import { createSupabaseServer } from '@/lib/supabase-server'
import { realDealsOnly, REAL_DEALS_OR } from '@/lib/test-deal'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import TodayPlan from '@/components/TodayPlan'
import RunThrough from '@/components/RunThrough'
import RateNoticeNag from '@/components/RateNoticeNag'
import ThisWeek from '@/components/ThisWeek'
import DueToLodge from '@/components/DueToLodge'
import { todayYmd } from '@/lib/periods'

export const metadata = { title: 'Today' }

export default async function Dashboard() {
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, broker_key, full_name')
    .eq('id', user.id)
    .single()

  const brokerKey = profile?.broker_key || null

  const { data: creditOfficerRecord } = await supabase
    .from('credit_officers')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()
  const creditOfficerId = creditOfficerRecord?.id || null


  // Who this person can see is decided by the database, not by a list in the code.
  // auth_visible_broker_keys() returns their own broker key plus any they have been
  // granted; auth_sees_all_deals() is the explicit flag. Row level security has
  // already applied both to the query below - this only decides what the screen offers.
  const [{ data: visibleKeys }, { data: seesAll }] = await Promise.all([
    supabase.rpc('auth_visible_broker_keys'),
    supabase.rpc('auth_sees_all_deals'),
  ])
  const keys: string[] = (visibleKeys as string[]) || []
  const hasTeamAccess = !!seesAll || keys.length > 1

  // EVERY DEAL, A PAGE AT A TIME, AND THE TEST DEALS LEFT WHERE THEY ARE.
  // 2 Nov 2026 - this asked once and got the newest thousand of 1165 without
  // being told. See lib/the-whole-book.ts.
  const { rows: rawDeals } = await everyRow<any>((from, to) => supabase
    .from('deals')
    .select('*, clients(first_name, last_name)')
    .or(REAL_DEALS_OR)
    .order('created_at', { ascending: false }).order('id')
    .range(from, to))
  // TEST DEALS ARE NOT THE BUSINESS. One rule, in lib/test-deal.ts, asked by
  // every screen that counts - so the dashboard, the workload page and the
  // settlements list can never disagree about what is in the book.
  const deals = realDealsOnly(rawDeals as any[])

  // Broker names come from the register, never from the key stored on a deal.
  // The key is lower case by design and was being printed straight onto the
  // screen, so every broker read as "fabio" or "kylie".
  const { data: brokerRows } = await supabase.from('brokers').select('broker_key, name, team')
  // WHAT THE BUSINESS IS AIMING AT THIS WEEK. One row, beside the brands.
  const { data: settingsRow } = await supabase.from('settings')
    .select('week_target').eq('id', 'singleton').maybeSingle()
  const weekTarget = (settingsRow as any)?.week_target || null
  const brokerNames: Record<string, string> = {}
  for (const b of (brokerRows || []) as any[]) {
    const k = String(b.broker_key || '').toLowerCase()
    const n = String(b.name || '').trim()
    if (k && n) brokerNames[k] = n
  }

  const allowToggle = !!brokerKey && hasTeamAccess
  const defaultView: 'team' | 'mine' = creditOfficerId ? 'mine' : 'team'

  // TODAY, ABOVE EVERYTHING ELSE ON THIS PAGE.
  //
  // 22 Oct 2026. The morning email the credit team send, in the portal - see
  // components/TodayPlan.tsx. The date comes from the server so three people
  // in three places cannot disagree about which day it is.
  // THE SYDNEY DAY. toISOString() is the UTC day, and this server runs in UTC
  // - so for the first eleven hours of every Australian working day a plan
  // would have been filed against yesterday's date. Same fault as
  // lib/rate-notice.ts on 9 Oct. See todayYmd() in lib/periods.ts.
  const today = todayYmd()
  const [{ data: officerRows }, { data: planRows }] = await Promise.all([
    supabase.from('credit_officers').select('id, name').eq('active', true).order('name'),
    supabase.from('daily_plans').select('officer_id, broker_key, deal_ids, confirmed_at, notes, on_it_now, yesterday_ok_at, informed_at, yesterday_added, yesterday_removed').eq('plan_date', today),
  ])
  const officers = (officerRows || []).map((o: any) => ({ id: o.id, name: o.name }))
  const byOfficer = new Map((planRows || []).map((p: any) => [p.officer_id, p]))
  // One row per assessor whether they have a plan or not - the board is about
  // who HAS NOT, so somebody with no row has to appear on it.
  // AND THE BROKERS' OWN PLANS, which live in the same table keyed by broker
  // rather than by officer - see docs/brokers-plan-their-day.sql. Added 23 Oct
  // 2026, when Fabio opened his own Today page and found it empty.
  const brokerPlans = (planRows || [])
    .filter((p: any) => p.broker_key)
    .map((p: any) => ({
      brokerKey: String(p.broker_key),
      confirmedAt: p.confirmed_at || null,
      dealIds: (p.deal_ids || []) as string[],
      notes: (p.notes || {}) as Record<string, string>,
      onItNow: p.on_it_now || null,
      yesterdayOkAt: p.yesterday_ok_at || null,
      informedAt: p.informed_at || null,
      yesterdayAdded: (p.yesterday_added || []) as any[],
      yesterdayRemoved: (p.yesterday_removed || []) as string[],
    }))

  const plans = officers.map(o => ({
    officerId: o.id,
    officerName: o.name,
    confirmedAt: byOfficer.get(o.id)?.confirmed_at || null,
    deals: (byOfficer.get(o.id)?.deal_ids || []).map((id: string) => ({
      id, name: '', stage: '', since: null,
    })),
    notes: (byOfficer.get(o.id)?.notes || {}) as Record<string, string>,
    onItNow: byOfficer.get(o.id)?.on_it_now || null,
    yesterdayOkAt: byOfficer.get(o.id)?.yesterday_ok_at || null,
    informedAt: byOfficer.get(o.id)?.informed_at || null,
    yesterdayAdded: (byOfficer.get(o.id)?.yesterday_added || []) as any[],
    yesterdayRemoved: (byOfficer.get(o.id)?.yesterday_removed || []) as string[],
  }))

  // WHAT THE ADMIN PAGE NEEDS BESIDE THE MEETING.
  //
  // The credit team's morning, and what settles this week. Both are counted
  // from rows this page already has, so neither can disagree with the credit
  // assessor's own screen or with Settlements.
  const todayWords = new Date(today + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const openFor = (officerId: string) => (deals || []).filter((d: any) =>
    d.assigned_credit_officer === officerId && d.status !== 'lost' && !d.settled_at).length

  const creditToday = officers.map(o => {
    const row: any = byOfficer.get(o.id)
    return {
      name: o.name,
      informedAt: row?.informed_at || null,
      yesterdayCount: Array.isArray(row?.yesterday_added)
        ? (row.yesterday_added as any[]).length : 0,
      todayCount: Array.isArray(row?.deal_ids) ? (row.deal_ids as any[]).length : 0,
      open: openFor(o.id),
    }
  })

  // ONE ASSESSOR CARRYING FAR MORE THAN THE REST, or nobody.
  //
  // Half again the team average is the same threshold the round robin uses
  // when it decides somebody is too loaded to take another file - see
  // lib/allocate-officer.ts. One rule, so the screen and the allocation cannot
  // disagree about who is buried.
  const loads = creditToday.map(t => t.open)
  const average = loads.length
    ? Math.round((loads.reduce((a, b) => a + b, 0) / loads.length) * 10) / 10 : 0
  const worst = creditToday.slice().sort((a, b) => b.open - a.open)[0]
  const overloaded = worst && average > 0 && worst.open > average * 1.5
    ? {
      name: worst.name,
      open: worst.open,
      average,
      unplanned: !worst.informedAt,
    }
    : null

  // THIS WEEK'S SETTLEMENTS, by the date the settlements team confirmed, and
  // only the ones that have not already settled.
  const weekStart = new Date(today + 'T00:00:00')
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const settlingThisWeek = (deals || [])
    .map((d: any) => ({ d, when: d.confirmed_settlement_date || d.expected_settlement_date }))
    .filter(({ d, when }) => {
      if (!when || d.settled_at || d.status === 'lost') return false
      const t = new Date(String(when) + 'T00:00:00').getTime()
      return t >= weekStart.getTime() && t < weekEnd.getTime()
    })
    .sort((a, b) => String(a.when).localeCompare(String(b.when)))
    .slice(0, 6)
    .map(({ d, when }) => ({
      id: d.id as string,
      name: `${d.clients?.last_name || d.deal_name || ''}${d.clients?.first_name ? ', ' + d.clients.first_name[0] : ''}`,
      day: new Date(String(when) + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' }),
      amount: Number(d.loan_amount) || 0,
    }))

  return (
    <>
    <div className="px-6 pt-6">
      {/* ON EVERY TODAY PAGE, NOT INSIDE ONE PANEL.
        *
        * 12 Nov 2026. It lived inside DashboardClient, which stopped rendering
        * for admin when Today was rebuilt - so the one person who acts on an
        * overdue rate review would have been the one person who stopped seeing
        * it. It is only ever on screen when a notice has outstayed its review
        * date, so it is not furniture anywhere. */}
      <RateNoticeNag />
      {/* ADMIN'S TODAY IS THREE THINGS AND NOTHING ELSE.
        *
        * 12 Nov 2026. Fabio, looking at his own page after the first attempt:
        * "all this stuff, live deals, all the fucking stuff that I told you to
        * get out... Why there's so many fucking good mornings?"
        *
        * He had already said it and I left them on. What he asked for is the
        * meeting, the week's target and the team - components/RunThrough.tsx.
        *
        * SO FOR WHOEVER SEES ALL DEALS, THESE DO NOT RENDER AT ALL:
        *   This week          what lodged and settled - that is Lodged and settled
        *   Due to lodge       replaced by the run-through, which IS this as a meeting
        *   DashboardClient    the second greeting, Deals by broker, Needs your
        *                      action, the five stage tiles and Recent deals
        *
        * A broker's page keeps them until the broker view is designed; a credit
        * assessor never had them. */}
      {!creditOfficerId && !seesAll && <ThisWeek deals={deals || []} />}
      {!creditOfficerId && !seesAll && (
        <DueToLodge deals={deals || []} brokerNames={brokerNames} canSet={!!seesAll} />
      )}
      {/* THE MONDAY MEETING, AND IT IS THE WHOLE ADMIN PAGE.
        *
        * 12 Nov 2026. Fabio, on what Today is for from an admin seat: "we go
        * one by one on the deals sitting there... Right now is an Excel
        * spreadsheet. I want that gone." And, on the first attempt, which left
        * every old panel in place above it: "look at the difference come on".
        *
        * So for whoever sees all deals this is the page - the greeting, the
        * week's bar, the run-through, the other group, and the credit team
        * beside it. TodayPlan does not render at all: its own day card is a
        * credit assessor's and a broker's, and every admin panel it used to
        * carry has been taken off. */}
      {seesAll ? (
        <RunThrough
          deals={deals || []}
          brokerNames={brokerNames}
          brokerRows={(brokerRows || []) as any[]}
          target={weekTarget}
          canSetTarget
          meName={profile?.full_name || ''}
          todayWords={todayWords}
          team={creditToday}
          settling={settlingThisWeek}
          overloaded={overloaded}
        />
      ) : (
      <TodayPlan
        deals={deals || []}
        officers={officers}
        plans={plans}
        brokerPlans={brokerPlans}
        meOfficerId={creditOfficerId}
        meName={profile?.full_name || ''}
        today={today}
        seesAll={!!seesAll}
        brokerKey={brokerKey}
        brokerNames={brokerNames}
      />
      )}
    </div>
    {!seesAll && (
      <DashboardClient
        deals={deals || []}
        fullName={profile?.full_name || null}
        brokerKey={brokerKey}
        creditOfficerId={creditOfficerId}
        allowToggle={allowToggle}
        defaultView={defaultView}
        brokerNames={brokerNames}
      />
    )}
    </>
  )
}
