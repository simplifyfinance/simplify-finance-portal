import { createSupabaseServer } from '@/lib/supabase-server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, broker_key, full_name')
    .eq('id', user.id)
    .single()

  // Fetch deals — filter by broker if broker role
  let dealsQuery = supabase.from('deals').select('*, clients(first_name, last_name)').order('created_at', { ascending: false })
  if (profile?.role === 'broker' && profile?.broker_key) {
    dealsQuery = dealsQuery.eq('assigned_broker', profile.broker_key)
  }
  const { data: deals } = await dealsQuery

  const total = deals?.length || 0
  const inProgress = deals?.filter(d => d.status === 'in_progress').length || 0
  const proceeded = deals?.filter(d => d.client_proceeded).length || 0
  const bcStage = deals?.filter(d => d.stage === 'BC').length || 0
  const loStage = deals?.filter(d => d.stage === 'LO').length || 0
  const recent = deals?.slice(0, 8) || []

  const stageColor: Record<string, string> = {
    BC: 'bg-blue-100 text-blue-600',
    LO: 'bg-purple-100 text-purple-600',
    Compliance: 'bg-green-100 text-green-600',
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#343333]">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Here is what is happening across your deals</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total deals', value: total },
          { label: 'In progress', value: inProgress },
          { label: 'BC stage', value: bcStage },
          { label: 'Ready to proceed', value: proceeded },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="text-2xl font-semibold text-[#343333]">{value}</div>
          </div>
        ))}
      </div>

      {/* Ready to proceed alerts */}
      {proceeded > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-green-700 mb-2">
            {proceeded} client{proceeded > 1 ? 's have' : ' has'} confirmed they are ready to proceed
          </p>
          <div className="space-y-1">
            {deals?.filter(d => d.client_proceeded).map(d => (
              <Link key={d.id} href={`/deals/${d.id}`}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 hover:bg-green-50 transition">
                <span className="text-sm text-[#343333] font-medium">{d.deal_name}</span>
                <span className="text-xs text-green-600">View deal →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent deals */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent deals</div>
          <Link href="/deals" className="text-xs text-[#2DBEFF] hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No deals yet</div>
        ) : (
          recent.map(deal => {
            const initials = `${deal.clients?.first_name?.[0] || ''}${deal.clients?.last_name?.[0] || ''}`.toUpperCase()
            return (
              <Link key={deal.id} href={`/deals/${deal.id}`}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition">
                <div style={{ background: 'rgba(45,190,255,0.12)', color: '#2DBEFF' }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {initials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#343333] truncate">{deal.deal_name}</div>
                  <div className="text-xs text-gray-400">
                    {deal.clients?.first_name} {deal.clients?.last_name}
                    {deal.assigned_broker && <> · {deal.assigned_broker}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {deal.client_proceeded && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ready to proceed</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColor[deal.stage] || 'bg-gray-100 text-gray-500'}`}>
                    {deal.stage}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
