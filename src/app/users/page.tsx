'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, Trash2, UserCog, Pencil, Upload, Pen, Store, Eye, EyeOff } from 'lucide-react'
import { SignaturePad } from '@/components/signature-pad'
import type { Profile, Store as StoreType } from '@/types'

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'supervisor' | 'manager' | 'staff'>('supervisor')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'supervisor' | 'manager' | 'staff'>('supervisor')
  const [editSignature, setEditSignature] = useState<File | null>(null)
  const [editSignaturePreview, setEditSignaturePreview] = useState('')
  const [signatureMode, setSignatureMode] = useState<'upload' | 'draw' | null>(null)
  const [stores, setStores] = useState<StoreType[]>([])
  const [selectedStores, setSelectedStores] = useState<string[]>([])

  async function loadProfiles() {
    const supabase = createClient()
    const { data, error } = await supabase.from('profiles').select('*').order('name')
    if (data) setProfiles(data)
    const { data: storesData } = await supabase.from('stores').select('*').order('name')
    if (storesData) setStores(storesData)
    setLoading(false)
  }

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'manager') window.location.href = '/dashboard'
      }
      loadProfiles()
    }
    checkRole()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role, storeIds: role === 'staff' ? selectedStores : undefined }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Gagal membuat user')
        setSaving(false)
        return
      }

      setSuccess(`User ${name} (${email}) berhasil dibuat!`)
      setEmail(''); setPassword(''); setName(''); setRole('supervisor'); setSelectedStores([])
      setShowForm(false)
      loadProfiles()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus user "${name}"?`)) return
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Gagal menghapus user')
        return
      }
      setSuccess(`User ${name} berhasil dihapus!`)
      loadProfiles()
    } catch (err: any) {
      setError(err.message)
    }
  }

  function startEdit(profile: Profile) {
    setEditUser(profile)
    setEditName(profile.name)
    setEditRole(profile.role as 'supervisor' | 'manager')
    setEditSignature(null)
    setEditSignaturePreview('')
    setSignatureMode(null)
    setError('')
    setSuccess('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      let signatureUrl = editUser.signature || ''
      if (editSignature) {
        const ext = editSignature.name.split('.').pop() || 'png'
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
          }
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(editSignature)
        })
        const path = `signatures/${editUser.id}.${ext}`
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, contentType: editSignature.type || 'image/png', path }),
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) {
          setError('Gagal upload tanda tangan: ' + (uploadData.error || 'Unknown error'))
          setSaving(false)
          return
        }
        signatureUrl = uploadData.url
      }

      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editUser.id, name: editName, role: editRole, signature: signatureUrl }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Gagal mengupdate user')
        setSaving(false)
        return
      }

      setSuccess(`User ${editName} berhasil diupdate!`)
      setEditUser(null)
      loadProfiles()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  function handleCanvasSignature(dataUrl: string) {
    setEditSignaturePreview(dataUrl)
    const base64 = dataUrl.split(',')[1]
    const binary = atob(base64)
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
    const blob = new Blob([array], { type: 'image/png' })
    const file = new File([blob], 'signature.png', { type: 'image/png' })
    setEditSignature(file)
    setSignatureMode(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <NavBar />
      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-700" /> Kelola User
          </h1>
          <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}>
            <Plus className="h-4 w-4" /> {showForm ? 'Batal' : 'Tambah User'}
          </Button>
        </div>

        {error && !showForm && !editUser && (
          <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>
        )}
        {success && !showForm && !editUser && (
          <p className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">{success}</p>
        )}

        {showForm && (
          <Card className="border-emerald-100 shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Nama</label>
                  <Input placeholder="Nama lengkap" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Email</label>
                    <Input type="email" placeholder="nama@hijrahfood.co.id" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Password</label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Min 6 karakter" value={password} onChange={e => setPassword(e.target.value)} required className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Role</label>
                  <Select value={role} onChange={e => setRole(e.target.value as any)}>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff Toko</option>
                  </Select>
                </div>
                {role === 'staff' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Akses ke Toko</label>
                    <select multiple value={selectedStores} onChange={e => setSelectedStores(Array.from(e.target.selectedOptions, o => o.value))}
                      className="w-full h-28 rounded-lg border border-gray-200 text-sm p-2">
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400">Tahan Ctrl/Command untuk pilih lebih dari satu</p>
                  </div>
                )}
                {error && !editUser && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}
                {success && !editUser && <p className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">{success}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Batal</Button>
                  <Button type="submit" size="sm" className="bg-emerald-700 hover:bg-emerald-800" disabled={saving || !name || !email || !password}>
                    {saving ? 'Menyimpan...' : 'Buat User'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {editUser && (
          <Card className="border-amber-100 shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <form onSubmit={handleEdit} className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-800">Edit User: {editUser.name}</h3>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Nama</label>
                  <Input placeholder="Nama lengkap" value={editName} onChange={e => setEditName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Role</label>
                  <Select value={editRole} onChange={e => setEditRole(e.target.value as any)}>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff Toko</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Tanda Tangan</label>
                  <div className="flex gap-2 mb-2">
                    <Button type="button" variant={signatureMode === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setSignatureMode('upload')}
                      className={signatureMode === 'upload' ? 'bg-emerald-700' : ''}>
                      <Upload className="h-3 w-3" /> Upload Gambar
                    </Button>
                    <Button type="button" variant={signatureMode === 'draw' ? 'default' : 'outline'} size="sm" onClick={() => setSignatureMode('draw')}
                      className={signatureMode === 'draw' ? 'bg-emerald-700' : ''}>
                      <Pen className="h-3 w-3" /> Gambar Langsung
                    </Button>
                    {signatureMode && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setSignatureMode(null); setEditSignature(null); setEditSignaturePreview('') }}>
                        Batal
                      </Button>
                    )}
                  </div>
                  {signatureMode === 'upload' && (
                    <input type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setEditSignature(file)
                        setEditSignaturePreview(URL.createObjectURL(file))
                      }
                    }}
                      className="block w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-amber-50 file:text-amber-700" />
                  )}
                  {signatureMode === 'draw' && (
                    <SignaturePad onSave={handleCanvasSignature} />
                  )}
                  {editSignaturePreview && (
                    <img src={editSignaturePreview} alt="Preview TT" className="h-12 mt-1 rounded border border-gray-200" />
                  )}
                  {editUser.signature && !editSignaturePreview && !signatureMode && (
                    <div className="mt-1">
                      <p className="text-xs text-gray-400">TT saat ini:</p>
                      <img src={editUser.signature} alt="TT" className="h-12 mt-1 rounded border border-gray-200" />
                    </div>
                  )}
                </div>
                {error && editUser && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}
                {success && editUser && <p className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">{success}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setEditUser(null); setError(''); setSuccess('') }}>Batal</Button>
                  <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700" disabled={saving || !editName}>
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="pt-4">
            {loading ? (
              <p className="text-center text-gray-400 py-8">Memuat...</p>
            ) : (
              <div className="space-y-2">
                {profiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Belum ada user</p>
                  </div>
                ) : (
                  profiles.map(profile => (
                    <div key={profile.id} className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <UserCog className="h-4 w-4 text-emerald-700" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{profile.name}</p>
                          <p className="text-xs text-gray-400">{profile.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={profile.role === 'manager' ? 'default' : profile.role === 'staff' ? 'secondary' : 'success'}>
                          {profile.role === 'manager' ? 'Manager' : profile.role === 'staff' ? 'Staff' : 'Supervisor'}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(profile)}>
                          <Pencil className="h-4 w-4 text-amber-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(profile.id, profile.name)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
