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
  const [menuAbierto, setMenuAbierto] = useState(false)

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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center relative overflow-hidden font-sans">
        <div className="text-center space-y-4 relative z-10 bg-white p-8 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-600 tracking-wider uppercase">
            Autenticando Credenciales de Superadministrador...
          </p>
        </div>
      </div>
    )
  }

  const navItems = [
    { 
      name: 'Control de Escuelas y Licencias', 
      href: '/admin/dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
        </svg>
      )
    },
    { 
      name: 'Carga Académica de Asignaturas', 
      href: '/admin/carga-asignaturas',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
      )
    },
  ]

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between selection:bg-[#4b4c99] selection:text-white overflow-x-hidden font-sans relative">
      
      {/* BARRA SUPERIOR MÓVIL */}
      <div className="md:hidden bg-[#4b4c99] text-white p-4 flex justify-between items-center border-b border-indigo-900/30 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white text-[#4b4c99] rounded-xl flex items-center justify-center h-9 w-9 shadow-2xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
          </div>
          <div>
            <h1 className="text-xs font-bold text-white line-clamp-1">Educamet SGA</h1>
            <span className="text-[10px] text-[#f6c358] font-bold uppercase tracking-wide">Superadministrador</span>
          </div>
        </div>
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="px-3.5 py-2 bg-indigo-800 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white border border-indigo-700/50 shadow-2xs active:scale-95 transition cursor-pointer"
        >
          {menuAbierto ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      <div className="flex flex-1 relative">
        {/* BARRA LATERAL (SIDEBAR) */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 bg-[#4b4c99] text-white p-5 flex flex-col justify-between border-r border-indigo-900/30 shadow-[4px_0_24px_rgba(75,76,153,0.15)]
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Cabecera Institucional del Super Admin */}
            <div className="mb-4 text-center pb-5 border-b border-indigo-800/60 shrink-0">
              <div className="h-14 w-14 mx-auto bg-white text-[#4b4c99] rounded-2xl flex items-center justify-center mb-2.5 shadow-md border border-indigo-100">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
              </div>
              <h2 className="text-xs font-bold text-white tracking-wide uppercase">Educamet SGA</h2>
              <div className="mt-1.5 inline-block px-2.5 py-0.5 bg-[#f6c358]/20 border border-[#f6c358]/40 rounded-lg text-[10px] font-bold text-[#f6c358] uppercase tracking-wider">
                Control Central
              </div>

              {/* Tarjeta de Credenciales */}
              <div className="mt-3 p-3 bg-indigo-900/40 rounded-2xl border border-indigo-700/40 shadow-2xs text-left">
                <p className="text-[11px] font-bold text-white truncate" title={superadminEmail}>
                  {superadminEmail}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wide">
                    Rol: Super Admin
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" title="Sesión Activa"></span>
                </div>
              </div>
            </div>

            {/* Menú de Navegación */}
            <nav className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar" onClick={() => setMenuAbierto(false)}>
              <p className="text-[10px] font-bold tracking-wider text-indigo-200 uppercase px-2 pb-1">
                Módulos Globales
              </p>
              {navItems.map((item) => {
                const activo = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-200 border ${
                      activo 
                        ? 'bg-white text-[#4b4c99] font-bold border-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] translate-x-1' 
                        : 'bg-indigo-900/25 border-indigo-700/40 text-indigo-100 hover:bg-indigo-800/60 hover:border-indigo-600 hover:text-white shadow-2xs font-semibold'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="text-xs truncate">{item.name}</span>
                  </Link>
                )
              })}

              {/* Botón de Cerrar Sesión */}
              <button
                onClick={cerrarSesion}
                className="w-full mt-4 py-3 px-3.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold text-xs rounded-2xl border border-rose-400/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                <span>Cerrar Sesión Segura</span>
              </button>
            </nav>
          </div>

          {/* Zona Inferior */}
          <div className="pt-3 border-t border-indigo-800/60 mt-2 shrink-0">
            <Link href="/" className="block text-center text-[10px] font-semibold text-indigo-300 hover:text-white uppercase tracking-wider transition">
              ← Salir al Inicio
            </Link>
          </div>
        </aside>

        {/* FONDO OSCURO MÓVIL */}
        {menuAbierto && (
          <div 
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs z-20 md:hidden transition-opacity"
          />
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-full">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* PIE DE PÁGINA CORPORATIVO */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 md:px-8 text-center text-[11px] md:text-xs font-semibold text-slate-500 shadow-xs z-10 flex flex-col md:flex-row items-center justify-center gap-1.5 flex-wrap">
        <span>Consola de Administración Global —</span> 
        <span className="text-[#4b4c99] font-bold">Educamet Centro de Capacitación</span> 
        <span className="text-slate-300 hidden md:inline">•</span>
        <span className="text-slate-400 font-medium">Derechos Reservados 2026</span>
      </footer>

    </div>
  )
}