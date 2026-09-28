'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NIVELES_EDUCATIVOS: { [subnivel: string]: string[] } = {
  'Inicial': ['Inicial 1', 'Inicial 2'],
  'Preparatoria': ['Preparatoria'],
  'Básica Elemental': ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'],
  'Básica Media': ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'],
  'Básica Superior': ['8vo Grado EGB', '9no Grado EGB', '10mo Grado EGB'],
  'Bachillerato': ['1er Año Bachillerato', '2do Año Bachillerato', '3er Año Bachillerato'],
}

const ASIGNATURAS_CURRICULARES = [
  'Matemática',
  'Lengua y Literatura',
  'Ciencias Naturales',
  'Estudios Sociales',
  'Educación Física',
  'Educación Cultural y Artística (ECA)',
  'Idioma Extranjero (Inglés)',
  'Biología',
  'Física',
  'Química',
  'Historia y Geografía',
  'Educación para la Ciudadanía',
  'Filosofía',
  'Emprendimiento y Gestión',
  'Currículo Integrado Inicial',
  'Currículo Integrado Preparatoria'
]

// Lista plana de todos los grados posibles para facilitar el botón global
const TODOS_LOS_GRADOS = Object.values(NIVELES_EDUCATIVOS).flat()

export default function CargaAsignaturasPage() {
  const router = useRouter()
  const [docentes, setDocentes] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  // Estado del Modal de Asignación
  const [modalAbierto, setModalAbierto] = useState(false)
  const [docenteActual, setDocenteActual] = useState<any>(null)
  const [gradosSeleccionados, setGradosSeleccionados] = useState<string[]>([])
  const [asignaturasSeleccionadas, setAsignaturasSeleccionadas] = useState<string[]>([])

  useEffect(() => {
    verificarYCargar()
  }, [])

  const verificarYCargar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || (user.email !== 'ferchopla002@gmail.com' && user.email !== 'ferchoplay002@gmail.com')) {
      router.push('/')
      return
    }
    cargarDocentes()
  }

  const cargarDocentes = async () => {
    const { data, error } = await supabase
      .from('docentes')
      .select('*, instituciones(nombre_institucion)')
      .order('nombres', { ascending: true })

    if (data) setDocentes(data)
  }

  const abrirModal = (doc: any) => {
    setDocenteActual(doc)
    setGradosSeleccionados(doc.grados_asignados || [])
    setAsignaturasSeleccionadas(doc.asignaturas_asignadas || [])
    setModalAbierto(true)
    setMensaje('')
  }

  const toggleGrado = (grado: string) => {
    setGradosSeleccionados(prev =>
      prev.includes(grado) ? prev.filter(g => g !== grado) : [...prev, grado]
    )
  }

  const toggleAsignatura = (asig: string) => {
    setAsignaturasSeleccionadas(prev =>
      prev.includes(asig) ? prev.filter(a => a !== asig) : [...prev, asig]
    )
  }

  // Funciones globales de selección masiva
  const toggleTodosGrados = () => {
    const todosSeleccionados = TODOS_LOS_GRADOS.every(g => gradosSeleccionados.includes(g))
    if (todosSeleccionados) {
      setGradosSeleccionados([])
    } else {
      setGradosSeleccionados(TODOS_LOS_GRADOS)
    }
  }

  const toggleTodasAsignaturas = () => {
    const todasSeleccionadas = ASIGNATURAS_CURRICULARES.every(a => asignaturasSeleccionadas.includes(a))
    if (todasSeleccionadas) {
      setAsignaturasSeleccionadas([])
    } else {
      setAsignaturasSeleccionadas(ASIGNATURAS_CURRICULARES)
    }
  }

  const guardarAsignaciones = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docenteActual) return
    setCargando(true)
    setMensaje('')

    try {
      const { error } = await supabase
        .from('docentes')
        .update({
          grados_asignados: gradosSeleccionados,
          asignaturas_asignadas: asignaturasSeleccionadas
        })
        .eq('id', docenteActual.id)

      if (error) throw error

      setMensaje('✅ Asignaciones guardadas con éxito.')
      setModalAbierto(false)
      cargarDocentes()
    } catch (err: any) {
      setMensaje('Error al guardar: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-md p-6 space-y-6">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">📚 Carga Académica de Asignaturas y Grados</h1>
            <p className="text-xs text-slate-500">Asigna permisos específicos de planificación a cada usuario del sistema.</p>
          </div>
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
          >
            ← Volver al Panel
          </button>
        </div>

        {mensaje && (
          <div className="p-3 bg-blue-50 text-blue-900 rounded-xl text-xs font-bold border border-blue-200">
            {mensaje}
          </div>
        )}

        {/* Tabla de Usuarios */}
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b">
              <tr>
                <th className="p-3">Usuario / Autoridad</th>
                <th className="p-3">Institución</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Grados Autorizados</th>
                <th className="p-3">Asignaturas Autorizadas</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {docentes.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-900">
                    {doc.nombres} {doc.apellidos}
                    <span className="block text-[10px] text-slate-500 font-normal">{doc.email}</span>
                  </td>
                  <td className="p-3 text-slate-600">{doc.instituciones?.nombre_institucion || 'Sin institución'}</td>
                  <td className="p-3 uppercase font-bold text-indigo-700">{doc.rol || 'docente'}</td>
                  
                  {/* Grados */}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {doc.grados_asignados?.length > 0 ? (
                        doc.grados_asignados.map((g: string) => (
                          <span key={g} className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[9px]">
                            {g}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">Sin grados</span>
                      )}
                    </div>
                  </td>

                  {/* Asignaturas */}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {doc.asignaturas_asignadas?.length > 0 ? (
                        doc.asignaturas_asignadas.map((a: string) => (
                          <span key={a} className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold text-[9px]">
                            {a}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">Sin asignaturas</span>
                      )}
                    </div>
                  </td>

                  <td className="p-3 text-center">
                    {!doc.es_superadmin && (
                      <button
                        onClick={() => abrirModal(doc)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow cursor-pointer transition"
                      >
                        ⚙️ Asignar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* MODAL DE ASIGNACIÓN */}
      {modalAbierto && docenteActual && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Configurar Permisos de Planificación</h2>
                <p className="text-xs text-slate-500">Docente: <strong className="text-slate-800">{docenteActual.nombres} {docenteActual.apellidos}</strong></p>
              </div>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={guardarAsignaciones} className="space-y-6">
              
              {/* Sección Grados */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">1. Años de Básica / Bachillerato Autorizados</h3>
                  <button
                    type="button"
                    onClick={toggleTodosGrados}
                    className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    {TODOS_LOS_GRADOS.every(g => gradosSeleccionados.includes(g)) ? 'Deseleccionar todos los grados' : '✓ Asignar todos los grados'}
                  </button>
                </div>
                
                <div className="space-y-3">
                  {Object.entries(NIVELES_EDUCATIVOS).map(([subnivel, grados]) => {
                    const todosSubnivel = grados.every(g => gradosSeleccionados.includes(g))
                    return (
                      <div key={subnivel} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-bold text-slate-700 uppercase">{subnivel}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (todosSubnivel) {
                                setGradosSeleccionados(prev => prev.filter(g => !grados.includes(g)))
                              } else {
                                setGradosSeleccionados(prev => Array.from(new Set([...prev, ...grados])))
                              }
                            }}
                            className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                          >
                            {todosSubnivel ? 'Desmarcar subnivel' : 'Seleccionar subnivel'}
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {grados.map((grado) => {
                            const marcado = gradosSeleccionados.includes(grado)
                            return (
                              <label key={grado} className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${marcado ? 'bg-blue-50 border-blue-400 text-blue-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => toggleGrado(grado)}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span>{grado}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Sección Asignaturas */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">2. Asignaturas Autorizadas</h3>
                  <button
                    type="button"
                    onClick={toggleTodasAsignaturas}
                    className="text-xs text-purple-600 font-bold hover:underline cursor-pointer"
                  >
                    {ASIGNATURAS_CURRICULARES.every(a => asignaturasSeleccionadas.includes(a)) ? 'Deseleccionar todas las asignaturas' : '✓ Asignar todas las asignaturas'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                  {ASIGNATURAS_CURRICULARES.map((asig) => {
                    const marcado = asignaturasSeleccionadas.includes(asig)
                    return (
                      <label key={asig} className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${marcado ? 'bg-purple-50 border-purple-400 text-purple-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => toggleAsignatura(asig)}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span>{asig}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition disabled:opacity-50"
                >
                  {cargando ? 'Guardando...' : 'Guardar Asignaciones'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  )
}