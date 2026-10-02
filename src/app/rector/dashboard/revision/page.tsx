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
      .in('estado', ['enviado_revision', 'aprobado', 'rechazado'])
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

      setMensaje(`Planificaciones de ${grupoSeleccionado.asignatura} (${grupoSeleccionado.docenteNombre}) aprobadas correctamente.`)
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
    const key = `${docId}_${asig}_${gr}_${tMod}`

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
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#f6c358] selection:text-slate-900">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#f6c358] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Auditoría...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#f6c358] selection:text-slate-900 font-sans">
      
      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Auditoría Pedagógica
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Revisión y Aprobación de Planificaciones
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {institucion?.nombre_institucion} • <strong className="text-slate-700">{usuario?.rol}: {usuario?.nombres} {usuario?.apellidos}</strong>
          </p>
        </div>
      </div>

      {/* RUTA DE NAVEGACIÓN (BREADCRUMB) */}
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
        Panel / Auditoría / Planificaciones
      </div>

      {/* NOTIFICACIONES */}
      {mensaje && (
        <div className="p-4 rounded-2xl text-xs font-bold border shadow-2xs bg-indigo-50 text-indigo-900 border-indigo-200">
          {mensaje}
        </div>
      )}

      {/* AVISO SI EL PERIODO SELECCIONADO ESTÁ CERRADO */}
      {esAnioCerrado && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>Estás consultando el archivo histórico del periodo {anioActivoMostrado} (Cerrado y Bloqueado). Las planificaciones se encuentran en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Modo Archivo</span>
        </div>
      )}

      {/* PANEL DE FILTROS DE CLASIFICACIÓN */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Clasificación y Filtros de Búsqueda</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año Lectivo (Histórico)</label>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
            >
              <option value="Todos" className="text-slate-900 font-bold bg-white">Todos los Periodos</option>
              {periodosDisponibles.map((per) => (
                <option key={per} value={per} className="text-slate-900 font-bold bg-white">Periodo {per} {institucion?.anos_cerrados?.includes(per) ? '(Cerrado)' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Modelo de Planificación</label>
            <select
              value={filtroModelo}
              onChange={(e: any) => setTipoModeloFiltro(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
            >
              <option value="todos" className="text-slate-900 font-bold bg-white">Todos los Modelos</option>
              <option value="trimestral_disciplinar" className="text-slate-900 font-bold bg-white">Modelo 1: Trimestral Disciplinar</option>
              <option value="multigrado_eje" className="text-slate-900 font-bold bg-white">Modelo 2: Multigrado por Eje Temático</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Filtrar por Materia</label>
            <select
              value={filtroMateria}
              onChange={(e) => setFiltroMateria(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
            >
              <option value="Todas" className="text-slate-900 font-bold bg-white">Todas las Materias</option>
              {materiasDisponibles.map((m) => (
                <option key={m} value={m} className="text-slate-900 font-bold bg-white">{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Clasificar por Subnivel (Modelo 2)</label>
            <select
              value={filtroSubnivel}
              onChange={(e) => setFiltroSubnivel(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
            >
              <option value="Todos" className="text-slate-900 font-bold bg-white">Todos los Subniveles</option>
              <option value="Básica Elemental" className="text-slate-900 font-bold bg-white">Básica Elemental</option>
              <option value="Básica Media" className="text-slate-900 font-bold bg-white">Básica Media</option>
              <option value="Básica Superior" className="text-slate-900 font-bold bg-white">Básica Superior</option>
              <option value="Bachillerato" className="text-slate-900 font-bold bg-white">Bachillerato</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Clasificar por Año EGB (Modelo 1)</label>
            <select
              value={filtroGrado}
              onChange={(e) => setFiltroGrado(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
            >
              <option value="Todos" className="text-slate-900 font-bold bg-white">Todos los Años de Básica</option>
              <option value="2do" className="text-slate-900 font-bold bg-white">2do Grado EGB</option>
              <option value="3ro" className="text-slate-900 font-bold bg-white">3ro Grado EGB</option>
              <option value="4to" className="text-slate-900 font-bold bg-white">4to Grado EGB</option>
              <option value="5to" className="text-slate-900 font-bold bg-white">5to Grado EGB</option>
              <option value="6to" className="text-slate-900 font-bold bg-white">6to Grado EGB</option>
              <option value="7mo" className="text-slate-900 font-bold bg-white">7mo Grado EGB</option>
              <option value="8vo" className="text-slate-900 font-bold bg-white">8vo EGB</option>
              <option value="9no" className="text-slate-900 font-bold bg-white">9no EGB</option>
              <option value="10mo" className="text-slate-900 font-bold bg-white">10mo EGB</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLA DE GRUPOS DE PLANIFICACIONES */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-200">
            <tr>
              <th className="p-3">Docente</th>
              <th className="p-3">Asignatura / Materia</th>
              <th className="p-3">Modelo / Año</th>
              <th className="p-3 text-center">Cant. Planificaciones</th>
              <th className="p-3 text-center">Estado del Paquete</th>
              <th className="p-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {gruposAgrupados.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
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
                  <tr key={grupo.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-800">{grupo.docenteNombre}</td>
                    <td className="p-3 font-bold text-slate-900 uppercase">{grupo.asignatura}</td>
                    <td className="p-3 text-slate-600 font-semibold">
                      <span 
                        style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
                        className="text-[10px] px-2.5 py-0.5 rounded-lg mr-1 font-bold border shadow-2xs inline-block"
                      >
                        {grupo.tipoModelo === 'multigrado_eje' ? 'Multigrado' : 'Disciplinar'}
                      </span>
                      {grupo.grado}
                    </td>
                    <td className="p-3 text-center font-bold text-[#4b4c99]">
                      {grupo.listaPlanes.length} Unidad(es)
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shadow-2xs inline-block ${
                        estadoGeneral === 'aprobado' ? 'bg-emerald-100 text-emerald-800' :
                        estadoGeneral === 'enviado_revision' ? 'bg-amber-100 text-amber-800' :
                        estadoGeneral === 'rechazado' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {estadoGeneral === 'aprobado' ? 'Aprobado' :
                         estadoGeneral === 'enviado_revision' ? 'En Revisión' :
                         estadoGeneral === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setGrupoSeleccionado(grupo)}
                        style={{ backgroundColor: '#4b4c99' }}
                        className="px-3.5 py-1.5 text-white font-bold rounded-xl transition cursor-pointer shadow-2xs text-[10px]"
                      >
                        Revisar
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE AUDITORÍA CONJUNTA */}
      {grupoSeleccionado && (() => {
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200 font-sans">
              
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Auditoría Completa de Asignatura: {grupoSeleccionado.asignatura}
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Docente Responsable: <strong className="text-slate-700">{grupoSeleccionado.docenteNombre}</strong> | Modelo: <strong className="text-[#4b4c99]">{grupoSeleccionado.tipoModelo === 'multigrado_eje' ? 'Multigrado por Eje' : 'Trimestral Disciplinar'}</strong>
                  </p>
                </div>
                <button onClick={() => setGrupoSeleccionado(null)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer text-base">✕</button>
              </div>

              {esAnioCerrado && (
                <div 
                  style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
                  className="border p-3.5 rounded-2xl text-xs font-bold shadow-2xs"
                >
                  Este periodo lectivo se encuentra Cerrado y Bloqueado. La visualización está en modo de solo lectura y las acciones están deshabilitadas.
                </div>
              )}

              <div className="space-y-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {grupoSeleccionado.listaPlanes.map((plan, idx) => {
                  const esMultigrado = plan.tipo_modelo === 'multigrado_eje'
                  const periodoPlan = plan.anio_lectivo || institucion?.anio_lectivo_activo || '2026-2027'

                  return (
                    <div key={plan.id || idx} className="space-y-2">
                      <div className="text-xs font-bold text-slate-700 uppercase bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 w-fit flex items-center gap-2 shadow-2xs">
                        <span>Unidad / Planificación #{idx + 1}: {plan.titulo_planificación || plan.tema}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] uppercase font-bold ${plan.estado === 'aprobado' ? 'bg-emerald-100 text-emerald-800' : plan.estado === 'rechazado' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          Estado: {plan.estado}
                        </span>
                      </div>

                      {!esMultigrado ? (
                        <div className="bg-white border border-slate-300 space-y-0 text-slate-900 font-sans text-xs shadow-xs p-4 rounded-2xl">
                          
                          <table className="w-full border-collapse border-b border-slate-200 text-center text-xs mb-3">
                            <tbody>
                              <tr>
                                <td className="w-1/4 border-r border-slate-200 p-2 text-center align-middle">
                                  {institucion?.logo_url ? (
                                    <img src={institucion.logo_url} alt="Logo" className="w-12 h-12 object-contain mx-auto" />
                                  ) : (
                                    <span className="font-bold text-[10px]">LOGO</span>
                                  )}
                                </td>
                                <td className="w-2/4 border-r border-slate-200 p-2 font-bold">
                                  <p className="text-sm font-black uppercase text-slate-900">{institucion?.nombre_institucion || 'UNIDAD EDUCATIVA'}</p>
                                  <p className="text-[11px] font-bold uppercase mt-1 text-slate-600">CÓDIGO AMIE: {institucion?.codigo_amie || 'N/A'}</p>
                                  <p className="text-[10px] font-bold text-[#4b4c99] mt-0.5">AÑO LECTIVO: {periodoPlan}</p>
                                </td>
                                <td className="w-1/4 p-2 text-right font-black italic text-[#4b4c99] text-xs align-middle">
                                  EL NUEVO ECUADOR
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          <div className="border-b border-slate-200 text-center font-bold text-xs uppercase py-1.5 bg-slate-50 text-slate-900 rounded-xl mb-3">
                            PLANIFICACION MICROCURRICULAR POR TRIMESTRE
                          </div>

                          <table className="w-full border-collapse border border-slate-200 text-xs mb-3 rounded-xl overflow-hidden">
                            <tbody>
                              <tr className="border-b border-slate-200">
                                <td className="w-1/2 border-r border-slate-200 px-3 py-2"><strong>SUBNIVEL:</strong> {plan.subnivel || 'Básica Elemental'}</td>
                                <td className="w-1/2 px-3 py-2"><strong>PARALELO:</strong> {plan.paralelo || 'A'}</td>
                              </tr>
                              <tr className="border-b border-slate-200">
                                <td className="w-1/2 border-r border-slate-200 px-3 py-2"><strong>DOCENTE:</strong> {grupoSeleccionado.docenteNombre}</td>
                                <td className="px-3 py-2"><strong>FECHA INICIO:</strong> {plan.fecha_inicio ? new Date(plan.fecha_inicio + 'T00:00:00').toLocaleDateString() : '--/--/----'}</td>
                              </tr>
                              <tr>
                                <td className="w-1/2 border-r border-slate-200 px-3 py-2"><strong>GRADO / CURSO:</strong> {plan.grado_curso || plan.grado}</td>
                                <td className="px-3 py-2"><strong>FECHA FIN:</strong> {plan.fecha_fin ? new Date(plan.fecha_fin + 'T00:00:00').toLocaleDateString() : '--/--/----'}</td>
                              </tr>
                            </tbody>
                          </table>

                          <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50 mb-3 text-xs">
                            <strong className="block font-bold mb-1 text-slate-900 uppercase">OBJETIVOS DE APRENDIZAJE:</strong>
                            <p className="text-slate-700">{plan.objetivos_aprendizaje || plan.objetivos || 'N/A'}</p>
                          </div>

                          <table className="w-full border-collapse border border-slate-200 text-xs rounded-xl overflow-hidden">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-900 uppercase">
                                <th className="w-1/4 border-r border-slate-200 p-2.5 text-left">DESTREZAS</th>
                                <th className="w-1/4 border-r border-slate-200 p-2.5 text-left">INDICADORES</th>
                                <th className="w-1/3 border-r border-slate-200 p-2.5 text-left">ESTRATEGIAS DUA</th>
                                <th className="w-1/6 p-2.5 text-left">EVALUACIÓN</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              <tr>
                                <td className="border-r border-slate-200 p-3 align-top">
                                  <p className="text-slate-700">{plan.criterios_evaluacion || plan.criterios || 'N/A'}</p>
                                </td>
                                <td className="border-r border-slate-200 p-3 align-top text-slate-700">
                                  {plan.indicadores_evaluacion || plan.indicadores || 'N/A'}
                                </td>
                                <td className="border-r border-slate-200 p-3 align-top font-mono whitespace-pre-wrap leading-relaxed text-slate-700 text-[11px]">
                                  {plan.estrategias_dua || 'N/A'}
                                </td>
                                <td className="p-3 align-top text-slate-700">
                                  {plan.actividades_evaluacion || plan.evaluacion || 'Rúbrica / Cuestionario'}
                                </td>
                              </tr>
                            </tbody>
                          </table>

                        </div>
                      ) : (

                        /* FORMATO MODELO 2: MULTIGRADO */
                        <div className="bg-white border border-slate-300 space-y-0 text-slate-900 font-sans text-xs shadow-xs p-4 rounded-2xl">
                          <div className="bg-amber-100/70 border border-amber-200 text-center font-bold text-xs uppercase py-2 text-amber-900 rounded-xl mb-3">
                            EJE TEMÁTICO: {plan.eje_tematico || '1. El Yo y la Identidad'}
                          </div>

                          <table className="w-full border-collapse border border-slate-200 text-xs rounded-xl overflow-hidden">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-900 uppercase text-center">
                                <th className="border-r border-slate-200 p-2.5 w-[18%] align-middle" rowSpan={2}>DESTREZAS</th>
                                <th className="border-r border-slate-200 p-1" colSpan={3}>INDICADORES DE LOGRO</th>
                                <th className="border-r border-slate-200 p-1" colSpan={3}>ORIENTACIONES (ERCA)</th>
                                <th className="p-2.5 w-[15%] align-middle" rowSpan={2}>EVALUACIÓN</th>
                              </tr>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-700 uppercase text-center">
                                <th className="border-r border-slate-200 p-1">2DO EGB</th>
                                <th className="border-r border-slate-200 p-1">3RO EGB</th>
                                <th className="border-r border-slate-200 p-1">4TO EGB</th>
                                <th className="border-r border-slate-200 p-1">2DO EGB</th>
                                <th className="border-r border-slate-200 p-1">3RO EGB</th>
                                <th className="border-r border-slate-200 p-1">4TO EGB</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              <tr>
                                <td className="border-r border-slate-200 p-2.5 align-top text-slate-700">
                                  <p>{plan.criterios_evaluacion || plan.criterios || 'N/A'}</p>
                                </td>

                                {plan.contenido_multigrado && Array.isArray(plan.contenido_multigrado) ? (
                                  <>
                                    <td className="border-r border-slate-200 p-2.5 align-top text-[10px] text-slate-700">{plan.contenido_multigrado[0]?.indicadores || 'N/A'}</td>
                                    <td className="border-r border-slate-200 p-2.5 align-top text-[10px] text-slate-700">{plan.contenido_multigrado[1]?.indicadores || 'N/A'}</td>
                                    <td className="border-r border-slate-200 p-2.5 align-top text-[10px] text-slate-700">{plan.contenido_multigrado[2]?.indicadores || 'N/A'}</td>
                                    <td className="border-r border-slate-200 p-2.5 align-top text-[10px] text-slate-700">{plan.contenido_multigrado[0]?.orientaciones || 'N/A'}</td>
                                    <td className="border-r border-slate-200 p-2.5 align-top text-[10px] text-slate-700">{plan.contenido_multigrado[1]?.orientaciones || 'N/A'}</td>
                                    <td className="border-r border-slate-200 p-2.5 align-top text-[10px] text-slate-700">{plan.contenido_multigrado[2]?.orientaciones || 'N/A'}</td>
                                  </>
                                ) : (
                                  <td colSpan={6} className="p-4 text-center italic text-slate-500">Sin desglose multigrado registrado.</td>
                                )}

                                <td className="p-2.5 align-top text-[10px] text-slate-700">
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

              <div className="flex justify-end items-center border-t border-slate-100 pt-3 gap-2.5">
                <button
                  onClick={() => setGrupoSeleccionado(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cerrar Inspección
                </button>

                <button
                  onClick={() => abrirModalRechazo(grupoSeleccionado)}
                  disabled={procesandoAccion || esAnioCerrado}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  Rechazar Paquete con Observaciones
                </button>

                <button
                  onClick={handleAprobarGrupo}
                  disabled={procesandoAccion || esAnioCerrado}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {procesandoAccion ? 'Procesando...' : `Aprobar Paquete (${grupoSeleccionado.listaPlanes.length})`}
                </button>
              </div>

            </div>
          </div>
        )
      })()}

      {/* VENTANA FLOTANTE (MODAL) PARA RECHAZO */}
      {modalRechazoAbierto && grupoSeleccionado && !esAnioCerrado && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 font-sans">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Seleccionar Planificaciones con Errores
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Marca las planificaciones específicas que necesitan corrección dentro de este paquete:
            </p>

            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-2xl p-3 space-y-1.5 bg-slate-50">
              {grupoSeleccionado.listaPlanes.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2.5 p-2 hover:bg-white rounded-xl text-xs cursor-pointer font-semibold text-slate-800 transition shadow-2xs">
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
                    className="w-4 h-4 text-[#4b4c99] rounded accent-[#4b4c99]"
                  />
                  <span className="line-clamp-1">{p.titulo_planificación || p.tema}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5 text-xs">Motivo / Observaciones del Rector/a:</label>
              <textarea
                rows={3}
                value={comentarioRechazo}
                onChange={(e) => setComentarioRechazo(e.target.value)}
                placeholder="Ej: Ajustar las destrezas y mejorar los indicadores en las unidades marcadas..."
                className="w-full p-3 border border-slate-300 rounded-2xl text-xs outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] text-slate-900 font-medium bg-slate-50 shadow-2xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                onClick={() => { setModalRechazoAbierto(false); setComentarioRechazo(''); setPlanesARechazar([]) }}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarRechazo}
                disabled={procesandoAccion || planesARechazar.length === 0}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
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