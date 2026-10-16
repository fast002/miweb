'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type CategoriaInsumo = 'Deberes / Indiv.' | 'Tareas en Clase' | 'Actividades Grupales' | 'Lecciones'

interface ColumnaInsumo {
  id: string
  categoria: CategoriaInsumo
  numero: number
  descripcion: string
}

export default function CalificacionesRepresentantePage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)

  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')

  // Hijos vinculados al representante
  const [hijosVinculados, setHijosVinculados] = useState<any[]>([])
  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState('')

  // Datos académicos del hijo seleccionado
  const [subnivel, setSubnivel] = useState<'Básica Elemental' | 'Básica Media' | 'Básica Superior' | 'Bachillerato'>('Básica Media')
  const [trimestre, setTrimestre] = useState('Trimestre 1')
  
  // Listas de asignaturas y notas
  const [asignaturasEstudiante, setAsignaturasEstudiante] = useState<string[]>([])
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState('')
  
  const [columnasInsumos, setColumnasInsumos] = useState<ColumnaInsumo[]>([])
  const [notasInsumosMap, setNotasInsumosMap] = useState<{ [colId: string]: number }>({})
  const [notasAdicionales, setNotasAdicionales] = useState({
    refuerzo_pedagogico: 0,
    proyecto_interdisciplinar: 0,
    evaluacion_estructurada: 0
  })

  useEffect(() => {
    async function initRepresentante() {
      try {
        setCargando(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: vinculosData, error: vinculosError } = await supabase
          .from('estudiante_representantes')
          .select(`
            *,
            estudiantes (
              *,
              instituciones (*)
            )
          `)
          .eq('user_id', user.id)
          .eq('activo', true)

        if (vinculosError || !vinculosData || vinculosData.length === 0) {
          setCargando(false)
          return
        }

        const hijosList = vinculosData.map(v => v.estudiantes).filter(Boolean)
        setHijosVinculados(hijosList)

        if (hijosList.length > 0) {
          setEstudianteSeleccionadoId(hijosList[0].id)
          const inst = hijosList[0].instituciones
          if (inst) {
            setNombreInstitucion(inst.nombre_institucion || 'Unidad Educativa')
            setAnioLectivoVigente(inst.anio_lectivo_activo || inst.periodos_disponibles?.[0] || '')
          }
        }
      } catch (err) {
        console.error('Error al inicializar panel de representante:', err)
      } finally {
        setCargando(false)
      }
    }
    initRepresentante()
  }, [router])

  const estudianteActual = hijosVinculados.find(h => h.id === estudianteSeleccionadoId)

  // Autodetectar subnivel y cargar asignaturas exactas de su año, paralelo y jornada
  useEffect(() => {
    if (!estudianteActual) return
    const gradoStr = estudianteActual.grado_curso || ''
    if (['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoStr)) {
      setSubnivel('Básica Elemental')
    } else if (['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(gradoStr)) {
      setSubnivel('Básica Media')
    } else if (['8vo EGB', '9no EGB', '10mo EGB'].includes(gradoStr) || gradoStr.includes('8vo') || gradoStr.includes('9no') || gradoStr.includes('10mo')) {
      setSubnivel('Básica Superior')
    } else {
      setSubnivel('Bachillerato')
    }

    async function cargarAsignaturasHijo() {
      const jornadaHijo = estudianteActual.jornada ? estudianteActual.jornada.trim().toUpperCase() : 'MATUTINA'

      let query = supabase
        .from('docente_asignaciones')
        .select('asignatura')
        .eq('institucion_id', estudianteActual.institucion_id)
        .eq('grado_curso', estudianteActual.grado_curso)
        .eq('paralelo', estudianteActual.paralelo || 'A')
        .eq('anio_lectivo', anioLectivoVigente)

      if (estudianteActual.jornada) {
        query = query.eq('jornada', jornadaHijo)
      }

      const { data: asigData } = await query

      const unicas = Array.from(new Set((asigData || []).map((a: any) => a.asignatura.trim())))
      setAsignaturasEstudiante(unicas)
      if (unicas.length > 0) {
        setAsignaturaSeleccionada(unicas[0])
      } else {
        setAsignaturaSeleccionada('')
      }
    }
    cargarAsignaturasHijo()
  }, [estudianteSeleccionadoId, anioLectivoVigente])

  // Carga estricta de insumos: Solo de su año de básica, paralelo y jornada tal como se ven en el calificador docente
  useEffect(() => {
    async function cargarCalificacionesHijo() {
      if (!estudianteActual || !asignaturaSeleccionada || !anioLectivoVigente) return

      try {
        const jornadaHijo = estudianteActual.jornada ? estudianteActual.jornada.trim().toUpperCase() : 'MATUTINA'
        const gradoHijo = estudianteActual.grado_curso
        const paraleloHijo = estudianteActual.paralelo || 'A'

        // 1. Obtener el docente asignado específicamente a ese curso, paralelo y jornada
        let queryAsig = supabase
          .from('docente_asignaciones')
          .select('docente_id')
          .eq('institucion_id', estudianteActual.institucion_id)
          .eq('grado_curso', gradoHijo)
          .eq('paralelo', paraleloHijo)
          .ilike('asignatura', asignaturaSeleccionada.trim())
          .eq('anio_lectivo', anioLectivoVigente)

        if (estudianteActual.jornada) {
          queryAsig = queryAsig.eq('jornada', jornadaHijo)
        }

        const { data: asignacionDoc } = await queryAsig.maybeSingle()
        const docenteId = asignacionDoc?.docente_id

        // 2. Consulta idéntica al calificador docente:
        // Filtra obligatoriamente por grado_curso, paralelo, jornada, trimestre y anio_lectivo
        let queryInsumos = supabase
          .from('configuracion_insumos')
          .select('*')
          .eq('grado_curso', gradoHijo)
          .eq('paralelo', paraleloHijo)
          .eq('jornada', jornadaHijo)
          .ilike('asignatura', asignaturaSeleccionada.trim())
          .eq('trimestre', trimestre)
          .eq('anio_lectivo', anioLectivoVigente)

        if (docenteId) {
          queryInsumos = queryInsumos.eq('docente_id', docenteId)
        }

        const { data: insumosData } = await queryInsumos.order('numero', { ascending: true })

        const colsCargadas: ColumnaInsumo[] = (insumosData || []).map((item: any) => ({
          id: item.id,
          categoria: item.categoria as CategoriaInsumo,
          numero: item.numero,
          descripcion: item.descripcion
        }))
        setColumnasInsumos(colsCargadas)

        // 3. Cargar las calificaciones del estudiante para esa materia y trimestre
        let queryCal = supabase
          .from('calificaciones')
          .select('*')
          .eq('estudiante_id', estudianteActual.id)
          .ilike('asignatura', asignaturaSeleccionada.trim())
          .eq('trimestre', trimestre)
          .eq('anio_lectivo', anioLectivoVigente)

        if (docenteId) {
          queryCal = queryCal.eq('docente_id', docenteId)
        }

        const { data: calData } = await queryCal.maybeSingle()

        const mapaNotas: { [colId: string]: number } = {}
        colsCargadas.forEach((col, index) => {
          mapaNotas[col.id] = calData ? Number(calData[`insumo_${index + 1}` as keyof typeof calData] || 0) : 0
        })
        setNotasInsumosMap(mapaNotas)

        setNotasAdicionales({
          refuerzo_pedagogico: Number(calData?.refuerzo_pedagogico || 0),
          proyecto_interdisciplinar: Number(calData?.proyecto_interdisciplinar || 0),
          evaluacion_estructurada: Number(calData?.evaluacion_estructurada || 0)
        })

      } catch (err) {
        console.error('Error al cargar calificaciones del estudiante:', err)
      }
    }

    cargarCalificacionesHijo()
  }, [estudianteActual, asignaturaSeleccionada, trimestre, anioLectivoVigente])

  const ordenCategorias: CategoriaInsumo[] = ['Deberes / Indiv.', 'Tareas en Clase', 'Actividades Grupales', 'Lecciones']
  const columnasOrdenadas = [...columnasInsumos].sort((a, b) => {
    const idxA = ordenCategorias.indexOf(a.categoria)
    const idxB = ordenCategorias.indexOf(b.categoria)
    if (idxA !== idxB) return idxA - idxB
    return a.numero - b.numero
  })

  const gruposHeader = ordenCategorias.map((cat) => {
    const cols = columnasOrdenadas.filter((c) => c.categoria === cat)
    return { categoria: cat, count: cols.length, cols }
  }).filter((g) => g.count > 0)

  // Cálculo idéntico a la sábana del docente
  const calcularNotaFinal = () => {
    const notasInsumosDinamicos: number[] = []
    columnasInsumos.forEach((col) => {
      const val = notasInsumosMap[col.id] || 0
      if (val > 0) notasInsumosDinamicos.push(val)
    })

    if (notasAdicionales.refuerzo_pedagogico > 0) {
      notasInsumosDinamicos.push(notasAdicionales.refuerzo_pedagogico)
    }

    if (subnivel === 'Básica Elemental') {
      const todasLasNotas = [...notasInsumosDinamicos]
      if (notasAdicionales.proyecto_interdisciplinar > 0) todasLasNotas.push(notasAdicionales.proyecto_interdisciplinar)
      if (notasAdicionales.evaluacion_estructurada > 0) todasLasNotas.push(notasAdicionales.evaluacion_estructurada)

      if (todasLasNotas.length === 0) return 0
      const sumaTotal = todasLasNotas.reduce((a, b) => a + b, 0)
      return parseFloat((sumaTotal / todasLasNotas.length).toFixed(2))
    }

    const promFormativo = notasInsumosDinamicos.length > 0
      ? notasInsumosDinamicos.reduce((a, b) => a + b, 0) / notasInsumosDinamicos.length
      : 0
    const aporteFormativo70 = promFormativo * 0.70

    const notasSumativas = []
    if (notasAdicionales.proyecto_interdisciplinar > 0) notasSumativas.push(notasAdicionales.proyecto_interdisciplinar)
    if (notasAdicionales.evaluacion_estructurada > 0) notasSumativas.push(notasAdicionales.evaluacion_estructurada)

    const promSumativo = notasSumativas.length > 0
      ? notasSumativas.reduce((a, b) => a + b, 0) / notasSumativas.length
      : 0
    const aporteSumativo30 = promSumativo * 0.30

    return parseFloat((aporteFormativo70 + aporteSumativo30).toFixed(2))
  }

  const obtenerEscalaCualitativa = (prom: number) => {
    if (prom >= 9.00) return { label: 'DAR', color: 'bg-emerald-100 text-emerald-800 border border-emerald-200' }
    if (prom >= 7.00) return { label: 'AAR', color: 'bg-blue-100 text-blue-800 border border-blue-200' }
    if (prom >= 4.01) return { label: 'PA', color: 'bg-amber-100 text-amber-800 border border-amber-200' }
    return { label: 'NA', color: 'bg-rose-100 text-rose-800 border border-rose-200' }
  }

  const getHeaderColor = (cat: CategoriaInsumo) => {
    switch (cat) {
      case 'Deberes / Indiv.': return 'bg-[#4b4c99] text-white'
      case 'Tareas en Clase': return 'bg-indigo-700 text-white'
      case 'Actividades Grupales': return 'bg-[#45b3a5] text-slate-950'
      case 'Lecciones': return 'bg-teal-700 text-white'
      default: return 'bg-slate-800 text-white'
    }
  }

  const promFinal = calcularNotaFinal()
  const cuali = obtenerEscalaCualitativa(promFinal)

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando calificaciones del estudiante...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans max-w-7xl mx-auto">

      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Modo Consulta Familiar
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Calificaciones del Representado
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Año Lectivo: <strong className="text-slate-800">{anioLectivoVigente || 'Sin año activo'}</strong> ({trimestre})
          </p>
        </div>

        <button
          onClick={() => { supabase.auth.signOut(); router.push('/'); }}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* SELECTOR DE HIJO, ASIGNATURA Y TRIMESTRE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Seleccionar Representado (Hijo/a):</label>
          <select
            value={estudianteSeleccionadoId}
            onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
          >
            {hijosVinculados.map((hijo) => (
              <option key={hijo.id} value={hijo.id} className="text-slate-900 font-bold bg-white">
                {hijo.apellidos} {hijo.nombres} — {hijo.grado_curso} "{hijo.paralelo || 'A'}" ({hijo.jornada || 'MATUTINA'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Asignatura:</label>
          <select
            value={asignaturaSeleccionada}
            onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
          >
            {asignaturasEstudiante.length === 0 ? (
              <option value="" className="text-slate-500 font-bold bg-white">Sin asignaturas disponibles</option>
            ) : (
              asignaturasEstudiante.map((asig) => (
                <option key={asig} value={asig} className="text-slate-900 font-bold bg-white">{asig}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-amber-900 font-bold uppercase mb-1.5">Trimestre de Consulta:</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            className="w-full p-3 border-2 border-amber-300 rounded-xl text-xs font-black text-amber-950 bg-amber-50/60 outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
          >
            <option value="Trimestre 1" className="text-slate-900 font-bold bg-white">Trimestre 1</option>
            <option value="Trimestre 2" className="text-slate-900 font-bold bg-white">Trimestre 2</option>
            <option value="Trimestre 3" className="text-slate-900 font-bold bg-white">Trimestre 3</option>
          </select>
        </div>
      </div>

      {/* DETALLE INFORMATIVO DEL CURSO */}
      {estudianteActual && (
        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
          <span>Curso: <strong className="text-slate-900">{estudianteActual.grado_curso}</strong></span>
          <span>Paralelo: <strong className="text-slate-900">{estudianteActual.paralelo || 'A'}</strong></span>
          <span>Jornada: <strong className="text-slate-900">{estudianteActual.jornada || 'MATUTINA'}</strong></span>
          <span>Subnivel: <strong className="text-slate-900">{subnivel}</strong></span>
        </div>
      )}

      {/* TABLA SÁBANA EN MODO SOLO LECTURA */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {!estudianteActual ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs">No hay estudiantes vinculados a este usuario.</div>
        ) : !asignaturaSeleccionada ? (
          <div className="p-12 text-center text-amber-800 bg-amber-50 font-bold text-xs">
            ⚠️ No se encontraron asignaturas registradas para este curso en el año vigente.
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="text-slate-800 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 w-10 text-center bg-slate-50 border border-slate-300" rowSpan={2}>#</th>
                  <th className="p-3.5 min-w-50 bg-slate-50 border border-slate-300" rowSpan={2}>Estudiante</th>

                  {gruposHeader.length === 0 ? (
                    <th className="p-3.5 text-center bg-amber-50 text-amber-900 border border-slate-300 italic" colSpan={1}>
                      ⚠️ No hay insumos registrados para {estudianteActual.grado_curso} "{estudianteActual.paralelo || 'A'}" ({estudianteActual.jornada || 'MATUTINA'}) en {trimestre}
                    </th>
                  ) : (
                    gruposHeader.map((g) => (
                      <th 
                        key={g.categoria} 
                        className={`p-2.5 text-center border border-slate-300 text-xs font-bold uppercase tracking-wider ${getHeaderColor(g.categoria)}`}
                        colSpan={g.count}
                      >
                        {g.categoria}
                      </th>
                    ))
                  )}

                  <th className="p-2.5 text-center bg-amber-50 text-amber-900 border border-slate-300 font-bold" rowSpan={2}>
                    Refuerzo Pedag.
                  </th>

                  <th className="p-2.5 text-center bg-[#4b4c99] text-white border border-slate-300 font-bold" colSpan={2}>
                    APORTES SUMATIVOS {subnivel !== 'Básica Elemental' && '(30% - ' + trimestre + ')'}
                  </th>

                  <th className="p-3.5 text-center w-24 bg-slate-100 border border-slate-300 font-bold" rowSpan={2}>Prom. Final</th>
                  <th className="p-3.5 text-center w-20 bg-slate-100 border border-slate-300 font-bold" rowSpan={2}>Escala</th>
                </tr>

                <tr className="bg-slate-50 text-slate-800 text-[9px] font-bold">
                  {columnasOrdenadas.length === 0 ? (
                    <th className="p-2 text-center text-slate-400 border border-slate-300">Sin Insumos</th>
                  ) : (
                    columnasOrdenadas.map((col) => (
                      <th key={col.id} className="p-2 text-center border border-slate-300 min-w-22.5 bg-white">
                        <span className="block font-bold text-slate-900">INSUMO {col.numero}</span>
                        <span className="block text-[8px] font-medium text-slate-500 truncate" title={col.descripcion}>
                          {col.descripcion}
                        </span>
                      </th>
                    ))
                  )}

                  <th className="p-1.5 text-center bg-indigo-50/50 border border-slate-300 min-w-27.5 font-bold text-indigo-950">Proy. Interdisciplinar</th>
                  <th className="p-1.5 text-center bg-indigo-50/50 border border-slate-300 min-w-30 font-bold text-indigo-950">Ev. Base Estructurada</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-bold text-slate-400 text-center border border-slate-300">1</td>
                  <td className="p-3 font-bold text-slate-800 border border-slate-300 whitespace-nowrap">
                    {estudianteActual.apellidos} {estudianteActual.nombres}
                  </td>

                  {columnasOrdenadas.length === 0 ? (
                    <td className="p-3 text-center text-slate-300 border border-slate-300">-</td>
                  ) : (
                    columnasOrdenadas.map((col) => (
                      <td key={col.id} className="p-1.5 text-center border border-slate-300">
                        <input
                          type="number"
                          disabled={true}
                          value={notasInsumosMap[col.id] > 0 ? notasInsumosMap[col.id].toFixed(2) : ''}
                          className="w-14 p-1.5 text-center border border-slate-300 rounded-lg font-semibold text-slate-800 bg-slate-100 shadow-2xs cursor-not-allowed mx-auto"
                        />
                      </td>
                    ))
                  )}

                  <td className="p-1.5 text-center bg-amber-50/20 border border-slate-300">
                    <input
                      type="number"
                      disabled={true}
                      value={notasAdicionales.refuerzo_pedagogico > 0 ? notasAdicionales.refuerzo_pedagogico.toFixed(2) : ''}
                      placeholder="Opt."
                      className="w-14 p-1.5 text-center border border-amber-300 rounded-lg font-semibold text-amber-900 bg-slate-100 shadow-2xs cursor-not-allowed mx-auto"
                    />
                  </td>

                  <td className="p-1.5 text-center bg-indigo-50/20 border border-slate-300">
                    <input
                      type="number"
                      disabled={true}
                      value={notasAdicionales.proyecto_interdisciplinar > 0 ? notasAdicionales.proyecto_interdisciplinar.toFixed(2) : ''}
                      className="w-16 p-1.5 text-center border border-indigo-200 rounded-lg font-semibold text-indigo-950 bg-slate-100 shadow-2xs cursor-not-allowed mx-auto"
                    />
                  </td>

                  <td className="p-1.5 text-center bg-indigo-50/20 border border-slate-300">
                    <input
                      type="number"
                      disabled={true}
                      value={notasAdicionales.evaluacion_estructurada > 0 ? notasAdicionales.evaluacion_estructurada.toFixed(2) : ''}
                      className="w-16 p-1.5 text-center border border-indigo-200 rounded-lg font-semibold text-indigo-950 bg-slate-100 shadow-2xs cursor-not-allowed mx-auto"
                    />
                  </td>

                  <td className="p-3 text-center bg-slate-50 font-bold text-sm text-slate-900 border border-slate-300">
                    {promFinal.toFixed(2)}
                  </td>

                  <td className="p-3 text-center bg-slate-50 border border-slate-300">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${cuali.color} shadow-2xs inline-block`}>
                      {cuali.label}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}