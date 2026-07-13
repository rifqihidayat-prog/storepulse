import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { supervision_id, evidence_urls, completed_note } = body

    if (!supervision_id) {
      return NextResponse.json({ error: 'supervision_id wajib diisi' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_note: completed_note || null,
    }
    if (evidence_urls?.length === 1) {
      updates.evidence_photo_url = evidence_urls[0]
    }
    if (evidence_urls?.length > 0) {
      updates.evidence_photos = JSON.stringify(evidence_urls)
    }

    const { error: updateErr } = await supabase
      .from('visit_supervisions')
      .update(updates)
      .eq('id', supervision_id)

    if (updateErr) throw new Error('Gagal update: ' + updateErr.message)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[FollowUp] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
