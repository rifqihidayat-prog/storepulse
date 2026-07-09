import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    // Check role to redirect appropriately
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const url = request.nextUrl.clone()
    url.pathname = profile?.role === 'staff' ? '/staff/follow-up' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // Redirect staff away from dashboard and other pages meant for supervisor/manager
  // Also redirect supervisor away from /stores and /users
  if (user) {
    const blockedForStaff = ['/dashboard', '/visit/new', '/users', '/stores', '/demo']
    const blockedForSupervisor = ['/users', '/stores']
    if (blockedForStaff.includes(pathname) || blockedForSupervisor.includes(pathname)) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'staff') {
        const url = request.nextUrl.clone()
        url.pathname = '/staff/follow-up'
        return NextResponse.redirect(url)
      }
      if (profile?.role === 'supervisor' && blockedForSupervisor.includes(pathname)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
