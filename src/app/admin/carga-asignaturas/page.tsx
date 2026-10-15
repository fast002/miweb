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
    const { data } = await supabase
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

      setMensaje('Asignaciones guardadas con éxito.')
      setModalAbierto(false)
      cargarDocentes()
    } catch (err: any) {
      setMensaje('Error al guardar: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#4b4c99] selection:text-white">
      
      {/* ENCABEZADO CORPORATIVO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Consola Central • Gestión Curricular
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Carga Académica de Asignaturas y Grados
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Asigna permisos específicos de planificación y aulas a cada usuario del sistema.
          </p>
        </div>

        <button
          onClick={() => router.push('/admin/dashboard')}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200/80 transition cursor-pointer flex items-center gap-2 shadow-2xs shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Volver al Panel
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs flex items-center gap-2.5 ${
          mensaje.toLowerCase().includes('error') 
            ? 'bg-rose-50 text-rose-900 border-rose-200' 
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{mensaje}</span>
        </div>
      )}

      {/* TABLA DE USUARIOS */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: '#4b4c99' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider flex justify-between items-center"
        >
          <span>Asignación de Permisos Curriculares por Usuario</span>
          <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-xl">Total Usuarios: {docentes.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Usuario / Autoridad</th>
                <th className="p-3.5">Institución</th>
                <th className="p-3.5">Rol</th>
                <th className="p-3.5">Grados Autorizados</th>
                <th className="p-3.5">Asignaturas Autorizadas</th>
                <th className="p-3.5 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {docentes.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-bold text-slate-800">
                    {doc.nombres} {doc.apellidos}
                    <span className="block text-[10px] text-slate-500 font-normal">{doc.email}</span>
                  </td>
                  <td className="p-3.5 text-slate-600 font-medium">{doc.instituciones?.nombre_institucion || 'Sin institución'}</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase inline-block ${
                      doc.rol === 'rector' ? 'bg-purple-100 text-purple-800' :
                      doc.rol === 'vicerrector' ? 'bg-indigo-100 text-indigo-800' :
                      doc.rol === 'inspector' ? 'bg-amber-100 text-amber-800' :
                      doc.rol === 'secretaria' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {doc.rol || 'docente'}
                    </span>
                  </td>
                  
                  {/* Grados */}
                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {doc.grados_asignados?.length > 0 ? (
                        doc.grados_asignados.map((g: string) => (
                          <span key={g} className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200/60 rounded-md font-bold text-[10px]">
                            {g}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Sin grados</span>
                      )}
                    </div>
                  </td>

                  {/* Asignaturas */}
                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {doc.asignaturas_asignadas?.length > 0 ? (
                        doc.asignaturas_asignadas.map((a: string) => (
                          <span key={a} className="px-2 py-0.5 bg-indigo-50 text-[#4b4c99] border border-indigo-200/60 rounded-md font-bold text-[10px]">
                            {a}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Sin asignaturas</span>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5 text-center">
                    {!doc.es_superadmin && (
                      <button
                        onClick={() => abrirModal(doc)}
                        style={{ backgroundColor: '#4b4c99' }}
                        className="px-3.5 py-2 hover:opacity-95 text-white font-bold rounded-xl text-[11px] shadow-2xs cursor-pointer transition inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        Asignar
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto font-sans my-8">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                  Configurar Permisos de Planificación
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Docente: <strong className="text-slate-800">{docenteActual.nombres} {docenteActual.apellidos}</strong>
                </p>
              </div>
              <button 
                onClick={() => setModalAbierto(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarAsignaciones} className="space-y-6">
              
              {/* Sección Grados */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    1. Años de Básica / Bachillerato Autorizados
                  </h3>
                  <button
                    type="button"
                    onClick={toggleTodosGrados}
                    className="text-xs text-[#4b4c99] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {TODOS_LOS_GRADOS.every(g => gradosSeleccionados.includes(g)) ? (
                      'Deseleccionar todos los grados'
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        Asignar todos los grados
                      </>
                    )}
                  </button>
                </div>
                
                <div className="space-y-3">
                  {Object.entries(NIVELES_EDUCATIVOS).map(([subnivel, grados]) => {
                    const todosSubnivel = grados.every(g => gradosSeleccionados.includes(g))
                    return (
                      <div key={subnivel} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex justify-between items-center mb-2.5">
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
                            className="text-[10px] text-[#4b4c99] font-bold hover:underline cursor-pointer"
                          >
                            {todosSubnivel ? 'Desmarcar subnivel' : 'Seleccionar subnivel'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {grados.map((grado) => {
                            const marcado = gradosSeleccionados.includes(grado)
                            return (
                              <label 
                                key={grado} 
                                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                                  marcado 
                                    ? 'bg-indigo-50/80 border-[#4b4c99] text-slate-900 shadow-2xs' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => toggleGrado(grado)}
                                  className="rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99]"
                                />
                                <span className="truncate">{grado}</span>
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
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Asignaturas Autorizadas
                  </h3>
                  <button
                    type="button"
                    onClick={toggleTodasAsignaturas}
                    className="text-xs text-[#4b4c99] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {ASIGNATURAS_CURRICULARES.every(a => asignaturasSeleccionadas.includes(a)) ? (
                      'Deseleccionar todas las asignaturas'
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        Asignar todas las asignaturas
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 max-h-52 overflow-y-auto">
                  {ASIGNATURAS_CURRICULARES.map((asig) => {
                    const marcado = asignaturasSeleccionadas.includes(asig)
                    return (
                      <label 
                        key={asig} 
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                          marcado 
                            ? 'bg-indigo-50/80 border-[#4b4c99] text-slate-900 shadow-2xs' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => toggleAsignatura(asig)}
                          className="rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99]"
                        />
                        <span className="truncate">{asig}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition disabled:opacity-50"
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