'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SeguimientoAprendizaje() {
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [casosRegistrados, setCasosRegistrados] = useState<any[]>([])
  const [caso, setCaso] = useState({ estudiante_id: '', tipo: '', obs: '', estrategia: '' })
  const [cargando, setCargando] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    // 1. Cargar lista de estudiantes activos
    const { data: estData } = await supabase
      .from('estudiantes')
      .select('id, nombres, apellidos, grado_curso')
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true })
    
    if (estData) setEstudiantes(estData)

    // 2. Cargar casos de seguimiento registrados con relación a estudiantes y docentes
    const { data: casosData } = await supabase
      .from('seguimiento_aprendizaje')
      .select('*, estudiantes(nombres, apellidos, grado_curso), docentes:docente_id(nombres, apellidos)')
      .order('fecha_deteccion', { ascending: false })

    if (casosData) setCasosRegistrados(casosData)
  }

  const guardarCaso = async () => {
    if (!caso.estudiante_id || !caso.tipo) {
      alert("Por favor selecciona un estudiante y especifica el tipo de dificultad.")
      return
    }

    setCargando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase.from('seguimiento_aprendizaje').insert([{
        estudiante_id: caso.estudiante_id,
        tipo_dificultad: caso.tipo,
        observaciones: caso.obs,
        estrategias_aplicadas: caso.estrategia,
        docente_id: user?.id
      }])

      if (error) throw error

      alert('¡Caso registrado con éxito!')
      setCargando(false)
      setCaso({ estudiante_id: '', tipo: '', obs: '', estrategia: '' })
      await cargarDatos()
    } catch (err: any) {
      alert('Error al registrar: ' + err.message)
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

  // --- REPORTE GENERAL ---
  const descargarInformeGeneralPDF = async () => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      const { data: { user } } = await supabase.auth.getUser()
      const { data: docInfo } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user?.id).single()
      const institucion = docInfo?.instituciones

      let logoBase64 = null
      if (institucion?.logo_url) {
        logoBase64 = await convertirLogoABase64(institucion.logo_url)
      }

      // Encabezado institucional
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
      doc.setFontSize(12)
      doc.text('INFORME GENERAL: DIFICULTADES DE APRENDIZAJE', pageWidth / 2, 48, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Docente Emisor: ${docInfo?.nombres || ''} ${docInfo?.apellidos || ''}`, 14, 56)
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, pageWidth - 14, 56, { align: 'right' })

      const tableData = casosRegistrados.map(item => [
        item.estudiantes ? `${item.estudiantes.apellidos} ${item.estudiantes.nombres}` : 'N/A',
        item.estudiantes?.grado_curso || 'N/A',
        item.tipo_dificultad,
        item.estrategias_aplicadas || 'Sin especificar',
        item.docentes ? `${item.docentes.apellidos} ${item.docentes.nombres}` : 'N/A'
      ])

      autoTable(doc, {
        startY: 62,
        head: [['Estudiante', 'Curso', 'Dificultad', 'Estrategias Aplicadas', 'Docente Reporta']],
        body: tableData.length > 0 ? tableData : [['No hay casos registrados en el sistema', '', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 }
      })

      doc.save(`Informe_General_Dificultades_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF general.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  // --- REPORTE INDIVIDUAL DE CADA ESTUDIANTE ---
  const descargarFichaIndividualPDF = async (item: any) => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      const { data: { user } } = await supabase.auth.getUser()
      const { data: docInfo } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user?.id).single()
      const institucion = docInfo?.instituciones

      let logoBase64 = null
      if (institucion?.logo_url) {
        logoBase64 = await convertirLogoABase64(institucion.logo_url)
      }

      // Encabezado institucional
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

      // Título de la Ficha
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('FICHA DE SEGUIMIENTO PEDAGÓGICO INDIVIDUAL', pageWidth / 2, 48, { align: 'center' })

      // Datos del Estudiante
      doc.setLineWidth(0.2)
      doc.rect(14, 54, pageWidth - 28, 32)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('DATOS DEL ESTUDIANTE:', 18, 62)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const nombreEst = item.estudiantes ? `${item.estudiantes.apellidos} ${item.estudiantes.nombres}` : 'N/A'
      doc.text(`Estudiante: ${nombreEst}`, 18, 70)
      doc.text(`Grado / Curso: ${item.estudiantes?.grado_curso || 'N/A'}`, 18, 77)
      doc.text(`Fecha de Detección: ${new Date(item.fecha_deteccion).toLocaleDateString()}`, 110, 70)
      doc.text(`Docente Responsable: ${item.docentes ? `${item.docentes.apellidos} ${item.docentes.nombres}` : 'N/A'}`, 110, 77)

      // Detalle del Caso
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('1. TIPO DE DIFICULTAD O NECESIDAD:', 14, 96)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(item.tipo_dificultad || 'Sin especificar', 18, 102)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('2. OBSERVACIONES INICIALES:', 14, 114)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(item.observaciones || 'No registra observaciones.', 18, 120, { maxWidth: pageWidth - 36 })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('3. ESTRATEGIAS METODOLÓGICAS APLICADAS:', 14, 142)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(item.estrategias_aplicadas || 'No registra estrategias metodológicas.', 18, 148, { maxWidth: pageWidth - 36 })

      // Firmas de Responsabilidad
      const firmaY = 210
      doc.line(35, firmaY, 90, firmaY)
      doc.line(pageWidth - 90, firmaY, pageWidth - 35, firmaY)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('ELABORADO POR:', 62.5, firmaY + 5, { align: 'center' })
      doc.text('APROBADO / DECE / RECTORADO:', pageWidth - 62.5, firmaY + 5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.text(item.docentes ? `${item.docentes.apellidos} ${item.docentes.nombres}` : 'Docente Tutor', 62.5, firmaY + 10, { align: 'center' })
      doc.text('Autoridad / DECE', pageWidth - 62.5, firmaY + 10, { align: 'center' })

      const apellidoLimpio = item.estudiantes ? item.estudiantes.apellidos.replace(/\s+/g, '_') : 'Estudiante'
      doc.save(`Ficha_Seguimiento_${apellidoLimpio}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar la ficha individual.')
    }
  }

  return (
    <div className="space-y-6">
      
      {/* 1. FORMULARIO DE REGISTRO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b pb-3 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 className="font-black text-slate-800 text-sm uppercase tracking-wide">
              Registro de Dificultades de Aprendizaje
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Documenta casos específicos para brindar apoyo pedagógico personalizado.
            </p>
          </div>
          <button 
            onClick={descargarInformeGeneralPDF}
            disabled={generandoPdf}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
          >
            {generandoPdf ? 'Generando PDF...' : '🖨️ Descargar Informe General PDF'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Estudiante:</label>
            <select 
              value={caso.estudiante_id}
              onChange={(e) => setCaso({...caso, estudiante_id: e.target.value})} 
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              <option value="">-- Seleccionar Estudiante --</option>
              {estudiantes.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.apellidos} {est.nombres} ({est.grado_curso || 'Sin grado'})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tipo de Dificultad / Necesidad:</label>
            <input 
              type="text"
              placeholder="Ej: Dislexia, TDAH, Dificultad en Cálculo..." 
              value={caso.tipo}
              onChange={(e) => setCaso({...caso, tipo: e.target.value})} 
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none" 
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Observaciones Iniciales:</label>
            <textarea 
              placeholder="Detalles sobre el caso..." 
              value={caso.obs}
              onChange={(e) => setCaso({...caso, obs: e.target.value})} 
              className="w-full p-2.5 border rounded-xl text-xs font-medium text-slate-800 bg-slate-50 outline-none"
              rows={3} 
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Estrategias Metodológicas Aplicadas:</label>
            <textarea 
              placeholder="Acciones tomadas en el aula..." 
              value={caso.estrategia}
              onChange={(e) => setCaso({...caso, estrategia: e.target.value})} 
              className="w-full p-2.5 border rounded-xl text-xs font-medium text-slate-800 bg-slate-50 outline-none"
              rows={3} 
            />
          </div>

          <div className="md:col-span-2 pt-2">
            <button 
              onClick={guardarCaso} 
              disabled={cargando}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase rounded-xl shadow transition"
            >
              {cargando ? 'Guardando Registro...' : 'Guardar y Registrar Seguimiento'}
            </button>
          </div>

        </div>
      </div>

      {/* 2. TABLA DE CASOS REGISTRADOS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-100 border-b flex justify-between items-center">
          <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Casos en Seguimiento Pedagógico ({casosRegistrados.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-200 text-slate-800 font-bold uppercase text-[10px]">
                <th className="p-3 border">Estudiante</th>
                <th className="p-3 border">Curso</th>
                <th className="p-3 border">Dificultad</th>
                <th className="p-3 border">Estrategias Aplicadas</th>
                <th className="p-3 border">Docente que Reporta</th>
                <th className="p-3 border text-center">Fecha</th>
                <th className="p-3 border text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {casosRegistrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-slate-400 font-medium text-center">
                    No hay estudiantes registrados con dificultades de aprendizaje actualmente.
                  </td>
                </tr>
              ) : (
                casosRegistrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 border font-black text-slate-800">
                      {item.estudiantes ? `${item.estudiantes.apellidos} ${item.estudiantes.nombres}` : '---'}
                    </td>
                    <td className="p-3 border font-medium text-slate-600">
                      {item.estudiantes?.grado_curso || 'N/A'}
                    </td>
                    <td className="p-3 border font-bold text-amber-700">
                      {item.tipo_dificultad}
                    </td>
                    <td className="p-3 border text-slate-600">
                      {item.estrategias_aplicadas || 'Sin especificar'}
                    </td>
                    <td className="p-3 border font-bold text-indigo-900">
                      {item.docentes ? `${item.docentes.apellidos} ${item.docentes.nombres}` : '---'}
                    </td>
                    <td className="p-3 border text-center text-slate-500 font-medium">
                      {new Date(item.fecha_deteccion).toLocaleDateString()}
                    </td>
                    <td className="p-3 border text-center">
                      <button
                        onClick={() => descargarFichaIndividualPDF(item)}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold text-[10px] rounded-lg transition"
                      >
                        🖨️ Ficha PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}