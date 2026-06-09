export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[['Total deals','12'],['In progress','5'],['Awaiting broker','3'],['Complete','4']].map(([label,val])=>(
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-2xl font-semibold">{val}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 border-b border-gray-100">Recent activity</div>
        {[['SJ','Sarah Johnson','Johnson_Purchase_2025','BC complete · Awaiting broker'],
          ['LC','Liam Chen','Chen_Refinance_2025','LO in progress'],
          ['PP','Priya Patel','Patel_Investment_2025','BC in progress']
        ].map(([initials,name,deal,status])=>(
          <div key={deal} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
            <div style={{background:'rgba(45,190,255,0.12)',color:'#2DBEFF'}} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold">{initials}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{deal}</div>
              <div className="text-xs text-gray-400">{status}</div>
            </div>
            <div className="text-xs text-gray-400">{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
