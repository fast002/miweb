'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ControlDocumentosPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])

  const [jornadaActual, setJornadaActual] = useState('MATUTINA')
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')

  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [docsMap, setDocsMap] = useState<{ [id: string]: { acta_compromiso: boolean; ficha_personal: boolean; acta_consentimiento: boolean } }>({})

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: doc } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user.id).maybeSingle()
        
        let anioActivo = ''
        if (doc) {
          setInstitucionId(doc.institucion_id || '')
          const inst = doc.instituciones
          if (inst) {
            setNombreInstitucion(inst.nombre_institucion || 'Unidad Educativa')
            setCodigoAmie(inst.codigo_amie || '00H00000')
            setLogoUrl(inst.logo_url || '')
            anioActivo = inst.anio_lectivo_activo || (inst.periodos_disponibles?.[0] || '2026-2027')
            setAnioLectivoVigente(anioActivo)
          }
        }

        if (anioActivo) {
          const { data: asignacionesData } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asignacionesData && asignacionesData.length > 0) {
            setMisAsignaciones(asignacionesData)
            setJornadaActual(asignacionesData[0].jornada || 'MATUTINA')
            setGrado(asignacionesData[0].grado_curso)
            setParalelo(asignacionesData[0].paralelo)
          }
        }
      } catch (err) {
        console.error('Error al iniciar:', err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  // Cargar estudiantes del curso seleccionado
  useEffect(() => {
    async function cargarEstudiantes() {
      if (!institucionId || !grado || !paralelo || !anioLectivoVigente) return

      try {
        const { data: estData } = await supabase
          .from('estudiantes')
          .select('*')
          .eq('institucion_id', institucionId)
          .eq('grado_curso', grado)
          .eq('paralelo', paralelo)
          .eq('jornada', jornadaActual)
          .eq('anio_lectivo', anioLectivoVigente)
          .eq('estado', 'activo')
          .order('apellidos', { ascending: true })

        const lista = estData || []
        setEstudiantes(lista)

        const mapa: any = {}
        lista.forEach(e => {
          mapa[e.id] = {
            acta_compromiso: e.acta_compromiso || false,
            ficha_personal: e.ficha_personal || false,
            acta_consentimiento: e.acta_consentimiento || false
          }
        })
        setDocsMap(mapa)
      } catch (err) {
        console.error('Error al cargar estudiantes:', err)
      }
    }

    cargarEstudiantes()
  }, [institucionId, grado, paralelo, jornadaActual, anioLectivoVigente])

  const handleCheckboxChange = (estudianteId: string, campo: 'acta_compromiso' | 'ficha_personal' | 'acta_consentimiento') => {
    setDocsMap(prev => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        [campo]: !prev[estudianteId]?.[campo]
      }
    }))
  }

  const handleGuardarCambios = async () => {
    setGuardando(true)
    setMensaje(null)

    try {
      for (const est of estudiantes) {
        const docState = docsMap[est.id]
        if (!docState) continue

        const { error } = await supabase
          .from('estudiantes')
          .update({
            acta_compromiso: docState.acta_compromiso,
            ficha_personal: docState.ficha_personal,
            acta_consentimiento: docState.acta_consentimiento
          })
          .eq('id', est.id)

        if (error) throw error
      }

      setMensaje({ tipo: 'exito', texto: '¡Control de documentos actualizado y guardado correctamente!' })
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  // Cálculo de porcentajes
  const totalEstudiantes = estudiantes.length
  const calcularPorcentaje = (campo: 'acta_compromiso' | 'ficha_personal' | 'acta_consentimiento') => {
    if (totalEstudiantes === 0) return 0
    const entregados = estudiantes.filter(e => docsMap[e.id]?.[campo]).length
    return Math.round((entregados / totalEstudiantes) * 100)
  }

  const porcentajeCompromiso = calcularPorcentaje('acta_compromiso')
  const porcentajeFicha = calcularPorcentaje('ficha_personal')
  const porcentajeConsentimiento = calcularPorcentaje('acta_consentimiento')

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

  // GENERAR PDF CON CUMPLIMIENTO Y LISTA DETALLADA
  const generarPdfDocumentos = async () => {
    if (estudiantes.length === 0) {
      alert('⚠ No hay estudiantes para generar el reporte.')
      return
    }

    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('p', 'mm', 'a4') // Formato Vertical
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (logoUrl) {
        logoBase64 = await convertirLogoABase64(logoUrl)
      }

      // Membrete Institucional
      doc.setLineWidth(0.4)
      doc.rect(14, 12, pageWidth - 28, 22)
      doc.line(45, 12, 45, 34)
      doc.line(pageWidth - 45, 12, pageWidth - 45, 34)

      if (logoBase64) {
        doc.addImage(logoBase64 as string, 'PNG', 16, 13, 20, 20)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text((nombreInstitucion || 'UNIDAD EDUCATIVA').toUpperCase(), pageWidth / 2, 18, { align: 'center' })
      doc.setFontSize(8)
      doc.text(`CÓDIGO AMIE: ${codigoAmie || '00H00000'}`, pageWidth / 2, 24, { align: 'center' })
      doc.setTextColor(75, 76, 153)
      doc.text(`AÑO LECTIVO: ${anioLectivoVigente || '2026-2027'}`, pageWidth / 2, 30, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('REPORTE DOCUMENTAL', pageWidth - 22, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`CONTROL DE ENTREGA DE DOCUMENTOS - ${grado} "${paralelo}" (${jornadaActual})`, pageWidth / 2, 41, { align: 'center' })

      // Tabla de Resumen de Porcentajes
      autoTable(doc, {
        startY: 46,
        theme: 'grid',
        headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center' },
        head: [['Documento Evaluado', 'Total Estudiantes', 'Entregado (%)', 'Pendiente (%)']],
        body: [
          ['Acta de Compromiso', totalEstudiantes, `${porcentajeCompromiso}%`, `${100 - porcentajeCompromiso}%`],
          ['Ficha Personal', totalEstudiantes, `${porcentajeFicha}%`, `${100 - porcentajeFicha}%`],
          ['Acta de Consentimiento', totalEstudiantes, `${porcentajeConsentimiento}%`, `${100 - porcentajeConsentimiento}%`]
        ]
      })

      // Tabla de Listado Detallado (Cumple / No Cumple)
      const headersTabla = ['#', 'Apellidos y Nombres', 'Acta Compromiso', 'Ficha Personal', 'Acta Consentimiento']
      const filasTabla = estudiantes.map((est, index) => {
        const d = docsMap[est.id] || {}
        return [
          index + 1,
          `${est.apellidos} ${est.nombres}`,
          d.acta_compromiso ? 'CUMPLE' : 'NO CUMPLE',
          d.ficha_personal ? 'CUMPLE' : 'NO CUMPLE',
          d.acta_consentimiento ? 'CUMPLE' : 'NO CUMPLE'
        ]
      })

      const tablaY = (doc as any).lastAutoTable.finalY + 8
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('DETALLE INDIVIDUAL DE ESTUDIANTES:', 14, tablaY - 2)

      autoTable(doc, {
        startY: tablaY,
        theme: 'grid',
        head: [headersTabla],
        body: filasTabla,
        headStyles: { fillColor: [75, 76, 153], fontSize: 7, halign: 'center' },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 65 },
          2: { cellWidth: 35, halign: 'center' },
          3: { cellWidth: 35, halign: 'center' },
          4: { cellWidth: 35, halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && (data.column.index >= 2)) {
            if (data.cell.raw === 'CUMPLE') {
              data.cell.styles.textColor = [16, 138, 97] // Verde
              data.cell.styles.fontStyle = 'bold'
            } else {
              data.cell.styles.textColor = [197, 48, 48] // Rojo
              data.cell.styles.fontStyle = 'bold'
            }
          }
        }
      })

      doc.save(`Control_Documentos_${grado}_${paralelo}_${jornadaActual}.pdf`)
    } catch (e: any) {
      console.error(e)
      alert('Error al generar el PDF: ' + e.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  const jornadasDisponibles = Array.from(new Set(misAsignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual).map(a => a.grado_curso)))
  const paralelosDisponibles = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado).map(a => a.paralelo)))

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Control de Documentos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#4b4c99]/20 selection:text-[#4b4c99]">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border text-[#4b4c99] bg-[#4b4c99]/10 border-[#4b4c99]/20 inline-block">
            Periodo: {anioLectivoVigente}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            Control de Entrega de Documentos
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Verificación de actas y fichas institucionales
          </p>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <button
            onClick={generarPdfDocumentos}
            disabled={generandoPdf || totalEstudiantes === 0}
            style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
            className="px-4 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {generandoPdf ? 'Generando PDF...' : 'Imprimir / PDF'}
          </button>

          <button
            onClick={handleGuardarCambios}
            disabled={guardando || totalEstudiantes === 0}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* TARJETAS DE PORCENTAJES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Acta de Compromiso</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{porcentajeCompromiso}%</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-[#4b4c99] flex items-center justify-center font-bold text-sm">
            📄
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Fichas Personales</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{porcentajeFicha}%</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm">
            📋
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Acta de Consentimiento</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{porcentajeConsentimiento}%</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">
            ✍️
          </div>
        </div>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* SELECTORES DE FILTRO */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaActual}
            onChange={(e) => setJornadaActual(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {jornadasDisponibles.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso</label>
          <select
            value={grado}
            onChange={(e) => setGrado(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {gradosUnicos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
          <select
            value={paralelo}
            onChange={(e) => setParalelo(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {paralelosDisponibles.map(p => <option key={p} value={p}>Paralelo {p}</option>)}
          </select>
        </div>
      </div>

      {/* TABLA DE VERIFICACIÓN */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-x-auto">
        {estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs">
            No hay estudiantes activos en este curso.
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center border border-slate-200">#</th>
                <th className="p-3 border border-slate-200">Apellidos y Nombres</th>
                <th className="p-3 text-center border border-slate-200 w-36">Acta de Compromiso</th>
                <th className="p-3 text-center border border-slate-200 w-36">Ficha Personal</th>
                <th className="p-3 text-center border border-slate-200 w-36">Acta de Consentimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {estudiantes.map((est, idx) => {
                const docState = docsMap[est.id] || {}
                return (
                  <tr key={est.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center font-bold text-slate-400 border border-slate-200">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-800 border border-slate-200 whitespace-nowrap">
                      {est.apellidos} {est.nombres}
                    </td>
                    <td className="p-3 text-center border border-slate-200">
                      <input
                        type="checkbox"
                        checked={docState.acta_compromiso || false}
                        onChange={() => handleCheckboxChange(est.id, 'acta_compromiso')}
                        className="h-4 w-4 rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99] cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-center border border-slate-200">
                      <input
                        type="checkbox"
                        checked={docState.ficha_personal || false}
                        onChange={() => handleCheckboxChange(est.id, 'ficha_personal')}
                        className="h-4 w-4 rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99] cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-center border border-slate-200">
                      <input
                        type="checkbox"
                        checked={docState.acta_consentimiento || false}
                        onChange={() => handleCheckboxChange(est.id, 'acta_consentimiento')}
                        className="h-4 w-4 rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99] cursor-pointer"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}