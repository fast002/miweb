'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DocenteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [cargandoInstitucion, setCargandoInstitucion] = useState(true)
  const [nombreInstitucion, setNombreInstitucion] = useState('Unidad Educativa')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('Docente')
  const [rolUsuario, setRolUsuario] = useState('Docente')
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Menú con iconos vectoriales (SVG) profesionales
  const menuItems = [
    { 
      name: 'Dashboard', 
      path: '/docente', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
      ) 
    },
    { 
      name: 'Calificaciones', 
      path: '/docente/calificaciones', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
      ) 
    },
    { 
      name: 'Planificador', 
      path: '/docente/planificador', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
      ) 
    },
    { 
      name: 'Planificador Piloto', 
      path: '/docente/planificadorpiloto', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
      ) 
    },
    { 
      name: 'Planificador Inicial', 
      path: '/docente/planificadorinicial', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
      ) 
    },
    { 
      name: 'Crear Planificación', 
      path: '/docente/planificador/nuevo', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      ) 
    },
    { 
      name: 'Asistencia', 
      path: '/docente/asistencia', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4"></path></svg>
      ) 
    },
    { 
      name: 'Nómina (Estudiantes)', 
      path: '/docente/estudiantes', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
      ) 
    },
    { 
      name: 'Recomendaciones y Tutores', 
      path: '/docente/calificaciones/comportamiento-recomendaciones', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
      ) 
    },
    { 
      name: 'Supletorios', 
      path: '/docente/calificaciones/supletorios', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
      ) 
    },
    { 
      name: 'Consolidado Trimestral', 
      path: '/docente/calificaciones/consolidado', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
      ) 
    },
    { 
      name: 'Sábana Trimestral', 
      path: '/docente/calificaciones/sabana-trimestral', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
      ) 
    },
    { 
      name: 'Reportes Notas', 
      path: '/docente/calificaciones/reportes', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
      ) 
    },
    { 
      name: 'Reportes Asistencia', 
      path: '/docente/asistencia/reportes', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
      ) 
    },
  ]

  useEffect(() => {
    async function cargarDatosPerfilInstitucion() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: docenteData, error } = await supabase
          .from('docentes')
          .select(`
            nombres,
            apellidos,
            rol,
            institucion_id,
            instituciones (
              id,
              nombre_institucion,
              codigo_amie,
              logo_url
            )
          `)
          .eq('id', user.id)
          .single()

        if (error || !docenteData) {
          router.push('/')
          return
        }

        const rolActual = (docenteData.rol || '').toLowerCase()
        const rolesPermitidos = ['docente', 'superadmin']

        if (!rolesPermitidos.includes(rolActual)) {
          if (['rector', 'director', 'vicerrector', 'admin_institucional'].includes(rolActual)) {
            router.push('/rector')
          } else if (rolActual === 'inspector') {
            router.push('/inspector/dashboard')
          } else {
            router.push('/')
          }
          return
        }

        setNombreUsuario(`${docenteData.nombres || ''} ${docenteData.apellidos || ''}`.trim())
        setRolUsuario(docenteData.rol || 'Docente')
        
        const instRelacion = Array.isArray(docenteData.instituciones) 
          ? docenteData.instituciones[0] 
          : docenteData.instituciones

        if (instRelacion) {
          setNombreInstitucion(instRelacion.nombre_institucion || 'Unidad Educativa')
          setCodigoAmie(instsSeguro(instRelacion.codigo_amie) || 'S/N')
          setLogoUrl(instRelacion.logo_url || '')
        }
      } catch (err) {
        console.error('Error cargando datos del perfil docente o institución:', err)
        router.push('/')
      } finally {
        setCargandoInstitucion(false)
      }
    }
    cargarDatosPerfilInstitucion()
  }, [router])

  function instsSeguro(val: any) {
    return typeof val === 'string' ? val : (val?.toString() || 'S/N')
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (cargandoInstitucion) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center relative overflow-hidden">
        <div className="text-center space-y-4 relative z-10 bg-white p-8 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-600 tracking-wider uppercase">Cargando entorno institucional...</p>
        </div>
      </div>
    )
  }

  return (
    // CAMBIO REALIZADO AQUÍ: selection:bg-[#4b4c99] selection:text-white
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between selection:bg-[#4b4c99] selection:text-white overflow-x-hidden font-sans">
      
      {/* BARRA SUPERIOR MÓVIL */}
      <div className="md:hidden bg-[#4b4c99] text-white p-4 flex justify-between items-center border-b border-indigo-900/30 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <div className="p-1.5 bg-white rounded-xl border border-indigo-100 flex items-center justify-center h-9 w-9 shadow-2xs">
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-xs font-bold text-white line-clamp-1">{nombreInstitucion}</h1>
            <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wide">{rolUsuario}</span>
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
        {/* MENÚ LATERAL CON FONDO #4b4c99 Y TARJETAS ESTILO CARPETA */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 bg-[#4b4c99] text-white p-5 flex flex-col justify-between border-r border-indigo-900/30 shadow-[4px_0_24px_rgba(75,76,153,0.15)]
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Perfil Institucional y de Docente */}
            <div className="mb-4 text-center pb-5 border-b border-indigo-800/60 shrink-0">
              {logoUrl ? (
                <div className="p-2.5 bg-white rounded-2xl w-14 h-14 mx-auto mb-2.5 shadow-md border border-indigo-100 flex items-center justify-center">
                  <img src={logoUrl} alt="Logo Institucional" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-14 w-14 mx-auto bg-white text-[#4b4c99] rounded-2xl flex items-center justify-center font-black text-xl mb-2.5 shadow-md">
                  {nombreInstitucion.charAt(0)}
                </div>
              )}
              <h2 className="text-xs font-bold text-white line-clamp-1 px-2">{nombreInstitucion}</h2>
              <div className="mt-1.5 inline-block px-2.5 py-0.5 bg-indigo-900/50 border border-indigo-700/50 rounded-lg text-[10px] font-mono text-indigo-200">
                AMIE: {codigoAmie}
              </div>
              
              {/* Tarjeta de Docente */}
              <div className="mt-3 p-3 bg-indigo-900/40 rounded-2xl border border-indigo-700/40 shadow-2xs text-left">
                <p className="text-xs font-bold text-white line-clamp-1">{nombreUsuario}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wide">
                    Rol: {rolUsuario}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" title="Activo"></span>
                </div>
              </div>
            </div>
            
            {/* Navegación del Menú con iconos vectoriales */}
            <nav className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar" onClick={() => setMenuAbierto(false)}>
              {menuItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-200 border ${
                      isActive 
                        ? 'bg-white text-[#4b4c99] font-bold border-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] translate-x-1' 
                        : 'bg-indigo-900/25 border-indigo-700/40 text-indigo-100 hover:bg-indigo-800/60 hover:border-indigo-600 hover:text-white shadow-2xs'
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Cerrar Sesión
              </button>
            </nav>
          </div>

          {/* ZONA INFERIOR */}
          <div className="pt-3 border-t border-indigo-800/60 mt-2 shrink-0">
             <Link href="/" className="block text-center text-[10px] font-semibold text-indigo-300 hover:text-white uppercase tracking-wider transition">
              ← Salir al Inicio
             </Link>
          </div>
        </aside>

        {/* FONDO MÓVIL */}
        {menuAbierto && (
          <div 
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs z-20 md:hidden transition-opacity"
          />
        )}

        {/* CONTENIDO CENTRAL */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-full">
          {children}
        </main>
      </div>

      {/* PIE DE PÁGINA */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 md:px-8 text-center text-[11px] md:text-xs font-semibold text-slate-500 shadow-xs z-10 flex flex-col md:flex-row items-center justify-center gap-1">
        <span>Desarrollado por Educamet — Licencia cedida a:</span> 
        <span className="text-[#4b4c99] font-bold">{nombreInstitucion}</span> 
        <span className="text-slate-300 hidden md:inline">•</span>
        <span className="text-slate-400 font-medium">Derechos Reservados 2026</span>
      </footer>

    </div>
  )
}