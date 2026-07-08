import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { email, password, name, role, storeIds } = await request.json()

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
  }

  if (!['supervisor', 'manager', 'staff'].includes(role)) {
    return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  if (!authData.user) {
    return NextResponse.json({ error: 'Gagal membuat user' }, { status: 500 })
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    name,
    role,
  })

  if (profileError) {
    // Rollback: hapus user auth
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  // Assign staff to stores
  if (role === 'staff' && storeIds?.length) {
    const { error: storeErr } = await supabaseAdmin.from('store_staff').insert(
      storeIds.map((storeId: string) => ({ store_id: storeId, profile_id: authData.user.id }))
    )
    if (storeErr) console.error('[Users] Gagal assign store:', storeErr.message)
  }

  return NextResponse.json({ success: true, user: { id: authData.user.id, email, name, role } })
}

export async function PATCH(request: NextRequest) {
  const { id, name, role, signature } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'ID user wajib diisi' }, { status: 400 })
  }

  if (role && !['supervisor', 'manager', 'staff'].includes(role)) {
    return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const updates: Record<string, any> = {}
  if (name) updates.name = name
  if (role) updates.role = role
  if (signature !== undefined) updates.signature = signature

  const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'ID user wajib diisi' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Cek apakah user masih memiliki visit sebagai supervisor
  const { count: supervisorCount, error: countError } = await supabaseAdmin
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('supervisor_id', id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 400 })
  }

  if (supervisorCount && supervisorCount > 0) {
    return NextResponse.json({
      error: `Supervisor ini memiliki ${supervisorCount} kunjungan. Pindahkan kunjungan ke supervisor lain sebelum menghapus.`
    }, { status: 400 })
  }

  // Lepas relasi manager (nullable, bisa di-set NULL)
  const { error: managerUpdateError } = await supabaseAdmin
    .from('visits')
    .update({ manager_id: null })
    .eq('manager_id', id)

  if (managerUpdateError) {
    return NextResponse.json({ error: managerUpdateError.message }, { status: 400 })
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', id)
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
