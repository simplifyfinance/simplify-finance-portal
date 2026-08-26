import TemplatesClient from './TemplatesClient'

/**
 * Templates.
 *
 * A list of templates; pick one and you get only the fields that template needs.
 * A dropdown would have to hide and show half the form beneath it, which is how a
 * figure left over from the last email ends up in the next one.
 *
 * Nothing here is stored and no stage moves. The team fills in the client,
 * generates the email and sends it from their own mailbox; tracking happens in
 * SalesTrekker via the BCC, which belongs to that client's own deal card.
 */
export default function TemplatesPage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-lg font-medium text-[#343333] mb-1">Templates</p>
      <p className="text-[12.5px] text-[#7A7266] mb-5 max-w-[86ch]">
        Pick a template, fill in the client, and send it from your own mailbox. Nothing is saved.
      </p>
      <TemplatesClient />
    </div>
  )
}
