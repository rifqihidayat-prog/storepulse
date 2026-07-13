'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Store, FileText, CheckCircle, Clock, Plus, Eye, TrendingUp, Building2, Filter, Trash2 } from 'lucide-react'
import type { Visit, Store as StoreType, Profile } from '@/types'

interface VisitWithStore extends Visit {
  store: StoreType
  supervisor: Profile
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    submitted: { label: 'Terkirim', variant: 'warning' },
    approved: { label: 'Disetujui', variant: 'success' },
    revision: { label: 'Revisi', variant: 'destructive' },
  }
  return map[status] || { label: status, variant: 'secondary' }
}

const MONTHS = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' }, { value: '3', label: 'Maret' },
  { value: '4', label: 'April' }, { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' }, { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' }, { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
]

function getLastDay(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export default function DashboardPage() {
  const [visits, setVisits] = useState<VisitWithStore[]>([])
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [storeCount, setStoreCount] = useState(0)
  const [supervisors, setSupervisors] = useState<Profile[]>([])
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSupervisor, setFilterSupervisor] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const hasFilter = filterMonth || filterYear || filterSupervisor

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) {
        setUserName(profile.name)
        setUserRole(profile.role)
      }

      const { count } = await supabase.from('stores').select('*', { count: 'exact', head: true })
      setStoreCount(count || 0)

      if (profile?.role === 'manager') {
        const { data: supData } = await supabase.from('profiles').select('*').eq('role', 'supervisor').order('name')
        if (supData) setSupervisors(supData)
      }

      let query = supabase
        .from('visits')
        .select('*, store:stores(*), supervisor:profiles!visits_supervisor_id_fkey(*)')
        .order('created_at', { ascending: false })

      if (profile?.role === 'supervisor') {
        query = query.eq('supervisor_id', user.id)
      }

      const isFiltered = !!profile && (
        (profile.role === 'manager' && (filterMonth || filterYear || filterSupervisor))
      )

      if (isFiltered) {
        if (filterMonth && filterYear) {
          const y = parseInt(filterYear)
          const m = parseInt(filterMonth)
          const lastDay = getLastDay(y, m)
          query = query
            .gte('visit_date', `${filterYear}-${filterMonth.padStart(2, '0')}-01`)
            .lte('visit_date', `${filterYear}-${filterMonth.padStart(2, '0')}-${lastDay}`)
        } else if (filterYear) {
          query = query
            .gte('visit_date', `${filterYear}-01-01`)
            .lte('visit_date', `${filterYear}-12-31`)
        }
        if (filterSupervisor) {
          query = query.eq('supervisor_id', filterSupervisor)
        }
        query = query.limit(500)
      } else {
        query = query.limit(20)
      }

      const { data } = await query
      setVisits((data || []) as unknown as VisitWithStore[])
      setLoading(false)
    }
    load()
  }, [filterMonth, filterYear, filterSupervisor])

  const stats = {
    total: visits.length,
    submitted: visits.filter(v => v.status === 'submitted').length,
    approved: visits.filter(v => v.status === 'approved').length,
    draft: visits.filter(v => v.status === 'draft').length,
  }

  // Summary per supervisor (hanya saat filter aktif)
  const supervisorSummary: { name: string; count: number; stores: string[] }[] = []
  if (hasFilter && userRole === 'manager' && !filterSupervisor) {
    const grouped: Record<string, { name: string; stores: Set<string> }> = {}
    for (const v of visits) {
      const sid = v.supervisor_id
      if (!grouped[sid]) grouped[sid] = { name: v.supervisor?.name || 'Unknown', stores: new Set() }
      if (v.store?.name) grouped[sid].stores.add(v.store.name)
    }
    for (const key of Object.keys(grouped)) {
      supervisorSummary.push({ name: grouped[key].name, count: grouped[key].stores.size, stores: [...grouped[key].stores] })
    }
    supervisorSummary.sort((a, b) => b.count - a.count)
  }

  function clearFilters() {
    setFilterMonth('')
    setFilterYear('')
    setFilterSupervisor('')
  }

  async function handleDelete(visitId: string) {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('visits').delete().eq('id', visitId)
    if (error) {
      setDeleting(false)
      setConfirmDeleteId(null)
      return
    }
    setVisits(prev => prev.filter(v => v.id !== visitId))
    setDeleting(false)
    setConfirmDeleteId(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <NavBar />
      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">Dashboard</h1>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              {userRole === 'manager' ? 'Manager' : 'Supervisor'}: {userName}
            </p>
          </div>
          <Link href="/visit/new">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm">
              <Plus className="h-4 w-4" />
              Kunjungan Baru
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-gray-500">Total Kunjungan</CardTitle>
              <FileText className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-2xl font-bold text-emerald-900">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-gray-500">Draft</CardTitle>
              <Clock className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-2xl font-bold text-gray-500">{stats.draft}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-gray-500">Terkirim</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-2xl font-bold text-amber-600">{stats.submitted}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-gray-500">Disetujui</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-gray-500">Toko</CardTitle>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <p className="text-2xl font-bold text-emerald-900">{storeCount}</p>
            </CardContent>
          </Card>
        </div>

        {userRole === 'manager' && (
          <Card className="border-emerald-100 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Filter className="h-4 w-4" /> Filter
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-gray-400 mb-1 block">Bulan</label>
                  <Select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                    <option value="">Semua Bulan</option>
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs text-gray-400 mb-1 block">Tahun</label>
                  <Select value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                    <option value="">Semua Tahun</option>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs text-gray-400 mb-1 block">Supervisor</label>
                  <Select value={filterSupervisor} onChange={e => setFilterSupervisor(e.target.value)}>
                    <option value="">Semua Supervisor</option>
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
                {hasFilter && (
                  <div className="flex items-end">
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Hapus Filter
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {supervisorSummary.length > 0 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="text-base text-emerald-900">Ringkasan per Supervisor</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {supervisorSummary.map(s => (
                  <div key={s.name} className="p-3 rounded-xl border border-gray-100 bg-emerald-50/20">
                    <p className="font-medium text-sm text-emerald-900">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {s.count} toko dikunjungi
                    </p>
                    {s.stores.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.stores.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-base text-emerald-900">
              {hasFilter ? `Riwayat Kunjungan (${visits.length})` : 'Riwayat Kunjungan'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="text-center py-8 text-gray-400">Memuat...</div>
            ) : visits.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="inline-flex h-12 w-12 rounded-full bg-emerald-50 items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="font-medium text-gray-500">
                  {hasFilter ? 'Tidak ada kunjungan dengan filter ini' : 'Belum ada kunjungan'}
                </p>
                {!hasFilter && (
                  <Link href="/visit/new" className="inline-block mt-3">
                    <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800">Buat Kunjungan Pertama</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {visits.map((visit) => (
                  <Link
                    key={visit.id}
                    href={userRole === 'manager' ? `/visit/${visit.id}/verify` : `/visit/${visit.id}`}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex h-9 w-9 rounded-lg bg-emerald-100 items-center justify-center">
                        <Store className="h-4 w-4 text-emerald-700" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{visit.store?.name || 'Unknown Store'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {visit.visit_date} &middot; {visit.supervisor?.name || 'Unknown'}
                          {visit.total_score !== null && (
                            <span className="ml-2 font-medium text-emerald-700">Skor: {visit.total_score}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadge(visit.status).variant}>
                        {statusBadge(visit.status).label}
                      </Badge>
                      <Eye className="h-4 w-4 text-gray-300" />
                      {userRole === 'manager' && (
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(visit.id) }}
                          className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-gray-900">Hapus Kunjungan</h3>
              <p className="text-sm text-gray-500 mt-2">Yakin ingin menghapus kunjungan ini? Data tidak bisa dikembalikan.</p>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
                  Batal
                </Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(confirmDeleteId)} disabled={deleting}>
                  {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
