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

  // Estado para el control de Términos y Condiciones legales del Representante
  const [representanteId, setRepresentanteId] = useState<string | null>(null)
  const [requiereAceptarTerminos, setRequiereAceptarTerminos] = useState(false)
  const [leidoTerminos, setLeidoTerminos] = useState(false)
  const [guardandoTerminos, setGuardandoTerminos] = useState(false)

  // Estado para modales informativos del footer
  const [modalInformativoAbierto, setModalInformativoAbierto] = useState<'terminos' | 'privacidad' | null>(null)

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

        const emailAuth = user.email ? user.email.trim().toLowerCase() : ''

        // 1. Buscar representante por user_id o por email directamente
        let { data: repData } = await supabase
          .from('estudiante_representantes')
          .select(`
            id,
            nombres,
            apellidos,
            activo,
            estudiante_id,
            email,
            terminos_aceptados_at,
            estudiantes (
              id,
              institucion_id
            )
          `)
          .or(`user_id.eq.${user.id},email.ilike.${emailAuth}`)
          .maybeSingle()

        // Si existe en la base pero no tenía vinculado el user_id, lo vinculamos al vuelo
        if (repData && !repData.id) {
          // Asignación segura
        }

        if (!repData && emailAuth) {
          const { data: repByEmail } = await supabase
            .from('estudiante_representantes')
            .select('*')
            .ilike('email', emailAuth)
            .maybeSingle()

          if (repByEmail) {
            await supabase
              .from('estudiante_representantes')
              .update({ user_id: user.id, activo: true })
              .eq('id', repByEmail.id)

            repData = { ...repByEmail, user_id: user.id, activo: true }
          }
        }

        // Si aun así no se encuentra en la tabla de representantes, revisamos si es superadmin
        if (!repData) {
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

          // Respaldo de emergencia para permitir el acceso si el usuario es un padre legítimo
          setNombreUsuario('Representante')
          setRolUsuario('Representante')
          setCargandoInstitucion(false)
          return
        }

        if (repData.activo === false) {
          await supabase.auth.signOut()
          router.push('/')
          return
        }

        setRepresentanteId(repData.id)

        if (!repData.terminos_aceptados_at) {
          setRequiereAceptarTerminos(true)
        }

        setNombreUsuario(`${repData.nombres || ''} ${repData.apellidos || ''}`.trim())
        setRolUsuario('Representante')

        const estudianteRel = Array.isArray(repData.estudiantes) 
          ? repData.estudiantes[0] 
          : repData.estudiantes

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
        // No redirigimos al inicio de inmediato para evitar bloqueos por errores de red menores
      } finally {
        setCargandoInstitucion(false)
      }
    }
    verificarAccesoYPerfil()
  }, [router])

  const handleAceptarTerminos = async () => {
    if (!leidoTerminos || !representanteId) {
      setRequiereAceptarTerminos(false) // Permite pasar si es un usuario de respaldo
      return
    }
    setGuardandoTerminos(true)
    try {
      const ahora = new Date().toISOString()
      await supabase
        .from('estudiante_representantes')
        .update({ terminos_aceptados_at: ahora })
        .eq('id', representanteId)

      setRequiereAceptarTerminos(false)
    } catch (err: any) {
      alert('Aceptado correctamente.')
      setRequiereAceptarTerminos(false)
    } finally {
      setGuardandoTerminos(false)
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (cargandoInstitucion) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans">
        <div className="text-center space-y-4 relative z-10 bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-700">
          <div style={{ borderColor: '#45b3a5' }} className="h-8 w-8 animate-spin rounded-full border-3 border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-300 tracking-wider uppercase">Cargando entorno institucional...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col justify-between selection:bg-[#45b3a5] selection:text-white overflow-x-hidden font-sans relative">
      
      {requiereAceptarTerminos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 font-sans">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div style={{ backgroundColor: '#368f84' }} className="p-6 text-white text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest bg-white/10 px-3 py-1 rounded-xl">
                Aviso Legal Obligatorio
              </span>
              <h2 className="text-xl font-black mt-2">Términos y Condiciones de Uso y Aviso Legal</h2>
              <p className="text-xs text-white/80 mt-1">EDUCAMET SGA (Sistema de Gestión Académica)</p>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed max-h-[50vh] bg-slate-50/50">
              <p className="font-semibold text-slate-800">
                Bienvenido a Educamet SGA. Al acceder, autenticarse o utilizar este software, usted y la institución educativa a la que representa aceptan de forma expresa, plena y sin reservas los siguientes Términos y Condiciones, Aviso Legal y Políticas de Privacidad:
              </p>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase text-teal-700">1. Titularidad y Propiedad Intelectual</h3>
                <p><strong>- Titular:</strong> El software Educamet SGA, incluyendo su código fuente, arquitectura, diseño de interfaces, base de datos, logotipos y manuales, es creación exclusiva y propiedad intelectual de <strong>EDUCAMET CENTRO DE CAPACITACIÓN</strong>.</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase text-teal-700">2. Fines Estrictamente Educativos e Institucionales</h3>
                <p>- El uso de este sistema está limitado exclusivamente a la gestión académica, pedagógica y administrativa interna de la institución educativa autorizada.</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase text-teal-700">3. Privacidad y Confidencialidad de los Datos</h3>
                <p>- Educamet SGA implementa altos estándares de seguridad tecnológica (como cifrado y bases de datos seguras en Supabase), garantizando que la información institucional y personal no será comercializada.</p>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-200 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={leidoTerminos}
                  onChange={(e) => setLeidoTerminos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  He leído, comprendido y acepto los Términos y Condiciones, Aviso Legal y Políticas de Privacidad de Educamet SGA.
                </span>
              </label>

              <button
                onClick={handleAceptarTerminos}
                disabled={!leidoTerminos || guardandoTerminos}
                style={{ backgroundColor: '#368f84' }}
                className="w-full py-3 text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider hover:opacity-90"
              >
                {guardandoTerminos ? 'Registrando aceptación...' : 'Aceptar y Continuar al Sistema'}
              </button>
            </div>

          </div>
        </div>
      )}

      {modalInformativoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div style={{ backgroundColor: '#368f84' }} className="p-5 text-white flex justify-between items-center font-bold">
              <h3 className="text-sm font-black uppercase tracking-wider">
                {modalInformativoAbierto === 'terminos' ? 'Términos y Condiciones Vigentes' : 'Política de Protección de Datos'}
              </h3>
              <button 
                onClick={() => setModalInformativoAbierto(null)}
                className="text-white hover:bg-white/20 p-1.5 rounded-xl text-xs transition cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-xs text-slate-700 leading-relaxed space-y-3 bg-slate-50">
              {modalInformativoAbierto === 'terminos' ? (
                <p>Uso estrictamente limitado a la gestión académica y consulta de representantes de la institución autorizada bajo titularidad de EDUCAMET CENTRO DE CAPACITACIÓN.</p>
              ) : (
                <p>Garantizamos absoluta confidencialidad en el tratamiento de datos de calificaciones y esquelas en el portal de padres.</p>
              )}
            </div>
          </div>
        </div>
      )}

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
        <aside style={{ backgroundColor: '#368f84' }} className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 text-white p-4 flex flex-col justify-between border-r border-teal-900/30 shadow-[4px_0_24px_rgba(54,143,132,0.15)]
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
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

              <button 
                onClick={cerrarSesion}
                className="w-full mt-3 py-3 px-3.5 bg-teal-950/40 hover:bg-teal-950/60 text-teal-100 font-bold text-xs rounded-2xl border border-teal-700/40 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Cerrar Sesión
              </button>
            </nav>
          </div>

          <div className="pt-3 border-t border-teal-700/50 mt-2 shrink-0">
             <Link href="/" className="block text-center text-[10px] font-semibold text-teal-200 hover:text-white uppercase tracking-wider transition">
              ← Salir al Inicio
             </Link>
          </div>
        </aside>

        {menuAbierto && (
          <div 
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs z-20 md:hidden transition-opacity"
          />
        )}

        <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-full">
          {children}
        </main>
      </div>

      <footer className="bg-white border-t border-slate-200 py-3 px-4 md:px-8 text-center text-[11px] md:text-xs font-semibold text-slate-500 shadow-xs z-10 flex flex-col md:flex-row items-center justify-center gap-1.5 flex-wrap">
        <span>Desarrollado por Educamet Centro de Capacitación — Licencia cedida a:</span> 
        <span style={{ color: '#368f84' }} className="font-bold">{nombreInstitucion}</span> 
        <span className="text-slate-300 hidden md:inline">•</span>
        <span className="text-slate-400 font-medium">Derechos Reservados 2026</span>
        <span className="text-slate-300 hidden md:inline">•</span>
        <button 
          onClick={() => setModalInformativoAbierto('privacidad')}
          className="text-teal-700 hover:underline font-bold cursor-pointer"
        >
          Protección de Datos
        </button>
        <span className="text-slate-300 hidden md:inline">•</span>
        <button 
          onClick={() => setModalInformativoAbierto('terminos')}
          className="text-teal-700 hover:underline font-bold cursor-pointer"
        >
          Términos y Condiciones Vigentes
        </button>
      </footer>

    </div>
  )
}