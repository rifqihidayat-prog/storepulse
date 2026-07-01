'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Send, CheckCircle, MapPin, Smartphone, Monitor, DollarSign, ShoppingBag, Package } from 'lucide-react'
import type {
  Visit, Store, Profile, CashCheck, DepositValidation, ChecklistItem,
  StockCheck, Supervision, Briefing, Feedback, ChatMarketplace, StockSeparation,
  VisitAttendance, CashDenomination
} from '@/types'
import { DENOMINATIONS } from '@/types'

interface FullVisit {
  visit: Visit & { store: Store; supervisor: Profile }
  attendance: VisitAttendance | null
  cashCheck: CashCheck | null
  denominations: CashDenomination[]
  deposit: DepositValidation | null
  checklists: ChecklistItem[]
  stockChecks: StockCheck[]
  supervisions: Supervision[]
  briefing: Briefing | null
  feedback: Feedback | null
  chats: ChatMarketplace[]
  stockSep: StockSeparation | null
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    submitted: { label: 'Terkirim', variant: 'warning' },
    approved: { label: 'Disetujui', variant: 'success' },
    revision: { label: 'Revisi', variant: 'destructive' },
  }
  return map[status] || { label: status, variant: 'secondary' }
}

export default function VisitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<FullVisit | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || '')
      setUserId(user.id)

      const vid = params.id as string

      const { data: visit } = await supabase
        .from('visits')
        .select('*, store:stores(*), supervisor:profiles!visits_supervisor_id_fkey(*)')
        .eq('id', vid)
        .single()

      if (!visit) { setLoading(false); return }

      const [
        attendRes, cashRes, denomRes, depRes, clRes, stkRes,
        supRes, briefRes, fbRes, chatRes, sepRes
      ] = await Promise.all([
        supabase.from('visit_attendance').select('*').eq('visit_id', vid).maybeSingle(),
        supabase.from('visit_cash_checks').select('*').eq('visit_id', vid).maybeSingle(),
        supabase.from('visit_cash_denominations').select('*').eq('visit_id', vid),
        supabase.from('visit_deposits').select('*').eq('visit_id', vid).maybeSingle(),
        supabase.from('visit_checklists').select('*').eq('visit_id', vid),
        supabase.from('visit_stock_checks').select('*').eq('visit_id', vid),
        supabase.from('visit_supervisions').select('*').eq('visit_id', vid),
        supabase.from('visit_briefings').select('*').eq('visit_id', vid).maybeSingle(),
        supabase.from('visit_feedbacks').select('*').eq('visit_id', vid).maybeSingle(),
        supabase.from('visit_chat_marketplace').select('*').eq('visit_id', vid),
        supabase.from('visit_stock_separation').select('*').eq('visit_id', vid).maybeSingle(),
      ])

      setData({
        visit: visit as any,
        attendance: attendRes.data as any,
        cashCheck: cashRes.data as any,
        denominations: (denomRes.data || []) as CashDenomination[],
        deposit: depRes.data as any,
        checklists: (clRes.data || []) as ChecklistItem[],
        stockChecks: (stkRes.data || []) as StockCheck[],
        supervisions: (supRes.data || []) as Supervision[],
        briefing: briefRes.data,
        feedback: fbRes.data,
        chats: (chatRes.data || []) as ChatMarketplace[],
        stockSep: sepRes.data,
      })
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('visits').update({ status: 'submitted' }).eq('id', params.id)
      if (error) throw error
      router.refresh()
    } catch (err: any) {
      console.error('Submit error:', err)
      alert('Gagal mengirim: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white"><NavBar /><main className="p-6 text-center text-gray-400">Memuat...</main></div>
  if (!data) return <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white"><NavBar /><main className="p-6 text-center text-gray-400">Data tidak ditemukan</main></div>

  const { visit, attendance, cashCheck, denominations, deposit, checklists, stockChecks, supervisions, briefing, feedback, chats, stockSep } = data
  const sb = statusBadge(visit.status)

  const denomTotal = denominations.reduce((sum, d) => sum + d.denomination * d.quantity, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <NavBar />
      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <Badge variant={sb.variant}>{sb.label}</Badge>
        </div>

        {/* Info Kunjungan */}
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="border-b border-gray-50 pb-3">
            <CardTitle className="text-base text-emerald-800">Laporan Kunjungan Toko</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-1.5 text-sm">
            <p><span className="text-gray-400">Toko:</span> {visit.store?.name} ({visit.store?.code})</p>
            <p><span className="text-gray-400">Alamat:</span> {visit.store?.address || '-'}</p>
            <p><span className="text-gray-400">Supervisor:</span> {visit.supervisor?.name}</p>
            <p><span className="text-gray-400">Tanggal:</span> {visit.visit_date}</p>
            {visit.total_score !== null && (
              <p><span className="text-gray-400">Skor:</span> <span className="font-bold text-emerald-700 text-lg">{visit.total_score} / 100</span></p>
            )}
          </CardContent>
        </Card>

        {/* Attendance */}
        {attendance && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Absen Selfie & Lokasi
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {attendance.device_type === 'mobile' ? <Smartphone className="h-4 w-4 text-gray-400" /> : <Monitor className="h-4 w-4 text-gray-400" />}
                <span>Via {attendance.device_type === 'mobile' ? 'HP' : 'Laptop'}</span>
              </div>
              <p>
                <span className="text-gray-400">Lokasi:</span> {attendance.latitude.toFixed(6)}, {attendance.longitude.toFixed(6)}
                {attendance.is_location_match !== null && (
                  <span className={`ml-2 ${attendance.is_location_match ? 'text-emerald-600' : 'text-red-600'}`}>
                    {attendance.is_location_match ? '✅ Sesuai' : '❌ Tidak sesuai'}
                  </span>
                )}
              </p>
              {attendance.selfie_photo_url && (
                <img src={attendance.selfie_photo_url} alt="Selfie" className="max-w-[200px] rounded-xl border border-emerald-100 mt-1" />
              )}
            </CardContent>
          </Card>
        )}

        {/* Uang Modal & Pecahan */}
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="border-b border-gray-50 pb-3">
            <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Uang Modal &amp; Petty Cash
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            {cashCheck && (
              <div className="grid grid-cols-2 gap-2">
                <p><span className="text-gray-400">Modal Awal:</span> Rp {(cashCheck.initial_capital || 0).toLocaleString('id-ID')}</p>
                <p><span className="text-gray-400">Saldo Petty Cash:</span> Rp {(cashCheck.petty_cash_balance || 0).toLocaleString('id-ID')}</p>
                <p className="col-span-2"><span className="text-gray-400">Bon Klaim Belum Cair:</span> {cashCheck.has_pending_claim ? `⚠️ Ya, Rp ${(cashCheck.pending_claim_amount || 0).toLocaleString('id-ID')}` : '✅ Tidak ada'}</p>
              </div>
            )}
            {denominations.length > 0 && (
              <>
                <p className="font-medium text-gray-500 mt-2">Detail Pecahan:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {denominations.map(d => (
                    <div key={d.id} className="p-1.5 rounded bg-gray-50 text-xs">
                      <span className="text-gray-400">{d.type === 'coin' ? '🪙' : '💵'} Rp {d.denomination.toLocaleString('id-ID')}:</span>
                      <span className="font-medium ml-1">{d.quantity} {d.type === 'coin' ? 'koin' : 'lembar'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-emerald-700 font-medium">Total pecahan: Rp {denomTotal.toLocaleString('id-ID')}</p>
              </>
            )}
            {cashCheck && (
              <div className="mt-1">
                <p className={cashCheck.cashier_is_match ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
                  Total Pecahan vs Modal+PettyCash: {cashCheck.cashier_is_match ? '✅ Sesuai' : '❌ Tidak sesuai'}
                </p>
              </div>
            )}
            {cashCheck?.note && <p><span className="text-gray-400">Catatan:</span> {cashCheck.note}</p>}
          </CardContent>
        </Card>

        {/* Deposit */}
        {deposit && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="text-base text-emerald-800">📄 Validasi Setoran</CardTitle></CardHeader>
            <CardContent className="pt-4 text-sm space-y-2">
              <p><span className="text-gray-400">Status:</span> {deposit.has_pending ? '⚠️ Ada pending' : '✅ Clear'}</p>
              {deposit.photo_url && <img src={deposit.photo_url} alt="Form setoran" className="max-w-xs rounded-lg border border-emerald-100" />}
              {deposit.note && <p><span className="text-gray-400">Catatan:</span> {deposit.note}</p>}
            </CardContent>
          </Card>
        )}

        {/* Checklist Toko */}
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="border-b border-gray-50 pb-3">
            <CardTitle className="text-base text-emerald-800">📋 Ceklist Kondisi Toko</CardTitle></CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm">
            {checklists.length === 0 ? (
              <p className="text-gray-400">Belum ada data</p>
            ) : (
              (['exterior', 'interior', 'storage'] as const).map(area => {
                const areaLabel = area === 'exterior' ? 'Area Luar'
                  : area === 'interior' ? 'Area Dalam Toko' : 'Area Office, Gudang & Cold Storage'
                const items = checklists.filter(c => (c.area || 'exterior') === area)
                if (items.length === 0) return null
                return (
                  <div key={area}>
                    <h4 className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">{areaLabel}</h4>
                    {items.map((item, i) => (
                      <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-1.5 mt-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-gray-700 flex-1">{item.item_name}</span>
                          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                            item.status === 'baik' ? 'text-emerald-600 bg-emerald-50' :
                              item.status === 'kurang' ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                          }`}>
                            {item.status === 'baik' ? '✅ Baik' : item.status === 'kurang' ? '⚠️ Kurang' : '❌ Buruk'}
                          </span>
                        </div>
                        {item.note && <p className="text-xs text-gray-500"><span className="text-gray-400">Catatan:</span> {item.note}</p>}
                        {item.photo_url && <img src={item.photo_url} alt="Checklist" className="h-20 rounded-lg border border-gray-100" />}
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Stock Check */}
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="border-b border-gray-50 pb-3">
            <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
              <Package className="h-4 w-4" /> Random Cek 5 Item
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            {stockChecks.length === 0 ? (
              <p className="text-gray-400">Belum ada data</p>
            ) : (
              stockChecks.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">{item.item_name || `Item ${i + 1}`}</p>
                    <p className="text-xs text-gray-400">
                      Sistem: {item.system_stock} | Fisik: {item.physical_stock} | Terjual Blm Faktur: {item.sold_stock}
                    </p>
                  </div>
                  <span className={item.is_match ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs' : 'text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-xs'}>
                    {item.is_match ? '✅ Cocok' : '❌ Tidak'}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Supervisions */}
        {supervisions.length > 0 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="text-base text-emerald-800">🔍 Supervisi &amp; Tindak Lanjut</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-3 text-sm">
              {supervisions.map((item, i) => {
                const cl = checklists.find(c => c.item_name === item.checklist_item_name && c.area === item.area)
                const isOverdue = item.status === 'open' && item.deadline_date && new Date(item.deadline_date) < new Date()
                const photos = item.evidence_photos ? JSON.parse(item.evidence_photos) : item.evidence_photo_url ? [item.evidence_photo_url] : []
                return (
                <div key={item.id} className={`p-3 rounded-xl border ${isOverdue ? 'border-red-200 bg-red-50/20' : item.status === 'completed' ? 'border-emerald-100' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{item.checklist_item_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.area === 'exterior' ? 'Area Luar' : item.area === 'interior' ? 'Area Dalam Toko' : item.area === 'butcher' ? 'Area Butcher' : 'Area Gudang, Office & Cold Storage'}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      item.status === 'completed' ? 'text-emerald-600 bg-emerald-50' : isOverdue ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'
                    }`}>
                      {item.status === 'completed' ? '✅ Selesai' : isOverdue ? '⚠️ Terlambat' : '⏳ Open'}
                    </span>
                  </div>
                  {cl?.note && (
                    <div className="mt-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <p className="text-xs text-gray-400 mb-0.5">Catatan SPV:</p>
                      <p className="text-sm text-gray-700">{cl.note}</p>
                    </div>
                  )}
                  {cl?.photo_url && (
                    <img src={cl.photo_url} alt="Temuan" className="mt-2 h-20 rounded-lg border border-gray-200" />
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Deadline: {item.deadline_date || '-'}</span>
                    {item.completed_at && <span>Selesai: {new Date(item.completed_at).toLocaleDateString('id-ID')}</span>}
                  </div>
                  {photos.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Foto bukti staff:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {photos.map((url: string, pi: number) => (
                          <img key={pi} src={url} alt={`Bukti ${pi + 1}`} className="h-16 rounded-lg border border-gray-200" />
                        ))}
                      </div>
                    </div>
                  )}
                  {item.completed_note && (
                    <p className="mt-1 text-xs text-gray-600">Catatan staff: {item.completed_note}</p>
                  )}
                </div>
                )})}
            </CardContent>
          </Card>
        )}

        {/* Briefing */}
        {briefing && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="text-base text-emerald-800">💬 Briefing</CardTitle></CardHeader>
            <CardContent className="pt-4 text-sm space-y-2">
              {briefing.photo_url && <img src={briefing.photo_url} alt="Briefing" className="h-28 rounded-xl border border-emerald-100" />}
              {briefing.note && <p><span className="text-gray-400">Catatan:</span> {briefing.note}</p>}
            </CardContent>
          </Card>
        )}

        {/* Chat Marketplace */}
        {chats.length > 0 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="text-base text-emerald-800">📸 Chat Response Marketplace</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-2 text-sm">
              {chats.map((chat, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
                  <span className="font-medium w-20">{chat.marketplace === 'tiktok' ? 'TikTok' : 'Shopee'}</span>
                  <span className={chat.percentage !== null && chat.percentage >= 80 ? 'text-emerald-600' : chat.percentage !== null && chat.percentage >= 50 ? 'text-amber-600' : 'text-red-600'}>
                    {chat.percentage !== null ? `${chat.percentage}%` : '-'}
                  </span>
                  {chat.photo_url && <img src={chat.photo_url} alt={chat.marketplace} className="h-12 rounded-lg border border-emerald-100" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Stock Separation */}
        {stockSep && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="text-base text-emerald-800">🚚 Pemisahan Stok Online &amp; Offline</CardTitle></CardHeader>
            <CardContent className="pt-4 text-sm space-y-2">
              <p>
                <span className="text-gray-400">Status Stock Keeper:</span>{' '}
                <span className={
                  stockSep.status === 'sehat' ? 'text-emerald-600' :
                    stockSep.status === 'perhatian' ? 'text-amber-600' : 'text-red-600'
                }>
                  {stockSep.status === 'sehat' ? '✅ Sehat' : stockSep.status === 'perhatian' ? '⚠️ Perhatian' : '❌ Kritis'}
                </span>
              </p>
              {stockSep.imbalance_percentage !== null && (
                <p><span className="text-gray-400">Imbalance Stok:</span> {stockSep.imbalance_percentage}% {stockSep.imbalance_percentage < 10 ? '✅' : '❌'}</p>
              )}
              {stockSep.oversold_items !== null && (
                <p><span className="text-gray-400">Potensi Oversold:</span> {stockSep.oversold_items} item {stockSep.oversold_items < 5 ? '✅' : '❌'}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {stockSep.photo_items_url && <img src={stockSep.photo_items_url} alt="Item Bermasalah" className="h-28 rounded-xl border border-amber-100" />}
                {stockSep.photo_dashboard_url && <img src={stockSep.photo_dashboard_url} alt="Dashboard" className="h-28 rounded-xl border border-blue-100" />}
              </div>
              {stockSep.note && <p><span className="text-gray-400">Catatan:</span> {stockSep.note}</p>}
            </CardContent>
          </Card>
        )}

        {/* Review Notes */}
        {visit.review_notes && (
          <Card className="border-amber-100 bg-amber-50/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-800">📝 Catatan Review</CardTitle></CardHeader>
            <CardContent className="text-sm text-gray-700">{visit.review_notes}</CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => router.push(`/visit/${visit.id}/report`)}>
            <Download className="h-4 w-4" /> Download Report
          </Button>
          {visit.status === 'revision' && data?.visit.supervisor_id === userId && (
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => router.push(`/visit/new?edit=${visit.id}`)}>
              <Send className="h-4 w-4" /> Edit Laporan
            </Button>
          )}
        </div>

        {visit.manager_note && (
          <Card className="border-blue-200 bg-blue-50/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-800">Catatan Manager</CardTitle></CardHeader>
            <CardContent className="text-sm">{visit.manager_note}</CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
