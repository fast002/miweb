'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RevisionPlanificacionesPage() {
  const router = useRouter()

  const [usuario, setUsuario] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)
  const [planificaciones, setPlanificaciones] = useState<any[]>([])

  // Filtros de Clasificación Pedagógica y Año Lectivo
  const [filtroModelo, setTipoModeloFiltro] = useState<'todos' | 'trimestral_disciplinar' | 'multigrado_eje'>('todos')
  const [filtroSubnivel, setFiltroSubnivel] = useState<string>('Todos')
  const [filtroGrado, setFiltroGrado] = useState<string>('Todos')
  const [filtroMateria, setFiltroMateria] = useState<string>('Todas')
  const [periodoFiltro, setPeriodoFiltro] = useState<string>('Todos')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])

  // Modal de Auditoría Consolidada por Materia
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<{
    docenteNombre: string
    asignatura: string
    grado: string
    subnivel: string
    tipoModelo: string
    listaPlanes: any[]
  } | null>(null)

  // Estados para el Modal de Comentarios de Rechazo y Selección de Planes
  const [modalRechazoAbierto, setModalRechazoAbierto] = useState(false)
  const [comentarioRechazo, setComentarioRechazo] = useState('')
  const [planesARechazar, setPlanesARechazar] = useState<string[]>([])

  const [procesandoAccion, setProcesandoAccion] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  // Función para cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    verificarYcargar()
  }, [])

  const verificarYcargar = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      // Verificar rol de Autoridad
      const { data: perfilDocente } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (!perfilDocente || (perfilDocente.rol !== 'rector' && perfilDocente.rol !== 'vicerrector')) {
        router.push('/')
        return
      }

      setUsuario(perfilDocente)
      setInstitucion(perfilDocente.instituciones)

      if (perfilDocente?.instituciones?.anio_lectivo_activo) {
        setPeriodoFiltro(perfilDocente.instituciones.anio_lectivo_activo)
      }

      await cargarPlanificacionesColegio(perfilDocente.institucion_id, perfilDocente.instituciones)
    } catch (err) {
      console.error('Error al cargar planificaciones:', err)
    } finally {
      setCargando(false)
    }
  }

  const cargarPlanificacionesColegio = async (instId: string, instInfo?: any) => {
    const { data: planData } = await supabase
      .from('planificaciones')
      .select('*, docentes(nombres, apellidos, email)')
      .eq('institucion_id', instId)
      .in('estado', ['enviado_revision', 'aprobado', 'rechazado']) // Muestra únicamente las enviadas a revisión o procesadas, excluyendo borradores
      .order('created_at', { ascending: true })

    if (planData) {
      setPlanificaciones(planData)
      const periodos = Array.from(new Set(planData.map((p) => p.anio_lectivo || instInfo?.anio_lectivo_activo).filter(Boolean))) as string[]
      setPeriodosDisponibles(periodos)
    }
  }

  // Aprobar todo el paquete de la materia
  const handleAprobarGrupo = async () => {
    if (!grupoSeleccionado || grupoSeleccionado.listaPlanes.length === 0) return

    try {
      setProcesandoAccion(true)
      const idsAModificar = grupoSeleccionado.listaPlanes.map((p) => p.id)

      const { error } = await supabase
        .from('planificaciones')
        .update({ 
          estado: 'aprobado',
          observaciones_rector: null 
        })
        .in('id', idsAModificar)

      if (error) throw error

      setPlanificaciones((prev) =>
        prev.map((p) =>
          idsAModificar.includes(p.id) ? { ...p, estado: 'aprobado', observaciones_rector: null } : p
        )
      )

      setMensaje(`Planificaciones de ${grupoSeleccionado.asignatura} (${grupoSeleccionado.docenteNombre}) APROBADAS ✅ correctamente.`)
      setGrupoSeleccionado(null)

      if (institucion?.id) {
        await cargarPlanificacionesColegio(institucion.id, institucion)
      }
    } catch (err: any) {
      setMensaje('Error al actualizar estado: ' + err.message)
    } finally {
      setProcesandoAccion(false)
    }
  }

  // Abrir modal de rechazo seleccionando todos por defecto
  const abrirModalRechazo = (grupo: any) => {
    setGrupoSeleccionado(grupo)
    setPlanesARechazar(grupo.listaPlanes.map((p: any) => p.id))
    setModalRechazoAbierto(true)
  }

  // Rechazar solo las planificaciones seleccionadas con Comentarios de la Autoridad
  const handleConfirmarRechazo = async () => {
    if (planesARechazar.length === 0) {
      alert('Por favor, selecciona al menos una planificación que contenga errores.')
      return
    }
    
    const textoComentario = comentarioRechazo.trim()
    
    if (!textoComentario) {
      alert('Por favor, ingresa los motivos u observaciones para la corrección.')
      return
    }

    try {
      setProcesandoAccion(true)

      const { error } = await supabase
        .from('planificaciones')
        .update({ 
          estado: 'rechazado',
          observaciones_rector: textoComentario
        })
        .in('id', planesARechazar)

      if (error) throw error

      setPlanificaciones((prev) =>
        prev.map((p) =>
          planesARechazar.includes(p.id) ? { ...p, estado: 'rechazado', observaciones_rector: textoComentario } : p
        )
      )

      setMensaje(`Se han rechazado ${planesARechazar.length} planificación(es) con observaciones enviadas al docente.`)
      setModalRechazoAbierto(false)
      setComentarioRechazo('')
      setPlanesARechazar([])
      setGrupoSeleccionado(null)

      if (institucion?.id) {
        await cargarPlanificacionesColegio(institucion.id, institucion)
      }
    } catch (err: any) {
      setMensaje('Error al rechazar: ' + err.message)
    } finally {
      setProcesandoAccion(false)
    }
  }

  // Filtrado Individual incluyendo histórico por año lectivo
  const planificacionesFiltradas = planificaciones.filter((p) => {
    const anioPlan = p.anio_lectivo || institucion?.anio_lectivo_activo || '2026-2027'
    const cumplePeriodo = periodoFiltro === 'Todos' || anioPlan === periodoFiltro
    if (!cumplePeriodo) return false

    if (filtroModelo !== 'todos' && p.tipo_modelo !== filtroModelo) return false

    if (p.tipo_modelo === 'multigrado_eje' && filtroSubnivel !== 'Todos') {
      if (p.subnivel !== filtroSubnivel) return false
    }

    if (p.tipo_modelo === 'trimestral_disciplinar' && filtroGrado !== 'Todos') {
      const gradoPlan = p.grado_curso || p.grado || ''
      if (!gradoPlan.toLowerCase().includes(filtroGrado.toLowerCase())) return false
    }

    if (filtroMateria !== 'Todas' && p.asignatura !== filtroMateria) return false

    return true
  })

  // AGRUPAMIENTO POR DOCENTE + ASIGNATURA + GRADO + MODELO
  const gruposMap = new Map<string, {
    key: string
    docenteNombre: string
    docenteId: string
    asignatura: string
    grado: string
    subnivel: string
    tipoModelo: string
    listaPlanes: any[]
  }>()

  planificacionesFiltradas.forEach((plan) => {
    const docNom = plan.docentes ? `${plan.docentes.nombres} ${plan.docentes.apellidos}` : 'Docente'
    const docId = plan.docente_id || 'doc'
    const asig = plan.asignatura || 'General'
    const gr = plan.grado_curso || plan.grado || 'General'
    const sub = plan.subnivel || 'General'
    const tMod = plan.tipo_modelo || 'trimestral_disciplinar'
    const key = `${docId}_${asig}_${gr}_${tMod}` // Separado por modelo para evitar mezclar disciplinar con multigrado

    if (!gruposMap.has(key)) {
      gruposMap.set(key, {
        key,
        docenteNombre: docNom,
        docenteId: docId,
        asignatura: asig,
        grado: gr,
        subnivel: sub,
        tipoModelo: tMod,
        listaPlanes: []
      })
    }

    gruposMap.get(key)?.listaPlanes.push(plan)
  })

  const gruposAgrupados = Array.from(gruposMap.values())
  const materiasDisponibles = Array.from(new Set(planificaciones.map((p) => p.asignatura).filter(Boolean)))

  const anioActivoMostrado = periodoFiltro === 'Todos' ? (institucion?.anio_lectivo_activo || '2026-2027') : periodoFiltro
  const esAnioCerrado = institucion?.anos_cerrados?.includes(anioActivoMostrado)

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando Módulo de Auditoría...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-md p-6 space-y-6">
        
        {/* ENCABEZADO DE LA RUTA DE REVISIÓN CON BOTÓN DE CERRAR SESIÓN */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              Módulo de Auditoría y Revisión Pedagógica por Materia 📚
            </h1>
            <p className="text-xs text-purple-700 font-bold uppercase mt-0.5">
              {usuario?.rol}: {usuario?.nombres} {usuario?.apellidos}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {institucion?.nombre_institucion}
            </p>
          </div>

          <div className="flex items-center gap-3">
          </div>
        </div>

        {/* NOTIFICACIONES */}
        {mensaje && (
          <div className="p-4 bg-purple-50 text-purple-900 rounded-xl text-sm font-bold border border-purple-200">
            {mensaje}
          </div>
        )}

        {/* AVISO SI EL PERIODO SELECCIONADO ESTÁ CERRADO */}
        {esAnioCerrado && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold flex items-center justify-between">
            <span>🔒 Estás consultando el archivo histórico del periodo {anioActivoMostrado} (Cerrado y Bloqueado). Las planificaciones se encuentran en modo de solo lectura.</span>
            <span className="bg-amber-200 px-2.5 py-1 rounded">Modo Histórico Cerrado</span>
          </div>
        )}

        {/* PANEL DE FILTROS DE CLASIFICACIÓN (INCLUYENDO HISTÓRICO) */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
          <h2 className="text-xs font-bold text-slate-700 uppercase">Clasificación y Filtros de Búsqueda:</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-1">1. Año Lectivo (Histórico):</label>
              <select
                value={periodoFiltro}
                onChange={(e) => setPeriodoFiltro(e.target.value)}
                className="w-full p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-900 outline-none"
              >
                <option value="Todos">Todos los Periodos</option>
                {periodosDisponibles.map((per) => (
                  <option key={per} value={per}>Periodo {per} {institucion?.anos_cerrados?.includes(per) ? '🔒' : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Modelo de Planificación</label>
              <select
                value={filtroModelo}
                onChange={(e: any) => setTipoModeloFiltro(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
              >
                <option value="todos">Todos los Modelos</option>
                <option value="trimestral_disciplinar">Modelo 1: Trimestral Disciplinar</option>
                <option value="multigrado_eje">Modelo 2: Multigrado por Eje Temático</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filtrar por Materia</label>
              <select
                value={filtroMateria}
                onChange={(e) => setFiltroMateria(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
              >
                <option value="Todas">Todas las Materias</option>
                {materiasDisponibles.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Clasificar por Subnivel (Modelo 2)</label>
              <select
                value={filtroSubnivel}
                onChange={(e) => setFiltroSubnivel(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
              >
                <option value="Todos">Todos los Subniveles</option>
                <option value="Básica Elemental">Básica Elemental</option>
                <option value="Básica Media">Básica Media</option>
                <option value="Básica Superior">Básica Superior</option>
                <option value="Bachillerato">Bachillerato</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Clasificar por Año EGB (Modelo 1)</label>
              <select
                value={filtroGrado}
                onChange={(e) => setFiltroGrado(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
              >
                <option value="Todos">Todos los Años de Básica</option>
                <option value="2do">2do Grado EGB</option>
                <option value="3ro">3ro Grado EGB</option>
                <option value="4to">4to Grado EGB</option>
                <option value="5to">5to Grado EGB</option>
                <option value="6to">6to Grado EGB</option>
                <option value="7mo">7mo Grado EGB</option>
                <option value="8vo">8vo Grado EGB</option>
                <option value="9no">9no Grado EGB</option>
                <option value="10mo">10mo Grado EGB</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABLA DE GRUPOS DE PLANIFICACIONES POR MATERIA Y DOCENTE */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b">
              <tr>
                <th className="p-3">Docente</th>
                <th className="p-3">Asignatura / Materia</th>
                <th className="p-3">Modelo / Año</th>
                <th className="p-3 text-center">Cant. Planificaciones</th>
                <th className="p-3 text-center">Estado del Paquete</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {gruposAgrupados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500 font-medium">
                    No se encontraron paquetes enviados a revisión con los filtros y periodo seleccionados.
                  </td>
                </tr>
              ) : (
                gruposAgrupados.map((grupo) => {
                  const todosAprobados = grupo.listaPlanes.every((p) => p.estado === 'aprobado')
                  const algunRevision = grupo.listaPlanes.some((p) => p.estado === 'enviado_revision')
                  const algunRechazado = grupo.listaPlanes.some((p) => p.estado === 'rechazado')

                  const estadoGeneral = todosAprobados
                    ? 'aprobado'
                    : algunRevision
                    ? 'enviado_revision'
                    : algunRechazado
                    ? 'rechazado'
                    : 'enviado_revision'

                  return (
                    <tr key={grupo.key} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{grupo.docenteNombre}</td>
                      <td className="p-3 text-slate-700 font-extrabold uppercase">{grupo.asignatura}</td>
                      <td className="p-3 text-slate-600 font-semibold">
                        <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded mr-1 font-bold">
                          {grupo.tipoModelo === 'multigrado_eje' ? 'Multigrado' : 'Disciplinar'}
                        </span>
                        {grupo.grado}
                      </td>
                      <td className="p-3 text-center font-bold text-blue-700">
                        {grupo.listaPlanes.length} Unidad(es)
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          estadoGeneral === 'aprobado' ? 'bg-emerald-100 text-emerald-800' :
                          estadoGeneral === 'enviado_revision' ? 'bg-amber-100 text-amber-800' :
                          estadoGeneral === 'rechazado' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {estadoGeneral === 'aprobado' ? 'Aprobado' :
                           estadoGeneral === 'enviado_revision' ? 'En Revisión' :
                           estadoGeneral === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setGrupoSeleccionado(grupo)}
                          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition shadow text-xs"
                        >
                          👁️ Revisar
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* MODAL DE AUDITORÍA CON EL FORMATO EXACTO Y COHERENTE AL MODELO DE LA PLANIFICACIÓN */}
      {grupoSeleccionado && (() => {
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-5xl w-full p-4 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
              
              {/* CABECERA DEL MODAL */}
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase">
                    Auditoría Completa de Asignatura: {grupoSeleccionado.asignatura}
                  </h2>
                  <p className="text-xs text-purple-700 font-bold uppercase mt-0.5">
                    Docente Responsable: {grupoSeleccionado.docenteNombre} | Modelo: {grupoSeleccionado.tipoModelo === 'multigrado_eje' ? 'Multigrado por Eje' : 'Trimestral Disciplinar'}
                  </p>
                </div>
                <button 
                  onClick={() => setGrupoSeleccionado(null)} 
                  className="text-slate-400 hover:text-slate-700 text-2xl font-bold px-2"
                >
                  ✕
                </button>
              </div>

              {/* AVISO SI EL AÑO ESTÁ CERRADO */}
              {esAnioCerrado && (
                <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2">
                  <span>🔒</span>
                  <span>Este periodo lectivo se encuentra <strong>Cerrado y Bloqueado</strong>. La visualización está en modo de solo lectura y las acciones de aprobación/rechazo están deshabilitadas.</span>
                </div>
              )}

              {/* DOCUMENTOS RENDERIZADOS SEGÚN EL MODELO EXACTO DE LA PLANIFICACIÓN */}
              <div className="space-y-8 bg-slate-100 p-3 sm:p-6 rounded-xl border border-slate-300">
                {grupoSeleccionado.listaPlanes.map((plan, idx) => {
                  const esMultigrado = plan.tipo_modelo === 'multigrado_eje'
                  const periodoPlan = plan.anio_lectivo || institucion?.anio_lectivo_activo || '2026-2027'

                  return (
                    <div key={plan.id || idx} className="space-y-2">
                      <div className="text-xs font-bold text-slate-700 uppercase bg-slate-200 px-3 py-1 rounded-lg w-fit flex items-center gap-2">
                        <span>Unidad / Planificación #{idx + 1}: {plan.titulo_planificación || plan.tema}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${plan.estado === 'aprobado' ? 'bg-emerald-200 text-emerald-900' : plan.estado === 'rechazado' ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'}`}>
                          Estado: {plan.estado}
                        </span>
                      </div>

                      {!esMultigrado ? (
                        <div className="bg-white border border-black space-y-0 text-black font-sans text-xs shadow-sm p-4">
                          
                          {/* ENCABEZADO INSTITUCIONAL REAL MODELO 1 */}
                          <table className="w-full border-collapse border-b border-black text-center text-xs">
                            <tbody>
                              <tr>
                                <td className="w-1/4 border-r border-black p-2 text-center align-middle">
                                  {institucion?.logo_url ? (
                                    <img src={institucion.logo_url} alt="Logo" className="w-12 h-12 object-contain mx-auto" />
                                  ) : (
                                    <span className="font-bold text-[10px]">LOGO</span>
                                  )}
                                </td>
                                <td className="w-2/4 border-r border-black p-2 font-bold">
                                  <p className="text-sm font-black uppercase">{institucion?.nombre_institucion || 'UNIDAD EDUCATIVA'}</p>
                                  <p className="text-[11px] font-bold uppercase mt-1">CÓDIGO AMIE: {institucion?.codigo_amie || 'N/A'}</p>
                                  <p className="text-[10px] font-semibold text-blue-900 mt-0.5">AÑO LECTIVO: {periodoPlan}</p>
                                </td>
                                <td className="w-1/4 p-2 text-right font-black italic text-blue-900 text-sm align-middle">
                                  EL NUEVO ECUADOR
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          <div className="border-b border-black text-center font-black text-sm uppercase py-1 bg-slate-100 text-blue-900">
                            PLANIFICACION MICROCURRICULAR POR TRIMESTRE
                          </div>

                          <div className="border-b border-black font-bold uppercase text-[10px] px-2 py-0.5 bg-slate-100">
                            DATOS INFORMATIVOS:
                          </div>
                          <table className="w-full border-collapse border-b border-black text-xs">
                            <tbody>
                              <tr className="border-b border-black">
                                <td className="w-1/2 border-r border-black px-2 py-1"><strong>SUBNIVEL:</strong> {plan.subnivel || 'Básica Elemental'}</td>
                                <td className="w-1/2 px-2 py-1"><strong>PARALELO:</strong> {plan.paralelo || 'A'}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="w-1/2 border-r border-black px-2 py-1"><strong>DOCENTE:</strong> {grupoSeleccionado.docenteNombre}</td>
                                <td className="px-2 py-1"><strong>FECHA INICIO:</strong> {plan.fecha_inicio ? new Date(plan.fecha_inicio + 'T00:00:00').toLocaleDateString() : '--/--/----'}</td>
                              </tr>
                              <tr>
                                <td className="w-1/2 border-r border-black px-2 py-1"><strong>GRADO / CURSO:</strong> {plan.grado_curso || plan.grado}</td>
                                <td className="px-2 py-1"><strong>FECHA FIN:</strong> {plan.fecha_fin ? new Date(plan.fecha_fin + 'T00:00:00').toLocaleDateString() : '--/--/----'}</td>
                              </tr>
                            </tbody>
                          </table>

                          {/* COMPETENCIAS E INSERCIONES CURRICULARES */}
                          <table className="w-full border-collapse border-b border-black text-xs">
                            <thead>
                              <tr className="bg-blue-200 border-b border-black text-[10px] font-bold text-slate-900 uppercase">
                                <th className="w-1/2 border-r border-black p-1 text-left">COMPETENCIAS DEL CURRICULO PRIORIZADO</th>
                                <th className="w-1/2 p-1 text-left">INSERCIONES CURRICULARES</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border-r border-black p-2 align-top text-[11px] space-y-2">
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/comunicacional@8x.png")} alt="Comunicacional" className="w-5 h-5 object-contain" />
                                    <span><strong>Competencia comunicacional</strong></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/matematica@8x.png")} alt="Matemática" className="w-5 h-5 object-contain" />
                                    <span><strong>Competencia matemática</strong></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/digital@8x.png")} alt="Digital" className="w-5 h-5 object-contain" />
                                    <span><strong>Competencia digital</strong></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/socioemovionales@8x.png")} alt="Socioemocional" className="w-5 h-5 object-contain" />
                                    <span><strong>Competencia socioemocional</strong></span>
                                  </div>
                                </td>

                                <td className="p-2 align-top text-[11px] space-y-2">
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/civica@8x.png")} alt="Cívica y Ética" className="w-5 h-5 object-contain" />
                                    <span><strong>Educación Cívica, Ética e integral</strong></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/sostenible@8x.png")} alt="Desarrollo Sostenible" className="w-5 h-5 object-contain" />
                                    <span><strong>Educación para el Desarrollo Sostenible</strong></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/socioemocional@8x.png")} alt="Socioemocional" className="w-5 h-5 object-contain" />
                                    <span><strong>Educación Socioemocional</strong></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/financiera@8x.png")} alt="Financiera" className="w-5 h-5 object-contain" />
                                    <span><strong>Educación Financiera</strong></span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <img src={encodeURI("/iconos/vial@8x.png")} alt="Seguridad Vial" className="w-5 h-5 object-contain" />
                                    <span><strong>Educación para la Seguridad Vial y Movilidad Sostenible</strong></span>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          <div className="border-b border-black text-center font-bold text-xs uppercase py-1 bg-slate-100">
                            APRENDIZAJE DISCIPLINAR
                          </div>
                          <div className="border-b border-black px-2 py-1 font-bold bg-blue-200 text-xs">
                            ASIGNATURA: {plan.asignatura?.toUpperCase()}
                          </div>
                          <div className="border-b border-black p-2 text-xs">
                            <strong className="block font-bold mb-1">OBJETIVOS DE APRENDIZAJE:</strong>
                            <p>{plan.objetivos_aprendizaje || plan.objetivos || 'N/A'}</p>
                          </div>

                          {/* MATRIZ PEDAGÓGICA MODELO 1 */}
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-blue-200 border-b border-black text-[10px] font-bold text-slate-900 uppercase">
                                <th className="w-1/4 border-r border-black p-2 text-left">DESTREZAS CON CRITERIOS DE DESEMPEÑO</th>
                                <th className="w-1/4 border-r border-black p-2 text-left">INDICADORES DE EVALUACIÓN</th>
                                <th className="w-1/3 border-r border-black p-2 text-left">ESTRATEGIAS METODOLÓGICAS ACTIVAS</th>
                                <th className="w-1/6 p-2 text-left">ACTIVIDADES EVALUATIVAS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black">
                              <tr>
                                <td className="border-r border-black p-2 align-top space-y-3">
                                  <p>{plan.criterios_evaluacion || plan.criterios || 'N/A'}</p>
                                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Trabaja con:</span>
                                    <div className="flex items-center gap-1.5">
                                      <img src={encodeURI("/iconos/comunicacional@8x.png")} alt="Comunicacional" className="w-5 h-5 object-contain" />
                                      <img src={encodeURI("/iconos/socioemocional@8x.png")} alt="Socioemocional" className="w-5 h-5 object-contain" />
                                      <img src={encodeURI("/iconos/vial@8x.png")} alt="Seguridad Vial" className="w-5 h-5 object-contain" />
                                    </div>
                                  </div>
                                </td>
                                <td className="border-r border-black p-2 align-top">
                                  {plan.indicadores_evaluacion || plan.indicadores || 'N/A'}
                                </td>
                                <td className="border-r border-black p-2 align-top font-mono whitespace-pre-wrap leading-relaxed">
                                  {plan.estrategias_dua || 'N/A'}
                                </td>
                                <td className="p-2 align-top">
                                  <p className="font-bold mb-1">TÉCNICA:</p>
                                  <p className="mb-2">Observación / Prueba</p>
                                  <p className="font-bold mb-1">INSTRUMENTO:</p>
                                  <p>{plan.actividades_evaluacion || plan.evaluacion || 'Rúbrica / Cuestionario'}</p>
                                </td>
                              </tr>
                            </tbody>
                          </table>

                        </div>
                      ) : (

                        /* FORMATO MODELO 2: MULTIGRADO (IDÉNTICO A LA VISTA DE IMPRESIÓN CON 7 COLUMNAS) */
                        <div className="bg-white border border-black space-y-0 text-black font-sans text-xs shadow-sm p-4">
                          <table className="w-full border-collapse border-b border-black text-xs">
                            <tbody>
                              <tr>
                                <td className="w-1/4 border-r border-black p-2 text-center align-middle">
                                  {institucion?.logo_url ? (
                                    <img src={institucion.logo_url} alt="Logo" className="w-12 h-12 object-contain mx-auto" />
                                  ) : (
                                    <span className="font-bold text-[10px]">LOGO</span>
                                  )}
                                </td>
                                <td className="w-3/4 p-2 text-right">
                                  <p className="text-lg font-black uppercase text-blue-900">MINISTERIO DE EDUCACIÓN</p>
                                  <p className="text-xs font-bold uppercase">PLANIFICACIÓN MICROCURRICULAR - MULTIGRADO</p>
                                  <p className="text-[10px] font-semibold text-blue-900 mt-0.5">AÑO LECTIVO: {periodoPlan}</p>
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          <div className="bg-amber-200 border-b border-black text-center font-black text-xs uppercase py-1 text-slate-900">
                            EJE TEMÁTICO: {plan.eje_tematico || '1. El Yo y la Identidad'}
                          </div>

                          <table className="w-full border-collapse text-xs border-black">
                            <thead>
                              <tr className="bg-blue-100 border-b border-black text-[10px] font-bold text-slate-900 uppercase text-center">
                                <th className="border-r border-black p-2 w-[18%] align-middle" rowSpan={2}>
                                  DESTREZAS CON CRITERIOS DE DESEMPEÑO
                                </th>
                                <th className="border-r border-black p-1" colSpan={3}>
                                  INDICADORES DE EVALUACIÓN Y/O LOGRO
                                </th>
                                <th className="border-r border-black p-1" colSpan={3}>
                                  ORIENTACIONES METODOLÓGICAS (ERCA)
                                </th>
                                <th className="p-2 w-[15%] align-middle" rowSpan={2}>
                                  ACTIVIDADES EVALUATIVAS
                                </th>
                              </tr>
                              <tr className="bg-blue-200 border-b border-black text-[9px] font-bold text-slate-900 uppercase text-center">
                                <th className="border-r border-black p-1 w-[12%]">2DO GRADO EGB</th>
                                <th className="border-r border-black p-1 w-[12%]">3RO GRADO EGB</th>
                                <th className="border-r border-black p-1 w-[12%]">4TO GRADO EGB</th>
                                <th className="border-r border-black p-1 w-[10%]">2DO GRADO EGB</th>
                                <th className="border-r border-black p-1 w-[10%]">3RO GRADO EGB</th>
                                <th className="border-r border-black p-1 w-[10%]">4TO GRADO EGB</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border-r border-black p-2 align-top text-[11px] space-y-3">
                                  <p>{plan.criterios_evaluacion || plan.criterios || 'N/A'}</p>
                                  <div className="pt-2 border-t border-slate-200 text-[10px] font-bold text-slate-600">
                                    Subnivel: {plan.subnivel || 'Básica Media'} | Paralelo: {plan.paralelo || 'A'}
                                  </div>
                                </td>

                                {plan.contenido_multigrado && Array.isArray(plan.contenido_multigrado) ? (
                                  <>
                                    <td className="border-r border-black p-2 align-top text-[10px]">
                                      {plan.contenido_multigrado[0]?.indicadores || 'N/A'}
                                    </td>
                                    <td className="border-r border-black p-2 align-top text-[10px]">
                                      {plan.contenido_multigrado[1]?.indicadores || 'N/A'}
                                    </td>
                                    <td className="border-r border-black p-2 align-top text-[10px]">
                                      {plan.contenido_multigrado[2]?.indicadores || 'N/A'}
                                    </td>
                                    <td className="border-r border-black p-2 align-top text-[10px]">
                                      {plan.contenido_multigrado[0]?.orientaciones || 'N/A'}
                                    </td>
                                    <td className="border-r border-black p-2 align-top text-[10px]">
                                      {plan.contenido_multigrado[1]?.orientaciones || 'N/A'}
                                    </td>
                                    <td className="border-r border-black p-2 align-top text-[10px]">
                                      {plan.contenido_multigrado[2]?.orientaciones || 'N/A'}
                                    </td>
                                  </>
                                ) : (
                                  <td colSpan={6} className="p-4 text-center italic">Sin desglose multigrado registrado.</td>
                                )}

                                <td className="p-2 align-top text-[10px]">
                                  {plan.actividades_evaluacion || plan.evaluacion || 'N/A'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  )
                })}
              </div>

              {/* BOTONES RESOLUTIVOS DE RECTORADO (BLOQUEADOS SI EL AÑO ESTÁ CERRADO) */}
              <div className="flex justify-between items-center border-t pt-4 gap-2">
                <button
                  onClick={() => setGrupoSeleccionado(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
                >
                  Cerrar Inspección
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => abrirModalRechazo(grupoSeleccionado)}
                    disabled={procesandoAccion || esAnioCerrado}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
                  >
                    ❌ Rechazar Paquete con Observaciones
                  </button>

                  <button
                    onClick={handleAprobarGrupo}
                    disabled={procesandoAccion || esAnioCerrado}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
                  >
                    ✅ Aprobar Paquete ({grupoSeleccionado.listaPlanes.length})
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      })()}

      {/* VENTANA FLOTANTE (MODAL) PARA SELECCIONAR PLANES Y ESCRIBIR COMENTARIOS DE RECHAZO */}
      {modalRechazoAbierto && grupoSeleccionado && !esAnioCerrado && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <h3 className="text-base font-black text-slate-900 uppercase">
              ⚠️ Seleccionar Planificaciones con Errores
            </h3>
            <p className="text-xs text-slate-600">
              Marca las planificaciones específicas que necesitan corrección dentro de este paquete:
            </p>

            {/* LISTA DE CHECKBOXES PARA SELECCIÓN RÁPIDA */}
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
              {grupoSeleccionado.listaPlanes.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg text-xs cursor-pointer font-medium text-slate-800">
                  <input 
                    type="checkbox" 
                    checked={planesARechazar.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPlanesARechazar([...planesARechazar, p.id])
                      } else {
                        setPlanesARechazar(planesARechazar.filter(id => id !== p.id))
                      }
                    }}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="line-clamp-1">{p.titulo_planificación || p.tema}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Motivo / Observaciones del Rector/a:</label>
              <textarea
                rows={3}
                value={comentarioRechazo}
                onChange={(e) => setComentarioRechazo(e.target.value)}
                placeholder="Ej: Ajustar las destrezas y mejorar los indicadores en las unidades marcadas..."
                className="w-full p-3 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500 text-slate-800 font-medium"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setModalRechazoAbierto(false); setComentarioRechazo(''); setPlanesARechazar([]) }}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarRechazo}
                disabled={procesandoAccion || planesARechazar.length === 0}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-50"
              >
                {procesandoAccion ? 'Enviando...' : `Confirmar Rechazo (${planesARechazar.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}