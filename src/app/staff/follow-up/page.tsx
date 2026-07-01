'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Camera, AlertTriangle, LogOut, Calendar, Clock, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { Supervision } from '@/types'

interface EnrichedSupervision extends Supervision {
  store_name?: string
  store_code?: string
  store_id?: string
  visit_date?: string
  visit_status?: string
  checklist_note?: string
  checklist_photo_url?: string
}

interface VisitGroup {
  visit_id: string
  visit_date: string
  store_name: string
  store_code: string
  openItems: EnrichedSupervision[]
  completedItems: EnrichedSupervision[]
}

export default function StaffFollowUpPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [supervisions, setSupervisions] = useState<EnrichedSupervision[]>([])
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [completedNote, setCompletedNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCompletedVisits, setShowCompletedVisits] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!profile || profile.role !== 'staff') { router.push('/dashboard'); return }
      setUserName(profile.name)

      const { data: storeStaff } = await supabase
        .from('store_staff')
        .select('store_id')
        .eq('profile_id', user.id)

      if (!storeStaff?.length) { setLoading(false); return }
      const storeIds = storeStaff.map(s => s.store_id)

      const { data: stores } = await supabase.from('stores').select('*').in('id', storeIds)
      const storeMap = new Map((stores || []).map(s => [s.id, s]))

      const { data: visits } = await supabase
        .from('visits')
        .select('id, store_id, visit_date, status')
        .in('store_id', storeIds)
        .in('status', ['submitted', 'approved'])
        .order('visit_date', { ascending: false })

      if (!visits?.length) { setLoading(false); return }

      const { data: sups } = await supabase
        .from('visit_supervisions')
        .select('*')
        .in('visit_id', visits.map(v => v.id))
        .order('created_at', { ascending: false })

      if (!sups?.length) { setLoading(false); return }

      const { data: checklists } = await supabase
        .from('visit_checklists')
        .select('visit_id, item_name, area, note, photo_url')
        .in('visit_id', visits.map(v => v.id))

      const enriched = sups.map(sup => {
        const visit = visits.find(v => v.id === sup.visit_id)
        const store = visit ? storeMap.get(visit.store_id) : undefined
        const cl = (checklists || []).find(c => c.visit_id === sup.visit_id && c.item_name === sup.checklist_item_name && c.area === sup.area)
        return {
          ...sup,
          store_name: store?.name,
          store_code: store?.code,
          store_id: store?.id,
          visit_date: visit?.visit_date,
          visit_status: visit?.status,
          checklist_note: cl?.note || undefined,
          checklist_photo_url: cl?.photo_url || undefined,
        }
      })

      setSupervisions(enriched)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleComplete(supId: string) {
    if (evidenceFiles.length === 0) { setError('Foto bukti wajib diupload'); return }
    if (!completedNote.trim()) { setError('Catatan tindak lanjut wajib diisi'); return }
    setSaving(true)
    setError('')

    try {
      const evidenceFilesData = await Promise.all(evidenceFiles.map(async (file) => {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
          }
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })
        return { base64, contentType: file.type || 'image/png' }
      }))

      const res = await fetch('/api/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervision_id: supId,
          evidence_files: evidenceFilesData,
          completed_note: completedNote || null,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal')

      setSupervisions(prev => prev.map(s => s.id === supId ? {
        ...s, status: 'completed', completed_at: new Date().toISOString(), completed_note: completedNote,
      } : s))
      setCompleting(null)
      setEvidenceFiles([])
      setCompletedNote('')
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  // Group supervisions by visit
  const grouped: VisitGroup[] = []
  const visitMap = new Map<string, VisitGroup>()
  for (const sup of supervisions) {
    const key = sup.visit_id
    if (!visitMap.has(key)) {
      visitMap.set(key, {
        visit_id: sup.visit_id,
        visit_date: sup.visit_date || '',
        store_name: sup.store_name || '',
        store_code: sup.store_code || '',
        openItems: [],
        completedItems: [],
      })
    }
    const group = visitMap.get(key)!
    if (sup.status === 'completed') {
      group.completedItems.push(sup)
    } else {
      group.openItems.push(sup)
    }
  }
  for (const g of visitMap.values()) {
    grouped.push(g)
  }

  const totalOpen = supervisions.filter(s => s.status === 'open').length
  const totalCompleted = supervisions.filter(s => s.status === 'completed').length

  if (loading) return <div className="min-h-screen bg-gray-50"><NavBar /><main className="p-6 text-center text-gray-400">Memuat...</main></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <NavBar />
      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-blue-900">Follow-Up Supervisi</h1>
            <p className="text-sm text-gray-400">Halo, {userName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            router.push('/login')
          }}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border-amber-100 shadow-sm bg-amber-50/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{totalOpen}</p>
              <p className="text-xs text-gray-500">Belum Selesai</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 shadow-sm bg-emerald-50/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{totalCompleted}</p>
              <p className="text-xs text-gray-500">Selesai</p>
            </CardContent>
          </Card>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}

        {grouped.length === 0 && (
          <Card>
            <CardContent className="text-center py-12 text-gray-400">
              <Check className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm">Tidak ada supervisi yang perlu ditindaklanjuti.</p>
            </CardContent>
          </Card>
        )}

        {grouped.map(vg => {
          const hasOpen = vg.openItems.length > 0
          const isExpanded = expandedVisitId === vg.visit_id
          const completedVisible = showCompletedVisits.has(vg.visit_id)
          return (
            <Card key={vg.visit_id} className={`shadow-sm ${hasOpen ? 'border-amber-100' : 'border-emerald-100'}`}>
              <button
                className="w-full text-left"
                onClick={() => setExpandedVisitId(isExpanded ? null : vg.visit_id)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{vg.store_name} ({vg.store_code})</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3" /> {vg.visit_date ? new Date(vg.visit_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {vg.openItems.length > 0 && (
                      <Badge variant="warning">{vg.openItems.length} open</Badge>
                    )}
                    {vg.completedItems.length > 0 && (
                      <Badge variant="success">{vg.completedItems.length} selesai</Badge>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </CardContent>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4 space-y-2">
                  {/* Open items per-visit */}
                  {vg.openItems.length > 0 && (
                    <div className="pt-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Perlu Tindak Lanjut
                      </p>
                      {vg.openItems.map(sup => (
                        <div key={sup.id} className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{sup.checklist_item_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {sup.area === 'exterior' ? 'Area Luar' : sup.area === 'interior' ? 'Area Dalam Toko' : sup.area === 'butcher' ? 'Area Butcher' : 'Gudang'}
                              </p>
                            </div>
                            <Badge variant="warning">Open</Badge>
                          </div>
                          {(sup.checklist_note || sup.checklist_photo_url) && (
                            <div className="bg-white rounded-lg p-2 border border-gray-200 space-y-1.5">
                              <p className="text-xs text-gray-400">Catatan & Foto SPV:</p>
                              {sup.checklist_note && <p className="text-sm text-gray-700">{sup.checklist_note}</p>}
                              {sup.checklist_photo_url && (
                                <img src={sup.checklist_photo_url} alt="Foto SPV" className="h-28 rounded-lg border border-gray-200" />
                              )}
                            </div>
                          )}
                          {sup.deadline_date && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> Deadline: {new Date(sup.deadline_date).toLocaleDateString('id-ID')}
                            </p>
                          )}
                          <div className="border-t border-gray-200" />
                          {completing === sup.id ? (
                            <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Foto Bukti Perbaikan <span className="text-red-400">*</span></label>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      setEvidenceFiles(prev => [...prev, file])
                                      setError('')
                                    }
                                    e.target.value = ''
                                  }}
                                />
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {evidenceFiles.map((f, i) => (
                                    <div key={i} className="relative">
                                      <img src={URL.createObjectURL(f)} alt={`foto ${i + 1}`} className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                                      <button
                                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                                        onClick={() => setEvidenceFiles(prev => prev.filter((_, idx) => idx !== i))}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    className="h-20 w-20 rounded-lg border-2 border-dashed border-blue-200 flex items-center justify-center text-blue-500 hover:bg-blue-50"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <Camera className="h-6 w-6" />
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Catatan Tindak Lanjut</label>
                                <Input placeholder="Jelaskan tindakan yg sudah dilakukan..." value={completedNote}
                                  onChange={e => setCompletedNote(e.target.value)} className="text-sm" />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => { setCompleting(null); setEvidenceFiles([]); setCompletedNote(''); setError('') }}>
                                  Batal
                                </Button>
                                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => handleComplete(sup.id)} disabled={saving || evidenceFiles.length === 0 || !completedNote.trim()}>
                                  {saving ? 'Menyimpan...' : <><Check className="h-3 w-3" /> Tandai Selesai</>}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="border-blue-200 text-blue-700" onClick={() => setCompleting(sup.id)}>
                              <Camera className="h-3 w-3" /> Selesaikan
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Completed items per-visit */}
                  {vg.completedItems.length > 0 && (
                    <div className={`space-y-2 ${vg.openItems.length > 0 ? 'pt-2' : 'pt-3'}`}>
                      <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Sudah Selesai
                      </p>
                      {(!hasOpen || completedVisible) && vg.completedItems.map(sup => (
                        <div key={sup.id} className="bg-emerald-50/30 rounded-xl p-3 border border-emerald-100 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{sup.checklist_item_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {sup.area === 'exterior' ? 'Area Luar' : sup.area === 'interior' ? 'Area Dalam Toko' : sup.area === 'butcher' ? 'Area Butcher' : 'Gudang'}
                              </p>
                            </div>
                            <Badge variant="success">Selesai</Badge>
                          </div>
                          {sup.completed_at && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Selesai: {new Date(sup.completed_at).toLocaleDateString('id-ID')}
                            </p>
                          )}
                          {sup.completed_note && <p className="text-xs text-gray-600">Catatan: {sup.completed_note}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {sup.evidence_photos && JSON.parse(sup.evidence_photos).map((url: string, i: number) => (
                              <img key={i} src={url} alt={`Bukti ${i + 1}`} className="h-20 rounded-lg border border-gray-200" />
                            ))}
                            {!sup.evidence_photos && sup.evidence_photo_url && (
                              <img src={sup.evidence_photo_url} alt="Bukti" className="h-20 rounded-lg border border-gray-200" />
                            )}
                          </div>
                        </div>
                      ))}
                      {hasOpen && vg.completedItems.length > 0 && !completedVisible && (
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => setShowCompletedVisits(prev => new Set(prev).add(vg.visit_id))}
                        >
                          Tampilkan {vg.completedItems.length} item selesai
                        </button>
                      )}
                      {hasOpen && vg.completedItems.length > 0 && completedVisible && (
                        <button
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                          onClick={() => setShowCompletedVisits(prev => { const s = new Set(prev); s.delete(vg.visit_id); return s; })}
                        >
                          Sembunyikan item selesai
                        </button>
                      )}
                    </div>
                  )}

                  {vg.openItems.length === 0 && vg.completedItems.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">Tidak ada supervisi</p>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </main>
    </div>
  )
}