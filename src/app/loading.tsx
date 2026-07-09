import { Store, Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <nav className="sticky top-0 z-50 w-full border-b border-emerald-100 bg-white/95 backdrop-blur-sm">
        <div className="flex h-14 items-center px-4 gap-4">
          <div className="flex items-center gap-2 font-semibold text-lg shrink-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-700 flex items-center justify-center">
              <Store className="h-4 w-4 text-white" />
            </div>
            <span className="hidden sm:inline text-emerald-900">StorePulse</span>
          </div>
        </div>
      </nav>
      <main className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
      </main>
    </div>
  )
}
