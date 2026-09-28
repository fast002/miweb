'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [verificando, setVerificando] = useState(true)
  const [superadminEmail, setSuperadminEmail] = useState('')

  useEffect(() => {
    validarSuperadmin()
  }, [])

  const validarSuperadmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const email = (user.email || '').toLowerCase().trim()
      if (email !== 'ferchopla002@gmail.com' && email !== 'ferchoplay002@gmail.com') {
        router.push('/')
        return
      }

      setSuperadminEmail(email)
    } catch (err) {
      router.push('/')
    } finally {
      setVerificando(false)
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold tracking-widest uppercase text-indigo-400">Autenticando Credenciales de Superadministrador...</p>
        </div>
      </div>
    )
  }

  const navItems = [
    { name: '📋 Control de Escuelas y Licencias', href: '/admin/dashboard' },
    { name: '📚 Carga Académica de Asignaturas', href: '/admin/carga-asignaturas' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* BARRA LATERAL (SIDEBAR) */}
      <aside className="w-full md:w-72 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between p-6 shrink-0 shadow-2xl">
        <div className="space-y-8">
          
          {/* Logo / Título del Panel */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl shadow-lg shadow-indigo-500/30 text-base">👑</span>
              <h1 className="font-black text-sm tracking-widest uppercase bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
                Super Admin
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate pt-1">
              {superadminEmail}
            </p>
          </div>

          {/* Menú de Navegación */}
          <nav className="space-y-2">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase px-3 pb-1">Módulos Globales</p>
            {navItems.map((item) => {
              const activo = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition duration-200 ${
                    activo 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/50' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

        </div>

        {/* Sección Inferior / Cerrar Sesión */}
        <div className="pt-6 border-t border-slate-800/80 mt-6">
          <button
            onClick={cerrarSesion}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs uppercase tracking-wider rounded-xl border border-rose-500/20 transition duration-200 cursor-pointer shadow-sm"
          >
            <span>🚪 Cerrar Sesión Segura</span>
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 bg-slate-950 p-4 md:p-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>

    </div>
  )
}