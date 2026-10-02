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

  const [autoridadesDisponibles, setAutoridadesDisponibles] = useState<{ nombre: string; cargo: string }[]>([])
  const [autoridadSeleccionadaIndex, setAutoridadSeleccionadaIndex] = useState(0)

  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  const [asignaciones, setAsignaciones] = useState<any[]>([])
  
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('MATUTINA')
  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('')
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState('')

  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [consolidadoMap, setConsolidadoMap] = useState<{ [estudianteId: string]: { t1: number | null; t2: number | null; t3: number | null } }>({})

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

  // ESTADO DE CARGA LIMPIO E INSTITUCIONAL (SIN DESTELLOS OSCUROS)
  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Consolidado Anual...</p>
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

  const autoridadActual = autoridadesDisponibles[autoridadSeleccionadaIndex] || { nombre: 'RAUL PINOS', cargo: 'VICERRECTOR' }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99]/20 selection:text-[#4b4c99] font-sans">

      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
          >
            {anioLectivoVigente ? `Año Lectivo Vigente: ${anioLectivoVigente}` : 'Sin periodo activo'}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            Consolidado Anual de Calificaciones
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Evaluación Trimestral Integrada
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <label className="text-[10px] font-bold text-slate-700 uppercase">Firma:</label>
            <select
              value={autoridadSeleccionadaIndex}
              onChange={(e) => setAutoridadSeleccionadaIndex(Number(e.target.value))}
              className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
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
            style={{ backgroundColor: '#4b4c99' }}
            className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            Vista Previa / Imprimir Reporte
          </button>
          
          <button
            onClick={() => router.push('/docente/calificaciones')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer"
          >
            Volver a Calificaciones
          </button>
        </div>
      </div>

      {/* AVISOS */}
      {!anioLectivoVigente && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {esAnioCerrado && anioLectivoVigente && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. El consolidado está en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Periodo Cerrado</span>
        </div>
      )}

      {/* FILTROS DINÁMICOS */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaSeleccionada}
            onChange={(e) => handleJornadaChange(e.target.value)}
            disabled={jornadasDisponibles.length <= 1}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
          >
            {jornadasDisponibles.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso</label>
          <select
            value={gradoSeleccionado}
            onChange={(e) => {
              const nuevoGrado = e.target.value
              setGradoSeleccionado(nuevoGrado)
              const par = asignaciones.find(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === nuevoGrado)?.paralelo || 'A'
              setParaleloSeleccionado(par)
            }}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {gradosUnicos.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
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
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura</label>
          <select
            value={asignaturaSeleccionada}
            onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {asignaturasPermitidas.map(mat => (
              <option key={mat} value={mat}>{mat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA DE CONSOLIDADO ANUAL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-[#4b4c99] text-white flex justify-between items-center">
          <h2 className="text-xs font-bold uppercase tracking-wider">
            CONSOLIDADO ANUAL • {asignaturaSeleccionada || 'Materia'} ({gradoSeleccionado} "{paraleloSeleccionado}" - {jornadaSeleccionada})
          </h2>
          <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-xl">
            {estudiantes.length} Estudiantes Matriculados
          </span>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 border border-slate-200 text-center w-12" rowSpan={2}>Nro</th>
                <th className="p-3 border border-slate-200 w-32" rowSpan={2}>Cédula</th>
                <th className="p-3 border border-slate-200" rowSpan={2}>Apellidos y Nombres</th>
                <th className="p-3 border border-slate-200 text-center w-24 text-white" style={{ backgroundColor: '#4b4c99' }}>1ER</th>
                <th className="p-3 border border-slate-200 text-center w-24 text-white" style={{ backgroundColor: '#389186' }}>2DO</th>
                <th className="p-3 border border-slate-200 text-center w-24 text-white" style={{ backgroundColor: '#d99b1e' }}>3ER</th>
                <th className="p-3 border border-slate-200 text-center w-28 bg-slate-900 text-white" rowSpan={2}>PROMEDIO FINAL</th>
                <th className="p-3 border border-slate-200 text-center w-24" rowSpan={2}>CALF. CUALIT.</th>
                <th className="p-3 border border-slate-200 text-center w-36" rowSpan={2}>OBSERVACIÓN</th>
              </tr>
              <tr className="bg-slate-100 text-[9px] text-center font-semibold text-slate-700">
                <th className="border border-slate-200 p-1">Trimestre</th>
                <th className="border border-slate-200 p-1">Trimestre</th>
                <th className="border border-slate-200 p-1">Trimestre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {!anioLectivoVigente ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-amber-800 font-bold bg-amber-50">
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
                  <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 border border-slate-200 text-slate-600 font-mono">{est.cedula || 'S/N'}</td>
                    <td className="p-3 border border-slate-200 font-bold text-slate-800 uppercase">
                      {est.apellidos} {est.nombres}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-indigo-50/20">
                      {notas.t1 !== null ? notas.t1.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-teal-50/20">
                      {notas.t2 !== null ? notas.t2.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-amber-50/20">
                      {notas.t3 !== null ? notas.t3.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-black text-slate-900 bg-slate-50">
                      {valoresValidos.length > 0 ? promedioFinal.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-bold text-slate-700">
                      {valoresValidos.length > 0 ? cualitativa : ''}
                    </td>
                    <td className={`p-3 border border-slate-200 text-center font-bold text-[10px] uppercase ${
                      valoresValidos.length === 0 ? 'bg-slate-50 text-slate-400' :
                      esAprobado ? 'bg-indigo-50 text-[#4b4c99]' : 'bg-rose-50 text-rose-700'
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

      {/* MODAL DE VISTA PREVIA E IMPRESIÓN */}
      {mostrarModalImpresion && anioLectivoVigente && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-8 space-y-6 shadow-xl relative print:shadow-none print:p-2 print:max-w-none border border-slate-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 print:hidden">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Vista Previa de Impresión Oficial</h2>
                <p className="text-xs text-slate-500 font-medium">El documento está listo para guardarse como PDF ({nombrePdfDinamico}) o imprimirse.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintConTitulo}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  Imprimir / Guardar PDF
                </button>
                <button
                  onClick={() => setMostrarModalImpresion(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* CONTENIDO DEL REPORTE OFICIAL */}
            <div className="space-y-6 print:space-y-4">
              
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-center">
                <div className="flex items-center gap-4 text-left">
                  {institucionLogo ? (
                    <img src={institucionLogo} alt="Logo Institución" className="w-20 h-20 object-contain" />
                  ) : null}
                  <div>
                    <h2 className="text-sm font-black uppercase text-slate-900">{nombreInstitucion}</h2>
                    <p className="text-[11px] font-bold text-slate-700">CÓDIGO AMIE: 03H00278 • Azogues - Ecuador</p>
                    <p className="text-xs font-bold text-[#4b4c99] mt-0.5">CONSOLIDADO GENERAL DE RENDIMIENTO ACADÉMICO</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase bg-slate-100 px-3 py-1.5 border border-slate-300 rounded-xl text-slate-900 block shadow-2xs">
                    PERIODO LECTIVO {anioLectivoVigente}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border border-slate-300 p-3.5 bg-slate-50 rounded-2xl font-bold text-slate-800">
                <div><strong>ASIGNATURA:</strong> <span className="font-semibold text-slate-900">{asignaturaSeleccionada}</span></div>
                <div><strong>GRADO / CURSO:</strong> <span className="font-semibold text-slate-900">{gradoSeleccionado}</span></div>
                <div><strong>PARALELO:</strong> <span className="font-semibold text-slate-900">{paraleloSeleccionado}</span></div>
                <div><strong>JORNADA:</strong> <span className="font-semibold text-slate-900">{jornadaSeleccionada}</span></div>
                <div className="col-span-2"><strong>DOCENTE RESPONSABLE:</strong> <span className="font-semibold text-slate-900 uppercase">{nombreDocente || 'N/D'}</span></div>
                <div className="col-span-2"><strong>AUTORIDAD INSTITUCIONAL:</strong> <span className="font-semibold text-slate-900 uppercase">{autoridadActual.nombre} ({autoridadActual.cargo})</span></div>
              </div>

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
                        esAprobado ? 'text-indigo-900 bg-indigo-50' : 'text-rose-800 bg-rose-50'
                      }`}>
                        {valoresValidos.length === 0 ? 'SIN NOTAS' : esAprobado ? 'APROBADO' : 'SUPLETORIO'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* DASHBOARD ESTADÍSTICO */}
              <div className="pt-6 border-t border-slate-200 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase text-slate-900 tracking-wide">Resumen Estadístico y Conteo Académico</h3>
                  <span className="text-[11px] font-bold text-slate-500">Total Evaluados: {totalEvaluados} estudiantes</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center shadow-2xs">
                    <div>
                      <span className="block font-bold text-slate-600 uppercase text-[10px]">Estudiantes Aprobados Directos</span>
                      <span className="text-base font-bold text-slate-900">{totalAprobados} alumnos</span>
                    </div>
                    <span className="text-xs font-bold bg-indigo-50 text-[#4b4c99] border border-indigo-100 px-2.5 py-1 rounded-xl">{porcentajeAprobados}%</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center shadow-2xs">
                    <div>
                      <span className="block font-bold text-slate-600 uppercase text-[10px]">Estudiantes a Supletorio</span>
                      <span className="text-base font-bold text-slate-900">{totalSupletorios} alumnos</span>
                    </div>
                    <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl">{porcentajeSupletorios}%</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex h-4 w-full rounded-full overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
                    <div 
                      style={{ width: `${porcentajeAprobados}%`, backgroundColor: '#4b4c99' }} 
                      className="h-full transition-all duration-500 flex items-center justify-center text-[9px] font-bold text-white"
                      title={`Aprobados: ${porcentajeAprobados}%`}
                    >
                      {porcentajeAprobados > 0 && `${porcentajeAprobados}%`}
                    </div>
                    <div 
                      style={{ width: `${porcentajeSupletorios}%`, backgroundColor: '#f6c358' }} 
                      className="h-full transition-all duration-500 flex items-center justify-center text-[9px] font-bold text-slate-950"
                      title={`Supletorios: ${porcentajeSupletorios}%`}
                    >
                      {porcentajeSupletorios > 0 && `${porcentajeSupletorios}%`}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#4b4c99' }}></span> Aprobados Directos ({totalAprobados})</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#f6c358' }}></span> Supletorios ({totalSupletorios})</span>
                  </div>
                </div>
              </div>

              {/* FIRMAS DE RESPONSABILIDAD */}
              <div className="grid grid-cols-2 pt-16 text-center text-xs text-slate-900 font-bold">
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-bold uppercase">{nombreDocente || 'DOCENTE RESPONSABLE'}</div>
                  <div className="font-bold text-[10px] text-slate-600">DOCENTE DE LA ASIGNATURA</div>
                </div>
                <div className="space-y-1">
                  <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-bold uppercase">{autoridadActual.nombre}</div>
                  <div className="font-bold text-[10px] text-slate-600 uppercase">{autoridadActual.cargo}</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}