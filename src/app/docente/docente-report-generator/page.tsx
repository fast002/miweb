'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ReportesAutomatizados() {
  const [cargando, setCargando] = useState(false)
  const [gradosDisponibles, setGradosDisponibles] = useState<string[]>([])
  const [gradoSeleccionado, setGradoSeleccionado] = useState('TODOS')
  const [institucionInfo, setInstitucionInfo] = useState<any>(null)
  const [docenteInfo, setDocenteInfo] = useState<any>(null)

  useEffect(() => {
    cargarDatosContexto()
  }, [])

  const cargarDatosContexto = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Obtener datos del docente
    const { data: doc } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user.id).single()
    if (doc) {
      setDocenteInfo(doc)
      setInstitucionInfo(doc.instituciones)

      // 2. Obtener los grados/cursos asignados para el filtro por año de básica
      const { data: asigs } = await supabase
        .from('docente_asignaciones')
        .select('grado_curso')
        .eq('institucion_id', doc.institucion_id)
        .eq('anio_lectivo', doc.instituciones?.anio_lectivo_activo)

      if (asigs) {
        const unicos = Array.from(new Set(asigs.map(a => a.grado_curso)))
        setGradosDisponibles(unicos)
      }
    }
  }

  // Función para convertir la imagen del logo de Supabase a Base64 para que jsPDF la pinte sin problemas
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

  const generarReportePDF = async () => {
    setCargando(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      // --- 1. ENCABEZADO INSTITUCIONAL OFICIAL (Tabla con 3 columnas al estilo de tu imagen) ---
      let logoBase64 = null
      if (institucionInfo?.logo_url) {
        logoBase64 = await convertirLogoABase64(institucionInfo.logo_url)
      }

      // Dibujar caja de cabecera institucional
      doc.setLineWidth(0.5)
      doc.rect(14, 15, pageWidth - 28, 25) // Marco superior
      doc.line(55, 15, 55, 40) // Línea vertical divisor logo
      doc.line(pageWidth - 55, 15, pageWidth - 55, 40) // Línea vertical divisor lema

      // Logo (Columna 1)
      if (logoBase64) {
        doc.addImage(logoBase64 as string, 'PNG', 20, 17, 21, 21)
      }

      // Textos institucionales centrales (Columna 2)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text((institucionInfo?.nombre_institucion || 'UNIDAD EDUCATIVA').toUpperCase(), pageWidth / 2, 22, { align: 'center' })
      
      doc.setFontSize(9)
      doc.text(`CÓDIGO AMIE: ${institucionInfo?.codigo_amie || '03H00106'}`, pageWidth / 2, 29, { align: 'center' })
      
      doc.setTextColor(0, 0, 128) // Azul institucional
      doc.text(`AÑO LECTIVO: ${institucionInfo?.anio_lectivo_activo || '2026-2027'}`, pageWidth / 2, 36, { align: 'center' })
      doc.setTextColor(0, 0, 0) // Reset color

      // Lema institucional (Columna 3)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.text('EL NUEVO ECUADOR', pageWidth - 36, 28, { align: 'center' })

      // --- 2. TÍTULO DEL REPORTE AUTOMATIZADO ---
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('INFORME PEDAGÓGICO DE SEGUIMIENTO Y RENDIMIENTO', pageWidth / 2, 50, { align: 'center' })
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Docente: ${docenteInfo?.nombres} ${docenteInfo?.apellidos}`, 14, 58)
      doc.text(`Alcance del Reporte: ${gradoSeleccionado === 'TODOS' ? 'General Institucional' : `Año de Básica: ${gradoSeleccionado}`}`, 14, 64)
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, pageWidth - 14, 58, { align: 'right' })

      // --- 3. EXTRACCIÓN AUTOMÁTICA DE DATOS DESDE SUPABASE ---
      // Consultar calificaciones con filtro aplicado
      let query = supabase.from('calificaciones').select('*, estudiantes(nombres, apellidos, grado_curso)')
        .eq('anio_lectivo', institucionInfo?.anio_lectivo_activo)

      const { data: calificacionesData } = await query

      // Filtrar alertas (< 7.0 / "en rojo")
      const alertasRojo = (calificacionesData || []).filter((c: any) => {
        const promedio = Number(c.promedio_parcial) || 0
        const cumpleGrado = gradoSeleccionado === 'TODOS' || c.estudiantes?.grado_curso === gradoSeleccionado
        return promedio < 7.0 && promedio > 0 && cumpleGrado
      })

      // --- 4. SECCIÓN DE ALERTAS ACADÉMICAS (ESTUDIANTES CON BAJO RENDIMIENTO) ---
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(180, 0, 0)
      doc.text('1. ALERTAS ACADÉMICAS (ESTUDIANTES CON CALIFICACIONES INFERIORES A 7.0)', 14, 74)
      doc.setTextColor(0, 0, 0)

      const bodyAlertas = alertasRojo.map((item: any) => [
        `${item.estudiantes?.apellidos || ''} ${item.estudiantes?.nombres || ''}`,
        item.estudiantes?.grado_curso || 'N/A',
        item.asignatura,
        item.promedio_parcial.toFixed(2)
      ])

      autoTable(doc, {
        startY: 78,
        head: [['Estudiante', 'Grado / Curso', 'Asignatura', 'Promedio']],
        body: bodyAlertas.length > 0 ? bodyAlertas : [['No se registran estudiantes con calificaciones inferiores a 7.0', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 9 }
      })

      // --- 5. RESUMEN DE ASISTENCIA E INCIDENCIAS AUTOMATIZADO ---
      const finalY = (doc as any).lastAutoTable.finalY + 12
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('2. RESUMEN GENERAL DE ASISTENCIA Y JUSTIFICACIONES', 14, finalY)

      // Consultar asistencias
      const { data: asistenciasData } = await supabase
        .from('asistencias')
        .select('estado')
        .eq('anio_lectivo', institucionInfo?.anio_lectivo_activo)

      const totalFaltasInjustificadas = (asistenciasData || []).filter((a: any) => a.estado === 'Falta Injustificada').length
      const totalAtrasos = (asistenciasData || []).filter((a: any) => a.estado === 'Atraso').length

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`• Total de atrasos registrados en el periodo: ${totalAtrasos}`, 18, finalY + 8)
      doc.text(`• Total de faltas injustificadas registradas: ${totalFaltasInjustificadas}`, 18, finalY + 14)
      doc.text(`• Recomendación pedagógica: Establecer planes de refuerzo y contacto oportuno con los representantes legales.`, 18, finalY + 20)

      // --- 6. FIRMAS DE RESPONSABILIDAD ---
      const firmaY = finalY + 45
      doc.line(35, firmaY, 90, firmaY)
      doc.line(pageWidth - 90, firmaY, pageWidth - 35, firmaY)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('ELABORADO POR:', 62.5, firmaY + 5, { align: 'center' })
      doc.text('APROBADO / RECTORADO:', pageWidth - 62.5, firmaY + 5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.text(`Prof. ${docenteInfo?.nombres} ${docenteInfo?.apellidos}`, 62.5, firmaY + 10, { align: 'center' })
      doc.text('Docente Tutor / Área', 62.5, firmaY + 15, { align: 'center' })

      doc.text('Autoridad Institucional', pageWidth - 62.5, firmaY + 10, { align: 'center' })
      doc.text(institucionInfo?.nombre_institucion || '', pageWidth - 62.5, firmaY + 15, { align: 'center' })

      // Descargar el PDF generado
      doc.save(`Informe_Pedagogico_${gradoSeleccionado}_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error(err)
      alert('Error al generar el reporte automatizado.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="border-b pb-4">
        <h2 className="font-black text-lg text-slate-800">Generador de Reportes Pedagógicos Automatizados</h2>
        <p className="text-xs text-slate-500">El sistema recopila notas, promedios y asistencias automáticamente sin intervención manual.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Seleccionar Alcance del Reporte:</label>
          <select 
            value={gradoSeleccionado} 
            onChange={(e) => setGradoSeleccionado(e.target.value)}
            className="w-full p-3 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
          >
            <option value="TODOS">📊 Reporte General (Toda la institución / Carga)</option>
            {gradosDisponibles.map((grado) => (
              <option key={grado} value={grado}>📚 Año de Básica / Curso: {grado}</option>
            ))}
          </select>
        </div>

        <div className="pt-5">
          <button 
            onClick={generarReportePDF}
            disabled={cargando}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition shadow-lg shadow-indigo-200 text-xs uppercase"
          >
            {cargando ? 'Generando PDF Oficial...' : '🖨️ Descargar Reporte PDF Automatizado'}
          </button>
        </div>
      </div>
    </div>
  )
}