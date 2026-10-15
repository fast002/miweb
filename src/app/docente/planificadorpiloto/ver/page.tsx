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

  const [formatoActivo, setFormatoActivo] = useState<'oficial' | 'actualizado'>(
    formatoURL === 'actualizado' ? 'actualizado' : 'oficial'
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
        .single()

      if (error) throw error
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
          .single()

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

  const guardarCambiosDirectos = async () => {
    setGuardandoCambios(true)
    try {
      const datosActualizados = {
        titulo_sia: tituloSia,
        descripcion_sia: descripcionSia,
        asignaturasConexion: asignaturasConexion,
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

  const generarWordOficial = async () => {
    try {
      let logoBase64 = null
      if (institucion?.logo_url) {
        logoBase64 = await convertirLogoABase64(institucion.logo_url)
      }

      const filasSaberesHtml = formatoActivo === 'oficial' 
        ? (bloquesCompetencias.length > 0
            ? bloquesCompetencias.map((b: any) => {
                const ind = obtenerValores(b, 'indicadores').join('<br/>') || 'N/A'
                const dec = obtenerValores(b, 'declarativos').join('<br/>') || 'N/A'
                const proc = obtenerValores(b, 'procedimentales').join('<br/>') || 'N/A'
                const act = obtenerValores(b, 'actitudinales').join('<br/>') || 'N/A'
                return `
                  <tr>
                    <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">${ind}</td>
                    <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">${dec}</td>
                    <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">${proc}</td>
                    <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">${act}</td>
                  </tr>
                `
              }).join('')
            : '<tr><td colspan="4" style="border: 1pt solid #64748b; padding: 6px; text-align: center;">Sin registros</td></tr>')
        : `
            <tr>
              <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">
                ${unirSaberes('indicadores', '<br/>')}
              </td>
            </tr>
            <tr>
              <td class="bg-header">Saberes Declarativos</td>
              <td style="border: 1pt solid #64748b; padding: 6px;">${unirSaberes('declarativos', '<br/>')}</td>
            </tr>
            <tr>
              <td class="bg-header">Saberes Procedimentales</td>
              <td style="border: 1pt solid #64748b; padding: 6px;">${unirSaberes('procedimentales', '<br/>')}</td>
            </tr>
            <tr>
              <td class="bg-header">Saberes Actitudinales</td>
              <td style="border: 1pt solid #64748b; padding: 6px;">${unirSaberes('actitudinales', '<br/>')}</td>
            </tr>
          `

      const filasSemanasHtml = semanas.map((sem: any, sIdx: number) => formatoActivo === 'oficial' ? `
        <tr>
          <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">
            <b>Semana ${sem.numero} · ${sem.tema || sem.temaSemana || ''}</b><br/><br/>
            • <b>Inicio:</b><br/>${(sem.inicio || 'S/N').replace(/\n/g, '<br/>')}<br/><br/>
            • <b>Desarrollo:</b><br/>${(sem.desarrollo || 'S/N').replace(/\n/g, '<br/>')}<br/><br/>
            • <b>Cierre:</b><br/>${(sem.cierre || 'S/N').replace(/\n/g, '<br/>')}
          </td>
          <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">${(sem.recursos || 'Materiales del aula').replace(/\n/g, '<br/>')}</td>
          <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">Técnica: ${sem.tecnica}<br/>Instrumento: ${sem.instrumento}</td>
        </tr>
      ` : `
        <tr>
          <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">
            <b>Semana ${sem.numero} · ${sem.tema || sem.temaSemana || ''}</b><br/>
            <i style="color: #475569;">${sem.indicador || sem.codigoIndicador || ''}</i>
          </td>
          <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">
            • <b>Inicio:</b> ${sem.inicio || 'S/N'}<br/>
            • <b>Desarrollo:</b> ${sem.desarrollo || 'S/N'}<br/>
            • <b>Cierre:</b> ${sem.cierre || 'S/N'}
          </td>
          <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">
            Técnica: ${sem.tecnica}<br/>Instrumento: ${sem.instrumento}
          </td>
          <td style="border: 1pt solid #64748b; padding: 6px; vertical-align: top;">
            ${sem.recursos || 'Materiales del aula'}
          </td>
        </tr>
      `).join('')

      const contenidoWordXML = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Planificación Microcurricular</title>
          <style>
            @page Section1 { size: 842.35pt 595.3pt; mso-page-orientation: landscape; margin: 36pt; }
            div.Section1 { page: Section1; }
            body { font-family: Arial, sans-serif; font-size: 8pt; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12pt; }
            th, td { border: 1pt solid #64748b; padding: 5pt; vertical-align: top; text-align: left; }
            .bg-header { background-color: #dbea8a; font-weight: bold; text-align: center; }
          </style>
        </head>
        <body>
          <div class="Section1">
            <table>
              <colgroup>
                <col style="width: 15%;">
                <col style="width: 35%;">
                <col style="width: 35%;">
                <col style="width: 15%;">
              </colgroup>
              <tbody>
                <tr>
                  <td style="text-align: center; vertical-align: middle;">
                    ${logoBase64 ? `<img src="${logoBase64}" width="50" height="50" />` : '<b>UE</b>'}
                  </td>
                  <td colspan="2" style="text-align: center; vertical-align: middle;">
                    <b style="font-size: 10pt; text-transform: uppercase;">${institucion?.nombre_institucion || 'Unidad Educativa'}</b><br/>
                    <span style="font-size: 8pt;">Código AMIE: ${institucion?.codigo_amie || '03H00106'}</span>
                  </td>
                  <td style="text-align: right; vertical-align: middle; font-weight: bold;">
                    Año lectivo: ${institucion?.anio_lectivo_activo || '2026-2027'}
                  </td>
                </tr>
                <tr><td colspan="4" class="bg-header">Planificación microcurricular (${formatoActivo.toUpperCase()})</td></tr>
                <tr><td colspan="4" style="font-weight: bold;">Datos informativos:</td></tr>
                <tr><td colspan="4">Docente: ${docente?.nombres || ''} ${docente?.apellidos || ''}</td></tr>
                <tr>
                  <td>Asignatura: ${plan.asignatura}</td>
                  <td colspan="2">Grado/Curso: ${plan.grado_curso}</td>
                  <td>Paralelo: ${plan.paralelo}</td>
                </tr>
                <tr>
                  <td>Trimestre: ${plan.trimestre}</td>
                  <td colspan="3">No. de semanas: ${plan.no_semanas}</td>
                </tr>
                <tr><td colspan="4" class="bg-header">Situación de aprendizaje</td></tr>
                <tr><td style="font-weight: bold;">Título:</td><td colspan="3" style="font-weight: bold;">${tituloSia || 'S/T'}</td></tr>
                <tr><td style="font-weight: bold;">Descripción:</td><td colspan="3">${descripcionSia || 'S/D'}</td></tr>
              </tbody>
            </table>

            <table>
              <tbody>
                <tr><td colspan="${formatoActivo === 'oficial' ? 4 : 2}" class="bg-header">Conexión interdisciplinar</td></tr>
                <tr><td colspan="${formatoActivo === 'oficial' ? 4 : 2}"><b>Asignaturas / Temas:</b> ${asignaturasConexion || 'N/A'}</td></tr>
                <tr><td colspan="${formatoActivo === 'oficial' ? 4 : 2}" class="bg-header">Competencias específicas</td></tr>
                <tr><td colspan="${formatoActivo === 'oficial' ? 4 : 2}">${competenciaEspecifica || 'N/A'}</td></tr>
                ${formatoActivo === 'oficial' ? `
                  <tr>
                    <td rowspan="2" class="bg-header" style="vertical-align: middle;">Indicadores de evaluación</td>
                    <td colspan="3" class="bg-header">Saberes</td>
                  </tr>
                  <tr>
                    <td class="bg-header">Declarativos</td>
                    <td class="bg-header">Procedimentales</td>
                    <td class="bg-header">Actitudinales</td>
                  </tr>
                  ${filasSaberesHtml}
                ` : `
                  <tr>
                    <td class="bg-header" style="width: 30%;">Indicadores de evaluación</td>
                    <td>${unirSaberes('indicadores', '<br/>')}</td>
                  </tr>
                  <tr><td class="bg-header">Saberes Declarativos</td><td>${unirSaberes('declarativos', '<br/>')}</td></tr>
                  <tr><td class="bg-header">Saberes Procedimentales</td><td>${unirSaberes('procedimentales', '<br/>')}</td></tr>
                  <tr><td class="bg-header">Saberes Actitudinales</td><td>${unirSaberes('actitudinales', '<br/>')}</td></tr>
                `}
              </tbody>
            </table>

            <table>
              <thead>
                <tr>
                  ${formatoActivo === 'oficial' ? `
                    <th class="bg-header">Estrategias metodológicas desde el DUA</th>
                    <th class="bg-header">Recursos</th>
                    <th class="bg-header">Técnicas e instrumentos de evaluación</th>
                  ` : `
                    <th class="bg-header" style="width: 20%;">Semana / Fase</th>
                    <th class="bg-header" style="width: 42%;">Estrategias Metodológicas (DUA)</th>
                    <th class="bg-header" style="width: 18%;">Evaluación</th>
                    <th class="bg-header" style="width: 20%;">Recursos</th>
                  `}
                </tr>
              </thead>
              <tbody>
                ${filasSemanasHtml}
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `

      const blob = new Blob(['\ufeff', contenidoWordXML], { type: 'application/msword' })
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
      alert('Error al generar el documento Word oficial.')
    }
  }

  const descargarPDFOficial = async () => {
    if (!plan) return
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
        columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 76 }, 2: { cellWidth: 84 }, 3: { cellWidth: 67 } },
        didDrawCell: (data) => {
          if (data.row.index === 0 && data.column.index === 0 && logoBase64) {
            doc.addImage(logoBase64 as string, 'PNG', data.cell.x + 9, data.cell.y + 3, 24, 18)
          }
        }
      })

      if (formatoActivo === 'oficial') {
        const bodySaberes = bloquesCompetencias.length > 0 
          ? bloquesCompetencias.flatMap((b: any) => {
              const ind = obtenerValores(b, 'indicadores').join('\n') || 'N/A'
              const dec = obtenerValores(b, 'declarativos').join('\n') || 'N/A'
              const proc = obtenerValores(b, 'procedimentales').join('\n') || 'N/A'
              const act = obtenerValores(b, 'actitudinales').join('\n') || 'N/A'
              return [[ind, dec, proc, act]]
            })
          : [['Sin registros', '', '', '']]

        const tableSaberesY = (doc as any).lastAutoTable.finalY + 4
        autoTable(doc, {
          startY: tableSaberesY,
          theme: 'grid',
          head: [
            [{ content: 'Conexión interdisciplinar', colSpan: 4, styles: { fillColor: [218, 234, 138], halign: 'center' as const, fontStyle: 'bold' as const, textColor: [30, 41, 59] } }],
            [{ content: `Asignaturas / Temas: ${asignaturasConexion || 'N/A'}`, colSpan: 4, styles: { fillColor: [255, 255, 255], textColor: [30, 41, 59] } }],
            [{ content: 'Competencias específicas', colSpan: 4, styles: { fillColor: [218, 234, 138], halign: 'center' as const, fontStyle: 'bold' as const, textColor: [30, 41, 59] } }],
            [{ content: competenciaEspecifica || 'N/A', colSpan: 4, styles: { fillColor: [255, 255, 255], textColor: [30, 41, 59] } }],
            ['Indicadores de evaluación', 'Saberes Declarativos', 'Saberes Procedimentales', 'Saberes Actitudinales']
          ],
          body: bodySaberes,
          headStyles: { fillColor: [218, 234, 138], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7.5, halign: 'center' as const },
          styles: { fontSize: 7, cellPadding: 2, fillColor: [255, 255, 255] },
          columnStyles: { 0: { cellWidth: 68 }, 1: { cellWidth: 68 }, 2: { cellWidth: 68 }, 3: { cellWidth: 69 } }
        })

        const tableSemanasY = (doc as any).lastAutoTable.finalY + 4
        const bodySemanas = semanas.map((sem: any) => [
          `Semana ${sem.numero} · ${sem.tema || sem.temaSemana || ''}\n\n• Inicio:\n${sem.inicio || 'S/N'}\n\n• Desarrollo:\n${sem.desarrollo || 'S/N'}\n\n• Cierre:\n${sem.cierre || 'S/N'}`,
          sem.recursos || 'Materiales del aula',
          `Técnica: ${sem.tecnica}\nInstrumento: ${sem.instrumento}`
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
      } else {
        const bodySaberesV2 = [
          ['Indicadores de evaluación', unirSaberes('indicadores', '\n')],
          ['Saberes Declarativos', unirSaberes('declarativos', '\n')],
          ['Saberes Procedimentales', unirSaberes('procedimentales', '\n')],
          ['Saberes Actitudinales', unirSaberes('actitudinales', '\n')]
        ]

        const tableSaberesY = (doc as any).lastAutoTable.finalY + 4
        autoTable(doc, {
          startY: tableSaberesY,
          theme: 'grid',
          head: [
            [{ content: 'Conexión interdisciplinar', colSpan: 2, styles: { fillColor: [218, 234, 138], halign: 'center' as const, fontStyle: 'bold' as const, textColor: [30, 41, 59] } }],
            [{ content: `Asignaturas / Temas: ${asignaturasConexion || 'N/A'}`, colSpan: 2, styles: { fillColor: [255, 255, 255], textColor: [30, 41, 59] } }],
            [{ content: 'Competencias específicas', colSpan: 2, styles: { fillColor: [218, 234, 138], halign: 'center' as const, fontStyle: 'bold' as const, textColor: [30, 41, 59] } }],
            [{ content: competenciaEspecifica || 'N/A', colSpan: 2, styles: { fillColor: [255, 255, 255], textColor: [30, 41, 59] } }]
          ],
          body: bodySaberesV2,
          headStyles: { fillColor: [218, 234, 138], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7.5, halign: 'center' as const },
          styles: { fontSize: 7, cellPadding: 2, fillColor: [255, 255, 255] },
          columnStyles: { 0: { cellWidth: 99 }, 1: { cellWidth: 174 } }
        })

        const bodySemanasV2 = semanas.map((sem: any) => [
          `Semana ${sem.numero} · ${sem.tema || sem.temaSemana || ''}\n\n${sem.indicador || sem.codigoIndicador || ''}`,
          `• Inicio: ${sem.inicio || 'S/N'}\n• Desarrollo: ${sem.desarrollo || 'S/N'}\n• Cierre: ${sem.cierre || 'S/N'}`,
          `Técnica: ${sem.tecnica}\nInstrumento: ${sem.instrumento}`,
          sem.recursos || 'Materiales del aula'
        ])

        const tableSemanasY = (doc as any).lastAutoTable.finalY + 4
        autoTable(doc, {
          startY: tableSemanasY,
          theme: 'grid',
          head: [['Semana / Fase', 'Estrategias Metodológicas (DUA)', 'Evaluación', 'Recursos']],
          body: bodySemanasV2,
          headStyles: { fillColor: [218, 234, 138], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7.5, halign: 'center' as const },
          styles: { fontSize: 7, cellPadding: 2, fillColor: [255, 255, 255] },
          columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 105 }, 2: { cellWidth: 50 }, 3: { cellWidth: 68 } }
        })
      }

      const finalY = (doc as any).lastAutoTable.finalY + 5
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(6)
      doc.setTextColor(100, 116, 139)
      doc.text(
        'Esta herramienta pedagógica genera propuestas de planificación basadas en los lineamientos técnicos y formatos socializados en la fase de pilotaje. Es responsabilidad del docente validar y ajustar el contenido conforme a las disposiciones específicas de su institución educativa y distrito.',
        14, finalY, { maxWidth: pageWidth - 28 }
      )

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
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* BARRA SUPERIOR DE ACCIONES Y PESTAÑAS DE FORMATO */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex justify-between items-center flex-wrap gap-4">
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
            </div>
          </div>

          <div className="flex gap-2.5 items-center">
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
                ✏️ Editar Secciones Directamente
              </button>
            )}

            <button
              onClick={generarWordOficial}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              📄 Descargar Word Oficial
            </button>

            <button
              onClick={descargarPDFOficial}
              disabled={generandoPdf}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {generandoPdf ? 'Generando PDF...' : 'Descargar PDF Oficial (Horizontal)'}
            </button>
          </div>
        </div>

        {/* VISTA PREVIA WEB SEGÚN LA PESTAÑA ACTIVA */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-300 p-6 md:p-10 space-y-6 text-slate-800 text-xs">
          
          {/* TABLA 1: DATOS INFORMATIVOS Y SITUACIÓN DE APRENDIZAJE */}
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

          {/* TABLA 2: CONDICIONAL SEGÚN EL FORMATO ACTIVO */}
          {formatoActivo === 'oficial' ? (
            /* FORMATO OFICIAL */
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
                    <strong>Asignaturas / Temas:</strong>{' '}
                    {editando ? (
                      <textarea 
                        rows={2} 
                        value={asignaturasConexion} 
                        onChange={e => setAsignaturasConexion(e.target.value)} 
                        className="w-full p-2 mt-1 border border-indigo-400 rounded-lg bg-indigo-50/50 outline-none resize-y"
                      />
                    ) : (
                      asignaturasConexion || 'N/A'
                    )}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                    Competencias específicas
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="border border-slate-500 p-2 leading-relaxed bg-white">
                    {editando ? (
                      <textarea 
                        rows={3} 
                        value={competenciaEspecifica} 
                        onChange={e => setCompetenciaEspecifica(e.target.value)} 
                        className="w-full p-2 border border-indigo-400 rounded-lg bg-indigo-50/50 outline-none resize-y"
                      />
                    ) : (
                      competenciaEspecifica || (bloquesCompetencias ? bloquesCompetencias.map((b: any, i: number) => `[Bloque ${i+1}] ${b.competencia}`).join('\n') : '')
                    )}
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
            /* FORMATO ACTUALIZADO v2 (2 Columnas) */
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
                    <strong>Asignaturas / Temas:</strong>{' '}
                    {editando ? (
                      <textarea 
                        rows={2} 
                        value={asignaturasConexion} 
                        onChange={e => setAsignaturasConexion(e.target.value)} 
                        className="w-full p-2 mt-1 border border-indigo-400 rounded-lg bg-indigo-50/50 outline-none resize-y"
                      />
                    ) : (
                      asignaturasConexion || 'N/A'
                    )}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a]">
                    Competencias específicas
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-500 p-2 leading-relaxed bg-white">
                    {editando ? (
                      <textarea 
                        rows={3} 
                        value={competenciaEspecifica} 
                        onChange={e => setCompetenciaEspecifica(e.target.value)} 
                        className="w-full p-2 border border-indigo-400 rounded-lg bg-indigo-50/50 outline-none resize-y"
                      />
                    ) : (
                      competenciaEspecifica || (bloquesCompetencias ? bloquesCompetencias.map((b: any, i: number) => `[Bloque ${i+1}] ${b.competencia}`).join('\n') : '')
                    )}
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

          {/* TABLA 3: ESTRATEGIAS METODOLÓGICAS DUA */}
          {formatoActivo === 'oficial' ? (
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
                      {editando ? (
                        <div className="space-y-2 mt-2">
                          <div>
                            <span className="font-bold text-[10px] text-slate-600 block">• Inicio:</span>
                            <textarea rows={2} value={sem.inicio} onChange={e => { const n = [...semanas]; n[sIdx].inicio = e.target.value; setSemanas(n); }} className="w-full p-1.5 border border-indigo-300 rounded bg-indigo-50/30 outline-none" />
                          </div>
                          <div>
                            <span className="font-bold text-[10px] text-slate-600 block">• Desarrollo:</span>
                            <textarea rows={3} value={sem.desarrollo} onChange={e => { const n = [...semanas]; n[sIdx].desarrollo = e.target.value; setSemanas(n); }} className="w-full p-1.5 border border-indigo-300 rounded bg-indigo-50/30 outline-none" />
                          </div>
                          <div>
                            <span className="font-bold text-[10px] text-slate-600 block">• Cierre:</span>
                            <textarea rows={2} value={sem.cierre} onChange={e => { const n = [...semanas]; n[sIdx].cierre = e.target.value; setSemanas(n); }} className="w-full p-1.5 border border-indigo-300 rounded bg-indigo-50/30 outline-none" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p>• <strong>Inicio:</strong> {sem.inicio || 'S/N'}</p>
                          <p>• <strong>Desarrollo:</strong> {sem.desarrollo || 'S/N'}</p>
                          <p>• <strong>Cierre:</strong> {sem.cierre || 'S/N'}</p>
                        </>
                      )}
                    </td>
                    <td className="border border-slate-500 p-2 bg-white">
                      {editando ? (
                        <textarea rows={3} value={sem.recursos} onChange={e => { const n = [...semanas]; n[sIdx].recursos = e.target.value; setSemanas(n); }} className="w-full p-1.5 border border-indigo-300 rounded bg-indigo-50/30 outline-none" />
                      ) : (
                        sem.recursos
                      )}
                    </td>
                    <td className="border border-slate-500 p-2 bg-white">
                      {editando ? (
                        <div className="space-y-1">
                          <input type="text" value={sem.tecnica} onChange={e => { const n = [...semanas]; n[sIdx].tecnica = e.target.value; setSemanas(n); }} className="w-full p-1 border border-indigo-300 rounded bg-indigo-50/30 outline-none text-[11px]" placeholder="Técnica" />
                          <input type="text" value={sem.instrumento} onChange={e => { const n = [...semanas]; n[sIdx].instrumento = e.target.value; setSemanas(n); }} className="w-full p-1 border border-indigo-300 rounded bg-indigo-50/30 outline-none text-[11px]" placeholder="Instrumento" />
                        </div>
                      ) : (
                        <>Técnica: {sem.tecnica}<br/>Instrumento: {sem.instrumento}</>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse border border-slate-500 table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[42%]" />
                <col className="w-[18%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] text-slate-800">Semana / Fase</th>
                  <th className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] text-slate-800">Estrategias Metodológicas (DUA)</th>
                  <th className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] text-slate-800">Evaluación (Técnica e Instrumento)</th>
                  <th className="border border-slate-500 p-2 font-bold text-center bg-[#dbea8a] text-slate-800">Recursos</th>
                </tr>
              </thead>
              <tbody>
                {semanas && semanas.map((sem: any, sIdx: number) => (
                  <tr key={sIdx}>
                    <td className="border border-slate-500 p-2 bg-white space-y-1 align-top">
                      <strong className="block text-slate-900 font-bold">
                        Semana {sem.numero} · {sem.tema || sem.temaSemana || `Tema ${sem.numero}`}
                      </strong>
                      <span className="block text-indigo-700 font-semibold text-[10px]">
                        {sem.indicador || sem.codigoIndicador || obtenerValores(bloquesCompetencias[0], 'indicadores')[sIdx] || 'I.M.2.1.1'}
                      </span>
                    </td>
                    <td className="border border-slate-500 p-2 space-y-1 bg-white">
                      {editando ? (
                        <div className="space-y-2">
                          <textarea rows={2} value={sem.inicio} onChange={e => { const n = [...semanas]; n[sIdx].inicio = e.target.value; setSemanas(n); }} className="w-full p-1 border border-indigo-300 rounded bg-indigo-50/30 text-[11px]" placeholder="Inicio" />
                          <textarea rows={2} value={sem.desarrollo} onChange={e => { const n = [...semanas]; n[sIdx].desarrollo = e.target.value; setSemanas(n); }} className="w-full p-1 border border-indigo-300 rounded bg-indigo-50/30 text-[11px]" placeholder="Desarrollo" />
                          <textarea rows={2} value={sem.cierre} onChange={e => { const n = [...semanas]; n[sIdx].cierre = e.target.value; setSemanas(n); }} className="w-full p-1 border border-indigo-300 rounded bg-indigo-50/30 text-[11px]" placeholder="Cierre" />
                        </div>
                      ) : (
                        <>
                          <p>• <strong>Inicio:</strong> {sem.inicio || 'S/N'}</p>
                          <p>• <strong>Desarrollo:</strong> {sem.desarrollo || 'S/N'}</p>
                          <p>• <strong>Cierre:</strong> {sem.cierre || 'S/N'}</p>
                        </>
                      )}
                    </td>
                    <td className="border border-slate-500 p-2 bg-white">
                      {editando ? (
                        <div className="space-y-1">
                          <input type="text" value={sem.tecnica} onChange={e => { const n = [...semanas]; n[sIdx].tecnica = e.target.value; setSemanas(n); }} className="w-full p-1 border border-indigo-300 rounded text-[11px]" placeholder="Técnica" />
                          <input type="text" value={sem.instrumento} onChange={e => { const n = [...semanas]; n[sIdx].instrumento = e.target.value; setSemanas(n); }} className="w-full p-1 border border-indigo-300 rounded text-[11px]" placeholder="Instrumento" />
                        </div>
                      ) : (
                        <>Técnica: {sem.tecnica}<br/>Instrumento: {sem.instrumento}</>
                      )}
                    </td>
                    <td className="border border-slate-500 p-2 bg-white">
                      {editando ? (
                        <textarea rows={3} value={sem.recursos} onChange={e => { const n = [...semanas]; n[sIdx].recursos = e.target.value; setSemanas(n); }} className="w-full p-1 border border-indigo-300 rounded text-[11px]" />
                      ) : (
                        sem.recursos
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* NOTA AL PIE INSTITUCIONAL */}
          <div className="text-[10px] italic text-slate-500 pt-2 border-t border-slate-200">
            Esta herramienta pedagógica genera propuestas de planificación basadas en los lineamientos técnicos y formatos socializados en la fase de pilotaje. Es responsabilidad del docente validar y ajustar el contenido conforme a las disposiciones específicas de su institución educativa y distrito.
          </div>

        </div>

      </div>
    </div>
  )
}