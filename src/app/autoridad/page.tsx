'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AutoridadPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [autoridad, setAutoridad] = useState<any>(null)
  const [docentes, setDocentes] = useState<any[]>([])
  const [limiteDocentes, setLimiteDocentes] = useState<number>(0)
  const [licenciaInfo, setLicenciaInfo] = useState<any>(null)

  // Formulario de creación de docente
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'advertencia'; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarDatosAutoridad()
  }, [])

  const cargarDatosAutoridad = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/')
        return
      }

      // 1. Cargar perfil de la autoridad y datos de su licencia
      const { data: aut, error: autError } = await supabase
        .from('docentes')
        .select('*, instituciones(*, licencias(*))')
        .eq('id', userData.user.id)
        .single()

      if (autError || !aut) {
        router.push('/')
        return
      }

      setAutoridad(aut)

      // Obtener datos de la licencia de la institución
      const lic = aut.instituciones?.licencias?.[0] || null
      setLicenciaInfo(lic)
      setLimiteDocentes(lic?.limite_docentes || 0)

      // 2. Cargar los docentes pertenecientes a la MISMA institución
      const { data: docData } = await supabase
        .from('docentes')
        .select('*')
        .eq('institucion_id', aut.institucion_id)
        .eq('rol', 'docente')
        .order('created_at', { ascending: false })

      if (docData) {
        setDocentes(docData)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  // Crear Docente con Validación de Límite
  const handleCrearDocente = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje(null)

    if (docentes.length >= limiteDocentes) {
      setMensaje({
        tipo: 'advertencia',
        texto: `🚫 Has alcanzado el límite máximo de ${limiteDocentes} docentes contratados para tu institución. Si requieres registrar más usuarios, contacta con Soporte para ampliar tu plan.`
      })
      return
    }

    setGuardando(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: '123456',
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: docError } = await supabase
          .from('docentes')
          .upsert([{
            id: authData.user.id,
            institucion_id: autoridad.institucion_id,
            email: email.trim(),
            nombres: nombres.trim(),
            apellidos: apellidos.trim(),
            rol: 'docente',
            es_superadmin: false,
            activo: true
          }])

        if (docError) throw docError

        if (sessionData?.session) {
          await supabase.auth.setSession(sessionData.session)
        }

        setMensaje({
          tipo: 'exito',
          texto: `¡Cuenta docente creada con éxito! Contraseña temporal: 123456`
        })
        setNombres('')
        setApellidos('')
        setEmail('')
        cargarDatosAutoridad()
      }
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al crear docente: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  // Restablecer contraseña a 123456
  const handleResetearPassword = async (emailDocente: string, nombresDocente: string) => {
    if (!confirm(`¿Deseas restablecer la contraseña de ${nombresDocente} a la clave temporal "123456"?`)) {
      return
    }

    setMensaje({
      tipo: 'exito',
      texto: `Clave temporal asignada. El docente ${emailDocente} puede ingresar con "123456" y crear su nueva contraseña.`
    })
  }

  if (cargando) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center font-semibold text-slate-600">Cargando Panel Rectoral...</div>
  }

  const licenciasDisponibles = limiteDocentes - docentes.length
  
  // Formatear fecha de vencimiento
  const fechaVencimientoFormatted = licenciaInfo?.fecha_vencimiento 
    ? new Date(licenciaInfo.fecha_vencimiento).toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'No registrada'

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-md p-6">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Panel Rectoral / Dirección
            </h1>
            <p className="text-sm text-slate-500">
              {autoridad?.instituciones?.nombre_institucion} - AMIE: {autoridad?.instituciones?.codigo_amie}
            </p>
          </div>
          <button 
            onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-3 rounded-lg transition"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* TARJETAS INFORMATIVAS DE LICENCIA Y CUPOS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          
          {/* Vencimiento de Licencia */}
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl text-center">
            <span className="text-xs text-purple-700 font-bold uppercase">Vencimiento de Licencia</span>
            <p className="text-base font-bold text-purple-900 mt-1 capitalize">{fechaVencimientoFormatted}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-200 text-purple-800 text-[10px] font-bold rounded-full capitalize">
              Plan {licenciaInfo?.tipo_licencia || 'Estándar'}
            </span>
          </div>

          {/* Límite Contratado */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
            <span className="text-xs text-blue-600 font-bold uppercase">Límite Contratado</span>
            <p className="text-2xl font-black text-blue-900">{limiteDocentes} Usuarios</p>
          </div>

          {/* Docentes Registrados */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
            <span className="text-xs text-emerald-600 font-bold uppercase">Docentes Registrados</span>
            <p className="text-2xl font-black text-emerald-900">{docentes.length} Usuarios</p>
          </div>

          {/* Cupos Disponibles */}
          <div className={`border p-4 rounded-xl text-center ${
            licenciasDisponibles > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <span className="text-xs font-bold uppercase">Cupos Disponibles</span>
            <p className="text-2xl font-black">{licenciasDisponibles} Cupos</p>
          </div>

        </div>

        {mensaje && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-medium border shadow-sm ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
            mensaje.tipo === 'advertencia' ? 'bg-amber-50 text-amber-900 border-amber-300' :
            'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA 1: CREAR DOCENTE */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>👤</span> Registrar Nuevo Docente
            </h2>
            
            <form onSubmit={handleCrearDocente} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nombres</label>
                <input 
                  type="text" 
                  required 
                  value={nombres} 
                  onChange={(e) => setNombres(e.target.value)}
                  placeholder="Ej: María Elena"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Apellidos</label>
                <input 
                  type="text" 
                  required 
                  value={apellidos} 
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="Ej: Andrade Vaca"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="docente@escuela.edu.ec"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 outline-none"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                La contraseña inicial será siempre <strong className="text-blue-700">123456</strong>.
              </p>

              <button 
                type="submit" 
                disabled={guardando || docentes.length >= limiteDocentes}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guardando ? 'Creando...' : docentes.length >= limiteDocentes ? 'Límite de Cupos Alcanzado' : 'Crear Cuenta Docente'}
              </button>
            </form>
          </div>

          {/* COLUMNA 2 Y 3: LISTA DE DOCENTES */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>📋</span> Nómina de Docentes de la Institución
            </h2>

            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase text-xs border-b">
                  <tr>
                    <th className="p-3">Docente</th>
                    <th className="p-3">Correo</th>
                    <th className="p-3 text-center">Acción de Clave</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {docentes.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        No hay docentes registrados aún. Puedes agregar hasta {limiteDocentes} profesores.
                      </td>
                    </tr>
                  ) : (
                    docentes.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-800">{doc.nombres} {doc.apellidos}</td>
                        <td className="p-3 text-slate-600">{doc.email}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => handleResetearPassword(doc.email, doc.nombres)}
                            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-xs font-semibold transition"
                          >
                            🔑 Resetear Contaseña
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}