import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { visit_id, ...data } = body

  if (!visit_id) {
    return NextResponse.json({ error: 'visit_id wajib diisi' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // Delete existing related data
    const tables = [
      'visit_attendance', 'visit_cash_checks', 'visit_cash_denominations',
      'visit_deposits', 'visit_checklists', 'visit_stock_checks',
      'visit_supervisions', 'visit_briefings', 'visit_feedbacks',
      'visit_chat_marketplace', 'visit_stock_separation',
    ]
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().eq('visit_id', visit_id)
      if (error) console.error(`[VisitUpdate] Delete ${table} error:`, error.message)
    }

    // 1. Attendance
    if (data.attendance) {
      await supabaseAdmin.from('visit_attendance').insert({ visit_id, ...data.attendance })
    }

    // 2. Cash Denominations
    if (data.denominations?.length) {
      await supabaseAdmin.from('visit_cash_denominations').insert(
        data.denominations.map((d: any) => ({ visit_id, ...d }))
      )
    }

    // 3. Cash Check
    if (data.cashCheck) {
      await supabaseAdmin.from('visit_cash_checks').insert({ visit_id, ...data.cashCheck })
    }

    // 4. Deposit
    if (data.deposit) {
      await supabaseAdmin.from('visit_deposits').insert({ visit_id, ...data.deposit })
    }

    // 5. Checklist
    if (data.checklists?.length) {
      await supabaseAdmin.from('visit_checklists').insert(
        data.checklists.map((c: any) => ({ visit_id, ...c }))
      )
    }

    // 6. Stock Checks
    if (data.stockChecks?.length) {
      await supabaseAdmin.from('visit_stock_checks').insert(
        data.stockChecks.map((s: any) => ({ visit_id, ...s }))
      )
    }

    // 7. Supervisions
    if (data.supervisions?.length) {
      await supabaseAdmin.from('visit_supervisions').insert(
        data.supervisions.map((s: any) => ({
          visit_id, checklist_item_name: s.item_name || s.checklist_item_name,
          area: s.area, deadline_date: s.deadline_date,
        }))
      )
    }

    // 8. Briefing
    if (data.briefing) {
      await supabaseAdmin.from('visit_briefings').insert({ visit_id, ...data.briefing })
    }

    // 10. Chat Marketplace
    if (data.chats?.length) {
      await supabaseAdmin.from('visit_chat_marketplace').insert(
        data.chats.map((c: any) => ({ visit_id, ...c }))
      )
    }

    // 11. Stock Separation
    if (data.stockSep) {
      const { error: sepErr } = await supabaseAdmin.from('visit_stock_separation').insert({
        visit_id, ...data.stockSep,
      })
      if (sepErr) throw new Error('Gagal simpan stok online: ' + sepErr.message)
    }

    // 12. Update visit
    const { error: visitErr } = await supabaseAdmin.from('visits').update({
      store_id: data.storeId,
      visit_date: data.visitDate,
      status: 'submitted',
      review_notes: data.reviewNotes || null,
      total_score: data.totalScore,
    }).eq('id', visit_id)
    if (visitErr) throw new Error('Gagal update kunjungan: ' + visitErr.message)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[VisitUpdate] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
