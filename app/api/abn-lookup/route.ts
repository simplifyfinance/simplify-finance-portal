import { NextRequest, NextResponse } from 'next/server'

const GUID = process.env.ABN_LOOKUP_GUID

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')?.trim() || ''

  if (!GUID) {
    return NextResponse.json({ error: 'ABN lookup not configured' }, { status: 500 })
  }

  if (query.length < 3) {
    return NextResponse.json({ results: [] })
  }

  const digitsOnly = query.replace(/\s/g, '')
  const isAbn = /^\d{9,11}$/.test(digitsOnly)

  try {
    if (isAbn) {
      const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${digitsOnly}&guid=${GUID}`
      const res = await fetch(url)
      const text = await res.text()
      const data = JSON.parse(text.replace(/^callback\(|\)$/g, ''))

      if (data.Abn && !data.Message) {
        return NextResponse.json({
          results: [
            {
              abn: data.Abn,
              businessName: data.EntityName || data.BusinessName?.[0] || '',
              status: data.AbnStatus,
              entityType: data.EntityTypeName,
            },
          ],
        })
      }
      return NextResponse.json({ results: [] })
    } else {
      const url = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(query)}&guid=${GUID}`
      const res = await fetch(url)
      const text = await res.text()
      const data = JSON.parse(text.replace(/^callback\(|\)$/g, ''))

      const names = data.Names || []
      const results = names.slice(0, 10).map((n: any) => ({
        abn: n.Abn,
        businessName: n.Name,
        status: n.IsCurrentIndicator === 'Y' ? 'Active' : 'Inactive',
        entityType: '',
      }))

      return NextResponse.json({ results })
    }
  } catch (err) {
    console.error('ABN lookup error:', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 })
  }
}
