'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, AlertTriangle, Calendar, Clock, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import type { Supervision } from '@/types'

interface SupervisionWithMeta extends Supervision {
  store_name?: string
  store_code?: string
  store_id?: string
  supervisor_name?: string
  visit_date?: string
}

interface VisitGroup {
  visit_id: string
  visit_date: string
  store_name: string
  store_code: string
  store_id: string
  supervisor_name?: string
  items: SupervisionWithMeta[]
}

export default function FollowUpMonitoringPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<VisitGroup[]>([])
  const [stores, setStores] = useState<{ id: string; name: string; code: string }[]>([])
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [filterStore, setFilterStore] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || !['supervisor', 'manager'].includes(profile.role)) {
        router.push('/dashboard')
        return
      }

      const { data: visits } = await supabase
        .from('visits')
        .select('id, store_id, visit_date, status, supervisor:profiles!visits_supervisor_id_fkey(name)')
        .in('status', ['submitted', 'approved'])
        .order('visit_date', { ascending: false })

      if (!visits?.length) { setLoading(false); return }

      const storeIds = [...new Set(visits.map(v => v.store_id))]
      const { data: storesData } = await supabase.from('stores').select('*').in('id', storeIds)
      const storeMap = new Map((storesData || []).map(s => [s.id, s]))
      setStores(storesData || [])

      const visitIds = visits.map(v => v.id)
      const { data: supsData } = await supabase
        .from('visit_supervisions')
        .select('*')
        .in('visit_id', visitIds)
        .order('created_at', { ascending: false })

      if (!supsData?.length) { setLoading(false); return }

      // Enrich and group
      const enriched = supsData.map(sup => {
        const visit = visits.find(v => v.id === sup.visit_id)
        const store = visit ? storeMap.get(visit.store_id) : undefined
        return { ...sup, store_name: store?.name, store_code: store?.code, store_id: store?.id, visit_date: visit?.visit_date }
      })

      const visitMap = new Map<string, SupervisionWithMeta[]>()
      for (const sup of enriched) {
        const key = sup.visit_id
        if (!visitMap.has(key)) visitMap.set(key, [])
        visitMap.get(key)!.push(sup)
      }

      const grouped: VisitGroup[] = []
      for (const visit of visits) {
        const items = visitMap.get(visit.id) || []
        const store = storeMap.get(visit.store_id)
        const supv = Array.isArray(visit.supervisor) ? visit.supervisor[0] : visit.supervisor
        grouped.push({
          visit_id: visit.id,
          visit_date: visit.visit_date,
          store_name: store?.name || '',
          store_code: store?.code || '',
          store_id: store?.id || '',
          supervisor_name: supv?.name || undefined,
          items,
        })
      }

      setGroups(grouped)
      setLoading(false)
    }
    load()
  }, [router])

  // Filter visits (groups)
  const filteredGroups = groups.filter(g => {
    if (filterStore !== 'all' && g.store_id !== filterStore) return false
    if (filterStatus === 'overdue') {
      if (!g.items.some(i => i.status === 'open' && i.deadline_date && new Date(i.deadline_date) < new Date())) return false
    }
    if (filterStatus === 'open' && !g.items.some(i => i.status === 'open')) return false
    if (filterStatus === 'completed' && !g.items.some(i => i.status === 'completed')) return false
    if (search) {
      const q = search.toLowerCase()
      const matchStore = g.store_name?.toLowerCase().includes(q) || g.store_code?.toLowerCase().includes(q)
      const matchItem = g.items.some(i => i.checklist_item_name?.toLowerCase().includes(q))
      if (!matchStore && !matchItem) return false
    }
    return true
  })

  // Count totals
  const allItems = groups.flatMap(g => g.items)
  const openCount = allItems.filter(i => i.status === 'open').length
  const completedCount = allItems.filter(i => i.status === 'completed').length
  const overdueCount = allItems.filter(i => i.status === 'open' && i.deadline_date && new Date(i.deadline_date) < new Date()).length

  if (loading) return <div className="min-h-screen bg-gray-50"><NavBar /><main className="p-6 text-center text-gray-400">Memuat...</main></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <NavBar />
      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-blue-900">Monitoring Follow-Up Supervisi</h1>
            <p className="text-sm text-gray-400">Pantau tindak lanjut dari staff toko</p>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-amber-100 shadow-sm bg-amber-50/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{openCount}</p>
              <p className="text-xs text-gray-500">Open</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 shadow-sm bg-emerald-50/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{completedCount}</p>
              <p className="text-xs text-gray-500">Selesai</p>
            </CardContent>
          </Card>
          <Card className="border-red-100 shadow-sm bg-red-50/30">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{overdueCount}</p>
              <p className="text-xs text-gray-500">Terlambat</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Cari toko / item</label>
                <Input placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Toko</label>
                <select value={filterStore} onChange={e => setFilterStore(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                  <option value="all">Semua Toko</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                  <option value="all">Semua</option>
                  <option value="open">Ada Open</option>
                  <option value="completed">Ada Selesai</option>
                  <option value="overdue">Ada Terlambat</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daftar Visit */}
        {filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-400">
              <Check className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm">Tidak ada kunjungan dengan filter ini.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map(vg => {
              const isExpanded = expandedVisitId === vg.visit_id
              const vgOpen = vg.items.filter(i => i.status === 'open')
              const vgCompleted = vg.items.filter(i => i.status === 'completed')
              const vgOverdue = vgOpen.filter(i => i.deadline_date && new Date(i.deadline_date) < new Date())
              return (
                <Card key={vg.visit_id} className={`shadow-sm ${vgOverdue.length > 0 ? 'border-red-200' : vgOpen.length > 0 ? 'border-amber-100' : 'border-emerald-100'}`}>
                  <button className="w-full text-left" onClick={() => setExpandedVisitId(isExpanded ? null : vg.visit_id)}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{vg.store_name} ({vg.store_code})</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />{' '}
                          {vg.visit_date ? new Date(vg.visit_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                          {vg.supervisor_name && <span className="ml-2">· SPV: {vg.supervisor_name}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {vgOpen.length > 0 && <Badge variant="warning">{vgOpen.length} open</Badge>}
                        {vgCompleted.length > 0 && <Badge variant="success">{vgCompleted.length} selesai</Badge>}
                        {vgOverdue.length > 0 && <Badge variant="destructive">{vgOverdue.length} terlambat</Badge>}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </CardContent>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-4 space-y-2">
                      {vg.items.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center pt-3">Tidak ada supervisi</p>
                      ) : (
                        <>
                          <div className="pt-3 space-y-2">
                            {vgOpen.map(sup => {
                              const isOverdue = sup.deadline_date && new Date(sup.deadline_date) < new Date()
                              const photos = sup.evidence_photos ? JSON.parse(sup.evidence_photos) : sup.evidence_photo_url ? [sup.evidence_photo_url] : []
                              return (
                                <div key={sup.id} className={`rounded-xl p-3 border ${isOverdue ? 'border-red-100 bg-red-50/40' : 'border-amber-100 bg-amber-50/30'}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900">{sup.checklist_item_name}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {sup.area === 'exterior' ? 'Area Luar' : sup.area === 'interior' ? 'Area Dalam Toko' : sup.area === 'butcher' ? 'Area Butcher' : 'Gudang'}
                                      </p>
                                    </div>
                                    <Badge variant={isOverdue ? 'destructive' : 'warning'}>
                                      {isOverdue ? 'Terlambat' : 'Open'}
                                    </Badge>
                                  </div>
                                  {sup.deadline_date && (
                                    <p className={`text-xs mt-1 flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                      <Calendar className="h-3 w-3" /> Deadline: {new Date(sup.deadline_date).toLocaleDateString('id-ID')}
                                      {isOverdue && ' ⚠️'}
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {vgCompleted.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1 pt-1">
                                <Check className="h-3 w-3" /> Sudah Selesai
                              </p>
                              {vgCompleted.map(sup => {
                                const photos = sup.evidence_photos ? JSON.parse(sup.evidence_photos) : sup.evidence_photo_url ? [sup.evidence_photo_url] : []
                                return (
                                  <div key={sup.id} className="rounded-xl p-3 border border-emerald-100 bg-emerald-50/20">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">{sup.checklist_item_name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                          {sup.area === 'exterior' ? 'Area Luar' : sup.area === 'interior' ? 'Area Dalam Toko' : sup.area === 'butcher' ? 'Area Butcher' : 'Gudang'}
                                        </p>
                                      </div>
                                      <Badge variant="success">Selesai</Badge>
                                    </div>
                                    {sup.completed_at && (
                                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                        <Clock className="h-3 w-3" /> Selesai: {new Date(sup.completed_at).toLocaleDateString('id-ID')}
                                      </p>
                                    )}
                                    {photos.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {photos.map((url: string, pi: number) => (
                                          <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} alt={`foto ${pi + 1}`} className="h-10 w-10 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer" />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
