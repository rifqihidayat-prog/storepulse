'use client'

import { Suspense } from 'react'
import { VisitForm } from '@/app/visit/new/page'
import { NavBar } from '@/components/nav-bar'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <NavBar />
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-center gap-2">
          <span className="font-semibold">🎯 Mode Demo</span>
          <span className="text-blue-600">— Aplikasi dalam mode presentasi. Data tidak disimpan.</span>
        </div>
      </div>
      <Suspense fallback={<div className="min-h-screen bg-gray-50"><main className="p-6 text-center text-gray-400">Memuat...</main></div>}>
        <VisitForm demo />
      </Suspense>
    </div>
  )
}
