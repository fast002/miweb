'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ReportesAcademicosPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('UNIDAD EDUCATIVA')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [docenteId, setDocenteId] = useState('')
  const [nombreDocente, setNombreDocente] = useState('')

  // Control de Autoridades de la Misma Institución y sus Cargos
  const [autoridadesDisponibles, setAutoridadesDisponibles] = useState<{ nombre: string; cargo: string }[]>([])
  const [autoridadSeleccionadaIndex, setAutoridadSeleccionadaIndex] = useState(0)

  // Control Dinámico de Años Lectivos Sincronizado con periodos_disponibles de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Asignaciones del docente estrictamente del año vigente
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])
  
  // Filtros
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')
  const [jornadaActual, setJornadaActual] = useState('MATUTINA')
  const [tipoReporte, setTipoReporte] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Anual'>('Trimestre 1')
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState('')

  // Datos consolidados del estudiante seleccionado
  const [calificacionesEstudiante, setCalificacionesEstudiante] = useState<any[]>([])
  const [complementariosEstudiante, setComplementariosEstudiante] = useState<any>({})

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return; }
        setDocenteId(user.id)

        const { data: doc } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user.id).maybeSingle()
        
        let anioActivo = ''
        let periodosList: string[] = []
        let cerradosList: string[] = []
        let instId = ''

        if (doc) {
          setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
          setInstitucionLogo(doc.instituciones?.logo_url || '')
          setNombreDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim())
          if (doc.institucion_id) {
            instId = doc.institucion_id
            setInstitucionId(instId)
          }

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

            if (inst.anos_cerrados) {
              cerradosList = inst.anos_cerrados
              setAnosCerrados(cerradosList)
            }
          }
        }

        if (instId) {
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
              setAutoridadesDisponibles([{ nombre: 'LIC. MARIALETI ORELLANA A.', cargo: 'RECTORA' }])
              setAutoridadSeleccionadaIndex(0)
            }
          }
        }

        if (anioActivo) {
          const { data: asignacionesData } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asignacionesData && asignacionesData.length > 0) {
            setMisAsignaciones(asignacionesData)
            setGrado(asignacionesData[0].grado_curso)
            setParalelo(asignacionesData[0].paralelo)
            setJornadaActual(asignacionesData[0].jornada || 'MATUTINA')
          } else {
            setMisAsignaciones([])
          }
        } else {
          setMisAsignaciones([])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  const jornadasDisponibles = Array.from(new Set(misAsignaciones.map(a => a.jornada || 'MATUTINA')))

  const gradosDisponiblesPorJornada = Array.from(new Set(
    misAsignaciones
      .filter(a => (a.jornada || 'MATUTINA') === jornadaActual)
      .map(a => a.grado_curso)
  ))

  useEffect(() => {
    async function cargarEstudiantesCurso() {
      if (!institucionId || !grado || !paralelo || !anioLectivoVigente) return
      const { data } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', grado)
        .eq('paralelo', paralelo)
        .eq('anio_lectivo', anioLectivoVigente)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      if (data && data.length > 0) {
        const filtradosPorJornada = data.filter(e => {
          if (!e.jornada) return true
          return e.jornada.trim().toUpperCase() === jornadaActual.trim().toUpperCase()
        })

        const listaFinal = filtradosPorJornada.length > 0 ? filtradosPorJornada : data

        setEstudiantes(listaFinal)
        setEstudianteSeleccionadoId(listaFinal[0].id)
      } else {
        setEstudiantes([])
        setEstudianteSeleccionadoId('')
      }
    }
    cargarEstudiantesCurso()
  }, [institucionId, grado, paralelo, jornadaActual, anioLectivoVigente])

  const cargarDatosEstudiante = useCallback(async () => {
    if (!estudianteSeleccionadoId || !anioLectivoVigente) return
    setCargando(true)
    try {
      const { data: calData } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('estudiante_id', estudianteSeleccionadoId)
        .eq('anio_lectivo', anioLectivoVigente)

      setCalificacionesEstudiante(calData || [])

      const { data: compData } = await supabase
        .from('acompanamiento_integral')
        .select('*')
        .eq('estudiante_id', estudianteSeleccionadoId)
        .eq('anio_lectivo', anioLectivoVigente)

      const compMap: any = {}
      compData?.forEach(item => {
        compMap[item.item] = {
          t1: item.t1, t2: item.t2, t3: item.t3,
          rec_t1: item.rec_t1, rec_t2: item.rec_t2, rec_t3: item.rec_t3, rec_anual: item.rec_anual
        }
      })
      setComplementariosEstudiante(compMap)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }, [estudianteSeleccionadoId, anioLectivoVigente])

  useEffect(() => {
    cargarDatosEstudiante()
  }, [cargarDatosEstudiante])

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  const obtenerNombreSubnivel = (gradoStr: string) => {
    if (['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoStr)) {
      return 'Básica Elemental'
    } else if (['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(gradoStr)) {
      return 'Básica Media'
    } else if (['8vo EGB', '9no EGB', '10mo EGB'].includes(gradoStr)) {
      return 'Básica Superior'
    } else if (gradoStr.includes('BGU') || gradoStr.includes('BT')) {
      return 'Bachillerato'
    }
    return ''
  }

  const subnivelActual = obtenerNombreSubnivel(grado)
  const esBasicaElemental = subnivelActual === 'Básica Elemental'
  const esSuperiorOBachillerato = subnivelActual === 'Básica Superior' || subnivelActual === 'Bachillerato'

  const asignaturasElementalMedia = [
    'LENGUA Y LITERATURA',
    'MATEMÁTICAS',
    'ESTUDIOS SOCIALES',
    'CIENCIAS NATURALES',
    'INGLÉS',
    'EDUCACIÓN FÍSICA',
    'EDUCACIÓN CULTURAL Y ARTÍSTICA'
  ]

  const asignaturasSuperiorBachillerato = [
    'LENGUA Y LITERATURA',
    'MATEMÁTICAS',
    'ESTUDIOS SOCIALES',
    'CIENCIAS NATURALES',
    'INGLÉS',
    'EDUCACIÓN FÍSICA',
    'EDUCACIÓN CULTURAL Y ARTÍSTICA'
  ]

  const asignaturasFijas = esSuperiorOBachillerato ? asignaturasSuperiorBachillerato : asignaturasElementalMedia

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

  const estudianteActual = estudiantes.find(e => e.id === estudianteSeleccionadoId)
  const paralelosDisponibles = Array.from(new Set(
    misAsignaciones
      .filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado)
      .map(a => a.paralelo)
  ))

  const handleJornadaChange = (nuevaJornada: string) => {
    setJornadaActual(nuevaJornada)
    const primerGradoJornada = misAsignaciones.find(a => (a.jornada || 'MATUTINA') === nuevaJornada)?.grado_curso || ''
    if (primerGradoJornada) {
      setGrado(primerGradoJornada)
      const primerParalelo = misAsignaciones.find(a => (a.jornada || 'MATUTINA') === nuevaJornada && a.grado_curso === primerGradoJornada)?.paralelo || 'A'
      setParalelo(primerParalelo)
    }
  }

  const handleGradoChange = (nuevoGrado: string) => {
    setGrado(nuevoGrado)
    const asigMatch = misAsignaciones.find(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === nuevoGrado)
    if (asigMatch) {
      setParalelo(asigMatch.paralelo || 'A')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const obtenerRecomendacionTexto = () => {
    if (tipoReporte !== 'Anual') {
      const campoKey = tipoReporte === 'Trimestre 1' ? 'rec_t1' : tipoReporte === 'Trimestre 2' ? 'rec_t2' : 'rec_t3'
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

  const autoridadActual = autoridadesDisponibles[autoridadSeleccionadaIndex] || { nombre: 'LIC. MARIALETI ORELLANA A.', cargo: 'RECTOR(A)' }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Reportes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white font-sans">
      
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

      <div className="max-w-6xl mx-auto space-y-6 print:space-y-1 print:max-w-none">

        {/* CONTROLES SUPERIORES */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
          <div>
            <span 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
              className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
            >
              Año Lectivo Vigente: {anioLectivoVigente || 'Sin año activo'}
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
              Generador Reportes Académicos
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              {nombreInstitucion} • Vista adaptada al periodo vigente y subnivel
            </p>
          </div>

          <div className="flex gap-2.5 flex-wrap items-center">
            {/* SELECTOR DE FIRMANTE DINÁMICO */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl shadow-2xs">
              <label className="text-[10px] font-bold text-slate-700 uppercase">Firma:</label>
              <select
                value={autoridadSeleccionadaIndex}
                onChange={(e) => setAutoridadSeleccionadaIndex(Number(e.target.value))}
                className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
              >
                {autoridadesDisponibles.map((aut, idx) => (
                  <option key={idx} value={idx}>{aut.nombre} ({aut.cargo})</option>
                ))}
              </select>
            </div>

            <button 
              onClick={handlePrint} 
              disabled={!anioLectivoVigente} 
              style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
              className="px-4 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <span></span> Imprimir / Guardar PDF
            </button>
          </div>
        </div>

        {/* AVISO SI NO HAY AÑO ACTIVO */}
        {!anioLectivoVigente && (
          <div 
            style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
            className="border p-4 rounded-2xl text-xs font-bold shadow-2xs print:hidden"
          >
            La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
          </div>
        )}

        {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
        {esAnioCerrado && anioLectivoVigente && (
          <div 
            style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
            className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs print:hidden"
          >
            <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. Los reportes están en modo de solo lectura.</span>
            <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Periodo Cerrado</span>
          </div>
        )}

        {/* FILTROS DE SELECCIÓN */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-5 gap-3.5 print:hidden">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
            <select
              value={jornadaActual}
              onChange={(e) => handleJornadaChange(e.target.value)}
              disabled={jornadasDisponibles.length <= 1}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
            >
              {jornadasDisponibles.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso</label>
            <select value={grado} onChange={(e) => handleGradoChange(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs">
              {gradosDisponiblesPorJornada.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
            <select value={paralelo} onChange={(e) => setParalelo(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs">
              {paralelosDisponibles.map(p => <option key={p} value={p}>Paralelo {p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Estudiante</label>
            <select value={estudianteSeleccionadoId} onChange={(e) => setEstudianteSeleccionadoId(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs">
              {estudiantes.map(est => <option key={est.id} value={est.id}>{est.apellidos} {est.nombres}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Tipo de Reporte</label>
            <select 
              value={tipoReporte} 
              onChange={(e: any) => setTipoReporte(e.target.value)} 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.05)', borderColor: 'rgba(75, 76, 153, 0.3)' }}
              className="w-full p-2.5 border-2 rounded-xl text-xs font-bold outline-none shadow-2xs"
            >
              <option value="Trimestre 1">1er Trimestre</option>
              <option value="Trimestre 2">2do Trimestre</option>
              <option value="Trimestre 3">3er Trimestre</option>
              <option value="Anual">Reporte Final (Anual)</option>
            </select>
          </div>
        </div>

        {/* DOCUMENTO OFICIAL IDÉNTICO A LA VISTA PREVIA */}
        <div id="printable-report-area" className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 print:border-none print:shadow-none print:p-3 print:w-full text-slate-900">
          
          {/* ENCABEZADO CON LOGO INSTITUCIONAL */}
          <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
            <div className="flex items-center gap-4 text-left">
              {institucionLogo ? (
                <img src={institucionLogo} alt="Logo Institución" className="w-20 h-20 object-contain" />
              ) : null}
              <div>
                <h2 className="text-sm font-black uppercase text-slate-900">{nombreInstitucion}</h2>
                <p className="text-[11px] font-bold text-slate-700">CÓDIGO AMIE: 03H00278 • Azogues - Ecuador</p>
              </div>
            </div>
            <div className="text-right">
              <span className="whitespace-nowrap text-[10px] font-black uppercase bg-slate-100 px-2.5 py-1 border border-slate-800 rounded text-slate-900 shadow-2xs">
                RENDIMIENTO ACADÉMICO - {tipoReporte.toUpperCase()} ({anioLectivoVigente || 'Sin año activo'}) {subnivelActual ? `(${subnivelActual.toUpperCase()})` : ''}
              </span>
            </div>
          </div>

          {/* DATOS INFORMATIVOS */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs border border-slate-800 p-3 bg-slate-50/60 rounded-xl font-bold text-slate-900">
            <div><strong>REFERENCIA:</strong> 1</div>
            <div><strong>PARALELO:</strong> {paralelo}</div>
            <div><strong>GRADO/CURSO:</strong> {grado}</div>
            <div><strong>JORNADA:</strong> {jornadaActual}</div>
            <div><strong>DOCENTE TUTOR:</strong> {nombreDocente}</div>
            <div><strong>CÉDULA:</strong> {estudianteActual?.cedula || 'S/N'}</div>
            <div className="col-span-2 uppercase font-black text-slate-950 pt-1 border-t border-slate-300 mt-1">
              <strong>ESTUDIANTE:</strong> {estudianteActual?.apellidos} {estudianteActual?.nombres}
            </div>
          </div>

          {/* TABLA PRINCIPAL DE ASIGNATURAS */}
          {!anioLectivoVigente ? (
            <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50 border border-amber-300 rounded-xl">
              ⚠️ No hay un año lectivo activo configurado en la institución para generar este reporte.
            </div>
          ) : tipoReporte !== 'Anual' ? (
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
                {asignaturasFijas.map((asig) => {
                  const reg = calificacionesEstudiante.find(c => c.asignatura.trim().toUpperCase() === asig && c.trimestre === tipoReporte)
                  const prom = Number(reg?.promedio_parcial || 0)
                  const form = Number(reg?.insumo_1 || prom)
                  const form70 = Number((form * 0.70).toFixed(2))
                  const sum = Number(reg?.evaluacion_estructurada || reg?.proyecto_interdisciplinar || prom)
                  const sum30 = Number((sum * 0.30).toFixed(2))

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
                          <td className="p-2 border border-slate-800">{form > 0 ? form.toFixed(2) : '0.00'}</td>
                          <td className="p-2 border border-slate-800">{form70 > 0 ? form70.toFixed(2) : '0.00'}</td>
                          <td className="p-2 border border-slate-800">{sum > 0 ? sum.toFixed(2) : '0.00'}</td>
                          <td className="p-2 border border-slate-800">{sum30 > 0 ? sum30.toFixed(2) : '0.00'}</td>
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
            <table className="w-full text-xs border-collapse border border-slate-800 text-slate-900 font-semibold">
              <thead>
                <tr className="bg-slate-200 text-slate-950 font-black uppercase text-[10px] text-center">
                  <th className="p-2 border border-slate-800 w-1/3" rowSpan={2}>ASIGNATURAS</th>
                  <th className="p-2 border border-slate-800" colSpan={esSuperiorOBachillerato ? 6 : 5}>PROMEDIO ANUAL ({anioLectivoVigente})</th>
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
                {asignaturasFijas.map((asig) => {
                  const regT1 = calificacionesEstudiante.find(c => c.asignatura.trim().toUpperCase() === asig && c.trimestre === 'Trimestre 1')
                  const regT2 = calificacionesEstudiante.find(c => c.asignatura.trim().toUpperCase() === asig && c.trimestre === 'Trimestre 2')
                  const regT3 = calificacionesEstudiante.find(c => c.asignatura.trim().toUpperCase() === asig && c.trimestre === 'Trimestre 3')
                  const regSupletorio = calificacionesEstudiante.find(c => c.asignatura.trim().toUpperCase() === asig && c.trimestre === 'SUPLETORIO')

                  const p1 = Number(regT1?.promedio_parcial || 0)
                  const p2 = Number(regT2?.promedio_parcial || 0)
                  const p3 = Number(regT3?.promedio_parcial || 0)
                  
                  let promAnual = Number(((p1 + p2 + p3) / (p1 && p2 && p3 ? 3 : (p1 || p2 || p3 ? 1 : 1))).toFixed(2))
                  
                  const supletorioRaw = regSupletorio?.examen_supletorio ?? regSupletorio?.ex_supletorio ?? regSupletorio?.supletorio ?? null
                  let supletorioVal = supletorioRaw !== null && supletorioRaw !== '' ? Number(supletorioRaw) : 0

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

          {/* SECCIONES COMPLEMENTARIAS */}
          <div className="grid grid-cols-2 gap-4 pt-2 font-bold text-slate-900">
            <div className="border border-slate-800 text-xs rounded-xl overflow-hidden">
              <div className="bg-slate-200 text-slate-950 p-2 font-black uppercase border-b border-slate-800 text-[10px]">ÁREAS DE DESARROLLO INTEGRAL</div>
              <div className="p-3 space-y-1.5">
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span>Acompañamiento Integral:</span>
                  <span className="font-black">
                    {tipoReporte !== 'Anual' 
                      ? (complementariosEstudiante['Acompañamiento integral']?.[tipoReporte === 'Trimestre 1' ? 't1' : tipoReporte === 'Trimestre 2' ? 't2' : 't3'] || '-')
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
                    {tipoReporte !== 'Anual' 
                      ? (complementariosEstudiante['Animación a la lectura']?.[tipoReporte === 'Trimestre 1' ? 't1' : tipoReporte === 'Trimestre 2' ? 't2' : 't3'] || '-')
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
                      {tipoReporte !== 'Anual' 
                        ? (complementariosEstudiante['Orientación vocacional']?.[tipoReporte === 'Trimestre 1' ? 't1' : tipoReporte === 'Trimestre 2' ? 't2' : 't3'] || '-')
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

          {/* FIRMAS DE RESPONSABILIDAD */}
          <div className="grid grid-cols-2 pt-12 text-center text-xs text-slate-900 font-bold">
            <div className="space-y-1">
              <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black">{nombreDocente}</div>
              <div className="font-black">DOCENTE TUTOR</div>
            </div>
            <div className="space-y-1">
              <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black">{autoridadActual.nombre}</div>
              <div className="font-black">{autoridadActual.cargo}</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}