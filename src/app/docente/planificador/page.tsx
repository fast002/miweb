'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DashboardDocentePage() {
  const router = useRouter()

  // Datos del Perfil Docente
  const [cargando, setCargando] = useState(true)
  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)

  // Planificaciones y Años Lectivos
  const [planificaciones, setPlanificaciones] = useState<any[]>([])
  const [materiasDisponibles, setMateriasDisponibles] = useState<string[]>([])
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anioLectivoFiltro, setAnioLectivoFiltro] = useState<string>('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])
  
  // Control de grupos desplegables por materia y por modelo
  const [materiasAbiertas, setMateriasAbiertas] = useState<{ [key: string]: boolean }>({})
  
  // Modal de Detalle
  const [planSeleccionado, setPlanSeleccionado] = useState<any | null>(null)
  const [actualizandoEstado, setActualizandoEstado] = useState(false)

  useEffect(() => {
    cargarPerfilYPlanificaciones()
  }, [])

  const cargarPerfilYPlanificaciones = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      // 1. Cargar datos del docente e institución
      const { data: perfilDocente } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      let anioActivo = ''
      let periodosList: string[] = []
      let cerradosList: string[] = []

      if (perfilDocente) {
        setDocente(perfilDocente)
        setInstitucion(perfilDocente.instituciones)

        const inst = perfilDocente.instituciones
        if (inst) {
          // Tomar los años estrictamente de periodos_disponibles de la institución
          periodosList = inst.periodos_disponibles || []
          setPeriodosDisponibles(periodosList)

          if (inst.anio_lectivo_activo && periodosList.includes(inst.anio_lectivo_activo)) {
            anioActivo = inst.anio_lectivo_activo
          } else if (periodosList.length > 0) {
            anioActivo = periodosList[0]
          }

          setAnioLectivoFiltro(anioActivo)

          if (inst.anos_cerrados && Array.isArray(inst.anos_cerrados)) {
            cerradosList = inst.anos_cerrados
            setAnosCerrados(cerradosList)
          }
        }
      } else {
        setDocente({ nombres: user.email?.split('@')[0] || 'Docente', apellidos: '' })
      }

      // 2. Cargar planificaciones de este docente
      const { data: planes, error } = await supabase
        .from('planificaciones')
        .select('*')
        .eq('docente_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && planes) {
        setPlanificaciones(planes)

        // Extraer periodos únicos presentes en las planificaciones + los de la institución
        const periodosPlanes = planes.map(p => p.anio_lectivo).filter(Boolean)
        const todosPeriodos = Array.from(new Set([...periodosList, ...periodosPlanes, ...(anioActivo ? [anioActivo] : [])])) as string[]
        setPeriodosDisponibles(todosPeriodos)

        if (!anioActivo && todosPeriodos.length > 0) {
          anioActivo = todosPeriodos[0]
          setAnioLectivoFiltro(anioActivo)
        }

        const materias = Array.from(
          new Set(planes.map((p) => p.asignatura).filter(Boolean))
        ) as string[]

        setMateriasDisponibles(materias)

        // Inicializar todas las materias y modelos abiertos por defecto
        const initialAbiertas: { [key: string]: boolean } = {}
        materias.forEach(m => { 
          initialAbiertas[`${m}-trimestral_disciplinar`] = true 
          initialAbiertas[`${m}-multigrado_eje`] = true 
        })
        setMateriasAbiertas(initialAbiertas)
      }
    } catch (err) {
      console.error('Error al cargar dashboard:', err)
    } finally {
      setCargando(false)
    }
  }

  // Enviar a revisión todas las planificaciones en borrador de una materia y modelo específicos
  const handleEnviarMateriaARevision = async (materia: string, tipoModelo: string) => {
    if (anosCerrados.includes(anioLectivoFiltro)) {
      alert('🔒 Este año lectivo se encuentra cerrado. No se pueden enviar planificaciones a revisión.')
      return
    }

    const planesEnviar = planificaciones.filter(
      p => p.asignatura === materia && 
      (p.tipo_modelo || 'trimestral_disciplinar') === tipoModelo && 
      p.estado === 'borrador' &&
      (p.anio_lectivo || institucion?.anio_lectivo_activo || '') === anioLectivoFiltro
    )

    if (planesEnviar.length === 0) {
      alert('No hay planificaciones en borrador para enviar en este grupo.')
      return
    }

    if (!confirm(`¿Deseas enviar a revisión las ${planesEnviar.length} planificaciones en borrador de ${materia} para el periodo ${anioLectivoFiltro}?`)) {
      return
    }

    try {
      setActualizandoEstado(true)
      const ids = planesEnviar.map(p => p.id)

      const { error } = await supabase
        .from('planificaciones')
        .update({ estado: 'enviado_revision' })
        .in('id', ids)

      if (error) throw error

      setPlanificaciones(prev =>
        prev.map(p => ids.includes(p.id) ? { ...p, estado: 'enviado_revision' } : p)
      )
      if (planSeleccionado && ids.includes(planSeleccionado.id)) {
        setPlanSeleccionado({ ...planSeleccionado, estado: 'enviado_revision' })
      }
      alert('¡Planificaciones enviadas a revisión con éxito!')
    } catch (err: any) {
      alert('Error al enviar a revisión: ' + err.message)
    } finally {
      setActualizandoEstado(false)
    }
  }

  // Eliminar Planificación (Bloqueado si está aprobado o año cerrado)
  const handleEliminarPlan = async (plan: any) => {
    const anioPlan = plan.anio_lectivo || institucion?.anio_lectivo_activo || ''
    if (anosCerrados.includes(anioPlan)) {
      alert('Este año lectivo está cerrado. No se pueden eliminar registros del archivo histórico.')
      return
    }

    if (plan.estado === 'aprobado') {
      alert('Esta planificación ya ha sido aprobada por el rector y no se puede eliminar.')
      return
    }

    if (!confirm('¿Estás seguro de eliminar esta planificación? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('planificaciones')
        .delete()
        .eq('id', plan.id)

      if (error) throw error

      setPlanificaciones(prev => prev.filter(p => p.id !== plan.id))
      if (planSeleccionado?.id === plan.id) {
        setPlanSeleccionado(null)
      }
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  // Cierre de Sesión
  const handleCerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Alternar apertura de grupo por materia y modelo
  const toggleGrupo = (materia: string, tipoModelo: string) => {
    const key = `${materia}-${tipoModelo}`
    setMateriasAbiertas(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando Dashboard Docente e Histórico...</p>
        </div>
      </div>
    )
  }

  const esAnioCerradoActual = anosCerrados.includes(anioLectivoFiltro)

  // Filtrar planificaciones del docente por el año lectivo seleccionado en las pestañas
  const planesFiltradosPeriodo = planificaciones.filter(p => {
    const anioPlan = p.anio_lectivo || institucion?.anio_lectivo_activo || ''
    return anioPlan === anioLectivoFiltro
  })

  const planesModelo1 = planesFiltradosPeriodo.filter(p => (p.tipo_modelo || 'trimestral_disciplinar') === 'trimestral_disciplinar')
  const planesModelo2 = planesFiltradosPeriodo.filter(p => p.tipo_modelo === 'multigrado_eje')

  // Obtener de forma segura el periodo activo configurado por el rector
  const periodoActivoMostrar = institucion?.anio_lectivo_activo && institucion.periodos_disponibles?.includes(institucion.anio_lectivo_activo)
    ? institucion.anio_lectivo_activo 
    : (institucion?.periodos_disponibles?.[0] || 'Sin año activo')

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      
      <div className="print:hidden max-w-6xl mx-auto space-y-6">

        {/* ENCABEZADO PRINCIPAL */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              Mis Planificaciones y Archivo Histórico
            </h1>
            <p className="text-sm font-bold text-blue-700 mt-1">
              Bienvenido, @{docente?.nombres} {docente?.apellidos}
            </p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs font-semibold text-slate-600">
              <span className="bg-slate-100 px-3 py-1 rounded-full border">
                Institución: <strong className="text-slate-800">{institucion?.nombre_institucion || 'Unidad Educativa'}</strong>
              </span>
              <span className="bg-slate-100 px-3 py-1 rounded-full border">
                Periodo Activo: <strong className="text-indigo-700">{periodoActivoMostrar}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">

            {!esAnioCerradoActual && anioLectivoFiltro && (
              <button
                onClick={() => router.push('/docente/planificador/nuevo')}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                ✨ Nueva Planificación
              </button>
            )}

            <button
              onClick={() => router.push('/docente/planificador/imprimir')}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {/* CARPETAS / PESTAÑAS DE AÑOS LECTIVOS (HISTÓRICO Y VIGENTE) */}
        <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 uppercase mr-2 shrink-0">Carpetas Lectivas:</span>
          {periodosDisponibles.length === 0 ? (
            <span className="text-xs font-bold text-amber-600 italic">Sin años lectivos creados por la Dirección</span>
          ) : (
            periodosDisponibles.map((periodo) => {
              const esActivo = periodo === (institucion?.anio_lectivo_activo || '')
              const esCerrado = anosCerrados.includes(periodo)
              const seleccionado = periodo === anioLectivoFiltro

              return (
                <button
                  key={periodo}
                  onClick={() => setAnioLectivoFiltro(periodo)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 ${
                    seleccionado
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border'
                  }`}
                >
                  <span>{esActivo ? '📂' : '📁'}</span>
                  <span>Periodo {periodo}</span>
                  {esActivo && <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">Actual</span>}
                  {esCerrado && <span>🔒</span>}
                </button>
              )
            })
          )}
        </div>

        {/* AVISO SI NO HAY AÑO ACTIVO EN LA INSTITUCIÓN */}
        {!anioLectivoFiltro && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold">
            La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
          </div>
        )}

        {/* AVISO SI LA CARPETA ACTUAL ESTÁ CERRADA */}
        {esAnioCerradoActual && anioLectivoFiltro && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold flex items-center justify-between">
            <span>Estás visualizando la carpeta del año lectivo {anioLectivoFiltro} (Cerrado y Bloqueado por la Dirección). Se encuentra en modo de solo lectura.</span>
            <span className="bg-amber-200 px-2.5 py-1 rounded">Archivo Histórico</span>
          </div>
        )}

        {!anioLectivoFiltro ? (
          <div className="bg-white p-12 text-center rounded-2xl border">
            <p className="text-slate-500 font-medium text-sm">
              No hay un periodo lectivo seleccionado para mostrar planificaciones.
            </p>
          </div>
        ) : planesFiltradosPeriodo.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border">
            <p className="text-slate-500 font-medium text-sm">
              No hay planificaciones registradas en el periodo {anioLectivoFiltro}.
            </p>
            {!esAnioCerradoActual && (
              <button
                onClick={() => router.push('/docente/planificador/nuevo')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
              >
                + Crear planificación para este periodo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* ================= SECCIÓN MODELO 1: TRIMESTRAL DISCIPLINAR ================= */}
            <div className="space-y-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span></span> Modelo 1: Trimestral Disciplinar ({anioLectivoFiltro})
                </h2>
                <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-lg">
                  {planesModelo1.length} Registros
                </span>
              </div>

              {planesModelo1.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border text-center text-xs text-slate-400">
                  No hay planificaciones en el Modelo 1 para este periodo.
                </div>
              ) : (
                materiasDisponibles.map((materia) => {
                  const planesMateria = planesModelo1.filter((p) => p.asignatura === materia)
                  if (planesMateria.length === 0) return null

                  const keyGrupo = `${materia}-trimestral_disciplinar`
                  const estaAbierto = materiasAbiertas[keyGrupo]
                  const hayBorradores = planesMateria.some(p => p.estado === 'borrador')

                  return (
                    <div key={keyGrupo} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                      
                      <div className="p-4 bg-white border-b flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => toggleGrupo(materia, 'trimestral_disciplinar')}
                            className="px-3.5 py-1.5 bg-[#3B5998] hover:bg-[#2d4373] text-white text-xs font-black rounded-lg uppercase tracking-wider shadow-xs transition"
                          >
                            {materia}
                          </button>
                          <span className="text-xs font-bold text-slate-600">
                            {planesMateria.length} {planesMateria.length === 1 ? 'Planificación' : 'Planificaciones'}
                          </span>
                          <button
                            onClick={() => toggleGrupo(materia, 'trimestral_disciplinar')}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
                          >
                            <span>{estaAbierto ? '▲' : '▼'}</span> {estaAbierto ? 'Ocultar' : 'Mostrar'}
                          </button>
                        </div>

                        {hayBorradores && !esAnioCerradoActual && (
                          <button
                            onClick={() => handleEnviarMateriaARevision(materia, 'trimestral_disciplinar')}
                            disabled={actualizandoEstado}
                            className="px-6 py-2 bg-[#FFF3CD] hover:bg-[#ffe69c] text-[#856404] font-black text-xs rounded-full border border-[#FFEEBA] shadow-xs transition"
                          >
                            Enviar a revisión
                          </button>
                        )}
                      </div>

                      {estaAbierto && (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white">
                          {planesMateria.map((plan) => {
                            const estado = plan.estado || 'borrador'
                            const tieneObservacion = Boolean(plan.observaciones_rector)
                            const esAprobado = estado === 'aprobado'

                            return (
                              <div
                                key={plan.id}
                                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow transition flex flex-col justify-between space-y-4"
                              >
                                <div>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[11px] font-bold text-slate-400">
                                      ID: {plan.id.slice(0, 6)}...
                                    </span>

                                    <span
                                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                                        esAprobado
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : estado === 'enviado_revision'
                                          ? 'bg-[#FFF3CD] text-[#856404] border border-[#FFEEBA]'
                                          : estado === 'rechazado'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {esAprobado
                                        ? 'Aprobado'
                                        : estado === 'enviado_revision'
                                        ? 'En revisión'
                                        : estado === 'rechazado'
                                        ? 'Rechazado'
                                        : 'Borrador'}
                                    </span>
                                  </div>

                                  <h3 className="font-bold text-slate-900 text-base mb-1 line-clamp-2">
                                    {plan.titulo_planificación || plan.tema}
                                  </h3>

                                  <p className="text-xs text-slate-500 mb-2">
                                    {plan.subnivel} • {plan.grado_curso || plan.grado}
                                  </p>

                                  {tieneObservacion && (
                                    <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-900">
                                      <strong className="block font-bold">Observaciones:</strong>
                                      <p className="italic line-clamp-2">{plan.observaciones_rector}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                  {!esAprobado && !esAnioCerradoActual && (estado === 'borrador' || estado === 'rechazado') && (
                                    <button
                                      onClick={() => router.push(`/docente/planificador/nuevo?id=${plan.id}`)}
                                      className="w-full py-2.5 bg-[#FFF3CD] hover:bg-[#ffe69c] text-[#856404] font-black text-xs rounded-xl border border-[#FFEEBA] transition shadow-xs"
                                    >
                                      Editar
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setPlanSeleccionado(plan)}
                                    className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition shadow-2xs flex items-center justify-center gap-1.5"
                                  >
                                    <span></span> Ver Detalle
                                  </button>

                                  {!esAprobado && !esAnioCerradoActual ? (
                                    <button
                                      onClick={() => handleEliminarPlan(plan)}
                                      className="w-full py-2 bg-[#F8D7DA] hover:bg-[#f5c6cb] text-[#721C24] font-bold text-xs rounded-xl border border-[#F5C6CB] transition flex items-center justify-center gap-1.5"
                                    >
                                      <span></span> Eliminar
                                    </button>
                                  ) : (
                                    <div className="text-center py-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                                      Bloqueado ({esAnioCerradoActual ? 'Periodo Cerrado' : 'Aprobado'})
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                    </div>
                  )
                })
              )}
            </div>

            {/* ================= SECCIÓN MODELO 2: MULTIGRADO POR EJES ================= */}
            <div className="space-y-4 pt-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span></span> Modelo 2: Multigrado por Ejes Temáticos ({anioLectivoFiltro})
                </h2>
                <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-lg">
                  {planesModelo2.length} Registros
                </span>
              </div>

              {planesModelo2.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border text-center text-xs text-slate-400">
                  No hay planificaciones en el Modelo 2 para este periodo.
                </div>
              ) : (
                materiasDisponibles.map((materia) => {
                  const planesMateria = planesModelo2.filter((p) => p.asignatura === materia)
                  if (planesMateria.length === 0) return null

                  const keyGrupo = `${materia}-multigrado_eje`
                  const estaAbierto = materiasAbiertas[keyGrupo]
                  const hayBorradores = planesMateria.some(p => p.estado === 'borrador')

                  return (
                    <div key={keyGrupo} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                      
                      <div className="p-4 bg-white border-b flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => toggleGrupo(materia, 'multigrado_eje')}
                            className="px-3.5 py-1.5 bg-[#3B5998] hover:bg-[#2d4373] text-white text-xs font-black rounded-lg uppercase tracking-wider shadow-xs transition"
                          >
                            {materia}
                          </button>
                          <span className="text-xs font-bold text-slate-600">
                            {planesMateria.length} {planesMateria.length === 1 ? 'Planificación' : 'Planificaciones'}
                          </span>
                          <button
                            onClick={() => toggleGrupo(materia, 'multigrado_eje')}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
                          >
                            <span>{estaAbierto ? '▲' : '▼'}</span> {estaAbierto ? 'Ocultar' : 'Mostrar'}
                          </button>
                        </div>

                        {hayBorradores && !esAnioCerradoActual && (
                          <button
                            onClick={() => handleEnviarMateriaARevision(materia, 'multigrado_eje')}
                            disabled={actualizandoEstado}
                            className="px-6 py-2 bg-[#FFF3CD] hover:bg-[#ffe69c] text-[#856404] font-black text-xs rounded-full border border-[#FFEEBA] shadow-xs transition"
                          >
                            Enviar a revisión
                          </button>
                        )}
                      </div>

                      {estaAbierto && (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white">
                          {planesMateria.map((plan) => {
                            const estado = plan.estado || 'borrador'
                            const tieneObservacion = Boolean(plan.observaciones_rector)
                            const esAprobado = estado === 'aprobado'

                            return (
                              <div
                                key={plan.id}
                                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow transition flex flex-col justify-between space-y-4"
                              >
                                <div>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[11px] font-bold text-slate-400">
                                      ID: {plan.id.slice(0, 6)}...
                                    </span>

                                    <span
                                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                                        esAprobado
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : estado === 'enviado_revision'
                                          ? 'bg-[#FFF3CD] text-[#856404] border border-[#FFEEBA]'
                                          : estado === 'rechazado'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {esAprobado
                                        ? 'Aprobado'
                                        : estado === 'enviado_revision'
                                        ? 'En revisión'
                                        : estado === 'rechazado'
                                        ? 'Rechazado'
                                        : 'Borrador'}
                                    </span>
                                  </div>

                                  <h3 className="font-bold text-slate-900 text-base mb-1 line-clamp-2">
                                    {plan.titulo_planificación || plan.tema}
                                  </h3>

                                  <p className="text-xs text-slate-500 mb-2">
                                    {plan.subnivel} • {plan.grado_curso || plan.grado}
                                  </p>

                                  {tieneObservacion && (
                                    <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-900">
                                      <strong className="block font-bold">Observaciones:</strong>
                                      <p className="italic line-clamp-2">{plan.observaciones_rector}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                  {!esAprobado && !esAnioCerradoActual && (estado === 'borrador' || estado === 'rechazado') && (
                                    <button
                                      onClick={() => router.push(`/planificador/nuevo?id=${plan.id}`)}
                                      className="w-full py-2.5 bg-[#FFF3CD] hover:bg-[#ffe69c] text-[#856404] font-black text-xs rounded-xl border border-[#FFEEBA] transition shadow-xs"
                                    >
                                      Editar
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setPlanSeleccionado(plan)}
                                    className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition shadow-2xs flex items-center justify-center gap-1.5"
                                  >
                                    <span></span> Ver Detalle
                                  </button>

                                  {!esAprobado && !esAnioCerradoActual ? (
                                    <button
                                      onClick={() => handleEliminarPlan(plan)}
                                      className="w-full py-2 bg-[#F8D7DA] hover:bg-[#f5c6cb] text-[#721C24] font-bold text-xs rounded-xl border border-[#F5C6CB] transition flex items-center justify-center gap-1.5"
                                    >
                                      <span>🗑️</span> Eliminar
                                    </button>
                                  ) : (
                                    <div className="text-center py-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                                      Bloqueado ({esAnioCerradoActual ? 'Periodo Cerrado' : 'Aprobado'})
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                    </div>
                  )
                })
              )}
            </div>

          </div>
        )}
      </div>

      {/* MODAL DE VISTA GENERAL CON OBSERVACIONES */}
      {planSeleccionado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 space-y-6 shadow-2xl">
            
            <div className="text-center border-b pb-4">
              <h2 className="text-xl font-bold uppercase text-slate-900">
                {institucion?.nombre_institucion || 'UNIDAD EDUCATIVA'}
              </h2>
              <p className="text-xs text-slate-600 font-semibold uppercase">
                PLANIFICACIÓN MICROCURRICULAR ({planSeleccionado.tipo_modelo === 'multigrado_eje' ? 'Multigrado por Ejes' : 'Trimestral Disciplinar'}) - Periodo: {planSeleccionado.anio_lectivo || 'Sin año activo'}
              </p>
              <div className="flex justify-between text-[11px] text-slate-500 mt-3 pt-2 border-t">
                <span>Docente: <strong>{docente?.nombres} {docente?.apellidos}</strong></span>
                <span>Asignatura: <strong>{planSeleccionado.asignatura}</strong></span>
                <span>Grado: <strong>{planSeleccionado.grado_curso || planSeleccionado.grado}</strong></span>
              </div>
            </div>

            {planSeleccionado.observaciones_rector && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 space-y-1">
                <strong className="block font-bold uppercase">Observaciones / Sugerencias de Autoridad:</strong>
                <p className="whitespace-pre-wrap">{planSeleccionado.observaciones_rector}</p>
              </div>
            )}

            <div className="space-y-4 text-xs text-slate-800">
              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tema / Unidad Didáctica:</strong>
                <p className="p-3 bg-slate-50 rounded-lg border font-semibold">{planSeleccionado.titulo_planificación || planSeleccionado.tema}</p>
              </div>

              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Objetivos de Aprendizaje:</strong>
                <p className="p-3 bg-slate-50 rounded-lg border">{planSeleccionado.objetivos_aprendizaje || planSeleccionado.objetivos || 'N/A'}</p>
              </div>

              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Criterios de Evaluación:</strong>
                <p className="p-3 bg-slate-50 rounded-lg border">{planSeleccionado.criterios_evaluacion || planSeleccionado.criterios || 'N/A'}</p>
              </div>

              {planSeleccionado.tipo_modelo === 'trimestral_disciplinar' && (
                <>
                  <div>
                    <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Indicadores de Evaluación:</strong>
                    <p className="p-3 bg-slate-50 rounded-lg border">{planSeleccionado.indicadores_evaluacion || planSeleccionado.indicadores || 'N/A'}</p>
                  </div>
                  <div>
                    <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Estrategias Metodológicas (DUA / ERCA):</strong>
                    <p className="p-3 bg-slate-50 rounded-lg border font-mono whitespace-pre-wrap">{planSeleccionado.estrategias_dua || 'N/Y'}</p>
                  </div>
                </>
              )}

              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Actividades e Instrumentos de Evaluación:</strong>
                <p className="p-3 bg-slate-50 rounded-lg border">{planSeleccionado.actividades_evaluacion || planSeleccionado.evaluacion || 'N/A'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <button
                onClick={() => setPlanSeleccionado(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
              >
                Cerrar Vista
              </button>

              <div className="flex gap-2">
                {planSeleccionado.estado !== 'aprobado' && !anosCerrados.includes(planSeleccionado.anio_lectivo || '') && (planSeleccionado.estado === 'borrador' || planSeleccionado.estado === 'rechazado') && (
                  <button
                    onClick={() => router.push(`/docente/planificador/nuevo?id=${planSeleccionado.id}`)}
                    className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
                  >
                    Editar Plan
                  </button>
                )}

                {planSeleccionado.estado !== 'aprobado' && !anosCerrados.includes(planSeleccionado.anio_lectivo || '') ? (
                  <button
                    onClick={() => handleEliminarPlan(planSeleccionado)}
                    className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition"
                  >
                    Eliminar
                  </button>
                ) : (
                  <span className="px-3 py-2 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center">
                    Bloqueado (Aprobado o Cerrado)
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}