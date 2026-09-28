'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Asignatura {
  id: number
  institucion_id: string
  subnivel: string
  nombre_asignatura: string
}

export default function AsignarCargaDocentePage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [docentes, setDocentes] = useState<any[]>([])
  const [materiasDisponibles, setMateriasDisponibles] = useState<any[]>([])
  
  // Control de Años Lectivos (Inician vacíos para mostrar solo los reales de la institución)
  const [anioLectivoActivo, setAnioLectivoActivo] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])
  const [anioSeleccionado, setAnioSeleccionado] = useState('')

  // Formulario de asignación
  const [docenteSeleccionado, setDocenteSeleccionado] = useState('')
  const [grado, setGrado] = useState('8vo EGB')
  const [paralelo, setParalelo] = useState('A')
  const [jornada, setJornada] = useState('MATUTINA')
  const [asignatura, setAsignatura] = useState('')
  const [asignacionesDocente, setAsignacionesDocente] = useState<any[]>([])
  const [institucionId, setInstitucionId] = useState('')

  // Función para cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return; }

      const { data: aut } = await supabase.from('docentes').select('institucion_id, instituciones(*)').eq('id', user.id).single()
      if (aut) {
        setInstitucionId(aut.institucion_id)
        
        // Manejo seguro para extraer la información de la institución y sus periodos_disponibles
        const inst: any = Array.isArray(aut.instituciones) ? aut.instituciones[0] : aut.instituciones
        if (inst) {
          let listaPeriodos: string[] = []
          if (inst.periodos_disponibles && inst.periodos_disponibles.length > 0) {
            listaPeriodos = inst.periodos_disponibles
            setPeriodosDisponibles(listaPeriodos)
          }

          if (inst.anio_lectivo_activo && listaPeriodos.includes(inst.anio_lectivo_activo)) {
            setAnioLectivoActivo(inst.anio_lectivo_activo)
            setAnioSeleccionado(inst.anio_lectivo_activo)
          } else if (listaPeriodos.length > 0) {
            setAnioLectivoActivo(listaPeriodos[0])
            setAnioSeleccionado(listaPeriodos[0])
          }

          if (inst.anos_cerrados) {
            setAnosCerrados(inst.anos_cerrados)
          }
        }
        
        // Cargar docentes de la institución
        const { data: docs } = await supabase.from('docentes').select('*').eq('institucion_id', aut.institucion_id)
        setDocentes(docs || [])

        // Cargar materias configuradas por la institución
        const { data: mats } = await supabase.from('configuracion_asignaturas').select('*').eq('institucion_id', aut.institucion_id)
        setMateriasDisponibles(mats || [])
        if (mats && mats.length > 0) setAsignatura(mats[0].nombre_asignatura)
      }
      setCargando(false)
    }
    init()
  }, [router])

  // Cargar las asignaciones del docente seleccionado filtradas estrictamente por el año lectivo seleccionado
  useEffect(() => {
    if (!docenteSeleccionado || !anioSeleccionado) {
      setAsignacionesDocente([])
      return
    }
    async function cargarAsignaciones() {
      const { data } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', docenteSeleccionado)
        .eq('anio_lectivo', anioSeleccionado)

      setAsignacionesDocente(data || [])
    }
    cargarAsignaciones()
  }, [docenteSeleccionado, anioSeleccionado])

  const esAnioCerrado = anosCerrados.includes(anioSeleccionado)

  const handleAsignar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!anioSeleccionado) {
      alert('Debe seleccionar o crear un año lectivo válido.')
      return
    }
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado y bloqueado. No se pueden agregar nuevas cargas horarias.')
      return
    }
    if (!docenteSeleccionado) return alert('Seleccione un docente')

    const { error } = await supabase.from('docente_asignaciones').insert({
      institucion_id: institucionId,
      docente_id: docenteSeleccionado,
      grado_curso: grado,
      paralelo,
      jornada,
      asignatura,
      anio_lectivo: anioSeleccionado
    })

    if (error) {
      alert('Esta asignación ya existe para este periodo o hubo un error.')
    } else {
      const { data } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', docenteSeleccionado)
        .eq('anio_lectivo', anioSeleccionado)

      setAsignacionesDocente(data || [])
    }
  }

  const handleEliminar = async (id: string) => {
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado. No se pueden modificar registros históricos.')
      return
    }
    await supabase.from('docente_asignaciones').delete().eq('id', id)
    setAsignacionesDocente(prev => prev.filter(a => a.id !== id))
  }

  if (cargando) return <div className="p-12 text-center font-bold text-slate-700">Cargando...</div>

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ENCABEZADO */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900">Asignación de Carga Horaria a Docentes</h1>
            <p className="text-xs text-slate-600 font-bold mt-1">Controla el distributivo y asignación de materias por periodo escolar.</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* SELECTOR DINÁMICO DE AÑOS LECTIVOS CREADOS POR LA INSTITUCIÓN */}
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase">📅 Periodo:</span>
              {periodosDisponibles.length === 0 ? (
                <span className="text-xs font-bold text-amber-600 italic">Sin años creados</span>
              ) : (
                <select
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(e.target.value)}
                  className="bg-transparent text-xs font-black text-indigo-700 outline-none cursor-pointer"
                >
                  {periodosDisponibles.map(p => (
                    <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                  ))}
                </select>
              )}
            </div>x
          </div>
        </div>

        {/* AVISO SI EL PERIODO ESTÁ CERRADO */}
        {esAnioCerrado && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold flex items-center justify-between">
            <span>🔒 Estás consultando el distributivo histórico del periodo {anioSeleccionado} (Cerrado). Se encuentra en modo de solo lectura.</span>
            <span className="bg-amber-200 px-2.5 py-1 rounded">Modo Histórico</span>
          </div>
        )}

        {/* AVISO SI NO HAY PERIODOS CREADOS */}
        {periodosDisponibles.length === 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold">
            ⚠️ No se han encontrado años lectivos configurados para esta institución. Por favor, créelos primero desde el Panel Principal (Menú Rector).
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* FORMULARIO DE ASIGNACIÓN */}
          {!esAnioCerrado && periodosDisponibles.length > 0 ? (
            <form onSubmit={handleAsignar} className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 md:col-span-1">
              <h2 className="text-sm font-black uppercase text-slate-800">Asignar Nueva Materia ({anioSeleccionado})</h2>
              
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">Seleccionar Docente</label>
                <select 
                  value={docenteSeleccionado} 
                  onChange={(e) => setDocenteSeleccionado(e.target.value)} 
                  required 
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                >
                  <option value="">-- Elija un profesor --</option>
                  {docentes.map(d => <option key={d.id} value={d.id}>{d.nombres} {d.apellidos}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">Grado / Curso</label>
                <select 
                  value={grado} 
                  onChange={(e) => setGrado(e.target.value)} 
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                >
                  <optgroup label="Educación General Básica (EGB)">
                    <option value="2do Grado EGB">2do Grado EGB</option>
                    <option value="3ro Grado EGB">3ro Grado EGB</option>
                    <option value="4to Grado EGB">4to Grado EGB</option>
                    <option value="5to Grado EGB">5to Grado EGB</option>
                    <option value="6to Grado EGB">6to Grado EGB</option>
                    <option value="7mo Grado EGB">7mo Grado EGB</option>
                    <option value="8vo EGB">8vo EGB</option>
                    <option value="9no EGB">9no EGB</option>
                    <option value="10mo EGB">10mo EGB</option>
                  </optgroup>
                  <optgroup label="Bachillerato (BGU / BT)">
                    <option value="1ro BGU">1ro BGU</option>
                    <option value="2do BGU">2do BGU</option>
                    <option value="3ro BGU">3ro BGU</option>
                    <option value="1ro BT">1ro BT</option>
                    <option value="2do BT">2do BT</option>
                    <option value="3ro BT">3ro BT</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">Paralelo</label>
                <select 
                  value={paralelo} 
                  onChange={(e) => setParalelo(e.target.value)} 
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                >
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].map(p => (
                    <option key={p} value={p}>Paralelo {p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">Jornada</label>
                <select 
                  value={jornada} 
                  onChange={(e) => setJornada(e.target.value)} 
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                >
                  <option value="MATUTINA">Matutina</option>
                  <option value="VESPERTINA">Vespertina</option>
                  <option value="NOCTURNA">Nocturna</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">Asignatura</label>
                <select 
                  value={asignatura} 
                  onChange={(e) => setAsignatura(e.target.value)} 
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                >
                  {materiasDisponibles.map(m => (
                    <option key={m.id} value={m.nombre_asignatura}>
                      {m.nombre_asignatura} ({m.subnivel})
                    </option>
                  ))}
                </select>
              </div>

              <button 
                type="submit" 
                disabled={!docenteSeleccionado || !anioSeleccionado} 
                className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-black text-xs py-3 rounded-xl transition disabled:opacity-50"
              >
                + Vincular Curso y Materia ({anioSeleccionado})
              </button>
            </form>
          ) : (
            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed flex items-center justify-center text-center text-xs text-slate-500 md:col-span-1">
              {periodosDisponibles.length === 0 ? 'Debe crear un periodo lectivo en el panel principal.' : `Modo Histórico: No es posible añadir nuevas asignaciones al periodo ${anioSeleccionado} porque se encuentra cerrado.`}
            </div>
          )}

          {/* LISTADO DE ASIGNACIONES */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm md:col-span-2 space-y-4">
            <h2 className="text-sm font-black uppercase text-slate-800">
              Cursos y Materias Asignadas ({anioSeleccionado || 'Sin periodo'})
            </h2>
            
            {!docenteSeleccionado ? (
              <div className="p-12 text-center text-slate-500 font-bold text-xs">
                Selecciona un docente en el panel izquierdo para ver sus asignaciones en este periodo.
              </div>
            ) : asignacionesDocente.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-bold text-xs">
                Este docente no tiene materias asignadas para el periodo {anioSeleccionado}.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-200 uppercase text-[10px] text-slate-900 font-black border-b">
                    <tr>
                      <th className="p-3">Curso / Grado</th>
                      <th className="p-3">Paralelo</th>
                      <th className="p-3">Jornada</th>
                      <th className="p-3">Asignatura</th>
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {asignacionesDocente.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{item.grado_curso}</td>
                        <td className="p-3 font-bold text-slate-700">"{item.paralelo}"</td>
                        <td className="p-3 font-bold text-slate-600">{item.jornada || 'MATUTINA'}</td>
                        <td className="p-3 font-black text-indigo-800">{item.asignatura}</td>
                        <td className="p-3 text-center">
                          {!esAnioCerrado ? (
                            <button onClick={() => handleEliminar(item.id)} className="text-red-600 font-bold hover:underline">
                              Remover
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">Bloqueado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}