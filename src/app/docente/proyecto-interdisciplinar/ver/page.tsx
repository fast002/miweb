'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function ContenidoVerProyecto() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const proyectoId = searchParams.get('id')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [generandoWord, setGenerandoWord] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [proyectoRaw, setProyectoRaw] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)

  const normalizarTexto = (valor: any): string => {
    if (!valor) return ''
    if (Array.isArray(valor)) return valor.filter(Boolean).join('\n\n')
    return String(valor).trim()
  }

  // Generador de respaldo en cliente por si un proyecto antiguo no tenía rúbricas separadas por materia
  const construirRubricasPorMateriaFallback = (matriz: any[], productoFinal: string) => {
    return matriz.map((m: any) => {
      const asig = m.asignatura || 'Asignatura'
      const dec = (m.saberes_declarativos || '').split('\n')[0] || `saberes conceptuales de ${asig}`
      const proc = (m.saberes_procedimentales || '').split('\n')[0] || `procedimientos prácticos de ${asig}`
      const ind = (m.indicadores_evaluacion || '').split('\n')[0] || `indicador de evaluación de ${asig}`
      const act = (m.saberes_actitudinales || '').split('\n')[0] || `compromiso y trabajo cooperativo`

      return {
        asignatura: asig,
        criterios: [
          {
            criterio: `1. Dominio Conceptual (${dec.substring(0, 48)}...)`,
            destacado: `Comprende y explica con solvencia los conceptos de "${dec}" aplicándolos al desafío.`,
            esperado: `Comprende y aplica adecuadamente los conceptos principales de "${dec}".`,
            proceso: `Identifica de forma parcial o con imprecisiones los conceptos de "${dec}".`,
            apoyo: `Requiere acompañamiento personalizado para comprender los saberes básicos de ${asig}.`
          },
          {
            criterio: `2. Ejecución Procedimental (${proc.substring(0, 48)}...)`,
            destacado: `Ejecuta de manera autónoma, ordenada y rigurosa las actividades de "${proc}".`,
            esperado: `Aplica satisfactoriamente los procedimientos de "${proc}" en las fases del proyecto.`,
            proceso: `Desarrolla parcialmente los procedimientos o presenta errores metodológicos.`,
            apoyo: `Necesita guía paso a paso para completar las actividades prácticas de ${asig}.`
          },
          {
            criterio: `3. Logro del Indicador (${ind.substring(0, 45)}...)`,
            destacado: `Evidencia de forma sobresaliente el desempeño establecido en: "${ind}".`,
            esperado: `Alcanza satisfactoriamente el nivel de logro esperado en el indicador de ${asig}.`,
            proceso: `Evidencia un avance parcial respecto al indicador de evaluación seleccionado.`,
            apoyo: `Aún no alcanza el desempeño mínimo requerido por el indicador de ${asig}.`
          },
          {
            criterio: `4. Aporte de ${asig} al Producto Final`,
            destacado: `El insumo elaborado en ${asig} para "${productoFinal}" destaca por su rigor técnico y claridad.`,
            esperado: `Entrega el aporte disciplinar de ${asig} completo y articulado al producto común.`,
            proceso: `El aporte elaborado en ${asig} es básico o poco articulado con el producto final.`,
            apoyo: `Requiere apoyo directo para elaborar la sección correspondiente de ${asig}.`
          },
          {
            criterio: `5. Desempeño Actitudinal (${act.substring(0, 45)}...)`,
            destacado: `Demuestra liderazgo, empatía y vivencia constante de: "${act}".`,
            esperado: `Cumple su rol en el equipo practicando responsablemente: "${act}".`,
            proceso: `Participa de manera intermitente en las tareas colaborativas del equipo.`,
            apoyo: `Requiere mediación continua del docente para integrarse al trabajo grupal.`
          }
        ]
      }
    })
  }

  useEffect(() => {
    async function cargar() {
      if (!proyectoId) {
        setCargando(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('planificaciones_microcurriculares')
          .select('*, instituciones(*)')
          .eq('id', proyectoId)
          .maybeSingle()

        if (error || !data) {
          console.error('Error cargando proyecto:', error)
          setCargando(false)
          return
        }

        setProyectoRaw(data)

        let estructura = data.filas_saberes
        if (typeof estructura === 'string') {
          try {
            estructura = JSON.parse(estructura)
          } catch (e) {
            estructura = null
          }
        }

        const listaMaterias = (data.asignaturas_conexion || 'Matemática, Lengua y Literatura, Ciencias Naturales, Estudios Sociales, Inglés, Educación Física, ECA')
          .split(',')
          .map((m: string) => m.trim())
          .filter(Boolean)

        const matrizFuente = (Array.isArray(data.bloques_competencias) && data.bloques_competencias.length > 0)
          ? data.bloques_competencias
          : (Array.isArray(estructura?.matriz_curricular) ? estructura.matriz_curricular : [])

        const matrizNormalizada = matrizFuente.length > 0
          ? matrizFuente.map((item: any) => ({
              asignatura: item.asignatura || 'General',
              competencias_especificas: normalizarTexto(item.competencias_especificas || item.competencia),
              indicadores_evaluacion: normalizarTexto(item.indicadores_evaluacion || item.indicador || item.indicadores),
              saberes_declarativos: normalizarTexto(item.saberes_declarativos || item.declarativo || item.declarativos),
              saberes_procedimentales: normalizarTexto(item.saberes_procedimentales || item.procedimental || item.procedimentales),
              saberes_actitudinales: normalizarTexto(item.saberes_actitudinales || item.actitudinal || item.actitudinales)
            }))
          : listaMaterias.map((m: string) => ({
              asignatura: m,
              competencias_especificas: `Competencias específicas de ${m}`,
              indicadores_evaluacion: `Indicadores de evaluación de ${m}`,
              saberes_declarativos: `Saberes declarativos de ${m}`,
              saberes_procedimentales: `Saberes procedimentales de ${m}`,
              saberes_actitudinales: `Saberes actitudinales de ${m}`
            }))

        if (!estructura || typeof estructura !== 'object') {
          estructura = {
            titulo: data.titulo_sia || 'Proyecto Interdisciplinar Oficial',
            objetivo_proyecto: `Investigar y aplicar saberes en ${data.grado_curso} para resolver el desafío propuesto.`,
            descripcion_proyecto: data.descripcion_sia || '',
            desafio: data.competencia_especifica || '¿Cómo podemos integrar los saberes de las asignaturas para responder al desafío?',
            producto: 'Guía colectiva o muestra demostrativa integradora',
            matriz_curricular: matrizNormalizada,
            fases_proyecto: [
              { fase: "1. Planificación", pregunta_orientadora: "¿Qué vamos a investigar y para qué?", resultado: "Propósito, desafío y preguntas" },
              { fase: "2. Organización o investigación (asignación de roles)", pregunta_orientadora: "¿Cómo vamos a hacerlo?", resultado: "Plan de trabajo" },
              { fase: "3. Ejecución e integración de saberes para la creación del producto", pregunta_orientadora: "¿Cómo resolvemos el desafío?", resultado: "Producto + evidencias" },
              { fase: "4. Socialización, presentación y difusión", pregunta_orientadora: "¿Qué descubrimos y cómo lo comunicamos?", resultado: "Presentación del producto" },
              { fase: "5. Evaluación, reflexión y metacognición", pregunta_orientadora: "¿Qué aprendimos y qué podemos mejorar?", resultado: "Metacognición y compromisos" }
            ],
            actividades_por_materia: Array.isArray(data.semanas) && data.semanas.length > 0 ? data.semanas : [],
            rubricas_disciplinares_por_materia: construirRubricasPorMateriaFallback(matrizNormalizada, 'Producto integrador'),
            rubrica_interdisciplinar: [
              { criterio: "Integración de aprendizajes", destacado: "El producto integra de manera clara y coherente aprendizajes de varias asignaturas.", esperado: "El producto relaciona aprendizajes de varias asignaturas de manera adecuada.", proceso: "Aportes de distintas asignaturas poco relacionados entre sí.", apoyo: "Los aportes aparecen aislados y no evidencian integración." },
              { criterio: "Respuesta al desafío", destacado: "Las propuestas responden claramente al desafío sustentadas en la investigación.", esperado: "Las propuestas responden al desafío y a los principales hallazgos.", proceso: "Las propuestas responden parcialmente o con poca relación.", apoyo: "Las propuestas no responden claramente al desafío planteado." },
              { criterio: "Uso de evidencias", destacado: "Utiliza datos, observaciones y evidencias para explicar y justificar conclusiones.", esperado: "Utiliza evidencias pertinentes para sustentar la mayoría de conclusiones.", proceso: "Utiliza algunas evidencias pero no siempre las relaciona.", apoyo: "Presenta conclusiones sin utilizar evidencias recogidas." },
              { criterio: "Comunicación del producto", destacado: "Comunica hallazgos de manera clara y organizada mediante recursos multimodales.", esperado: "Comunica de manera clara los principales hallazgos y propuestas.", proceso: "La comunicación presenta dificultades de organización o claridad.", apoyo: "Requiere acompañamiento para comunicar los principales hallazgos." },
              { criterio: "Creatividad y pertinencia", destacado: "Presenta acciones creativas, realistas y posibles de aplicar en la vida cotidiana.", esperado: "Presenta acciones pertinentes y posibles de aplicar.", proceso: "Presenta acciones generales o poco contextualizadas.", apoyo: "Las acciones propuestas son poco viables o desarticuladas." },
              { criterio: "Trabajo colaborativo", destacado: "Todos los integrantes participan, asumen responsabilidades y contribuyen activamente.", esperado: "La mayoría participa y cumple las responsabilidades acordadas.", proceso: "La participación y distribución de responsabilidades es desigual.", apoyo: "El equipo requiere acompañamiento constante para trabajar conjuntamente." }
            ]
          }
        } else {
          estructura.matriz_curricular = matrizNormalizada

          // Si el registro no tiene rubricas_disciplinares_por_materia pero sí matriz, las construimos por asignatura
          if (!Array.isArray(estructura.rubricas_disciplinares_por_materia) || estructura.rubricas_disciplinares_por_materia.length === 0) {
            estructura.rubricas_disciplinares_por_materia = construirRubricasPorMateriaFallback(
              matrizNormalizada,
              estructura.producto || 'Producto final común'
            )
          }
        }

        if ((!estructura.actividades_por_materia || estructura.actividades_por_materia.length === 0) && Array.isArray(data.semanas) && data.semanas.length > 0) {
          estructura.actividades_por_materia = data.semanas
        }

        setPlan(estructura)
      } catch (err) {
        console.error('Error general al cargar:', err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [proyectoId])

  const handleGuardarCambios = async () => {
    setGuardando(true)
    setMensaje(null)
    try {
      const { error } = await supabase
        .from('planificaciones_microcurriculares')
        .update({
          titulo_sia: plan.titulo,
          descripcion_sia: plan.descripcion_proyecto,
          competencia_especifica: plan.desafio,
          bloques_competencias: plan.matriz_curricular,
          semanas: plan.actividades_por_materia,
          filas_saberes: plan
        })
        .eq('id', proyectoId)

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: '¡Todos los cambios han sido guardados correctamente en la base de datos!' })
      setModoEdicion(false)
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar los cambios: ' + e.message })
    } finally {
      setGuardando(false)
    }
  }

  const handleDescargarPDF = async () => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('p', 'mm', 'a4')

      const colorAzulEncabezado = [217, 226, 243] as [number, number, number]
      const colorGrisSub = [237, 237, 237] as [number, number, number]
      const colorTexto = [0, 0, 0] as [number, number, number]

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('PROYECTO INTERDISCIPLINAR PARA LA EVALUACIÓN SUMATIVA', 105, 14, { align: 'center' })

      const infoBody = [
        [
          { content: `Institución educativa: ${proyectoRaw?.instituciones?.nombre_institucion || '16 DE ABRIL'}`, styles: { fontStyle: 'bold' as const } },
          { content: `Año lectivo: ${proyectoRaw?.instituciones?.anio_lectivo_activo || '2026–2027'}`, styles: { fontStyle: 'bold' as const } }
        ],
        [
          `Grado/Curso y paralelo: ${proyectoRaw?.grado_curso || ''} "${proyectoRaw?.paralelo || 'A'}"`,
          `Docentes: Lic. Fernando Urgilez / Equipo Docente`
        ],
        [
          `Duración: ${proyectoRaw?.no_semanas || 2} semanas`,
          `Trimestre: ${proyectoRaw?.trimestre || '1'}`
        ],
        [
          { content: `Asignaturas: ${proyectoRaw?.asignaturas_conexion || ''}`, colSpan: 2 }
        ],
        [
          { content: `Proyecto interdisciplinar: “${plan.titulo || ''}”`, colSpan: 2, styles: { fontStyle: 'bold' as const } }
        ],
        [
          { content: `Objetivo del proyecto: ${plan.objetivo_proyecto || ''}`, colSpan: 2 }
        ],
        [
          { content: `Descripción del proyecto: ${plan.descripcion_proyecto || ''}`, colSpan: 2 }
        ],
        [
          { content: `Desafío: ${plan.desafio || ''}`, colSpan: 2, styles: { fontStyle: 'italic' as const } }
        ],
        [
          { content: `Producto: ${plan.producto || ''}`, colSpan: 2, styles: { fontStyle: 'bold' as const } }
        ]
      ]

      autoTable(doc, {
        startY: 18,
        theme: 'grid',
        body: infoBody,
        styles: { fontSize: 7, cellPadding: 2, textColor: colorTexto, lineColor: [0, 0, 0], lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 93 }, 1: { cellWidth: 93 } }
      })

      const matrizRows = (plan.matriz_curricular || []).map((m: any) => [
        m.asignatura || '',
        m.competencias_especificas || '',
        m.indicadores_evaluacion || '',
        m.saberes_declarativos || '',
        m.saberes_procedimentales || '',
        m.saberes_actitudinales || ''
      ])

      const yMatriz = (doc as any).lastAutoTable.finalY + 4
      doc.setFontSize(8.5)
      doc.text('Planificación del proyecto interdisciplinar', 12, yMatriz)

      autoTable(doc, {
        startY: yMatriz + 2,
        theme: 'grid',
        head: [
          [
            { content: 'Asignatura', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
            { content: 'Competencias específicas', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
            { content: 'Indicadores de evaluación', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
            { content: 'Saberes', colSpan: 3, styles: { halign: 'center' as const } }
          ],
          [
            { content: 'Declarativos', styles: { halign: 'center' as const } },
            { content: 'Procedimentales', styles: { halign: 'center' as const } },
            { content: 'Actitudinales', styles: { halign: 'center' as const } }
          ]
        ],
        body: matrizRows,
        headStyles: { fillColor: colorAzulEncabezado, textColor: colorTexto, fontStyle: 'bold', fontSize: 6.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
        styles: { fontSize: 6, cellPadding: 1.8, textColor: colorTexto, lineColor: [0, 0, 0], lineWidth: 0.2 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 42 },
          2: { cellWidth: 38 },
          3: { cellWidth: 28 },
          4: { cellWidth: 30 },
          5: { cellWidth: 26 }
        }
      })

      const yFases = (doc as any).lastAutoTable.finalY + 4
      doc.setFontSize(8.5)
      doc.text('FASES', 12, yFases)

      const fasesRows = (plan.fases_proyecto || []).map((f: any) => [
        f.fase,
        f.pregunta_orientadora,
        f.resultado
      ])

      autoTable(doc, {
        startY: yFases + 2,
        theme: 'grid',
        head: [['Fase', 'Pregunta orientadora', 'Resultado']],
        body: fasesRows,
        headStyles: { fillColor: colorAzulEncabezado, textColor: colorTexto, fontStyle: 'bold', fontSize: 7, lineColor: [0, 0, 0], lineWidth: 0.2 },
        styles: { fontSize: 6.5, cellPadding: 2, textColor: colorTexto, lineColor: [0, 0, 0], lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 70 }, 2: { cellWidth: 61 } }
      })

      let yActual = (doc as any).lastAutoTable.finalY + 4

      ;(plan.actividades_por_materia || []).forEach((asigItem: any, idx: number) => {
        const bodyMateria = (asigItem.fases || []).map((f: any) => [
          f.fase_titulo,
          `Pregunta orientadora: ${f.pregunta_orientadora}\n\nActividades:\n${f.actividades}`,
          f.recursos
        ])

        autoTable(doc, {
          startY: yActual + 2,
          theme: 'grid',
          head: [
            [{ content: `${idx + 1}. (${asigItem.asignatura.toUpperCase()}): PROYECTO INTERDISCIPLINARIO – SEMANA 1 y 2`, colSpan: 3, styles: { fillColor: colorAzulEncabezado, textColor: colorTexto, fontStyle: 'bold', fontSize: 7.5, halign: 'left' as const } }],
            ['FASE:', 'ACTIVIDADES', 'RECURSOS']
          ],
          body: bodyMateria,
          headStyles: { fillColor: colorGrisSub, textColor: colorTexto, fontStyle: 'bold', fontSize: 7, lineColor: [0, 0, 0], lineWidth: 0.2 },
          styles: { fontSize: 6.2, cellPadding: 2, textColor: colorTexto, lineColor: [0, 0, 0], lineWidth: 0.2 },
          columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 104 }, 2: { cellWidth: 40 } }
        })

        yActual = (doc as any).lastAutoTable.finalY + 4
      })

      // 1. RÚBRICAS DISCIPLINARES POR CADA ASIGNATURA EN PDF
      doc.setFontSize(8.5)
      doc.text('1. Instrumentos de Evaluación Disciplinar por Asignatura (Rúbricas Analíticas)', 12, yActual)
      yActual += 2

      ;(plan.rubricas_disciplinares_por_materia || []).forEach((rubAsig: any, rIdx: number) => {
        const filasCriterios = (rubAsig.criterios || []).map((c: any) => [
          c.criterio || '',
          c.destacado || '',
          c.esperado || '',
          c.proceso || '',
          c.apoyo || ''
        ])

        autoTable(doc, {
          startY: yActual + 2,
          theme: 'grid',
          head: [
            [{ content: `1.${rIdx + 1}. RÚBRICA ANALÍTICA DISCIPLINAR – ${String(rubAsig.asignatura || '').toUpperCase()} (Puntaje máx: 20 pts)`, colSpan: 5, styles: { fillColor: colorAzulEncabezado, textColor: colorTexto, fontStyle: 'bold', fontSize: 7, halign: 'left' as const } }],
            ['Criterio Disciplinar (' + rubAsig.asignatura + ')', '4 – Logro destacado', '3 – Logro esperado', '2 – En proceso', '1 – Requiere apoyo']
          ],
          body: filasCriterios,
          headStyles: { fillColor: colorGrisSub, textColor: colorTexto, fontStyle: 'bold', fontSize: 6.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
          styles: { fontSize: 6, cellPadding: 1.8, textColor: colorTexto, lineColor: [0, 0, 0], lineWidth: 0.2 },
          columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 37 }, 2: { cellWidth: 37 }, 3: { cellWidth: 37 }, 4: { cellWidth: 37 } }
        })

        yActual = (doc as any).lastAutoTable.finalY + 3
      })

      // 2. RÚBRICA INTERDISCIPLINAR ÚNICA EN PDF
      doc.setFontSize(8.5)
      doc.text('2. Instrumento de Evaluación Interdisciplinar (Producto Final Común)', 12, yActual + 2)

      const rubRows = (plan.rubrica_interdisciplinar || []).map((r: any) => [
        r.criterio,
        r.destacado,
        r.esperado,
        r.proceso,
        r.apoyo
      ])

      autoTable(doc, {
        startY: yActual + 4,
        theme: 'grid',
        head: [['Criterio Interdisciplinar', '4 – Logro destacado', '3 – Logro esperado', '2 – En proceso', '1 – Requiere apoyo']],
        body: rubRows,
        headStyles: { fillColor: colorAzulEncabezado, textColor: colorTexto, fontStyle: 'bold', fontSize: 6.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
        styles: { fontSize: 6, cellPadding: 1.8, textColor: colorTexto, lineColor: [0, 0, 0], lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 37 }, 2: { cellWidth: 37 }, 3: { cellWidth: 37 }, 4: { cellWidth: 37 } }
      })

      const yFirmas = (doc as any).lastAutoTable.finalY + 6
      autoTable(doc, {
        startY: yFirmas,
        theme: 'grid',
        body: [
          [
            'REALIZADO POR:\n\n\n\nLic. Fernando Urgilez\nFECHA: ___________________',
            'REVISADO POR:\n\n\n\nComisión Técnico-Pedagógica\nFECHA: ___________________',
            'APROBADO POR:\n\n\n\nAutoridad Institucional\nFECHA: ___________________'
          ]
        ],
        styles: { fontSize: 7, cellPadding: 3, textColor: colorTexto, lineColor: [0, 0, 0], lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 62 }, 2: { cellWidth: 62 } }
      })

      doc.save(`Proyecto_Interdisciplinar_${proyectoRaw?.grado_curso || '8vo_EGB'}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF del proyecto.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  const handleDescargarWord = () => {
    setGenerandoWord(true)
    try {
      const elemento = document.getElementById('imprimible-proyecto')
      if (!elemento) return

      const contenidoHtml = elemento.innerHTML

      const wordTemplate = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Proyecto Interdisciplinar</title>
          <style>
            @page Section1 {
              size: 595.3pt 841.9pt;
              margin: 34pt 34pt 34pt 34pt;
              mso-header-margin: 18pt;
              mso-footer-margin: 18pt;
              mso-paper-source: 0;
            }
            div.Section1 { page: Section1; }
            body { font-family: "Calibri", "Arial", sans-serif; font-size: 8.5pt; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
            th, td { border: 1pt solid #000; padding: 4pt; vertical-align: top; }
            th, .bg-header { background-color: #d9e2f3; font-weight: bold; text-align: center; }
            .bg-sub-header { background-color: #ededed; font-weight: bold; text-align: center; }
            .info-box { border: 1pt solid #000; padding: 6pt; margin-bottom: 8pt; }
            .main-title { font-size: 11pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 8pt; }
            .section-subtitle { font-size: 9.5pt; font-weight: bold; margin: 8pt 0 4pt 0; }
            .nota-calculo { border: 1pt solid #000; background-color: #f9f9f9; padding: 5pt; font-size: 8pt; margin-bottom: 8pt; }
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
      const a = document.createElement('a')
      a.href = url
      a.download = `Proyecto_Interdisciplinar_${proyectoRaw?.grado_curso || '8vo_EGB'}.doc`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('Error al generar el archivo Word.')
    } finally {
      setGenerandoWord(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Proyecto Interdisciplinar...</p>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="p-12 text-center text-xs font-bold text-slate-500 bg-white rounded-3xl border border-slate-200 max-w-xl mx-auto my-12 space-y-3">
        <p>No se encontró la información del proyecto interdisciplinar (ID: {proyectoId || 'Sin ID'}).</p>
        <button
          onClick={() => router.push('/docente/planificador')}
          className="px-4 py-2 bg-[#4b4c99] text-white rounded-xl text-xs font-bold"
        >
          Volver a Mis Planificaciones
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-3 md:p-6 print:p-0 print:bg-white font-sans space-y-4 w-full">
      
      {/* BARRA SUPERIOR DE ACCIONES */}
      <div className="w-full bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <button
            onClick={() => router.push('/docente/planificador')}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center gap-1.5 cursor-pointer mb-1"
          >
            ← Volver al Panel
          </button>
          <h1 className="text-base font-bold text-slate-900">
            {plan.titulo || 'Proyecto Interdisciplinar Oficial'}
          </h1>
          <p className="text-[11px] text-slate-500">Evaluación Sumativa Trimestral (Actividades y Rúbricas Analíticas por Asignatura)</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setModoEdicion(!modoEdicion)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer border ${
              modoEdicion ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            {modoEdicion ? '✕ Terminar Edición' : 'Editar Celdas'}
          </button>

          {modoEdicion && (
            <button
              type="button"
              onClick={handleGuardarCambios}
              disabled={guardando}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          )}

          <button
            type="button"
            onClick={handleDescargarPDF}
            disabled={generandoPdf}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-3.5 py-2 text-white font-bold text-xs rounded-xl shadow-2xs hover:opacity-95 transition cursor-pointer flex items-center gap-1.5"
          >
            {generandoPdf ? 'Generando PDF...' : 'PDF'}
          </button>

          <button
            type="button"
            onClick={handleDescargarWord}
            disabled={generandoWord}
            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
          >
            {generandoWord ? 'Generando Word...' : 'Descargar Word'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
          >
            Imprimir
          </button>
        </div>
      </div>

      {mensaje && (
        <div className={`w-full p-4 rounded-2xl text-xs font-bold border shadow-2xs print:hidden ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* CONTENEDOR VISUALIZADOR */}
      <div 
        id="imprimible-proyecto"
        className="w-full bg-white p-6 md:p-10 shadow-md border border-slate-200 text-black print:p-0 print:border-none print:shadow-none print:max-w-[186mm] print:mx-auto"
        style={{ fontFamily: '"Calibri", "Arial", sans-serif', fontSize: '9pt', lineHeight: '1.25' }}
      >

        {/* TÍTULO PRINCIPAL */}
        <div className="font-bold text-center uppercase mb-3" style={{ fontSize: '11.5pt' }}>
          PROYECTO INTERDISCIPLINAR PARA LA EVALUACIÓN SUMATIVA
        </div>

        {/* 1. DATOS INFORMATIVOS */}
        <div className="border border-black p-3.5 mb-3.5 text-justify">
          <div className="font-bold uppercase mb-2 border-b border-black pb-1">
            Datos informativos
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 mb-2">
            <div><strong>Institución educativa:</strong> {proyectoRaw?.instituciones?.nombre_institucion || '16 DE ABRIL'}</div>
            <div><strong>Año lectivo:</strong> {proyectoRaw?.instituciones?.anio_lectivo_activo || '2026–2027'}</div>
            <div><strong>Grado/Curso y paralelo:</strong> {proyectoRaw?.grado_curso} "{proyectoRaw?.paralelo || 'A'}"</div>
            <div><strong>Docentes:</strong> Lic. Fernando Urgilez / Equipo Docente</div>
            <div><strong>Duración:</strong> {proyectoRaw?.no_semanas || 2} semanas</div>
            <div><strong>Trimestre:</strong> {proyectoRaw?.trimestre || '1'}</div>
          </div>
          <p className="my-1.5">
            <strong>Asignaturas:</strong> {proyectoRaw?.asignaturas_conexion || ''}
          </p>
          <hr className="border-t border-black my-2" />
          
          <div className="my-1.5">
            <strong>Proyecto interdisciplinar:</strong>{' '}
            {modoEdicion ? (
              <input
                type="text"
                value={plan.titulo || ''}
                onChange={(e) => setPlan({ ...plan, titulo: e.target.value })}
                className="w-full p-1.5 border border-slate-300 font-bold mt-1 text-sm"
              />
            ) : (
              <span>“{plan.titulo}”</span>
            )}
          </div>

          <div className="my-1.5">
            <strong>Objetivo del proyecto:</strong>{' '}
            {modoEdicion ? (
              <textarea
                rows={3}
                value={plan.objetivo_proyecto || ''}
                onChange={(e) => setPlan({ ...plan, objetivo_proyecto: e.target.value })}
                className="w-full p-1.5 border border-slate-300 mt-1"
              />
            ) : (
              <span>{plan.objetivo_proyecto}</span>
            )}
          </div>

          <div className="my-1.5">
            <strong>Descripción del proyecto:</strong>{' '}
            {modoEdicion ? (
              <textarea
                rows={4}
                value={plan.descripcion_proyecto || ''}
                onChange={(e) => setPlan({ ...plan, descripcion_proyecto: e.target.value })}
                className="w-full p-1.5 border border-slate-300 mt-1"
              />
            ) : (
              <span>{plan.descripcion_proyecto}</span>
            )}
          </div>

          <div className="my-1.5">
            <strong>Desafío:</strong>{' '}
            {modoEdicion ? (
              <textarea
                rows={2}
                value={plan.desafio || ''}
                onChange={(e) => setPlan({ ...plan, desafio: e.target.value })}
                className="w-full p-1.5 border border-slate-300 italic mt-1"
              />
            ) : (
              <span className="italic">{plan.desafio}</span>
            )}
          </div>

          <div className="my-1.5">
            <strong>Producto:</strong>{' '}
            {modoEdicion ? (
              <textarea
                rows={2}
                value={plan.producto || ''}
                onChange={(e) => setPlan({ ...plan, producto: e.target.value })}
                className="w-full p-1.5 border border-slate-300 font-bold mt-1"
              />
            ) : (
              <span>{plan.producto}</span>
            )}
          </div>
        </div>

        {/* 2. MATRIZ CURRICULAR (6 COLUMNAS CON DESGLOSE FIEL 1 A 1) */}
        <div className="font-bold my-2" style={{ fontSize: '9.5pt' }}>
          Planificación del proyecto interdisciplinar
        </div>
        <div className="w-full overflow-x-auto mb-3.5">
          <table className="w-full border-collapse border border-black text-left">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#d9e2f3', width: '13%' }}>Asignatura</th>
                <th rowSpan={2} className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#d9e2f3', width: '22%' }}>Competencias específicas</th>
                <th rowSpan={2} className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#d9e2f3', width: '20%' }}>Indicadores de evaluación</th>
                <th colSpan={3} className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#d9e2f3' }}>Saberes</th>
              </tr>
              <tr>
                <th className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#d9e2f3', width: '15%' }}>Declarativos</th>
                <th className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#d9e2f3', width: '15%' }}>Procedimentales</th>
                <th className="border border-black p-1.5 text-center font-bold" style={{ backgroundColor: '#d9e2f3', width: '15%' }}>Actitudinales</th>
              </tr>
            </thead>
            <tbody>
              {(plan.matriz_curricular || []).map((item: any, idx: number) => (
                <tr key={idx} className="align-top">
                  <td className="border border-black p-1.5 font-bold">{item.asignatura}</td>
                  <td className="border border-black p-1.5 text-justify">
                    {modoEdicion ? (
                      <textarea
                        rows={5}
                        value={item.competencias_especificas || ''}
                        onChange={(e) => {
                          const nueva = [...plan.matriz_curricular]
                          nueva[idx] = { ...nueva[idx], competencias_especificas: e.target.value }
                          setPlan({ ...plan, matriz_curricular: nueva })
                        }}
                        className="w-full p-1 border text-[8pt]"
                      />
                    ) : (
                      <p className="whitespace-pre-line leading-relaxed">{item.competencias_especificas}</p>
                    )}
                  </td>
                  <td className="border border-black p-1.5 text-justify">
                    {modoEdicion ? (
                      <textarea
                        rows={5}
                        value={item.indicadores_evaluacion || ''}
                        onChange={(e) => {
                          const nueva = [...plan.matriz_curricular]
                          nueva[idx] = { ...nueva[idx], indicadores_evaluacion: e.target.value }
                          setPlan({ ...plan, matriz_curricular: nueva })
                        }}
                        className="w-full p-1 border text-[8pt]"
                      />
                    ) : (
                      <p className="whitespace-pre-line leading-relaxed">{item.indicadores_evaluacion}</p>
                    )}
                  </td>
                  <td className="border border-black p-1.5">
                    {modoEdicion ? (
                      <textarea
                        rows={5}
                        value={item.saberes_declarativos || ''}
                        onChange={(e) => {
                          const nueva = [...plan.matriz_curricular]
                          nueva[idx] = { ...nueva[idx], saberes_declarativos: e.target.value }
                          setPlan({ ...plan, matriz_curricular: nueva })
                        }}
                        className="w-full p-1 border text-[8pt]"
                      />
                    ) : (
                      <p className="whitespace-pre-line leading-relaxed">{item.saberes_declarativos}</p>
                    )}
                  </td>
                  <td className="border border-black p-1.5">
                    {modoEdicion ? (
                      <textarea
                        rows={5}
                        value={item.saberes_procedimentales || ''}
                        onChange={(e) => {
                          const nueva = [...plan.matriz_curricular]
                          nueva[idx] = { ...nueva[idx], saberes_procedimentales: e.target.value }
                          setPlan({ ...plan, matriz_curricular: nueva })
                        }}
                        className="w-full p-1 border text-[8pt]"
                      />
                    ) : (
                      <p className="whitespace-pre-line leading-relaxed">{item.saberes_procedimentales}</p>
                    )}
                  </td>
                  <td className="border border-black p-1.5">
                    {modoEdicion ? (
                      <textarea
                        rows={5}
                        value={item.saberes_actitudinales || ''}
                        onChange={(e) => {
                          const nueva = [...plan.matriz_curricular]
                          nueva[idx] = { ...nueva[idx], saberes_actitudinales: e.target.value }
                          setPlan({ ...plan, matriz_curricular: nueva })
                        }}
                        className="w-full p-1 border text-[8pt]"
                      />
                    ) : (
                      <p className="whitespace-pre-line leading-relaxed">{item.saberes_actitudinales}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3. FASES GENERALES */}
        <div className="font-bold my-2" style={{ fontSize: '9.5pt' }}>FASES</div>
        <div className="w-full overflow-x-auto mb-4">
          <table className="w-full border-collapse border border-black text-left">
            <thead>
              <tr style={{ backgroundColor: '#d9e2f3' }}>
                <th className="border border-black p-1.5 font-bold text-center" style={{ width: '25%' }}>Fase</th>
                <th className="border border-black p-1.5 font-bold text-center" style={{ width: '40%' }}>Pregunta orientadora</th>
                <th className="border border-black p-1.5 font-bold text-center" style={{ width: '35%' }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {(plan.fases_proyecto || []).map((f: any, i: number) => (
                <tr key={i} className="align-top">
                  <td className="border border-black p-1.5 font-bold">{f.fase}</td>
                  <td className="border border-black p-1.5 italic">{f.pregunta_orientadora}</td>
                  <td className="border border-black p-1.5 font-semibold">{f.resultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. TABLAS INDIVIDUALES DE ACTIVIDADES POR ASIGNATURA */}
        <div className="font-bold my-3" style={{ fontSize: '10pt', textTransform: 'uppercase' }}>
          Planificación por Asignatura (Fases, Actividades y Recursos)
        </div>

        {(plan.actividades_por_materia || []).map((asigItem: any, asigIdx: number) => (
          <div key={asigIdx} className="mb-4 page-break-inside-avoid w-full overflow-x-auto">
            <table className="w-full border-collapse border border-black text-left">
              <thead>
                <tr>
                  <th 
                    colSpan={3} 
                    className="border border-black p-2 font-bold text-left uppercase"
                    style={{ backgroundColor: '#d9e2f3', fontSize: '9pt' }}
                  >
                    {asigIdx + 1}. ({asigItem.asignatura.toUpperCase()}): PROYECTO INTERDISCIPLINARIO – SEMANA 1 y 2
                  </th>
                </tr>
                <tr style={{ backgroundColor: '#ededed' }}>
                  <th className="border border-black p-1.5 font-bold text-left" style={{ width: '22%' }}>FASE:</th>
                  <th className="border border-black p-1.5 font-bold text-left" style={{ width: '54%' }}>ACTIVIDADES</th>
                  <th className="border border-black p-1.5 font-bold text-left" style={{ width: '24%' }}>RECURSOS</th>
                </tr>
              </thead>
              <tbody>
                {(asigItem.fases || []).map((fase: any, fIdx: number) => (
                  <tr key={fIdx} className="align-top">
                    <td className="border border-black p-2 font-bold">
                      {fase.fase_titulo}
                    </td>
                    <td className="border border-black p-2 text-justify">
                      <p className="italic text-slate-700 mb-1.5 text-[8.5pt]">
                        <strong>Pregunta orientadora:</strong> {fase.pregunta_orientadora}
                      </p>
                      <strong className="block text-[8.5pt] uppercase mb-1">Actividades:</strong>
                      {modoEdicion ? (
                        <textarea
                          rows={4}
                          value={fase.actividades || ''}
                          onChange={(e) => {
                            const copia = [...plan.actividades_por_materia]
                            copia[asigIdx].fases[fIdx].actividades = e.target.value
                            setPlan({ ...plan, actividades_por_materia: copia })
                          }}
                          className="w-full p-1 border text-[8pt]"
                        />
                      ) : (
                        <p className="whitespace-pre-line text-[8.5pt] leading-relaxed">{fase.actividades}</p>
                      )}
                    </td>
                    <td className="border border-black p-2">
                      {modoEdicion ? (
                        <textarea
                          rows={4}
                          value={fase.recursos || ''}
                          onChange={(e) => {
                            const copia = [...plan.actividades_por_materia]
                            copia[asigIdx].fases[fIdx].recursos = e.target.value
                            setPlan({ ...plan, actividades_por_materia: copia })
                          }}
                          className="w-full p-1 border text-[8pt]"
                        />
                      ) : (
                        <p className="whitespace-pre-line text-[8.5pt]">{fase.recursos}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* =========================================================================
            5. RÚBRICAS ANALÍTICAS DISCIPLINARES (UNA TABLA POR CADA ASIGNATURA)
            ========================================================================= */}
        <div className="font-bold mt-5 mb-2" style={{ fontSize: '10pt', textTransform: 'uppercase' }}>
          1. Instrumentos de Evaluación Disciplinar por Asignatura (Rúbricas Analíticas)
        </div>
        <p className="text-[8pt] mb-3">
          <strong>Proyecto:</strong> {plan.titulo} | <strong>Grado:</strong> {proyectoRaw?.grado_curso} | <strong>Técnica:</strong> Análisis del desempeño disciplinar | <strong>Instrumento:</strong> Rúbrica analítica específica por materia.
        </p>

        {(plan.rubricas_disciplinares_por_materia || []).map((rubAsig: any, rIdx: number) => (
          <div key={rIdx} className="mb-4 page-break-inside-avoid w-full overflow-x-auto">
            <table className="w-full border-collapse border border-black text-left">
              <thead>
                <tr>
                  <th 
                    colSpan={5} 
                    className="border border-black p-2 font-bold text-left uppercase"
                    style={{ backgroundColor: '#d9e2f3', fontSize: '8.5pt' }}
                  >
                    1.{rIdx + 1}. RÚBRICA ANALÍTICA DISCIPLINAR: {String(rubAsig.asignatura || '').toUpperCase()} (Puntaje máximo: 20 puntos)
                  </th>
                </tr>
                <tr style={{ backgroundColor: '#ededed' }}>
                  <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>Criterio disciplinar ({rubAsig.asignatura})</th>
                  <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>4 – Logro destacado</th>
                  <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>3 – Logro esperado</th>
                  <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>2 – En proceso</th>
                  <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>1 – Requiere apoyo</th>
                </tr>
              </thead>
              <tbody>
                {(rubAsig.criterios || []).map((crit: any, cIdx: number) => (
                  <tr key={cIdx} className="align-top text-[8pt]">
                    <td className="border border-black p-1.5 font-bold">
                      {modoEdicion ? (
                        <textarea
                          rows={3}
                          value={crit.criterio || ''}
                          onChange={(e) => {
                            const copia = [...plan.rubricas_disciplinares_por_materia]
                            copia[rIdx].criterios[cIdx].criterio = e.target.value
                            setPlan({ ...plan, rubricas_disciplinares_por_materia: copia })
                          }}
                          className="w-full p-1 border text-[8pt] font-bold"
                        />
                      ) : (
                        crit.criterio
                      )}
                    </td>
                    <td className="border border-black p-1.5">
                      {modoEdicion ? (
                        <textarea
                          rows={3}
                          value={crit.destacado || ''}
                          onChange={(e) => {
                            const copia = [...plan.rubricas_disciplinares_por_materia]
                            copia[rIdx].criterios[cIdx].destacado = e.target.value
                            setPlan({ ...plan, rubricas_disciplinares_por_materia: copia })
                          }}
                          className="w-full p-1 border text-[8pt]"
                        />
                      ) : (
                        crit.destacado
                      )}
                    </td>
                    <td className="border border-black p-1.5">
                      {modoEdicion ? (
                        <textarea
                          rows={3}
                          value={crit.esperado || ''}
                          onChange={(e) => {
                            const copia = [...plan.rubricas_disciplinares_por_materia]
                            copia[rIdx].criterios[cIdx].esperado = e.target.value
                            setPlan({ ...plan, rubricas_disciplinares_por_materia: copia })
                          }}
                          className="w-full p-1 border text-[8pt]"
                        />
                      ) : (
                        crit.esperado
                      )}
                    </td>
                    <td className="border border-black p-1.5">
                      {modoEdicion ? (
                        <textarea
                          rows={3}
                          value={crit.proceso || ''}
                          onChange={(e) => {
                            const copia = [...plan.rubricas_disciplinares_por_materia]
                            copia[rIdx].criterios[cIdx].proceso = e.target.value
                            setPlan({ ...plan, rubricas_disciplinares_por_materia: copia })
                          }}
                          className="w-full p-1 border text-[8pt]"
                        />
                      ) : (
                        crit.proceso
                      )}
                    </td>
                    <td className="border border-black p-1.5">
                      {modoEdicion ? (
                        <textarea
                          rows={3}
                          value={crit.apoyo || ''}
                          onChange={(e) => {
                            const copia = [...plan.rubricas_disciplinares_por_materia]
                            copia[rIdx].criterios[cIdx].apoyo = e.target.value
                            setPlan({ ...plan, rubricas_disciplinares_por_materia: copia })
                          }}
                          className="w-full p-1 border text-[8pt]"
                        />
                      ) : (
                        crit.apoyo
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="border border-black bg-slate-50 p-2 text-[8pt] mb-4">
          <strong>Puntaje máximo disciplinar en cada asignatura:</strong> 20 puntos (5 criterios × 4 pts). Conversión sobre 10: <strong>Calificación disciplinar = (puntaje obtenido ÷ 20) × 10</strong>.
        </div>

        {/* =========================================================================
            6. RÚBRICA INTERDISCIPLINAR ÚNICA (PRODUCTO FINAL COMÚN)
            ========================================================================= */}
        <div className="font-bold mt-4 mb-2" style={{ fontSize: '10pt', textTransform: 'uppercase' }}>
          2. Instrumento de evaluación interdisciplinar (Producto Final Común)
        </div>
        <p className="text-[8pt] mb-1">
          <strong>Producto final común:</strong> {plan.producto} | <strong>Técnica:</strong> Análisis del producto integrador | <strong>Instrumento:</strong> Rúbrica interdisciplinar única para todo el proyecto.
        </p>
        <div className="w-full overflow-x-auto mb-2">
          <table className="w-full border-collapse border border-black text-left">
            <thead>
              <tr style={{ backgroundColor: '#d9e2f3' }}>
                <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>Criterio interdisciplinar</th>
                <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>4 – Logro destacado</th>
                <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>3 – Logro esperado</th>
                <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>2 – En proceso</th>
                <th className="border border-black p-1.5 font-bold text-center" style={{ width: '20%' }}>1 – Requiere apoyo</th>
              </tr>
            </thead>
            <tbody>
              {(plan.rubrica_interdisciplinar || []).map((r: any, i: number) => (
                <tr key={i} className="align-top text-[8pt]">
                  <td className="border border-black p-1.5 font-bold">{r.criterio}</td>
                  <td className="border border-black p-1.5">{r.destacado}</td>
                  <td className="border border-black p-1.5">{r.esperado}</td>
                  <td className="border border-black p-1.5">{r.proceso}</td>
                  <td className="border border-black p-1.5">{r.apoyo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border border-black bg-slate-50 p-2 text-[8pt] mb-4">
          <strong>Puntaje máximo interdisciplinar:</strong> 24 puntos (6 criterios × 4 pts). Conversión sobre 10: <strong>Calificación interdisciplinar = (puntaje obtenido ÷ 24) × 10</strong>.<br />
          <strong>Cálculo de la Nota Final de Evaluación Sumativa en cada asignatura:</strong> <strong>Nota Final = (Calificación Disciplinar de la Materia + Calificación Interdisciplinar del Producto) ÷ 2</strong>.
        </div>

        {/* 7. FIRMAS DE RESPONSABILIDAD */}
        <div className="w-full overflow-x-auto mt-6">
          <table className="w-full border-collapse border border-black text-left">
            <tbody>
              <tr>
                <td className="border border-black p-2.5 align-top" style={{ width: '33.33%', height: '70pt' }}>
                  <strong>REALIZADO POR:</strong><br /><br /><br /><br />
                  Lic. Fernando Urgilez<br />
                  <strong>FECHA:</strong> ______________________
                </td>
                <td className="border border-black p-2.5 align-top" style={{ width: '33.33%', height: '70pt' }}>
                  <strong>REVISADO POR:</strong><br /><br /><br /><br />
                  Comisión Técnico-Pedagógica<br />
                  <strong>FECHA:</strong> ______________________
                </td>
                <td className="border border-black p-2.5 align-top" style={{ width: '33.33%', height: '70pt' }}>
                  <strong>APROBADO POR:</strong><br /><br /><br /><br />
                  Autoridad Institucional<br />
                  <strong>FECHA:</strong> ______________________
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>
  )
}

export default function VerProyectoInterdisciplinarPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando...</p>
        </div>
      </div>
    }>
      <ContenidoVerProyecto />
    </Suspense>
  )
}