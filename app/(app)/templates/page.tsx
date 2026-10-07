import TemplatesClient from './TemplatesClient'
import { PAGE_WIDE } from '@/lib/page-width'

export const metadata = { title: 'Templates' }

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
    <div className={PAGE_WIDE}>
      <p className="text-lg font-medium text-ink mb-1">Templates</p>
      <p className="text-[12.5px] text-muted mb-5 max-w-[86ch]">
        Pick a template, fill in the client, and send it from your own mailbox. Nothing is saved.
      </p>
      <TemplatesClient />
    </div>
  )
}
