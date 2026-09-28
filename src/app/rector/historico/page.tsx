'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HistoricoAcademicoPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('UNIDAD EDUCATIVA')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [nombreAutoridad, setNombreAutoridad] = useState('')

  // Control Dinámico de Años Lectivos Propios de la Institución
  const [aniosDisponibles, setAniosDisponibles] = useState<string[]>([])
  const [anioSeleccionado, setAnioSeleccionado] = useState('')

  // Tipo de Reporte Directivo ('consolidado' vs 'reporte_final')
  const [tipoReporteDirectivo, setTipoReporteDirectivo] = useState<'consolidado' | 'reporte_final'>('consolidado')

  // Filtros de búsqueda directiva
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('MATUTINA')
  const [gradoSeleccionado, setGradoSeleccionado] = useState('2do Grado EGB')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('A')
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState('')
  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState('')

  // Subnivel y Tipo de Reporte Trimestral/Anual exacto al docente
  const [tipoTrimestreReporte, setTipoTrimestreReporte] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Anual'>('Trimestre 1')

  // Lista de Materias Dinámicas cargadas desde la tabla oficial "asignaturas"
  const [materiasInstitucion, setMateriasInstitucion] = useState<any[]>([])

  // Datos
  const [registrosHistoricos, setRegistrosHistoricos] = useState<any[]>([])
  const [estudiantesCurso, setEstudiantesCurso] = useState<any[]>([])
  const [calificacionesEstudianteActual, setCalificacionesEstudianteActual] = useState<any[]>([])
  const [modalImpresionHistorico, setModalImpresionHistorico] = useState(false)

  const gradosEGB = [
    '2do Grado EGB', '3ro Grado EGB', '4to Grado EGB',
    '5to Grado EGB', '6to Grado EGB', '7mo Grado EGB',
    '8vo EGB', '9no EGB', '10mo EGB',
    '1er Año BGU', '2do Año BGU', '3er Año BGU'
  ]
  const paralelos = ['A', 'B', 'C', 'D', 'E']
  const jornadas = ['MATUTINA', 'VESPERTINA', 'NOCTURNA']

  useEffect(() => {
    verificarSeguridadYCargarDatos()
  }, [])

  useEffect(() => {
    if (institucionId && autorizado && anioSeleccionado) {
      cargarRegistrosYEstudiantes()
    }
  }, [institucionId, autorizado, anioSeleccionado, jornadaSeleccionada, gradoSeleccionado, paraleloSeleccionado])

  // Cargar calificaciones específicas cuando cambia el estudiante seleccionado o el periodo
  useEffect(() => {
    if (estudianteSeleccionadoId && autorizado && anioSeleccionado) {
      cargarNotasEstudianteEspecifico()
    }
  }, [estudianteSeleccionadoId, tipoTrimestreReporte, anioSeleccionado, autorizado])

  // CAPA DE SEGURIDAD SILENCIOSA
  const verificarSeguridadYCargarDatos = async () => {
    try {
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
      const esAutoridad = rolUser.includes('rector') || rolUser.includes('vicerrector') || rolUser.includes('director') || rolUser.includes('autoridad')

      if (!esAutoridad) {
        router.push('/docente')
        return
      }

      setAutorizado(true)
      if (doc?.institucion_id) {
        setInstitucionId(doc.institucion_id)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setInstitucionLogo(doc.instituciones?.logo_url || '')
        setNombreAutoridad(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim().toUpperCase())

        // Carga estricta de los periodos propios creados por la institución
        const periodosInst = doc.instituciones?.periodos_disponibles || []
        setAniosDisponibles(periodosInst)

        let anioInicial = ''
        if (doc.instituciones?.anio_lectivo_activo && periodosInst.includes(doc.instituciones.anio_lectivo_activo)) {
          anioInicial = doc.instituciones.anio_lectivo_activo
        } else if (periodosInst.length > 0) {
          anioInicial = periodosInst[0]
        }

        setAnioSeleccionado(anioInicial)

        // Cargar las asignaturas directamente desde la tabla "asignaturas" oficial
        const { data: mats } = await supabase
          .from('asignaturas')
          .select('*')

        if (mats) {
          setMateriasInstitucion(mats)
        }
      }
    } catch (err) {
      router.push('/')
    } finally {
      setCargando(false)
    }
  }

  // Filtrar asignaturas estrictamente según el curso/grado seleccionado (coincidiendo con curso_nivel o de forma global)
  const asignaturasDisponiblesCurso = materiasInstitucion
    .filter(m => !m.curso_nivel || m.curso_nivel?.trim().toLowerCase() === gradoSeleccionado.trim().toLowerCase())
    .map(m => m.nombre)

  const listaAsignaturasOficiales = asignaturasDisponiblesCurso.length > 0 
    ? asignaturasDisponiblesCurso 
    : materiasInstitucion.map(m => m.nombre)

  useEffect(() => {
    if (listaAsignaturasOficiales.length > 0) {
      if (!asignaturaSeleccionada || !listaAsignaturasOficiales.includes(asignaturaSeleccionada)) {
        setAsignaturaSeleccionada(listaAsignaturasOficiales[0])
      }
    } else {
      setAsignaturaSeleccionada('')
    }
  }, [gradoSeleccionado, materiasInstitucion])

  const cargarRegistrosYEstudiantes = async () => {
    try {
      // 1. Cargar la nómina oficial de estudiantes activos
      const { data: estData, error: estError } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('anio_lectivo', anioSeleccionado)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      let estFiltradosJornada: any[] = []
      if (!estError && estData) {
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

      // 2. Cargar registros históricos de calificaciones
      const { data: histData } = await supabase
        .from('historico_academico')
        .select('*, estudiantes(id, nombres, apellidos, cedula)')
        .eq('institucion_id', institucionId)
        .eq('anio_lectivo', anioSeleccionado)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('jornada', jornadaSeleccionada)

      if (histData && histData.length > 0) {
        setRegistrosHistoricos(histData)
      } else {
        const estIds = estFiltradosJornada.map(e => e.id)
        const { data: calData } = await supabase
          .from('calificaciones')
          .select('*')
          .eq('anio_lectivo', anioSeleccionado)
          .in('estudiante_id', estIds.length > 0 ? estIds : ['none'])

        const simuladoHistorico = estFiltradosJornada.map(est => ({
          estudiante_id: est.id,
          estudiantes: est,
          calificaciones_detalle: calData?.filter(c => c.estudiante_id === est.id) || []
        }))
        setRegistrosHistoricos(simuladoHistorico)
      }
    } catch (err) {
      console.error('Error al cargar datos:', err)
    }
  }

  const cargarNotasEstudianteEspecifico = async () => {
    if (!estudianteSeleccionadoId) return

    try {
      const { data: histReg } = await supabase
        .from('historico_academico')
        .select('calificaciones_detalle')
        .eq('estudiante_id', estudianteSeleccionadoId)
        .eq('anio_lectivo', anioSeleccionado)
        .maybeSingle()

      if (histReg?.calificaciones_detalle && Array.isArray(histReg.calificaciones_detalle) && histReg.calificaciones_detalle.length > 0) {
        setCalificacionesEstudianteActual(histReg.calificaciones_detalle)
        return
      }

      let query = supabase
        .from('calificaciones')
        .select('*')
        .eq('estudiante_id', estudianteSeleccionadoId)
        .eq('anio_lectivo', anioSeleccionado)

      if (tipoTrimestreReporte !== 'Anual') {
        query = query.eq('trimestre', tipoTrimestreReporte)
      }

      const { data: calData, error } = await query

      if (!error && calData) {
        setCalificacionesEstudianteActual(calData)
      } else {
        setCalificacionesEstudianteActual([])
      }
    } catch (err) {
      console.error('Error al arrastrar notas del estudiante:', err)
      setCalificacionesEstudianteActual([])
    }
  }

  // Procesamiento para Consolidado General
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
    ? `CONSOLIDADO-${anioSeleccionado || 'S-A'}-${gradoSeleccionado}-${asignaturaSeleccionada}`.replace(/\s+/g, '-').replace(/°/g, '').toUpperCase()
    : `REPORTE-FINAL-${anioSeleccionado || 'S-A'}-${gradoSeleccionado}-${estudianteSeleccionadoId}`.replace(/\s+/g, '-').replace(/°/g, '').toUpperCase()

  const handlePrintConTitulo = () => {
    document.title = nombrePdfDinamico
    window.print()
  }

  if (cargando || !autorizado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium text-xs">Cargando módulo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ENCABEZADO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-black uppercase">
              Módulo Directivo • Archivo Histórico 📂
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Consulta de Calificaciones y Promociones de Años Anteriores
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {nombreInstitucion}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setModalImpresionHistorico(true)}
              disabled={estudiantesCurso.length === 0 || !anioSeleccionado}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>🖨️</span> Vista Previa / Imprimir Reporte
            </button>
            <button
              onClick={() => router.push('/rector')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border transition"
            >
              ← Volver al Panel Rectoral
            </button>
          </div>
        </div>

        {/* AVISO SI NO HAY PERIODOS CREADOS */}
        {aniosDisponibles.length === 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold">
            ⚠️ No se han encontrado años lectivos configurados para esta institución. Por favor, créelos primero desde el Panel Principal.
          </div>
        )}

        {/* SELECTOR DE TIPO DE REPORTE DIRECTIVO */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 flex-wrap">
          <span className="text-xs font-bold uppercase text-slate-600">Tipo de Documento:</span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTipoReporteDirectivo('consolidado')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                tipoReporteDirectivo === 'consolidado' ? 'bg-blue-700 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Consolidado General por Materia
            </button>
            <button
              onClick={() => setTipoReporteDirectivo('reporte_final')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                tipoReporteDirectivo === 'reporte_final' ? 'bg-indigo-700 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              📑 Reporte Final / Libreta por Estudiante
            </button>
          </div>
        </div>

        {/* FILTROS DE BÚSQUEDA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-1">Año Lectivo:</label>
            {aniosDisponibles.length === 0 ? (
              <span className="text-xs font-bold text-amber-600 italic">Sin años creados</span>
            ) : (
              <select
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs font-bold text-indigo-900 bg-indigo-50 outline-none cursor-pointer"
              >
                {aniosDisponibles.map(anio => <option key={anio} value={anio}>{anio}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Jornada:</label>
            <select
              value={jornadaSeleccionada}
              onChange={(e) => setJornadaSeleccionada(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {jornadas.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Grado / Curso:</label>
            <select
              value={gradoSeleccionado}
              onChange={(e) => setGradoSeleccionado(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {gradosEGB.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Paralelo:</label>
            <select
              value={paraleloSeleccionado}
              onChange={(e) => setParaleloSeleccionado(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {paralelos.map(p => <option key={p} value={p}>Paralelo {p}</option>)}
            </select>
          </div>

          {/* ASIGNATURA (CARGADA DESDE LA TABLA "asignaturas") */}
          {tipoReporteDirectivo === 'consolidado' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Asignatura:</label>
              <select
                value={asignaturaSeleccionada}
                onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
              >
                {listaAsignaturasOficiales.length === 0 ? (
                  <option value="">No hay materias registradas</option>
                ) : (
                  listaAsignaturasOficiales.map(mat => <option key={mat} value={mat}>{mat}</option>)
                )}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1">Nómina del Estudiante:</label>
              <select
                value={estudianteSeleccionadoId}
                onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
                className="w-full p-2.5 border-2 border-indigo-400 rounded-xl text-xs font-black text-indigo-950 bg-indigo-50 outline-none"
              >
                {estudiantesCurso.length === 0 ? (
                  <option value="">Sin estudiantes en este curso</option>
                ) : (
                  estudiantesCurso.map(est => <option key={est.id} value={est.id}>{est.apellidos} {est.nombres}</option>)
                )}
              </select>
            </div>
          )}
        </div>

        {/* CONTROLES EXTRA SI ES REPORTE FINAL */}
        {tipoReporteDirectivo === 'reporte_final' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <span className="text-xs font-bold uppercase text-slate-600">Periodo del Reporte:</span>
            <select
              value={tipoTrimestreReporte}
              onChange={(e: any) => setTipoTrimestreReporte(e.target.value)}
              className="p-2 border-2 border-indigo-400 rounded-xl text-xs font-black text-indigo-950 bg-indigo-50 outline-none"
            >
              <option value="Trimestre 1">1er Trimestre</option>
              <option value="Trimestre 2">2do Trimestre</option>
              <option value="Trimestre 3">3er Trimestre</option>
              <option value="Anual">Reporte Final (Anual)</option>
            </select>
          </div>
        )}

        {/* TABLA DE VISUALIZACIÓN EN PANTALLA */}
        {aniosDisponibles.length > 0 && anioSeleccionado ? (
          tipoReporteDirectivo === 'consolidado' ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <h2 className="text-xs font-black uppercase tracking-wider">
                  CONSOLIDADO GENERAL • {anioSeleccionado} • {asignaturaSeleccionada || 'Materia'} ({gradoSeleccionado} "{paraleloSeleccionado}" - {jornadaSeleccionada})
                </h2>
                <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-lg">
                  {estudiantesCurso.length} Alumnos Registrados
                </span>
              </div>

              <div className="overflow-x-auto p-4">
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3 border border-slate-300 text-center w-12">Nro</th>
                      <th className="p-3 border border-slate-300 w-32">Cédula</th>
                      <th className="p-3 border border-slate-300">Apellidos y Nombres</th>
                      <th className="p-3 border border-slate-300 text-center w-28">Promedio Anual</th>
                      <th className="p-3 border border-slate-300 text-center w-24">Escala</th>
                      <th className="p-3 border border-slate-300 text-center w-36">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filasHistoricasProcesadas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                          No hay estudiantes registrados en este curso, paralelo y jornada para el año {anioSeleccionado}.
                        </td>
                      </tr>
                    ) : (
                      filasHistoricasProcesadas.map(({ estudiante, promedio, cualitativa, esAprobado }, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 border border-slate-300 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-3 border border-slate-300 text-slate-600 font-mono">{estudiante?.cedula || 'S/N'}</td>
                          <td className="p-3 border border-slate-300 font-bold text-slate-800 uppercase">
                            {estudiante?.apellidos} {estudiante?.nombres}
                          </td>
                          <td className="p-3 border border-slate-300 text-center font-black text-slate-900 bg-slate-100">
                            {promedio > 0 ? promedio.toFixed(2) : '0.00'}
                          </td>
                          <td className="p-3 border border-slate-300 text-center font-bold text-slate-700">
                            {promedio > 0 ? cualitativa : '-'}
                          </td>
                          <td className={`p-3 border border-slate-300 text-center font-black text-[10px] ${
                            promedio === 0 ? 'bg-slate-50 text-slate-400' :
                            esAprobado ? 'bg-blue-100 text-blue-800' : 'bg-amber-500 text-white'
                          }`}>
                            {promedio === 0 ? 'SIN CALIFICACIÓN' : esAprobado ? 'APROBADO' : 'SUPLETORIO'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
              <div className="p-4 bg-indigo-900 text-white flex justify-between items-center">
                <h2 className="text-xs font-black uppercase tracking-wider">
                  REPORTE FINAL INDIVIDUAL • {anioSeleccionado} • {estudianteActualObj ? `${estudianteActualObj.apellidos} ${estudianteActualObj.nombres}` : 'Estudiante'}
                </h2>
                <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-lg">
                  Vista Preliminar
                </span>
              </div>

              <div className="overflow-x-auto p-4">
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3 border border-slate-300 text-center w-12">Nro</th>
                      <th className="p-3 border border-slate-300">Asignatura / Módulo</th>
                      <th className="p-3 border border-slate-300 text-center w-28">Promedio Anual</th>
                      <th className="p-3 border border-slate-300 text-center w-24">Escala</th>
                      <th className="p-3 border border-slate-300 text-center w-36">Observación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {listaAsignaturasOficiales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold italic">
                          No hay asignaturas configuradas en el sistema.
                        </td>
                      </tr>
                    ) : (
                      listaAsignaturasOficiales.map((asig, idx) => {
                        const regMat = calificacionesEstudianteActual.find((c: any) => c.asignatura && c.asignatura.trim().toUpperCase() === asig.trim().toUpperCase())
                        const prom = regMat?.promedio_parcial !== undefined && regMat?.promedio_parcial !== null ? Number(regMat.promedio_parcial) : 0
                        const cual = prom >= 9 ? 'DAR' : prom >= 7 ? 'AAR' : prom >= 5 ? 'PA' : 'NAAR'
                        const aprobado = prom >= 7
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 border border-slate-300 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3 border border-slate-300 font-bold text-slate-800 uppercase">{asig}</td>
                            <td className="p-3 border border-slate-300 text-center font-black text-slate-900 bg-slate-100">{prom > 0 ? prom.toFixed(2) : '0.00'}</td>
                            <td className="p-3 border border-slate-300 text-center font-bold text-slate-700">{prom > 0 ? cual : '-'}</td>
                            <td className={`p-3 border border-slate-300 text-center font-black text-[10px] ${prom === 0 ? 'text-slate-400' : aprobado ? 'text-blue-900 bg-blue-50' : 'text-amber-800 bg-amber-50'}`}>
                              {prom === 0 ? 'SIN NOTAS' : aprobado ? 'APROBADO' : 'SUPLETORIO'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : null}

      </div>

      {/* MODAL / VENTANA FLOTANTE DE VISTA PREVIA E IMPRESIÓN OFICIAL */}
      {modalImpresionHistorico && anioSeleccionado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-8 space-y-6 shadow-2xl relative print:shadow-none print:p-2 print:max-w-none">
            
            {/* BOTONES SUPERIORES (OCULTOS AL IMPRIMIR) */}
            <div className="flex justify-between items-center border-b pb-4 print:hidden">
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase">
                  {tipoReporteDirectivo === 'consolidado' ? 'Consolidado General' : 'Reporte Final por Estudiante'} - {anioSeleccionado}
                </h2>
                <p className="text-xs text-slate-500">Documento listo para imprimir o guardar como PDF ({nombrePdfDinamico}).</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintConTitulo}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5"
                >
                  <span>🖨️</span> Imprimir / Guardar PDF
                </button>
                <button
                  onClick={() => setModalImpresionHistorico(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            {/* CONTENIDO IMPRIMIBLE CON ESTILO EXACTO DE LIBRETA/REPORTE DOCENTE */}
            <div className="space-y-4 print:space-y-2">
              
              {/* ENCABEZADO INSTITUCIONAL */}
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
                <div className="flex items-center gap-4 text-left">
                  {institucionLogo ? (
                    <img src={institucionLogo} alt="Logo Institución" className="w-20 h-20 object-contain" />
                  ) : null}
                  <div>
                    <h2 className="text-sm font-black uppercase text-slate-900">{nombreInstitucion}</h2>
                    <p className="text-[11px] font-black text-slate-800">CÓDIGO AMIE: 03H00278 • Azogues - Ecuador</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black uppercase bg-slate-200 px-3 py-1 border border-slate-800 rounded text-slate-900 block">
                    {tipoReporteDirectivo === 'consolidado' ? `CONSOLIDADO ANUAL • ${anioSeleccionado}` : `RENDIMIENTO ACADÉMICO - ${tipoTrimestreReporte.toUpperCase()} (${anioSeleccionado})`}
                  </span>
                </div>
              </div>

              {/* DATOS INFORMATIVOS */}
              {tipoReporteDirectivo === 'consolidado' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-1 text-xs border border-slate-800 p-3 bg-slate-50 rounded-lg font-bold text-slate-900">
                  <div><strong>ASIGNATURA:</strong> {asignaturaSeleccionada}</div>
                  <div><strong>PARALELO:</strong> {paraleloSeleccionado}</div>
                  <div><strong>GRADO/CURSO:</strong> {gradoSeleccionado}</div>
                  <div><strong>JORNADA:</strong> {jornadaSeleccionada}</div>
                  <div className="col-span-2"><strong>AUTORIDAD:</strong> {nombreAutoridad || 'RECTORADO / DIRECCIÓN'}</div>
                  <div className="col-span-2"><strong>AÑO LECTIVO:</strong> {anioSeleccionado}</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs border border-slate-800 p-3 bg-slate-50 rounded-lg font-bold text-slate-900">
                  <div><strong>REFERENCIA:</strong> OFICIAL</div>
                  <div><strong>PARALELO:</strong> {paraleloSeleccionado}</div>
                  <div><strong>GRADO/CURSO:</strong> {gradoSeleccionado}</div>
                  <div><strong>JORNADA:</strong> {jornadaSeleccionada}</div>
                  <div><strong>AÑO LECTIVO:</strong> {anioSeleccionado}</div>
                  <div><strong>CÉDULA:</strong> {estudianteActualObj?.cedula || 'S/N'}</div>
                  <div className="col-span-2 uppercase font-black text-slate-950 pt-1 border-t border-slate-300 mt-1">
                    <strong>ESTUDIANTE:</strong> {estudianteActualObj?.apellidos} {estudianteActualObj?.nombres}
                  </div>
                </div>
              )}

              {/* TABLA PRINCIPAL DE ASIGNATURAS */}
              {tipoReporteDirectivo === 'consolidado' ? (
                <table className="w-full text-xs border-collapse border border-slate-800 text-slate-900 font-semibold">
                  <thead>
                    <tr className="bg-slate-300 text-slate-950 font-black uppercase text-[10px] text-center">
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
                        <td className="p-2 border border-slate-800 text-slate-600">{idx + 1}</td>
                        <td className="p-2 border border-slate-800 font-mono text-[11px]">{estudiante?.cedula || 'S/N'}</td>
                        <td className="p-2 border border-slate-800 text-left font-black uppercase">{estudiante?.apellidos} {estudiante?.nombres}</td>
                        <td className="p-2 border border-slate-800 font-black">{promedio > 0 ? promedio.toFixed(2) : '0.00'}</td>
                        <td className="p-2 border border-slate-800">{promedio > 0 ? cualitativa : '-'}</td>
                        <td className={`p-2 border border-slate-800 font-black text-[10px] uppercase ${esAprobado ? 'text-blue-900 bg-blue-50' : 'text-amber-800 bg-amber-50'}`}>
                          {promedio === 0 ? 'SIN NOTAS' : esAprobado ? 'APROBADO' : 'SUPLETORIO'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs border-collapse border border-slate-800 text-slate-900 font-semibold">
                  <thead>
                    <tr className="bg-slate-300 text-slate-950 font-black uppercase text-[10px] text-center">
                      <th className="p-2 border border-slate-800 w-1/3">ASIGNATURAS</th>
                      <th className="p-2 border border-slate-800">PROM. PERIODO</th>
                      <th className="p-2 border border-slate-800">CALIFICACIÓN CUALITATIVA</th>
                      <th className="p-2 border border-slate-800">OBSERVACIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {listaAsignaturasOficiales.map((asig) => {
                      const regMat = calificacionesEstudianteActual.find((c: any) => c.asignatura && c.asignatura.trim().toUpperCase() === asig.trim().toUpperCase())
                      const promMat = regMat?.promedio_parcial !== undefined && regMat?.promedio_parcial !== null ? Number(regMat.promedio_parcial) : 0
                      const cualiMat = promMat >= 9 ? 'DAR' : promMat >= 7 ? 'AAR' : promMat >= 5 ? 'PA' : 'NAAR'
                      const aprobado = promMat >= 7

                      return (
                        <tr key={asig} className="text-center font-bold text-slate-900">
                          <td className="p-2 border border-slate-800 text-left font-black">{asig}</td>
                          <td className="p-2 border border-slate-800 font-black">{promMat > 0 ? promMat.toFixed(2) : '0.00'}</td>
                          <td className="p-2 border border-slate-800 font-black text-indigo-950">{cualiMat}</td>
                          <td className={`p-2 border border-slate-800 font-black text-[10px] ${promMat === 0 ? 'text-slate-400' : aprobado ? 'text-blue-900 bg-blue-50' : 'text-amber-800 bg-amber-50'}`}>
                            {promMat === 0 ? 'SIN NOTAS' : aprobado ? 'APROBADO' : 'SUPLETORIO'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* ESTADÍSTICAS Y GRÁFICO FINAL (SOLO EN CONSOLIDADO) */}
              {tipoReporteDirectivo === 'consolidado' && (
                <div className="pt-4 border-t-2 border-slate-300 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Resumen Estadístico Anual</h3>
                    <span className="text-[11px] font-bold text-slate-600">Total Evaluados: {totalEvaluados} estudiantes</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                      <div>
                        <span className="block font-bold text-blue-900 uppercase">Aprobados Directos</span>
                        <span className="text-lg font-black text-blue-950">{totalAprobados} alumnos</span>
                      </div>
                      <span className="text-xs font-black bg-blue-200 text-blue-900 px-2 py-0.5 rounded-lg">{porcentajeAprobados}%</span>
                    </div>

                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
                      <div>
                        <span className="block font-bold text-amber-900 uppercase">Supletorios</span>
                        <span className="text-lg font-black text-amber-950">{totalSupletorios} alumnos</span>
                      </div>
                      <span className="text-xs font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-lg">{porcentajeSupletorios}%</span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex h-4 w-full rounded-full overflow-hidden border border-slate-300 bg-slate-100">
                      <div style={{ width: `${porcentajeAprobados}%` }} className="bg-blue-600 h-full flex items-center justify-center text-[8px] font-black text-white">
                        {porcentajeAprobados > 0 && `${porcentajeAprobados}%`}
                      </div>
                      <div style={{ width: `${porcentajeSupletorios}%` }} className="bg-amber-500 h-full flex items-center justify-center text-[8px] font-black text-white">
                        {porcentajeSupletorios > 0 && `${porcentajeSupletorios}%`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FIRMAS DE RESPONSABILIDAD */}
              <div className="grid grid-cols-2 pt-12 text-center text-xs text-slate-900 font-bold">
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black uppercase">SECRETARÍA GENERAL</div>
                  <div className="font-black text-[11px]">SECRETARIO(A)</div>
                </div>
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black uppercase">{nombreAutoridad || 'RECTOR / VICERRECTOR'}</div>
                  <div className="font-black text-[11px]">RECTOR(A) / VICERRECTOR(A)</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}