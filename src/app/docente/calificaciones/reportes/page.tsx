'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HistoricoAcademicoPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('UNIDAD EDUCATIVA')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('03H00278')
  const [nombreAutoridad, setNombreAutoridad] = useState('')
  const [cargoAutoridad, setCargoAutoridad] = useState('RECTOR(A)')

  // Control Dinámico de Años Lectivos Propios de la Institución
  const [aniosDisponibles, setAniosDisponibles] = useState<string[]>([])
  const [anioSeleccionado, setAnioSeleccionado] = useState('')
  const [anioActivoInstitucion, setAnioActivoInstitucion] = useState('')

  // Tipo de Reporte Directivo ('consolidado' vs 'reporte_final')
  const [tipoReporteDirectivo, setTipoReporteDirectivo] = useState<'consolidado' | 'reporte_final'>('reporte_final')

  // Filtros de búsqueda directiva
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('MATUTINA')
  const [gradoSeleccionado, setGradoSeleccionado] = useState('8vo EGB')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('A')
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState('')
  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState('')

  // Periodo para libreta individual
  const [tipoTrimestreReporte, setTipoTrimestreReporte] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Anual'>('Trimestre 1')

  // Listas de datos
  const [materiasInstitucion, setMateriasInstitucion] = useState<any[]>([])
  const [asignaturasDelCurso, setAsignaturasDelCurso] = useState<string[]>([])
  const [registrosHistoricos, setRegistrosHistoricos] = useState<any[]>([])
  const [estudiantesCurso, setEstudiantesCurso] = useState<any[]>([])
  
  // Notas y complementarios del estudiante seleccionado
  const [calificacionesEstudianteActual, setCalificacionesEstudianteActual] = useState<any[]>([])
  const [complementariosEstudiante, setComplementariosEstudiante] = useState<any>({})
  
  const [modalImpresionHistorico, setModalImpresionHistorico] = useState(false)

  const gradosEGB = [
    '2do Grado EGB', '3ro Grado EGB', '4to Grado EGB',
    '5to Grado EGB', '6to Grado EGB', '7mo Grado EGB',
    '8vo EGB', '9no EGB', '10mo EGB',
    '1er Año BGU', '2do Año BGU', '3er Año BGU',
    '1ro BGU', '2do BGU', '3ro BGU'
  ]
  const paralelos = ['A', 'B', 'C', 'D', 'E']
  const jornadas = ['MATUTINA', 'VESPERTINA', 'NOCTURNA']

  useEffect(() => {
    verificarSeguridadYCargarDatos()
  }, [])

  const verificarSeguridadYCargarDatos = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (!doc) {
        router.push('/')
        return
      }

      const rolUser = (doc.rol || '').toLowerCase()
      const esAutoridad = rolUser.includes('rector') || rolUser.includes('vicerrector') || rolUser.includes('director') || rolUser.includes('autoridad') || rolUser.includes('superadmin')

      if (!esAutoridad) {
        router.push('/docente')
        return
      }

      setAutorizado(true)
      if (doc?.institucion_id) {
        const instId = doc.institucion_id
        setInstitucionId(instId)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setInstitucionLogo(doc.instituciones?.logo_url || '')
        setCodigoAmie(doc.instituciones?.codigo_amie || '03H00278')
        setNombreAutoridad(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim().toUpperCase())
        setCargoAutoridad((doc.rol || 'RECTOR(A)').toUpperCase())

        const periodosInst = doc.instituciones?.periodos_disponibles || []
        setAniosDisponibles(periodosInst)

        let anioInicial = ''
        if (doc.instituciones?.anio_lectivo_activo && periodosInst.includes(doc.instituciones.anio_lectivo_activo)) {
          anioInicial = doc.instituciones.anio_lectivo_activo
        } else if (periodosInst.length > 0) {
          anioInicial = periodosInst[0]
        }

        setAnioActivoInstitucion(doc.instituciones?.anio_lectivo_activo || anioInicial)
        setAnioSeleccionado(anioInicial)

        const { data: mats } = await supabase.from('asignaturas').select('*')
        if (mats) setMateriasInstitucion(mats)
      }
    } catch (err) {
      console.error(err)
      router.push('/')
    } finally {
      setCargando(false)
    }
  }

  // Cargar materias reales configuradas en la institución
  useEffect(() => {
    async function cargarMateriasCurso() {
      if (!institucionId || !gradoSeleccionado || !anioSeleccionado) return

      const { data: asigsDoc } = await supabase
        .from('docente_asignaciones')
        .select('asignatura')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('anio_lectivo', anioSeleccionado)

      if (asigsDoc && asigsDoc.length > 0) {
        const unicas = Array.from(new Set(asigsDoc.map((a: any) => a.asignatura.trim().toUpperCase())))
        setAsignaturasDelCurso(unicas)
        setAsignaturaSeleccionada(unicas[0])
      } else {
        const base = [
          'LENGUA Y LITERATURA',
          'MATEMÁTICAS',
          'ESTUDIOS SOCIALES',
          'CIENCIAS NATURALES',
          'INGLÉS',
          'EDUCACIÓN FÍSICA',
          'EDUCACIÓN CULTURAL Y ARTÍSTICA'
        ]
        setAsignaturasDelCurso(base)
        setAsignaturaSeleccionada(base[0])
      }
    }
    cargarMateriasCurso()
  }, [institucionId, gradoSeleccionado, paraleloSeleccionado, anioSeleccionado])

  // Cargar estudiantes del curso seleccionado
  const cargarRegistrosYEstudiantes = useCallback(async () => {
    if (!institucionId || !anioSeleccionado || !gradoSeleccionado || !paraleloSeleccionado) return

    try {
      const { data: estData } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('anio_lectivo', anioSeleccionado)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      let estFiltradosJornada: any[] = []
      if (estData) {
        estFiltradosJornada = estData.filter(e => {
          const jEst = e.jornada ? e.jornada.trim().toUpperCase() : 'MATUTINA'
          return jEst === jornadaSeleccionada.trim().toUpperCase()
        })

        setEstudiantesCurso(estFiltradosJornada)
        if (estFiltradosJornada.length > 0) {
          if (!estudianteSeleccionadoId || !estFiltradosJornada.some(e => e.id === estudianteSeleccionadoId)) {
            setEstudianteSeleccionadoId(estFiltradosJornada[0].id)
          }
        } else {
          setEstudianteSeleccionadoId('')
        }
      }

      // Si es año cerrado o histórico, intenta leer historico_academico
      const { data: histData } = await supabase
        .from('historico_academico')
        .select('*, estudiantes(id, nombres, apellidos, cedula)')
        .eq('institucion_id', institucionId)
        .eq('anio_lectivo', anioSeleccionado)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)

      if (histData && histData.length > 0) {
        setRegistrosHistoricos(histData)
      } else {
        // Año vigente o sin tabla histórica: Lee directamente de calificaciones institucionales
        const estIds = estFiltradosJornada.map(e => e.id)
        const { data: calData } = await supabase
          .from('calificaciones')
          .select('*')
          .eq('institucion_id', institucionId)
          .eq('anio_lectivo', anioSeleccionado)
          .in('estudiante_id', estIds.length > 0 ? estIds : ['none'])

        const consolidadoSimulado = estFiltradosJornada.map(est => ({
          estudiante_id: est.id,
          estudiantes: est,
          calificaciones_detalle: calData?.filter(c => c.estudiante_id === est.id) || []
        }))
        setRegistrosHistoricos(consolidadoSimulado)
      }
    } catch (err) {
      console.error('Error cargando estudiantes y registros:', err)
    }
  }, [institucionId, anioSeleccionado, gradoSeleccionado, paraleloSeleccionado, jornadaSeleccionada, estudianteSeleccionadoId])

  useEffect(() => {
    if (institucionId && autorizado && anioSeleccionado) {
      cargarRegistrosYEstudiantes()
    }
  }, [institucionId, autorizado, anioSeleccionado, jornadaSeleccionada, gradoSeleccionado, paraleloSeleccionado, cargarRegistrosYEstudiantes])

  // Cargar notas completas del estudiante seleccionado para el reporte/libreta
  const cargarNotasEstudianteEspecifico = useCallback(async () => {
    if (!estudianteSeleccionadoId || !anioSeleccionado) return

    try {
      const { data: calData } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('estudiante_id', estudianteSeleccionadoId)
        .eq('anio_lectivo', anioSeleccionado)

      setCalificacionesEstudianteActual(calData || [])

      const { data: compData } = await supabase
        .from('acompanamiento_integral')
        .select('*')
        .eq('estudiante_id', estudianteSeleccionadoId)
        .eq('anio_lectivo', anioSeleccionado)

      const compMap: any = {}
      compData?.forEach((item: any) => {
        compMap[item.item] = {
          t1: item.t1, t2: item.t2, t3: item.t3,
          rec_t1: item.rec_t1, rec_t2: item.rec_t2, rec_t3: item.rec_t3, rec_anual: item.rec_anual
        }
      })
      setComplementariosEstudiante(compMap)
    } catch (err) {
      console.error('Error cargando notas individuales:', err)
    }
  }, [estudianteSeleccionadoId, anioSeleccionado])

  useEffect(() => {
    if (estudianteSeleccionadoId && autorizado && anioSeleccionado) {
      cargarNotasEstudianteEspecifico()
    }
  }, [estudianteSeleccionadoId, anioSeleccionado, autorizado, cargarNotasEstudianteEspecifico])

  // Subnivel educativo
  const obtenerNombreSubnivel = (gradoStr: string) => {
    if (!gradoStr) return ''
    if (['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoStr)) {
      return 'Básica Elemental'
    } else if (['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(gradoStr)) {
      return 'Básica Media'
    } else if (['8vo EGB', '9no EGB', '10mo EGB'].includes(gradoStr) || gradoStr.includes('8vo') || gradoStr.includes('9no') || gradoStr.includes('10mo')) {
      return 'Básica Superior'
    } else if (gradoStr.includes('BGU') || gradoStr.includes('BT') || gradoStr.includes('Bachillerato')) {
      return 'Bachillerato'
    }
    return ''
  }

  const subnivelActual = obtenerNombreSubnivel(gradoSeleccionado)
  const esBasicaElemental = subnivelActual === 'Básica Elemental'
  const esSuperiorOBachillerato = subnivelActual === 'Básica Superior' || subnivelActual === 'Bachillerato'

  const obtenerEscalaElemental = (nota: number) => {
    if (!nota || nota <= 0) return ''
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

  const obtenerEscalaCuantitativaCualitativa = (nota: number) => {
    if (!nota || nota <= 0) return 'NAAR'
    if (nota >= 9.00) return 'DAR'
    if (nota >= 7.00) return 'AAR'
    if (nota >= 4.01) return 'PAAR'
    return 'NAAR'
  }

  const obtenerRecomendacionTexto = () => {
    if (tipoTrimestreReporte !== 'Anual') {
      const campoKey = tipoTrimestreReporte === 'Trimestre 1' ? 'rec_t1' : tipoTrimestreReporte === 'Trimestre 2' ? 'rec_t2' : 'rec_t3'
      for (const itemKey of Object.keys(complementariosEstudiante)) {
        const val = complementariosEstudiante[itemKey]?.[campoKey]
        if (val && val.trim() !== '') return val
      }
      return 'No hay recomendaciones registradas.'
    } else {
      for (const itemKey of Object.keys(complementariosEstudiante)) {
        const val = complementariosEstudiante[itemKey]?.rec_anual
        if (val && val.trim() !== '') return val
      }
      return 'Sin recomendación final.'
    }
  }

  // Cálculos para el Consolidado
  let totalAprobados = 0
  let totalSupletorios = 0

  const filasHistoricasProcesadas = estudiantesCurso.map(est => {
    const regEst = registrosHistoricos.find(h => h.estudiante_id === est.id || h.estudiantes?.id === est.id)
    const detalles = Array.isArray(regEst?.calificaciones_detalle) ? regEst.calificaciones_detalle : []
    const regMateria = detalles.find((c: any) => c.asignatura && c.asignatura.trim().toUpperCase() === asignaturaSeleccionada.trim().toUpperCase())
    
    const promedio = regMateria?.promedio_parcial !== undefined && regMateria?.promedio_parcial !== null ? Number(regMateria.promedio_parcial) : 0
    const cualitativa = promedio >= 9 ? 'DAR' : promedio >= 7 ? 'AAR' : promedio >= 5 ? 'PA' : 'NAAR'
    const esAprobado = promedio >= 7

    if (promedio > 0) {
      if (esAprobado) totalAprobados++
      else totalSupletorios++
    }

    return {
      estudiante: est,
      promedio,
      cualitativa,
      esAprobado,
      detallesMateria: regMateria
    }
  })

  const estudianteActualObj = estudiantesCurso.find(e => e.id === estudianteSeleccionadoId)
  const totalEvaluados = totalAprobados + totalSupletorios
  const porcentajeAprobados = totalEvaluados > 0 ? Math.round((totalAprobados / totalEvaluados) * 100) : 0
  const porcentajeSupletorios = totalEvaluados > 0 ? 100 - porcentajeAprobados : 0

  const nombrePdfDinamico = tipoReporteDirectivo === 'consolidado' 
    ? `CONSOLIDADO-RECTORADO-${anioSeleccionado}-${gradoSeleccionado}-${asignaturaSeleccionada}`.replace(/\s+/g, '-').replace(/°/g, '').toUpperCase()
    : `LIBRETA-RECTORAL-${anioSeleccionado}-${gradoSeleccionado}-${estudianteActualObj?.apellidos || 'ESTUDIANTE'}`.replace(/\s+/g, '-').replace(/°/g, '').toUpperCase()

  const handlePrint = () => {
    document.title = nombrePdfDinamico
    window.print()
  }

  if (cargando || !autorizado) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo Rectoral...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* REGLAS DE IMPRESIÓN OFICIALES A4 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm;
          }
          body * {
            visibility: hidden;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible;
          }
          #printable-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 4px;
            border: none !important;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print\\:hidden {
            display: none !important;
          }
          table th, table td {
            padding-top: 3px !important;
            padding-bottom: 3px !important;
          }
        }
      `}</style>

      {/* ENCABEZADO PRINCIPAL RECTORADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
              className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
            >
              Control Rectoral General
            </span>
            {anioSeleccionado === anioActivoInstitucion ? (
              <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-0.5 rounded-lg border border-emerald-200">
                Periodo Activo Vigente ({anioSeleccionado})
              </span>
            ) : (
              <span className="bg-rose-100 text-rose-800 font-bold text-[10px] px-2.5 py-0.5 rounded-lg border border-rose-200">
                Archivo Histórico ({anioSeleccionado})
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Reportes Académicos y Archivo Histórico
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Emisión de libretas y consolidados de cualquier año lectivo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setModalImpresionHistorico(true)}
            disabled={estudiantesCurso.length === 0 || !anioSeleccionado}
            style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
            className="px-5 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>🖨️</span> Imprimir / Guardar PDF
          </button>
          <button
            onClick={() => router.push('/rector')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer"
          >
            ← Volver al Panel Rectoral
          </button>
        </div>
      </div>

      {/* SELECTOR DE TIPO DE DOCUMENTO */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4 flex-wrap print:hidden">
        <span className="text-xs font-bold uppercase text-slate-700">Formato del Documento:</span>
        <div className="flex gap-2.5 flex-wrap">
          <button
            onClick={() => setTipoReporteDirectivo('reporte_final')}
            style={tipoReporteDirectivo === 'reporte_final' ? { backgroundColor: '#4b4c99' } : {}}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
              tipoReporteDirectivo === 'reporte_final' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Libreta de Calificaciones por Estudiante (Oficial)
          </button>
          <button
            onClick={() => setTipoReporteDirectivo('consolidado')}
            style={tipoReporteDirectivo === 'consolidado' ? { backgroundColor: '#4b4c99' } : {}}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
              tipoReporteDirectivo === 'consolidado' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Consolidado General por Materia
          </button>
        </div>
      </div>

      {/* FILTROS DE BÚSQUEDA DIRECTIVA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-5 gap-3.5 text-xs print:hidden">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año Lectivo (Cualquiera):</label>
          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(e.target.value)}
            style={{ color: '#4b4c99' }}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer shadow-2xs"
          >
            {aniosDisponibles.map(anio => (
              <option key={anio} value={anio} className="text-slate-900 font-bold bg-white">
                {anio} {anio === anioActivoInstitucion ? '• (Vigente Activo)' : '• (Histórico)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada:</label>
          <select
            value={jornadaSeleccionada}
            onChange={(e) => setJornadaSeleccionada(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
          >
            {jornadas.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso:</label>
          <select
            value={gradoSeleccionado}
            onChange={(e) => setGradoSeleccionado(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
          >
            {gradosEGB.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo:</label>
          <select
            value={paraleloSeleccionado}
            onChange={(e) => setParaleloSeleccionado(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
          >
            {paralelos.map(p => <option key={p} value={p}>Paralelo {p}</option>)}
          </select>
        </div>

        {tipoReporteDirectivo === 'consolidado' ? (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura:</label>
            <select
              value={asignaturaSeleccionada}
              onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
            >
              {asignaturasDelCurso.map(mat => <option key={mat} value={mat}>{mat}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Estudiante:</label>
            <select
              value={estudianteSeleccionadoId}
              onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
              className="w-full p-3 border-2 border-indigo-300 rounded-xl text-xs font-bold text-indigo-950 bg-indigo-50/50 outline-none shadow-2xs cursor-pointer"
            >
              {estudiantesCurso.length === 0 ? (
                <option value="">Sin estudiantes en este curso</option>
              ) : (
                estudiantesCurso.map(est => (
                  <option key={est.id} value={est.id}>
                    {est.apellidos} {est.nombres}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </div>

      {tipoReporteDirectivo === 'reporte_final' && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4 print:hidden">
          <span className="text-xs font-bold uppercase text-slate-700">Periodo de la Libreta:</span>
          <select
            value={tipoTrimestreReporte}
            onChange={(e: any) => setTipoTrimestreReporte(e.target.value)}
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.05)', borderColor: 'rgba(75, 76, 153, 0.3)' }}
            className="p-2.5 border-2 rounded-xl text-xs font-bold outline-none shadow-2xs cursor-pointer"
          >
            <option value="Trimestre 1">1er Trimestre</option>
            <option value="Trimestre 2">2do Trimestre</option>
            <option value="Trimestre 3">3er Trimestre</option>
            <option value="Anual">Reporte Final (Anual)</option>
          </select>
        </div>
      )}

      {/* VISTA EN PANTALLA */}
      {tipoReporteDirectivo === 'consolidado' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold uppercase text-slate-900 flex-wrap gap-2">
            <span>
              Consolidado General • {anioSeleccionado} • {asignaturaSeleccionada} ({gradoSeleccionado} "{paraleloSeleccionado}" - {jornadaSeleccionada})
            </span>
            <span className="text-[10px] text-slate-500">{estudiantesCurso.length} Alumnos</span>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 border border-slate-200 text-center w-12">Nro</th>
                  <th className="p-3 border border-slate-200 w-32">Cédula</th>
                  <th className="p-3 border border-slate-200">Apellidos y Nombres</th>
                  <th className="p-3 border border-slate-200 text-center w-28">Promedio Anual</th>
                  <th className="p-3 border border-slate-200 text-center w-24">Escala</th>
                  <th className="p-3 border border-slate-200 text-center w-36">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filasHistoricasProcesadas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
                      No hay estudiantes registrados en este curso para el periodo {anioSeleccionado}.
                    </td>
                  </tr>
                ) : (
                  filasHistoricasProcesadas.map(({ estudiante, promedio, cualitativa, esAprobado }, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 border border-slate-200 text-slate-600 font-mono">{estudiante?.cedula || 'S/N'}</td>
                      <td className="p-3 border border-slate-200 font-bold text-slate-800 uppercase">
                        {estudiante?.apellidos} {estudiante?.nombres}
                      </td>
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-900 bg-slate-50">
                        {promedio > 0 ? promedio.toFixed(2) : '0.00'}
                      </td>
                      <td className="p-3 border border-slate-200 text-center font-semibold text-slate-700">
                        {promedio > 0 ? cualitativa : '-'}
                      </td>
                      <td className={`p-3 border border-slate-200 text-center font-bold text-[10px] uppercase ${
                        promedio === 0 ? 'bg-slate-50 text-slate-400' :
                        esAprobado ? 'bg-indigo-50 text-indigo-800' : 'bg-amber-50 text-amber-800'
                      }`}>
                        {promedio === 0 ? 'Sin calificación' : esAprobado ? 'Aprobado' : 'Supletorio'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold uppercase text-slate-900 flex-wrap gap-2">
            <span>
              Vista Previa Libreta • {anioSeleccionado} ({tipoTrimestreReporte}) • {estudianteActualObj ? `${estudianteActualObj.apellidos} ${estudianteActualObj.nombres}` : 'Estudiante'}
            </span>
            <button
              onClick={() => setModalImpresionHistorico(true)}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-4 py-1.5 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
            >
              Abrir Documento Imprimible
            </button>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 border border-slate-200 text-center w-12">Nro</th>
                  <th className="p-3 border border-slate-200">Asignatura</th>
                  <th className="p-3 border border-slate-200 text-center w-28">Promedio</th>
                  <th className="p-3 border border-slate-200 text-center w-24">Escala</th>
                  <th className="p-3 border border-slate-200 text-center w-36">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {asignaturasDelCurso.map((asig, idx) => {
                  const reg = calificacionesEstudianteActual.find(c => {
                    const dbAsig = (c.asignatura || '').trim().toUpperCase()
                    const target = asig.trim().toUpperCase()
                    const matchNombre = dbAsig === target || dbAsig.includes(target) || target.includes(dbAsig)
                    const matchPeriodo = tipoTrimestreReporte === 'Anual' ? true : (c.trimestre || '').trim().toLowerCase() === tipoTrimestreReporte.trim().toLowerCase()
                    return matchNombre && matchPeriodo
                  })

                  const prom = reg?.promedio_parcial !== undefined && reg?.promedio_parcial !== null ? Number(reg.promedio_parcial) : 0
                  const cual = obtenerEscalaCuantitativaCualitativa(prom)
                  const aprobado = prom >= 7

                  return (
                    <tr key={asig} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 border border-slate-200 font-bold text-slate-800 uppercase">{asig}</td>
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-900 bg-slate-50">{prom > 0 ? prom.toFixed(2) : '0.00'}</td>
                      <td className="p-3 border border-slate-200 text-center font-semibold text-slate-700">{prom > 0 ? cual : '-'}</td>
                      <td className={`p-3 border border-slate-200 text-center font-bold text-[10px] uppercase ${prom === 0 ? 'text-slate-400' : aprobado ? 'text-indigo-800 bg-indigo-50' : 'text-amber-800 bg-amber-50'}`}>
                        {prom === 0 ? 'Sin notas' : aprobado ? 'Aprobado' : 'Supletorio'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL / VENTANA DE IMPRESIÓN OFICIAL ================= */}
      {modalImpresionHistorico && anioSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-8 space-y-6 shadow-xl border border-slate-200 relative print:shadow-none print:p-2 print:max-w-none font-sans">
            
            {/* BARRA SUPERIOR DE ACCIÓN */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 print:hidden">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  {tipoReporteDirectivo === 'consolidado' ? 'Consolidado General Rectoral' : 'Libreta de Calificaciones Oficial'} • Periodo {anioSeleccionado}
                </h2>
                <p className="text-xs text-slate-500 font-medium">Documento oficial adaptado para impresión directa en A4 ({nombrePdfDinamico}).</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePrint}
                  style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
                  className="px-5 py-2.5 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Imprimir / Guardar PDF
                </button>
                <button
                  onClick={() => setModalImpresionHistorico(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* CONTENIDO DEL REPORTE IMPRIMIBLE */}
            <div id="printable-report-area" className="space-y-4 print:space-y-2 text-slate-900">
              
              {/* ENCABEZADO MEMBRETADO */}
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
                <div className="flex items-center gap-4 text-left">
                  {institucionLogo ? (
                    <img src={institucionLogo} alt="Logo" className="w-20 h-20 object-contain" />
                  ) : null}
                  <div>
                    <h2 className="text-sm font-black uppercase text-slate-900">{nombreInstitucion}</h2>
                    <p className="text-[11px] font-bold text-slate-700">CÓDIGO AMIE: {codigoAmie} • Azogues - Ecuador</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="whitespace-nowrap text-[10px] font-black uppercase bg-slate-100 px-2.5 py-1 border border-slate-800 rounded text-slate-900 shadow-2xs">
                    {tipoReporteDirectivo === 'consolidado' 
                      ? `CONSOLIDADO ACADÉMICO - (${anioSeleccionado})`
                      : `RENDIMIENTO ACADÉMICO - ${tipoTrimestreReporte.toUpperCase()} (${anioSeleccionado}) ${subnivelActual ? `(${subnivelActual.toUpperCase()})` : ''}`
                    }
                  </span>
                </div>
              </div>

              {/* DATOS INFORMATIVOS */}
              {tipoReporteDirectivo === 'consolidado' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-1 text-xs border border-slate-800 p-3 bg-slate-50/60 rounded-xl font-bold text-slate-900">
                  <div><strong>ASIGNATURA:</strong> {asignaturaSeleccionada}</div>
                  <div><strong>PARALELO:</strong> {paraleloSeleccionado}</div>
                  <div><strong>GRADO/CURSO:</strong> {gradoSeleccionado}</div>
                  <div><strong>JORNADA:</strong> {jornadaSeleccionada}</div>
                  <div className="col-span-2"><strong>AUTORIDAD:</strong> {nombreAutoridad} ({cargoAutoridad})</div>
                  <div className="col-span-2"><strong>AÑO LECTIVO:</strong> {anioSeleccionado}</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs border border-slate-800 p-3 bg-slate-50/60 rounded-xl font-bold text-slate-900">
                  <div><strong>REFERENCIA:</strong> RECTORAL</div>
                  <div><strong>PARALELO:</strong> {paraleloSeleccionado}</div>
                  <div><strong>GRADO/CURSO:</strong> {gradoSeleccionado}</div>
                  <div><strong>JORNADA:</strong> {jornadaSeleccionada}</div>
                  <div><strong>AUTORIDAD:</strong> {nombreAutoridad}</div>
                  <div><strong>CÉDULA:</strong> {estudianteActualObj?.cedula || 'S/N'}</div>
                  <div className="col-span-2 uppercase font-black text-slate-950 pt-1 border-t border-slate-300 mt-1">
                    <strong>ESTUDIANTE:</strong> {estudianteActualObj?.apellidos} {estudianteActualObj?.nombres}
                  </div>
                </div>
              )}

              {/* TABLAS SEGÚN FORMATO */}
              {tipoReporteDirectivo === 'consolidado' ? (
                <table className="w-full text-xs border-collapse border border-slate-800 text-slate-900 font-semibold">
                  <thead>
                    <tr className="bg-slate-200 text-slate-950 font-black uppercase text-[10px] text-center">
                      <th className="p-2 border border-slate-800 w-12">Nro</th>
                      <th className="p-2 border border-slate-800 w-28">Cédula</th>
                      <th className="p-2 border border-slate-800 text-left">Apellidos y Nombres</th>
                      <th className="p-2 border border-slate-800 w-24">PROM. ANUAL</th>
                      <th className="p-2 border border-slate-800 w-20">ESCALA</th>
                      <th className="p-2 border border-slate-800 w-32">OBSERVACIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filasHistoricasProcesadas.map(({ estudiante, promedio, cualitativa, esAprobado }, idx) => (
                      <tr key={idx} className="text-center font-bold">
                        <td className="p-2 border border-slate-800 text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-800 font-mono text-[11px]">{estudiante?.cedula || 'S/N'}</td>
                        <td className="p-2 border border-slate-800 text-left font-bold uppercase">{estudiante?.apellidos} {estudiante?.nombres}</td>
                        <td className="p-2 border border-slate-800 font-bold">{promedio > 0 ? promedio.toFixed(2) : '0.00'}</td>
                        <td className="p-2 border border-slate-800">{promedio > 0 ? cualitativa : '-'}</td>
                        <td className={`p-2 border border-slate-800 font-bold text-[10px] uppercase ${esAprobado ? 'text-indigo-900 bg-indigo-50' : 'text-amber-800 bg-amber-50'}`}>
                          {promedio === 0 ? 'Sin notas' : esAprobado ? 'Aprobado' : 'Supletorio'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : tipoTrimestreReporte !== 'Anual' ? (
                /* LIBRETA OFICIAL TRIMESTRAL */
                <table className="w-full text-xs border-collapse border border-slate-800 text-slate-900 font-semibold">
                  <thead>
                    <tr className="bg-slate-200 text-slate-950 font-black uppercase text-[10px] text-center">
                      <th className="p-2 border border-slate-800 w-1/3">ASIGNATURAS</th>
                      {esBasicaElemental ? (
                        <>
                          <th className="p-2 border border-slate-800">CALIFICACIÓN</th>
                          <th className="p-2 border border-slate-800">ESCALA</th>
                          <th className="p-2 border border-slate-800">EQUIVALENCIA</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2 border border-slate-800">EVALUACIÓN FORMATIVA</th>
                          <th className="p-2 border border-slate-800">70%</th>
                          <th className="p-2 border border-slate-800">EVALUACIÓN SUMATIVA</th>
                          <th className="p-2 border border-slate-800">30%</th>
                          <th className="p-2 border border-slate-800">PROM. TRIMESTRE</th>
                          <th className="p-2 border border-slate-800">CALIFICACIÓN CUALITATIVA</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {asignaturasDelCurso.map((asig) => {
                      const reg = calificacionesEstudianteActual.find(c => {
                        const dbAsig = (c.asignatura || '').trim().toUpperCase()
                        const targetAsig = asig.trim().toUpperCase()
                        const coincideMateria = dbAsig === targetAsig || dbAsig.includes(targetAsig) || targetAsig.includes(dbAsig)
                        const coincideTrimestre = (c.trimestre || '').trim().toLowerCase() === tipoTrimestreReporte.trim().toLowerCase()
                        return coincideMateria && coincideTrimestre
                      })

                      const prom = reg?.promedio_parcial !== undefined && reg?.promedio_parcial !== null ? Number(reg.promedio_parcial) : 0
                      const formativo = reg?.insumo_1 !== undefined && reg?.insumo_1 !== null ? (Number(reg.insumo_1) + Number(reg.insumo_2 || 0)) / 2 : prom
                      const formativo70 = Number((formativo * 0.70).toFixed(2))
                      const sumativo = Number(reg?.proyecto_interdisciplinar || reg?.evaluacion_estructurada || prom)
                      const sumativo30 = Number((sumativo * 0.30).toFixed(2))

                      return (
                        <tr key={asig} className="text-center font-bold text-slate-900">
                          <td className="p-2 border border-slate-800 text-left font-black">{asig}</td>
                          {esBasicaElemental ? (
                            <>
                              <td className="p-2 border border-slate-800">{prom > 0 ? prom.toFixed(2) : '0.00'}</td>
                              <td className="p-2 border border-slate-800 font-black">{obtenerEscalaElemental(prom)}</td>
                              <td className="p-2 border border-slate-800 text-left text-[10px] font-bold">
                                {prom >= 7 ? 'Destreza o aprendizaje alcanzado' : prom >= 4.01 ? 'Destreza o aprendizaje en proceso de desarrollo' : 'Destreza o aprendizaje iniciado'}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 border border-slate-800">{formativo > 0 ? formativo.toFixed(2) : '0.00'}</td>
                              <td className="p-2 border border-slate-800">{formativo70 > 0 ? formativo70.toFixed(2) : '0.00'}</td>
                              <td className="p-2 border border-slate-800">{sumativo > 0 ? sumativo.toFixed(2) : '0.00'}</td>
                              <td className="p-2 border border-slate-800">{sumativo30 > 0 ? sumativo30.toFixed(2) : '0.00'}</td>
                              <td className="p-2 border border-slate-800 font-black">{prom > 0 ? prom.toFixed(2) : '0.00'}</td>
                              <td className="p-2 border border-slate-800 font-black text-[#4b4c99]">{obtenerEscalaCuantitativaCualitativa(prom)}</td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                /* LIBRETA OFICIAL ANUAL CON SUPLETORIOS */
                <table className="w-full text-xs border-collapse border border-slate-800 text-slate-900 font-semibold">
                  <thead>
                    <tr className="bg-slate-200 text-slate-950 font-black uppercase text-[10px] text-center">
                      <th className="p-2 border border-slate-800 w-1/3" rowSpan={2}>ASIGNATURAS</th>
                      <th className="p-2 border border-slate-800" colSpan={esSuperiorOBachillerato ? 6 : 5}>PROMEDIO ANUAL ({anioSeleccionado})</th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-950 text-[9px] text-center font-black">
                      <th className="p-1 border border-slate-800">1er TRIM</th>
                      <th className="p-1 border border-slate-800">2do TRIM</th>
                      <th className="p-1 border border-slate-800">3er TRIM</th>
                      {esSuperiorOBachillerato && <th className="p-1 border border-slate-800 bg-amber-50 font-black">SUPLETORIO</th>}
                      <th className="p-1 border border-slate-800">PROM. ANUAL</th>
                      <th className="p-1 border border-slate-800">CALIF. CUALITATIVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {asignaturasDelCurso.map((asig) => {
                      const regT1 = calificacionesEstudianteActual.find(c => (c.asignatura || '').trim().toUpperCase().includes(asig) && (c.trimestre || '').includes('Trimestre 1'))
                      const regT2 = calificacionesEstudianteActual.find(c => (c.asignatura || '').trim().toUpperCase().includes(asig) && (c.trimestre || '').includes('Trimestre 2'))
                      const regT3 = calificacionesEstudianteActual.find(c => (c.asignatura || '').trim().toUpperCase().includes(asig) && (c.trimestre || '').includes('Trimestre 3'))
                      const regSupletorio = calificacionesEstudianteActual.find(c => (c.asignatura || '').trim().toUpperCase().includes(asig) && (c.trimestre || '').includes('SUPLETORIO'))

                      const p1 = Number(regT1?.promedio_parcial || 0)
                      const p2 = Number(regT2?.promedio_parcial || 0)
                      const p3 = Number(regT3?.promedio_parcial || 0)
                      
                      let promAnual = Number(((p1 + p2 + p3) / (p1 && p2 && p3 ? 3 : (p1 || p2 || p3 ? 1 : 1))).toFixed(2))
                      const supletorioVal = regSupletorio?.examen_supletorio ? Number(regSupletorio.examen_supletorio) : 0

                      if (esSuperiorOBachillerato && supletorioVal > 0) {
                        promAnual = Number(((promAnual + supletorioVal) / 2).toFixed(2))
                      }

                      return (
                        <tr key={asig} className="text-center font-bold text-slate-900">
                          <td className="p-2 border border-slate-800 text-left font-black">{asig}</td>
                          <td className="p-2 border border-slate-800">{p1 > 0 ? p1.toFixed(2) : '0.00'}</td>
                          <td className="p-2 border border-slate-800">{p2 > 0 ? p2.toFixed(2) : '0.00'}</td>
                          <td className="p-2 border border-slate-800">{p3 > 0 ? p3.toFixed(2) : '0.00'}</td>
                          {esSuperiorOBachillerato && (
                            <td className="p-2 border border-slate-800 bg-amber-50/50 font-black">{supletorioVal > 0 ? supletorioVal.toFixed(2) : '-'}</td>
                          )}
                          <td className="p-2 border border-slate-800 font-black">{promAnual > 0 ? promAnual.toFixed(2) : '0.00'}</td>
                          <td className="p-2 border border-slate-800 font-black text-[#4b4c99]">{obtenerEscalaCuantitativaCualitativa(promAnual)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* SECCIÓN DE ACOMPAÑAMIENTO INTEGRAL Y RECOMENDACIÓN (SOLO LIBRETA INDIVIDUAL) */}
              {tipoReporteDirectivo === 'reporte_final' && (
                <div className="grid grid-cols-2 gap-4 pt-2 font-bold text-slate-900">
                  <div className="border border-slate-800 text-xs rounded-xl overflow-hidden">
                    <div className="bg-slate-200 text-slate-950 p-2 font-black uppercase border-b border-slate-800 text-[10px]">ÁREAS DE DESARROLLO INTEGRAL</div>
                    <div className="p-3 space-y-1.5">
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span>Acompañamiento Integral:</span>
                        <span className="font-black">
                          {tipoTrimestreReporte !== 'Anual' 
                            ? (complementariosEstudiante['Acompañamiento integral']?.[tipoTrimestreReporte === 'Trimestre 1' ? 't1' : tipoTrimestreReporte === 'Trimestre 2' ? 't2' : 't3'] || '-')
                            : (
                                <span>
                                  T1: {complementariosEstudiante['Acompañamiento integral']?.t1 || '-'} | {' '}
                                  T2: {complementariosEstudiante['Acompañamiento integral']?.t2 || '-'} | {' '}
                                  T3: {complementariosEstudiante['Acompañamiento integral']?.t3 || '-'}
                                </span>
                              )
                          }
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span>Animación a la lectura:</span>
                        <span className="font-black">
                          {tipoTrimestreReporte !== 'Anual' 
                            ? (complementariosEstudiante['Animación a la lectura']?.[tipoTrimestreReporte === 'Trimestre 1' ? 't1' : tipoTrimestreReporte === 'Trimestre 2' ? 't2' : 't3'] || '-')
                            : (
                                <span>
                                  T1: {complementariosEstudiante['Animación a la lectura']?.t1 || '-'} | {' '}
                                  T2: {complementariosEstudiante['Animación a la lectura']?.t2 || '-'} | {' '}
                                  T3: {complementariosEstudiante['Animación a la lectura']?.t3 || '-'}
                                </span>
                              )
                          }
                        </span>
                      </div>
                      {esSuperiorOBachillerato && (
                        <div className="flex justify-between">
                          <span>Orientación Vocacional:</span>
                          <span className="font-black">
                            {tipoTrimestreReporte !== 'Anual' 
                              ? (complementariosEstudiante['Orientación vocacional']?.[tipoTrimestreReporte === 'Trimestre 1' ? 't1' : tipoTrimestreReporte === 'Trimestre 2' ? 't2' : 't3'] || '-')
                              : (
                                  <span>
                                    T1: {complementariosEstudiante['Orientación vocacional']?.t1 || '-'} | {' '}
                                    T2: {complementariosEstudiante['Orientación vocacional']?.t2 || '-'} | {' '}
                                    T3: {complementariosEstudiante['Orientación vocacional']?.t3 || '-'}
                                  </span>
                                )
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-800 text-xs rounded-xl overflow-hidden">
                    <div className="bg-slate-200 text-slate-950 p-2 font-black uppercase border-b border-slate-800 text-[10px]">RECOMENDACIONES</div>
                    <div className="p-3 space-y-2">
                      <div className="text-[11px] pt-1">
                        <strong>Recomendación:</strong>{' '}
                        <span className="italic font-semibold text-slate-700">
                          {obtenerRecomendacionTexto()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FIRMAS DE RESPONSABILIDAD INSTITUCIONAL */}
              <div className="grid grid-cols-2 pt-12 text-center text-xs text-slate-900 font-bold">
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black uppercase">SECRETARÍA GENERAL</div>
                  <div className="font-black text-[11px]">SECRETARIO(A)</div>
                </div>
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black uppercase">{nombreAutoridad}</div>
                  <div className="font-black text-[11px]">{cargoAutoridad}</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}