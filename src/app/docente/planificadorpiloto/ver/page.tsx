'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type TipoSaber = 'indicadores' | 'declarativos' | 'procedimentales' | 'actitudinales'

export default function VerPlanificacionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('id')
  const formatoURL = searchParams.get('formato')

  const [plan, setPlan] = useState<any>(null)
  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [guardandoCambios, setGuardandoCambios] = useState(false)

  // Selector entre las 3 pestañas
  const [formatoActivo, setFormatoActivo] = useState<'oficial' | 'actualizado' | 'horizontal'>(
    formatoURL === 'horizontal' ? 'horizontal' : formatoURL === 'actualizado' ? 'actualizado' : 'oficial'
  )

  const [editando, setEditando] = useState(false)
  const [tituloSia, setTituloSia] = useState('')
  const [descripcionSia, setDescripcionSia] = useState('')
  const [asignaturasConexion, setAsignaturasConexion] = useState('')
  const [competenciaEspecifica, setCompetenciaEspecifica] = useState('')
  const [bloquesCompetencias, setBloquesCompetencias] = useState<any[]>([])
  const [semanas, setSemanas] = useState<any[]>([])

  useEffect(() => {
    if (planId) {
      cargarPlanificacion()
    }
  }, [planId])

  const cargarPlanificacion = async () => {
    try {
      const { data: planData, error } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*')
        .eq('id', planId)
        .maybeSingle()

      if (error || !planData) throw error || new Error('No se encontró el plan')
      setPlan(planData)

      setTituloSia(planData.titulo_sia || '')
      setDescripcionSia(planData.descripcion_sia || '')
      setAsignaturasConexion(planData.asignaturas_conexion || '')
      setCompetenciaEspecifica(planData.competencia_especifica || '')
      setBloquesCompetencias(planData.bloques_competencias || [])
      setSemanas(planData.semanas || [])

      if (planData?.docente_id) {
        const { data: docData } = await supabase
          .from('docentes')
          .select('*, instituciones(*)')
          .eq('id', planData.docente_id)
          .maybeSingle()

        if (docData) {
          setDocente(docData)
          setInstitucion(docData.institutions || docData.instituciones)
        }
      }
    } catch (e) {
      console.error('Error al cargar la planificación:', e)
    } finally {
      setCargando(false)
    }
  }

  const obtenerValores = (b: any, tipo: TipoSaber): string[] => {
    const selKey = tipo === 'indicadores' ? 'indicadoresSeleccionados' : `${tipo}Seleccionados`
    const dispKey = tipo === 'indicadores' ? 'indicadoresDisponibles' : `${tipo}Disponibles`
    
    const sel = b?.[selKey]
    const disp = b?.[dispKey]

    if (Array.isArray(sel) && sel.length > 0) return sel
    if (Array.isArray(disp) && disp.length > 0) return [disp[0]]
    return []
  }

  const unirSaberes = (tipo: TipoSaber, separador: string) => {
    const todos = bloquesCompetencias.flatMap((b: any) => obtenerValores(b, tipo))
    const unicos = Array.from(new Set(todos.filter(Boolean)))
    return unicos.length > 0 ? unicos.join(separador) : 'N/A'
  }

  // Extrae o distribuye elementos específicos para una fila semanal
  const obtenerElementoSemanal = (tipo: TipoSaber, sIdx: number): string => {
    const todos = bloquesCompetencias.flatMap((b: any) => obtenerValores(b, tipo)).filter(Boolean)
    if (todos.length === 0) return 'N/A'
    return todos[sIdx % todos.length]
  }

  const obtenerCompetenciaSemanal = (sIdx: number): string => {
    if (bloquesCompetencias.length === 0) return competenciaEspecifica || 'N/A'
    const b = bloquesCompetencias[sIdx % bloquesCompetencias.length]
    return b.competencia || competenciaEspecifica || 'N/A'
  }

  const guardarCambiosDirectos = async () => {
    setGuardandoCambios(true)
    try {
      const datosActualizados = {
        titulo_sia: tituloSia,
        descripcion_sia: descripcionSia,
        asignaturas_conexion: asignaturasConexion,
        competencia_especifica: competenciaEspecifica,
        bloques_competencias: bloquesCompetencias,
        semanas: semanas
      }

      const { error } = await supabase
        .from('planificaciones_microcurriculares')
        .update(datosActualizados)
        .eq('id', planId)

      if (error) throw error

      setPlan({ ...plan, ...datosActualizados })
      setEditando(false)
      alert('¡Cambios guardados con éxito!')
    } catch (e: any) {
      alert('Error al guardar cambios: ' + e.message)
    } finally {
      setGuardandoCambios(false)
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

  // Descarga Word de la pestaña activa
  const generarWordOficial = async () => {
    try {
      const contenedor = document.getElementById('contenedor-imprimible')
      if (!contenedor) return

      const contenidoHtml = contenedor.innerHTML

      const wordTemplate = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Planificación Microcurricular</title>
          <style>
            @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 24pt; }
            div.Section1 { page: Section1; }
            body { font-family: "Times New Roman", Times, serif; font-size: 9.5pt; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; table-layout: fixed; }
            th, td { border: 0.75pt solid #000; padding: 4pt; vertical-align: top; }
            .bg-gray { background-color: #e8e8e8; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .underline { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="Section1">
            ${contenidoHtml}
          </div>
        </body>
        </html>
      `

      const blob = new Blob(['\ufeff', wordTemplate], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Planificacion_${formatoActivo}_${plan.asignatura}_${plan.grado_curso}.doc`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('Error al generar el documento Word.')
    }
  }

  // Descarga PDF en orientación Horizontal A4
  const descargarPDFOficial = async () => {
    if (!plan) return
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('l', 'mm', 'a4')

      if (formatoActivo === 'horizontal') {
        // ENCABEZADO FORMATO HORIZONTAL
        const t1Body = [
          [
            { content: (institucion?.nombre_institucion || 'Unidad Educativa 16 de Abril').toUpperCase(), colSpan: 3, styles: { fontStyle: 'bold' as const, fontSize: 10, halign: 'center' as const } },
            { content: `Año lectivo: ${institucion?.anio_lectivo_activo || '2026-2027'}`, colSpan: 2, styles: { fontStyle: 'bold' as const, halign: 'center' as const } }
          ],
          [
            { content: 'Planificación Microcurricular', colSpan: 5, styles: { fontStyle: 'bold' as const, halign: 'center' as const } }
          ],
          [
            { content: 'Datos informativos:', colSpan: 5, styles: { fillColor: [232, 232, 232] as [number, number, number], fontStyle: 'bold' as const, halign: 'center' as const } }
          ],
          [
            { content: `Docente: ${docente?.nombres || ''} ${docente?.apellidos || ''}`, colSpan: 5 }
          ],
          [
            { content: `Área y Asignatura: ${plan.asignatura}`, colSpan: 2 },
            { content: `Grado/Curso: ${plan.grado_curso}`, colSpan: 2 },
            { content: `Paralelo: ${plan.paralelo}` }
          ],
          [
            { content: `Trimestre: ${plan.trimestre}`, colSpan: 2 },
            { content: `No. de semanas: ${plan.no_semanas}`, colSpan: 3 }
          ],
          [
            { content: 'Situación de aprendizaje', colSpan: 5, styles: { fillColor: [232, 232, 232] as [number, number, number], fontStyle: 'bold' as const, halign: 'center' as const } }
          ],
          [
            { content: 'Título:', styles: { fontStyle: 'bold' as const } },
            { content: tituloSia || 'S/T', colSpan: 4 }
          ],
          [
            { content: 'Descripción:', styles: { fontStyle: 'bold' as const } },
            { content: descripcionSia || 'S/D', colSpan: 4 }
          ],
          [
            { content: 'Conexión interdisciplinar:\n\nASIGNATURAS', styles: { fontStyle: 'bold' as const } },
            { content: asignaturasConexion || 'N/A', colSpan: 4 }
          ]
        ]

        autoTable(doc, {
          startY: 8,
          theme: 'grid',
          body: t1Body,
          styles: { font: 'times', fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 40 },
            2: { cellWidth: 30 },
            3: { cellWidth: 40 },
            4: { cellWidth: 107 }
          }
        })

        // TABLA 2: 8 COLUMNAS EXACTAS CON CADA SEMANA Y SUS SABERES
        const bodySemanasHorizontal = semanas.map((sem: any, sIdx: number) => [
          obtenerCompetenciaSemanal(sIdx),
          sem.indicador || sem.codigoIndicador || obtenerElementoSemanal('indicadores', sIdx),
          obtenerElementoSemanal('declarativos', sIdx),
          obtenerElementoSemanal('procedimentales', sIdx),
          obtenerElementoSemanal('actitudinales', sIdx),
          `SEMANA ${sem.numero}\n\nInicio:\n${sem.inicio || 'S/N'}\n\nDesarrollo:\n${sem.desarrollo || 'S/N'}\n\nCierre:\n${sem.cierre || 'S/N'}`,
          sem.recursos || 'Materiales del aula',
          `Técnica: ${sem.tecnica || 'Observación'}\nInstrumento: ${sem.instrumento || 'Lista de cotejo'}`
        ])

        const yCurricular = (doc as any).lastAutoTable.finalY + 4
        autoTable(doc, {
          startY: yCurricular,
          theme: 'grid',
          head: [
            [
              { content: 'COMPETENCIAS', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
              { content: 'Indicadores de\nevaluación', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
              { content: 'Saberes', colSpan: 3, styles: { halign: 'center' as const } },
              { content: 'Estrategias metodológicas\ndesde el DUA', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
              { content: 'Recursos\n(Se podrán emplear conforme la selección)', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
              { content: 'Técnicas e\ninstrumentos\nde evaluación', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } }
            ],
            [
              { content: 'Declarativos', styles: { halign: 'center' as const } },
              { content: 'Procedimentales', styles: { halign: 'center' as const } },
              { content: 'Actitudinales', styles: { halign: 'center' as const } }
            ]
          ],
          body: bodySemanasHorizontal,
          headStyles: { fillColor: [232, 232, 232], textColor: [0, 0, 0], font: 'times', fontStyle: 'bold', fontSize: 7, lineColor: [0, 0, 0], lineWidth: 0.2 },
          styles: { font: 'times', fontSize: 6.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 38 },
            2: { cellWidth: 32 },
            3: { cellWidth: 32 },
            4: { cellWidth: 28 },
            5: { cellWidth: 55 },
            6: { cellWidth: 31 },
            7: { cellWidth: 31 }
          }
        })

        // TABLA 3: FIRMAS
        const yFirmas = (doc as any).lastAutoTable.finalY + 4
        autoTable(doc, {
          startY: yFirmas,
          theme: 'grid',
          body: [
            [
              'REALIZADO POR DOCENTE.\nLCDO./A:\n\n\nFIRMA:\n\nFECHA: ________________',
              'REVISADO POR DIRECTOR DE ÁREA:\nLCDO./A:\n\n\nFIRMA:\n\nFECHA: ________________',
              'APROBADO POR VICERRECTORADO.\nING. JUANA CARANGUI\nLCDA. BÉLGICA CALLE\n\nFIRMA:\n\nFECHA: ________________'
            ]
          ],
          styles: { font: 'times', fontSize: 7, cellPadding: 3, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
          columnStyles: { 0: { cellWidth: 101 }, 1: { cellWidth: 83 }, 2: { cellWidth: 103 } }
        })

      } else {
        // RENDER DE FORMATO OFICIAL / ACTUALIZADO
        const bodyDatosInformativos = [
          [
            { content: '', styles: { halign: 'center' as const, cellWidth: 42, minCellHeight: 24, valign: 'middle' as const } }, 
            { content: (institucion?.nombre_institucion || 'UNIDAD EDUCATIVA').toUpperCase(), colSpan: 2, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 10, minCellHeight: 24, valign: 'middle' as const } }, 
            { content: `Año lectivo: ${institucion?.anio_lectivo_activo || '2026-2027'}`, styles: { halign: 'right' as const, fontSize: 8, minCellHeight: 24, valign: 'middle' as const } }
          ],
          [{ content: `Planificación microcurricular (${formatoActivo.toUpperCase()})`, colSpan: 4, styles: { fillColor: [218, 234, 138] as [number, number, number], halign: 'center' as const, fontStyle: 'bold' as const, textColor: [30, 41, 59] as [number, number, number] } }],
          [{ content: 'Datos informativos:', colSpan: 4, styles: { fontStyle: 'bold' as const } }],
          [{ content: `Docente: ${docente?.nombres || ''} ${docente?.apellidos || ''}`, colSpan: 4 }],
          [`Asignatura: ${plan.asignatura}`, { content: `Grado/Curso: ${plan.grado_curso}`, colSpan: 2 }, `Paralelo: ${plan.paralelo}`],
          [`Trimestre: ${plan.trimestre}`, { content: `No. de semanas: ${plan.no_semanas}`, colSpan: 3 }, '', ''],
          [{ content: 'Situación de aprendizaje', colSpan: 4, styles: { fillColor: [218, 234, 138] as [number, number, number], halign: 'center' as const, fontStyle: 'bold' as const, textColor: [30, 41, 59] as [number, number, number] } }],
          ['Título:', { content: tituloSia || 'S/T', colSpan: 3, styles: { fontStyle: 'bold' as const } }],
          ['Descripción:', { content: descripcionSia || 'S/D', colSpan: 3 }]
        ]

        autoTable(doc, {
          startY: 10,
          theme: 'grid',
          headStyles: { fillColor: [218, 234, 138], textColor: [30, 41, 59], fontSize: 8 },
          bodyStyles: { fontSize: 7.5, cellPadding: 2, fillColor: [255, 255, 255] },
          body: bodyDatosInformativos,
          columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 76 }, 2: { cellWidth: 84 }, 3: { cellWidth: 67 } }
        })

        const tableSemanasY = (doc as any).lastAutoTable.finalY + 4
        const bodySemanas = semanas.map((sem: any) => [
          `Semana ${sem.numero} · ${sem.tema || sem.temaSemana || ''}\n\nInicio:\n${sem.inicio || 'S/N'}\n\nDesarrollo:\n${sem.desarrollo || 'S/N'}\n\nCierre:\n${sem.cierre || 'S/N'}`,
          sem.recursos || 'Materiales del aula',
          `Técnica: ${sem.tecnica || 'Observación'}\nInstrumento: ${sem.instrumento || 'Lista de cotejo'}`
        ])

        autoTable(doc, {
          startY: tableSemanasY,
          theme: 'grid',
          head: [['Estrategias metodológicas desde el DUA', 'Recursos', 'Técnicas e instrumentos de evaluación']],
          body: bodySemanas,
          headStyles: { fillColor: [218, 234, 138], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7.5, halign: 'center' as const },
          styles: { fontSize: 7, cellPadding: 2, fillColor: [255, 255, 255] },
          columnStyles: { 0: { cellWidth: 135 }, 1: { cellWidth: 70 }, 2: { cellWidth: 68 } }
        })
      }

      doc.save(`Planificacion_${formatoActivo}_${plan.asignatura}_${plan.grado_curso}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF oficial.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto"></div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cargando planificación...</p>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-md text-center space-y-4">
          <h2 className="text-base font-bold text-slate-800">No se encontró la planificación solicitada.</h2>
          <Link href="/docente/planificadorpiloto" className="inline-block px-5 py-2.5 bg-[#4b4c99] text-white rounded-xl text-xs font-bold">
            Volver al listado
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="planificador-app bg-slate-100 min-h-screen p-4 md:p-8 font-sans selection:bg-[#4b4c99] selection:text-white">
      <div className="max-w-[287mm] mx-auto space-y-6">
        
        {/* BARRA SUPERIOR DE ACCIONES Y PESTAÑAS DE FORMATO */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex justify-between items-center flex-wrap gap-4 print:hidden">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/docente/planificador" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-bold transition">
              ← Volver a la lista
            </Link>

            {/* Selector de Pestañas de Formato */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setFormatoActivo('oficial')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  formatoActivo === 'oficial' ? 'bg-[#4b4c99] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Formato Oficial
              </button>
              <button
                onClick={() => setFormatoActivo('actualizado')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  formatoActivo === 'actualizado' ? 'bg-[#4b4c99] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Formato Actualizado (v2)
              </button>
              <button
                onClick={() => setFormatoActivo('horizontal')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  formatoActivo === 'horizontal' ? 'bg-[#4b4c99] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Formato Horizontal
              </button>
            </div>
          </div>

          <div className="flex gap-2.5 items-center flex-wrap">
            {editando ? (
              <>
                <button
                  onClick={guardarCambiosDirectos}
                  disabled={guardandoCambios}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {guardandoCambios ? 'Guardando...' : '💾 Guardar Cambios'}
                </button>
                <button
                  onClick={() => setEditando(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditando(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-2xs"
              >
              Editar Secciones Directamente
              </button>
            )}

            <button
              onClick={generarWordOficial}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
            Descargar Word
            </button>

            <button
              onClick={descargarPDFOficial}
              disabled={generandoPdf}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {generandoPdf ? 'Generando PDF...' : 'Descargar PDF (Horizontal)'}
            </button>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div id="contenedor-imprimible">
          {formatoActivo === 'horizontal' ? (
            /* =========================================================================
               ESTRUCTURA IDÉNTICA AL HTML: FORMATO HORIZONTAL (8 COLUMNAS Y SABERES POR SEMANA)
               ========================================================================= */
            <div 
              className="bg-white rounded-3xl shadow-xl border border-slate-300 p-6 md:p-8 space-y-4 text-black text-[10.5pt]"
              style={{ fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.18' }}
            >
              
              {/* TABLA 1: DATOS INFORMATIVOS Y SITUACIÓN DE APRENDIZAJE */}
              <table className="w-full border-collapse border border-black mb-4 table-fixed">
                <colgroup>
                  <col style={{ width: '25.4%' }} />
                  <col style={{ width: '13.7%' }} />
                  <col style={{ width: '10.2%' }} />
                  <col style={{ width: '14.2%' }} />
                  <col style={{ width: '36.5%' }} />
                </colgroup>
                <tbody>
                  <tr style={{ height: '37.7pt' }}>
                    <td colSpan={3} className="border border-black p-2 font-bold align-top">
                      {institucion?.nombre_institucion || 'Unidad Educativa 16 de Abril'}
                    </td>
                    <td colSpan={2} className="border border-black p-2 font-bold align-top">
                      Año lectivo: {institucion?.anio_lectivo_activo || '2026-2027'}
                    </td>
                  </tr>

                  <tr style={{ height: '24.8pt' }}>
                    <td colSpan={5} className="border border-black p-1 text-center font-bold underline">
                      Planificación Microcurricular
                    </td>
                  </tr>

                  <tr style={{ height: '24.8pt', backgroundColor: '#e8e8e8' }}>
                    <td colSpan={5} className="border border-black p-1 text-center font-bold">
                      Datos informativos:
                    </td>
                  </tr>

                  <tr style={{ height: '24.8pt' }}>
                    <td colSpan={5} className="border border-black p-1.5">
                      <span className="font-bold">Docente:</span> {docente?.nombres || ''} {docente?.apellidos || ''}
                    </td>
                  </tr>

                  <tr style={{ height: '24.8pt' }}>
                    <td colSpan={2} className="border border-black p-1.5">
                      <span className="font-bold">Área y Asignatura:</span> {plan.asignatura}
                    </td>
                    <td colSpan={2} className="border border-black p-1.5">
                      <span className="font-bold">Grado/Curso:</span> {plan.grado_curso}
                    </td>
                    <td className="border border-black p-1.5">
                      <span className="font-bold">Paralelo:</span> {plan.paralelo}
                    </td>
                  </tr>

                  <tr style={{ height: '24.8pt' }}>
                    <td colSpan={2} className="border border-black p-1.5">
                      <span className="font-bold">Trimestre:</span> {plan.trimestre}
                    </td>
                    <td colSpan={3} className="border border-black p-1.5">
                      <span className="font-bold">No. de semanas:</span> {plan.no_semanas}
                    </td>
                  </tr>

                  <tr style={{ height: '24.8pt', backgroundColor: '#e8e8e8' }}>
                    <td colSpan={5} className="border border-black p-1 text-center font-bold">
                      Situación de aprendizaje
                    </td>
                  </tr>

                  <tr style={{ minHeight: '30pt' }}>
                    <td className="border border-black p-1.5 font-bold">Título:</td>
                    <td colSpan={4} className="border border-black p-1.5 font-bold">
                      {editando ? (
                        <input 
                          type="text" 
                          value={tituloSia} 
                          onChange={e => setTituloSia(e.target.value)} 
                          className="w-full p-1 border font-bold"
                        />
                      ) : (
                        tituloSia || 'S/T'
                      )}
                    </td>
                  </tr>

                  <tr style={{ minHeight: '30pt' }}>
                    <td className="border border-black p-1.5 font-bold">Descripción:</td>
                    <td colSpan={4} className="border border-black p-1.5">
                      {editando ? (
                        <textarea 
                          rows={3} 
                          value={descripcionSia} 
                          onChange={e => setDescripcionSia(e.target.value)} 
                          className="w-full p-1 border text-xs"
                        />
                      ) : (
                        descripcionSia || 'S/D'
                      )}
                    </td>
                  </tr>

                  <tr style={{ minHeight: '54.5pt' }}>
                    <td className="border border-black p-1.5 font-bold">
                      Conexión interdisciplinar:<br/><br/>
                      ASIGNATURAS
                    </td>
                    <td colSpan={4} className="border border-black p-1.5">
                      {editando ? (
                        <textarea 
                          rows={2} 
                          value={asignaturasConexion} 
                          onChange={e => setAsignaturasConexion(e.target.value)} 
                          className="w-full p-1 border text-xs"
                        />
                      ) : (
                        asignaturasConexion || 'N/A'
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TABLA 2: MATRIZ CURRICULAR DE 8 COLUMNAS EXACTAS (COMPETENCIAS, SABERES POR SEMANA Y DUA) */}
              <table className="w-full border-collapse border border-black mb-4 table-fixed text-[9.5pt]">
                <colgroup>
                  <col style={{ width: '13.9%' }} />
                  <col style={{ width: '13.9%' }} />
                  <col style={{ width: '11.3%' }} />
                  <col style={{ width: '11.3%' }} />
                  <col style={{ width: '9.6%' }} />
                  <col style={{ width: '19.1%' }} />
                  <col style={{ width: '10.4%' }} />
                  <col style={{ width: '10.5%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2} className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#e8e8e8' }}>
                      COMPETENCIAS
                    </th>
                    <th rowSpan={2} className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#e8e8e8' }}>
                      Indicadores de<br/>evaluación
                    </th>
                    <th colSpan={3} className="border border-black p-1 text-center font-bold" style={{ backgroundColor: '#e8e8e8', height: '25pt' }}>
                      Saberes
                    </th>
                    <th rowSpan={2} className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#e8e8e8' }}>
                      Estrategias metodológicas<br/>desde el DUA
                    </th>
                    <th rowSpan={2} className="border border-black p-1 text-center font-bold" style={{ backgroundColor: '#e8e8e8', fontSize: '8pt' }}>
                      Recursos<br/>(Se podrán emplear de acuerdo con la disponibilidad)
                    </th>
                    <th rowSpan={2} className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#e8e8e8' }}>
                      Técnicas e<br/>instrumentos<br/>de evaluación
                    </th>
                  </tr>
                  <tr>
                    <th className="border border-black p-1 text-center font-bold" style={{ backgroundColor: '#e8e8e8', width: '11.3%' }}>Declarativos</th>
                    <th className="border border-black p-1 text-center font-bold" style={{ backgroundColor: '#e8e8e8', width: '11.3%' }}>Procedimentales</th>
                    <th className="border border-black p-1 text-center font-bold" style={{ backgroundColor: '#e8e8e8', width: '9.6%' }}>Actitudinales</th>
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((sem: any, sIdx: number) => {
                    const compFila = obtenerCompetenciaSemanal(sIdx)
                    const indFila = sem.indicador || sem.codigoIndicador || obtenerElementoSemanal('indicadores', sIdx)
                    const decFila = obtenerElementoSemanal('declarativos', sIdx)
                    const procFila = obtenerElementoSemanal('procedimentales', sIdx)
                    const actFila = obtenerElementoSemanal('actitudinales', sIdx)

                    return (
                      <tr key={sIdx} className="align-top">
                        {/* 1. Competencia */}
                        <td className="border border-black p-1.5 text-justify">
                          {compFila}
                        </td>

                        {/* 2. Indicador de Evaluación propio de la semana */}
                        <td className="border border-black p-1.5 text-justify">
                          <strong className="block text-[8.5pt] mb-1 text-indigo-900">{sem.indicador || sem.codigoIndicador || ''}</strong>
                          {indFila}
                        </td>

                        {/* 3. Saberes Declarativos propios */}
                        <td className="border border-black p-1.5">
                          {decFila}
                        </td>

                        {/* 4. Saberes Procedimentales propios */}
                        <td className="border border-black p-1.5">
                          {procFila}
                        </td>

                        {/* 5. Saberes Actitudinales propios */}
                        <td className="border border-black p-1.5">
                          {actFila}
                        </td>

                        {/* 6. Estrategias DUA con etiqueta de Semana */}
                        <td className="border border-black p-1.5">
                          <span className="font-bold text-center block mb-2 underline">
                            SEMANA {sem.numero} · {sem.tema || sem.temaSemana || `Tema ${sem.numero}`}
                          </span>
                          {editando ? (
                            <div className="space-y-1.5 text-xs">
                              <textarea rows={2} value={sem.inicio} onChange={e => { const n = [...semanas]; n[sIdx].inicio = e.target.value; setSemanas(n); }} className="w-full p-1 border" placeholder="Inicio" />
                              <textarea rows={3} value={sem.desarrollo} onChange={e => { const n = [...semanas]; n[sIdx].desarrollo = e.target.value; setSemanas(n); }} className="w-full p-1 border" placeholder="Desarrollo" />
                              <textarea rows={2} value={sem.cierre} onChange={e => { const n = [...semanas]; n[sIdx].cierre = e.target.value; setSemanas(n); }} className="w-full p-1 border" placeholder="Cierre" />
                            </div>
                          ) : (
                            <div className="space-y-1 text-[9pt]">
                              <p><strong>Inicio:</strong> {sem.inicio || 'S/N'}</p>
                              <p><strong>Desarrollo:</strong> {sem.desarrollo || 'S/N'}</p>
                              <p><strong>Cierre:</strong> {sem.cierre || 'S/N'}</p>
                            </div>
                          )}
                        </td>

                        {/* 7. Recursos */}
                        <td className="border border-black p-1.5 text-[8.5pt]">
                          {editando ? (
                            <textarea rows={3} value={sem.recursos} onChange={e => { const n = [...semanas]; n[sIdx].recursos = e.target.value; setSemanas(n); }} className="w-full p-1 border" />
                          ) : (
                            sem.recursos || 'Materiales del aula'
                          )}
                        </td>

                        {/* 8. Técnicas e Instrumentos de Evaluación */}
                        <td className="border border-black p-1.5 text-[8.5pt]">
                          {editando ? (
                            <div className="space-y-1">
                              <input type="text" value={sem.tecnica} onChange={e => { const n = [...semanas]; n[sIdx].tecnica = e.target.value; setSemanas(n); }} className="w-full p-1 border" placeholder="Técnica" />
                              <input type="text" value={sem.instrumento} onChange={e => { const n = [...semanas]; n[sIdx].instrumento = e.target.value; setSemanas(n); }} className="w-full p-1 border" placeholder="Instrumento" />
                            </div>
                          ) : (
                            <>
                              <p><strong>Técnica:</strong> {sem.tecnica || 'Observación sistemática'}</p>
                              <p><strong>Instrumento:</strong> {sem.instrumento || 'Lista de cotejo'}</p>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* TABLA 3: FIRMAS DE RESPONSABILIDAD */}
              <table className="w-full border-collapse border border-black table-fixed text-[10pt]" style={{ fontFamily: '"Calibri", Arial, sans-serif' }}>
                <colgroup>
                  <col style={{ width: '35.3%' }} />
                  <col style={{ width: '28.8%' }} />
                  <col style={{ width: '35.9%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td className="border border-black p-2.5 align-top" style={{ height: '110pt' }}>
                      REALIZADO POR DOCENTE.<br/>
                      LCDO./A: {docente?.nombres || ''} {docente?.apellidos || ''}<br/><br/><br/>
                      FIRMA:
                    </td>
                    <td className="border border-black p-2.5 align-top" style={{ height: '110pt' }}>
                      REVISADO POR DIRECTOR DE ÁREA O SUB NIVEL:<br/>
                      LCDO./A.<br/><br/><br/>
                      FIRMA:
                    </td>
                    <td className="border border-black p-2.5 align-top" style={{ height: '110pt' }}>
                      APROBADO POR VICERRECTORADO.<br/>
                      ING. JUANA CARANGUI<br/>
                      FIRMA:
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 align-middle text-[9pt]">FECHA: ___________________</td>
                    <td className="border border-black px-2 py-1 align-middle text-[9pt]">FECHA: ___________________</td>
                    <td className="border border-black px-2 py-1 align-middle text-[9pt]">FECHA: ___________________</td>
                  </tr>
                </tbody>
              </table>

            </div>
          ) : (
            /* =========================================================================
               VISTA ANTERIOR: PESTAÑAS 'OFICIAL' Y 'ACTUALIZADO'
               ========================================================================= */
            <div className="bg-white rounded-3xl shadow-xl border border-slate-300 p-6 md:p-10 space-y-6 text-slate-800 text-xs">
              
              {/* TABLA 1 */}
              <table className="w-full border-collapse border border-slate-500 bg-white table-fixed">
                <colgroup>
                  <col className="w-[15%]" />
                  <col className="w-[35%]" />
                  <col className="w-[35%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <tbody>
                  <tr>
                    <td className="border border-slate-500 p-6 text-center align-middle bg-white h-32">
                      {institucion?.logo_url ? (
                        <img src={institucion.logo_url} alt="Logo" className="h-16 w-16 object-contain mx-auto" />
                      ) : (
                        <div className="h-14 w-14 bg-[#4b4c99] text-white rounded-xl flex items-center justify-center font-black mx-auto">UE</div>
                      )}
                    </td>
                    <td colSpan={2} className="border border-slate-500 p-6 text-center align-middle bg-white">
                      <strong className="text-sm uppercase block">{institucion?.nombre_institucion || 'Unidad Educativa'}</strong>
                      <span className="text-[11px] text-slate-600">Código AMIE: {institucion?.codigo_amie || '03H00106'}</span>
                    </td>
                    <td className="border border-slate-500 p-6 text-right align-middle font-bold text-slate-600 bg-white">
                      Año lectivo: {institucion?.anio_lectivo_activo || '2026-2027'}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                      Planificación microcurricular ({formatoActivo.toUpperCase()})
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="border border-slate-500 p-2 font-bold bg-white">Datos informativos:</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="border border-slate-500 p-2 bg-white">Docente: {docente?.nombres || ''} {docente?.apellidos || ''}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-500 p-2 bg-white">Asignatura: {plan.asignatura}</td>
                    <td colSpan={2} className="border border-slate-500 p-2 bg-white">Grado/Curso: {plan.grado_curso}</td>
                    <td className="border border-slate-500 p-2 bg-white">Paralelo: {plan.paralelo}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-500 p-2 bg-white">Trimestre: {plan.trimestre}</td>
                    <td colSpan={3} className="border border-slate-500 p-2 bg-white">No. de semanas: {plan.no_semanas}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                      Situación de aprendizaje
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-500 p-2 font-bold bg-white">Título:</td>
                    <td colSpan={3} className="border border-slate-500 p-2 font-semibold bg-white">
                      {editando ? (
                        <input 
                          type="text" 
                          value={tituloSia} 
                          onChange={e => setTituloSia(e.target.value)} 
                          className="w-full p-2 border border-indigo-400 rounded-lg bg-indigo-50/50 font-bold outline-none"
                        />
                      ) : (
                        tituloSia || 'S/T'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-500 p-2 font-bold bg-white">Descripción:</td>
                    <td colSpan={3} className="border border-slate-500 p-2 leading-relaxed bg-white">
                      {editando ? (
                        <textarea 
                          rows={4} 
                          value={descripcionSia} 
                          onChange={e => setDescripcionSia(e.target.value)} 
                          className="w-full p-2 border border-indigo-400 rounded-lg bg-indigo-50/50 outline-none resize-y"
                        />
                      ) : (
                        descripcionSia || 'S/D'
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TABLA 2: SABERES */}
              {formatoActivo === 'oficial' ? (
                <table className="w-full border-collapse border border-slate-500 table-fixed">
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[25%]" />
                    <col className="w-[25%]" />
                    <col className="w-[25%]" />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td colSpan={4} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                        Conexión interdisciplinar
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="border border-slate-500 p-2 bg-white">
                        <strong>Asignaturas / Temas:</strong> {asignaturasConexion || 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                        Competencias específicas
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="border border-slate-500 p-2 leading-relaxed bg-white">
                        {competenciaEspecifica || (bloquesCompetencias ? bloquesCompetencias.map((b: any, i: number) => `[Bloque ${i+1}] ${b.competencia}`).join('\n') : '')}
                      </td>
                    </tr>
                    <tr>
                      <td rowSpan={2} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] align-middle">
                        Indicadores de evaluación
                      </td>
                      <td colSpan={3} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                        Saberes
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">Declarativos</td>
                      <td className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">Procedimentales</td>
                      <td className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">Actitudinales</td>
                    </tr>

                    {bloquesCompetencias && bloquesCompetencias.map((bloque: any, bIdx: number) => {
                      const ind = obtenerValores(bloque, 'indicadores').join('\n') || 'N/A'
                      const dec = obtenerValores(bloque, 'declarativos').join('\n') || 'N/A'
                      const proc = obtenerValores(bloque, 'procedimentales').join('\n') || 'N/A'
                      const act = obtenerValores(bloque, 'actitudinales').join('\n') || 'N/A'

                      return (
                        <tr key={bIdx}>
                          <td className="border border-slate-500 p-2 whitespace-pre-wrap bg-white">{ind}</td>
                          <td className="border border-slate-500 p-2 whitespace-pre-wrap bg-white">{dec}</td>
                          <td className="border border-slate-500 p-2 whitespace-pre-wrap bg-white">{proc}</td>
                          <td className="border border-slate-500 p-2 whitespace-pre-wrap bg-white">{act}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse border border-slate-500 table-fixed">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[70%]" />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td colSpan={2} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                        Conexión interdisciplinar
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-500 p-2 bg-white">
                        <strong>Asignaturas / Temas:</strong> {asignaturasConexion || 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                        Competencias específicas
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-500 p-2 leading-relaxed bg-white">
                        {competenciaEspecifica || (bloquesCompetencias ? bloquesCompetencias.map((b: any, i: number) => `[Bloque ${i+1}] ${b.competencia}`).join('\n') : '')}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] align-middle">
                        Indicadores de evaluación
                      </td>
                      <td className="border border-slate-500 p-2 bg-white whitespace-pre-wrap">
                        {unirSaberes('indicadores', '\n')}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-500 p-2 font-bold bg-[#dbea8a]">Saberes Declarativos</td>
                      <td className="border border-slate-500 p-2 bg-white whitespace-pre-wrap">
                        {unirSaberes('declarativos', '\n')}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-500 p-2 font-bold bg-[#dbea8a]">Saberes Procedimentales</td>
                      <td className="border border-slate-500 p-2 bg-white whitespace-pre-wrap">
                        {unirSaberes('procedimentales', '\n')}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-500 p-2 font-bold bg-[#dbea8a]">Saberes Actitudinales</td>
                      <td className="border border-slate-500 p-2 bg-white whitespace-pre-wrap">
                        {unirSaberes('actitudinales', '\n')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* TABLA 3: DUA */}
              <table className="w-full border-collapse border border-slate-500 table-fixed">
                <colgroup>
                  <col className="w-[50%]" />
                  <col className="w-[25%]" />
                  <col className="w-[25%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] text-slate-800">Estrategias metodológicas desde el DUA</th>
                    <th className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] text-slate-800">Recursos</th>
                    <th className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] text-slate-800">Técnicas e instrumentos de evaluación</th>
                  </tr>
                </thead>
                <tbody>
                  {semanas && semanas.map((sem: any, sIdx: number) => (
                    <tr key={sIdx}>
                      <td className="border border-slate-500 p-2 space-y-1 bg-white align-top">
                        <strong className="block text-slate-900 font-bold">
                          Semana {sem.numero} · {sem.tema || sem.temaSemana || `Tema ${sem.numero}`}
                        </strong>
                        <p><strong>Inicio:</strong> {sem.inicio || 'S/N'}</p>
                        <p><strong>Desarrollo:</strong> {sem.desarrollo || 'S/N'}</p>
                        <p><strong>Cierre:</strong> {sem.cierre || 'S/N'}</p>
                      </td>
                      <td className="border border-slate-500 p-2 bg-white">{sem.recursos}</td>
                      <td className="border border-slate-500 p-2 bg-white">
                        Técnica: {sem.tecnica}<br/>Instrumento: {sem.instrumento}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-[10px] italic text-slate-500 pt-2 border-t border-slate-200">
                Esta herramienta pedagógica genera propuestas de planificación basadas en los lineamientos técnicos y formatos socializados en la fase de pilotaje. Es responsabilidad del docente validar y ajustar el contenido conforme a las disposiciones específicas de su institución educativa y distrito.
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  )
}