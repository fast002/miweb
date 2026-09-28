'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SabanaTrimestralPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [docenteId, setDocenteId] = useState('')

  // Control Dinámico de Años Lectivos Sincronizado con periodos_disponibles de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Asignaciones permitidas por el Rector para el año vigente
  const [asignaciones, setAsignaciones] = useState<any[]>([])
  
  // Filtros principales
  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('')
  const [trimestreSeleccionado, setTrimestreSeleccionado] = useState('Trimestre 1')

  // Datos de la tabla
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [materiasUnicas, setMateriasUnicas] = useState<string[]>([])
  const [matrizCalificaciones, setMatrizCalificaciones] = useState<{ [estudianteId: string]: { [asignatura: string]: { formativo: number, formativo70: number, sumativo: number, sumativo30: number, promedio: number } } }>({})

  useEffect(() => {
    cargarDatosDocente()
  }, [])

  useEffect(() => {
    if (gradoSeleccionado && paraleloSeleccionado && trimestreSeleccionado && institucionId && anioLectivoVigente) {
      cargarEstudiantesYMatrizTrimestral()
    }
  }, [gradoSeleccionado, paraleloSeleccionado, trimestreSeleccionado, anioLectivoVigente, institucionId])

  const cargarDatosDocente = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      setDocenteId(user.id)

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      let anioActivo = ''
      let periodosList: string[] = []
      let cerradosList: string[] = []

      if (doc?.institucion_id) {
        setInstitucionId(doc.institucion_id)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')

        const inst = doc.instituciones
        if (inst) {
          // Tomar los años estrictamente de periodos_disponibles de la institución
          periodosList = inst.periodos_disponibles || []
          setPeriodosDisponibles(periodosList)

          if (inst.anio_lectivo_activo && periodosList.includes(inst.anio_lectivo_activo)) {
            anioActivo = inst.anio_lectivo_activo
          } else if (periodosList.length > 0) {
            anioActivo = periodosList[0]
          }

          setAnioLectivoVigente(anioActivo)

          if (inst.anos_cerrados && Array.isArray(inst.anos_cerrados)) {
            cerradosList = inst.anos_cerrados
            setAnosCerrados(cerradosList)
          }
        }

        // Cargar asignaciones del docente estrictamente del año vigente detectado
        if (anioActivo) {
          const { data: asigs } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asigs && asigs.length > 0) {
            setAsignaciones(asigs)
            setGradoSeleccionado(asigs[0].grado_curso)
            setParaleloSeleccionado(asigs[0].paralelo)
          } else {
            setAsignaciones([])
          }
        } else {
          setAsignaciones([])
        }
      }
    } catch (err) {
      console.error('Error al cargar datos del docente:', err)
    } finally {
      setCargando(false)
    }
  }

  // Manejar cambio dinámico del periodo desde el selector superior
  const handleCambiarPeriodo = async (nuevoAnio: string) => {
    setAnioLectivoVigente(nuevoAnio)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: asigs } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', user.id)
        .eq('anio_lectivo', nuevoAnio)

      if (asigs && asigs.length > 0) {
        setAsignaciones(asigs)
        setGradoSeleccionado(asigs[0].grado_curso)
        setParaleloSeleccionado(asigs[0].paralelo)
      } else {
        setAsignaciones([])
        setGradoSeleccionado('')
        setParaleloSeleccionado('')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const cargarEstudiantesYMatrizTrimestral = async () => {
    try {
      setCargando(true)

      // 1. Obtener todas las asignaturas únicas que el docente imparte para este grado y paralelo en el año vigente
      const materiasDelCurso = Array.from(new Set(
        asignaciones
          .filter(a => a.grado_curso === gradoSeleccionado && a.paralelo === paraleloSeleccionado)
          .map(a => a.asignatura)
      ))
      setMateriasUnicas(materiasDelCurso)

      // 2. Cargar estudiantes activos del curso y paralelo
      const { data: estData } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('anio_lectivo', anioLectivoVigente)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      if (estData) {
        setEstudiantes(estData)
        const estIds = estData.map(e => e.id)

        // 3. Cargar todos los registros de calificaciones para este trimestre, año vigente y estudiantes
        const { data: calData } = await supabase
          .from('calificaciones')
          .select('*')
          .eq('docente_id', docenteId)
          .eq('trimestre', trimestreSeleccionado)
          .eq('anio_lectivo', anioLectivoVigente)
          .in('estudiante_id', estIds.length > 0 ? estIds : ['none'])

        const mapaMatriz: any = {}

        estData.forEach(est => {
          mapaMatriz[est.id] = {}
          materiasDelCurso.forEach(materia => {
            const reg = calData?.find(c => c.estudiante_id === est.id && c.asignatura.trim() === materia.trim())
            
            const prom = reg?.promedio_parcial !== undefined && reg?.promedio_parcial !== null ? Number(reg.promedio_parcial) : 0
            
            const formativo = reg?.insumo_1 !== undefined ? (Number(reg.insumo_1) + Number(reg.insumo_2 || 0)) / 2 : prom
            const formativo70 = Number((formativo * 0.70).toFixed(2))
            
            const sumativo = Number(reg?.proyecto_interdisciplinar || reg?.evaluacion_estructurada || prom)
            const sumativo30 = Number((sumativo * 0.30).toFixed(2))

            mapaMatriz[est.id][materia] = {
              formativo: Number(formativo.toFixed(2)),
              formativo70,
              sumativo: Number(sumativo.toFixed(2)),
              sumativo30,
              promedio: Number(prom.toFixed(2))
            }
          })
        })

        setMatrizCalificaciones(mapaMatriz)
      }
    } catch (err) {
      console.error('Error al cargar matriz trimestral:', err)
    } finally {
      setCargando(false)
    }
  }

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  // Función de escala cualitativa basada en la fórmula de Sheets para Básica Elemental
  const obtenerEscalaElemental = (nota: number) => {
    if (nota === undefined || nota === null || isNaN(nota) || nota <= 0) return ''
    if (nota >= 9.01) return 'A+'
    if (nota >= 8.01) return 'A-'
    if (nota >= 7.01) return 'B+'
    if (nota >= 6.01) return 'B-'
    if (nota >= 5.01) return 'C+'
    if (nota >= 4.01) return 'C-'
    if (nota >= 3.01) return 'D+'
    if (nota >= 2.01) return 'D-'
    if (nota >= 1.01) return 'E+'
    return 'E-'
  }

  if (cargando && estudiantes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Sábana Trimestral...</p>
        </div>
      </div>
    )
  }

  const gradosUnicos = Array.from(new Set(asignaciones.map(a => a.grado_curso)))
  const paralelosPermitidos = Array.from(new Set(asignaciones.filter(a => a.grado_curso === gradoSeleccionado).map(a => a.paralelo)))

  // Validación de subnivel para Básica Elemental (2do, 3ro y 4to EGB)
  const esBasicaElemental = ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoSeleccionado)

  // Colores distintivos para las cabeceras de las materias en la sábana
  const coloresMaterias = [
    'bg-purple-900 text-white',
    'bg-indigo-900 text-white',
    'bg-pink-900 text-white',
    'bg-emerald-900 text-white',
    'bg-sky-900 text-white',
    'bg-blue-900 text-white',
    'bg-amber-900 text-white'
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-[95%] mx-auto space-y-6">

        {/* ENCABEZADO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-black uppercase">
              Módulo Académico • Sábana Consolidada Trimestral ({anioLectivoVigente || 'Sin año activo'})
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Consolidado General por Asignaturas ({trimestreSeleccionado}) {esBasicaElemental && '• [Básica Elemental - Cualitativa]'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {nombreInstitucion} • Curso: {gradoSeleccionado} "{paraleloSeleccionado}"
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => router.push('/docente/calificaciones')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border transition"
            >
              ← Volver a Calificaciones
            </button>
          </div>
        </div>

        {/* AVISO SI NO HAY AÑO ACTIVO */}
        {!anioLectivoVigente && !cargando && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold">
            ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
          </div>
        )}

        {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
        {esAnioCerrado && anioLectivoVigente && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold flex items-center justify-between">
            <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. La sábana trimestral está en modo de solo lectura.</span>
            <span className="bg-red-200 px-2.5 py-1 rounded">Periodo Cerrado</span>
          </div>
        )}

        {/* SELECTORES DE FILTRO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Grado / Curso:</label>
            <select
              value={gradoSeleccionado}
              onChange={(e) => {
                const nuevoGrado = e.target.value
                setGradoSeleccionado(nuevoGrado)
                const par = asignaciones.find(a => a.grado_curso === nuevoGrado)?.paralelo || 'A'
                setParaleloSeleccionado(par)
              }}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {gradosUnicos.length === 0 ? (
                <option value="">Sin carga asignada</option>
              ) : (
                gradosUnicos.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Paralelo:</label>
            <select
              value={paraleloSeleccionado}
              onChange={(e) => setParaleloSeleccionado(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {paralelosPermitidos.map(p => (
                <option key={p} value={p}>Paralelo {p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1">Trimestre:</label>
            <select
              value={trimestreSeleccionado}
              onChange={(e) => setTrimestreSeleccionado(e.target.value)}
              className="w-full p-2.5 border-2 border-indigo-500 rounded-xl text-xs font-black text-indigo-900 bg-indigo-50 outline-none"
            >
              <option value="Trimestre 1">Trimestre 1</option>
              <option value="Trimestre 2">Trimestre 2</option>
              <option value="Trimestre 3">Trimestre 3</option>
            </select>
          </div>
        </div>

        {/* TABLA SÁBANA GENERAL */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          <div className="p-4 bg-[#1E3A8A] text-white flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-wider">
              MATRIZ GENERAL DE RENDIMIENTO • {gradoSeleccionado || 'Curso'} "{paraleloSeleccionado}" ({trimestreSeleccionado} - {anioLectivoVigente || 'Sin periodo'})
            </h2>
            <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-lg">
              {estudiantes.length} Estudiantes • {materiasUnicas.length} Asignaturas
            </span>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="bg-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 border border-slate-300 text-center w-12" rowSpan={2}>Nro</th>
                  <th className="p-3 border border-slate-300 w-32" rowSpan={2}>Cédula</th>
                  <th className="p-3 border border-slate-300 min-w-[220px]" rowSpan={2}>Apellidos y Nombres</th>
                  
                  {/* Cabeceras dinámicas por Materia */}
                  {materiasUnicas.map((materia, idx) => (
                    <th key={materia} className={`p-2 border border-slate-300 text-center font-black ${coloresMaterias[idx % coloresMaterias.length]}`} colSpan={esBasicaElemental ? 2 : 5}>
                      {materia}
                    </th>
                  ))}
                </tr>

                <tr className="bg-slate-100 text-[9px] text-center">
                  {materiasUnicas.map(materia => (
                    esBasicaElemental ? (
                      <Fragment key={`${materia}-elemental`}>
                        <th className="border border-slate-300 p-1 bg-slate-50 font-semibold">PROMEDIO</th>
                        <th className="border border-slate-300 p-1 bg-slate-100 font-bold">CALF. CUALI.</th>
                      </Fragment>
                    ) : (
                      <Fragment key={`${materia}-normal`}>
                        <th className="border border-slate-300 p-1 bg-slate-50 font-semibold" title="Evaluación Formativa">EVA. FORM.</th>
                        <th className="border border-slate-300 p-1 bg-slate-100 font-bold">70%</th>
                        <th className="border border-slate-300 p-1 bg-slate-50 font-semibold" title="Evaluación Sumativa">EVA. SUM.</th>
                        <th className="border border-slate-300 p-1 bg-slate-100 font-bold">30%</th>
                        <th className="border border-slate-300 p-1 bg-blue-100 text-blue-900 font-black">PROM.</th>
                      </Fragment>
                    )
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {!anioLectivoVigente ? (
                  <tr>
                    <td colSpan={3 + (materiasUnicas.length * (esBasicaElemental ? 2 : 5))} className="p-8 text-center text-amber-800 font-bold bg-amber-50">
                      ⚠️ No hay un año lectivo activo configurado en la institución.
                    </td>
                  </tr>
                ) : asignaciones.length === 0 ? (
                  <tr>
                    <td colSpan={3 + (materiasUnicas.length * (esBasicaElemental ? 2 : 5))} className="p-8 text-center text-amber-800 font-bold bg-amber-50">
                      ⚠️ No tienes carga horaria asignada para el periodo vigente ({anioLectivoVigente}).
                    </td>
                  </tr>
                ) : estudiantes.length === 0 ? (
                  <tr>
                    <td colSpan={3 + (materiasUnicas.length * (esBasicaElemental ? 2 : 5))} className="p-8 text-center text-slate-500 font-medium">
                      No hay estudiantes registrados o asignaturas disponibles para este curso en el periodo {anioLectivoVigente}.
                    </td>
                  </tr>
                ) : (
                  estudiantes.map((est, idx) => {
                    const notasEstudiante = matrizCalificaciones[est.id] || {}

                    return (
                      <tr key={est.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-300 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 text-slate-600 font-mono">{est.cedula || 'S/N'}</td>
                        <td className="p-2 border border-slate-300 font-bold text-slate-800 uppercase whitespace-nowrap">
                          {est.apellidos} {est.nombres}
                        </td>

                        {materiasUnicas.map(materia => {
                          const valMateria = notasEstudiante[materia] || { formativo: 0, formativo70: 0, sumativo: 0, sumativo30: 0, promedio: 0 }
                          const escalaCuali = obtenerEscalaElemental(valMateria.promedio)

                          return (
                            esBasicaElemental ? (
                              <Fragment key={`${est.id}-${materia}-elem-val`}>
                                <td className="p-2 border border-slate-300 text-center font-semibold text-slate-800 bg-slate-50/50">
                                  {valMateria.promedio > 0 ? valMateria.promedio.toFixed(2) : '0.00'}
                                </td>
                                <td className="p-2 border border-slate-300 text-center font-black text-indigo-900 bg-indigo-50/50">
                                  {escalaCuali || '0.00'}
                                </td>
                              </Fragment>
                            ) : (
                              <Fragment key={`${est.id}-${materia}-norm-val`}>
                                <td className="p-2 border border-slate-300 text-center font-semibold text-slate-700 bg-slate-50/50">
                                  {valMateria.formativo > 0 ? valMateria.formativo.toFixed(2) : '0.00'}
                                </td>
                                <td className="p-2 border border-slate-300 text-center font-bold text-slate-800 bg-slate-100/50">
                                  {valMateria.formativo70 > 0 ? valMateria.formativo70.toFixed(2) : '0.00'}
                                </td>
                                <td className="p-2 border border-slate-300 text-center font-semibold text-slate-700 bg-slate-50/50">
                                  {valMateria.sumativo > 0 ? valMateria.sumativo.toFixed(2) : '0.00'}
                                </td>
                                <td className="p-2 border border-slate-300 text-center font-bold text-slate-800 bg-slate-100/50">
                                  {valMateria.sumativo30 > 0 ? valMateria.sumativo30.toFixed(2) : '0.00'}
                                </td>
                                <td className="p-2 border border-slate-300 text-center font-black text-blue-900 bg-blue-50/70">
                                  {valMateria.promedio > 0 ? valMateria.promedio.toFixed(2) : '0.00'}
                                </td>
                              </Fragment>
                            )
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}