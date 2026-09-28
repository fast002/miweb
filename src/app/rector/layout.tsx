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

  // Opciones del menú lateral para el rol Rector / Dirección
  const menuItems = [
    { name: 'Dashboard Rectoral', path: '/rector' },
    { name: 'Registro de Usuarios', path: '/rector/dashboard' },
    { name: 'Carga Horaria', path: '/rector/asignaciones-docentes' },
    { name: 'Asignaturas', path: '/rector/asignaturas' },
    { name: 'Calificaciones', path: '/rector/calificaciones' },
    { name: 'Planificaciones', path: '/rector/dashboard/revision' },
    { name: 'Padres de Familia', path: '/rector/padres' },
    { name: 'Nómina Estudiantil', path: '/rector/estudiantes' },
    { name: 'Histórico de Notas', path: '/rector/historico' },
  ]

  useEffect(() => {
    async function cargarDatosRectorInstitucion() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        // Consultar datos del rector/autoridad conectado y su relación institucional
        const { data: docData, error } = await supabase
          .from('docentes')
          .select('nombres, apellidos, rol, instituciones(*)')
          .eq('id', user.id)
          .maybeSingle()

        if (error || !docData) {
          router.push('/')
          return
        }

        // SEGURIDAD SILENCIOSA: Verificar si el rol actual tiene acceso al panel directivo
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

  function instsSeguro(val: any) {
    return typeof val === 'string' ? val : (val?.toString() || 'S/N')
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (cargandoInstitucion) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-300 tracking-wider">Validando credenciales directivas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      
      {/* BARRA SUPERIOR MÓVIL */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800 z-20">
        <div className="flex items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded bg-white p-0.5" />}
          <div>
            <h1 className="text-xs font-black line-clamp-1">{nombreInstitucion}</h1>
            <span className="text-[10px] text-indigo-400 font-bold uppercase">{rolAutoridad}</span>
          </div>
        </div>
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="p-2 bg-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none cursor-pointer"
        >
          {menuAbierto ? '✕ Cerrar' : '☰ Menú'}
        </button>
      </div>

      <div className="flex flex-1 relative">
        {/* MENÚ LATERAL */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 bg-slate-900 text-white p-6 flex flex-col justify-between border-r border-slate-800
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div>
            {/* Logo, Datos Institucionales y Perfil del Rector */}
            <div className="mb-6 text-center pb-6 border-b border-slate-800">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo Institucional" className="h-14 w-14 mx-auto object-contain mb-2 rounded-xl bg-white/5 p-1 border border-slate-800" />
              ) : (
                <div className="h-14 w-14 mx-auto bg-indigo-600 rounded-xl flex items-center justify-center font-black text-lg mb-2 shadow-md">
                  {nombreInstitucion.charAt(0)}
                </div>
              )}
              <h2 className="text-xs font-black text-white line-clamp-1">{nombreInstitucion}</h2>
              <div className="mt-1.5 inline-block px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">
                AMIE: {codigoAmie}
              </div>
              
              {/* Bloque con Nombre del Rector y su Rol */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 bg-slate-800/40 p-2.5 rounded-xl">
                <p className="text-xs font-black text-slate-200 line-clamp-1">{nombreAutoridad}</p>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mt-0.5">
                  Rol: {rolAutoridad}
                </p>
              </div>
            </div>
            
            {/* Navegación lateral adaptativa */}
            <nav className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1" onClick={() => setMenuAbierto(false)}>
              {menuItems.map((item) => {
                const isActive = item.path === '/rector' 
                  ? pathname === '/rector' 
                  : pathname.startsWith(item.path)

                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`block px-3.5 py-2.5 rounded-xl font-bold text-xs transition ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}

              {/* Botón de Cerrar Sesión integrado al final del menú */}
              <button 
                onClick={cerrarSesion}
                className="w-full mt-3 py-2.5 px-4 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-black text-xs rounded-xl border border-red-500/30 transition flex items-center gap-2 cursor-pointer text-left"
              >
                <span>🚪</span> Cerrar Sesión
              </button>
            </nav>
          </div>

          {/* ZONA INFERIOR: Salir al Inicio */}
          <div className="pt-4 border-t border-slate-800 mt-2">
             <Link href="/" className="block text-center text-[10px] font-bold text-slate-500 hover:text-white uppercase">
               ← Salir al Inicio
             </Link>
          </div>
        </aside>

        {/* FONDO OSCURO PARA MÓVIL */}
        {menuAbierto && (
          <div 
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
          />
        )}

        {/* CONTENIDO CENTRAL */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-full">
          {children}
        </main>
      </div>

      {/* PIE DE PÁGINA INSTITUCIONAL */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 md:px-8 text-center text-[11px] md:text-xs font-bold text-slate-500 shadow-inner z-10">
        Desarrollado por Educamet — Licencia cedida a: <span className="text-indigo-600 font-black">{nombreInstitucion}</span> — Derechos Reservados 2026
      </footer>

    </div>
  )
}