'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function VistaOficialMinisterioPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('id')

  const [cargando, setCargando] = useState(true)
  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  
  const documentoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cargarDatosYPlan()
  }, [planId])

  const cargarDatosYPlan = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: perfil } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .single()

      if (perfil) {
        setDocente(perfil)
        setInstitucion(perfil.instituciones)
      }

      let query = supabase.from('planificaciones_microcurriculares').select('*').eq('docente_id', user.id)
      
      if (planId) {
        query = query.eq('id', planId)
      } else {
        query = query.order('created_at', { ascending: false }).limit(1)
      }

      const { data: planes, error } = await query
      if (!error && planes && planes.length > 0) {
        setPlan(planes[0])
      }
    } catch (e) {
      console.error('Error al cargar datos:', e)
    } finally {
      setCargando(false)
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

  const descargarPDFOficial = async () => {
    if (!plan) return
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

      doc.setLineWidth(0.4)
      doc.rect(14, 10, pageWidth - 28, 22)
      doc.line(45, 10, 45, 32)
      doc.line(pageWidth - 45, 10, pageWidth - 45, 32)

      if (logoBase64) {
        try {
          doc.addImage(logoBase64 as string, 'PNG', 16, 12, 18, 18)
        } catch (imgErr) {
          console.error('Error al cargar imagen del logo:', imgErr)
        }
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text((institucion?.nombre_institucion || 'UNIDAD EDUCATIVA').toUpperCase(), pageWidth / 2, 16, { align: 'center' })
      doc.setFontSize(8)
      doc.text(`CÓDIGO AMIE: ${institucion?.codigo_amie || '03H00106'}`, pageWidth / 2, 22, { align: 'center' })
      doc.setTextColor(0, 0, 128)
      doc.text(`AÑO LECTIVO: ${institucion?.anio_lectivo_activo || '2026-2027'}`, pageWidth / 2, 28, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('PLANIFICACIÓN MICROCURRICULAR', pageWidth / 2, 38, { align: 'center' })

      let currentY = 42

      const runTable = (options: any) => {
        autoTable(doc, options)
        currentY = (doc as any).lastAutoTable.finalY + 3
      }

      // Datos Informativos
      runTable({
        startY: currentY,
        theme: 'grid',
        body: [
          [{ content: 'DATOS INFORMATIVOS', colSpan: 2, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] } }],
          [`Docente: ${docente?.nombres || ''} ${docente?.apellidos || ''}`, `Asignatura: ${plan.asignatura}`],
          [`Grado/Curso: ${plan.grado_curso}`, `Paralelo: ${plan.paralelo}`],
          [`Trimestre: ${plan.trimestre}`, `No. de semanas: ${plan.no_semanas}`]
        ],
        styles: { fontSize: 8, cellPadding: 2 }
      })

      // Situación de Aprendizaje
      runTable({
        startY: currentY,
        theme: 'grid',
        body: [
          [{ content: 'SITUACIÓN DE APRENDIZAJE', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] } }],
          [`Título: ${plan.titulo_sia || 'N/A'}\nDescripción: ${plan.descripcion_sia || 'N/A'}`]
        ],
        styles: { fontSize: 8, cellPadding: 2 }
      })

      // Conexión y Competencias
      runTable({
        startY: currentY,
        theme: 'grid',
        body: [
          [
            { content: 'CONEXIÓN INTERDISCIPLINAR', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] } },
            { content: 'COMPETENCIAS ESPECÍFICAS', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] } }
          ],
          [
            `Asignaturas: ${plan.asignaturas_conexion || 'N/A'}`,
            plan.competencia_especifica || 'N/A'
          ]
        ],
        styles: { fontSize: 8, cellPadding: 2 }
      })

      // Matriz de Saberes
      const bodySaberes = (plan.filas_saberes || []).map((f: any) => [
        f.indicador || '',
        f.declarativo || '',
        f.procedimental || '',
        f.actitudinal || ''
      ])

      runTable({
        startY: currentY,
        theme: 'grid',
        head: [['Indicadores de evaluación', 'Saberes Declarativos', 'Saberes Procedimentales', 'Saberes Actitudinales']],
        body: bodySaberes.length > 0 ? bodySaberes : [['N/A', 'N/A', 'N/A', 'N/A']],
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2 }
      })

      // Estrategias Metodológicas DUA (Tarjetas de 3 columnas)
      const rowsSemanas: any[] = []
      rowsSemanas.push([
        { content: 'ESTRATEGIAS METODOLÓGICAS DESDE EL DUA (8 SEMANAS)', colSpan: 3, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42], halign: 'center' } }
      ])

      if (plan.semanas && Array.isArray(plan.semanas)) {
        plan.semanas.forEach((sem: any) => {
          rowsSemanas.push([
            { content: `Semana ${sem.numero}`, colSpan: 3, styles: { fillColor: [248, 250, 252], fontStyle: 'bold', textColor: [79, 70, 229] } }
          ])
          rowsSemanas.push([
            `1. SUGERENCIAS PARA EL INICIO:\n${sem.anticipacion || 'N/A'}`,
            `2. SUGERENCIAS PARA EL DESARROLLO:\n${sem.construccion || 'N/A'}`,
            `3. SUGERENCIAS PARA EL CIERRE:\n${sem.consolidacion || 'N/A'}`
          ])
          rowsSemanas.push([
            { content: `RECURSOS:\n${sem.recursos || 'N/A'}`, colSpan: 2 },
            { content: `TÉCNICAS E INSTRUMENTOS DE EVALUACIÓN:\nTécnica: ${sem.tecnica || 'N/A'} | Instrumento: ${sem.instrumento || 'N/A'}`, colSpan: 1 }
          ])
        })
      }

      runTable({
        startY: currentY,
        theme: 'grid',
        body: rowsSemanas,
        styles: { fontSize: 7, cellPadding: 2, textColor: [15, 23, 42] }
      })

      doc.save(`Planificacion_Oficial_${plan.asignatura}_${plan.grado_curso}.pdf`)
    } catch (e: any) {
      console.error('Error detallado al generar PDF:', e)
      alert('Error al generar el PDF oficial: ' + (e?.message || e))
    } finally {
      setGenerandoPdf(false)
    }
  }

  const descargarWord = () => {
    if (!documentoRef.current) return
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Planificación Microcurricular</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border: 1px solid #94a3b8; padding: 6px; vertical-align: top; }
            th { background-color: #f1f5f9; font-weight: bold; text-align: left; }
          </style>
        </head>
        <body>
          ${documentoRef.current.innerHTML}
        </body>
      </html>
    `
    const blob = new Blob(['\ufeff' + htmlContent], {
      type: 'application/msword'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Planificacion_${plan.asignatura}_${plan.grado_curso}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando formato oficial...</p>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-slate-100 p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl border text-center space-y-4 max-w-md">
          <p className="text-slate-700 font-bold">No se encontró ninguna planificación para visualizar.</p>
          <button onClick={() => router.push('/docente/planificadorpiloto/planes-guardados')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
            Ver mis planes guardados
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white text-slate-900">
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-6">

        {/* BARRA DE ACCIÓN SUPERIOR (Oculta al imprimir) */}
        <div className="no-print bg-white p-4 rounded-2xl border shadow-xs flex justify-between items-center flex-wrap gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
          >
            ← Volver
          </button>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              🖨️ Imprimir Formato Oficial
            </button>
            <button
              onClick={descargarWord}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              📄 Descargar Word (.doc)
            </button>
            <button
              onClick={descargarPDFOficial}
              disabled={generandoPdf}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              {generandoPdf ? 'Generando PDF...' : '📥 Descargar PDF Oficial'}
            </button>
          </div>
        </div>

        {/* DOCUMENTO OFICIAL FORMATO MINISTERIO */}
        <div ref={documentoRef} className="print-container bg-white p-8 rounded-2xl border shadow-sm space-y-6 text-slate-900">
          
          {/* ENCABEZADO INSTITUCIONAL */}
          <div className="border border-slate-300 grid grid-cols-3 text-center text-xs">
            <div className="p-3 border-r border-slate-300 flex items-center justify-center font-bold text-slate-900">
              {institucion?.logo_url ? (
                <img src={institucion.logo_url} alt="Logo" className="h-12 object-contain" />
              ) : (
                <span>[ LOGO ]</span>
              )}
            </div>
            <div className="p-3 border-r border-slate-300 flex flex-col justify-center space-y-1">
              <span className="font-bold text-slate-900">{institucion?.nombre_institucion || 'Unidad Educativa Guapan'}</span>
              <span className="text-slate-900 font-semibold">CÓDIGO AMIE: {institucion?.codigo_amie || '03H00106'}</span>
              <span className="text-blue-900 font-bold">AÑO LECTIVO: {institucion?.anio_lectivo_activo || '2026-2027'}</span>
            </div>
            <div className="p-3 flex items-center justify-center font-bold italic text-slate-800">
              EL NUEVO ECUADOR
            </div>
          </div>

          <div className="text-center font-black text-sm uppercase text-slate-900 pt-2">
            Planificación microcurricular
          </div>

          {/* DATOS INFORMATIVOS */}
          <div className="border border-slate-300 text-xs rounded-xl overflow-hidden">
            <div className="bg-slate-100 text-slate-900 font-bold p-2.5 uppercase text-[11px] border-b border-slate-300">
              Datos informativos
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-300 p-3">
              <div className="space-y-1 text-slate-900">
                <p><strong>Docente:</strong> {docente?.nombres} {docente?.apellidos}</p>
                <p><strong>Grado/Curso:</strong> {plan.grado_curso}</p>
                <p><strong>Trimestre:</strong> {plan.trimestre}</p>
              </div>
              <div className="pl-3 space-y-1 text-slate-900">
                <p><strong>Asignatura:</strong> {plan.asignatura}</p>
                <p><strong>Paralelo:</strong> {plan.paralelo}</p>
                <p><strong>No. de semanas:</strong> {plan.no_semanas}</p>
              </div>
            </div>
          </div>

          {/* SITUACIÓN DE APRENDIZAJE */}
          <div className="border border-slate-300 text-xs rounded-xl overflow-hidden">
            <div className="bg-slate-100 text-slate-900 font-bold p-2.5 uppercase text-[11px] border-b border-slate-300">
              Situación de aprendizaje
            </div>
            <div className="p-3 space-y-2 text-slate-900">
              <p><strong>Título:</strong> {plan.titulo_sia || 'N/A'}</p>
              <p><strong>Descripción:</strong> {plan.descripcion_sia || 'N/A'}</p>
            </div>
          </div>

          {/* CONEXIÓN INTERDISCIPLINAR & COMPETENCIAS */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-100 text-slate-900 font-bold p-2.5 uppercase text-[11px] border-b border-slate-300">
                Conexión interdisciplinar
              </div>
              <div className="p-3 text-slate-900">
                <p><strong>Asignaturas:</strong> {plan.asignaturas_conexion || 'N/A'}</p>
              </div>
            </div>
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-100 text-slate-900 font-bold p-2.5 uppercase text-[11px] border-b border-slate-300">
                Competencias específicas
              </div>
              <div className="p-3 text-slate-900">
                <p>{plan.competencia_especifica || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* MATRIZ DE INDICADORES Y SABERES */}
          <div className="border border-slate-300 text-xs rounded-xl overflow-hidden">
            <div className="bg-slate-100 text-slate-900 font-bold p-2.5 uppercase text-[11px] border-b border-slate-300">
              Matriz de saberes y evaluación
            </div>
            <table className="w-full border-collapse text-left text-slate-900">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-[11px]">
                  <th className="p-2.5 border-r border-slate-300 w-1/4 font-bold">Indicadores de evaluación</th>
                  <th className="p-2.5 border-r border-slate-300 w-1/4 font-bold">Saberes Declarativos</th>
                  <th className="p-2.5 border-r border-slate-300 w-1/4 font-bold">Saberes Procedimentales</th>
                  <th className="p-2.5 w-1/4 font-bold">Saberes Actitudinales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {plan.filas_saberes?.map((f: any, idx: number) => (
                  <tr key={idx}>
                    <td className="p-2.5 border-r border-slate-300">{f.indicador}</td>
                    <td className="p-2.5 border-r border-slate-300">{f.declarativo}</td>
                    <td className="p-2.5 border-r border-slate-300">{f.procedimental}</td>
                    <td className="p-2.5">{f.actitudinal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ESTRATEGIAS METODOLÓGICAS DUA (8 SEMANAS - 3 MOMENTOS) */}
          <div className="space-y-4">
            <div className="bg-slate-100 text-slate-900 font-bold p-2.5 uppercase text-xs rounded-xl border border-slate-300">
              Estrategias metodológicas desde el DUA (8 Semanas)
            </div>

            {plan.semanas?.map((sem: any, idx: number) => (
              <div key={idx} className="border border-slate-300 text-xs rounded-xl overflow-hidden text-slate-900 bg-white">
                <div className="bg-slate-50 font-bold p-2.5 text-indigo-900 border-b border-slate-300">
                  Semana {sem.numero}
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-300">
                  <div className="p-3 space-y-1">
                    <strong className="text-slate-900 block uppercase text-[10px] font-bold">1. Sugerencias para el inicio:</strong>
                    <p className="whitespace-pre-wrap">{sem.anticipacion || 'N/A'}</p>
                  </div>
                  <div className="p-3 space-y-1">
                    <strong className="text-slate-900 block uppercase text-[10px] font-bold">2. Sugerencias para el desarrollo:</strong>
                    <p className="whitespace-pre-wrap">{sem.construccion || 'N/A'}</p>
                  </div>
                  <div className="p-3 space-y-1">
                    <strong className="text-slate-900 block uppercase text-[10px] font-bold">3. Sugerencias para el cierre:</strong>
                    <p className="whitespace-pre-wrap">{sem.consolidacion || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 border-t border-slate-300 divide-x divide-slate-300 bg-slate-50 p-3">
                  <div>
                    <strong className="text-slate-900 uppercase text-[10px] block font-bold">Recursos:</strong>
                    <span>{sem.recursos}</span>
                  </div>
                  <div className="pl-3">
                    <strong className="text-slate-900 uppercase text-[10px] block font-bold">Técnicas e instrumentos de evaluación:</strong>
                    <span>Técnica: {sem.tecnica} | Instrumento: {sem.instrumento}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  )
}