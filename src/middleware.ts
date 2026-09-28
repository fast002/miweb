import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const { pathname } = request.nextUrl

  // 1. Rutas públicas que nunca deben bloquearse ni validar sesión en middleware
  if (
    pathname === '/' ||
    pathname.startsWith('/cambiar-password') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/iconos') ||
    pathname.includes('.')
  ) {
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        request.cookies.set({ name, value: '', ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  // Si no hay sesión en cookie pero intenta entrar a una ruta protegida
  if (!user) {
    // Si la ruta requiere auth estricta del servidor
    if (pathname.startsWith('/rector') || pathname.startsWith('/docente') || pathname.startsWith('/admin')) {
      // Dejamos pasar si viene de una redirección reciente de cliente para que el cliente valide localStorage
      // o redirigimos al login
      return response
    }
    return response
  }

  if (user) {
    // Buscar perfil buscando por ID o por Correo con maybeSingle() para que no truene
    const { data: docente } = await supabase
      .from('docentes')
      .select('rol, activo, requiere_cambio_password')
      .or(`id.eq.${user.id},email.ilike.${user.email}`)
      .maybeSingle()

    // 1. Si está inactivo, cerramos sesión
    if (docente?.activo === false) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/?error=usuario_inactivo', request.url))
    }

    // 2. Si requiere cambio de clave, enviarlo a /cambiar-password
    if (docente?.requiere_cambio_password === true && pathname !== '/cambiar-password') {
      return NextResponse.redirect(new URL('/cambiar-password', request.url))
    }

    // 3. Protección de ruta /rector
    if (pathname.startsWith('/rector')) {
      const rol = (docente?.rol || '').toLowerCase().trim()
      const esAutoridad = rol.includes('rector') || rol.includes('vicerrector') || rol.includes('director')

      // Si es superadmin también tiene acceso
      const esSuperAdmin = user.email === 'ferchopla002@gmail.com' || user.email === 'ferchoplay002@gmail.com'

      if (!esAutoridad && !esSuperAdmin) {
        return NextResponse.redirect(new URL('/docente', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto archivos estáticos (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}