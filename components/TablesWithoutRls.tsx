// THE PORTAL CHECKS ITS OWN LOCKS.
//
// 18 Nov 2026. Supabase emailed to say a table was publicly accessible. It was
// public.clients_backup_2026_11_12 - every client's name, email and phone,
// copied by hand before a bulk change on 12 November, and open to anyone with
// the project URL for six days.
//
// Nobody switched security off. A table made with "create table ... as select *
// from clients" inherits nothing: not the policies, not the row level security,
// not the grants. It is born open, because that is Postgres's default.
//
// WHY THIS IS A BAND AND NOT A SCHEDULED JOB. Fabio already had an audit on a
// schedule: "it never works because I'm never online. So give me another
// alternative." A job that needs somebody at a desk is a job that does not run.
//
// This asks the question on a page he opens every morning. Nobody has to be
// online for it, nothing has to fire at 7am, and there is no email to miss.
// The next admin to open the portal either sees nothing at all, or sees the
// table named. On this one it would have been the 13th rather than the 18th.
//
// IT IS SILENT WHEN THERE IS NOTHING TO SAY. Five of six mornings this renders
// nothing. A band that is always there is furniture, and furniture is not read.
// See docs/every-table-is-locked.sql for what counts as open and what does not.

export default function TablesWithoutRls({ tables }: { tables: string[] }) {
  const open = (tables || []).filter(Boolean)
  if (open.length === 0) return null

  const one = open.length === 1

  return (
    <div className="mb-4 rounded-xl border-2 border-chase bg-chase-bg px-5 py-4">
      <div className="flex items-center gap-2.5 mb-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
             className="text-chase flex-none" aria-hidden="true">
          <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
        </svg>
        <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-chase">
          {one ? 'A table is open to the internet' : `${open.length} tables are open to the internet`}
        </span>
      </div>

      <p className="m-0 text-[13.5px] leading-relaxed text-ink">
        {one ? 'This table has' : 'These tables have'}{' '}no row level security, so anyone
        holding the portal&rsquo;s public key can read, change or delete everything in{' '}
        {one ? 'it' : 'them'}.
      </p>

      <ul className="mt-2 mb-0 list-none p-0">
        {open.map(t => (
          <li key={t} className="text-[13px] font-semibold text-ink tabular-nums py-[2px]">
            {t}
          </li>
        ))}
      </ul>

      {/* WHAT TO DO, ON THE SCREEN. A warning that sends somebody looking for
          the answer is a warning that waits until somebody has time. */}
      <p className="mt-2.5 mb-0 text-[11.5px] leading-relaxed text-body">
        In Supabase, SQL editor:{' '}
        <code className="text-[11.5px]">alter table public.&lt;name&gt; enable row level security;</code>
        {' '}&mdash; and ask before adding a policy, because a table nothing reads should
        stay closed to everybody.
      </p>
    </div>
  )
}
