'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ConsolidadoAnualPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('UNIDAD EDUCATIVA')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [docenteId, setDocenteId] = useState('')
  const [nombreDocente, setNombreDocente] = useState('')

  const [autoridadesDisponibles, setAutoridadesDisponibles] = useState<{ nombre: string; cargo: string }[]>([])
  const [autoridadSeleccionadaIndex, setAutoridadSeleccionadaIndex] = useState(0)

  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  const [asignaciones, setAsignaciones] = useState<any[]>([])
  
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('MATUTINA')
  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('')
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState('')

  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [consolidadoMap, setConsolidadoMap] = useState<{ [estudianteId: string]: { t1: number | null; t2: number | null; t3: number | null } }>({})

  useEffect(() => {
    cargarDatosDocente()
  }, [])

  useEffect(() => {
    if (jornadaSeleccionada && gradoSeleccionado && paraleloSeleccionado && asignaturaSeleccionada && institucionId && anioLectivoVigente) {
      cargarEstudiantesYNotasTrimestrales()
    }
  }, [jornadaSeleccionada, gradoSeleccionado, paraleloSeleccionado, asignaturaSeleccionada, anioLectivoVigente, institucionId])

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
      let cerradosList: string[] = []

      if (doc?.institucion_id) {
        const instId = doc.institucion_id
        setInstitucionId(instId)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setCodigoAmie(doc.instituciones?.codigo_amie || '00H00000')
        setInstitucionLogo(doc.instituciones?.logo_url || '')
        setNombreDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim())

        const inst = doc.instituciones
        if (inst) {
          const periodosInst = inst.periodos_disponibles || []
          if (inst.anio_lectivo_activo && periodosInst.includes(inst.anio_lectivo_activo)) {
            anioActivo = inst.anio_lectivo_activo
          } else if (periodosInst.length > 0) {
            anioActivo = periodosInst[0]
          }

          setAnioLectivoVigente(anioActivo)

          if (inst.anos_cerrados) {
            cerradosList = inst.anos_cerrados
            setAnosCerrados(cerradosList)
          }
        }

        const { data: autoridadesData } = await supabase
          .from('docentes')
          .select('nombres, apellidos, rol')
          .eq('institucion_id', instId)
          
        if (autoridadesData) {
          const filtrados = autoridadesData.filter(d => {
            const r = (d.rol || '').toLowerCase()
            return r.includes('rector') || r.includes('vicerrector') || r.includes('director')
          })

          const listaAutoridades = filtrados.map(d => ({
            nombre: `${d.nombres || ''} ${d.apellidos || ''}`.trim().toUpperCase(),
            cargo: (d.rol || 'RECTOR(A)').toUpperCase()
          }))
          
          if (listaAutoridades.length > 0) {
            setAutoridadesDisponibles(listaAutoridades)
            setAutoridadSeleccionadaIndex(0)
          } else {
            setAutoridadesDisponibles([{ nombre: 'RAUL PINOS', cargo: 'VICERRECTOR' }])
            setAutoridadSeleccionadaIndex(0)
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
            
            const primeraAsigJornada = asigs.find(a => (a.jornada || 'MATUTINA') === primeraJornada) || asigs[0]
            setGradoSeleccionado(primeraAsigJornada.grado_curso)
            setParaleloSeleccionado(primeraAsigJornada.paralelo)
            setAsignaturaSeleccionada(primeraAsigJornada.asignatura)
          } else {
            setAsignaciones([])
          }
        } else {
          setAsignaciones([])
        }
      }
    } catch (err) {
      console.error('Error al cargar datos del consolidado:', err)
    } finally {
      setCargando(false)
    }
  }

  const cargarEstudiantesYNotasTrimestrales = async () => {
    try {
      let query = supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('estado', 'activo')

      const { data: estDataRaw } = await query.order('apellidos', { ascending: true })

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
          .eq('asignatura', asignaturaSeleccionada.trim())
          .eq('anio_lectivo', anioLectivoVigente)
          .in('estudiante_id', estIds.length > 0 ? estIds : ['none'])

        const mapaNotas: { [key: string]: { t1: number | null; t2: number | null; t3: number | null } } = {}

        estData.forEach(est => {
          const registrosEst = calData?.filter(c => c.estudiante_id === est.id) || []

          let t1: number | null = null
          let t2: number | null = null
          let t3: number | null = null

          registrosEst.forEach(r => {
            const notaParcial = r.promedio_parcial !== undefined && r.promedio_parcial !== null ? Number(r.promedio_parcial) : null
            if (notaParcial === null) return

            const periodoStr = String(r.trimestre || r.periodo || r.quimestre || '').toLowerCase()
            if (periodoStr.includes('1') || periodoStr.includes('trimestre 1')) t1 = notaParcial
            else if (periodoStr.includes('2') || periodoStr.includes('trimestre 2')) t2 = notaParcial
            else if (periodoStr.includes('3') || periodoStr.includes('trimestre 3')) t3 = notaParcial
          })

          if (t1 === null && registrosEst.length > 0 && registrosEst[0]?.promedio_parcial != null) {
            t1 = Number(registrosEst[0].promedio_parcial)
          }
          if (t2 === null && registrosEst.length > 1 && registrosEst[1]?.promedio_parcial != null) {
            t2 = Number(registrosEst[1].promedio_parcial)
          }
          if (t3 === null && registrosEst.length > 2 && registrosEst[2]?.promedio_parcial != null) {
            t3 = Number(registrosEst[2].promedio_parcial)
          }

          mapaNotas[est.id] = { t1, t2, t3 }
        })

        setConsolidadoMap(mapaNotas)
      }
    } catch (err) {
      console.error('Error al cargar notas para el consolidado:', err)
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

  // FUNCIÓN DE DESCARGA DIRECTA EN PDF PARA EL CONSOLIDADO ANUAL
  const generarPdfConsolidado = async () => {
    if (estudiantes.length === 0) {
      alert('⚠ No hay estudiantes registrados para generar el consolidado.')
      return
    }

    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('p', 'mm', 'a4') // Vertical
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (institucionLogo) {
        logoBase64 = await convertirLogoABase64(institucionLogo)
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
      doc.text('CONSOLIDADO ANUAL', pageWidth - 23, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`CONSOLIDADO GENERAL DE RENDIMIENTO ACADÉMICO`, pageWidth / 2, 41, { align: 'center' })

      // Datos informativos
      autoTable(doc, {
        startY: 45,
        theme: 'grid',
        headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        body: [
          [`Asignatura: ${asignaturaSeleccionada}`, `Grado / Curso: ${gradoSeleccionado}`],
          [`Paralelo: ${paraleloSeleccionado} (${jornadaSeleccionada})`, `Docente: ${nombreDocente || 'N/D'}`],
          [`Autoridad: ${autoridadActual.nombre} (${autoridadActual.cargo})`, `Total Estudiantes: ${estudiantes.length}`]
        ]
      })

      const headersTabla = [
        '#',
        'Cédula',
        'Apellidos y Nombres',
        '1er Trim',
        '2do Trim',
        '3er Trim',
        'Prom. Final',
        'Calif.',
        'Observación'
      ]

      const filasTabla = filasProcesadas.map(({ est, notas, valoresValidos, promedioFinal, cualitativa, esAprobado }, index) => [
        index + 1,
        est.cedula || 'S/N',
        `${est.apellidos} ${est.nombres}`,
        notas.t1 !== null ? notas.t1.toFixed(2) : '-',
        notas.t2 !== null ? notas.t2.toFixed(2) : '-',
        notas.t3 !== null ? notas.t3.toFixed(2) : '-',
        valoresValidos.length > 0 ? promedioFinal.toFixed(2) : '-',
        valoresValidos.length > 0 ? cualitativa : '-',
        valoresValidos.length === 0 ? 'SIN NOTAS' : (esAprobado ? 'APROBADO' : 'SUPLETORIO')
      ])

      const tablaY = (doc as any).lastAutoTable.finalY + 4

      autoTable(doc, {
        startY: tablaY,
        theme: 'grid',
        head: [headersTabla],
        body: filasTabla,
        headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 65 }
        }
      })

      // Firmas de responsabilidad al pie
      const finalY = (doc as any).lastAutoTable.finalY + 18
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.line(25, finalY, 85, finalY)
      doc.line(pageWidth - 85, finalY, pageWidth - 25, finalY)
      
      doc.text((nombreDocente || 'DOCENTE RESPONSABLE').toUpperCase(), 55, finalY + 4, { align: 'center' })
      doc.text(autoridadActual.nombre, pageWidth - 55, finalY + 4, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.text('DOCENTE DE LA ASIGNATURA', 55, finalY + 8, { align: 'center' })
      doc.text(autoridadActual.cargo, pageWidth - 55, finalY + 8, { align: 'center' })

      const nombreArchivo = `Consolidado-${gradoSeleccionado}-${asignaturaSeleccionada}`.replace(/\s+/g, '-').toUpperCase() + '.pdf'
      doc.save(nombreArchivo)
    } catch (e: any) {
      console.error(e)
      alert('Error al generar el PDF del consolidado: ' + e.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Consolidado Anual...</p>
        </div>
      </div>
    )
  }

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  const jornadasDisponibles = Array.from(new Set(asignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada).map(a => a.grado_curso)))
  const paralelosPermitidos = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === gradoSeleccionado).map(a => a.paralelo)))
  const asignaturasPermitidas = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaSeleccionada && a.grado_curso === gradoSeleccionado && a.paralelo === paraleloSeleccionado).map(a => a.asignatura)))

  const handleJornadaChange = (nuevaJornada: string) => {
    setJornadaSeleccionada(nuevaJornada)
    const asigJornada = asignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada)
    if (asigJornada.length > 0) {
      const g = asigJornada[0].grado_curso
      setGradoSeleccionado(g)
      const p = asigJornada.find(a => a.grado_curso === g)?.paralelo || 'A'
      setParaleloSeleccionado(p)
      const mat = asigJornada.find(a => a.grado_curso === g && a.paralelo === p)?.asignatura || ''
      setAsignaturaSeleccionada(mat)
    }
  }

  let totalAprobados = 0
  let totalSupletorios = 0

  const filasProcesadas = estudiantes.map((est) => {
    const notas = consolidadoMap[est.id] || { t1: null, t2: null, t3: null }
    const valoresValidos = [notas.t1, notas.t2, notas.t3].filter((n): n is number => n !== null && !isNaN(n))
    let promedioFinal = 0
    if (valoresValidos.length > 0) {
      const suma = valoresValidos.reduce((acc, curr) => acc + curr, 0)
      promedioFinal = Number((suma / valoresValidos.length).toFixed(2))
    }

    const cualitativa = promedioFinal >= 9 ? 'DAR' : promedioFinal >= 7 ? 'AAR' : promedioFinal >= 5 ? 'PA' : 'NAAR'
    const esAprobado = promedioFinal >= 7

    if (valoresValidos.length > 0) {
      if (esAprobado) totalAprobados++
      else totalSupletorios++
    }

    return { est, notas, valoresValidos, promedioFinal, cualitativa, esAprobado }
  })

  const autoridadActual = autoridadesDisponibles[autoridadSeleccionadaIndex] || { nombre: 'RAUL PINOS', cargo: 'VICERRECTOR' }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99]/20 selection:text-[#4b4c99] font-sans">

      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
          >
            {anioLectivoVigente ? `Año Lectivo Vigente: ${anioLectivoVigente}` : 'Sin periodo activo'}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            Consolidado Anual de Calificaciones
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Evaluación Trimestral Integrada
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <label className="text-[10px] font-bold text-slate-700 uppercase">Firma:</label>
            <select
              value={autoridadSeleccionadaIndex}
              onChange={(e) => setAutoridadSeleccionadaIndex(Number(e.target.value))}
              className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
            >
              {autoridadesDisponibles.length === 0 ? (
                <option value={0}>RAUL PINOS (VICERRECTOR)</option>
              ) : (
                autoridadesDisponibles.map((aut, idx) => (
                  <option key={idx} value={idx}>{aut.nombre} ({aut.cargo})</option>
                ))
              )}
            </select>
          </div>

          {/* BOTÓN DESCARGAR CONSOLIDADO PDF */}
          <button
            onClick={generarPdfConsolidado}
            disabled={generandoPdf || estudiantes.length === 0 || !anioLectivoVigente}
            style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
            className="px-5 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <span>📥</span> {generandoPdf ? 'Generando PDF...' : 'Descargar Consolidado PDF'}
          </button>
          
          <button
            onClick={() => router.push('/docente/calificaciones')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer"
          >
            Volver a Calificaciones
          </button>
        </div>
      </div>

      {/* AVISOS */}
      {!anioLectivoVigente && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {esAnioCerrado && anioLectivoVigente && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. El consolidado está en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Periodo Cerrado</span>
        </div>
      )}

      {/* FILTROS DINÁMICOS */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaSeleccionada}
            onChange={(e) => handleJornadaChange(e.target.value)}
            disabled={jornadasDisponibles.length <= 1}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
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
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {gradosUnicos.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
          <select
            value={paraleloSeleccionado}
            onChange={(e) => setParaleloSeleccionado(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {paralelosPermitidos.map(p => (
              <option key={p} value={p}>Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura</label>
          <select
            value={asignaturaSeleccionada}
            onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {asignaturasPermitidas.map(mat => (
              <option key={mat} value={mat}>{mat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA DE CONSOLIDADO ANUAL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-[#4b4c99] text-white flex justify-between items-center">
          <h2 className="text-xs font-bold uppercase tracking-wider">
            CONSOLIDADO ANUAL • {asignaturaSeleccionada || 'Materia'} ({gradoSeleccionado} "{paraleloSeleccionado}" - {jornadaSeleccionada})
          </h2>
          <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-xl">
            {estudiantes.length} Estudiantes Matriculados
          </span>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 border border-slate-200 text-center w-12" rowSpan={2}>Nro</th>
                <th className="p-3 border border-slate-200 w-32" rowSpan={2}>Cédula</th>
                <th className="p-3 border border-slate-200" rowSpan={2}>Apellidos y Nombres</th>
                <th className="p-3 border border-slate-200 text-center w-24 text-white" style={{ backgroundColor: '#4b4c99' }}>1ER</th>
                <th className="p-3 border border-slate-200 text-center w-24 text-white" style={{ backgroundColor: '#389186' }}>2DO</th>
                <th className="p-3 border border-slate-200 text-center w-24 text-white" style={{ backgroundColor: '#d99b1e' }}>3ER</th>
                <th className="p-3 border border-slate-200 text-center w-28 bg-slate-900 text-white" rowSpan={2}>PROMEDIO FINAL</th>
                <th className="p-3 border border-slate-200 text-center w-24" rowSpan={2}>CALF. CUALIT.</th>
                <th className="p-3 border border-slate-200 text-center w-36" rowSpan={2}>OBSERVACIÓN</th>
              </tr>
              <tr className="bg-slate-100 text-[9px] text-center font-semibold text-slate-700">
                <th className="border border-slate-200 p-1">Trimestre</th>
                <th className="border border-slate-200 p-1">Trimestre</th>
                <th className="border border-slate-200 p-1">Trimestre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {!anioLectivoVigente ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-amber-800 font-bold bg-amber-50">
                    No hay un año lectivo activo configurado en la institución.
                  </td>
                </tr>
              ) : filasProcesadas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 font-medium">
                    No hay estudiantes registrados en esta jornada, curso y paralelo para el periodo {anioLectivoVigente}.
                  </td>
                </tr>
              ) : (
                filasProcesadas.map(({ est, notas, valoresValidos, promedioFinal, cualitativa, esAprobado }, idx) => (
                  <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 border border-slate-200 text-slate-600 font-mono">{est.cedula || 'S/N'}</td>
                    <td className="p-3 border border-slate-200 font-bold text-slate-800 uppercase">
                      {est.apellidos} {est.nombres}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-indigo-50/20">
                      {notas.t1 !== null ? notas.t1.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-teal-50/20">
                      {notas.t2 !== null ? notas.t2.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-semibold text-slate-800 bg-amber-50/20">
                      {notas.t3 !== null ? notas.t3.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-black text-slate-900 bg-slate-50">
                      {valoresValidos.length > 0 ? promedioFinal.toFixed(2) : ''}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-bold text-slate-700">
                      {valoresValidos.length > 0 ? cualitativa : ''}
                    </td>
                    <td className={`p-3 border border-slate-200 text-center font-bold text-[10px] uppercase ${
                      valoresValidos.length === 0 ? 'bg-slate-50 text-slate-400' :
                      esAprobado ? 'bg-indigo-50 text-[#4b4c99]' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {valoresValidos.length === 0 ? '' : esAprobado ? 'APROBADO' : 'SUPLETORIO'}
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