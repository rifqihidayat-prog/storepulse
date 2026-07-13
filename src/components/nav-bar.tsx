'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Store, ClipboardList, Users, LogOut, Menu, X, Building2, FileText, CheckCircle, PlayCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Module-level cache agar NavBar tidak re-fetch user role tiap navigasi
let _cachedRole: string | null | undefined = undefined
let _cachedName: string | null | undefined = undefined

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(_cachedRole ?? null)
  const [userName, setUserName] = useState<string | null>(_cachedName ?? null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (_cachedRole !== undefined && _cachedName !== undefined) return
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) {
          _cachedRole = data.role
          _cachedName = data.name
          setUserRole(data.role)
          setUserName(data.name)
        }
      }
    }
    load()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const allLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: ClipboardList, roles: ['supervisor', 'manager'] },
    { href: '/visit/new', label: 'Kunjungan Baru', icon: FileText, roles: ['supervisor', 'manager'] },
    { href: '/stores', label: 'Data Toko', icon: Building2, roles: ['manager'] },
    { href: '/follow-up', label: 'Follow-Up', icon: CheckCircle, roles: ['supervisor', 'manager'] },
    { href: '/users', label: 'Kelola User', icon: Users, roles: ['manager'] },
    { href: '/staff/follow-up', label: 'Follow-Up', icon: CheckCircle, roles: ['staff'] },
  ]

  const links = userRole ? allLinks.filter(l => l.roles.includes(userRole)) : []

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-emerald-100 bg-white/95 backdrop-blur-sm">
      <div className="flex h-14 items-center px-4 gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg shrink-0">
          <div className="h-8 w-8 rounded-lg bg-emerald-700 flex items-center justify-center">
            <Store className="h-4 w-4 text-white" />
          </div>
          <span className="hidden sm:inline text-emerald-900">StorePulse</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 ml-6">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-500 hidden sm:block">{userName}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-emerald-100 bg-white p-2 space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                  isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
          <button
            onClick={() => { handleLogout(); setMobileOpen(false) }}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 w-full"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
