import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { visit_id, status, imbalance_percentage, oversold_items, photo_items_url, photo_dashboard_url, note } = body

  if (!visit_id || !status) {
    return NextResponse.json({ error: 'visit_id dan status wajib diisi' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabaseAdmin.from('visit_stock_separation').insert({
    visit_id, status,
    imbalance_percentage: imbalance_percentage ?? null,
    oversold_items: oversold_items ?? null,
    photo_url: null,
    photo_items_url: photo_items_url ?? null,
    photo_dashboard_url: photo_dashboard_url ?? null,
    note: note || null,
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, code: error.code }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}
