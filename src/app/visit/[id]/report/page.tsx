'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, ArrowLeft, Download } from 'lucide-react'

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const [visitId, setVisitId] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    setVisitId(params.id as string)
    setLoading(false)
  }, [params.id])

  async function handleDownload() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/report?visitId=${visitId}`)
      if (!res.ok) throw new Error('Gagal generate report')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition')
      a.download = disposition?.match(/filename="?(.+?)"?$/)?.[1] || `Laporan-Kunjungan-${visitId.substring(0, 8)}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
    setGenerating(false)
  }

  if (loading) return <div className="min-h-screen bg-gray-50"><NavBar /><main className="p-6 text-center text-gray-400">Memuat...</main></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-2xl mx-auto p-4 md:p-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>

        <Card className="mt-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <FileText className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Laporan Kunjungan</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-500">
              Generate laporan dalam format Word (.docx) yang berisi seluruh data kunjungan, foto, dan skor.
            </p>
            <Button onClick={handleDownload} disabled={generating} size="lg">
              <Download className="h-5 w-5" />
              {generating ? 'Mengenerate...' : 'Download Report (.docx)'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
