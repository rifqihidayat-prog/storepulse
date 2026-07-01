import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateReport } from '@/lib/report-generator'

export async function GET(request: NextRequest) {
  const visitId = request.nextUrl.searchParams.get('visitId')
  if (!visitId) {
    return NextResponse.json({ error: 'visitId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: visit } = await supabase
    .from('visits')
    .select('*, store:stores(*), supervisor:profiles!visits_supervisor_id_fkey(*)')
    .eq('id', visitId)
    .single()

  if (!visit) {
    return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
  }

  const [attendRes, cashRes, denomRes, depRes, clRes, stkRes, supRes, briefRes, chatRes, sepRes, mgrRes] = await Promise.all([
    supabase.from('visit_attendance').select('*').eq('visit_id', visitId).maybeSingle(),
    supabase.from('visit_cash_checks').select('*').eq('visit_id', visitId).maybeSingle(),
    supabase.from('visit_cash_denominations').select('*').eq('visit_id', visitId),
    supabase.from('visit_deposits').select('*').eq('visit_id', visitId).maybeSingle(),
    supabase.from('visit_checklists').select('*').eq('visit_id', visitId),
    supabase.from('visit_stock_checks').select('*').eq('visit_id', visitId),
    supabase.from('visit_supervisions').select('*').eq('visit_id', visitId),
    supabase.from('visit_briefings').select('*').eq('visit_id', visitId).maybeSingle(),
    supabase.from('visit_chat_marketplace').select('*').eq('visit_id', visitId),
    supabase.from('visit_stock_separation').select('*').eq('visit_id', visitId).maybeSingle(),
    visit.manager_id
      ? supabase.from('profiles').select('*').eq('id', visit.manager_id).single()
      : Promise.resolve({ data: null }),
  ])

  const reportData = {
    visit: visit as any,
    attendance: attendRes.data as any,
    cashCheck: cashRes.data as any,
    denominations: (denomRes.data || []) as any,
    deposit: depRes.data as any,
    checklists: (clRes.data || []) as any,
    stockChecks: (stkRes.data || []) as any,
    supervisions: (supRes.data || []) as any,
    briefing: briefRes.data as any,
    chats: (chatRes.data || []) as any,
    stockSep: sepRes.data as any,
    manager: mgrRes?.data as any,
  }

  try {
    const buffer = await generateReport(reportData, supabaseAdmin)
    const storeCode = ((visit.store as any)?.code || visitId.substring(0, 8)).replace(/[^a-zA-Z0-9_-]/g, '')
    const dateStr = (visit.visit_date || '').replace(/-/g, '')
    const filename = `Laporan-Kunjungan-${storeCode}_${dateStr}.docx`
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    console.error('Report generation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
