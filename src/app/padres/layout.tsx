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
    { name: 'Dashboard Principal', path: '/padres' },
    { name: 'Calificaciones', path: '/padres/calificaciones' },
    { name: 'Esquelas y Notificaciones', path: '/padres/esquelas' },
  ]

  useEffect(() => {
    async function verificarAccesoYPerfil() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        // 1. Verificar si es Superadmin en la tabla docentes
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

        // 2. Buscar en estudiante_representantes por user_id incluyendo email
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

        // 3. AUTO-VINCULACIÓN POR CORREO: Si no tiene user_id asignado pero su email coincide, lo vinculamos automáticamente
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#45b3a5] border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-300 tracking-wider">Validando entorno institucional del representante...</p>
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
            <span className="text-[10px] text-[#45b3a5] font-bold uppercase">{rolUsuario}</span>
          </div>
        </div>
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="p-2 bg-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none"
        >
          {menuAbierto ? '✕ Cerrar' : '☰ Menú'}
        </button>
      </div>

      <div className="flex flex-1 relative">
        {/* MENÚ LATERAL */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-30
          w-64 bg-slate-900 text-white p-6 flex flex-col justify-between border-r border-slate-800
          transform transition-transform duration-300 ease-in-out
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div>
            {/* Logo y Datos Institucionales + Perfil del Usuario */}
            <div className="mb-6 text-center pb-6 border-b border-slate-800">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo Institucional" className="h-14 w-14 mx-auto object-contain mb-2 rounded-xl bg-white/5 p-1 border border-slate-800" />
              ) : (
                <div className="h-14 w-14 mx-auto bg-[#45b3a5] text-slate-950 rounded-xl flex items-center justify-center font-black text-lg mb-2 shadow-md">
                  {nombreInstitucion.charAt(0)}
                </div>
              )}
              <h2 className="text-xs font-black text-white line-clamp-1">{nombreInstitucion}</h2>
              <div className="mt-1.5 inline-block px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">
                AMIE: {codigoAmie}
              </div>
              
              {/* Bloque con Nombre del Usuario y su Rol */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 bg-slate-800/40 p-2 rounded-xl">
                <p className="text-xs font-black text-slate-200 line-clamp-1">{nombreUsuario}</p>
                <p className="text-[10px] font-bold text-[#45b3a5] uppercase tracking-wider mt-0.5">
                  Rol: {rolUsuario}
                </p>
              </div>
            </div>
            
            {/* Navegación y Botón de Cerrar Sesión */}
            <nav className="space-y-1.5" onClick={() => setMenuAbierto(false)}>
              {menuItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`block px-4 py-2.5 rounded-xl font-bold text-xs transition ${
                      isActive 
                        ? 'bg-[#45b3a5] text-slate-950 shadow-lg' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}

              <button 
                onClick={cerrarSesion}
                className="w-full mt-3 py-2.5 px-4 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-black text-xs rounded-xl border border-red-500/30 transition flex items-center gap-2 cursor-pointer text-left"
              >
                <span>🚪</span> Cerrar Sesión
              </button>
            </nav>
          </div>

          <div className="pt-6 border-t border-slate-800">
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

      <footer className="bg-white border-t border-slate-200 py-3 px-4 md:px-8 text-center text-[11px] md:text-xs font-bold text-slate-500 shadow-inner z-10">
        Desarrollado por Educamet — Licencia cedida a: <span className="text-[#358f84] font-black">{nombreInstitucion}</span> — Derechos Reservados 2026
      </footer>

    </div>
  )
}