'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AsignarCargaDocentePage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [docentes, setDocentes] = useState<any[]>([])
  const [materiasDisponibles, setMateriasDisponibles] = useState<any[]>([])
  
  // Control de Años Lectivos
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

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return; }

      const { data: aut } = await supabase.from('docentes').select('institucion_id, instituciones(*)').eq('id', user.id).single()
      if (aut) {
        setInstitucionId(aut.institucion_id)
        
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
        
        const { data: docs } = await supabase.from('docentes').select('*').eq('institucion_id', aut.institucion_id)
        setDocentes(docs || [])

        const { data: mats } = await supabase.from('configuracion_asignaturas').select('*').eq('institucion_id', aut.institucion_id)
        setMateriasDisponibles(mats || [])
        if (mats && mats.length > 0) setAsignatura(mats[0].nombre_asignatura)
      }
      setCargando(false)
    }
    init()
  }, [router])

  // Cargar las asignaciones del docente seleccionado filtradas por año
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
      alert('Este año lectivo está cerrado y bloqueado. No se pueden agregar nuevas cargas horarias.')
      return
    }
    if (!docenteSeleccionado) return alert('Seleccione un docente')

    // Validar si ya existe la asignación exacta considerando la jornada
    const { data: existente } = await supabase
      .from('docente_asignaciones')
      .select('id')
      .eq('docente_id', docenteSeleccionado)
      .eq('anio_lectivo', anioSeleccionado)
      .eq('jornada', jornada)
      .eq('grado_curso', grado)
      .eq('paralelo', paralelo)
      .eq('asignatura', asignatura)
      .maybeSingle()

    if (existente) {
      alert('Esta asignación ya existe para esta jornada, curso y paralelo.')
      return
    }

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
      alert('Error al registrar la asignación: ' + error.message)
    } else {
      const { data } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', docenteSeleccionado)
        .eq('anio_lectivo', anioSeleccionado)

      setAsignacionesDocente(data || [])
      alert('¡Asignación guardada correctamente!')
    }
  }

  const handleEliminar = async (id: string) => {
    if (esAnioCerrado) {
      alert('Este año lectivo está cerrado. No se pueden modificar registros históricos.')
      return
    }
    await supabase.from('docente_asignaciones').delete().eq('id', id)
    setAsignacionesDocente(prev => prev.filter(a => a.id !== id))
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Asignaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Distributivo Docente
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Asignación de Carga Horaria a Docentes
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Controla el distributivo y asignación de materias por periodo escolar.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Periodo:</span>
            {periodosDisponibles.length === 0 ? (
              <span className="text-xs font-bold text-amber-700 italic">Sin años creados</span>
            ) : (
              <select
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(e.target.value)}
                style={{ color: '#4b4c99' }}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer"
              >
                {periodosDisponibles.map(p => (
                  <option key={p} value={p} className="text-slate-900 font-bold bg-white">{p} {anosCerrados.includes(p) ? ' (Cerrado)' : ''}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* AVISO SI EL PERIODO ESTÁ CERRADO */}
      {esAnioCerrado && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>Estás consultando el distributivo histórico del periodo {anioSeleccionado} (Cerrado). Se encuentra en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Modo Archivo</span>
        </div>
      )}

      {/* AVISO SI NO HAY PERIODOS CREADOS */}
      {periodosDisponibles.length === 0 && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          No se han encontrado años lectivos configurados para esta institución. Por favor, créelos primero desde el Panel Principal.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FORMULARIO DE ASIGNACIÓN */}
        {!esAnioCerrado && periodosDisponibles.length > 0 ? (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 h-fit">
            <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
              Asignar Nueva Materia ({anioSeleccionado})
            </h2>
            
            <form onSubmit={handleAsignar} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Seleccionar Docente</label>
                <select 
                  value={docenteSeleccionado} 
                  onChange={(e) => setDocenteSeleccionado(e.target.value)} 
                  required 
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                >
                  <option value="" className="text-slate-900 font-bold bg-white">-- Elija un profesor --</option>
                  {docentes.map(d => <option key={d.id} value={d.id} className="text-slate-900 font-bold bg-white">{d.nombres} {d.apellidos}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Jornada</label>
                <select 
                  value={jornada} 
                  onChange={(e) => setJornada(e.target.value)} 
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                >
                  <option value="MATUTINA" className="text-slate-900 font-bold bg-white">Matutina</option>
                  <option value="VESPERTINA" className="text-slate-900 font-bold bg-white">Vespertina</option>
                  <option value="NOCTURNA" className="text-slate-900 font-bold bg-white">Nocturna</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Grado / Curso</label>
                <select 
                  value={grado} 
                  onChange={(e) => setGrado(e.target.value)} 
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                >
                  <optgroup label="Educación General Básica (EGB)">
                    <option value="2do Grado EGB" className="text-slate-900 font-bold bg-white">2do Grado EGB</option>
                    <option value="3ro Grado EGB" className="text-slate-900 font-bold bg-white">3ro Grado EGB</option>
                    <option value="4to Grado EGB" className="text-slate-900 font-bold bg-white">4to Grado EGB</option>
                    <option value="5to Grado EGB" className="text-slate-900 font-bold bg-white">5to Grado EGB</option>
                    <option value="6to Grado EGB" className="text-slate-900 font-bold bg-white">6to Grado EGB</option>
                    <option value="7mo Grado EGB" className="text-slate-900 font-bold bg-white">7mo Grado EGB</option>
                    <option value="8vo EGB" className="text-slate-900 font-bold bg-white">8vo EGB</option>
                    <option value="9no EGB" className="text-slate-900 font-bold bg-white">9no EGB</option>
                    <option value="10mo EGB" className="text-slate-900 font-bold bg-white">10mo EGB</option>
                  </optgroup>
                  <optgroup label="Bachillerato (BGU / BT)">
                    <option value="1ro BGU" className="text-slate-900 font-bold bg-white">1ro BGU</option>
                    <option value="2do BGU" className="text-slate-900 font-bold bg-white">2do BGU</option>
                    <option value="3ro BGU" className="text-slate-900 font-bold bg-white">3ro BGU</option>
                    <option value="1ro BT" className="text-slate-900 font-bold bg-white">1ro BT</option>
                    <option value="2do BT" className="text-slate-900 font-bold bg-white">2do BT</option>
                    <option value="3ro BT" className="text-slate-900 font-bold bg-white">3ro BT</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo</label>
                <select 
                  value={paralelo} 
                  onChange={(e) => setParalelo(e.target.value)} 
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                >
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].map(p => (
                    <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Asignatura</label>
                <select 
                  value={asignatura} 
                  onChange={(e) => setAsignatura(e.target.value)} 
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                >
                  {materiasDisponibles.map(m => (
                    <option key={m.id} value={m.nombre_asignatura} className="text-slate-900 font-bold bg-white">
                      {m.nombre_asignatura} ({m.subnivel})
                    </option>
                  ))}
                </select>
              </div>

              <button 
                type="submit" 
                disabled={!docenteSeleccionado || !anioSeleccionado} 
                style={{ backgroundColor: '#4b4c99' }}
                className="w-full py-3 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 mt-2"
              >
                + Vincular Curso y Materia ({anioSeleccionado})
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-center text-center text-xs text-slate-500 lg:col-span-1">
            {periodosDisponibles.length === 0 ? 'Debe crear un periodo lectivo en el panel principal.' : `Modo Histórico: No es posible añadir nuevas asignaciones al periodo ${anioSeleccionado} porque se encuentra cerrado.`}
          </div>
        )}

        {/* LISTADO DE ASIGNACIONES */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex justify-between items-center">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Cursos y Materias Asignadas ({anioSeleccionado || 'Sin periodo'})
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {asignacionesDocente.length} asignaciones registradas
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {!docenteSeleccionado ? (
              <div className="p-12 text-center text-slate-500 font-medium text-xs">
                Selecciona un docente en el panel izquierdo para ver sus asignaciones en este periodo.
              </div>
            ) : asignacionesDocente.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-medium text-xs">
                Este docente no tiene materias asignadas para el periodo {anioSeleccionado}.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Jornada</th>
                    <th className="p-3">Curso / Grado</th>
                    <th className="p-3">Paralelo</th>
                    <th className="p-3">Asignatura</th>
                    <th className="p-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {asignacionesDocente.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-[#4b4c99]">{item.jornada || 'MATUTINA'}</td>
                      <td className="p-3 font-bold text-slate-800">{item.grado_curso}</td>
                      <td className="p-3 font-semibold text-slate-600">"{item.paralelo}"</td>
                      <td className="p-3 font-bold text-slate-900">{item.asignatura}</td>
                      <td className="p-3 text-center">
                        {!esAnioCerrado ? (
                          <button onClick={() => handleEliminar(item.id)} className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-[10px] transition cursor-pointer shadow-2xs">
                            Remover
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">Bloqueado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}