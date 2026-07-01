'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, ArrowLeft, Download } from 'lucide-react'
import type { Visit } from '@/types'

export default function VerifyPage() {
  const params = useParams()
  const router = useRouter()
  const [visit, setVisit] = useState<(Visit & { store: any; supervisor: any }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'manager') {
        router.push('/dashboard')
        return
      }

      const { data } = await supabase
        .from('visits')
        .select('*, store:stores(*), supervisor:profiles!visits_supervisor_id_fkey(*)')
        .eq('id', params.id)
        .single()

      setVisit(data as any)
      setLoading(false)
    }
    load()
  }, [params.id, router])

  async function handleApprove() {
    setProcessing(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('visits').update({
      status: 'approved',
      manager_id: user?.id,
      manager_note: note || null,
    }).eq('id', params.id)
    setProcessing(false)
    router.push('/dashboard')
    router.refresh()
  }

  if (loading) return <div className="min-h-screen bg-gray-50"><NavBar /><main className="p-6 text-center text-gray-400">Memuat...</main></div>
  if (!visit) return <div className="min-h-screen bg-gray-50"><NavBar /><main className="p-6 text-center text-gray-400">Data tidak ditemukan</main></div>

  const isFinalized = visit.status !== 'submitted'

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          {visit.status === 'approved' ? (
            <Badge variant="success">✅ Disetujui</Badge>
          ) : visit.status === 'revision' ? (
            <Badge variant="destructive">📝 Minta Revisi</Badge>
          ) : (
            <Badge variant="warning">Menunggu Verifikasi</Badge>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Verifikasi Laporan Kunjungan</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-gray-400">Toko:</span> {visit.store?.name}</p>
            <p><span className="text-gray-400">Supervisor:</span> {visit.supervisor?.name}</p>
            <p><span className="text-gray-400">Tanggal:</span> {visit.visit_date}</p>
            {visit.total_score !== null && (
              <p><span className="text-gray-400">Skor:</span> <span className="font-bold text-blue-600 text-lg">{visit.total_score}</span> / 100</p>
            )}
            {visit.status === 'approved' && <p className="text-emerald-600 font-medium mt-2">✅ Laporan ini sudah disetujui.</p>}
            {visit.status === 'revision' && <p className="text-red-600 font-medium mt-2">📝 Laporan ini diminta revisi.</p>}
            {visit.status === 'draft' && <p className="text-gray-500 font-medium mt-2">⏳ Laporan masih draft, belum dikirim supervisor.</p>}
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => router.push(`/visit/${visit.id}`)}>
            <Download className="h-4 w-4" /> Lihat Detail Laporan
          </Button>
        </div>

        {!isFinalized && (
          <Card>
            <CardHeader><CardTitle className="text-base">Catatan Verifikasi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Tambahkan catatan untuk supervisor (opsional)..."
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={4}
              />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push(`/visit/${visit.id}/report`)}>
                  <Download className="h-4 w-4" /> Download Report
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  <CheckCircle className="h-4 w-4" /> Setujui
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
