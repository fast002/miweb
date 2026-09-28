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

  // Hijos vinculados al padre logueado
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

  // 1. Cargar el usuario padre logueado y sus hijos vinculados
  useEffect(() => {
    async function initRepresentante() {
      try {
        setCargando(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        // Buscar los vínculos del representante en la tabla estudiante_representantes
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

        // Extraer la lista de hijos
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

  // Obtener el objeto del estudiante actual seleccionado
  const estudianteActual = hijosVinculados.find(h => h.id === estudianteSeleccionadoId)

  // Detectar subnivel según el grado del estudiante
  useEffect(() => {
    if (!estudianteActual) return
    const gradoStr = estudianteActual.grado_curso || ''
    if (['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoStr)) {
      setSubnivel('Básica Elemental')
    } else if (['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(gradoStr)) {
      setSubnivel('Básica Media')
    } else if (['8vo EGB', '9no EGB', '10mo EGB'].includes(gradoStr)) {
      setSubnivel('Básica Superior')
    } else {
      setSubnivel('Bachillerato')
    }

    // Cargar asignaturas disponibles para este grado/paralelo/jornada
    async function cargarAsignaturasHijo() {
      const { data: asigData } = await supabase
        .from('docente_asignaciones')
        .select('asignatura')
        .eq('institucion_id', estudianteActual.institucion_id)
        .eq('grado_curso', estudianteActual.grado_curso)
        .eq('paralelo', estudianteActual.paralelo || 'A')
        .eq('anio_lectivo', anioLectivoVigente)

      const unicas = Array.from(new Set((asigData || []).map(a => a.asignatura)))
      setAsignaturasEstudiante(unicas)
      if (unicas.length > 0) {
        setAsignaturaSeleccionada(unicas[0])
      } else {
        setAsignaturaSeleccionada('')
      }
    }
    cargarAsignaturasHijo()
  }, [estudianteSeleccionadoId, anioLectivoVigente])

  // 2. Cargar las calificaciones e insumos del hijo para la asignatura y trimestre seleccionados
  useEffect(() => {
    async function cargarCalificacionesHijo() {
      if (!estudianteActual || !asignaturaSeleccionada || !anioLectivoVigente) return

      try {
        // Encontrar qué docente imparte esta asignatura a este curso
        const { data: asignacionDoc } = await supabase
          .from('docente_asignaciones')
          .select('docente_id')
          .eq('institucion_id', estudianteActual.institucion_id)
          .eq('grado_curso', estudianteActual.grado_curso)
          .eq('paralelo', estudianteActual.paralelo || 'A')
          .ilike('asignatura', asignaturaSeleccionada.trim())
          .eq('anio_lectivo', anioLectivoVigente)
          .maybeSingle()

        if (!asignacionDoc) {
          setColumnasInsumos([])
          setNotasInsumosMap({})
          return
        }

        const docenteId = asignacionDoc.docente_id

        // Cargar estructura de insumos del docente
        const { data: insumosData } = await supabase
          .from('configuracion_insumos')
          .select('*')
          .eq('docente_id', docenteId)
          .ilike('asignatura', asignaturaSeleccionada.trim())
          .eq('trimestre', trimestre)
          .order('numero', { ascending: true })

        const colsCargadas: ColumnaInsumo[] = (insumosData || []).map((item) => ({
          id: item.id,
          categoria: item.categoria as CategoriaInsumo,
          numero: item.numero,
          descripcion: item.descripcion
        }))
        setColumnasInsumos(colsCargadas)

        // Cargar la nota específica del estudiante
        const { data: calData } = await supabase
          .from('calificaciones')
          .select('*')
          .eq('estudiante_id', estudianteActual.id)
          .eq('docente_id', docenteId)
          .ilike('asignatura', asignaturaSeleccionada.trim())
          .eq('trimestre', trimestre)
          .eq('anio_lectivo', anioLectivoVigente)
          .maybeSingle()

        const mapaNotas: { [colId: string]: number } = {}
        colsCargadas.forEach((col, index) => {
          mapaNotas[col.id] = calData ? (calData[`insumo_${index + 1}` as keyof typeof calData] || 0) : 0
        })
        setNotasInsumosMap(mapaNotas)

        setNotasAdicionales({
          refuerzo_pedagogico: calData?.refuerzo_pedagogico || 0,
          proyecto_interdisciplinar: calData?.proyecto_interdisciplinar || 0,
          evaluacion_estructurada: calData?.evaluacion_estructurada || 0
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

  // Cálculo del promedio final idéntico al del docente
  const calcularNotaFinal = () => {
    const notasInsumosDinamicos: number[] = []
    columnasInsumos.forEach((col) => {
      const val = notasInsumosMap[col.id] || 0
      if (val > 0) notasInsumosDinamicos.push(val)
    })

    if (notasAdicionales.refuerzo_pedagogico > 0) notasInsumosDinamicos.push(notasAdicionales.refuerzo_pedagogico)

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
    if (prom >= 9.00) return { label: 'DAR', color: 'bg-emerald-100 text-emerald-800' }
    if (prom >= 7.00) return { label: 'AAR', color: 'bg-blue-100 text-blue-800' }
    if (prom >= 4.01) return { label: 'PA', color: 'bg-amber-100 text-amber-800' }
    return { label: 'NA', color: 'bg-red-100 text-red-800' }
  }

  const getHeaderColor = (cat: CategoriaInsumo) => {
    switch (cat) {
      case 'Deberes / Indiv.': return 'bg-purple-900 text-white'
      case 'Tareas en Clase': return 'bg-indigo-800 text-white'
      case 'Actividades Grupales': return 'bg-sky-800 text-white'
      case 'Lecciones': return 'bg-emerald-800 text-white'
      default: return 'bg-slate-800 text-white'
    }
  }

  const promFinal = calcularNotaFinal()
  const cuali = obtenerEscalaCualitativa(promFinal)

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mx-auto mb-3"></div>
          <p className="text-xs font-bold text-slate-600">Cargando calificaciones del estudiante...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ENCABEZADO */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <span>Calificaciones del Representado</span>
              <span className="text-xs bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">Modo Consulta Familiar</span>
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              {nombreInstitucion} • Año Lectivo: <strong className="text-slate-900">{anioLectivoVigente}</strong> ({trimestre})
            </p>
          </div>
          <button
            onClick={() => { supabase.auth.signOut(); router.push('/'); }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* SELECTOR DE HIJO Y TRIMESTRE */}
        <div className="bg-white p-4 rounded-2xl border shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Seleccionar Representado (Hijo/a):</label>
            <select
              value={estudianteSeleccionadoId}
              onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
            >
              {hijosVinculados.map((hijo) => (
                <option key={hijo.id} value={hijo.id}>
                  {hijo.apellidos} {hijo.nombres} — {hijo.grado_curso} "{hijo.paralelo || 'A'}"
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Asignatura:</label>
            <select
              value={asignaturaSeleccionada}
              onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
            >
              {asignaturasEstudiante.length === 0 ? (
                <option value="">Sin asignaturas disponibles</option>
              ) : (
                asignaturasEstudiante.map((asig) => (
                  <option key={asig} value={asig}>{asig}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-amber-700 uppercase mb-1">Trimestre de Consulta:</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(e.target.value)}
              className="w-full p-2.5 border-2 border-amber-400 rounded-xl text-xs font-black text-amber-950 bg-amber-50 outline-none"
            >
              <option value="Trimestre 1">Trimestre 1</option>
              <option value="Trimestre 2">Trimestre 2</option>
              <option value="Trimestre 3">Trimestre 3</option>
            </select>
          </div>
        </div>

        {/* TABLA SÁBANA EN MODO SOLO LECTURA PARA EL PADRE */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
          {!estudianteActual ? (
            <div className="p-12 text-center text-slate-500 font-semibold text-xs">No hay estudiantes vinculados a este usuario.</div>
          ) : !asignaturaSeleccionada ? (
            <div className="p-12 text-center text-amber-800 bg-amber-50 font-bold text-xs">
              ⚠️ No se encontraron asignaturas registradas para este curso.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="text-slate-800 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 w-10 text-center bg-slate-100 border border-slate-300" rowSpan={2}>#</th>
                  <th className="p-3 min-w-50 bg-slate-100 border border-slate-300" rowSpan={2}>Estudiante</th>

                  {gruposHeader.length === 0 ? (
                    <th className="p-3 text-center bg-amber-50 text-amber-900 border border-slate-300 italic" colSpan={1}>
                      ⚠️ El docente aún no ha registrado insumos en esta asignatura
                    </th>
                  ) : (
                    gruposHeader.map((g) => (
                      <th 
                        key={g.categoria} 
                        className={`p-2 text-center border border-slate-300 text-xs font-black uppercase ${getHeaderColor(g.categoria)}`}
                        colSpan={g.count}
                      >
                        {g.categoria}
                      </th>
                    ))
                  )}

                  <th className="p-2 text-center bg-amber-200 text-amber-950 border border-slate-300 font-black" rowSpan={2}>
                    Refuerzo Pedag.
                  </th>

                  <th className="p-2 text-center bg-purple-900 text-white border border-slate-300 font-black" colSpan={2}>
                    APORTES SUMATIVOS {subnivel !== 'Básica Elemental' && '(30% - ' + trimestre + ')'}
                  </th>

                  <th className="p-3 text-center w-24 bg-slate-200 border border-slate-300 font-black" rowSpan={2}>Prom. Final</th>
                  <th className="p-3 text-center w-20 bg-slate-200 border border-slate-300 font-black" rowSpan={2}>Escala</th>
                </tr>

                <tr className="bg-slate-100 text-slate-800 text-[9px] font-bold">
                  {columnasOrdenadas.length === 0 ? (
                    <th className="p-2 text-center text-slate-400 border border-slate-300">Sin Insumos</th>
                  ) : (
                    columnasOrdenadas.map((col) => (
                      <th key={col.id} className="p-2 text-center border border-slate-300 min-w-22.5 bg-slate-50">
                        <span className="block font-black text-slate-900">INSUMO {col.numero}</span>
                        <span className="block text-[8px] font-medium text-slate-500 truncate" title={col.descripcion}>
                          {col.descripcion}
                        </span>
                      </th>
                    ))
                  )}

                  <th className="p-1.5 text-center bg-purple-100 border border-slate-300 min-w-27.5">Proy. Interdisciplinar</th>
                  <th className="p-1.5 text-center bg-purple-100 border border-slate-300 min-w-30">Ev. Base Estructurada</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="p-2 font-bold text-slate-400 text-center border border-slate-300">1</td>
                  <td className="p-2 font-bold text-slate-800 border border-slate-300 whitespace-nowrap">
                    {estudianteActual.apellidos} {estudianteActual.nombres}
                  </td>

                  {columnasOrdenadas.length === 0 ? (
                    <td className="p-2 text-center text-slate-300 border border-slate-300">-</td>
                  ) : (
                    columnasOrdenadas.map((col) => (
                      <td key={col.id} className="p-1 text-center border border-slate-300">
                        <input
                          type="number"
                          disabled={true}
                          value={notasInsumosMap[col.id] > 0 ? notasInsumosMap[col.id] : ''}
                          className="w-14 p-1 text-center border rounded font-semibold text-slate-800 bg-slate-100 cursor-not-allowed"
                        />
                      </td>
                    ))
                  )}

                  <td className="p-1 text-center bg-amber-50/40 border border-slate-300">
                    <input
                      type="number"
                      disabled={true}
                      value={notasAdicionales.refuerzo_pedagogico > 0 ? notasAdicionales.refuerzo_pedagogico : ''}
                      className="w-14 p-1 text-center border border-amber-300 rounded font-semibold text-amber-900 bg-slate-100 cursor-not-allowed"
                    />
                  </td>

                  <td className="p-1 text-center bg-purple-50/40 border border-slate-300">
                    <input
                      type="number"
                      disabled={true}
                      value={notasAdicionales.proyecto_interdisciplinar > 0 ? notasAdicionales.proyecto_interdisciplinar : ''}
                      className="w-16 p-1 text-center border border-purple-300 rounded font-semibold text-purple-900 bg-slate-100 cursor-not-allowed"
                    />
                  </td>

                  <td className="p-1 text-center bg-purple-50/40 border border-slate-300">
                    <input
                      type="number"
                      disabled={true}
                      value={notasAdicionales.evaluacion_estructurada > 0 ? notasAdicionales.evaluacion_estructurada : ''}
                      className="w-16 p-1 text-center border border-purple-300 rounded font-semibold text-purple-900 bg-slate-100 cursor-not-allowed"
                    />
                  </td>

                  <td className="p-2 text-center bg-slate-100 font-black text-sm text-slate-900 border border-slate-300">
                    {promFinal.toFixed(2)}
                  </td>

                  <td className="p-2 text-center bg-slate-100 border border-slate-300">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${cuali.color}`}>
                      {cuali.label}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}