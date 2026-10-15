'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SabanaTrimestralPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [docenteId, setDocenteId] = useState('')
  const [nombresDocente, setNombresDocente] = useState('')

  // Control Dinámico de Años Lectivos Sincronizado con periodos_disponibles de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Asignaciones permitidas por el Rector para el año vigente
  const [asignaciones, setAsignaciones] = useState<any[]>([])
  
  // Filtros principales (Incluyendo Jornada)
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('MATUTINA')
  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('')
  const [trimestreSeleccionado, setTrimestreSeleccionado] = useState('Trimestre 1')

  // Datos de la tabla
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [materiasUnicas, setMateriasUnicas] = useState<string[]>([])
  const [matrizCalificaciones, setMatrizCalificaciones] = useState<{ [estudianteId: string]: { [asignatura: string]: { formativo: number, formativo70: number, sumativo: number, sumativo30: number, promedio: number } } }>({})

  useEffect(() => {
    cargarDatosDocente()
  }, [])

  useEffect(() => {
    if (jornadaSeleccionada && gradoSeleccionado && paraleloSeleccionado && trimestreSeleccionado && institucionId && anioLectivoVigente) {
      cargarEstudiantesYMatrizTrimestral()
    }
  }, [jornadaSeleccionada, gradoSeleccionado, paraleloSeleccionado, trimestreSeleccionado, anioLectivoVigente, institucionId])

  const cargarDatosDocente = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      setDocenteId(user.id)

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      let anioActivo = ''
      let periodosList: string[] = []
      let cerradosList: string[] = []

      if (doc?.institucion_id) {
        setInstitucionId(doc.institucion_id)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setCodigoAmie(doc.instituciones?.codigo_amie || '00H00000')
        setLogoUrl(doc.instituciones?.logo_url || '')
        setNombresDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim())

        const inst = doc.instituciones
        if (inst) {
          periodosList = inst.periodos_disponibles || []
          setPeriodosDisponibles(periodosList)

          if (inst.anio_lectivo_activo && periodosList.includes(inst.anio_lectivo_activo)) {
            anioActivo = inst.anio_lectivo_activo
          } else if (periodosList.length > 0) {
            anioActivo = periodosList[0]
          }

          setAnioLectivoVigente(anioActivo)

          if (inst.anos_cerrados && Array.isArray(inst.anos_cerrados)) {
            cerradosList = inst.anos_cerrados
            setAnosCerrados(cerradosList)
          }
        }

        if (anioActivo) {
          const { data: asigs } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asigs && asigs.length > 0) {
            setAsignaciones(asigs)
            const primeraJornada = asigs[0].jornada || 'MATUTINA'
            setJornadaSeleccionada(primeraJornada)

            const asigJornada = asigs.find(a => (a.jornada || 'MATUTINA') === primeraJornada) || asigs[0]
            setGradoSeleccionado(asigJornada.grado_curso)
            setParaleloSeleccionado(asigJornada.paralelo)
          } else {
            setAsignaciones([])
          }
        } else {
          setAsignaciones([])
        }
      }
    } catch (err) {
      console.error('Error al cargar datos del docente:', err)
    } finally {
      setCargando(false)
    }
  }

  const handleCambiarPeriodo = async (nuevoAnio: string) => {
    setAnioLectivoVigente(nuevoAnio)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: asigs } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', user.id)
        .eq('anio_lectivo', nuevoAnio)

      if (asigs && asigs.length > 0) {
        setAsignaciones(asigs)
        const primeraJ = asigs[0].jornada || 'MATUTINA'
        setJornadaSeleccionada(primeraJ)
        setGradoSeleccionado(asigs[0].grado_curso)
        setParaleloSeleccionado(asigs[0].paralelo)
      } else {
        setAsignaciones([])
        setGradoSeleccionado('')
        setParaleloSeleccionado('')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleJornadaChange = (nuevaJornada: string) => {
    setJornadaSeleccionada(nuevaJornada)
    const asigJornada = asignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada)
    if (asigJornada.length > 0) {
      const g = asigJornada[0].grado_curso
      setGradoSeleccionado(g)
      const p = asigJornada.find(a => a.grado_curso === g)?.paralelo || 'A'
      setParaleloSeleccionado(p)
    }
  }

  const cargarEstudiantesYMatrizTrimestral = async () => {
    try {
      setCargando(true)

      const materiasDelCurso = Array.from(new Set(
        asignaciones
          .filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === gradoSeleccionado && a.paralelo === paraleloSeleccionado)
          .map(a => a.asignatura)
      ))
      setMateriasUnicas(materiasDelCurso)

      const { data: estDataRaw } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('anio_lectivo', anioLectivoVigente)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      const estData = (estDataRaw || []).filter(e => {
        const jEst = e.jornada ? e.jornada.trim().toUpperCase() : 'MATUTINA'
        return jEst === jornadaSeleccionada.trim().toUpperCase()
      })

      if (estData) {
        setEstudiantes(estData)
        const estIds = estData.map(e => e.id)

        const { data: calData } = await supabase
          .from('calificaciones')
          .select('*')
          .eq('docente_id', docenteId)
          .eq('trimestre', trimestreSeleccionado)
          .eq('anio_lectivo', anioLectivoVigente)
          .in('estudiante_id', estIds.length > 0 ? estIds : ['none'])

        const mapaMatriz: any = {}

        estData.forEach(est => {
          mapaMatriz[est.id] = {}
          materiasDelCurso.forEach(materia => {
            const reg = calData?.find(c => c.estudiante_id === est.id && c.asignatura.trim() === materia.trim())
            
            const prom = reg?.promedio_parcial !== undefined && reg?.promedio_parcial !== null ? Number(reg.promedio_parcial) : 0
            
            const ins1 = reg?.insumo_1 !== undefined && reg?.insumo_1 !== null ? Number(reg.insumo_1) : 0
            const ins2 = reg?.insumo_2 !== undefined && reg?.insumo_2 !== null ? Number(reg.insumo_2) : 0
            const formativo = (ins1 > 0 || ins2 > 0) ? (ins1 + ins2) / 2 : 0
            const formativo70 = Number((formativo * 0.70).toFixed(2))
            
            const sumativo = reg?.proyecto_interdisciplinar !== undefined && reg?.proyecto_interdisciplinar !== null && Number(reg.proyecto_interdisciplinar) > 0 
              ? Number(reg.proyecto_interdisciplinar) 
              : (reg?.evaluacion_estructurada !== undefined && reg?.evaluacion_estructurada !== null ? Number(reg.evaluacion_estructurada) : 0)
            const sumativo30 = Number((sumativo * 0.30).toFixed(2))

            mapaMatriz[est.id][materia] = {
              formativo: Number(formativo.toFixed(2)),
              formativo70,
              sumativo: Number(sumativo.toFixed(2)),
              sumativo30,
              promedio: Number(prom.toFixed(2))
            }
          })
        })

        setMatrizCalificaciones(mapaMatriz)
      }
    } catch (err) {
      console.error('Error al cargar matriz trimestral:', err)
    } finally {
      setCargando(false)
    }
  }

  // Convertir logo institucional a base64 para el PDF
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

  // FUNCIÓN PROFESIONAL DE DESCARGA DIRECTA DE PDF PARA LA SÁBANA
  const generarPdfSabana = async () => {
    if (estudiantes.length === 0 || materiasUnicas.length === 0) {
      alert('⚠ No hay datos suficientes para generar el reporte de la sábana trimestral.')
      return
    }

    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('l', 'mm', 'a4') // Horizontal
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (logoUrl) {
        logoBase64 = await convertirLogoABase64(logoUrl)
      }

      // Encabezado institucional estilo membrete
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
      doc.text('SÁBANA TRIMESTRAL', pageWidth - 25, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`MATRIZ GENERAL DE RENDIMIENTO - ${trimestreSeleccionado.toUpperCase()}`, pageWidth / 2, 41, { align: 'center' })

      // Datos informativos
      autoTable(doc, {
        startY: 45,
        theme: 'grid',
        headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        body: [
          [`Curso: ${gradoSeleccionado} "${paraleloSeleccionado}"`, `Jornada: ${jornadaSeleccionada}`],
          [`Total Estudiantes: ${estudiantes.length}`, `Periodo: ${trimestreSeleccionado}`]
        ]
      })

      // Construir cabeceras dinámicas para la sábana
      const headersTabla = ['#', 'Cédula', 'Apellidos y Nombres']
      materiasUnicas.forEach(mat => {
        if (esBasicaElemental) {
          headersTabla.push(`${mat} (Prom)`, `${mat} (Cuali)`)
        } else {
          headersTabla.push(`${mat} (Form)`, `${mat} (70%)`, `${mat} (Sum)`, `${mat} (30%)`, `${mat} (Prom)`)
        }
      })

      const filasTabla = estudiantes.map((est, index) => {
        const notasEst = matrizCalificaciones[est.id] || {}
        const fila: any = [
          index + 1,
          est.cedula || 'S/N',
          `${est.apellidos} ${est.nombres}`
        ]

        materiasUnicas.forEach(materia => {
          const val = notasEst[materia] || { formativo: 0, formativo70: 0, sumativo: 0, sumativo30: 0, promedio: 0 }
          if (esBasicaElemental) {
            fila.push(val.promedio > 0 ? val.promedio.toFixed(2) : '0.00')
            fila.push(obtenerEscalaElemental(val.promedio) || '0.00')
          } else {
            fila.push(val.formativo > 0 ? val.formativo.toFixed(2) : '0.00')
            fila.push(val.formativo70 > 0 ? val.formativo70.toFixed(2) : '0.00')
            fila.push(val.sumativo > 0 ? val.sumativo.toFixed(2) : '0.00')
            fila.push(val.sumativo30 > 0 ? val.sumativo30.toFixed(2) : '0.00')
            fila.push(val.promedio > 0 ? val.promedio.toFixed(2) : '0.00')
          }
        })

        return fila
      })

      const tablaY = (doc as any).lastAutoTable.finalY + 4

      autoTable(doc, {
        startY: tablaY,
        theme: 'grid',
        head: [headersTabla],
        body: filasTabla,
        headStyles: { fillColor: [75, 76, 153], fontSize: 6, halign: 'center' },
        bodyStyles: { fontSize: 6 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 20 },
          2: { cellWidth: 45 }
        }
      })

      // Firma de responsabilidad
      const finalY = (doc as any).lastAutoTable.finalY + 15
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.line(pageWidth / 2 - 40, finalY, pageWidth / 2 + 40, finalY)
      doc.text(nombresDocente.toUpperCase(), pageWidth / 2, finalY + 4, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.text('DOCENTE RESPONSABLE / TUTOR', pageWidth / 2, finalY + 8, { align: 'center' })

      doc.save(`Sabana_${gradoSeleccionado}_${paraleloSeleccionado}_${trimestreSeleccionado}.pdf`)
    } catch (e: any) {
      console.error(e)
      alert('Error al generar el PDF de la sábana: ' + e.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  const obtenerEscalaElemental = (nota: number) => {
    if (nota === undefined || nota === null || isNaN(nota) || nota <= 0) return ''
    if (nota >= 9.01) return 'A+'
    if (nota >= 8.01) return 'A-'
    if (nota >= 7.01) return 'B+'
    if (nota >= 6.01) return 'B-'
    if (nota >= 5.01) return 'C+'
    if (nota >= 4.01) return 'C-'
    if (nota >= 3.01) return 'D+'
    if (nota >= 2.01) return 'D-'
    if (nota >= 1.01) return 'E+'
    return 'E-'
  }

  if (cargando && estudiantes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Sábana Trimestral...</p>
        </div>
      </div>
    )
  }

  const jornadasDisponibles = Array.from(new Set(asignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada).map(a => a.grado_curso)))
  const paralelosPermitidos = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === gradoSeleccionado).map(a => a.paralelo)))
  const esBasicaElemental = ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoSeleccionado)

  const getTrimestreColorStyle = (tri: string) => {
    switch (tri) {
      case 'Trimestre 1':
        return { backgroundColor: '#4b4c99', color: '#ffffff' }
      case 'Trimestre 2':
        return { backgroundColor: '#389186', color: '#ffffff' }
      case 'Trimestre 3':
        return { backgroundColor: '#d99b1e', color: '#ffffff' }
      default:
        return { backgroundColor: '#4b4c99', color: '#ffffff' }
    }
  }

  const paletaMaterias = [
    { headerBg: '#4b4c99', text: '#ffffff', subBg: 'rgba(75, 76, 153, 0.04)' },
    { headerBg: '#389186', text: '#ffffff', subBg: 'rgba(56, 145, 134, 0.04)' },
    { headerBg: '#d99b1e', text: '#ffffff', subBg: 'rgba(217, 155, 30, 0.04)' },
    { headerBg: '#4a5568', text: '#ffffff', subBg: 'rgba(74, 85, 104, 0.04)' },
    { headerBg: '#2b6cb0', text: '#ffffff', subBg: 'rgba(43, 108, 176, 0.04)' },
    { headerBg: '#7b341e', text: '#ffffff', subBg: 'rgba(123, 52, 30, 0.04)' },
    { headerBg: '#553c9a', text: '#ffffff', subBg: 'rgba(85, 60, 154, 0.04)' }
  ]

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99]/20 selection:text-[#4b4c99] font-sans">

      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
          >
            Año Lectivo Vigente: {anioLectivoVigente || 'Sin año activo'}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            Sábana Consolidada Trimestral ({trimestreSeleccionado})
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Jornada: {jornadaSeleccionada} • Curso: {gradoSeleccionado} "{paraleloSeleccionado}" {esBasicaElemental && '• [Básica Elemental - Cualitativa]'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* SELECTOR DE PERIODO */}
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">📅 Periodo:</span>
            {periodosDisponibles.length === 0 ? (
              <span className="text-xs font-bold text-amber-700 italic">Sin años creados</span>
            ) : (
              <select
                value={anioLectivoVigente}
                onChange={(e) => handleCambiarPeriodo(e.target.value)}
                style={{ color: '#4b4c99' }}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer"
              >
                {periodosDisponibles.map(p => (
                  <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => router.push('/docente/calificaciones')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer"
          >
            ← Volver a Calificaciones
          </button>

          {/* BOTÓN DESCARGAR PDF */}
          <button
            onClick={generarPdfSabana}
            disabled={generandoPdf || estudiantes.length === 0 || !anioLectivoVigente}
            style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
            className="px-5 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <span>📥</span> {generandoPdf ? 'Generando PDF...' : 'Descargar Sábana PDF'}
          </button>
        </div>
      </div>

      {/* AVISO SI NO HAY AÑO ACTIVO */}
      {!anioLectivoVigente && !cargando && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
      {esAnioCerrado && anioLectivoVigente && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. La sábana trimestral está en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Periodo Cerrado</span>
        </div>
      )}

      {/* SELECTORES DE FILTRO */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaSeleccionada}
            onChange={(e) => handleJornadaChange(e.target.value)}
            disabled={jornadasDisponibles.length <= 1}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
          >
            {jornadasDisponibles.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso</label>
          <select
            value={gradoSeleccionado}
            onChange={(e) => {
              const nuevoGrado = e.target.value
              setGradoSeleccionado(nuevoGrado)
              const par = asignaciones.find(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === nuevoGrado)?.paralelo || 'A'
              setParaleloSeleccionado(par)
            }}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
          >
            {gradosUnicos.length === 0 ? (
              <option value="">Sin carga asignada</option>
            ) : (
              gradosUnicos.map(g => (
                <option key={g} value={g}>{g}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
          <select
            value={paraleloSeleccionado}
            onChange={(e) => setParaleloSeleccionado(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
          >
            {paralelosPermitidos.map(p => (
              <option key={p} value={p}>Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: getTrimestreColorStyle(trimestreSeleccionado).backgroundColor }}>Trimestre Activo</label>
          <select
            value={trimestreSeleccionado}
            onChange={(e) => setTrimestreSeleccionado(e.target.value)}
            style={{ 
              backgroundColor: `${getTrimestreColorStyle(trimestreSeleccionado).backgroundColor}15`, 
              color: getTrimestreColorStyle(trimestreSeleccionado).backgroundColor, 
              borderColor: `${getTrimestreColorStyle(trimestreSeleccionado).backgroundColor}50` 
            }}
            className="w-full p-2.5 border-2 rounded-xl text-xs font-bold outline-none shadow-2xs cursor-pointer"
          >
            <option value="Trimestre 1" style={{ color: '#000' }}>Trimestre 1</option>
            <option value="Trimestre 2" style={{ color: '#000' }}>Trimestre 2</option>
            <option value="Trimestre 3" style={{ color: '#000' }}>Trimestre 3</option>
          </select>
        </div>
      </div>

      {/* TABLA SÁBANA GENERAL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
        <div 
          style={getTrimestreColorStyle(trimestreSeleccionado)}
          className="p-4 px-6 flex justify-between items-center"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider">
            MATRIZ GENERAL DE RENDIMIENTO • {jornadaSeleccionada} • {gradoSeleccionado || 'Curso'} "{paraleloSeleccionado}" ({trimestreSeleccionado} - {anioLectivoVigente || 'Sin periodo'})
          </h2>
          <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-xl">
            {estudiantes.length} Estudiantes • {materiasUnicas.length} Asignaturas
          </span>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 border border-slate-200 text-center w-12" rowSpan={2}>Nro</th>
                <th className="p-3 border border-slate-200 w-32" rowSpan={2}>Cédula</th>
                <th className="p-3 border border-slate-200 min-w-[220px]" rowSpan={2}>Apellidos y Nombres</th>
                
                {/* Cabeceras dinámicas por Materia con colores distintivos */}
                {materiasUnicas.map((materia, idx) => {
                  const colorMat = paletaMaterias[idx % paletaMaterias.length]
                  return (
                    <th 
                      key={materia} 
                      style={{ backgroundColor: colorMat.headerBg, color: colorMat.text }}
                      className="p-2.5 border border-slate-200 text-center font-bold tracking-tight shadow-2xs" 
                      colSpan={esBasicaElemental ? 2 : 5}
                    >
                      {materia}
                    </th>
                  )
                })}
              </tr>

              <tr className="bg-slate-100 text-[9px] text-center font-semibold text-slate-700">
                {materiasUnicas.map((materia, idx) => {
                  const colorMat = paletaMaterias[idx % paletaMaterias.length]
                  return esBasicaElemental ? (
                    <Fragment key={`${materia}-elemental`}>
                      <th className="border border-slate-200 p-1.5" style={{ backgroundColor: colorMat.subBg }}>PROMEDIO</th>
                      <th className="border border-slate-200 p-1.5 font-bold" style={{ backgroundColor: colorMat.subBg, color: colorMat.headerBg }}>CALF. CUALI.</th>
                    </Fragment>
                  ) : (
                    <Fragment key={`${materia}-normal`}>
                      <th className="border border-slate-200 p-1.5" style={{ backgroundColor: colorMat.subBg }} title="Evaluación Formativa">EVA. FORM.</th>
                      <th className="border border-slate-200 p-1.5 font-bold" style={{ backgroundColor: colorMat.subBg }}>70%</th>
                      <th className="border border-slate-200 p-1.5" style={{ backgroundColor: colorMat.subBg }} title="Evaluación Sumativa">EVA. SUM.</th>
                      <th className="border border-slate-200 p-1.5 font-bold" style={{ backgroundColor: colorMat.subBg }}>30%</th>
                      <th className="border border-slate-200 p-1.5 font-black shadow-inner" style={{ backgroundColor: colorMat.headerBg, color: colorMat.text }}>PROM.</th>
                    </Fragment>
                  )
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {!anioLectivoVigente ? (
                <tr>
                  <td colSpan={3 + (materiasUnicas.length * (esBasicaElemental ? 2 : 5))} className="p-8 text-center text-amber-800 font-bold bg-amber-50">
                    ⚠️ No hay un año lectivo activo configurado en la institución.
                  </td>
                </tr>
              ) : asignaciones.length === 0 ? (
                <tr>
                  <td colSpan={3 + (materiasUnicas.length * (esBasicaElemental ? 2 : 5))} className="p-8 text-center text-amber-800 font-bold bg-amber-50">
                    ⚠️ No tienes carga horaria asignada para el periodo vigente ({anioLectivoVigente}).
                  </td>
                </tr>
              ) : estudiantes.length === 0 ? (
                <tr>
                  <td colSpan={3 + (materiasUnicas.length * (esBasicaElemental ? 2 : 5))} className="p-8 text-center text-slate-500 font-medium">
                    No hay estudiantes registrados o asignaturas disponibles para esta jornada, curso y paralelo en el periodo {anioLectivoVigente}.
                  </td>
                </tr>
              ) : (
                estudiantes.map((est, idx) => {
                  const notasEstudiante = matrizCalificaciones[est.id] || {}

                  return (
                    <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-2 border border-slate-200 text-slate-600 font-mono">{est.cedula || 'S/N'}</td>
                      <td className="p-2 border border-slate-200 font-bold text-slate-800 uppercase whitespace-nowrap">
                        {est.apellidos} {est.nombres}
                      </td>

                      {materiasUnicas.map((materia, idxMat) => {
                        const valMateria = notasEstudiante[materia] || { formativo: 0, formativo70: 0, sumativo: 0, sumativo30: 0, promedio: 0 }
                        const escalaCuali = obtenerEscalaElemental(valMateria.promedio)
                        const colorMat = paletaMaterias[idxMat % paletaMaterias.length]

                        return (
                          esBasicaElemental ? (
                            <Fragment key={`${est.id}-${materia}-elem-val`}>
                              <td className="p-2 border border-slate-200 text-center font-semibold text-slate-800" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.promedio > 0 ? valMateria.promedio.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-bold shadow-2xs" style={{ backgroundColor: colorMat.subBg, color: colorMat.headerBg }}>
                                {escalaCuali || '0.00'}
                              </td>
                            </Fragment>
                          ) : (
                            <Fragment key={`${est.id}-${materia}-norm-val`}>
                              <td className="p-2 border border-slate-200 text-center font-medium text-slate-700" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.formativo > 0 ? valMateria.formativo.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-semibold text-slate-800" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.formativo70 > 0 ? valMateria.formativo70.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-medium text-slate-700" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.sumativo > 0 ? valMateria.sumativo.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-semibold text-slate-800" style={{ backgroundColor: colorMat.subBg }}>
                                {valMateria.sumativo30 > 0 ? valMateria.sumativo30.toFixed(2) : '0.00'}
                              </td>
                              <td className="p-2 border border-slate-200 text-center font-bold shadow-2xs" style={{ backgroundColor: `${colorMat.headerBg}15`, color: colorMat.headerBg }}>
                                {valMateria.promedio > 0 ? valMateria.promedio.toFixed(2) : '0.00'}
                              </td>
                            </Fragment>
                          )
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}