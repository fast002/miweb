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

  const menuItems = [
    { name: 'Dashboard', path: '/docente' },
    { name: 'Calificaciones', path: '/docente/calificaciones' },
    { name: 'Planificador', path: '/docente/planificador' },
    { name: 'Planificador Piloto', path: '/docente/planificadorpiloto' },
    { name: 'Planificador Inicial', path: '/docente/planificadorinicial' },
    { name: 'Crear Planificación', path: '/docente/planificador/nuevo' },
    { name: 'Asistencia', path: '/docente/asistencia' },
    { name: 'Nómina (Estudiantes)', path: '/docente/estudiantes' },
    { name: 'Recomendaciones y Tutores', path: '/docente/calificaciones/comportamiento-recomendaciones' },
    { name: 'Supletorios', path: '/docente/calificaciones/supletorios' },
    { name: 'Consolidado Trimestral', path: '/docente/calificaciones/consolidado' },
    { name: 'Sábana Trimestral', path: '/docente/calificaciones/sabana-trimestral' },
    { name: 'Reportes Notas', path: '/docente/calificaciones/reportes' },
    { name: 'Reportes Asistencia', path: '/docente/asistencia/reportes' },
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-96 h-96 bg-[#4b4c99]/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="text-center space-y-4 relative z-10 bg-white p-8 rounded-[36px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-4 border-white/60">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#4b4c99] border-t-transparent mx-auto"></div>
          <p className="text-xs font-black text-slate-700 tracking-widest uppercase">Cargando entorno institucional...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50/40 to-slate-200 text-slate-800 flex flex-col justify-between selection:bg-[#f6c358] selection:text-slate-950 overflow-x-hidden">
      
      {/* BARRA SUPERIOR MÓVIL ESTILO CLAYMORPHISM */}
      <div className="md:hidden bg-white/90 backdrop-blur-xl text-slate-800 p-4 flex justify-between items-center border-b-2 border-slate-200 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <div className="p-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-8 w-8">
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-xs font-black line-clamp-1">{nombreInstitucion}</h1>
            <span className="text-[10px] text-[#4b4c99] font-black uppercase tracking-wider">{rolUsuario}</span>
          </div>
        </div>
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-700 border-2 border-white shadow-sm active:scale-95 transition cursor-pointer"
        >
          {menuAbierto ? 'Cerrar' : 'Menu'}
        </button>
      </div>

      <div className="flex flex-1 relative">
        {/* MENÚ LATERAL ESTILO CLAYMORPHISM */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-30
          w-72 bg-slate-900 text-white p-6 flex flex-col justify-between border-r-4 border-slate-800 shadow-[10px_0_30px_rgba(0,0,0,0.15)]
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div>
            {/* Logo y Datos Institucionales + Perfil del Docente con fondo blanco puro */}
            <div className="mb-6 text-center pb-6 border-b-2 border-slate-800">
              {logoUrl ? (
                <div className="p-3 bg-white rounded-3xl w-16 h-16 mx-auto mb-3 shadow-[0_8px_16px_rgba(0,0,0,0.2),inset_0_2px_4px_rgba(0,0,0,0.05)] border-2 border-slate-100 flex items-center justify-center">
                  <img src={logoUrl} alt="Logo Institucional" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-16 w-16 mx-auto bg-white text-slate-950 rounded-3xl flex items-center justify-center font-black text-xl mb-3 shadow-[0_8px_16px_rgba(0,0,0,0.2),inset_0_2px_4px_rgba(0,0,0,0.05)] border-2 border-slate-100">
                  {nombreInstitucion.charAt(0)}
                </div>
              )}
              <h2 className="text-xs font-black text-white line-clamp-1 px-2">{nombreInstitucion}</h2>
              <div className="mt-2 inline-block px-3 py-1 bg-slate-800 border border-slate-700 rounded-2xl text-[10px] font-mono text-slate-300 shadow-inner">
                AMIE: {codigoAmie}
              </div>
              
              {/* Bloque con Nombre del Docente y su Rol */}
              <div className="mt-3.5 pt-3.5 border-t border-slate-800 bg-slate-800/80 p-3.5 rounded-3xl border-2 border-slate-700 shadow-inner">
                <p className="text-xs font-black text-slate-100 line-clamp-1">{nombreUsuario}</p>
                <p className="text-[10px] font-black text-[#f6c358] uppercase tracking-wider mt-0.5">
                  Rol: {rolUsuario}
                </p>
              </div>
            </div>
            
            {/* Navegación con Botones Claymorphism y color de marca activo */}
            <nav className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1 custom-scrollbar" onClick={() => setMenuAbierto(false)}>
              {menuItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`block px-4 py-3 rounded-2xl font-bold text-xs transition-all duration-200 border-2 ${
                      isActive 
                        ? 'bg-[#f6c358] text-slate-950 font-black shadow-[0_6px_16px_rgba(246,195,88,0.4),inset_0_2px_3px_rgba(255,255,255,0.8)] border-white scale-[1.02]' 
                        : 'text-slate-300 bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}

              {/* Botón de Cerrar Sesión con Estilo Claymorphism */}
              <button 
                onClick={cerrarSesion}
                className="w-full mt-4 py-3 px-4 bg-[#de5860]/20 hover:bg-[#de5860] text-[#de5860] hover:text-white font-black text-xs rounded-2xl border-2 border-[#de5860]/40 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>🚪</span> Cerrar Sesión
              </button>
            </nav>
          </div>

          {/* ZONA INFERIOR: Salir al Inicio */}
          <div className="pt-4 border-t border-slate-800 mt-2">
             <Link href="/" className="block text-center text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition">
               ← Salir al Inicio
             </Link>
          </div>
        </aside>

        {/* FONDO OSCURO PARA MÓVIL */}
        {menuAbierto && (
          <div 
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-20 md:hidden transition-opacity"
          />
        )}

        {/* CONTENIDO CENTRAL */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-full">
          {children}
        </main>
      </div>

      {/* PIE DE PÁGINA INSTITUCIONAL ESTILO CLAYMORPHISM */}
      <footer className="bg-white/90 backdrop-blur-xl border-t-2 border-slate-200 py-4 px-4 md:px-8 text-center text-[11px] md:text-xs font-bold text-slate-600 shadow-inner z-10 flex flex-col md:flex-row items-center justify-center gap-1">
        <span>Desarrollado por Educamet — Licencia cedida a:</span> 
        <span className="text-[#4b4c99] font-black">{nombreInstitucion}</span> 
        <span className="text-slate-400 hidden md:inline">•</span>
        <span className="text-slate-500 font-medium">Derechos Reservados 2026</span>
      </footer>

    </div>
  )
}