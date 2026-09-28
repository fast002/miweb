'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PlanesGuardadosPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)
  const [planificaciones, setPlanificaciones] = useState<any[]>([])
  const [planSeleccionado, setPlanSeleccionado] = useState<any | null>(null)
  const [generandoPdf, setGenerandoPdf] = useState(false)

  useEffect(() => {
    cargarDatosYPlanes()
  }, [])

  const cargarDatosYPlanes = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      // 1. Cargar perfil del docente e institución
      const { data: perfilDocente } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (perfilDocente) {
        setDocente(perfilDocente)
        setInstitucion(perfilDocente.instituciones)
      }

      // 2. Cargar planificaciones microcurriculares guardadas
      const { data: planes, error } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*')
        .eq('docente_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && planes) {
        setPlanificaciones(planes)
      }
    } catch (err) {
      console.error('Error al cargar planificaciones:', err)
    } finally {
      setCargando(false)
    }
  }

  const handleEliminarPlan = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta planificación? Esta acción no se puede deshacer.')) return

    try {
      const { error } = await supabase
        .from('planificaciones_microcurriculares')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPlanificaciones(prev => prev.filter(p => p.id !== id))
      if (planSeleccionado?.id === id) {
        setPlanSeleccionado(null)
      }
      alert('Planificación eliminada con éxito.')
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
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

  const descargarPlanPDF = async (plan: any) => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (institucion?.logo_url) {
        logoBase64 = await convertirLogoABase64(institucion.logo_url)
      }

      // Encabezado Institucional Oficial
      doc.setLineWidth(0.4)
      doc.rect(14, 15, pageWidth - 28, 25)
      doc.line(50, 15, 50, 40)
      doc.line(pageWidth - 50, 15, pageWidth - 50, 40)

      if (logoBase64) {
        doc.addImage(logoBase64 as string, 'PNG', 18, 17, 21, 21)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text((institucion?.nombre_institucion || 'UNIDAD EDUCATIVA').toUpperCase(), pageWidth / 2, 22, { align: 'center' })
      doc.setFontSize(9)
      doc.text(`CÓDIGO AMIE: ${institucion?.codigo_amie || '03H00106'}`, pageWidth / 2, 29, { align: 'center' })
      doc.setTextColor(0, 0, 128)
      doc.text(`AÑO LECTIVO: ${institucion?.anio_lectivo_activo || '2026-2027'}`, pageWidth / 2, 35, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.text('EL NUEVO ECUADOR', pageWidth - 25, 28, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('PLANIFICACIÓN MICROCURRICULAR - PLAN PILOTO', pageWidth / 2, 48, { align: 'center' })

      autoTable(doc, {
        startY: 52,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        body: [
          ['DATOS INFORMATIVOS', ''],
          [`Docente: ${docente?.nombres || ''} ${docente?.apellidos || ''}`, `Asignatura: ${plan.asignatura}`],
          [`Grado/Curso: ${plan.grado_curso}`, `Paralelo: ${plan.paralelo}`],
          [`Trimestre: ${plan.trimestre}`, `No. de semanas: ${plan.no_semanas}`],
          ['SITUACIÓN DE APRENDIZAJE', ''],
          [`Título: ${plan.titulo_sia || 'N/A'}`, `Descripción: ${plan.descripcion_sia || 'N/A'}`],
          ['CONEXIÓN INTERDISCIPLINAR', ''],
          [`Asignaturas conectadas: ${plan.asignaturas_conexion || 'N/A'}`, ''],
          ['COMPETENCIAS ESPECÍFICAS', ''],
          [plan.competencia_especifica || 'N/A', '']
        ]
      })

      const tableSaberesY = (doc as any).lastAutoTable.finalY + 4
      const bodySaberes = (plan.filas_saberes || []).map((f: any) => [
        f.indicador,
        f.declarativo,
        f.procedimental,
        f.actitudinal
      ])

      autoTable(doc, {
        startY: tableSaberesY,
        theme: 'grid',
        head: [['Indicadores de evaluación', 'Saberes Declarativos', 'Saberes Procedimentales', 'Saberes Actitudinales']],
        body: bodySaberes.length > 0 ? bodySaberes : [['N/A', 'N/A', 'N/A', 'N/A']],
        headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
        styles: { fontSize: 8 }
      })

      const tableSemanasY = (doc as any).lastAutoTable.finalY + 4
      const bodySemanas = (plan.semanas || []).map((sem: any) => [
        `Semana ${sem.numero}`,
        `• Anticipación: ${sem.anticipacion}\n• Construcción: ${sem.construccion}\n• Consolidación: ${sem.consolidacion}`,
        sem.recursos,
        `Técnica: ${sem.tecnica}\nInstrumento: ${sem.instrumento}`
      ])

      autoTable(doc, {
        startY: tableSemanasY,
        theme: 'grid',
        head: [['Semana', 'Estrategias metodológicas desde el DUA', 'Recursos', 'Técnicas e Instrumentos']],
        body: bodySemanas,
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 }
      })

      doc.save(`Planificacion_${plan.asignatura}_${plan.grado_curso}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF de la planificación.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando planificaciones guardadas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ENCABEZADO */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              📂 Mis Planificaciones Microcurriculares Guardadas
            </h1>
            <p className="text-sm font-bold text-blue-700 mt-1">
              Docente: {docente?.nombres} {docente?.apellidos}
            </p>
          </div>

          <button
            onClick={() => router.push('/docente/planificadorpiloto')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition"
          >
            + Crear Nueva Planificación
          </button>
        </div>

        {/* LISTADO DE PLANIFICACIONES */}
        {planificaciones.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border space-y-3">
            <p className="text-slate-500 font-medium text-sm">
              No tienes ninguna planificación guardada todavía.
            </p>
            <button
              onClick={() => router.push('/docente/planificadorpiloto')}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
            >
              Ir al Planificador
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planificaciones.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold text-slate-400">
                      ID: {plan.id.slice(0, 6)}...
                    </span>
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                      {plan.trimestre}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-1 line-clamp-2">
                    {plan.titulo_sia || `Planificación de ${plan.asignatura}`}
                  </h3>

                  <p className="text-xs text-slate-600 font-medium">
                    Asignatura: <strong className="text-slate-800">{plan.asignatura}</strong>
                  </p>
                  <p className="text-xs text-slate-500">
                    Curso: {plan.grado_curso} (Paralelo {plan.paralelo})
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Creado el: {new Date(plan.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPlanSeleccionado(plan)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition text-center"
                  >
                    👁️ Ver
                  </button>
                  <button
                    onClick={() => router.push(`/docente/planificadorpiloto?id=${plan.id}`)}
                    className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl transition text-center border border-amber-200"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => descargarPlanPDF(plan)}
                    disabled={generandoPdf}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition text-center"
                  >
                    🖨️ PDF
                  </button>
                  <button
                    onClick={() => handleEliminarPlan(plan.id)}
                    className="py-2 px-3 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 text-xs font-bold rounded-xl transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* MODAL DE DETALLE DE LA PLANIFICACIÓN */}
      {planSeleccionado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 space-y-6 shadow-2xl my-8">
            
            <div className="text-center border-b pb-4">
              <h2 className="text-xl font-bold uppercase text-slate-900">
                {institucion?.nombre_institucion || 'UNIDAD EDUCATIVA'}
              </h2>
              <p className="text-xs text-slate-600 font-semibold uppercase mt-1">
                PLANIFICACIÓN MICROCURRICULAR - PLAN PILOTO ({planSeleccionado.trimestre})
              </p>
              <div className="flex justify-between text-[11px] text-slate-500 mt-3 pt-2 border-t">
                <span>Docente: <strong>{docente?.nombres} {docente?.apellidos}</strong></span>
                <span>Asignatura: <strong>{planSeleccionado.asignatura}</strong></span>
                <span>Grado: <strong>{planSeleccionado.grado_curso} ({planSeleccionado.paralelo})</strong></span>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-800 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Título de la Situación de Aprendizaje (SIA):</strong>
                <p className="p-3 bg-slate-50 rounded-lg border font-semibold">{planSeleccionado.titulo_sia || 'N/A'}</p>
              </div>

              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Descripción de la SIA:</strong>
                <p className="p-3 bg-slate-50 rounded-lg border">{planSeleccionado.descripcion_sia || 'N/A'}</p>
              </div>

              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Competencia Específica:</strong>
                <p className="p-3 bg-slate-50 rounded-lg border">{planSeleccionado.competencia_especifica || 'N/A'}</p>
              </div>

              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Matriz de Saberes y Evaluaciones ({planSeleccionado.filas_saberes?.length || 0} filas):</strong>
                <div className="space-y-2 mt-1">
                  {planSeleccionado.filas_saberes?.map((f: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border text-[11px] space-y-1">
                      <span className="font-bold text-indigo-700">Fila {idx + 1}:</span>
                      <p><strong>Indicador:</strong> {f.indicador}</p>
                      <p><strong>Declarativo:</strong> {f.declarativo}</p>
                      <p><strong>Procedimental:</strong> {f.procedimental}</p>
                      <p><strong>Actitudinal:</strong> {f.actitudinal}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <strong className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Secuencia Metodológica DUA (8 Semanas):</strong>
                <div className="space-y-2 mt-1">
                  {planSeleccionado.semanas?.map((s: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border text-[11px] space-y-1">
                      <span className="font-black text-indigo-700 uppercase">Semana {s.numero}:</span>
                      <p><strong>1. Anticipación:</strong> {s.anticipacion}</p>
                      <p><strong>2. Construcción:</strong> {s.construccion}</p>
                      <p><strong>3. Consolidación:</strong> {s.consolidacion}</p>
                      <p className="text-slate-500 text-[10px]"><strong>Recursos:</strong> {s.recursos} | <strong>Técnica/Instrumento:</strong> {s.tecnica} - {s.instrumento}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t flex-wrap gap-2">
              <button
                onClick={() => setPlanSeleccionado(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
              >
                Cerrar Detalle
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/docente/planificadorpiloto?id=${planSeleccionado.id}`)}
                  className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition"
                >
                  ✏️ Editar Plan
                </button>
                <button
                  onClick={() => descargarPlanPDF(planSeleccionado)}
                  className="px-5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition"
                >
                  🖨️ Descargar PDF
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}