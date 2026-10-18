'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx'

export default function ImprimirPlanificacionesPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)

  // Planificaciones y Filtros
  const [planificaciones, setPlanificaciones] = useState<any[]>([])
  const [materiasDisponibles, setMateriasDisponibles] = useState<string[]>([])
  const [gradosDisponibles, setGradosDisponibles] = useState<string[]>([])
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])

  const [materiaFiltro, setMateriaFiltro] = useState<string>('Todas')
  const [gradoFiltro, setGradoFiltro] = useState<string>('Todos')
  const [modeloFiltro, setModeloFiltro] = useState<string>('Todos')
  const [periodoFiltro, setPeriodoFiltro] = useState<string>('Todos')

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      // Cargar docente e institución con sus periodos e histórico
      const { data: perfilDocente } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (perfilDocente) {
        setDocente(perfilDocente)
        setInstitucion(perfilDocente.instituciones)
      }

      // Cargar planificaciones del docente
      const { data: planes, error } = await supabase
        .from('planificaciones')
        .select('*')
        .eq('docente_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && planes) {
        setPlanificaciones(planes)

        const mats = Array.from(new Set(planes.map((p) => p.asignatura).filter(Boolean))) as string[]
        setMateriasDisponibles(mats)

        const grs = Array.from(new Set(planes.map((p) => p.grado_curso || p.grado).filter(Boolean))) as string[]
        setGradosDisponibles(grs)

        const periodos = Array.from(new Set(planes.map((p) => p.anio_lectivo || perfilDocente?.instituciones?.anio_lectivo_activo).filter(Boolean))) as string[]
        setPeriodosDisponibles(periodos)
        
        if (perfilDocente?.instituciones?.anio_lectivo_activo) {
          setPeriodoFiltro(perfilDocente.instituciones.anio_lectivo_activo)
        }
      }
    } catch (err) {
      console.error('Error al cargar datos:', err)
    } finally {
      setCargando(false)
    }
  }

  // Filtrar planificaciones incluyendo histórico por año lectivo
  const planificacionesFiltradas = planificaciones.filter((plan) => {
    const cumpleMateria = materiaFiltro === 'Todas' || plan.asignatura === materiaFiltro
    const gradoPlan = plan.grado_curso || plan.grado || ''
    const cumpleGrado = gradoFiltro === 'Todos' || gradoPlan === gradoFiltro
    const cumpleModelo = modeloFiltro === 'Todos' || plan.tipo_modelo === modeloFiltro
    const anioPlan = plan.anio_lectivo || institucion?.anio_lectivo_activo || '2026-2027'
    const cumplePeriodo = periodoFiltro === 'Todos' || anioPlan === periodoFiltro

    return cumpleMateria && cumpleGrado && cumpleModelo && cumplePeriodo
  })

  // FUNCIÓN PARA EXPORTAR A WORD CORREGIDA PARA COINCIDIR EXACTAMENTE CON EL MODELO MULTIGRADO DE LA VISTA WEB
  const exportarAWord = async (plan: any) => {
    const periodoPlan = plan.anio_lectivo || institucion?.anio_lectivo_activo || '2026-2027'
    const esMultigrado = plan.tipo_modelo === 'multigrado_eje'

    const tableBorders = {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    }

    let docChildren: any[] = []

    if (!esMultigrado) {
      const encabezadoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: "LOGO", bold: true, size: 11 })], alignment: AlignmentType.CENTER })],
                verticalAlign: "center",
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: institucion?.nombre_institucion || 'UNIDAD EDUCATIVA', bold: true, size: 14 })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: `CÓDIGO AMIE: ${institucion?.codigo_amie || 'N/A'}`, bold: true, size: 12 })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: `AÑO LECTIVO: ${periodoPlan}`, bold: true, size: 12, color: "1D4ED8" })], alignment: AlignmentType.CENTER }),
                ],
                verticalAlign: "center",
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: "EL NUEVO ECUADOR", bold: true, italics: true, size: 13, color: "1D4ED8" })], alignment: AlignmentType.RIGHT })],
                verticalAlign: "center",
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 3,
                shading: { fill: "F1F5F9" },
                children: [new Paragraph({ children: [new TextRun({ text: "PLANIFICACION MICROCURRICULAR POR TRIMESTRE", bold: true, size: 14, color: "1D4ED8" })], alignment: AlignmentType.CENTER })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 3,
                shading: { fill: "F1F5F9" },
                children: [new Paragraph({ children: [new TextRun({ text: "DATOS INFORMATIVOS:", bold: true, size: 12 })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ columnSpan: 1, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "SUBNIVEL: ", bold: true, size: 12 }), new TextRun({ text: plan.subnivel || 'Básica Elemental', size: 12 })] })] }),
              new TableCell({ columnSpan: 2, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "PARALELO: ", bold: true, size: 12 }), new TextRun({ text: plan.paralelo || 'A', size: 12 })] })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ columnSpan: 1, children: [new Paragraph({ children: [new TextRun({ text: "DOCENTE: ", bold: true, size: 12 }), new TextRun({ text: `${docente?.nombres || ''} ${docente?.apellidos || ''}`, size: 12 })] })] }),
              new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: "FECHA INICIO: ", bold: true, size: 12 }), new TextRun({ text: plan.fecha_inicio ? new Date(plan.fecha_inicio + 'T00:00:00').toLocaleDateString() : '--/--/----', size: 12 })] })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ columnSpan: 1, children: [new Paragraph({ children: [new TextRun({ text: "GRADO / CURSO: ", bold: true, size: 12 }), new TextRun({ text: plan.grado_curso || plan.grado || 'N/A', size: 12 })] })] }),
              new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: "FECHA FIN: ", bold: true, size: 12 }), new TextRun({ text: plan.fecha_fin ? new Date(plan.fecha_fin + 'T00:00:00').toLocaleDateString() : '--/--/----', size: 12 })] })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ columnSpan: 1, shading: { fill: "BFDBFE" }, children: [new Paragraph({ children: [new TextRun({ text: "COMPETENCIAS DEL CURRICULO PRIORIZADO", bold: true, size: 12 })] })] }),
              new TableCell({ columnSpan: 2, shading: { fill: "BFDBFE" }, children: [new Paragraph({ children: [new TextRun({ text: "INSERCIONES CURRICULARES", bold: true, size: 12 })] })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 1,
                children: [
                  new Paragraph({ children: [new TextRun({ text: "• Competencia comunicacional", size: 12 })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Competencia matemática", size: 12 })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Competencia digital", size: 12 })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Competencia socioemocional", size: 12 })] }),
                ],
              }),
              new TableCell({
                columnSpan: 2,
                children: [
                  new Paragraph({ children: [new TextRun({ text: "• Educación Cívica, Ética e integral", size: 12 })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Educación para el Desarrollo Sostenible", size: 12 })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Educación Socioemocional", size: 12 })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Educación Financiera", size: 12 })] }),
                  new Paragraph({ children: [new TextRun({ text: "• Educación para la Seguridad Vial y Movilidad Sostenible", size: 12 })] }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ columnSpan: 3, shading: { fill: "F1F5F9" }, children: [new Paragraph({ children: [new TextRun({ text: "APRENDIZAJE DISCIPLINAR", bold: true, size: 12 })], alignment: AlignmentType.CENTER })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ columnSpan: 3, shading: { fill: "BFDBFE" }, children: [new Paragraph({ children: [new TextRun({ text: `ASIGNATURA: ${plan.asignatura?.toUpperCase() || 'N/A'}`, bold: true, size: 12 })] })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 3,
                children: [
                  new Paragraph({ children: [new TextRun({ text: "OBJETIVOS DE APRENDIZAJE:", bold: true, size: 12 })] }),
                  new Paragraph({ children: [new TextRun({ text: plan.objetivos_aprendizaje || plan.objetivos || 'N/A', size: 12 })] }),
                ],
              }),
            ],
          }),
        ],
      })

      const matrizTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({ shading: { fill: "BFDBFE" }, width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "DESTREZAS CON CRITERIOS DE DESEMPEÑO", bold: true, size: 11 })] })] }),
              new TableCell({ shading: { fill: "BFDBFE" }, width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "INDICADORES DE EVALUACIÓN", bold: true, size: 11 })] })] }),
              new TableCell({ shading: { fill: "BFDBFE" }, width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "ESTRATEGIAS METODOLÓGICAS ACTIVAS (DUA/ERCA)", bold: true, size: 11 })] })] }),
              new TableCell({ shading: { fill: "BFDBFE" }, width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "ACTIVIDADES EVALUATIVAS", bold: true, size: 11 })] })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: plan.criterios_evaluacion || plan.criterios || 'N/A', size: 11 })] }),
                  new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "TRABAJA CON: Competencia comunicacional, Socioemocional, Seguridad Vial", bold: true, size: 9, color: "64748B" })] }),
                ],
              }),
              new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: plan.indicadores_evaluacion || plan.indicadores || 'N/A', size: 11 })] })] }),
              new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: plan.estrategias_dua || 'N/A', size: 11 })] })] }),
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: "TÉCNICA:", bold: true, size: 11 })] }),
                  new Paragraph({ children: [new TextRun({ text: "Observación / Prueba", size: 11 })] }),
                  new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "INSTRUMENTO:", bold: true, size: 11 })] }),
                  new Paragraph({ children: [new TextRun({ text: plan.actividades_evaluacion || plan.evaluacion || 'Rúbrica / Cuestionario', size: 11 })] }),
                ],
              }),
            ],
          }),
        ],
      })

      const firmasTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "___________________________________\nDOCENTE RESPONSABLE\n", bold: true, size: 11 }), new TextRun({ text: `${docente?.nombres || ''} ${docente?.apellidos || ''}`, size: 11 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "___________________________________\nAPROBADO POR RECTORADO / DIRECCIÓN\nSello y Firma Oficial", bold: true, size: 11 })], alignment: AlignmentType.CENTER })] }),
            ],
          }),
        ],
      })

      docChildren = [
        encabezadoTable,
        new Paragraph({ spacing: { after: 100 } }),
        matrizTable,
        new Paragraph({ spacing: { after: 300 } }),
        firmasTable
      ]

    } else {
      const multigradoHeader = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: "LOGO", bold: true, size: 11 })], alignment: AlignmentType.CENTER })],
                verticalAlign: "center",
              }),
              new TableCell({
                columnSpan: 2,
                width: { size: 75, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: "MINISTERIO DE EDUCACIÓN", bold: true, size: 15, color: "1D4ED8" })], alignment: AlignmentType.RIGHT }),
                  new Paragraph({ children: [new TextRun({ text: "PLANIFICACIÓN MICROCURRICULAR - MULTIGRADO", bold: true, size: 13 })], alignment: AlignmentType.RIGHT }),
                  new Paragraph({ children: [new TextRun({ text: `AÑO LECTIVO: ${periodoPlan}`, bold: true, size: 12, color: "1D4ED8" })], alignment: AlignmentType.RIGHT }),
                ],
                verticalAlign: "center",
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 3,
                shading: { fill: "FEF08A" },
                children: [new Paragraph({ children: [new TextRun({ text: `EJE TEMÁTICO: ${plan.eje_tematico || '1. El Yo y la Identidad'}`, bold: true, size: 12 })], alignment: AlignmentType.CENTER })],
              }),
            ],
          }),
        ],
      })

      const multigradoMatriz = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({ shading: { fill: "DBEAFE" }, width: { size: 18, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "DESTREZAS CON CRITERIOS DE DESEMPEÑO", bold: true, size: 10 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ columnSpan: 3, shading: { fill: "BFDBFE" }, width: { size: 36, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "INDICADORES DE EVALUACIÓN Y/O LOGRO", bold: true, size: 10 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ columnSpan: 3, shading: { fill: "DBEAFE" }, width: { size: 31, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "ORIENTACIONES METODOLÓGICAS (ERCA)", bold: true, size: 10 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ shading: { fill: "DBEAFE" }, width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "ACTIVIDADES EVALUATIVAS", bold: true, size: 10 })], alignment: AlignmentType.CENTER })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ shading: { fill: "DBEAFE" }, children: [new Paragraph({ children: [new TextRun({ text: "", size: 9 })] })] }),
              new TableCell({ shading: { fill: "BFDBFE" }, children: [new Paragraph({ children: [new TextRun({ text: "2DO GRADO EGB", bold: true, size: 9 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ shading: { fill: "BFDBFE" }, children: [new Paragraph({ children: [new TextRun({ text: "3RO GRADO EGB", bold: true, size: 9 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ shading: { fill: "BFDBFE" }, children: [new Paragraph({ children: [new TextRun({ text: "4TO GRADO EGB", bold: true, size: 9 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ shading: { fill: "DBEAFE" }, children: [new Paragraph({ children: [new TextRun({ text: "2DO GRADO EGB", bold: true, size: 9 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ shading: { fill: "DBEAFE" }, children: [new Paragraph({ children: [new TextRun({ text: "3RO GRADO EGB", bold: true, size: 9 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ shading: { fill: "DBEAFE" }, children: [new Paragraph({ children: [new TextRun({ text: "4TO GRADO EGB", bold: true, size: 9 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ shading: { fill: "DBEAFE" }, children: [new Paragraph({ children: [new TextRun({ text: "", size: 9 })] })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: plan.criterios_evaluacion || plan.criterios || 'N/A', size: 10 })] }),
                  new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: `Subnivel: ${plan.subnivel || 'Básica Media'} | Paralelo: ${plan.paralelo || 'A'}`, bold: true, size: 8, color: "64748B" })] }),
                ],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: plan.contenido_multigrado?.[0]?.indicadores || 'Identifica verbos...', size: 10 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: plan.contenido_multigrado?.[1]?.indicadores || 'Diferencia e integra...', size: 10 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: plan.contenido_multigrado?.[2]?.indicadores || 'Aplica con concordancia...', size: 10 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: plan.contenido_multigrado?.[0]?.orientaciones || 'Activar conocimientos...', size: 10 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: plan.contenido_multigrado?.[1]?.orientaciones || 'Conversar sobre...', size: 10 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: plan.contenido_multigrado?.[2]?.orientaciones || 'Leer un texto...', size: 10 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: plan.actividades_evaluacion || plan.evaluacion || 'Creación del mural...', size: 10 })] })],
              }),
            ],
          }),
        ],
      })

      const firmasMulti = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "___________________________________\nDOCENTE RESPONSABLE\n", bold: true, size: 11 }), new TextRun({ text: `${docente?.nombres || ''} ${docente?.apellidos || ''}`, size: 11 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "___________________________________\nAPROBADO POR RECTORADO / DIRECCIÓN\nSello y Firma Oficial", bold: true, size: 11 })], alignment: AlignmentType.CENTER })] }),
            ],
          }),
        ],
      })

      docChildren = [
        multigradoHeader,
        new Paragraph({ spacing: { after: 100 } }),
        multigradoMatriz,
        new Paragraph({ spacing: { after: 300 } }),
        firmasMulti
      ]
    }

    const doc = new Document({
      sections: [{ children: docChildren }],
    })

    const blob = await Packer.toBlob(doc)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Planificacion_${plan.asignatura || 'General'}_${Date.now()}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Cargando Centro de Impresión Oficial e Histórico...</p>
        </div>
      </div>
    )
  }

  const anioActivoMostrado = periodoFiltro === 'Todos' ? (institucion?.anio_lectivo_activo || '2026-2027') : periodoFiltro
  const esAnioCerrado = institucion?.anos_cerrados?.includes(anioActivoMostrado)

  return (
    <div className="min-h-screen bg-slate-200 p-4 md:p-8">
      
      {/* REGLA CSS GLOBAL DE IMPRESIÓN PARA OCULTAR EL MENÚ DEL LAYOUT Y MOSTRAR SOLO EL CONTENIDO */}
      <style jsx global>{`
        @media print {
          /* Oculta los elementos laterales del layout principal (sidebar y barra móvil) */
          aside, nav, header, footer {
            display: none !important;
          }
          /* Expande el contenido principal ocupando todo el ancho de la hoja al imprimir */
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          body {
            background-color: white !important;
          }
        }
      `}</style>

      {/* PANEL DE CONTROL DE FILTROS (OCULTO AL IMPRIMIR CON CTRL + P) */}
      <div className="print:hidden max-w-5xl mx-auto space-y-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              Centro de Impresión Normado e Histórico
            </h1>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Docente: <strong>{docente?.nombres} {docente?.apellidos}</strong> | {institucion?.nombre_institucion || 'Unidad Educativa'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push('/docente/planificador')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition"
            >
              ← Volver al Dashboard
            </button>

            <button
              onClick={() => window.print()}
              disabled={planificacionesFiltradas.length === 0}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
            >
              Imprimir Selección PDF
            </button>
          </div>
        </div>

        {/* AVISO SI EL PERIODO SELECCIONADO ESTÁ CERRADO */}
        {esAnioCerrado && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold flex items-center justify-between">
            <span>Estás consultando el archivo histórico del periodo {anioActivoMostrado} (Cerrado y Bloqueado). Las planificaciones se muestran en modo de solo lectura.</span>
            <span className="bg-amber-200 px-2.5 py-1 rounded">Modo Histórico</span>
          </div>
        )}

        {/* BARRA DE FILTROS APLICABLES (INCLUYENDO AÑO LECTIVO / HISTÓRICO) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">1. Año Lectivo (Histórico):</label>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-indigo-900 bg-indigo-50 outline-none"
            >
              <option value="Todos">Todos los Periodos</option>
              {periodosDisponibles.map((per) => (
                <option key={per} value={per}>Periodo {per} {institucion?.anos_cerrados?.includes(per) ? '🔒' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">2. Filtrar por Modelo:</label>
            <select
              value={modeloFiltro}
              onChange={(e) => setModeloFiltro(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
            >
              <option value="Todos">Todos los Modelos</option>
              <option value="trimestral_disciplinar">Trimestral Disciplinar (Modelo 1)</option>
              <option value="multigrado_eje">Multigrado por Eje Temático (Modelo 2)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">3. Filtrar por Asignatura:</label>
            <select
              value={materiaFiltro}
              onChange={(e) => setMateriaFiltro(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
            >
              <option value="Todas">Todas las Materias</option>
              {materiasDisponibles.map((mat) => (
                <option key={mat} value={mat}>{mat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">4. Filtrar por Grado:</label>
            <select
              value={gradoFiltro}
              onChange={(e) => setGradoFiltro(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
            >
              <option value="Todos">Todos los Grados</option>
              {gradosDisponibles.map((gr) => (
                <option key={gr} value={gr}>{gr}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CONTENEDOR DOCUMENTAL DE IMPRESIÓN */}
      <div className="max-w-5xl mx-auto space-y-8">
        {planificacionesFiltradas.length === 0 ? (
          <div className="print:hidden bg-white p-12 text-center rounded-2xl border border-slate-300">
            <p className="text-slate-500 font-semibold text-sm">
              No se encontraron planificaciones registradas con los filtros y periodo seleccionados.
            </p>
          </div>
        ) : (
          planificacionesFiltradas.map((plan) => {
            const esMultigrado = plan.tipo_modelo === 'multigrado_eje'
            const periodoPlan = plan.anio_lectivo || institucion?.anio_lectivo_activo || '2026-2027'

            return (
              <div
                key={plan.id}
                className="relative bg-white p-6 md:p-10 rounded-xl border border-slate-400 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 print:break-after-page text-black font-sans text-xs space-y-4"
              >
                {/* BOTÓN DE DESCARGA EN WORD (.DOCX) */}
                <button
                  onClick={() => exportarAWord(plan)}
                  className="print:hidden absolute top-4 right-4 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow transition flex items-center gap-1.5 z-10"
                >
                  Descargar Word (.docx)
                </button>

                {!esMultigrado ? (
                  <div className="border border-black space-y-0">
                    
                    {/* ENCABEZADO INSTITUCIONAL CON LOGO, AMIE Y AÑO LECTIVO */}
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

                    {/* TÍTULO PRINCIPAL */}
                    <div className="border-b border-black text-center font-black text-sm uppercase py-1 bg-slate-100 text-blue-900">
                      PLANIFICACION MICROCURRICULAR POR TRIMESTRE
                    </div>

                    {/* DATOS INFORMATIVOS DINÁMICOS */}
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
                          <td className="w-1/2 border-r border-black px-2 py-1"><strong>DOCENTE:</strong> {docente?.nombres} {docente?.apellidos}</td>
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
                              <img src={encodeURI("/iconos/comunicacional@8x.png")} alt="Comunicacional" className="w-6 h-6 object-contain" />
                              <span><strong>Competencia comunicacional</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <img src={encodeURI("/iconos/matematica@8x.png")} alt="Matemática" className="w-6 h-6 object-contain" />
                              <span><strong>Competencia matemática</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <img src={encodeURI("/iconos/digital@8x.png")} alt="Digital" className="w-6 h-6 object-contain" />
                              <span><strong>Competencia digital</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <img src={encodeURI("/iconos/socioemovionales@8x.png")} alt="Socioemocional" className="w-6 h-6 object-contain" />
                              <span><strong>Competencia socioemocional</strong></span>
                            </div>
                          </td>

                          <td className="p-2 align-top text-[11px] space-y-2">
                            <div className="flex items-center gap-2">
                              <img src={encodeURI("/iconos/civica@8x.png")} alt="Cívica y Ética" className="w-6 h-6 object-contain" />
                              <span><strong>Educación Cívica, Ética e integral</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <img src={encodeURI("/iconos/sostenible@8x.png")} alt="Desarrollo Sostenible" className="w-6 h-6 object-contain" />
                              <span><strong>Educación para el Desarrollo Sostenible</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <img src={encodeURI("/iconos/socioemocional@8x.png")} alt="Socioemocional" className="w-6 h-6 object-contain" />
                              <span><strong>Educación Socioemocional</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <img src={encodeURI("/iconos/financiera@8x.png")} alt="Financiera" className="w-6 h-6 object-contain" />
                              <span><strong>Educación Financiera</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <img src={encodeURI("/iconos/vial@8x.png")} alt="Seguridad Vial" className="w-6 h-6 object-contain" />
                              <span><strong>Educación para la Seguridad Vial y Movilidad Sostenible</strong></span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* APRENDIZAJE DISCIPLINAR */}
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

                    {/* MATRIZ PEDAGÓGICA */}
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-blue-200 border-b border-black text-[10px] font-bold text-slate-900 uppercase">
                          <th className="w-1/4 border-r border-black p-2 text-left">DESTREZAS CON CRITERIOS DE DESEMPEÑO</th>
                          <th className="w-1/4 border-r border-black p-2 text-left">INDICADORES DE EVALUACIÓN</th>
                          <th className="w-1/3 border-r border-black p-2 text-left">ESTRATEGIAS METODOLÓGICAS ACTIVAS (DUA/ERCA)</th>
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
                                <img src={encodeURI("/iconos/comunicacional@8x.png")} alt="Comunicacional" className="w-6 h-6 object-contain" title="Competencia Comunicacional" />
                                <img src={encodeURI("/iconos/socioemocional@8x.png")} alt="Socioemocional" className="w-6 h-6 object-contain" title="Educación Socioemocional" />
                                <img src={encodeURI("/iconos/vial@8x.png")} alt="Seguridad Vial" className="w-6 h-6 object-contain" title="Seguridad Vial" />
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

                  /* FORMATO MODELO 2: MULTIGRADO POR EJES TEMÁTICOS */
                  <div className="border border-black space-y-0">
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

                {/* BLOQUE DE FIRMAS NORMADAS */}
                <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[10px] font-bold text-black uppercase">
                  <div className="border-t border-black pt-1">
                    <p>DOCENTE RESPONSABLE</p>
                    <p className="font-normal mt-0.5">{docente?.nombres} {docente?.apellidos}</p>
                  </div>
                  <div className="border-t border-black pt-1">
                    <p>APROBADO POR RECTORADO / DIRECCIÓN</p>
                    <p className="font-normal mt-0.5">Sello y Firma Oficial</p>
                  </div>
                </div>

              </div>
            )
          })
        )}
      </div>

    </div>
  )
}