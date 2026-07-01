import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { supervision_id, evidence_files, completed_note } = body

    if (!supervision_id) {
      return NextResponse.json({ error: 'supervision_id wajib diisi' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const evidenceUrls: string[] = []

    if (evidence_files?.length) {
      for (const file of evidence_files) {
        const ext = (file.contentType || 'image/png').split('/')[1] || 'png'
        const path = `follow-up/${supervision_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('visit-photos')
          .upload(path, Buffer.from(file.base64, 'base64'), { contentType: file.contentType || 'image/png', upsert: true })
        if (uploadErr) throw new Error('Gagal upload foto: ' + uploadErr.message)

        const { data: { publicUrl } } = supabase.storage.from('visit-photos').getPublicUrl(path)
        evidenceUrls.push(publicUrl)
      }
    }

    const updates: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_note: completed_note || null,
    }
    if (evidenceUrls.length === 1) {
      updates.evidence_photo_url = evidenceUrls[0]
    }
    if (evidenceUrls.length > 0) {
      updates.evidence_photos = JSON.stringify(evidenceUrls)
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
