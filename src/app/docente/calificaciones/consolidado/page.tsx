'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ConsolidadoAnualPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('UNIDAD EDUCATIVA')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [docenteId, setDocenteId] = useState('')
  const [nombreDocente, setNombreDocente] = useState('')

  // Control Dinámico de Autoridades (Rector / Vicerrector) de la misma Institución
  const [autoridadesDisponibles, setAutoridadesDisponibles] = useState<{ nombre: string; cargo: string }[]>([])
  const [autoridadSeleccionadaIndex, setAutoridadSeleccionadaIndex] = useState(0)

  // Control Dinámico de Años Lectivos Propios de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Asignaciones permitidas por el Rector para el año vigente
  const [asignaciones, setAsignaciones] = useState<any[]>([])
  
  // Filtros
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('MATUTINA')
  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('')
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState('')

  // Datos de la tabla
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [consolidadoMap, setConsolidadoMap] = useState<{ [estudianteId: string]: { t1: number | null; t2: number | null; t3: number | null } }>({})

  // Modal de impresión elegante / Dashboard
  const [mostrarModalImpresion, setMostrarModalImpresion] = useState(false)

  useEffect(() => {
    cargarDatosDocente()
  }, [])

  useEffect(() => {
    if (jornadaSeleccionada && gradoSeleccionado && paraleloSeleccionado && asignaturaSeleccionada && institucionId && anioLectivoVigente) {
      cargarEstudiantesYNotasTrimestrales()
    }
  }, [jornadaSeleccionada, gradoSeleccionado, paraleloSeleccionado, asignaturaSeleccionada, anioLectivoVigente, institucionId])

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
      let cerradosList: string[] = []

      if (doc?.institucion_id) {
        const instId = doc.institucion_id
        setInstitucionId(instId)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setInstitucionLogo(doc.instituciones?.logo_url || '')
        setNombreDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim())

        const inst = doc.instituciones
        if (inst) {
          const periodosInst = inst.periodos_disponibles || []
          if (inst.anio_lectivo_activo && periodosInst.includes(inst.anio_lectivo_activo)) {
            anioActivo = inst.anio_lectivo_activo
          } else if (periodosInst.length > 0) {
            anioActivo = periodosInst[0]
          }

          setAnioLectivoVigente(anioActivo)

          if (inst.anos_cerrados) {
            cerradosList = inst.anos_cerrados
            setAnosCerrados(cerradosList)
          }
        }

        // Cargar autoridades (Rector o Vicerrector) pertenecientes a la misma institución con su rol real
        const { data: autoridadesData } = await supabase
          .from('docentes')
          .select('nombres, apellidos, rol')
          .eq('institucion_id', instId)
          
        if (autoridadesData) {
          const filtrados = autoridadesData.filter(d => {
            const r = (d.rol || '').toLowerCase()
            return r.includes('rector') || r.includes('vicerrector') || r.includes('director')
          })

          const listaAutoridades = filtrados.map(d => ({
            nombre: `${d.nombres || ''} ${d.apellidos || ''}`.trim().toUpperCase(),
            cargo: (d.rol || 'RECTOR(A)').toUpperCase()
          }))
          
          if (listaAutoridades.length > 0) {
            setAutoridadesDisponibles(listaAutoridades)
            setAutoridadSeleccionadaIndex(0)
          } else {
            setAutoridadesDisponibles([{ nombre: 'RAUL PINOS', cargo: 'VICERRECTOR' }])
            setAutoridadSeleccionadaIndex(0)
          }
        }

        // Cargar asignaciones estrictamente del año lectivo vigente detectado
        if (anioActivo) {
          const { data: asigs } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asigs && asigs.length > 0) {
            setAsignaciones(asigs)
            const primeraJornada = asigs[0].jornada || 'MATUTINA'
            setJornadaSeleccionada(primeraJornada)
            
            const primeraAsigJornada = asigs.find(a => (a.jornada || 'MATUTINA') === primeraJornada) || asigs[0]
            setGradoSeleccionado(primeraAsigJornada.grado_curso)
            setParaleloSeleccionado(primeraAsigJornada.paralelo)
            setAsignaturaSeleccionada(primeraAsigJornada.asignatura)
          } else {
            setAsignaciones([])
          }
        } else {
          setAsignaciones([])
        }
      }
    } catch (err) {
      console.error('Error al cargar datos del consolidado:', err)
    } finally {
      setCargando(false)
    }
  }

  const cargarEstudiantesYNotasTrimestrales = async () => {
    try {
      let query = supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('estado', 'activo')

      const { data: estDataRaw } = await query.order('apellidos', { ascending: true })

      const estData = (estDataRaw || []).filter(e => {
        const jEst = e.jornada ? e.jornada.trim().toUpperCase() : 'MATUTINA'
        return jEst === jornadaSeleccionada.trim().toUpperCase()
      })

      if (estData) {
        setEstudiantes(estData)
        const estIds = estData.map(e => e.id)

        // Cargar calificaciones filtradas estrictamente por el año vigente
        const { data: calData } = await supabase
          .from('calificaciones')
          .select('*')
          .eq('asignatura', asignaturaSeleccionada.trim())
          .eq('anio_lectivo', anioLectivoVigente)
          .in('estudiante_id', estIds.length > 0 ? estIds : ['none'])

        const mapaNotas: { [key: string]: { t1: number | null; t2: number | null; t3: number | null } } = {}

        estData.forEach(est => {
          const registrosEst = calData?.filter(c => c.estudiante_id === est.id) || []

          let t1: number | null = null
          let t2: number | null = null
          let t3: number | null = null

          registrosEst.forEach(r => {
            const notaParcial = r.promedio_parcial !== undefined && r.promedio_parcial !== null ? Number(r.promedio_parcial) : null
            if (notaParcial === null) return

            const periodoStr = String(r.trimestre || r.periodo || r.quimestre || '').toLowerCase()
            if (periodoStr.includes('1') || periodoStr.includes('trimestre 1')) t1 = notaParcial
            else if (periodoStr.includes('2') || periodoStr.includes('trimestre 2')) t2 = notaParcial
            else if (periodoStr.includes('3') || periodoStr.includes('trimestre 3')) t3 = notaParcial
          })

          if (t1 === null && registrosEst.length > 0 && registrosEst[0]?.promedio_parcial != null) {
            t1 = Number(registrosEst[0].promedio_parcial)
          }
          if (t2 === null && registrosEst.length > 1 && registrosEst[1]?.promedio_parcial != null) {
            t2 = Number(registrosEst[1].promedio_parcial)
          }
          if (t3 === null && registrosEst.length > 2 && registrosEst[2]?.promedio_parcial != null) {
            t3 = Number(registrosEst[2].promedio_parcial)
          }

          mapaNotas[est.id] = { t1, t2, t3 }
        })

        setConsolidadoMap(mapaNotas)
      }
    } catch (err) {
      console.error('Error al cargar notas para el consolidado:', err)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="absolute w-96 h-96 bg-[#4b4c99]/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="text-center relative z-10 bg-white/10 backdrop-blur-2xl p-8 rounded-3xl border border-white/20 shadow-2xl">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f6c358] border-t-transparent mx-auto mb-4"></div>
          <p className="text-white font-bold text-xs uppercase tracking-wider">Cargando Consolidado Anual...</p>
        </div>
      </div>
    )
  }

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  const jornadasDisponibles = Array.from(new Set(asignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada).map(a => a.grado_curso)))
  const paralelosPermitidos = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === gradoSeleccionado).map(a => a.paralelo)))
  const asignaturasPermitidas = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === gradoSeleccionado && a.paralelo === paraleloSeleccionado).map(a => a.asignatura)))

  const handleJornadaChange = (nuevaJornada: string) => {
    setJornadaSeleccionada(nuevaJornada)
    const asigJornada = asignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada)
    if (asigJornada.length > 0) {
      const g = asigJornada[0].grado_curso
      setGradoSeleccionado(g)
      const p = asigJornada.find(a => a.grado_curso === g)?.paralelo || 'A'
      setParaleloSeleccionado(p)
      const mat = asigJornada.find(a => a.grado_curso === g && a.paralelo === p)?.asignatura || ''
      setAsignaturaSeleccionada(mat)
    }
  }

  let totalAprobados = 0
  let totalSupletorios = 0

  const filasProcesadas = estudiantes.map((est) => {
    const notas = consolidadoMap[est.id] || { t1: null, t2: null, t3: null }
    const valoresValidos = [notas.t1, notas.t2, notas.t3].filter((n): n is number => n !== null && !isNaN(n))
    let promedioFinal = 0
    if (valoresValidos.length > 0) {
      const suma = valoresValidos.reduce((acc, curr) => acc + curr, 0)
      promedioFinal = Number((suma / valoresValidos.length).toFixed(2))
    }

    const cualitativa = promedioFinal >= 9 ? 'DAR' : promedioFinal >= 7 ? 'AAR' : promedioFinal >= 5 ? 'PA' : 'NAAR'
    const esAprobado = promedioFinal >= 7

    if (valoresValidos.length > 0) {
      if (esAprobado) totalAprobados++
      else totalSupletorios++
    }

    return { est, notas, valoresValidos, promedioFinal, cualitativa, esAprobado }
  })

  const totalEvaluados = totalAprobados + totalSupletorios
  const porcentajeAprobados = totalEvaluados > 0 ? Math.round((totalAprobados / totalEvaluados) * 100) : 0
  const porcentajeSupletorios = totalEvaluados > 0 ? 100 - porcentajeAprobados : 0

  const nombrePdfDinamico = `${gradoSeleccionado}-${asignaturaSeleccionada}`
    .replace(/\s+/g, '-')
    .replace(/°/g, '')
    .toUpperCase()

  const handlePrintConTitulo = () => {
    document.title = nombrePdfDinamico
    window.print()
  }

  // Autoridad activa seleccionada
  const autoridadActual = autoridadesDisponibles[autoridadSeleccionadaIndex] || { nombre: 'RAUL PINOS', cargo: 'VICERRECTOR' }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#f6c358] selection:text-slate-950">

      {/* ENCABEZADO PRINCIPAL LIQUID GLASS */}
      <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[32px] border border-white/80 shadow-[0_8px_30px_0_rgba(75,76,153,0.08)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-[#4b4c99]/10 text-[#4b4c99] font-bold text-[10px] px-3.5 py-1.5 rounded-full uppercase tracking-wider border border-[#4b4c99]/20">
            {anioLectivoVigente ? `Periodo Lectivo: ${anioLectivoVigente}` : 'Sin periodo activo'}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 mt-2.5 uppercase tracking-tight">
            Consolidado Anual de Calificaciones
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Evaluación Trimestral Integrada
          </p>
        </div>

        {/* 🎨 BOTONES CON LA PALETA DE MARCA OFICIAL */}
        <div className="flex gap-2.5 flex-wrap items-center">
          {/* SELECTOR DE AUTORIDAD / FIRMANTE */}
          <div className="flex items-center gap-1.5 bg-white/80 border border-slate-200 px-3 py-2 rounded-2xl shadow-2xs">
            <label className="text-[10px] font-black text-slate-600 uppercase">Firma:</label>
            <select
              value={autoridadSeleccionadaIndex}
              onChange={(e) => setAutoridadSeleccionadaIndex(Number(e.target.value))}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              {autoridadesDisponibles.length === 0 ? (
                <option value={0}>RAUL PINOS (VICERRECTOR)</option>
              ) : (
                autoridadesDisponibles.map((aut, idx) => (
                  <option key={idx} value={idx}>{aut.nombre} ({aut.cargo})</option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={() => setMostrarModalImpresion(true)}
            disabled={!anioLectivoVigente}
            className="px-5 py-2.5 text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            style={{ backgroundColor: '#4b4c99' }}
          >
            Vista Previa / Imprimir Reporte
          </button>
          
          <button
            onClick={() => router.push('/docente/calificaciones')}
            className="px-4 py-2.5 bg-white/90 hover:bg-white text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 shadow-2xs transition cursor-pointer"
          >
            Volver a Calificaciones
          </button>
        </div>
      </div>

      {/* AVISOS */}
      {!anioLectivoVigente && !cargando && (
        <div className="bg-amber-50/90 backdrop-blur-xl border border-amber-300/80 p-4 rounded-2xl text-amber-900 text-xs font-bold shadow-xs">
          La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {esAnioCerrado && anioLectivoVigente && (
        <div className="bg-red-50/90 backdrop-blur-xl border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold flex items-center justify-between shadow-xs">
          <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. El consolidado está en modo de solo lectura.</span>
          <span className="bg-red-200 px-2.5 py-1 rounded-full text-[10px]">Periodo Cerrado</span>
        </div>
      )}

      {/* FILTROS DINÁMICOS INTELIGENTES CON JORNADA */}
      <div className="bg-white/70 backdrop-blur-2xl p-5 rounded-[28px] border border-white/80 shadow-[0_8px_30px_0_rgba(75,76,153,0.06)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada:</label>
          <select
            value={jornadaSeleccionada}
            onChange={(e) => handleJornadaChange(e.target.value)}
            disabled={jornadasDisponibles.length <= 1}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/80 backdrop-blur-md outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
          >
            {jornadasDisponibles.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso:</label>
          <select
            value={gradoSeleccionado}
            onChange={(e) => {
              const nuevoGrado = e.target.value
              setGradoSeleccionado(nuevoGrado)
              const par = asignaciones.find(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === nuevoGrado)?.paralelo || 'A'
              setParaleloSeleccionado(par)
            }}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/80 backdrop-blur-md outline-none shadow-2xs"
          >
            {gradosUnicos.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo:</label>
          <select
            value={paraleloSeleccionado}
            onChange={(e) => setParaleloSeleccionado(e.target.value)}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/80 backdrop-blur-md outline-none shadow-2xs"
          >
            {paralelosPermitidos.map(p => (
              <option key={p} value={p}>Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura:</label>
          <select
            value={asignaturaSeleccionada}
            onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/80 backdrop-blur-md outline-none shadow-2xs"
          >
            {asignaturasPermitidas.map(mat => (
              <option key={mat} value={mat}>{mat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA ESTILO GOOGLE SHEETS DE CONSOLIDADO ANUAL */}
      <div className="bg-white/75 backdrop-blur-2xl rounded-[32px] border border-white/80 shadow-[0_8px_30px_0_rgba(75,76,153,0.08)] overflow-hidden space-y-4">
        <div className="p-4 bg-[#4b4c99] text-white flex justify-between items-center rounded-t-[32px]">
          <h2 className="text-xs font-black uppercase tracking-wider">
            CONSOLIDADO ANUAL • {asignaturaSeleccionada || 'Materia'} ({gradoSeleccionado} "{paraleloSeleccionado}" - {jornadaSeleccionada})
          </h2>
          <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-xl">
            {estudiantes.length} Estudiantes Matriculados
          </span>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 border border-slate-200 text-center w-12" rowSpan={2}>Nro</th>
                <th className="p-3 border border-slate-200 w-32" rowSpan={2}>Cédula</th>
                <th className="p-3 border border-slate-200" rowSpan={2}>Apellidos y Nombres</th>
                <th className="p-3 border border-slate-200 text-center w-24 bg-[#4b4c99]/10 text-[#4b4c99]">1ER</th>
                <th className="p-3 border border-slate-200 text-center w-24 bg-[#45b3a5]/10 text-[#45b3a5]">2DO</th>
                <th className="p-3 border border-slate-200 text-center w-24 bg-purple-50 text-purple-800">3ER</th>
                <th className="p-3 border border-slate-200 text-center w-28 bg-[#4b4c99] text-white" rowSpan={2}>PROMEDIO FINAL</th>
                <th className="p-3 border border-slate-200 text-center w-24" rowSpan= {2}>CALF. CUALIT.</th>
                <th className="p-3 border border-slate-200 text-center w-36" rowSpan={2}>OBSERVACIÓN</th>
              </tr>
              <tr className="bg-white/60 text-[9px] text-center">
                <th className="border border-slate-200 p-1">Trimestre</th>
                <th className="border border-slate-200 p-1">Trimestre</th>
                <th className="border border-slate-200 p-1">Trimestre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {!anioLectivoVigente ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-amber-800 font-bold bg-amber-50/50">
                    No hay un año lectivo activo configurado en la institución.
                  </td>
                </tr>
              ) : filasProcesadas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 font-medium">
                    No hay estudiantes registrados en esta jornada, curso y paralelo para el periodo {anioLectivoVigente}.
                  </td>
                </tr>
              ) : (
                filasProcesadas.map(({ est, notas, valoresValidos, promedioFinal, cualitativa, esAprobado }, idx) => (
                  <tr key={est.id} className="hover:bg-white/50 transition-colors">
                    <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 border border-slate-200 text-slate-600 font-mono">{est.cedula || 'S/N'}</td>
                    <td className="p-3 border border-slate-200 font-bold text-slate-800 uppercase">
                      {est.apellidos} {est.nombres}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-[#4b4c99]/5">
                      {notas.t1 !== null ? notas.t1.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-[#45b3a5]/5">
                      {notas.t2 !== null ? notas.t2.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-purple-50/40">
                      {notas.t3 !== null ? notas.t3.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-black text-slate-900 bg-slate-50">
                      {valoresValidos.length > 0 ? promedioFinal.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-bold text-slate-700">
                      {valoresValidos.length > 0 ? cualitativa : ''}
                    </td>
                    <td className={`p-3 border border-slate-200 text-center font-black text-[10px] ${
                      valoresValidos.length === 0 ? 'bg-slate-50 text-slate-400' :
                      esAprobado ? 'bg-blue-100/80 text-blue-800' : 'bg-amber-500 text-white'
                    }`}>
                      {valoresValidos.length === 0 ? '' : esAprobado ? 'APROBADO' : 'SUPLETORIO'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VENTANA FLOTANTE / MODAL DE VISTA PREVIA E IMPRESIÓN */}
      {mostrarModalImpresion && anioLectivoVigente && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-[36px] max-w-5xl w-full p-8 space-y-6 shadow-2xl relative print:shadow-none print:p-2 print:max-w-none border border-white">
            
            {/* BOTONES SUPERIORES DEL MODAL (OCULTOS AL IMPRIMIR) */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 print:hidden">
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Vista Previa de Impresión Oficial</h2>
                <p className="text-xs text-slate-500">El documento está listo para guardarse como PDF ({nombrePdfDinamico}) o imprimirse.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintConTitulo}
                  className="px-5 py-2.5 text-white font-black text-xs rounded-2xl shadow-lg transition cursor-pointer"
                  style={{ backgroundColor: '#4b4c99' }}
                >
                  Imprimir / Guardar PDF
                </button>
                <button
                  onClick={() => setMostrarModalImpresion(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* CONTENIDO DEL REPORTE OFICIAL PARA IMPRESIÓN */}
            <div className="space-y-6 print:space-y-4">
              
              {/* ENCABEZADO INSTITUCIONAL ELEGANTE Y MINIMALISTA */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-center">
                <div className="flex items-center gap-4 text-left">
                  {institucionLogo ? (
                    <img src={institucionLogo} alt="Logo Institución" className="w-20 h-20 object-contain" />
                  ) : null}
                  <div>
                    <h2 className="text-base font-black uppercase text-slate-900">{nombreInstitucion}</h2>
                    <p className="text-xs font-bold text-slate-700">CÓDIGO AMIE: 03H00278 • Azogues - Ecuador</p>
                    <p className="text-xs font-black text-indigo-900 mt-0.5">CONSOLIDADO GENERAL DE RENDIMIENTO ACADÉMICO</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black uppercase bg-slate-100 px-3 py-1.5 border border-slate-300 rounded-xl text-slate-900 block">
                    PERIODO LECTIVO {anioLectivoVigente}
                  </span>
                </div>
              </div>

              {/* DATOS INFORMATIVOS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border border-slate-300 p-3.5 bg-slate-50 rounded-2xl font-bold text-slate-800">
                <div><strong>ASIGNATURA:</strong> <span className="font-semibold text-slate-900">{asignaturaSeleccionada}</span></div>
                <div><strong>GRADO / CURSO:</strong> <span className="font-semibold text-slate-900">{gradoSeleccionado}</span></div>
                <div><strong>PARALELO:</strong> <span className="font-semibold text-slate-900">{paraleloSeleccionado}</span></div>
                <div><strong>JORNADA:</strong> <span className="font-semibold text-slate-900">{jornadaSeleccionada}</span></div>
                <div className="col-span-2"><strong>DOCENTE RESPONSABLE:</strong> <span className="font-semibold text-slate-900 uppercase">{nombreDocente || 'N/D'}</span></div>
                <div className="col-span-2"><strong>AUTORIDAD INSTITUCIONAL:</strong> <span className="font-semibold text-slate-900 uppercase">{autoridadActual.nombre} ({autoridadActual.cargo})</span></div>
              </div>

              {/* TABLA DE CALIFICACIONES OFICIAL */}
              <table className="w-full text-xs text-left border-collapse border border-slate-800 text-slate-900 font-semibold">
                <thead>
                  <tr className="bg-slate-200 text-slate-950 font-black uppercase text-[10px] text-center">
                    <th className="p-2 border border-slate-800 w-10" rowSpan={2}>Nro</th>
                    <th className="p-2 border border-slate-800 w-28" rowSpan={2}>Cédula</th>
                    <th className="p-2 border border-slate-800 text-left" rowSpan={2}>Apellidos y Nombres</th>
                    <th className="p-2 border border-slate-800 w-16">1ER</th>
                    <th className="p-2 border border-slate-800 w-16">2DO</th>
                    <th className="p-2 border border-slate-800 w-16">3ER</th>
                    <th className="p-2 border border-slate-800 w-20" rowSpan={2}>PROM. FINAL</th>
                    <th className="p-2 border border-slate-800 w-16" rowSpan={2}>CALIF.</th>
                    <th className="p-2 border border-slate-800 w-28" rowSpan={2}>OBSERVACIÓN</th>
                  </tr>
                  <tr className="bg-slate-100 text-[9px] text-center font-bold text-slate-800">
                    <th className="border border-slate-800 p-0.5">Trim</th>
                    <th className="border border-slate-800 p-0.5">Trim</th>
                    <th className="border border-slate-800 p-0.5">Trim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {filasProcesadas.map(({ est, notas, valoresValidos, promedioFinal, cualitativa, esAprobado }, idx) => (
                    <tr key={est.id} className="text-center">
                      <td className="p-1.5 border border-slate-800 font-bold text-slate-600">{idx + 1}</td>
                      <td className="p-1.5 border border-slate-800 font-mono text-[11px]">{est.cedula || 'S/N'}</td>
                      <td className="p-1.5 border border-slate-800 text-left font-bold uppercase">{est.apellidos} {est.nombres}</td>
                      <td className="p-1.5 border border-slate-800">{notas.t1 !== null ? notas.t1.toFixed(2) : '-'}</td>
                      <td className="p-1.5 border border-slate-800">{notas.t2 !== null ? notas.t2.toFixed(2) : '-'}</td>
                      <td className="p-1.5 border border-slate-800">{notas.t3 !== null ? notas.t3.toFixed(2) : '-'}</td>
                      <td className="p-1.5 border border-slate-800 font-black">{valoresValidos.length > 0 ? promedioFinal.toFixed(2) : '-'}</td>
                      <td className="p-1.5 border border-slate-800 font-bold">{valoresValidos.length > 0 ? cualitativa : '-'}</td>
                      <td className={`p-1.5 border border-slate-800 font-black text-[10px] uppercase ${
                        valoresValidos.length === 0 ? 'text-slate-400' :
                        esAprobado ? 'text-blue-900 bg-blue-50' : 'text-amber-800 bg-amber-50'
                      }`}>
                        {valoresValidos.length === 0 ? 'SIN NOTAS' : esAprobado ? 'APROBADO' : 'SUPLETORIO'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* DASHBOARD INFORMATIVO ESTADÍSTICO Y GRÁFICO AL FINAL DE LA IMPRESIÓN */}
              <div className="pt-6 border-t-2 border-slate-300 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Resumen Estadístico y Conteo Académico</h3>
                  <span className="text-[11px] font-bold text-slate-600">Total Evaluados: {totalEvaluados} estudiantes</span>
                </div>

                {/* TARJETAS DE CONTEO */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="block font-bold text-blue-900 uppercase">Estudiantes Aprobados Directos</span>
                      <span className="text-xl font-black text-blue-950">{totalAprobados} alumnos</span>
                    </div>
                    <span className="text-sm font-black bg-blue-200 text-blue-900 px-2.5 py-1 rounded-xl">{porcentajeAprobados}%</span>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="block font-bold text-amber-900 uppercase">Estudiantes a Supletorio</span>
                      <span className="text-xl font-black text-amber-950">{totalSupletorios} alumnos</span>
                    </div>
                    <span className="text-sm font-black bg-amber-200 text-amber-900 px-2.5 py-1 rounded-xl">{porcentajeSupletorios}%</span>
                  </div>
                </div>

                {/* GRÁFICO DE BARRAS ELEGANTE Y MINIMALISTA */}
                <div className="space-y-2 pt-2">
                  <div className="flex h-5 w-full rounded-full overflow-hidden border border-slate-300 shadow-2xs bg-slate-100">
                    <div 
                      style={{ width: `${porcentajeAprobados}%` }} 
                      className="bg-blue-600 h-full transition-all duration-500 flex items-center justify-center text-[9px] font-black text-white"
                      title={`Aprobados: ${porcentajeAprobados}%`}
                    >
                      {porcentajeAprobados > 0 && `${porcentajeAprobados}%`}
                    </div>
                    <div 
                      style={{ width: `${porcentajeSupletorios}%` }} 
                      className="bg-amber-500 h-full transition-all duration-500 flex items-center justify-center text-[9px] font-black text-white"
                      title={`Supletorios: ${porcentajeSupletorios}%`}
                    >
                      {porcentajeSupletorios > 0 && `${porcentajeSupletorios}%`}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 px-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span> Aprobados Directos ({totalAprobados})</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Supletorios ({totalSupletorios})</span>
                  </div>
                </div>
              </div>

              {/* FIRMAS DE RESPONSABILIDAD CON CARGO DINÁMICO */}
              <div className="grid grid-cols-2 pt-16 text-center text-xs text-slate-900 font-bold">
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black uppercase">{nombreDocente || 'DOCENTE RESPONSABLE'}</div>
                  <div className="font-black text-[11px]">DOCENTE DE LA ASIGNATURA</div>
                </div>
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black uppercase">{autoridadActual.nombre}</div>
                  <div className="font-black text-[11px] uppercase">{autoridadActual.cargo}</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}