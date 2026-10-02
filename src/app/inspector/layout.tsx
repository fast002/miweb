'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function InspectorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [cargandoInstitucion, setCargandoInstitucion] = useState(true)
  const [nombreInstitucion, setNombreInstitucion] = useState('Unidad Educativa')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('Inspector(a)')
  const [rolUsuario, setRolUsuario] = useState('Inspector(a)')
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Menú con iconos vectoriales (SVG) profesionales para el Inspector
  const menuItems = [
    { 
      name: 'Dashboard', 
      path: '/inspector/dashboard', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
      ) 
    },
    { 
      name: 'Gestión de Esquelas', 
      path: '/inspector/esquelas', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
      ) 
    },
    { 
      name: 'Asistencias', 
      path: '/inspector/asistencia', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4"></path></svg>
      ) 
    },
    { 
      name: 'Pases de Salida', 
      path: '/inspector/pases', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
      ) 
    },
    { 
      name: 'Padres de familia', 
      path: '/inspector/padres', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
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
        const rolesPermitidos = ['inspector', 'superadmin']

        if (!rolesPermitidos.includes(rolActual)) {
          if (['rector', 'director', 'vicerrector', 'admin_institucional'].includes(rolActual)) {
            router.push('/rector')
          } else {
            router.push('/docente')
          }
          return
        }

        setNombreUsuario(`${docenteData.nombres || ''} ${docenteData.apellidos || ''}`.trim())
        setRolUsuario(docenteData.rol || 'Inspector(a)')
        
        const instRelacion = Array.isArray(docenteData.instituciones) 
          ? docenteData.instituciones[0] 
          : docenteData.instituciones

        if (instRelacion) {
          setNombreInstitucion(instRelacion.nombre_institucion || 'Unidad Educativa')
          setCodigoAmie(instsSeguro(instRelacion.codigo_amie) || 'S/N')
          setLogoUrl(instRelacion.logo_url || '')
        }
      } catch (err) {
        console.error('Error cargando datos del perfil de inspector o institución:', err)
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
          <div style={{ borderColor: '#de5860' }} className="h-8 w-8 animate-spin rounded-full border-3 border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-600 tracking-wider uppercase">Cargando entorno institucional...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between selection:bg-[#de5860] selection:text-white overflow-x-hidden font-sans">
      
      {/* BARRA SUPERIOR MÓVIL */}
      <div style={{ backgroundColor: '#de5860' }} className="md:hidden text-white p-4 flex justify-between items-center border-b border-rose-900/30 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <div className="p-1.5 bg-white rounded-xl border border-rose-100 flex items-center justify-center h-9 w-9 shadow-2xs">
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-xs font-bold text-white line-clamp-1">{nombreInstitucion}</h1>
            <span className="text-[10px] text-rose-100 font-bold uppercase tracking-wide">{rolUsuario}</span>
          </div>
        </div>
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 rounded-xl text-xs font-bold text-white border border-rose-600/50 shadow-2xs active:scale-95 transition cursor-pointer"
        >
          {menuAbierto ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      <div className="flex flex-1 relative">
        {/* MENÚ LATERAL CON FONDO #de5860 Y TARJETAS ESTILO CARPETA */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 bg-[#de5860] text-white p-5 flex flex-col justify-between border-r border-rose-900/30 shadow-[4px_0_24px_rgba(222,88,96,0.15)]
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Perfil Institucional y de Inspector */}
            <div className="mb-4 text-center pb-5 border-b border-rose-800/60 shrink-0">
              {logoUrl ? (
                <div className="p-2.5 bg-white rounded-2xl w-14 h-14 mx-auto mb-2.5 shadow-md border border-rose-100 flex items-center justify-center">
                  <img src={logoUrl} alt="Logo Institucional" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-14 w-14 mx-auto bg-white text-[#de5860] rounded-2xl flex items-center justify-center font-black text-xl mb-2.5 shadow-md">
                  {nombreInstitucion.charAt(0)}
                </div>
              )}
              <h2 className="text-xs font-bold text-white line-clamp-1 px-2">{nombreInstitucion}</h2>
              <div className="mt-1.5 inline-block px-2.5 py-0.5 bg-rose-900/50 border border-rose-700/50 rounded-lg text-[10px] font-mono text-rose-200">
                AMIE: {codigoAmie}
              </div>
              
              {/* Tarjeta de Inspector */}
              <div className="mt-3 p-3 bg-rose-900/40 rounded-2xl border border-rose-700/40 shadow-2xs text-left">
                <p className="text-xs font-bold text-white line-clamp-1">{nombreUsuario}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-bold text-rose-200 uppercase tracking-wide">
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
                        ? 'bg-white text-[#de5860] font-bold border-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] translate-x-1' 
                        : 'bg-rose-900/25 border-rose-700/40 text-rose-100 hover:bg-rose-800/60 hover:border-rose-600 hover:text-white shadow-2xs'
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
                className="w-full mt-4 py-3 px-3.5 bg-rose-950/40 hover:bg-rose-950/60 text-rose-100 font-bold text-xs rounded-2xl border border-rose-700/50 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Cerrar Sesión
              </button>
            </nav>
          </div>

          {/* ZONA INFERIOR */}
          <div className="pt-3 border-t border-rose-800/60 mt-2 shrink-0">
             <Link href="/" className="block text-center text-[10px] font-semibold text-rose-200 hover:text-white uppercase tracking-wider transition">
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
        <span style={{ color: '#de5860' }} className="font-bold">{nombreInstitucion}</span> 
        <span className="text-slate-300 hidden md:inline">•</span>
        <span className="text-slate-400 font-medium">Derechos Reservados 2026</span>
      </footer>

    </div>
  )
}