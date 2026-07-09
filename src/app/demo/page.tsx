'use client'

import { Suspense } from 'react'
import { VisitForm } from '@/app/visit/new/page'

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50"><main className="p-6 text-center text-gray-400">Memuat...</main></div>}>
      <VisitForm demo />
    </Suspense>
  )
}
