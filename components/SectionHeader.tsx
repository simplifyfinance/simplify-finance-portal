// The little uppercase heading above a group of fields.
//
// Written out identically in the Compliance form and the Fact Find form. It is
// only presentation, but it is the same shape of fault as the money bugs: two
// copies, and nothing saying the second one exists. See
// lib/no-duplicate-logic.test.ts.
export default function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">{title}</span>
      {badge && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium">{badge}</span>}
    </div>
  )
}
