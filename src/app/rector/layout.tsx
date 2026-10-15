'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RectorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [cargandoInstitucion, setCargandoInstitucion] = useState(true)
  const [nombreInstitucion, setNombreInstitucion] = useState('Unidad Educativa')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [nombreAutoridad, setNombreAutoridad] = useState('Rectorado')
  const [rolAutoridad, setRolAutoridad] = useState('Rector')
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Estado para el control de Términos y Condiciones legales del Rectorado
  const [userId, setUserId] = useState<string | null>(null)
  const [requiereAceptarTerminos, setRequiereAceptarTerminos] = useState(false)
  const [leidoTerminos, setLeidoTerminos] = useState(false)
  const [guardandoTerminos, setGuardandoTerminos] = useState(false)

  // Estado para mostrar modales informativos desde el footer
  const [modalInformativoAbierto, setModalInformativoAbierto] = useState<'terminos' | 'privacidad' | null>(null)

  // Opciones del menú con iconos vectoriales (SVG) profesionales e incorporando Oficios, Circulares y NEE
  const menuItems = [
    { 
      name: 'Dashboard Rectoral', 
      path: '/rector',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
      )
    },
    { 
      name: 'Registro de Usuarios', 
      path: '/rector/dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
      )
    },
    { 
      name: 'Carga Horaria', 
      path: '/rector/asignaciones-docentes',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4"></path></svg>
      )
    },
    { 
      name: 'Asignaturas', 
      path: '/rector/asignaturas',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
      )
    },
    { 
      name: 'Calificaciones', 
      path: '/rector/calificaciones',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
      )
    },
    { 
      name: 'Planificaciones', 
      path: '/rector/dashboard/revision',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
      )
    },
    { 
      name: 'Oficios y Circulares', 
      path: '/rector/oficios',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      )
    },
    { 
      name: 'Estudiantes NEE', 
      path: '/rector/nee',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
      )
    },
    { 
      name: 'Padres de Familia', 
      path: '/rector/padres',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
      )
    },
    { 
      name: 'Nómina Estudiantil', 
      path: '/rector/estudiantes',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
      )
    },
    { 
      name: 'Histórico de Notas', 
      path: '/rector/historico',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      )
    },
  ]

  useEffect(() => {
    async function cargarDatosRectorInstitucion() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        setUserId(user.id)

        const { data: docData, error } = await supabase
          .from('docentes')
          .select('nombres, apellidos, rol, terminos_aceptados_at, instituciones(*)')
          .eq('id', user.id)
          .maybeSingle()

        if (error || !docData) {
          router.push('/')
          return
        }

        if (!docData.terminos_aceptados_at) {
          setRequiereAceptarTerminos(true)
        }

        const rolActual = (docData.rol || '').toLowerCase()
        const rolesPermitidos = ['rector', 'superadmin', 'director', 'vicerrector', 'admin_institucional']

        if (!rolesPermitidos.includes(rolActual)) {
          if (rolActual === 'inspector') {
            router.push('/inspector/dashboard')
          } else {
            router.push('/docente')
          }
          return
        }

        setNombreAutoridad(`${docData.nombres || ''} ${docData.apellidos || ''}`.trim())
        setRolAutoridad(docData.rol || 'Rector')
        
        const instRelacion = Array.isArray(docData.instituciones) 
          ? docData.instituciones[0] 
          : docData.instituciones

        if (instRelacion) {
          setNombreInstitucion(instRelacion.nombre_institucion || 'Unidad Educativa')
          setCodigoAmie(instsSeguro(instRelacion.codigo_amie) || 'S/N')
          setLogoUrl(instRelacion.logo_url || '')
        }
      } catch (err) {
        console.error('Error cargando perfil del rector o institución:', err)
        router.push('/')
      } finally {
        setCargandoInstitucion(false)
      }
    }
    cargarDatosRectorInstitucion()
  }, [router])

  const handleAceptarTerminos = async () => {
    if (!leidoTerminos || !userId) return
    setGuardandoTerminos(true)
    try {
      const ahora = new Date().toISOString()
      const { error } = await supabase
        .from('docentes')
        .update({ terminos_aceptados_at: ahora })
        .eq('id', userId)

      if (error) throw error

      setRequiereAceptarTerminos(false)
    } catch (err: any) {
      alert('Error al registrar la aceptación: ' + err.message)
    } finally {
      setGuardandoTerminos(false)
    }
  }

  function instsSeguro(val: any) {
    return typeof val === 'string' ? val : (val?.toString() || 'S/N')
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (cargandoInstitucion) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center relative overflow-hidden font-sans">
        <div className="text-center space-y-4 relative z-10 bg-white p-8 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#f6c358] border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-600 tracking-wider uppercase">Cargando entorno directivo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between selection:bg-[#f6c358] selection:text-slate-900 overflow-x-hidden font-sans relative">
      
      {requiereAceptarTerminos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 font-sans">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-[#f6c358] p-6 text-slate-900 text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest bg-slate-900/10 px-3 py-1 rounded-xl">
                Aviso Legal Obligatorio
              </span>
              <h2 className="text-xl font-black mt-2">Términos y Condiciones de Uso y Aviso Legal</h2>
              <p className="text-xs text-slate-800 mt-1">EDUCAMET SGA (Sistema de Gestión Académica)</p>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed max-h-[50vh] bg-slate-50/50">
              <p className="font-semibold text-slate-800">
                Bienvenido a Educamet SGA. Al acceder, autenticarse o utilizar este software, usted y la institución educativa a la que representa aceptan de forma expresa, plena y sin reservas los siguientes Términos y Condiciones, Aviso Legal y Políticas de Privacidad:
              </p>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase text-amber-700">1. Titularidad y Propiedad Intelectual</h3>
                <p><strong>Titular:</strong> El software Educamet SGA, incluyendo su código fuente, arquitectura, diseño de interfaces, base de datos, logotipos y manuales, es creación exclusiva y propiedad intelectual de <strong>EDUCAMET CENTRO DE CAPACITACIÓN</strong>.</p>
                <p><strong>Prohibición Absoluta de Copia y Comercialización:</strong> Queda estrictamente prohibida la reproducción, copia, modificación, distribución, comercialización, sublicencia, ingeniería inversa o divulgación total o parcial del código o estructura del sistema sin la autorización previa, expresa y por escrito de su propietario. Su uso no transfiere ningún derecho de propiedad intelectual al usuario ni a la institución.</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase text-amber-700">2. Fines Estrictamente Educativos e Institucionales</h3>
                <p>El uso de este sistema está limitado exclusivamente a la gestión académica, pedagógica y administrativa interna de la institución educativa autorizada.</p>
                <p>Cualquier uso comercial externo, intento de clonación, réplica para la venta a terceros o uso ajeno a los fines educativos descritos constituirá una violación directa a la Ley de Propiedad Intelectual de la República del Ecuador y dará lugar a acciones legales civiles y penales.</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase text-amber-700">3. Acceso Seguro y Segmentación por Roles</h3>
                <p>El acceso al sistema está restringido y segmentado por perfiles de usuario autorizados (Rectorado, Vicerrectorado, Docentes e Inspectoría).</p>
                <p>Cada usuario es absolutamente responsable de mantener la confidencialidad de sus credenciales de acceso (usuario y contraseña). Queda prohibido compartir contraseñas o permitir el ingreso a personal no autorizado. El titular del sistema no se hace responsable por accesos no autorizados derivados de la negligencia en el manejo de cuentas.</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase text-amber-700">4. Privacidad y Confidencialidad de los Datos</h3>
                <p>Los datos ingresados en el sistema (calificaciones, asistencias, fichas personales, actas de compromiso, etc.) pertenecen a la institución educativa.</p>
                <p>Educamet SGA implementa altos estándares de seguridad tecnológica (como cifrado y bases de datos seguras en Supabase), garantizando que la información institucional y personal no será comercializada, cedida ni compartida con terceros ajenos.</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase text-amber-700">5. Limitación de Responsabilidad</h3>
                <p>El titular del sistema vela por la continuidad y correcto funcionamiento operativo de la plataforma; sin embargo, no se asume responsabilidad por interrupciones del servicio derivadas de fallas en los servidores de alojamiento, problemas de conectividad a internet de la institución o mal uso de la plataforma por parte de los usuarios.</p>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-200 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={leidoTerminos}
                  onChange={(e) => setLeidoTerminos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  He leído, comprendido y acepto los Términos y Condiciones, Aviso Legal y Políticas de Privacidad de Educamet SGA.
                </span>
              </label>

              <button
                onClick={handleAceptarTerminos}
                disabled={!leidoTerminos || guardandoTerminos}
                style={{ backgroundColor: '#f6c358' }}
                className="w-full py-3 text-slate-900 font-black text-xs rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider hover:bg-amber-400"
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
            <div className="bg-[#f6c358] p-5 text-slate-900 flex justify-between items-center font-bold">
              <h3 className="text-sm font-black uppercase tracking-wider">
                {modalInformativoAbierto === 'terminos' ? 'Términos y Condiciones Vigentes' : 'Política de Protección de Datos'}
              </h3>
              <button 
                onClick={() => setModalInformativoAbierto(null)}
                className="text-slate-900 hover:bg-black/10 p-1.5 rounded-xl text-xs transition cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-xs text-slate-700 leading-relaxed space-y-3 bg-slate-50">
              {modalInformativoAbierto === 'terminos' ? (
                <>
                  <p><strong>1. TITULARIDAD Y PROPIEDAD INTELECTUAL:</strong> El software Educamet SGA, incluyendo código fuente, arquitectura e interfaces, es propiedad de <strong>EDUCAMET CENTRO DE CAPACITACIÓN</strong>. Prohibida su copia, reproducción o comercialización sin autorización.</p>
                  <p><strong>2. FINES EDUCATIVOS:</strong> Uso estrictamente limitado a la gestión académica y directiva interna de la institución autorizada.</p>
                  <p><strong>3. ACCESO POR ROLES:</strong> Responsabilidad individual en el resguardo de claves directivas.</p>
                  <p><strong>4. PRIVACIDAD:</strong> Confidencialidad y protección de los datos institucionales alojados en bases seguras de Supabase.</p>
                  <p><strong>5. LIMITACIÓN DE RESPONSABILIDAD:</strong> Resguardo operativo sin asumir fallas ajenas de conectividad o infraestructura externa.</p>
                </>
              ) : (
                <>
                  <p><strong>Política de Protección de Datos Personales (Educamet SGA):</strong></p>
                  <p>En cumplimiento con las normativas vigentes, garantizamos que los datos de estudiantes, docentes y directivos recolectados en la plataforma son tratados con absoluta confidencialidad.</p>
                  <p>Los datos se utilizan exclusivamente para la automatización de la gestión académica, asignaciones y control directivo interno.</p>
                  <p>Bajo ningún concepto los datos personales o institucionales serán vendidos, cedidos, transferidos o comercializados a terceros.</p>
                  <p>Se implementan protocolos de seguridad de bases de datos para salvaguardar la información contra accesos no autorizados.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR MÓVIL */}
      <div className="md:hidden bg-[#f6c358] text-slate-900 p-4 flex justify-between items-center border-b border-amber-400/40 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <div className="p-1.5 bg-white rounded-xl border border-amber-200 flex items-center justify-center h-9 w-9 shadow-2xs">
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-xs font-bold text-slate-900 line-clamp-1">{nombreInstitucion}</h1>
            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wide">{rolAutoridad}</span>
          </div>
        </div>
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-bold text-slate-900 border border-amber-400/50 shadow-2xs active:scale-95 transition cursor-pointer"
        >
          {menuAbierto ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      <div className="flex flex-1 relative">
        <aside className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 bg-[#f6c358] text-slate-900 p-5 flex flex-col justify-between border-r border-amber-400/40 shadow-[4px_0_24px_rgba(246,195,88,0.15)]
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
            <div className="mb-4 text-center pb-5 border-b border-amber-400/60 shrink-0">
              {logoUrl ? (
                <div className="p-2.5 bg-white rounded-2xl w-14 h-14 mx-auto mb-2.5 shadow-md border border-amber-100 flex items-center justify-center">
                  <img src={logoUrl} alt="Logo Institucional" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-14 w-14 mx-auto bg-white text-slate-900 rounded-2xl flex items-center justify-center font-black text-xl mb-2.5 shadow-md">
                  {nombreInstitucion.charAt(0)}
                </div>
              )}
              <h2 className="text-xs font-bold text-slate-900 line-clamp-1 px-2">{nombreInstitucion}</h2>
              <div className="mt-1.5 inline-block px-2.5 py-0.5 bg-amber-400/50 border border-amber-500/40 rounded-lg text-[10px] font-mono text-slate-900 font-semibold">
                AMIE: {codigoAmie}
              </div>
              
              <div className="mt-3 p-3 bg-amber-400/40 rounded-2xl border border-amber-500/40 shadow-2xs text-left">
                <p className="text-xs font-bold text-slate-900 line-clamp-1">{nombreAutoridad}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">
                    Rol: {rolAutoridad}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-600" title="Activo"></span>
                </div>
              </div>
            </div>
            
            <nav className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar" onClick={() => setMenuAbierto(false)}>
              {menuItems.map((item) => {
                const isActive = item.path === '/rector' 
                  ? pathname === '/rector' 
                  : pathname.startsWith(item.path)

                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-200 border ${
                      isActive 
                        ? 'bg-slate-900 text-[#f6c358] font-bold border-slate-900 shadow-[0_4px_16px_rgba(0,0,0,0.15)] translate-x-1' 
                        : 'bg-amber-400/25 border-amber-500/30 text-slate-900 hover:bg-amber-500/40 hover:border-amber-600 shadow-2xs font-semibold'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="text-xs truncate">{item.name}</span>
                  </Link>
                )
              })}

              <button 
                onClick={cerrarSesion}
                className="w-full mt-4 py-3 px-3.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-900 font-bold text-xs rounded-2xl border border-rose-500/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Cerrar Sesión
              </button>
            </nav>
          </div>

          <div className="pt-3 border-t border-amber-400/60 mt-2 shrink-0">
             <Link href="/" className="block text-center text-[10px] font-semibold text-slate-800 hover:text-slate-950 uppercase tracking-wider transition">
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
        <span className="text-amber-700 font-bold">{nombreInstitucion}</span> 
        <span className="text-slate-300 hidden md:inline">•</span>
        <span className="text-slate-400 font-medium">Derechos Reservados 2026</span>
        <span className="text-slate-300 hidden md:inline">•</span>
        <button 
          onClick={() => setModalInformativoAbierto('privacidad')}
          className="text-amber-700 hover:underline font-bold cursor-pointer"
        >
          Protección de Datos
        </button>
        <span className="text-slate-300 hidden md:inline">•</span>
        <button 
          onClick={() => setModalInformativoAbierto('terminos')}
          className="text-amber-700 hover:underline font-bold cursor-pointer"
        >
          Términos y Condiciones Vigentes
        </button>
      </footer>

    </div>
  )
}