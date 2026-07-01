'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import LocationPicker from '@/components/location-picker'
import { Building2, Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import type { Store } from '@/types'

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('stores').select('*').order('name')
    setStores(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setName(''); setCode(''); setAddress(''); setLatitude(''); setLongitude('')
    setEditId(null); setShowForm(false)
  }

  function editStore(store: Store) {
    setEditId(store.id)
    setName(store.name); setCode(store.code); setAddress(store.address || '')
    setLatitude(store.latitude?.toString() || '')
    setLongitude(store.longitude?.toString() || '')
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: name.toUpperCase(),
      code,
      address,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    }
    if (editId) {
      await supabase.from('stores').update(payload).eq('id', editId)
    } else {
      await supabase.from('stores').insert(payload)
    }
    resetForm()
    setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus toko ini?')) return
    const supabase = createClient()
    await supabase.from('stores').delete().eq('id', id)
    load()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <NavBar />
      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-700" /> Data Toko
          </h1>
          <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => { resetForm(); setShowForm(!showForm) }}>
            <Plus className="h-4 w-4" /> {showForm ? 'Batal' : 'Tambah Toko'}
          </Button>
        </div>

        {showForm && (
          <Card className="border-emerald-100 shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Nama Toko</label>
                  <Input placeholder="contoh: TOKO ABC" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Kode Toko</label>
                  <Input placeholder="contoh: TKC-001" value={code} onChange={e => setCode(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Alamat</label>
                <Input placeholder="Jl. Contoh No. 1" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-2">
                  <MapPin className="h-3 w-3 text-gray-400" /> Lokasi Toko di Peta
                </label>
                {showForm && (
                  <LocationPicker
                    initialLat={latitude ? parseFloat(latitude) : null}
                    initialLng={longitude ? parseFloat(longitude) : null}
                    onLocationChange={(lat, lng) => {
                      setLatitude(lat.toString())
                      setLongitude(lng.toString())
                    }}
                  />
                )}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={resetForm}>Batal</Button>
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={handleSave} disabled={saving || !name || !code}>
                  {saving ? 'Menyimpan...' : editId ? 'Update' : 'Simpan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="pt-4">
            {loading ? (
              <p className="text-center text-gray-400 py-8">Memuat...</p>
            ) : stores.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Belum ada toko</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stores.map(store => (
                  <div key={store.id} className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-emerald-700" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{store.name}</p>
                        <p className="text-xs text-gray-400">
                          {store.code}
                          {store.address ? ` - ${store.address}` : ''}
                          {store.latitude && store.longitude ? ' - 📍 Ada koordinat' : ' - ⚠️ Belum ada koordinat'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => editStore(store)}>
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(store.id)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
