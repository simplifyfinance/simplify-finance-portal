import { NextRequest, NextResponse } from 'next/server'
import { markProceeded } from '@/lib/proceed-flow'

export async function POST(req: NextRequest) {
  try {
    const { dealId, stage } = await req.json()
    if (!dealId || (stage !== 'BC' && stage !== 'LO')) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid dealId/stage' }, { status: 400 })
    }
    const result = await markProceeded(dealId, stage)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
