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

  // Selector de Tipo de Vista (Ahora con pestaña exclusiva 'proyectos')
  const [pestañaTipo, setPestañaTipo] = useState<'proyectos' | 'piloto' | 'regular' | 'todos'>('proyectos')

  // Proyectos Interdisciplinares (tabla 'planificaciones_microcurriculares' con asignatura = 'PROYECTO INTERDISCIPLINAR')
  const [proyectosInterdisciplinares, setProyectosInterdisciplinares] = useState<any[]>([])

  // Planificaciones Piloto Zona 6 (tabla 'planificaciones_microcurriculares' regulares de materia)
  const [planificacionesPiloto, setPlanificacionesPiloto] = useState<any[]>([])

  // Planificaciones Regulares (tabla 'planificaciones')
  const [planificacionesRegulares, setPlanificacionesRegulares] = useState<any[]>([])
  const [materiasDisponibles, setMateriasDisponibles] = useState<string[]>([])
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anioLectivoFiltro, setAnioLectivoFiltro] = useState<string>('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])
  const [materiasAbiertas, setMateriasAbiertas] = useState<{ [key: string]: boolean }>({})

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

      // 2. Cargar Planificaciones Microcurriculares y dividir Proyectos vs Piloto
      const { data: microcurriculares } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*')
        .eq('docente_id', user.id)
        .order('created_at', { ascending: false })

      if (microcurriculares) {
        // Filtrar Proyectos Interdisciplinares
        const proyectos = microcurriculares.filter(
          (p: any) => p.asignatura === 'PROYECTO INTERDISCIPLINAR'
        )
        setProyectosInterdisciplinares(proyectos)

        // Filtrar Planificaciones Piloto de materias individuales
        const piloto = microcurriculares.filter(
          (p: any) => p.asignatura !== 'PROYECTO INTERDISCIPLINAR'
        )
        setPlanificacionesPiloto(piloto)
      }

      // 3. Cargar Planificaciones Regulares (Modelos 1 y 2)
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

    } catch (err) {
      console.error('Error al cargar el dashboard unificado:', err)
    } finally {
      setCargando(false)
    }
  }

  // Eliminar Proyecto Interdisciplinar
  const handleEliminarProyecto = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este Proyecto Interdisciplinar? Esta acción no se puede deshacer.')) return

    try {
      const { error } = await supabase
        .from('planificaciones_microcurriculares')
        .delete()
        .eq('id', id)

      if (error) throw error

      setProyectosInterdisciplinares(prev => prev.filter(p => p.id !== id))
      alert('Proyecto interdisciplinar eliminado correctamente.')
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  // Eliminar Planificación Piloto Zona 6
  const handleEliminarPlanPiloto = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta planificación por competencias?')) return

    try {
      const { error } = await supabase
        .from('planificaciones_microcurriculares')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPlanificacionesPiloto(prev => prev.filter(p => p.id !== id))
      if (planSeleccionado?.id === id) setPlanSeleccionado(null)
      alert('Planificación eliminada con éxito.')
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
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

  const descargarPlanPilotoPDF = async (plan: any) => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('l', 'mm', 'a4')

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
        `Semana ${sem.numero} · ${sem.tema || sem.temaSemana || ''}\n\nInicio:\n${sem.inicio || 'S/N'}\n\nDesarrollo:\n${sem.desarrollo || 'S/N'}\n\nCierre:\n${sem.cierre || 'S/N'}`,
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

  const totalGlobal = proyectosInterdisciplinares.length + planificacionesPiloto.length + planificacionesRegulares.length

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
            Mis Planificaciones y Proyectos
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Docente: <strong className="text-slate-800">{docente?.nombres} {docente?.apellidos}</strong> • {institucion?.nombre_institucion || 'Unidad Educativa'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => router.push('/docente/proyecto-interdisciplinar')}
            style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
            className="px-4 py-2.5 font-bold text-xs rounded-xl shadow-sm hover:opacity-95 transition cursor-pointer"
          >
            + Nuevo Proyecto Interdisciplinar
          </button>
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
        </div>
      </div>

      {/* SELECTOR SUPERIOR DE PESTAÑAS */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setPestañaTipo('proyectos')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            pestañaTipo === 'proyectos'
              ? 'bg-[#4b4c99] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Proyectos Interdisciplinares ({proyectosInterdisciplinares.length})
        </button>
        <button
          onClick={() => setPestañaTipo('piloto')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            pestañaTipo === 'piloto'
              ? 'bg-[#4b4c99] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Piloto Zona 6 por Materia ({planificacionesPiloto.length})
        </button>
        <button
          onClick={() => setPestañaTipo('regular')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            pestañaTipo === 'regular'
              ? 'bg-[#4b4c99] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Planificador Regular ({planificacionesRegulares.length})
        </button>
        <button
          onClick={() => setPestañaTipo('todos')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            pestañaTipo === 'todos'
              ? 'bg-[#4b4c99] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Ver Todos ({totalGlobal})
        </button>
      </div>

      {/* ================= PESTAÑA 1: PROYECTOS INTERDISCIPLINARES ================= */}
      {(pestañaTipo === 'proyectos' || pestañaTipo === 'todos') && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
              Proyectos Interdisciplinares (Evaluación Sumativa CNC)
            </h2>
            <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 shadow-2xs">
              {proyectosInterdisciplinares.length} Proyectos Registrados
            </span>
          </div>

          {proyectosInterdisciplinares.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <p className="text-slate-500 font-medium text-xs">
                No tienes proyectos interdisciplinares guardados todavía.
              </p>
              <button
                onClick={() => router.push('/docente/proyecto-interdisciplinar')}
                style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
                className="px-4 py-2 font-bold text-xs rounded-xl transition cursor-pointer shadow-2xs"
              >
                + Crear primer proyecto interdisciplinar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proyectosInterdisciplinares.map((proy) => (
                <div
                  key={proy.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {institucion?.anio_lectivo_activo || '2026-2027'}
                      </span>
                      <span className="bg-teal-50 text-teal-800 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide border border-teal-200">
                        Trimestre {proy.trimestre || '1'}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase">
                      “{proy.titulo_sia || 'Proyecto Interdisciplinar'}”
                    </h3>

                    <p className="text-[11px] text-slate-600 font-medium mt-1">
                      Curso: <strong className="text-slate-900">{proy.grado_curso} "{proy.paralelo || 'A'}"</strong> ({proy.no_semanas || 2} Semanas)
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 line-clamp-1">
                      Materias: {proy.asignaturas_conexion || 'Interdisciplinar'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 font-mono">
                      Creado: {new Date(proy.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex gap-2">
                    {/* REDIRECCIÓN DIRECTA A LA VISTA EXCLUSIVA DE PROYECTO */}
                    <button
                      onClick={() => router.push(`/docente/proyecto-interdisciplinar/ver?id=${proy.id}`)}
                      style={{ backgroundColor: '#4b4c99' }}
                      className="flex-1 py-2 text-white text-xs font-bold rounded-xl transition text-center cursor-pointer shadow-2xs hover:opacity-95"
                    >
                      Ver y Editar
                    </button>
                    <button
                      onClick={() => handleEliminarProyecto(proy.id)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer border border-rose-200 shadow-2xs"
                      title="Eliminar"
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

      {/* ================= PESTAÑA 2: PILOTO ZONA 6 (MATERIAS REGULARES) ================= */}
      {(pestañaTipo === 'piloto' || pestañaTipo === 'todos') && (
        <div className="space-y-4 pt-2">
          <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              Planificaciones por Materia (Piloto Zona 6 - DUA / ERCA)
            </h2>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
              {planificacionesPiloto.length} Guardadas
            </span>
          </div>

          {planificacionesPiloto.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <p className="text-slate-500 font-medium text-xs">
                No tienes planificaciones creadas en el formato Piloto Zona 6.
              </p>
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
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex gap-2">
                    {/* REDIRECCIÓN DIRECTA AL VISOR PILOTO */}
                    <button
                      onClick={() => router.push(`/docente/planificadorpiloto/ver?id=${plan.id}&formato=oficial`)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition text-center cursor-pointer shadow-2xs"
                    >
                      Ver y Editar
                    </button>
                    <button
                      onClick={() => handleEliminarPlanPiloto(plan.id)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer border border-rose-200 shadow-2xs"
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

      {/* ================= PESTAÑA 3: PLANIFICADOR REGULAR ================= */}
      {(pestañaTipo === 'regular' || pestañaTipo === 'todos') && (
        <div className="space-y-6 pt-2">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 uppercase mr-2 shrink-0">Carpetas Lectivas:</span>
            {periodosDisponibles.map((periodo) => {
              const seleccionado = periodo === anioLectivoFiltro
              return (
                <button
                  key={periodo}
                  onClick={() => setAnioLectivoFiltro(periodo)}
                  style={seleccionado ? { backgroundColor: '#4b4c99' } : {}}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs ${
                    seleccionado ? 'text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  <span>Periodo {periodo}</span>
                </button>
              )
            })}
          </div>

          <div className="space-y-4">
            {materiasDisponibles.map((materia) => {
              const planesMateria = planificacionesRegulares.filter((p) => p.asignatura === materia && (p.anio_lectivo || anioLectivoFiltro) === anioLectivoFiltro)
              if (planesMateria.length === 0) return null

              const keyGrupo = `${materia}-trimestral_disciplinar`
              const estaAbierto = materiasAbiertas[keyGrupo]

              return (
                <div key={keyGrupo} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
                    <span 
                      style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-xl uppercase tracking-wide border shadow-2xs"
                    >
                      {materia} ({planesMateria.length})
                    </span>
                    <button
                      onClick={() => toggleGrupo(materia, 'trimestral_disciplinar')}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {estaAbierto ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>

                  {estaAbierto && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white">
                      {planesMateria.map((plan) => (
                        <div key={plan.id} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
                          <div>
                            <h3 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 uppercase">
                              {plan.titulo_planificación || plan.tema}
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">{plan.subnivel} • {plan.grado_curso || plan.grado}</p>
                          </div>
                          <div className="pt-3 border-t border-slate-100 flex gap-2">
                            {/* REDIRECCIÓN DIRECTA A EDITAR PLAN REGULAR */}
                            <button
                              onClick={() => router.push(`/docente/planificador/nuevo?id=${plan.id}`)}
                              style={{ backgroundColor: '#4b4c99' }}
                              className="w-full py-2 text-white text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer text-center"
                            >
                              Editar Plan
                            </button>
                            <button
                              onClick={() => handleEliminarPlanRegular(plan)}
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 shadow-2xs cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL DETALLE PARA REGULARES */}
      {planSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h2 className="text-sm font-bold uppercase text-slate-900">{planSeleccionado.titulo_planificación || planSeleccionado.tema}</h2>
            <p className="text-xs text-slate-600">{planSeleccionado.objetivos_aprendizaje || planSeleccionado.objetivos || 'Sin objetivos'}</p>
            <div className="flex justify-end pt-3">
              <button onClick={() => setPlanSeleccionado(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}