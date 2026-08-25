import RefinanceTemplateForm from './RefinanceTemplateForm'

/**
 * Templates.
 *
 * Holds no state and writes nothing. The team types the client's details,
 * generates the email, copies it and sends it from their own mailbox — so
 * there is no table, no RLS and no role gating to get wrong. Tracking happens
 * in SalesTrekker via the BCC, which is specific to that client's deal card
 * and is therefore typed per send, not stored.
 */
export default function TemplatesPage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#343333] mb-1">Templates</p>
      <p className="text-[12.5px] text-[#7A7266] mb-5 max-w-[86ch]">
        Generate a client email, copy it, and send it from your own mailbox. Nothing is saved — the figures live
        only in this page until you send.
      </p>
      <RefinanceTemplateForm />
    </div>
  )
}
