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

  useEffect(() => {
    if (estudianteSeleccionadoId && autorizado && anioSeleccionado) {
      cargarNotasEstudianteEspecifico()
    }
  }, [estudianteSeleccionadoId, tipoTrimestreReporte, anioSeleccionado, autorizado])

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

        const periodosInst = doc.instituciones?.periodos_disponibles || []
        setAniosDisponibles(periodosInst)

        let anioInicial = ''
        if (doc.instituciones?.anio_lectivo_activo && periodosInst.includes(doc.instituciones.anio_lectivo_activo)) {
          anioInicial = doc.instituciones.anio_lectivo_activo
        } else if (periodosInst.length > 0) {
          anioInicial = periodosInst[0]
        }

        setAnioSeleccionado(anioInicial)

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
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Archivo Histórico
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Consulta de Calificaciones y Promociones de Años Anteriores
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setModalImpresionHistorico(true)}
            disabled={estudiantesCurso.length === 0 || !anioSeleccionado}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>Vista Previa / Imprimir Reporte</span>
          </button>
          <button
            onClick={() => router.push('/rector')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer"
          >
            ← Volver al Panel Rectoral
          </button>
        </div>
      </div>

      {aniosDisponibles.length === 0 && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          No se han encontrado años lectivos configurados para esta institución. Por favor, créelos primero desde el Panel Principal.
        </div>
      )}

      {/* SELECTOR DE TIPO DE REPORTE DIRECTIVO */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4 flex-wrap">
        <span className="text-xs font-bold uppercase text-slate-700">Tipo de Documento:</span>
        <div className="flex gap-2.5 flex-wrap">
          <button
            onClick={() => setTipoReporteDirectivo('consolidado')}
            style={tipoReporteDirectivo === 'consolidado' ? { backgroundColor: '#4b4c99' } : {}}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
              tipoReporteDirectivo === 'consolidado' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Consolidado General por Materia
          </button>
          <button
            onClick={() => setTipoReporteDirectivo('reporte_final')}
            style={tipoReporteDirectivo === 'reporte_final' ? { backgroundColor: '#4b4c99' } : {}}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
              tipoReporteDirectivo === 'reporte_final' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Reporte Final / Libreta por Estudiante
          </button>
        </div>
      </div>

      {/* FILTROS DE BÚSQUEDA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-5 gap-3.5 text-xs">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año Lectivo:</label>
          {aniosDisponibles.length === 0 ? (
            <span className="text-xs font-bold text-amber-700 italic">Sin años creados</span>
          ) : (
            <select
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(e.target.value)}
              style={{ color: '#4b4c99' }}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer shadow-2xs"
            >
              {aniosDisponibles.map(anio => <option key={anio} value={anio} className="text-slate-900 font-bold bg-white">{anio}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada:</label>
          <select
            value={jornadaSeleccionada}
            onChange={(e) => setJornadaSeleccionada(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {jornadas.map(j => <option key={j} value={j} className="text-slate-900 font-bold bg-white">{j}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso:</label>
          <select
            value={gradoSeleccionado}
            onChange={(e) => setGradoSeleccionado(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {gradosEGB.map(g => <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo:</label>
          <select
            value={paraleloSeleccionado}
            onChange={(e) => setParaleloSeleccionado(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {paralelos.map(p => <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>)}
          </select>
        </div>

        {tipoReporteDirectivo === 'consolidado' ? (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura:</label>
            <select
              value={asignaturaSeleccionada}
              onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
            >
              {listaAsignaturasOficiales.length === 0 ? (
                <option value="" className="text-slate-900 font-bold bg-white">No hay materias registradas</option>
              ) : (
                listaAsignaturasOficiales.map(mat => <option key={mat} value={mat} className="text-slate-900 font-bold bg-white">{mat}</option>)
              )}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Nómina del Estudiante:</label>
            <select
              value={estudianteSeleccionadoId}
              onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
              className="w-full p-3 border-2 border-indigo-300 rounded-xl text-xs font-black text-indigo-950 bg-indigo-50 outline-none shadow-2xs"
            >
              {estudiantesCurso.length === 0 ? (
                <option value="" className="text-slate-900 font-bold bg-white">Sin estudiantes en este curso</option>
              ) : (
                estudiantesCurso.map(est => <option key={est.id} value={est.id} className="text-slate-900 font-bold bg-white">{est.apellidos} {est.nombres}</option>)
              )}
            </select>
          </div>
        )}
      </div>

      {tipoReporteDirectivo === 'reporte_final' && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <span className="text-xs font-bold uppercase text-slate-700">Periodo del Reporte:</span>
          <select
            value={tipoTrimestreReporte}
            onChange={(e: any) => setTipoTrimestreReporte(e.target.value)}
            className="p-2.5 border-2 border-indigo-300 rounded-xl text-xs font-black text-indigo-950 bg-indigo-50 outline-none shadow-2xs"
          >
            <option value="Trimestre 1" className="text-slate-900 font-bold bg-white">1er Trimestre</option>
            <option value="Trimestre 2" className="text-slate-900 font-bold bg-white">2do Trimestre</option>
            <option value="Trimestre 3" className="text-slate-900 font-bold bg-white">3er Trimestre</option>
            <option value="Anual" className="text-slate-900 font-bold bg-white">Reporte Final (Anual)</option>
          </select>
        </div>
      )}

      {/* TABLA DE VISUALIZACIÓN EN PANTALLA */}
      {aniosDisponibles.length > 0 && anioSeleccionado ? (
        tipoReporteDirectivo === 'consolidado' ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold uppercase text-slate-900">
              <span>Consolidado General • {anioSeleccionado} • {asignaturaSeleccionada || 'Materia'} ({gradoSeleccionado} "{paraleloSeleccionado}" - {jornadaSeleccionada})</span>
              <span className="text-[10px] text-slate-500">{estudiantesCurso.length} Alumnos Registrados</span>
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
                        No hay estudiantes registrados en este curso, paralelo y jornada para el año {anioSeleccionado}.
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
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold uppercase text-slate-900">
              <span>Reporte Final Individual • {anioSeleccionado} • {estudianteActualObj ? `${estudianteActualObj.apellidos} ${estudianteActualObj.nombres}` : 'Estudiante'}</span>
              <span className="text-[10px] text-slate-500">Vista Preliminar</span>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-xs text-left border-collapse border border-slate-200">
                <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3 border border-slate-200 text-center w-12">Nro</th>
                    <th className="p-3 border border-slate-200">Asignatura / Módulo</th>
                    <th className="p-3 border border-slate-200 text-center w-28">Promedio Anual</th>
                    <th className="p-3 border border-slate-200 text-center w-24">Escala</th>
                    <th className="p-3 border border-slate-200 text-center w-36">Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {listaAsignaturasOficiales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-500 font-medium italic">
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
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-3 border border-slate-200 font-bold text-slate-800 uppercase">{asig}</td>
                          <td className="p-3 border border-slate-200 text-center font-bold text-slate-900 bg-slate-50">{prom > 0 ? prom.toFixed(2) : '0.00'}</td>
                          <td className="p-3 border border-slate-200 text-center font-semibold text-slate-700">{prom > 0 ? cual : '-'}</td>
                          <td className={`p-3 border border-slate-200 text-center font-bold text-[10px] uppercase ${prom === 0 ? 'text-slate-400' : aprobado ? 'text-indigo-800 bg-indigo-50' : 'text-amber-800 bg-amber-50'}`}>
                            {prom === 0 ? 'Sin notas' : aprobado ? 'Aprobado' : 'Supletorio'}
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

      {/* MODAL / VENTANA FLOTANTE DE VISTA PREVIA E IMPRESIÓN OFICIAL */}
      {modalImpresionHistorico && anioSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-8 space-y-6 shadow-xl border border-slate-200 relative print:shadow-none print:p-2 print:max-w-none font-sans">
            
            {/* BOTONES SUPERIORES */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 print:hidden">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  {tipoReporteDirectivo === 'consolidado' ? 'Consolidado General' : 'Reporte Final por Estudiante'} - {anioSeleccionado}
                </h2>
                <p className="text-xs text-slate-500 font-medium">Documento listo para imprimir o guardar como PDF ({nombrePdfDinamico}).</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePrintConTitulo}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Imprimir / Guardar PDF</span>
                </button>
                <button
                  onClick={() => setModalImpresionHistorico(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* CONTENIDO IMPRIMIBLE */}
            <div className="space-y-4 print:space-y-2">
              
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
                <div className="flex items-center gap-4 text-left">
                  {institucionLogo ? (
                    <img src={institucionLogo} alt="Logo Institución" className="w-16 h-16 object-contain" />
                  ) : null}
                  <div>
                    <h2 className="text-xs font-bold uppercase text-slate-900">{nombreInstitucion}</h2>
                    <p className="text-[10px] font-bold text-slate-600">CÓDIGO AMIE • Azogues - Ecuador</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase bg-slate-100 px-3 py-1 border border-slate-300 rounded-xl text-slate-900 block">
                    {tipoReporteDirectivo === 'consolidado' ? `Consolidado Anual • ${anioSeleccionado}` : `Rendimiento Académico - ${tipoTrimestreReporte.toUpperCase()} (${anioSeleccionado})`}
                  </span>
                </div>
              </div>

              {tipoReporteDirectivo === 'consolidado' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-1 text-xs border border-slate-300 p-3.5 bg-slate-50 rounded-2xl font-bold text-slate-900">
                  <div><strong>ASIGNATURA:</strong> {asignaturaSeleccionada}</div>
                  <div><strong>PARALELO:</strong> {paraleloSeleccionado}</div>
                  <div><strong>GRADO/CURSO:</strong> {gradoSeleccionado}</div>
                  <div><strong>JORNADA:</strong> {jornadaSeleccionada}</div>
                  <div className="col-span-2"><strong>AUTORIDAD:</strong> {nombreAutoridad || 'RECTORADO / DIRECCIÓN'}</div>
                  <div className="col-span-2"><strong>AÑO LECTIVO:</strong> {anioSeleccionado}</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs border border-slate-300 p-3.5 bg-slate-50 rounded-2xl font-bold text-slate-900">
                  <div><strong>REFERENCIA:</strong> OFICIAL</div>
                  <div><strong>PARALELO:</strong> {paraleloSeleccionado}</div>
                  <div><strong>GRADO/CURSO:</strong> {gradoSeleccionado}</div>
                  <div><strong>JORNADA:</strong> {jornadaSeleccionada}</div>
                  <div><strong>AÑO LECTIVO:</strong> {anioSeleccionado}</div>
                  <div><strong>CÉDULA:</strong> {estudianteActualObj?.cedula || 'S/N'}</div>
                  <div className="col-span-2 uppercase font-bold text-slate-950 pt-1 border-t border-slate-200 mt-1">
                    <strong>ESTUDIANTE:</strong> {estudianteActualObj?.apellidos} {estudianteActualObj?.nombres}
                  </div>
                </div>
              )}

              {tipoReporteDirectivo === 'consolidado' ? (
                <table className="w-full text-xs border-collapse border border-slate-300 text-slate-900 font-medium">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[10px] text-center">
                      <th className="p-2 border border-slate-300 w-12">Nro</th>
                      <th className="p-2 border border-slate-300 w-28">Cédula</th>
                      <th className="p-2 border border-slate-300 text-left">Apellidos y Nombres</th>
                      <th className="p-2 border border-slate-300 w-24">PROM. ANUAL</th>
                      <th className="p-2 border border-slate-300 w-20">ESCALA</th>
                      <th className="p-2 border border-slate-300 w-32">OBSERVACIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filasHistoricasProcesadas.map(({ estudiante, promedio, cualitativa, esAprobado }, idx) => (
                      <tr key={idx} className="text-center font-bold">
                        <td className="p-2 border border-slate-300 text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 font-mono text-[11px]">{estudiante?.cedula || 'S/N'}</td>
                        <td className="p-2 border border-slate-300 text-left font-bold uppercase">{estudiante?.apellidos} {estudiante?.nombres}</td>
                        <td className="p-2 border border-slate-300 font-bold">{promedio > 0 ? promedio.toFixed(2) : '0.00'}</td>
                        <td className="p-2 border border-slate-300">{promedio > 0 ? cualitativa : '-'}</td>
                        <td className={`p-2 border border-slate-300 font-bold text-[10px] uppercase ${esAprobado ? 'text-indigo-900 bg-indigo-50' : 'text-amber-800 bg-amber-50'}`}>
                          {promedio === 0 ? 'Sin notas' : esAprobado ? 'Aprobado' : 'Supletorio'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs border-collapse border border-slate-300 text-slate-900 font-medium">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[10px] text-center">
                      <th className="p-2 border border-slate-300 w-1/3">ASIGNATURAS</th>
                      <th className="p-2 border border-slate-300">PROM. PERIODO</th>
                      <th className="p-2 border border-slate-300">CALIFICACIÓN CUALITATIVA</th>
                      <th className="p-2 border border-slate-300">OBSERVACIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {listaAsignaturasOficiales.map((asig) => {
                      const regMat = calificacionesEstudianteActual.find((c: any) => c.asignatura && c.asignatura.trim().toUpperCase() === asig.trim().toUpperCase())
                      const promMat = regMat?.promedio_parcial !== undefined && regMat?.promedio_parcial !== null ? Number(regMat.promedio_parcial) : 0
                      const cualiMat = promMat >= 9 ? 'DAR' : promMat >= 7 ? 'AAR' : promMat >= 5 ? 'PA' : 'NAAR'
                      const aprobado = promMat >= 7

                      return (
                        <tr key={asig} className="text-center font-bold text-slate-900">
                          <td className="p-2 border border-slate-300 text-left font-bold">{asig}</td>
                          <td className="p-2 border border-slate-300 font-bold">{promMat > 0 ? promMat.toFixed(2) : '0.00'}</td>
                          <td className="p-2 border border-slate-300 font-bold text-[#4b4c99]">{cualiMat}</td>
                          <td className={`p-2 border border-slate-300 font-bold text-[10px] ${promMat === 0 ? 'text-slate-400' : aprobado ? 'text-indigo-900 bg-indigo-50' : 'text-amber-800 bg-amber-50'}`}>
                            {promMat === 0 ? 'Sin notas' : aprobado ? 'Aprobado' : 'Supletorio'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {tipoReporteDirectivo === 'consolidado' && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase text-slate-900 tracking-wide">Resumen Estadístico Anual</h3>
                    <span className="text-[11px] font-bold text-slate-600">Total Evaluados: {totalEvaluados} estudiantes</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-2xl flex justify-between items-center shadow-2xs">
                      <div>
                        <span className="block font-bold text-indigo-900 uppercase">Aprobados Directos</span>
                        <span className="text-base font-bold text-indigo-950">{totalAprobados} alumnos</span>
                      </div>
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-xl">{porcentajeAprobados}%</span>
                    </div>

                    <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-2xl flex justify-between items-center shadow-2xs">
                      <div>
                        <span className="block font-bold text-amber-900 uppercase">Supletorios</span>
                        <span className="text-base font-bold text-amber-950">{totalSupletorios} alumnos</span>
                      </div>
                      <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-xl">{porcentajeSupletorios}%</span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex h-3.5 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <div style={{ width: `${porcentajeAprobados}%` }} className="bg-[#4b4c99] h-full flex items-center justify-center text-[8px] font-bold text-white">
                        {porcentajeAprobados > 0 && `${porcentajeAprobados}%`}
                      </div>
                      <div style={{ width: `${porcentajeSupletorios}%` }} className="bg-amber-500 h-full flex items-center justify-center text-[8px] font-bold text-white">
                        {porcentajeSupletorios > 0 && `${porcentajeSupletorios}%`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 pt-12 text-center text-xs text-slate-900 font-bold">
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-bold uppercase">SECRETARÍA GENERAL</div>
                  <div className="font-bold text-[11px]">SECRETARIO(A)</div>
                </div>
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-bold uppercase">{nombreAutoridad || 'RECTOR / VICERRECTOR'}</div>
                  <div className="font-bold text-[11px]">RECTOR(A) / VICERRECTOR(A)</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}