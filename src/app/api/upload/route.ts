import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { base64, contentType, path } = await request.json()

  if (!base64 || !path) {
    return NextResponse.json({ error: 'base64 dan path wajib diisi' }, { status: 400 })
  }

  const buffer = Buffer.from(base64, 'base64')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabaseAdmin.storage
    .from('visit-photos')
    .upload(path, buffer, { contentType: contentType || 'image/png', upsert: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from('visit-photos').getPublicUrl(data.path)

  return NextResponse.json({ url: publicUrl })
}
