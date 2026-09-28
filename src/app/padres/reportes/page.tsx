'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ReportesAcademicoPadresPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('UNIDAD EDUCATIVA')
  const [institucionLogo, setInstitucionLogo] = useState('')

  // Control de Autoridades de la Misma Institución
  const [autoridadesDisponibles, setAutoridadesDisponibles] = useState<{ nombre: string; cargo: string }[]>([])
  const [autoridadSeleccionadaIndex, setAutoridadSeleccionadaIndex] = useState(0)

  // Control Dinámico de Años Lectivos Sincronizado con periodos_disponibles de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])

  // Lista exclusiva de hijos/representados del usuario autenticado
  const [misHijos, setMisHijos] = useState<any[]>([])
  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState('')

  // Filtros de visualización
  const [tipoReporte, setTipoReporte] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Anual'>('Trimestre 1')

  // Datos consolidados del estudiante seleccionado
  const [calificacionesEstudiante, setCalificacionesEstudiante] = useState<any[]>([])
  const [complementariosEstudiante, setComplementariosEstudiante] = useState<any>({})

  // Función para cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // 1. Carga inicial del representante y sus hijos vinculados
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return; }

        // Buscar los estudiantes asociados a este usuario en la tabla de relaciones de padres
        const { data: rels } = await supabase
          .from('estudiante_representantes')
          .select('estudiante_id, estudiantes(*, instituciones(*))')
          .eq('user_id', user.id)
          .eq('activo', true)

        if (rels && rels.length > 0) {
          // Extraer de forma segura los objetos estudiantes de cada relación
          const listaEstudiantes = rels.map((r: any) => r.estudiantes).filter(Boolean)
          setMisHijos(listaEstudiantes)

          if (listaEstudiantes.length > 0) {
            const primerHijo = listaEstudiantes[0]
            setEstudianteSeleccionadoId(primerHijo.id)
            
            const inst = primerHijo.instituciones
            if (inst) {
              setInstitucionId(primerHijo.institucion_id || '')
              setNombreInstitucion(inst.nombre_institucion || 'Unidad Educativa')
              setInstitucionLogo(inst.logo_url || '')
              
              const periodosList = inst.periodos_disponibles || []
              setPeriodosDisponibles(periodosList)

              if (inst.anio_lectivo_activo && periodosList.includes(inst.anio_lectivo_activo)) {
                setAnioLectivoVigente(inst.anio_lectivo_activo)
              } else if (periodosList.length > 0) {
                setAnioLectivoVigente(periodosList[0])
              } else {
                setAnioLectivoVigente(primerHijo.anio_lectivo || '')
              }
            }

            // Cargar autoridades de la institución del primer hijo
            if (primerHijo.institucion_id) {
              const { data: autoridadesData } = await supabase
                .from('docentes')
                .select('nombres, apellidos, rol')
                .eq('institucion_id', primerHijo.institucion_id)
                
              if (autoridadesData) {
                const filtrados = autoridadesData.filter((d: any) => {
                  const r = (d.rol || '').toLowerCase()
                  return r.includes('rector') || r.includes('vicerrector') || r.includes('director')
                })

                const listaAutoridades = filtrados.map((d: any) => ({
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
          }
        } else {
          setMisHijos([])
        }
      } catch (err) {
        console.error('Error al cargar datos del padre:', err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  // Manejar cambio dinámico del periodo
  const handleCambiarPeriodo = (nuevoAnio: string) => {
    setAnioLectivoVigente(nuevoAnio)
  }

  // 2. Cargar calificaciones y datos complementarios del hijo seleccionado
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
      compData?.forEach((item: any) => {
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

  // Detección exacta del Subnivel Educativo según el grado/curso del estudiante actual
  const estudianteActual = misHijos.find(e => e.id === estudianteSeleccionadoId)
  const gradoEstudiante = estudianteActual?.grado_curso || ''

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

  const subnivelActual = obtenerNombreSubnivel(gradoEstudiante)
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

  // Funciones de escala
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

  const handlePrint = () => {
    window.print()
  }

  // Función segura para extraer recomendaciones
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Libreta de Calificaciones...</p>
        </div>
      </div>
    )
  }

  if (misHijos.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-md text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-base font-black text-slate-900">Sin Estudiantes Vinculados</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            No se encontraron hijos o representados matriculados asociados a su cuenta de usuario. Comuníquese con la secretaría de la institución.
          </p>
          <button onClick={handleSignOut} className="px-4 py-2 bg-red-50 text-red-700 font-bold text-xs rounded-xl border">
            Cerrar Sesión 🚪
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white">
      <div className="max-w-6xl mx-auto space-y-6 print:space-y-2 print:max-w-none">

        {/* CONTROLES SUPERIORES PARA EL PADRE */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
          <div>
            <h1 className="text-xl font-black text-slate-900">Portal de Padres • Libreta de Calificaciones</h1>
            <p className="text-xs text-slate-700 font-bold">Visualice el rendimiento académico oficial de su representado.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* SELECTOR DINÁMICO DE PERIODOS */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <label className="text-[10px] font-black text-slate-700 uppercase">📅 Periodo:</label>
              <select
                value={anioLectivoVigente}
                onChange={(e) => handleCambiarPeriodo(e.target.value)}
                className="text-xs font-black text-indigo-700 bg-transparent outline-none cursor-pointer"
              >
                {periodosDisponibles.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* SELECTOR DE FIRMANTE DINÁMICO */}
            <div className="flex items-center gap-1.5 bg-slate-50 border px-3 py-1.5 rounded-xl">
              <label className="text-[10px] font-black text-slate-700 uppercase">Firma:</label>
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

            {/* BOTÓN REGRESAR AL MENÚ PADRES */}
            <button onClick={handlePrint} className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition">
              🖨️ Imprimir / Guardar PDF
            </button>
          </div>
        </div>

        {/* FILTROS DE SELECCIÓN DE HIJO Y TRIMESTRE */}
        <div className="bg-white p-4 rounded-2xl border shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
          <div>
            <label className="block text-[10px] font-black text-slate-800 uppercase mb-1">Seleccionar Representado (Hijo)</label>
            <select
              value={estudianteSeleccionadoId}
              onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50"
            >
              {misHijos.map(hijo => (
                <option key={hijo.id} value={hijo.id}>
                  {hijo.apellidos} {hijo.nombres} — {hijo.grado_curso} "{hijo.paralelo}"
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-indigo-900 uppercase mb-1">Tipo de Reporte</label>
            <select value={tipoReporte} onChange={(e: any) => setTipoReporte(e.target.value)} className="w-full p-2.5 border-2 border-indigo-500 rounded-xl text-xs font-black text-indigo-950 bg-indigo-50">
              <option value="Trimestre 1">1er Trimestre</option>
              <option value="Trimestre 2">2do Trimestre</option>
              <option value="Trimestre 3">3er Trimestre</option>
              <option value="Anual">Reporte Final (Anual)</option>
            </select>
          </div>
        </div>

        {/* DOCUMENTO OFICIAL LISTO PARA IMPRESIÓN */}
        <div className="bg-white p-8 rounded-2xl border shadow-md space-y-4 print:border-none print:shadow-none print:p-2 print:w-full text-slate-900">
          
          {/* ENCABEZADO CON LOGO INSTITUCIONAL */}
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
              <span className="text-xs font-black uppercase bg-slate-200 px-3 py-1 border border-slate-800 rounded text-slate-900">
                RENDIMIENTO ACADÉMICO - {tipoReporte.toUpperCase()} ({anioLectivoVigente || 'Sin año activo'}) {subnivelActual ? `(${subnivelActual.toUpperCase()})` : ''}
              </span>
            </div>
          </div>

          {/* DATOS INFORMATIVOS */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs border border-slate-800 p-3 bg-slate-50 rounded-lg font-bold text-slate-900">
            <div><strong>REFERENCIA:</strong> 1</div>
            <div><strong>PARALELO:</strong> {estudianteActual?.paralelo || 'N/A'}</div>
            <div><strong>GRADO/CURSO:</strong> {estudianteActual?.grado_curso || 'N/A'}</div>
            <div><strong>JORNADA:</strong> {estudianteActual?.jornada || 'MATUTINA'}</div>
            <div><strong>CÉDULA:</strong> {estudianteActual?.cedula || 'S/N'}</div>
            <div><strong>ESTADO MATRÍCULA:</strong> {estudianteActual?.estado?.toUpperCase() || 'ACTIVO'}</div>
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
                <tr className="bg-slate-300 text-slate-950 font-black uppercase text-[10px] text-center">
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
                          <td className="p-2 border border-slate-800 font-black text-indigo-950">{obtenerEscalaCuantitativaCualitativa(prom)}</td>
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
                <tr className="bg-slate-300 text-slate-950 font-black uppercase text-[10px] text-center">
                  <th className="p-2 border border-slate-800 w-1/3" rowSpan={2}>ASIGNATURAS</th>
                  <th className="p-2 border border-slate-800" colSpan={esSuperiorOBachillerato ? 6 : 5}>PROMEDIO ANUAL ({anioLectivoVigente})</th>
                </tr>
                <tr className="bg-slate-200 text-slate-950 text-[9px] text-center font-black">
                  <th className="p-1 border border-slate-800">1er TRIM</th>
                  <th className="p-1 border border-slate-800">2do TRIM</th>
                  <th className="p-1 border border-slate-800">3er TRIM</th>
                  {esSuperiorOBachillerato && <th className="p-1 border border-slate-800 bg-amber-100 font-black">SUPLETORIO</th>}
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
                        <td className="p-2 border border-slate-800 bg-amber-50 font-black">{supletorioVal > 0 ? supletorioVal.toFixed(2) : '-'}</td>
                      )}
                      <td className="p-2 border border-slate-800 font-black">{promAnual > 0 ? promAnual.toFixed(2) : '0.00'}</td>
                      <td className="p-2 border border-slate-800 font-black text-indigo-950">{obtenerEscalaCuantitativaCualitativa(promAnual)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* SECCIONES COMPLEMENTARIAS */}
          <div className="grid grid-cols-2 gap-4 pt-2 font-bold text-slate-900">
            <div className="border border-slate-800 text-xs">
              <div className="bg-slate-300 text-slate-950 p-1.5 font-black uppercase border-b border-slate-800 text-[10px]">ÁREAS DE DESARROLLO INTEGRAL</div>
              <div className="p-2 space-y-1">
                <div className="flex justify-between border-b border-slate-300 pb-1">
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
                <div className="flex justify-between border-b border-slate-300 pb-1">
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

            <div className="border border-slate-800 text-xs">
              <div className="bg-slate-300 text-slate-950 p-1.5 font-black uppercase border-b border-slate-800 text-[10px]">RECOMENDACIONES</div>
              <div className="p-2 space-y-2">
                <div className="text-[11px] pt-1">
                  <strong>Recomendación:</strong>{' '}
                  <span className="italic font-semibold">
                    {obtenerRecomendacionTexto()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* FIRMAS DE RESPONSABILIDAD INSTITUCIONALES */}
          <div className="grid grid-cols-2 pt-12 text-center text-xs text-slate-900 font-bold">
            <div className="space-y-1">
              <div className="border-t-2 border-slate-900 w-64 mx-auto pt-1 font-black">REPRESENTANTE LEGAL</div>
              <div className="font-black">PADRE / MADRE / TUTOR</div>
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