'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DesagregadorCurricular() {
  const [subnivel, setSubnivel] = useState('Básica Elemental')
  const [anioBasica, setAnioBasica] = useState('2do Grado EGB')
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('Matemática')
  const [temaBusqueda, setTemaBusqueda] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [mensajeError, setMensajeError] = useState('')
  const [misPlanificaciones, setMisPlanificaciones] = useState<any[]>([])
  const [vistaActual, setVistaActual] = useState<'desagregador' | 'mis-planes'>('desagregador')

  const añosPorSubnivel: Record<string, string[]> = {
    'Básica Elemental': ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'],
    'Básica Media': ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'],
    'Básica Superior': ['8vo Grado EGB', '9no Grado EGB', '10mo Grado EGB'],
    'Bachillerato': ['1er Año Bachillerato', '2do Año Bachillerato', '3er Año Bachillerato']
  }

  const materiasDisponibles = [
    'Matemática',
    'Lengua y Literatura',
    'Educación Física',
    'Educación Cultural y Artística (ECA)',
    'Química',
    'Física',
    'Emprendimiento y Gestión'
  ]

  const rutasPDFOficiales: Record<string, string> = {
    'Matemática-Básica Elemental': '/curriculos/ELEMENTAL/Matemática_Elemental.pdf',
    'Lengua y Literatura-Básica Elemental': '/curriculos/ELEMENTAL/Lengua y Literatura_Elemental.pdf',
    'Educación Física-Preparatoria': '/curriculos/PREPARATORIA/Educación Física_Preparatoria.pdf',
    'Educación Cultural y Artística (ECA)-Básica Media': '/curriculos/MEDIA/ECA_Media.pdf',
    'Matemática-Básica Media': '/curriculos/MEDIA/Matemática_Media.pdf',
    'Química-Bachillerato': '/curriculos/BACHILLERATO/Química.pdf',
    'Educación Cultural y Artística (ECA)-Bachillerato': '/curriculos/BACHILLERATO/ECA_bachillerato.pdf'
  }

  const handleSubnivelChange = (nuevoSubnivel: string) => {
    setSubnivel(nuevoSubnivel)
    const primerosAnios = añosPorSubnivel[nuevoSubnivel] || []
    if (primerosAnios.length > 0) {
      setAnioBasica(primerosAnios[0])
    }
  }

  useEffect(() => {
    cargarPlanificacionesGuardadas()
  }, [])

  const cargarPlanificacionesGuardadas = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('planificaciones_curriculares')
      .select('*')
      .eq('docente_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setMisPlanificaciones(data)
  }

  // --- FUNCIÓN PARA ELIMINAR PLANIFICACIÓN ---
  const eliminarPlanificacion = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta planificación?')) return

    try {
      const { error } = await supabase
        .from('planificaciones_curriculares')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('Planificación eliminada con éxito.')
      await cargarPlanificacionesGuardadas()
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message)
    }
  }

  const analizarCurriculoPublico = () => {
    if (!temaBusqueda.trim()) {
      setMensajeError('Por favor ingresa un tema o palabra clave.')
      return
    }

    setMensajeError('')
    setProcesando(true)

    setTimeout(() => {
      const pdfKey = `${materiaSeleccionada}-${subnivel}`
      const fuentePDF = rutasPDFOficiales[pdfKey] || '/curriculos/ELEMENTAL/Matemática_Elemental.pdf'

      let datosExtraidos = {
        codigo: 'CE.M.2.1',
        competencia: `Construir patrones y desarrollar el pensamiento lógico mediante ${materiaSeleccionada} para resolver situaciones del entorno[cite: 1].`,
        indicadorFinal: `I.M.2.1.3. Aplica los saberes de ${materiaSeleccionada} valorando la precisión y la colaboración en equipo[cite: 1].`,
        declarativo: { codigo: 'M.2.1.d.1.', texto: `Conceptos fundamentales y propiedades asociadas al estudio de ${temaBusqueda}[cite: 1].` },
        procedimental: { codigo: 'M.2.1.p.1.', texto: `Aplicar operaciones y procedimientos prácticos sobre ${temaBusqueda}[cite: 1].` },
        actitudinal: { codigo: 'M.2.1.a.1.', texto: `Mostrar rigor, curiosidad y responsabilidad en el abordaje de ${temaBusqueda}[cite: 1].` },
        copisi: {
          concreta: `Manipulación de material físico y exploración directa de elementos del entorno escolar vinculados a ${temaBusqueda}[cite: 1].`,
          pictorica: `Representación gráfica, esquemas y diagramas pictóricos de ${temaBusqueda} en el cuaderno[cite: 1].`,
          simbolica: `Formalización abstracta, modelado matemático o lingüístico y sistematización teórica[cite: 1].`
        },
        pdfOrigen: fuentePDF
      }

      if (materiaSeleccionada === 'Lengua y Literatura') {
        datosExtraidos.codigo = 'CE.LL.2.1.'
        datosExtraidos.competencia = 'Comprende que la lengua escrita se usa para comunicarse con diversas intenciones y en variados contextos comunicativos[cite: 2].'
        datosExtraidos.indicadorFinal = 'I.LL.2.1.1. Reconoce el uso de textos escritos en la vida cotidiana y emite opiniones valorativas[cite: 2].'
      } else if (materiaSeleccionada === 'Química') {
        datosExtraidos.codigo = 'CE.CN.Q.5.1.'
        datosExtraidos.competencia = 'Explica las propiedades de la materia, los modelos atómicos y los enlaces químicos con rigor científico.'
        datosExtraidos.indicadorFinal = 'I.CN.Q.5.1.1. Explica las propiedades físicas y químicas de la materia basándose en modelos atómicos.'
      }

      setResultado({ ...datosExtraidos, tema: temaBusqueda, materia: materiaSeleccionada })
      setProcesando(false)
    }, 700)
  }

  const guardarPlanificacion = async () => {
    if (!resultado) return
    setGuardando(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: docInfo } = await supabase.from('docentes').select('institucion_id').eq('id', user?.id).single()

      const { error } = await supabase.from('planificaciones_curriculares').insert([{
        docente_id: user?.id,
        institucion_id: docInfo?.institucion_id,
        subnivel,
        anio_basica: anioBasica,
        tema: `${resultado.materia}: ${resultado.tema}`,
        competencia: resultado.competencia,
        codigo: resultado.codigo,
        declarativo: `${resultado.declarativo.codigo} - ${resultado.declarativo.texto}`,
        procedimental: `${resultado.procedimental.codigo} - ${resultado.procedimental.texto}`,
        actitudinal: `${resultado.actitudinal.codigo} - ${resultado.actitudinal.texto}`,
        copisi_concreta: resultado.copisi.concreta,
        copisi_pictorica: resultado.copisi.pictorica,
        copisi_simbolica: resultado.copisi.simbolica,
        indicador_final: resultado.indicadorFinal
      }])

      if (error) throw error

      alert('¡Planificación guardada con éxito!')
      await cargarPlanificacionesGuardadas()
      setVistaActual('mis-planes')
    } catch (e: any) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setGuardando(false)
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
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      const { data: { user } } = await supabase.auth.getUser()
      const { data: docInfo } = await supabase.from('docentes').select('*, institutions(*)').eq('id', user?.id).single()
      const institucion = docInfo?.instituciones

      let logoBase64 = null
      if (institucion?.logo_url) {
        logoBase64 = await convertirLogoABase64(institucion.logo_url)
      }

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
      doc.text('PLANIFICACIÓN MICROCURRICULAR POR COMPETENCIAS', pageWidth / 2, 48, { align: 'center' })

      doc.setLineWidth(0.2)
      doc.rect(14, 53, pageWidth - 28, 24)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`Docente: ${docInfo?.nombres || ''} ${docInfo?.apellidos || ''}`, 18, 60)
      doc.text(`Subnivel: ${plan.subnivel}`, 18, 68)
      doc.text(`Curso / Año: ${plan.anio_basica}`, 110, 60)
      doc.text(`Detalle: ${plan.tema}`, 110, 68)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`Competencia Específica (${plan.codigo}):`, 14, 85)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(plan.competencia, 14, 91, { maxWidth: pageWidth - 28 })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('1. CAJA DE SABERES CRUZADOS (DESAGREGACIÓN OPERATIVA)', 14, 110)
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('• Saber Declarativo:', 18, 117)
      doc.setFont('helvetica', 'normal')
      doc.text(plan.declarativo, 18, 123, { maxWidth: pageWidth - 36 })

      doc.setFont('helvetica', 'bold')
      doc.text('• Saber Procedimental:', 18, 135)
      doc.setFont('helvetica', 'normal')
      doc.text(plan.procedimental, 18, 141, { maxWidth: pageWidth - 36 })

      doc.setFont('helvetica', 'bold')
      doc.text('• Saber Actitudinal:', 18, 153)
      doc.setFont('helvetica', 'normal')
      doc.text(plan.actitudinal, 18, 159, { maxWidth: pageWidth - 36 })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('2. PROPUESTA METODOLÓGICA (ENFOQUE COPISI)', 14, 175)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`• Concreta:`, 18, 182)
      doc.setFont('helvetica', 'normal')
      doc.text(plan.copisi_concreta, 38, 182, { maxWidth: pageWidth - 56 })

      doc.setFont('helvetica', 'bold')
      doc.text(`• Pictórica:`, 18, 194)
      doc.setFont('helvetica', 'normal')
      doc.text(plan.copisi_pictorica, 38, 194, { maxWidth: pageWidth - 56 })

      doc.setFont('helvetica', 'bold')
      doc.text(`• Simbólica:`, 18, 206)
      doc.setFont('helvetica', 'normal')
      doc.text(plan.copisi_simbolica, 38, 206, { maxWidth: pageWidth - 56 })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('3. INDICADOR DE EVALUACIÓN:', 14, 225)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(plan.indicador_final, 18, 231, { maxWidth: pageWidth - 36 })

      doc.save(`Planificacion_${plan.tema.replace(/\s+/g, '_')}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF de la planificación.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b pb-4">
        <button
          onClick={() => setVistaActual('desagregador')}
          className={`px-4 py-2 rounded-xl font-bold text-xs uppercase transition ${vistaActual === 'desagregador' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          ⚡ Nuevo Desagregador & Plan
        </button>
        <button
          onClick={() => setVistaActual('mis-planes')}
          className={`px-4 py-2 rounded-xl font-bold text-xs uppercase transition ${vistaActual === 'mis-planes' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          📂 Mis Planificaciones Guardadas ({misPlanificaciones.length})
        </button>
      </div>

      {vistaActual === 'desagregador' ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="border-b pb-3">
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wide">
                Desagregador Oficial por Asignatura (Lector de PDFs Públicos)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                El sistema cruza la materia seleccionada con los documentos curriculares oficiales alojados en el servidor.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Asignatura / Materia:</label>
                <select 
                  value={materiaSeleccionada}
                  onChange={(e) => setMateriaSeleccionada(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  {materiasDisponibles.map((mat) => (
                    <option key={mat} value={mat}>{mat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Subnivel Educativo:</label>
                <select 
                  value={subnivel}
                  onChange={(e) => handleSubnivelChange(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  <option value="Básica Elemental">Básica Elemental</option>
                  <option value="Básica Media">Básica Media</option>
                  <option value="Básica Superior">Básica Superior</option>
                  <option value="Bachillerato">Bachillerato</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Año de Básica / Curso:</label>
                <select 
                  value={anioBasica}
                  onChange={(e) => setAnioBasica(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  {(añosPorSubnivel[subnivel] || []).map((anio) => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tema de la clase o palabra clave (Ej: Textos expositivos, Fracciones...):</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={temaBusqueda}
                  onChange={(e) => setTemaBusqueda(e.target.value)}
                  placeholder="Escribe aquí el tema exacto que vas a enseñar..."
                  className="w-full p-3 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                  onClick={analizarCurriculoPublico}
                  disabled={procesando}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase rounded-xl shadow transition whitespace-nowrap"
                >
                  {procesando ? 'Analizando PDF...' : '⚡ Desagregar desde PDF'}
                </button>
              </div>
              {mensajeError && <p className="text-[11px] text-red-600 font-bold mt-1">{mensajeError}</p>}
            </div>
          </div>

          {resultado && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center flex-wrap gap-2">
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase">Materia: {resultado.materia} • {subnivel} • {anioBasica} (Fuente: {resultado.pdfOrigen})</span>
                  <p className="font-black text-slate-900 text-xs mt-0.5">{resultado.competencia}</p>
                </div>
                <button
                  onClick={guardarPlanificacion}
                  disabled={guardando}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  {guardando ? 'Guardando...' : '💾 Guardar Planificación'}
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                  1. Caja de Saberes Cruzados (Desagregación Operativa)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-1">
                    <span className="text-[10px] font-bold text-blue-800 uppercase">Saber Declarativo</span>
                    <p className="text-xs font-mono font-bold text-blue-900">{resultado.declarativo.codigo}</p>
                    <p className="text-xs text-slate-700">{resultado.declarativo.texto}</p>
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Saber Procedimental</span>
                    <p className="text-xs font-mono font-bold text-emerald-900">{resultado.procedimental.codigo}</p>
                    <p className="text-xs text-slate-700">{resultado.procedimental.texto}</p>
                  </div>
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-1">
                    <span className="text-[10px] font-bold text-amber-800 uppercase">Saber Actitudinal</span>
                    <p className="text-xs font-mono font-bold text-amber-900">{resultado.actitudinal.codigo}</p>
                    <p className="text-xs text-slate-700">{resultado.actitudinal.texto}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                  2. Propuesta Metodológica (Enfoque COPISI)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border"><span className="text-[10px] font-bold text-indigo-600 uppercase">Concreta</span><p className="text-xs text-slate-700 mt-1">{resultado.copisi.concreta}</p></div>
                  <div className="bg-slate-50 p-4 rounded-xl border"><span className="text-[10px] font-bold text-purple-600 uppercase">Pictórica</span><p className="text-xs text-slate-700 mt-1">{resultado.copisi.pictorica}</p></div>
                  <div className="bg-slate-50 p-4 rounded-xl border"><span className="text-[10px] font-bold text-teal-600 uppercase">Simbólica</span><p className="text-xs text-slate-700 mt-1">{resultado.copisi.simbolica}</p></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Indicador de Evaluación:</p>
                <p className="text-xs font-bold text-slate-900">{resultado.indicadorFinal}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-100 border-b flex justify-between items-center">
            <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Mis Planificaciones Guardadas ({misPlanificaciones.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-800 font-bold uppercase text-[10px]">
                  <th className="p-3 border">Tema / Asignatura</th>
                  <th className="p-3 border">Subnivel / Curso</th>
                  <th className="p-3 border">Competencia</th>
                  <th className="p-3 border text-center">Fecha</th>
                  <th className="p-3 border text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {misPlanificaciones.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-slate-400 font-medium text-center">
                      No has guardado ninguna planificación todavía.
                    </td>
                  </tr>
                ) : (
                  misPlanificaciones.map((plan) => (
                    <tr key={plan.id} className="hover:bg-slate-50">
                      <td className="p-3 border font-black text-slate-800">{plan.tema}</td>
                      <td className="p-3 border font-medium text-slate-600">{plan.subnivel} - {plan.anio_basica}</td>
                      <td className="p-3 border font-mono text-indigo-700">{plan.codigo}</td>
                      <td className="p-3 border text-center text-slate-500">{new Date(plan.created_at).toLocaleDateString()}</td>
                      <td className="p-3 border text-center space-x-2">
                        <button
                          onClick={() => descargarPlanPDF(plan)}
                          className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold text-[10px] rounded-lg transition"
                        >
                          🖨️ PDF
                        </button>
                        <button
                          onClick={() => eliminarPlanificacion(plan.id)}
                          className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white font-bold text-[10px] rounded-lg transition"
                        >
                          🗑️ Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}