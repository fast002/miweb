'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function PadresLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [cargandoInstitucion, setCargandoInstitucion] = useState(true)
  const [nombreInstitucion, setNombreInstitucion] = useState('Unidad Educativa')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('Representante')
  const [rolUsuario, setRolUsuario] = useState('Representante')
  const [menuAbierto, setMenuAbierto] = useState(false)

  const menuItems = [
    { 
      name: 'Dashboard Principal', 
      path: '/padres', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
      ) 
    },
    { 
      name: 'Calificaciones', 
      path: '/padres/calificaciones', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
      ) 
    },
    { 
      name: 'Esquelas y Notificaciones', 
      path: '/padres/esquelas', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
      ) 
    },
    { 
      name: 'Reportes', 
      path: '/padres/reportes', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      ) 
    },
  ]

  useEffect(() => {
    async function verificarAccesoYPerfil() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: docenteData } = await supabase
          .from('docentes')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle()

        if (docenteData?.rol?.toLowerCase() === 'superadmin') {
          setNombreUsuario('Superadmin')
          setRolUsuario('Superadmin')
          const { data: insts } = await supabase.from('instituciones').select('*').limit(1)
          if (insts && insts[0]) {
            setNombreInstitucion(insts[0].nombre_institucion || 'Unidad Educativa')
            setCodigoAmie(insts[0].codigo_amie || 'S/N')
            setLogoUrl(insts[0].logo_url || '')
          }
          setCargandoInstitucion(false)
          return
        }

        let { data: repData, error: repError } = await supabase
          .from('estudiante_representantes')
          .select(`
            nombres,
            apellidos,
            activo,
            estudiante_id,
            email,
            estudiantes (
              id,
              institucion_id
            )
          `)
          .eq('user_id', user.id)

        if ((!repData || repData.length === 0) && user.email) {
          const { data: repByEmail } = await supabase
            .from('estudiante_representantes')
            .select('id')
            .ilike('email', user.email.trim())

          if (repByEmail && repByEmail.length > 0) {
            await supabase
              .from('estudiante_representantes')
              .update({ user_id: user.id, activo: true })
              .ilike('email', user.email.trim())

            const { data: repDataLinked } = await supabase
              .from('estudiante_representantes')
              .select(`
                nombres,
                apellidos,
                activo,
                estudiante_id,
                email,
                estudiantes (
                  id,
                  institucion_id
                )
              `)
              .eq('user_id', user.id)

            repData = repDataLinked
          }
        }

        if (repError || !repData || repData.length === 0) {
          router.push('/')
          return
        }

        const representante = repData[0]
        
        if (representante.activo === false) {
          router.push('/')
          return
        }

        setNombreUsuario(`${representante.nombres || ''} ${representante.apellidos || ''}`.trim())
        setRolUsuario('Representante')

        const estudianteRel = Array.isArray(representante.estudiantes) 
          ? representante.estudiantes[0] 
          : representante.estudiantes

        const instId = estudianteRel?.institucion_id

        if (instId) {
          const { data: instData } = await supabase
            .from('instituciones')
            .select('nombre_institucion, codigo_amie, logo_url')
            .eq('id', instId)
            .single()

          if (instData) {
            setNombreInstitucion(instData.nombre_institucion || 'Unidad Educativa')
            setCodigoAmie(instData.codigo_amie || 'S/N')
            setLogoUrl(instData.logo_url || '')
          }
        }

      } catch (err) {
        console.error('Error de seguridad en layout de padres:', err)
        router.push('/')
      } finally {
        setCargandoInstitucion(false)
      }
    }
    verificarAccesoYPerfil()
  }, [router])

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (cargandoInstitucion) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden">
        <div className="text-center space-y-4 relative z-10 bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-700">
          <div style={{ borderColor: '#45b3a5' }} className="h-8 w-8 animate-spin rounded-full border-3 border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-300 tracking-wider uppercase">Cargando entorno institucional...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col justify-between selection:bg-[#45b3a5] selection:text-white overflow-x-hidden font-sans">
      
      {/* BARRA SUPERIOR MÓVIL */}
      <div style={{ backgroundColor: '#368f84' }} className="md:hidden text-white p-4 flex justify-between items-center border-b border-teal-900/30 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <div className="p-1.5 bg-white rounded-xl border border-teal-100 flex items-center justify-center h-9 w-9 shadow-2xs">
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-xs font-bold text-white line-clamp-1">{nombreInstitucion}</h1>
            <span className="text-[10px] text-teal-100 font-bold uppercase tracking-wide">Portal {rolUsuario}</span>
          </div>
        </div>
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 rounded-xl text-xs font-bold text-white border border-teal-700/50 shadow-2xs active:scale-95 transition cursor-pointer"
        >
          {menuAbierto ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      <div className="flex flex-1 relative">
        {/* MENÚ LATERAL ESTILO DOCENTE CON COLOR #45b3a5 */}
        <aside style={{ backgroundColor: '#368f84' }} className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 text-white p-4 flex flex-col justify-between border-r border-teal-900/30 shadow-[4px_0_24px_rgba(54,143,132,0.15)]
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Perfil Institucional y de Representante */}
            <div className="mb-4 text-center pb-4 border-b border-teal-700/50 shrink-0">
              {logoUrl ? (
                <div className="p-2.5 bg-white rounded-2xl w-14 h-14 mx-auto mb-2 shadow-md border border-teal-100 flex items-center justify-center">
                  <img src={logoUrl} alt="Logo Institucional" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-14 w-14 mx-auto bg-white text-[#368f84] rounded-2xl flex items-center justify-center font-black text-xl mb-2 shadow-md">
                  {nombreInstitucion.charAt(0)}
                </div>
              )}
              <h2 className="text-xs font-bold text-white line-clamp-1 px-2">{nombreInstitucion}</h2>
              <div className="mt-1 inline-block px-2.5 py-0.5 bg-teal-950/40 border border-teal-700/40 rounded-lg text-[10px] font-mono text-teal-100">
                AMIE: {codigoAmie}
              </div>
              
              {/* Tarjeta de Usuario */}
              <div className="mt-3 p-3 bg-teal-900/40 rounded-2xl border border-teal-700/40 shadow-2xs text-left">
                <p className="text-xs font-bold text-white line-clamp-1">{nombreUsuario}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-bold text-teal-200 uppercase tracking-wide">
                    Rol: {rolUsuario}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" title="Activo"></span>
                </div>
              </div>
            </div>
            
            {/* Navegación del Menú con tarjetas estilo píldora */}
            <nav className="space-y-1.5 overflow-y-auto pr-1 flex-1 custom-scrollbar" onClick={() => setMenuAbierto(false)}>
              {menuItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-200 border ${
                      isActive 
                        ? 'bg-white text-[#368f84] font-bold border-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] translate-x-1' 
                        : 'bg-teal-900/20 border-teal-700/30 text-teal-100 hover:bg-teal-800/60 hover:border-teal-600 hover:text-white shadow-2xs'
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
                className="w-full mt-3 py-3 px-3.5 bg-teal-950/40 hover:bg-teal-950/60 text-teal-100 font-bold text-xs rounded-2xl border border-teal-700/40 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Cerrar Sesión
              </button>
            </nav>
          </div>

          {/* ZONA INFERIOR */}
          <div className="pt-3 border-t border-teal-700/50 mt-2 shrink-0">
             <Link href="/" className="block text-center text-[10px] font-semibold text-teal-200 hover:text-white uppercase tracking-wider transition">
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
        <span style={{ color: '#368f84' }} className="font-bold">{nombreInstitucion}</span> 
        <span className="text-slate-300 hidden md:inline">•</span>
        <span className="text-slate-400 font-medium">Derechos Reservados 2026</span>
      </footer>

    </div>
  )
}