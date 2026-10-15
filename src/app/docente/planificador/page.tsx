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

  // Selector de Tipo de Vista
  const [pestañaTipo, setPestañaTipo] = useState<'piloto' | 'regular' | 'todos'>('piloto')

  // Planificaciones Regulares (tabla 'planificaciones')
  const [planificacionesRegulares, setPlanificacionesRegulares] = useState<any[]>([])
  const [materiasDisponibles, setMateriasDisponibles] = useState<string[]>([])
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anioLectivoFiltro, setAnioLectivoFiltro] = useState<string>('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])
  const [materiasAbiertas, setMateriasAbiertas] = useState<{ [key: string]: boolean }>({})

  // Planificaciones Piloto Zona 6 (tabla 'planificaciones_microcurriculares')
  const [planificacionesPiloto, setPlanificacionesPiloto] = useState<any[]>([])

  // Modal de Detalle y Exportación
  const [planSeleccionado, setPlanSeleccionado] = useState<any | null>(null)
  const [actualizandoEstado, setActualizandoEstado] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)

  useEffect(() => {
    cargarTodoElDashboard()
  }, [])

  const cargarTodoElDashboard = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      // 1. Cargar Perfil Docente e Institución
      const { data: perfilDocente } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      let anioActivo = ''
      let periodosList: string[] = []

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
            setAnosCerrados(inst.anos_cerrados)
          }
        }
      } else {
        setDocente({ nombres: user.email?.split('@')[0] || 'Docente', apellidos: '' })
      }

      // 2. Cargar Planificaciones Regulares (Modelos 1 y 2)
      const { data: planesRegulares } = await supabase
        .from('planificaciones')
        .select('*')
        .eq('docente_id', user.id)
        .order('created_at', { ascending: false })

      if (planesRegulares) {
        setPlanificacionesRegulares(planesRegulares)

        const periodosPlanes = planesRegulares.map(p => p.anio_lectivo).filter(Boolean)
        const todosPeriodos = Array.from(new Set([...periodosList, ...periodosPlanes, ...(anioActivo ? [anioActivo] : [])])) as string[]
        setPeriodosDisponibles(todosPeriodos)

        if (!anioActivo && todosPeriodos.length > 0) {
          setAnioLectivoFiltro(todosPeriodos[0])
        }

        const materias = Array.from(new Set(planesRegulares.map((p) => p.asignatura).filter(Boolean))) as string[]
        setMateriasDisponibles(materias)

        const initialAbiertas: { [key: string]: boolean } = {}
        materias.forEach(m => { 
          initialAbiertas[`${m}-trimestral_disciplinar`] = true 
          initialAbiertas[`${m}-multigrado_eje`] = true 
        })
        setMateriasAbiertas(initialAbiertas)
      }

      // 3. Cargar Planificaciones Microcurriculares (Piloto Zona 6)
      const { data: planesPiloto } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*')
        .eq('docente_id', user.id)
        .order('created_at', { ascending: false })

      if (planesPiloto) {
        setPlanificacionesPiloto(planesPiloto)
      }

    } catch (err) {
      console.error('Error al cargar el dashboard unificado:', err)
    } finally {
      setCargando(false)
    }
  }

  // Enviar a revisión planificaciones regulares
  const handleEnviarMateriaARevision = async (materia: string, tipoModelo: string) => {
    if (anosCerrados.includes(anioLectivoFiltro)) {
      alert('Este año lectivo se encuentra cerrado. No se pueden enviar planificaciones a revisión.')
      return
    }

    const planesEnviar = planificacionesRegulares.filter(
      p => p.asignatura === materia && 
      (p.tipo_modelo || 'trimestral_disciplinar') === tipoModelo && 
      p.estado === 'borrador' &&
      (p.anio_lectivo || institucion?.anio_lectivo_activo || '') === anioLectivoFiltro
    )

    if (planesEnviar.length === 0) {
      alert('No hay planificaciones en borrador para enviar en este grupo.')
      return
    }

    if (!confirm(`¿Deseas enviar a revisión las ${planesEnviar.length} planificaciones en borrador de ${materia}?`)) return

    try {
      setActualizandoEstado(true)
      const ids = planesEnviar.map(p => p.id)

      const { error } = await supabase
        .from('planificaciones')
        .update({ estado: 'enviado_revision' })
        .in('id', ids)

      if (error) throw error

      setPlanificacionesRegulares(prev =>
        prev.map(p => ids.includes(p.id) ? { ...p, estado: 'enviado_revision' } : p)
      )
      alert('Planificaciones enviadas a revisión con éxito.')
    } catch (err: any) {
      alert('Error al enviar a revisión: ' + err.message)
    } finally {
      setActualizandoEstado(false)
    }
  }

  // Eliminar Planificación Regular
  const handleEliminarPlanRegular = async (plan: any) => {
    const anioPlan = plan.anio_lectivo || institucion?.anio_lectivo_activo || ''
    if (anosCerrados.includes(anioPlan)) {
      alert('Este año lectivo está cerrado. No se pueden eliminar registros del archivo histórico.')
      return
    }
    if (plan.estado === 'aprobado') {
      alert('Esta planificación ya ha sido aprobada y no se puede eliminar.')
      return
    }
    if (!confirm('¿Estás seguro de eliminar esta planificación? Esta acción no se puede deshacer.')) return

    try {
      const { error } = await supabase.from('planificaciones').delete().eq('id', plan.id)
      if (error) throw error

      setPlanificacionesRegulares(prev => prev.filter(p => p.id !== plan.id))
      if (planSeleccionado?.id === plan.id) setPlanSeleccionado(null)
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  // Eliminar Planificación Piloto Zona 6
  const handleEliminarPlanPiloto = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta planificación por competencias?')) return

    try {
      const { error } = await supabase.from('planificaciones_microcurriculares').delete().eq('id', id)
      if (error) throw error

      setPlanificacionesPiloto(prev => prev.filter(p => p.id !== id))
      if (planSeleccionado?.id === id) setPlanSeleccionado(null)
      alert('Planificación eliminada con éxito.')
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  const toggleGrupo = (materia: string, tipoModelo: string) => {
    const key = `${materia}-${tipoModelo}`
    setMateriasAbiertas(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const convertirLogoABase64 = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      return null
    }
  }

  // Descargar PDF para Planificaciones Piloto Zona 6
  const descargarPlanPilotoPDF = async (plan: any) => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('l', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (institucion?.logo_url) {
        logoBase64 = await convertirLogoABase64(institucion.logo_url)
      }

      const colorVerde = [218, 234, 138] as [number, number, number]
      const colorTextoOscuro = [30, 41, 59] as [number, number, number]
      const colorBlanco = [255, 255, 255] as [number, number, number]

      const bodyDatosInformativos = [
        [
          { content: '', styles: { halign: 'center' as const, cellWidth: 42, minCellHeight: 24, valign: 'middle' as const } }, 
          { content: (institucion?.nombre_institucion || 'UNIDAD EDUCATIVA').toUpperCase(), colSpan: 2, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 10, minCellHeight: 24, valign: 'middle' as const } }, 
          { content: `Año lectivo: ${institucion?.anio_lectivo_activo || '2026-2027'}`, styles: { halign: 'right' as const, fontSize: 8, minCellHeight: 24, valign: 'middle' as const } }
        ],
        [{ content: 'Planificación microcurricular por competencias (Piloto Zona 6)', colSpan: 4, styles: { fillColor: colorVerde, halign: 'center' as const, fontStyle: 'bold' as const, textColor: colorTextoOscuro } }],
        [{ content: 'Datos informativos:', colSpan: 4, styles: { fontStyle: 'bold' as const } }],
        [{ content: `Docente: ${docente?.nombres || ''} ${docente?.apellidos || ''}`, colSpan: 4 }],
        [`Asignatura: ${plan.asignatura}`, { content: `Grado/Curso: ${plan.grado_curso}`, colSpan: 2 }, `Paralelo: ${plan.paralelo}`],
        [`Trimestre: ${plan.trimestre}`, { content: `No. de semanas: ${plan.no_semanas}`, colSpan: 3 }, '', ''],
        [{ content: 'Situación de aprendizaje', colSpan: 4, styles: { fillColor: colorVerde, halign: 'center' as const, fontStyle: 'bold' as const, textColor: colorTextoOscuro } }],
        ['Título:', { content: plan.titulo_sia || 'S/T', colSpan: 3, styles: { fontStyle: 'bold' as const } }],
        ['Descripción:', { content: plan.descripcion_sia || 'S/D', colSpan: 3 }]
      ]

      autoTable(doc, {
        startY: 10,
        theme: 'grid',
        headStyles: { fillColor: colorVerde, textColor: colorTextoOscuro, fontSize: 8 },
        bodyStyles: { fontSize: 7.5, cellPadding: 2, fillColor: colorBlanco },
        body: bodyDatosInformativos,
        columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 76 }, 2: { cellWidth: 84 }, 3: { cellWidth: 67 } },
        didDrawCell: (data) => {
          if (data.row.index === 0 && data.column.index === 0 && logoBase64) {
            doc.addImage(logoBase64 as string, 'PNG', data.cell.x + 9, data.cell.y + 3, 24, 18)
          }
        }
      })

      const bodySaberes = (plan.bloques_competencias || []).flatMap((b: any) => {
        const ind = b.indicadoresSeleccionados?.length > 0 ? b.indicadoresSeleccionados.join('\n') : (b.indicadoresDisponibles?.[0] || 'N/A')
        const dec = b.declarativosSeleccionados?.length > 0 ? b.declarativosSeleccionados.join('\n') : (b.declarativosDisponibles?.[0] || 'N/A')
        const proc = b.procedimentalesSeleccionados?.length > 0 ? b.procedimentalesSeleccionados.join('\n') : (b.procedimentalesDisponibles?.[0] || 'N/A')
        const act = b.actitudinalesSeleccionados?.length > 0 ? b.actitudinalesSeleccionados.join('\n') : (b.actitudinalesDisponibles?.[0] || 'N/A')
        return [[ind, dec, proc, act]]
      })

      const tableSaberesY = (doc as any).lastAutoTable.finalY + 4
      autoTable(doc, {
        startY: tableSaberesY,
        theme: 'grid',
        head: [
          [{ content: 'Conexión interdisciplinar', colSpan: 4, styles: { fillColor: [218, 234, 138], halign: 'center' as const, fontStyle: 'bold' as const, textColor: [30, 41, 59] } }],
          [{ content: `Asignaturas / Temas: ${plan.asignaturas_conexion || 'N/A'}`, colSpan: 4, styles: { fillColor: [255, 255, 255], textColor: [30, 41, 59] } }],
          [{ content: 'Competencias específicas', colSpan: 4, styles: { fillColor: [218, 234, 138], halign: 'center' as const, fontStyle: 'bold' as const, textColor: [30, 41, 59] } }],
          [{ content: plan.competencia_especifica || 'N/A', colSpan: 4, styles: { fillColor: [255, 255, 255], textColor: [30, 41, 59] } }],
          ['Indicadores de evaluación', 'Saberes Declarativos', 'Saberes Procedimentales', 'Saberes Actitudinales']
        ],
        body: bodySaberes.length > 0 ? bodySaberes : [['Sin registros', '', '', '']],
        headStyles: { fillColor: [218, 234, 138], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7.5, halign: 'center' as const },
        styles: { fontSize: 7, cellPadding: 2, fillColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 68 }, 1: { cellWidth: 68 }, 2: { cellWidth: 68 }, 3: { cellWidth: 69 } }
      })

      const bodySemanas = (plan.semanas || []).map((sem: any) => [
        `Semana ${sem.numero} · ${sem.tema || sem.temaSemana || ''}\n\n• Inicio:\n${sem.inicio || 'S/N'}\n\n• Desarrollo:\n${sem.desarrollo || 'S/N'}\n\n• Cierre:\n${sem.cierre || 'S/N'}`,
        sem.recursos || 'Materiales del aula',
        `Técnica: ${sem.tecnica || 'Observación'}\nInstrumento: ${sem.instrumento || 'Lista de cotejo'}`
      ])

      const tableSemanasY = (doc as any).lastAutoTable.finalY + 4
      autoTable(doc, {
        startY: tableSemanasY,
        theme: 'grid',
        head: [['Estrategias metodológicas desde el DUA', 'Recursos', 'Técnicas e instrumentos de evaluación']],
        body: bodySemanas,
        headStyles: { fillColor: [218, 234, 138], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7.5, halign: 'center' as const },
        styles: { fontSize: 7, cellPadding: 2, fillColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 135 }, 1: { cellWidth: 70 }, 2: { cellWidth: 68 } }
      })

      doc.save(`Planificacion_Piloto_${plan.asignatura}_${plan.grado_curso}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF de la planificación.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Dashboard Docente e Histórico...</p>
        </div>
      </div>
    )
  }

  const esAnioCerradoActual = anosCerrados.includes(anioLectivoFiltro)

  const planesFiltradosPeriodo = planificacionesRegulares.filter(p => {
    const anioPlan = p.anio_lectivo || institucion?.anio_lectivo_activo || ''
    return anioPlan === anioLectivoFiltro
  })

  const planesModelo1 = planesFiltradosPeriodo.filter(p => (p.tipo_modelo || 'trimestral_disciplinar') === 'trimestral_disciplinar')
  const planesModelo2 = planesFiltradosPeriodo.filter(p => p.tipo_modelo === 'multigrado_eje')

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO PRINCIPAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Panel Docente • Centro de Planificaciones
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Mis Planificaciones y Archivo Histórico
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Docente: <strong className="text-slate-800">{docente?.nombres} {docente?.apellidos}</strong> • {institucion?.nombre_institucion || 'Unidad Educativa'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => router.push('/docente/planificadorpiloto')}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            + Nueva (Piloto Zona 6)
          </button>
          <button
            onClick={() => router.push('/docente/planificador/nuevo')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            + Nueva (Regular)
          </button>
          <button
            onClick={() => router.push('/docente/planificador/imprimir')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer"
          >
            Imprimir Reporte
          </button>
        </div>
      </div>

      {/* SELECTOR SUPERIOR DE PESTAÑAS PRINCIPALES */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2">
        <button
          onClick={() => setPestañaTipo('piloto')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
            pestañaTipo === 'piloto'
              ? 'bg-[#4b4c99] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
        Piloto Zona 6 por Competencias ({planificacionesPiloto.length})
        </button>
        <button
          onClick={() => setPestañaTipo('regular')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
            pestañaTipo === 'regular'
              ? 'bg-[#4b4c99] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
        Planificador Regular por Año Lectivo ({planificacionesRegulares.length})
        </button>
        <button
          onClick={() => setPestañaTipo('todos')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
            pestañaTipo === 'todos'
              ? 'bg-[#4b4c99] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Ver Todos ({planificacionesPiloto.length + planificacionesRegulares.length})
        </button>
      </div>

      {/* ================= CONTENIDO 1: PLANIFICADOR PILOTO ZONA 6 ================= */}
      {(pestañaTipo === 'piloto' || pestañaTipo === 'todos') && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              Planificaciones por Competencias (Piloto Zona 6 - DUA / ERCA)
            </h2>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
              {planificacionesPiloto.length} Guardadas
            </span>
          </div>

          {planificacionesPiloto.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <p className="text-slate-500 font-medium text-xs">
                No tienes planificaciones creadas en el nuevo formato Piloto Zona 6.
              </p>
              <button
                onClick={() => router.push('/docente/planificadorpiloto/nuevo')}
                style={{ backgroundColor: '#4b4c99' }}
                className="px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                + Crear primera planificación piloto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {planificacionesPiloto.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        ID: {plan.id.slice(0, 6)}...
                      </span>
                      <span className="bg-[#dbea8a] text-slate-800 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide border border-lime-300">
                        {plan.trimestre}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase">
                      {plan.titulo_sia || `Planificación de ${plan.asignatura}`}
                    </h3>

                    <p className="text-[11px] text-slate-600 font-medium">
                      Asignatura: <strong className="text-slate-900">{plan.asignatura}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Curso: {plan.grado_curso} (Paralelo {plan.paralelo}) • {plan.no_semanas} semanas
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Creado el: {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => router.push(`/docente/planificadorpiloto/ver?id=${plan.id}&formato=oficial`)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition text-center cursor-pointer shadow-2xs"
                    >
                      Ver y Editar
                    </button>
                    <button
                      onClick={() => router.push(`/docente/planificadorpiloto/nuevo?id=${plan.id}`)}
                      className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl transition text-center border border-amber-200 cursor-pointer shadow-2xs"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= CONTENIDO 2: PLANIFICADOR REGULAR (MODELOS 1 Y 2) ================= */}
      {(pestañaTipo === 'regular' || pestañaTipo === 'todos') && (
        <div className="space-y-6 pt-4">
          
          {/* CARPETAS / PESTAÑAS DE AÑOS LECTIVOS */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 uppercase mr-2 shrink-0">Carpetas Lectivas:</span>
            {periodosDisponibles.length === 0 ? (
              <span className="text-xs font-bold text-amber-700 italic">Sin años lectivos configurados</span>
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
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs ${
                      seleccionado
                        ? 'text-white'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    <span>Periodo {periodo}</span>
                    {esActivo && <span className="bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-lg font-bold">Actual</span>}
                    {esCerrado && <span>🔒</span>}
                  </button>
                )
              })
            )}
          </div>

          {esAnioCerradoActual && anioLectivoFiltro && (
            <div 
              style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
              className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
            >
              <span>Carpeta del año lectivo {anioLectivoFiltro} (Cerrado por la Dirección en modo solo lectura).</span>
              <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Histórico</span>
            </div>
          )}

          {planesFiltradosPeriodo.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <p className="text-slate-500 font-medium text-xs">
                No hay planificaciones regulares registradas en el periodo {anioLectivoFiltro}.
              </p>
              {!esAnioCerradoActual && (
                <button
                  onClick={() => router.push('/docente/planificador/nuevo')}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  + Crear planificación regular
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* MODELO 1: TRIMESTRAL DISCIPLINAR */}
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
                                        {esAprobado ? 'Aprobado' : estado === 'enviado_revision' ? 'En revisión' : estado === 'rechazado' ? 'Rechazado' : 'Borrador'}
                                      </span>
                                    </div>

                                    <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase">
                                      {plan.titulo_planificación || plan.tema}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium mb-2">
                                      {plan.subnivel} • {plan.grado_curso || plan.grado}
                                    </p>
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
                                      onClick={() => setPlanSeleccionado({ ...plan, origen: 'regular' })}
                                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                                    >
                                      Ver Detalle
                                    </button>

                                    {!esAprobado && !esAnioCerradoActual ? (
                                      <button
                                        onClick={() => handleEliminarPlanRegular(plan)}
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

              {/* MODELO 2: MULTIGRADO POR EJES */}
              <div className="space-y-4 pt-2">
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

                    return (
                      <div key={keyGrupo} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
                          <span 
                            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
                            className="px-3.5 py-1.5 text-xs font-bold rounded-xl uppercase tracking-wide border shadow-2xs"
                          >
                            {materia}
                          </span>
                          <button
                            onClick={() => toggleGrupo(materia, 'multigrado_eje')}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer"
                          >
                            <span>{estaAbierto ? '▲' : '▼'}</span> {estaAbierto ? 'Ocultar' : 'Mostrar'}
                          </button>
                        </div>

                        {estaAbierto && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white">
                            {planesMateria.map((plan) => (
                              <div
                                key={plan.id}
                                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                              >
                                <div>
                                  <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase">
                                    {plan.titulo_planificación || plan.tema}
                                  </h3>
                                  <p className="text-[11px] text-slate-500 font-medium">
                                    Eje: {plan.eje_tematico || 'Eje temático integrado'}
                                  </p>
                                </div>

                                <div className="space-y-2 pt-3 border-t border-slate-100">
                                  <button
                                    onClick={() => setPlanSeleccionado({ ...plan, origen: 'regular' })}
                                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                                  >
                                    Ver Detalle
                                  </button>
                                  {!esAnioCerradoActual && (
                                    <button
                                      onClick={() => handleEliminarPlanRegular(plan)}
                                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition shadow-2xs cursor-pointer"
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
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
      )}

      {/* ================= MODAL DE VISTA GENERAL (REGULARES Y PILOTO) ================= */}
      {planSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-5 shadow-2xl border border-slate-200 font-sans max-h-[90vh] overflow-y-auto">
            
            <div className="text-center border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wide">
                {institucion?.nombre_institucion || 'UNIDAD EDUCATIVA'}
              </h2>
              <p className="text-xs text-indigo-700 font-bold uppercase mt-1">
                {planSeleccionado.bloques_competencias
                  ? `Planificación Microcurricular Piloto Zona 6 (${planSeleccionado.trimestre})`
                  : `Planificación (${planSeleccionado.tipo_modelo === 'multigrado_eje' ? 'Multigrado por Ejes' : 'Trimestral Disciplinar'}) - Periodo: ${planSeleccionado.anio_lectivo || 'Actual'}`}
              </p>
              <div className="flex justify-between text-[11px] font-semibold text-slate-600 mt-3 pt-3 border-t border-slate-100">
                <span>Docente: <strong className="text-slate-900">{docente?.nombres} {docente?.apellidos}</strong></span>
                <span>Asignatura: <strong className="text-slate-900">{planSeleccionado.asignatura}</strong></span>
                <span>Grado/Curso: <strong className="text-slate-900">{planSeleccionado.grado_curso || planSeleccionado.grado}</strong></span>
              </div>
            </div>

            {/* VISTA PARA PLAN PILOTO ZONA 6 */}
            {planSeleccionado.bloques_competencias ? (
              <div className="space-y-4 text-xs text-slate-800">
                <div>
                  <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Título de la Situación de Aprendizaje:</strong>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-900">{planSeleccionado.titulo_sia || 'S/T'}</p>
                </div>
                <div>
                  <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Descripción:</strong>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 leading-relaxed">{planSeleccionado.descripcion_sia || 'S/D'}</p>
                </div>
                <div>
                  <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Competencias Específicas:</strong>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 leading-relaxed font-medium">{planSeleccionado.competencia_especifica || 'N/A'}</p>
                </div>
                <div>
                  <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Semanas Planificadas ({planSeleccionado.semanas?.length || 0}):</strong>
                  <div className="space-y-2 mt-1">
                    {planSeleccionado.semanas?.map((s: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                        <strong className="block text-indigo-700">Semana {s.numero} {s.tema ? `· ${s.tema}` : ''}</strong>
                        <p><strong>• Inicio:</strong> {s.inicio || 'S/N'}</p>
                        <p><strong>• Desarrollo:</strong> {s.desarrollo || 'S/N'}</p>
                        <p>• <strong>Cierre:</strong> {s.cierre || 'S/N'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* VISTA PARA PLANES REGULARES */
              <div className="space-y-3.5 text-xs text-slate-800">
                {planSeleccionado.observaciones_rector && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 shadow-2xs">
                    <strong className="block font-bold uppercase">Observaciones de Autoridad:</strong>
                    <p className="italic font-medium">{planSeleccionado.observaciones_rector}</p>
                  </div>
                )}
                <div>
                  <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tema / Unidad:</strong>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-semibold">{planSeleccionado.titulo_planificación || planSeleccionado.tema}</p>
                </div>
                <div>
                  <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Objetivos:</strong>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200">{planSeleccionado.objetivos_aprendizaje || planSeleccionado.objetivos || 'N/A'}</p>
                </div>
                <div>
                  <strong className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Criterios de Evaluación:</strong>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200">{planSeleccionado.criterios_evaluacion || planSeleccionado.criterios || 'N/A'}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-100 gap-2.5">
              <button
                onClick={() => setPlanSeleccionado(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                Cerrar
              </button>

              <div className="flex gap-2">
                {planSeleccionado.bloques_competencias ? (
                  <>
                    <button
                      onClick={() => router.push(`/docente/planificadorpiloto/ver?id=${planSeleccionado.id}&formato=oficial`)}
                      style={{ backgroundColor: '#4b4c99' }}
                      className="px-4 py-2.5 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Abrir Visor Web
                    </button>
                    <button
                      onClick={() => descargarPlanPilotoPDF(planSeleccionado)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Descargar PDF
                    </button>
                  </>
                ) : (
                  <>
                    {!anosCerrados.includes(planSeleccionado.anio_lectivo || '') && planSeleccionado.estado !== 'aprobado' && (
                      <button
                        onClick={() => router.push(`/docente/planificador/nuevo?id=${planSeleccionado.id}`)}
                        style={{ backgroundColor: '#4b4c99' }}
                        className="px-4 py-2.5 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Editar Plan
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}