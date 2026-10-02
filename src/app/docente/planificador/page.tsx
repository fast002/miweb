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
      alert('Este año lectivo se encuentra cerrado. No se pueden enviar planificaciones a revisión.')
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
      alert('Planificaciones enviadas a revisión con éxito.')
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
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Dashboard Docente e Histórico...</p>
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

  const periodoActivoMostrar = institucion?.anio_lectivo_activo && institucion.periodos_disponibles?.includes(institucion.anio_lectivo_activo)
    ? institucion.anio_lectivo_activo 
    : (institucion?.periodos_disponibles?.[0] || 'Sin año activo')

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO PRINCIPAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Panel Docente • Archivo Histórico
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Mis Planificaciones y Archivo Histórico
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Bienvenido, @{docente?.nombres} {docente?.apellidos} • <strong className="text-slate-700">{institucion?.nombre_institucion || 'Unidad Educativa'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!esAnioCerradoActual && anioLectivoFiltro && (
            <button
              onClick={() => router.push('/docente/planificador/nuevo')}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              + Nueva Planificación
            </button>
          )}

          <button
            onClick={() => router.push('/docente/planificador/imprimir')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer"
          >
            Imprimir Reporte
          </button>
        </div>
      </div>

      {/* CARPETAS / PESTAÑAS DE AÑOS LECTIVOS */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 uppercase mr-2 shrink-0">Carpetas Lectivas:</span>
        {periodosDisponibles.length === 0 ? (
          <span className="text-xs font-bold text-amber-700 italic">Sin años lectivos creados por la Dirección</span>
        ) : (
          periodosDisponibles.map((periodo) => {
            const esActivo = periodo === (institucion?.anio_lectivo_activo || '')
            const esCerrado = anosCerrados.includes(periodo)
            const seleccionado = periodo === anioLectivoFiltro

            return (
              <button
                key={periodo}
                onClick={() => setAnioLectivoFiltro(periodo)}
                style={seleccionado ? { backgroundColor: '#4b4c99' } : {}}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs ${
                  seleccionado
                    ? 'text-white'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                <span></span>
                <span>Periodo {periodo}</span>
                {esActivo && <span className="bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-lg font-bold">Actual</span>}
                {esCerrado && <span>🔒</span>}
              </button>
            )
          })
        )}
      </div>

      {/* AVISO SI NO HAY AÑO ACTIVO EN LA INSTITUCIÓN */}
      {!anioLectivoFiltro && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {/* AVISO SI LA CARPETA ACTUAL ESTÁ CERRADA */}
      {esAnioCerradoActual && anioLectivoFiltro && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>Estás visualizando la carpeta del año lectivo {anioLectivoFiltro} (Cerrado y Bloqueado por la Dirección). Se encuentra en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Archivo Histórico</span>
        </div>
      )}

      {!anioLectivoFiltro ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 shadow-xs">
          <p className="text-slate-500 font-medium text-xs">
            No hay un periodo lectivo seleccionado para mostrar planificaciones.
          </p>
        </div>
      ) : planesFiltradosPeriodo.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <p className="text-slate-500 font-medium text-xs">
            No hay planificaciones registradas en el periodo {anioLectivoFiltro}.
          </p>
          {!esAnioCerradoActual && (
            <button
              onClick={() => router.push('/docente/planificador/nuevo')}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-4 py-2.5 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
            >
              + Crear planificación para este periodo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* ================= SECCIÓN MODELO 1: TRIMESTRAL DISCIPLINAR ================= */}
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Modelo 1: Trimestral Disciplinar ({anioLectivoFiltro})
              </h2>
              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {planesModelo1.length} Registros
              </span>
            </div>

            {planesModelo1.length === 0 ? (
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs text-center text-xs text-slate-400 font-medium">
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
                  <div key={keyGrupo} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                    
                    <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-3.5">
                        <span 
                          style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
                          className="px-3.5 py-1.5 text-xs font-bold rounded-xl uppercase tracking-wide border shadow-2xs"
                        >
                          {materia}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {planesMateria.length} {planesMateria.length === 1 ? 'Planificación' : 'Planificaciones'}
                        </span>
                        <button
                          onClick={() => toggleGrupo(materia, 'trimestral_disciplinar')}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>{estaAbierto ? '▲' : '▼'}</span> {estaAbierto ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>

                      {hayBorradores && !esAnioCerradoActual && (
                        <button
                          onClick={() => handleEnviarMateriaARevision(materia, 'trimestral_disciplinar')}
                          disabled={actualizandoEstado}
                          className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 shadow-2xs transition cursor-pointer"
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
                              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                            >
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                                    ID: {plan.id.slice(0, 6)}...
                                  </span>

                                  <span
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-2xs inline-block ${
                                      esAprobado
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : estado === 'enviado_revision'
                                        ? 'bg-amber-100 text-amber-800'
                                        : estado === 'rechazado'
                                        ? 'bg-rose-100 text-rose-800'
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

                                <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase">
                                  {plan.titulo_planificación || plan.tema}
                                </h3>

                                <p className="text-[11px] text-slate-500 font-medium mb-2">
                                  {plan.subnivel} • {plan.grado_curso || plan.grado}
                                </p>

                                {tieneObservacion && (
                                  <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] text-rose-900 shadow-2xs">
                                    <strong className="block font-bold">Observaciones:</strong>
                                    <p className="italic line-clamp-2 font-medium">{plan.observaciones_rector}</p>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2 pt-3 border-t border-slate-100">
                                {!esAprobado && !esAnioCerradoActual && (estado === 'borrador' || estado === 'rechazado') && (
                                  <button
                                    onClick={() => router.push(`/docente/planificador/nuevo?id=${plan.id}`)}
                                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition shadow-2xs cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                )}

                                <button
                                  onClick={() => setPlanSeleccionado(plan)}
                                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                                >
                                  Ver Detalle
                                </button>

                                {!esAprobado && !esAnioCerradoActual ? (
                                  <button
                                    onClick={() => handleEliminarPlan(plan)}
                                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition shadow-2xs cursor-pointer"
                                  >
                                    Eliminar
                                  </button>
                                ) : (
                                  <div className="text-center py-2 text-[10px] font-bold text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs">
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
            <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Modelo 2: Multigrado por Ejes Temáticos ({anioLectivoFiltro})
              </h2>
              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {planesModelo2.length} Registros
              </span>
            </div>

            {planesModelo2.length === 0 ? (
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs text-center text-xs text-slate-400 font-medium">
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
                  <div key={keyGrupo} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                    
                    <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-3.5">
                        <span 
                          style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
                          className="px-3.5 py-1.5 text-xs font-bold rounded-xl uppercase tracking-wide border shadow-2xs"
                        >
                          {materia}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {planesMateria.length} {planesMateria.length === 1 ? 'Planificación' : 'Planificaciones'}
                        </span>
                        <button
                          onClick={() => toggleGrupo(materia, 'multigrado_eje')}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>{estaAbierto ? '▲' : '▼'}</span> {estaAbierto ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>

                      {hayBorradores && !esAnioCerradoActual && (
                        <button
                          onClick={() => handleEnviarMateriaARevision(materia, 'multigrado_eje')}
                          disabled={actualizandoEstado}
                          className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 shadow-2xs transition cursor-pointer"
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
                              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                            >
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                                    ID: {plan.id.slice(0, 6)}...
                                  </span>

                                  <span
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-2xs inline-block ${
                                      esAprobado
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : estado === 'enviado_revision'
                                        ? 'bg-amber-100 text-amber-800'
                                        : estado === 'rechazado'
                                        ? 'bg-rose-100 text-rose-800'
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

                                <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase">
                                  {plan.titulo_planificación || plan.tema}
                                </h3>

                                <p className="text-[11px] text-slate-500 font-medium mb-2">
                                  {plan.subnivel} • {plan.grado_curso || plan.grado}
                                </p>

                                {tieneObservacion && (
                                  <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] text-rose-900 shadow-2xs">
                                    <strong className="block font-bold">Observaciones:</strong>
                                    <p className="italic line-clamp-2 font-medium">{plan.observaciones_rector}</p>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2 pt-3 border-t border-slate-100">
                                {!esAprobado && !esAnioCerradoActual && (estado === 'borrador' || estado === 'rechazado') && (
                                  <button
                                    onClick={() => router.push(`/docente/planificador/nuevo?id=${plan.id}`)}
                                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition shadow-2xs cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                )}

                                <button
                                  onClick={() => setPlanSeleccionado(plan)}
                                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                                >
                                  Ver Detalle
                                </button>

                                {!esAprobado && !esAnioCerradoActual ? (
                                  <button
                                    onClick={() => handleEliminarPlan(plan)}
                                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition shadow-2xs cursor-pointer"
                                  >
                                    Eliminar
                                  </button>
                                ) : (
                                  <div className="text-center py-2 text-[10px] font-bold text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs">
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

      {/* MODAL DE VISTA GENERAL CON OBSERVACIONES */}
      {planSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans max-h-[90vh] overflow-y-auto">
            
            <div className="text-center border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wide">
                {institucion?.nombre_institucion || 'UNIDAD EDUCATIVA'}
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                PLANIFICACIÓN MICROCURRICULAR ({planSeleccionado.tipo_modelo === 'multigrado_eje' ? 'Multigrado por Ejes' : 'Trimestral Disciplinar'}) - Periodo: {planSeleccionado.anio_lectivo || 'Sin año activo'}
              </p>
              <div className="flex justify-between text-[11px] font-semibold text-slate-600 mt-3 pt-3 border-t border-slate-100">
                <span>Docente: <strong className="text-slate-900">{docente?.nombres} {docente?.apellidos}</strong></span>
                <span>Asignatura: <strong className="text-slate-900">{planSeleccionado.asignatura}</strong></span>
                <span>Grado: <strong className="text-slate-900">{planSeleccionado.grado_curso || planSeleccionado.grado}</strong></span>
              </div>
            </div>

            {planSeleccionado.observaciones_rector && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1 shadow-2xs">
                <strong className="block font-bold uppercase">Observaciones / Sugerencias de Autoridad:</strong>
                <p className="whitespace-pre-wrap font-medium">{planSeleccionado.observaciones_rector}</p>
              </div>
            )}

            <div className="space-y-3.5 text-xs text-slate-800">
              <div>
                <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Tema / Unidad Didáctica:</strong>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-900">{planSeleccionado.titulo_planificación || planSeleccionado.tema}</p>
              </div>

              <div>
                <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Objetivos de Aprendizaje:</strong>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-800">{planSeleccionado.objetivos_aprendizaje || planSeleccionado.objetivos || 'N/A'}</p>
              </div>

              <div>
                <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Criterios de Evaluación:</strong>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-800">{planSeleccionado.criterios_evaluacion || planSeleccionado.criterios || 'N/A'}</p>
              </div>

              {planSeleccionado.tipo_modelo === 'trimestral_disciplinar' && (
                <>
                  <div>
                    <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Indicadores de Evaluación:</strong>
                    <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-800">{planSeleccionado.indicadores_evaluacion || planSeleccionado.indicadores || 'N/A'}</p>
                  </div>
                  <div>
                    <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Estrategias Metodológicas (DUA / ERCA):</strong>
                    <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono whitespace-pre-wrap text-slate-800">{planSeleccionado.estrategias_dua || 'N/Y'}</p>
                  </div>
                </>
              )}

              <div>
                <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Actividades e Instrumentos de Evaluación:</strong>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-800">{planSeleccionado.actividades_evaluacion || planSeleccionado.evaluacion || 'N/A'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100 gap-2.5">
              <button
                onClick={() => setPlanSeleccionado(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                Cerrar Vista
              </button>

              <div className="flex gap-2">
                {planSeleccionado.estado !== 'aprobado' && !anosCerrados.includes(planSeleccionado.anio_lectivo || '') && (planSeleccionado.estado === 'borrador' || planSeleccionado.estado === 'rechazado') && (
                  <button
                    onClick={() => router.push(`/docente/planificador/nuevo?id=${planSeleccionado.id}`)}
                    style={{ backgroundColor: '#4b4c99' }}
                    className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                  >
                    Editar Plan
                  </button>
                )}

                {planSeleccionado.estado !== 'aprobado' && !anosCerrados.includes(planSeleccionado.anio_lectivo || '') ? (
                  <button
                    onClick={() => handleEliminarPlan(planSeleccionado)}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    Eliminar
                  </button>
                ) : (
                  <span className="px-3 py-2.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center shadow-2xs">
                    Bloqueado ({anosCerrados.includes(planSeleccionado.anio_lectivo || '') ? 'Periodo Cerrado' : 'Aprobado'})
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