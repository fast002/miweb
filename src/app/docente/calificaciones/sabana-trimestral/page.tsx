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

      const materiasDelCurso = Array.from(new Set(
        asignaciones
          .filter(a => a.grado_curso === gradoSeleccionado && a.paralelo === paraleloSeleccionado)
          .map(a => a.asignatura)
      ))
      setMateriasUnicas(materiasDelCurso)

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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Sábana Trimestral...</p>
        </div>
      </div>
    )
  }

  const gradosUnicos = Array.from(new Set(asignaciones.map(a => a.grado_curso)))
  const paralelosPermitidos = Array.from(new Set(asignaciones.filter(a => a.grado_curso === gradoSeleccionado).map(a => a.paralelo)))
  const esBasicaElemental = ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoSeleccionado)

  // Estilos de color distintivos por trimestre
  const getTrimestreColorStyle = (tri: string) => {
    switch (tri) {
      case 'Trimestre 1':
        return { backgroundColor: '#4b4c99', color: '#ffffff' }
      case 'Trimestre 2':
        return { backgroundColor: '#389186', color: '#ffffff' }
      case 'Trimestre 3':
        return { backgroundColor: '#d99b1e', color: '#ffffff' }
      default:
        return { backgroundColor: '#4b4c99', color: '#ffffff' }
    }
  }

  // Paleta de colores profesionales y corporativos para diferenciar cada materia en la tabla
  const paletaMaterias = [
    { headerBg: '#4b4c99', text: '#ffffff', subBg: 'rgba(75, 76, 153, 0.04)' }, // Índigo institucional
    { headerBg: '#389186', text: '#ffffff', subBg: 'rgba(56, 145, 134, 0.04)' }, // Turquesa educativo
    { headerBg: '#d99b1e', text: '#ffffff', subBg: 'rgba(217, 155, 30, 0.04)' },  // Ámbar sobrio
    { headerBg: '#4a5568', text: '#ffffff', subBg: 'rgba(74, 85, 104, 0.04)' },  // Pizarra elegante
    { headerBg: '#2b6cb0', text: '#ffffff', subBg: 'rgba(43, 108, 176, 0.04)' },  // Azul corporativo
    { headerBg: '#7b341e', text: '#ffffff', subBg: 'rgba(123, 52, 30, 0.04)' },   // Terracota
    { headerBg: '#553c9a', text: '#ffffff', subBg: 'rgba(85, 60, 154, 0.04)' }    // Morado oscuro
  ]

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99]/20 selection:text-[#4b4c99] font-sans">

      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
          >
            Año Lectivo Vigente: {anioLectivoVigente || 'Sin año activo'}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            Sábana Consolidada Trimestral ({trimestreSeleccionado})
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Curso: {gradoSeleccionado} "{paraleloSeleccionado}" {esBasicaElemental && '• [Básica Elemental - Cualitativa]'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* SELECTOR DE PERIODO */}
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">📅 Periodo:</span>
            {periodosDisponibles.length === 0 ? (
              <span className="text-xs font-bold text-amber-700 italic">Sin años creados</span>
            ) : (
              <select
                value={anioLectivoVigente}
                onChange={(e) => handleCambiarPeriodo(e.target.value)}
                style={{ color: '#4b4c99' }}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer"
              >
                {periodosDisponibles.map(p => (
                  <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => router.push('/docente/calificaciones')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer"
          >
            ← Volver a Calificaciones
          </button>
        </div>
      </div>

      {/* AVISO SI NO HAY AÑO ACTIVO */}
      {!anioLectivoVigente && !cargando && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
      {esAnioCerrado && anioLectivoVigente && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. La sábana trimestral está en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Periodo Cerrado</span>
        </div>
      )}

      {/* SELECTORES DE FILTRO */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso</label>
          <select
            value={gradoSeleccionado}
            onChange={(e) => {
              const nuevoGrado = e.target.value
              setGradoSeleccionado(nuevoGrado)
              const par = asignaciones.find(a => a.grado_curso === nuevoGrado)?.paralelo || 'A'
              setParaleloSeleccionado(par)
            }}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
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
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
          <select
            value={paraleloSeleccionado}
            onChange={(e) => setParaleloSeleccionado(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {paralelosPermitidos.map(p => (
              <option key={p} value={p}>Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: getTrimestreColorStyle(trimestreSeleccionado).backgroundColor }}>Trimestre Activo</label>
          <select
            value={trimestreSeleccionado}
            onChange={(e) => setTrimestreSeleccionado(e.target.value)}
            style={{ 
              backgroundColor: `${getTrimestreColorStyle(trimestreSeleccionado).backgroundColor}15`, 
              color: getTrimestreColorStyle(trimestreSeleccionado).backgroundColor, 
              borderColor: `${getTrimestreColorStyle(trimestreSeleccionado).backgroundColor}50` 
            }}
            className="w-full p-2.5 border-2 rounded-xl text-xs font-bold outline-none shadow-2xs cursor-pointer"
          >
            <option value="Trimestre 1" style={{ color: '#000' }}>Trimestre 1</option>
            <option value="Trimestre 2" style={{ color: '#000' }}>Trimestre 2</option>
            <option value="Trimestre 3" style={{ color: '#000' }}>Trimestre 3</option>
          </select>
        </div>
      </div>

      {/* TABLA SÁBANA GENERAL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
        <div 
          style={getTrimestreColorStyle(trimestreSeleccionado)}
          className="p-4 px-6 flex justify-between items-center"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider">
            MATRIZ GENERAL DE RENDIMIENTO • {gradoSeleccionado || 'Curso'} "{paraleloSeleccionado}" ({trimestreSeleccionado} - {anioLectivoVigente || 'Sin periodo'})
          </h2>
          <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-xl">
            {estudiantes.length} Estudiantes • {materiasUnicas.length} Asignaturas
          </span>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 border border-slate-200 text-center w-12" rowSpan={2}>Nro</th>
                <th className="p-3 border border-slate-200 w-32" rowSpan={2}>Cédula</th>
                <th className="p-3 border border-slate-200 min-w-[220px]" rowSpan={2}>Apellidos y Nombres</th>
                
                {/* Cabeceras dinámicas por Materia con colores distintivos */}
                {materiasUnicas.map((materia, idx) => {
                  const colorMat = paletaMaterias[idx % paletaMaterias.length]
                  return (
                    <th 
                      key={materia} 
                      style={{ backgroundColor: colorMat.headerBg, color: colorMat.text }}
                      className="p-2.5 border border-slate-200 text-center font-bold tracking-tight shadow-2xs" 
                      colSpan={esBasicaElemental ? 2 : 5}
                    >
                      {materia}
                    </th>
                  )
                })}
              </tr>

              <tr className="bg-slate-100 text-[9px] text-center font-semibold text-slate-700">
                {materiasUnicas.map((materia, idx) => {
                  const colorMat = paletaMaterias[idx % paletaMaterias.length]
                  return esBasicaElemental ? (
                    <Fragment key={`${materia}-elemental`}>
                      <th className="border border-slate-200 p-1.5" style={{ backgroundColor: colorMat.subBg }}>PROMEDIO</th>
                      <th className="border border-slate-200 p-1.5 font-bold" style={{ backgroundColor: colorMat.subBg, color: colorMat.headerBg }}>CALF. CUALI.</th>
                    </Fragment>
                  ) : (
                    <Fragment key={`${materia}-normal`}>
                      <th className="border border-slate-200 p-1.5" style={{ backgroundColor: colorMat.subBg }} title="Evaluación Formativa">EVA. FORM.</th>
                      <th className="border border-slate-200 p-1.5 font-bold" style={{ backgroundColor: colorMat.subBg }}>70%</th>
                      <th className="border border-slate-200 p-1.5" style={{ backgroundColor: colorMat.subBg }} title="Evaluación Sumativa">EVA. SUM.</th>
                      <th className="border border-slate-200 p-1.5 font-bold" style={{ backgroundColor: colorMat.subBg }}>30%</th>
                      <th className="border border-slate-200 p-1.5 font-black shadow-inner" style={{ backgroundColor: colorMat.headerBg, color: colorMat.text }}>PROM.</th>
                    </Fragment>
                  )
                })}
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
                    <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-2 border border-slate-200 text-slate-600 font-mono">{est.cedula || 'S/N'}</td>
                      <td className="p-2 border border-slate-200 font-bold text-slate-800 uppercase whitespace-nowrap">
                        {est.apellidos} {est.nombres}
                      </td>

                      {materiasUnicas.map((materia, idxMat) => {
                        const valMateria = notasEstudiante[materia] || { formativo: 0, formativo70: 0, sumativo: 0, sumativo30: 0, promedio: 0 }
                        const escalaCuali = obtenerEscalaElemental(valMateria.promedio)
                        const colorMat = paletaMaterias[idxMat % paletaMaterias.length]

                        return (
                          esBasicaElemental ? (
                            <Fragment key={`${est.id}-${materia}-elem-val`}>
                              <td className="p-2 border border-slate-200 text-center font-semibold text-slate-800" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.promedio > 0 ? valMateria.promedio.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-bold shadow-2xs" style={{ backgroundColor: colorMat.subBg, color: colorMat.headerBg }}>
                                {escalaCuali || '0.00'}
                              </td>
                            </Fragment>
                          ) : (
                            <Fragment key={`${est.id}-${materia}-norm-val`}>
                              <td className="p-2 border border-slate-200 text-center font-medium text-slate-700" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.formativo > 0 ? valMateria.formativo.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-semibold text-slate-800" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.formativo70 > 0 ? valMateria.formativo70.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-medium text-slate-700" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.sumativo > 0 ? valMateria.sumativo.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-semibold text-slate-800" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.sumativo30 > 0 ? valMateria.sumativo30.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-bold shadow-2xs" style={{ backgroundColor: `${colorMat.headerBg}15`, color: colorMat.headerBg }}>
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
  )
}