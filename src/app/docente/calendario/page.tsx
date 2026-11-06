'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

interface Estudiante {
  id: string
  apellidos: string
  nombres: string
  cedula?: string
}

interface AsignacionDocente {
  grado_curso: string
  paralelo: string
  jornada?: string
  anio_lectivo?: string
}

interface DiaSeleccionable {
  fecha: Date
  fechaISO: string
  fechaStr: string
  diaSemana: string
  esFinDeSemana: boolean
  seleccionado: boolean
}

interface TurnoBrigada {
  fechaStr: string
  diaSemana: string
  estudiante1: string
  estudiante2: string
}

export default function CalendarioControlSalida() {
  const [cargando, setCargando] = useState(true)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [institucionId, setInstitucionId] = useState<string>('')
  const [anioLectivo, setAnioLectivo] = useState<string>('2026-2027')
  const [nombreInstitucion, setNombreInstitucion] = useState<string>('UNIDAD EDUCATIVA "16 DE ABRIL"')
  const [nombreDocente, setNombreDocente] = useState<string>('')

  // Asignaciones del docente
  const [asignaciones, setAsignaciones] = useState<AsignacionDocente[]>([])
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')
  const [jornada, setJornada] = useState('MATUTINA')

  // Tipo de Brigada (Entrada o Salida)
  const [tipoBrigada, setTipoBrigada] = useState<'ENTRADA' | 'SALIDA'>('SALIDA')
  const [horaBrigada, setHoraBrigada] = useState('13:00')

  // Fechas obligatorias
  const hoy = new Date()
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes)
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes)

  // Datos procesados
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [diasRango, setDiasRango] = useState<DiaSeleccionable[]>([])
  const [cronograma, setCronograma] = useState<TurnoBrigada[]>([])

  const diasSemanaNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  const handleCambiarTipoBrigada = (tipo: 'ENTRADA' | 'SALIDA') => {
    setTipoBrigada(tipo)
    if (tipo === 'ENTRADA') {
      setHoraBrigada('07:00')
    } else {
      setHoraBrigada('13:00')
    }
  }

  // 1. Cargar contexto del docente, institución y asignaciones
  useEffect(() => {
    cargarContextoDocente()
  }, [])

  const cargarContextoDocente = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: docData, error: docError } = await supabase
        .from('docentes')
        .select('id, nombres, apellidos, institucion_id, instituciones(nombre_institucion, anio_lectivo_activo)')
        .eq('id', user.id)
        .maybeSingle()

      if (docError || !docData) throw docError || new Error('No se encontró el perfil docente')

      const instId = docData.institucion_id
      const instData: any = docData.instituciones
      const anioVigente = instData?.anio_lectivo_activo || '2026-2027'

      setInstitucionId(instId)
      setNombreInstitucion(instData?.nombre_institucion || 'UNIDAD EDUCATIVA "16 DE ABRIL"')
      setNombreDocente(`${docData.nombres || ''} ${docData.apellidos || ''}`.trim())
      setAnioLectivo(anioVigente)

      const { data: asigData } = await supabase
        .from('docente_asignaciones')
        .select('grado_curso, paralelo, jornada, anio_lectivo')
        .eq('docente_id', user.id)
        .eq('anio_lectivo', anioVigente)

      if (asigData && asigData.length > 0) {
        setAsignaciones(asigData)
        setGrado(asigData[0].grado_curso)
        setParalelo(asigData[0].paralelo || 'A')
        setJornada((asigData[0].jornada || 'MATUTINA').toUpperCase())
      }
    } catch (err) {
      console.error('Error al inicializar contexto docente:', err)
    } finally {
      setCargando(false)
    }
  }

  const cursosDisponibles = useMemo(() => {
    return Array.from(new Set(asignaciones.map(a => a.grado_curso).filter(Boolean)))
  }, [asignaciones])

  const paralelosDisponibles = useMemo(() => {
    return Array.from(new Set(
      asignaciones
        .filter(a => a.grado_curso === grado)
        .map(a => a.paralelo)
        .filter(Boolean)
    ))
  }, [asignaciones, grado])

  const jornadasDisponibles = useMemo(() => {
    const jList = Array.from(new Set(
      asignaciones
        .filter(a => a.grado_curso === grado && (!paralelo || a.paralelo === paralelo))
        .map(a => (a.jornada || 'MATUTINA').toUpperCase())
        .filter(Boolean)
    ))
    return jList.length > 0 ? jList : ['MATUTINA', 'VESPERTINA', 'NOCTURNA']
  }, [asignaciones, grado, paralelo])

  // 2. Consulta de estudiantes de la institución filtrada por asignaciones
  useEffect(() => {
    if (institucionId && grado && paralelo) {
      cargarEstudiantesAsignados()
    } else {
      setEstudiantes([])
    }
  }, [institucionId, grado, paralelo, jornada, anioLectivo])

  const cargarEstudiantesAsignados = async () => {
    try {
      setCargando(true)

      const { data, error } = await supabase
        .from('estudiantes')
        .select('id, apellidos, nombres, cedula')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', grado)
        .eq('paralelo', paralelo)
        .eq('estado', 'activo')
        .eq('anio_lectivo', anioLectivo)
        .ilike('jornada', jornada)
        .order('apellidos', { ascending: true })

      if (error) throw error

      setEstudiantes(data || [])
    } catch (err) {
      console.error('Error consultando estudiantes asignados:', err)
      setEstudiantes([])
    } finally {
      setCargando(false)
    }
  }

  // 3. Generación y control de días del rango
  useEffect(() => {
    if (!fechaInicio || !fechaFin) return

    const dInicio = new Date(fechaInicio + 'T00:00:00')
    const dFin = new Date(fechaFin + 'T00:00:00')

    if (dInicio > dFin) return

    const listaDias: DiaSeleccionable[] = []
    const actual = new Date(dInicio)

    while (actual <= dFin) {
      const diaSem = actual.getDay()
      const esFinde = diaSem === 0 || diaSem === 6
      const diaNum = String(actual.getDate()).padStart(2, '0')
      const mesNum = String(actual.getMonth() + 1).padStart(2, '0')
      const anioNum = actual.getFullYear()

      listaDias.push({
        fecha: new Date(actual),
        fechaISO: actual.toISOString().split('T')[0],
        fechaStr: `${diaNum}/${mesNum}/${anioNum}`,
        diaSemana: diasSemanaNombres[diaSem],
        esFinDeSemana: esFinde,
        seleccionado: !esFinde
      })

      actual.setDate(actual.getDate() + 1)
    }

    setDiasRango(listaDias)
  }, [fechaInicio, fechaFin])

  // 4. Emparejamiento simétrico: Inicio con Fin (1º con el Último)
  useEffect(() => {
    const diasActivos = diasRango.filter(d => d.seleccionado)
    if (estudiantes.length === 0 || diasActivos.length === 0) {
      setCronograma([])
      return
    }

    const pares: { est1: string; est2: string }[] = []
    let izq = 0
    let der = estudiantes.length - 1

    while (izq < der) {
      pares.push({
        est1: `${estudiantes[izq].apellidos} ${estudiantes[izq].nombres}`,
        est2: `${estudiantes[der].apellidos} ${estudiantes[der].nombres}`
      })
      izq++
      der--
    }

    if (izq === der) {
      pares.push({
        est1: `${estudiantes[izq].apellidos} ${estudiantes[izq].nombres}`,
        est2: 'Acompañamiento Docente / Inspectoría'
      })
    }

    const turnos: TurnoBrigada[] = []
    diasActivos.forEach((dia, index) => {
      const par = pares[index % pares.length]
      turnos.push({
        fechaStr: dia.fechaStr,
        diaSemana: dia.diaSemana,
        estudiante1: par.est1,
        estudiante2: par.est2
      })
    })

    setCronograma(turnos)
  }, [estudiantes, diasRango])

  const toggleDia = (fechaISO: string) => {
    setDiasRango(prev =>
      prev.map(d => d.fechaISO === fechaISO ? { ...d, seleccionado: !d.seleccionado } : d)
    )
  }

  // ==================== EXPORTACIÓN A PDF HORIZONTAL (LANDSCAPE) ====================
  const exportarPDF = async () => {
    if (cronograma.length === 0) return
    setGenerandoPdf(true)

    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      // Orientación HORIZONTAL ('l') en tamaño A4 (297mm x 210mm)
      const doc = new jsPDF('l', 'mm', 'a4')

      // ENCABEZADO INSTITUCIONAL HORIZONTAL
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text('REPÚBLICA', 14, 13)
      doc.text('DEL ECUADOR', 14, 16.5)
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      doc.text(`AÑO LECTIVO ${anioLectivo}`, 14, 21)
      doc.text('ue16deabril2013@yahoo.com', 14, 24.5)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(75, 76, 153)
      doc.text('UNIDAD EDUCATIVA', 148.5, 13, { align: 'center' })
      doc.setTextColor(234, 88, 12)
      doc.text('“16 DE ABRIL”', 148.5, 18, { align: 'center' })
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(71, 85, 105)
      doc.text('3 de noviembre entre Guayas y 4 de noviembre Telf.: 072240288', 148.5, 22.5, { align: 'center' })

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.text('Ministerio de Educación,', 283, 14, { align: 'right' })
      doc.text('Deporte y Cultura', 283, 17.5, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Email: ue16deabril2013@yahoo.com', 283, 22.5, { align: 'right' })

      // Línea divisoria roja y azul en todo el ancho horizontal (14mm a 283mm)
      doc.setDrawColor(220, 38, 38)
      doc.setLineWidth(0.6)
      doc.line(14, 27, 283, 27)
      doc.setDrawColor(75, 76, 153)
      doc.setLineWidth(0.3)
      doc.line(14, 27.8, 283, 27.8)

      // TÍTULO PRINCIPAL
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(30, 58, 138)
      doc.text(
        `REGISTRO DE ASISTENCIA – BRIGADAS DE SEGURIDAD DE PADRES DE FAMILIA (${tipoBrigada})`,
        148.5,
        34,
        { align: 'center' }
      )

      // SUB-ENCABEZADO DE CAMPOS
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)

      const mesNombre = new Date(fechaInicio + 'T00:00:00')
        .toLocaleString('es-EC', { month: 'long' })
        .toUpperCase()

      const tutorTxt = `TUTOR: ${nombreDocente || '________________________________________'}`
      const mesTxt = `MES: ${mesNombre}`
      const cursoTxt = `CURSO: ${grado} "${paralelo}"`
      const jornadaTxt = `JORNADA: ${jornada}`

      doc.text(tutorTxt, 14, 41)
      doc.text(mesTxt, 115, 41)
      doc.text(cursoTxt, 175, 41)
      doc.text(jornadaTxt, 230, 41)

      doc.setLineWidth(0.2)
      doc.setDrawColor(0, 0, 0)
      doc.line(26, 42, 110, 42)
      doc.line(123, 42, 168, 42)
      doc.line(188, 42, 222, 42)
      doc.line(246, 42, 283, 42)

      // TABLA OFICIAL ADAPTADA A FORMATO HORIZONTAL
      const filasTabla: any[] = []
      cronograma.forEach((item) => {
        filasTabla.push([
          item.estudiante1,
          '',
          item.fechaStr,
          horaBrigada,
          ''
        ])
        filasTabla.push([
          item.estudiante2,
          '',
          item.fechaStr,
          horaBrigada,
          ''
        ])
      })

      autoTable(doc, {
        startY: 45,
        theme: 'grid',
        head: [
          [
            'NÓMINA DEL ESTUDIANTE',
            'NOMBRE DEL PPFF / REPRESENTANTE LEGAL',
            'FECHA',
            'HORA',
            'FIRMA'
          ]
        ],
        body: filasTabla,
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          lineColor: [0, 0, 0],
          lineWidth: 0.25
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.2,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          minCellHeight: 6.5,
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 75, fontStyle: 'bold' },
          1: { cellWidth: 80 },
          2: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 26, halign: 'center' },
          4: { cellWidth: 56, halign: 'center' }
        }
      })

      // PIE DE PÁGINA
      const posFinY = (doc as any).lastAutoTable.finalY + 7
      let yPie = posFinY
      if (yPie > 175) {
        doc.addPage()
        yPie = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(0, 0, 0)
      doc.text(`Firma Tutor Responsable: __________________________________________________`, 14, yPie)

      const yDistrito = yPie + 8
      doc.setFontSize(6.5)
      doc.setTextColor(71, 85, 105)
      doc.text('DISTRITO 03D01 AZOGUES – BIBLIÁN – DÉLEG - EDUCACIÓN', 14, yDistrito)
      doc.setFont('helvetica', 'normal')
      doc.text('Dirección: Calle Fray Vicente Solano 5-06 y Luis Cordero.', 14, yDistrito + 3.5)
      doc.text('Código postal: 030101 / Azogues-Ecuador', 14, yDistrito + 7)
      doc.text('Teléfono: 593-7-2243434 / www.educacion.gob.ec', 14, yDistrito + 10.5)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(30, 58, 138)
      doc.text('EL NUEVO ', 283, yDistrito + 4, { align: 'right' })
      doc.setTextColor(217, 119, 6)
      doc.text('ECUADOR', 283, yDistrito + 8.5, { align: 'right' })

      doc.save(`Registro_Brigadas_${tipoBrigada}_${grado.replace(/\s+/g, '_')}_${paralelo}_Horizontal.pdf`)
    } catch (err) {
      console.error('Error al generar PDF horizontal:', err)
      alert('Hubo un error al generar el PDF del cronograma.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  // ==================== EXPORTACIÓN A WORD HORIZONTAL (LANDSCAPE) ====================
  const exportarWord = () => {
    if (cronograma.length === 0) return

    const mesNombre = new Date(fechaInicio + 'T00:00:00')
      .toLocaleString('es-EC', { month: 'long' })
      .toUpperCase()

    let filasHtml = ''
    cronograma.forEach((item) => {
      filasHtml += `
        <tr>
          <td style="padding: 4.5pt; border: 1pt solid #000; font-weight: bold; font-size: 8.5pt;">${item.estudiante1}</td>
          <td style="padding: 4.5pt; border: 1pt solid #000; font-size: 8.5pt;"></td>
          <td style="padding: 4.5pt; border: 1pt solid #000; text-align: center; font-weight: bold; font-size: 8.5pt;">${item.fechaStr}</td>
          <td style="padding: 4.5pt; border: 1pt solid #000; text-align: center; font-size: 8.5pt;">${horaBrigada}</td>
          <td style="padding: 4.5pt; border: 1pt solid #000; font-size: 8.5pt;"></td>
        </tr>
        <tr>
          <td style="padding: 4.5pt; border: 1pt solid #000; font-weight: bold; font-size: 8.5pt;">${item.estudiante2}</td>
          <td style="padding: 4.5pt; border: 1pt solid #000; font-size: 8.5pt;"></td>
          <td style="padding: 4.5pt; border: 1pt solid #000; text-align: center; font-weight: bold; font-size: 8.5pt;">${item.fechaStr}</td>
          <td style="padding: 4.5pt; border: 1pt solid #000; text-align: center; font-size: 8.5pt;">${horaBrigada}</td>
          <td style="padding: 4.5pt; border: 1pt solid #000; font-size: 8.5pt;"></td>
        </tr>
      `
    })

    const wordTemplate = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Registro Brigadas</title>
        <style>
          @page Section1 {
            size: 841.9pt 595.3pt; /* A4 Horizontal / Landscape */
            mso-page-orientation: landscape;
            margin: 28pt 36pt 28pt 36pt;
            mso-header-margin: 18pt;
            mso-footer-margin: 18pt;
          }
          div.Section1 { page: Section1; }
          body { font-family: "Calibri", "Arial", sans-serif; font-size: 8.5pt; color: #000; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="Section1">
          
          <!-- MEMBRETE SUPERIOR HORIZONTAL -->
          <table style="width: 100%; border: none; margin-bottom: 4pt;">
            <tr>
              <td style="width: 25%; vertical-align: top; border: none;">
                <strong style="font-size: 8.5pt;">REPÚBLICA DEL ECUADOR</strong><br/>
                <span style="font-size: 7pt; color: #555;">AÑO LECTIVO ${anioLectivo}</span><br/>
                <span style="font-size: 7pt; color: #555;">ue16deabril2013@yahoo.com</span>
              </td>
              <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                <strong style="font-size: 13.5pt; color: #1e3a8a;">UNIDAD EDUCATIVA</strong><br/>
                <strong style="font-size: 13.5pt; color: #ea580c;">“16 DE ABRIL”</strong><br/>
                <span style="font-size: 7.5pt; color: #555;">3 de noviembre entre Guayas y 4 de noviembre Telf.: 072240288</span>
              </td>
              <td style="width: 25%; text-align: right; vertical-align: top; border: none;">
                <em style="font-size: 8.5pt; color: #555;">Ministerio de Educación, Deporte y Cultura</em><br/>
                <span style="font-size: 7pt; color: #555;">Email: ue16deabril2013@yahoo.com</span>
              </td>
            </tr>
          </table>

          <!-- LÍNEAS SEPARADORAS ROJA Y AZUL -->
          <div style="border-top: 1.5pt solid #dc2626; margin-bottom: 1.5pt;"></div>
          <div style="border-top: 1pt solid #1e3a8a; margin-bottom: 8pt;"></div>

          <!-- TÍTULO -->
          <div style="text-align: center; font-size: 11pt; font-weight: bold; color: #1e3a8a; margin-bottom: 8pt; text-transform: uppercase;">
            REGISTRO DE ASISTENCIA – BRIGADAS DE SEGURIDAD DE PADRES DE FAMILIA (${tipoBrigada})
          </div>

          <!-- CAMPOS INFORMATIVOS -->
          <table style="width: 100%; border: none; margin-bottom: 8pt; font-size: 8.5pt; font-weight: bold;">
            <tr>
              <td style="border: none; width: 40%;">TUTOR: <span style="font-weight: normal; text-decoration: underline;">${nombreDocente || '________________________________________'}</span></td>
              <td style="border: none; width: 20%;">MES: <span style="font-weight: normal; text-decoration: underline;">${mesNombre}</span></td>
              <td style="border: none; width: 22%;">CURSO: <span style="font-weight: normal; text-decoration: underline;">${grado} "${paralelo}"</span></td>
              <td style="border: none; width: 18%;">JORNADA: <span style="font-weight: normal; text-decoration: underline;">${jornada}</span></td>
            </tr>
          </table>

          <!-- TABLA PRINCIPAL DE ASISTENCIA -->
          <table style="border: 1pt solid #000; margin-bottom: 12pt;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 5pt; border: 1pt solid #000; text-align: center; font-size: 8.5pt; width: 28%;">NÓMINA DEL ESTUDIANTE</th>
                <th style="padding: 5pt; border: 1pt solid #000; text-align: center; font-size: 8.5pt; width: 30%;">NOMBRE DEL PPFF / REPRESENTANTE LEGAL</th>
                <th style="padding: 5pt; border: 1pt solid #000; text-align: center; font-size: 8.5pt; width: 12%;">FECHA</th>
                <th style="padding: 5pt; border: 1pt solid #000; text-align: center; font-size: 8.5pt; width: 10%;">HORA</th>
                <th style="padding: 5pt; border: 1pt solid #000; text-align: center; font-size: 8.5pt; width: 20%;">FIRMA</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>

          <!-- FIRMA DEL TUTOR -->
          <div style="margin-top: 10pt; font-size: 8.5pt; font-weight: bold;">
            Firma Tutor Responsable: __________________________________________________
          </div>

          <!-- PIE DE PÁGINA DEL DISTRITO Y GOBIERNO -->
          <table style="width: 100%; border: none; margin-top: 14pt;">
            <tr>
              <td style="border: none; vertical-align: top; font-size: 7pt; color: #475569;">
                <strong style="color: #1e3a8a;">DISTRITO 03D01 AZOGUES – BIBLIÁN – DÉLEG - EDUCACIÓN</strong><br/>
                Dirección: Calle Fray Vicente Solano 5-06 y Luis Cordero.<br/>
                Código postal: 030101 / Azogues-Ecuador<br/>
                Teléfono: 593-7-2243434 / www.educacion.gob.ec
              </td>
              <td style="border: none; text-align: right; vertical-align: middle;">
                <span style="font-size: 11pt; font-weight: bold; color: #1e3a8a;">EL NUEVO </span>
                <span style="font-size: 11pt; font-weight: bold; color: #ea580c;">ECUADOR</span>
              </td>
            </tr>
          </table>

        </div>
      </body>
      </html>
    `

    const blob = new Blob(['\ufeff', wordTemplate], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Registro_Brigadas_${tipoBrigada}_${grado.replace(/\s+/g, '_')}_${paralelo}_Horizontal.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const diasSeleccionadosConteo = diasRango.filter(d => d.seleccionado).length

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans max-w-6xl mx-auto">
      
      {/* CABECERA CON BOTONES WORD Y PDF HORIZONTAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            {nombreInstitucion} • {anioLectivo}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Control de {tipoBrigada === 'ENTRADA' ? 'Entrada' : 'Salida'} de Estudiantes
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Generador de turnos para brigadas de representantes con formato oficial descargable en orientación horizontal.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* BOTÓN DESCARGAR WORD */}
          <button
            onClick={exportarWord}
            disabled={cronograma.length === 0}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Descargar Word (Horizontal)</span>
          </button>

          {/* BOTÓN DESCARGAR PDF */}
          <button
            onClick={exportarPDF}
            disabled={generandoPdf || cronograma.length === 0}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition hover:opacity-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{generandoPdf ? 'Generando PDF...' : `Descargar PDF (Horizontal)`}</span>
          </button>
        </div>
      </div>

      {/* 1. SELECCIÓN DE TURNO, CURSO, JORNADA Y RANGO */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase text-slate-800 tracking-wide border-b pb-2">
          1. Parámetros de la Asignación y Turno
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Momento / Brigada</label>
            <select 
              value={tipoBrigada} 
              onChange={(e) => handleCambiarTipoBrigada(e.target.value as 'ENTRADA' | 'SALIDA')} 
              className="w-full p-2.5 border border-indigo-300 rounded-xl font-bold text-indigo-900 bg-indigo-50/50 outline-none focus:border-[#4b4c99] cursor-pointer"
            >
              <option value="ENTRADA">Hora de Entrada</option>
              <option value="SALIDA">Hora de Salida</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Curso</label>
            <select 
              value={grado} 
              onChange={(e) => setGrado(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] cursor-pointer"
            >
              {cursosDisponibles.length === 0 ? (
                <option value="">Sin cursos</option>
              ) : (
                cursosDisponibles.map(c => <option key={c} value={c}>{c}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo</label>
            <select 
              value={paralelo} 
              onChange={(e) => setParalelo(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] cursor-pointer"
            >
              {paralelosDisponibles.length === 0 ? (
                <option value="A">A</option>
              ) : (
                paralelosDisponibles.map(p => <option key={p} value={p}>Paralelo {p}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Jornada</label>
            <select 
              value={jornada} 
              onChange={(e) => setJornada(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] cursor-pointer"
            >
              {jornadasDisponibles.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Fecha Inicio *</label>
            <input 
              type="date" 
              required
              value={fechaInicio} 
              onChange={(e) => setFechaInicio(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99]"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Fecha Fin *</label>
            <input 
              type="date" 
              required
              value={fechaFin} 
              onChange={(e) => setFechaFin(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99]"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">
              Hora ({tipoBrigada === 'ENTRADA' ? 'Entrada' : 'Salida'})
            </label>
            <input 
              type="text" 
              value={horaBrigada} 
              onChange={(e) => setHoraBrigada(e.target.value)} 
              placeholder={tipoBrigada === 'ENTRADA' ? '07:00' : '13:00'}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99]"
            />
          </div>
        </div>
      </div>

      {/* 2. DÍAS LABORABLES EN EL RANGO */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2">
          <div>
            <h2 className="text-xs font-bold uppercase text-slate-800 tracking-wide">
              2. Días Habilitados para la Brigada de {tipoBrigada === 'ENTRADA' ? 'Entrada' : 'Salida'} ({diasSeleccionadosConteo} días seleccionados)
            </h2>
            <p className="text-[11px] text-slate-500">
              Desmarca días festivos o no laborables para ajustar los turnos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiasRango(prev => prev.map(d => ({ ...d, seleccionado: !d.esFinDeSemana })))}
              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-[#4b4c99] border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Solo Lun a Vie
            </button>
            <button
              type="button"
              onClick={() => setDiasRango(prev => prev.map(d => ({ ...d, seleccionado: false })))}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
          {diasRango.map((d) => (
            <label
              key={d.fechaISO}
              className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition select-none text-xs ${
                d.seleccionado
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-white'
              } ${d.esFinDeSemana ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold">{d.diaSemana.substring(0, 3)}</span>
                <input
                  type="checkbox"
                  checked={d.seleccionado}
                  onChange={() => toggleDia(d.fechaISO)}
                  className="rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99] cursor-pointer"
                />
              </div>
              <span className="text-[11px] font-mono mt-1">{d.fechaStr.substring(0, 5)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 3. NÓMINA FILTRADA DE ESTUDIANTES */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold uppercase text-slate-700 tracking-wide">
            3. Nómina Institucional ({estudiantes.length} Estudiantes Activos)
          </span>
          <span className="text-[10px] text-slate-500 font-semibold font-mono">
            {estudiantes[0]?.apellidos || '---'} ↔ {estudiantes[estudiantes.length - 1]?.apellidos || '---'}
          </span>
        </div>

        {cargando ? (
          <div className="p-8 text-center text-xs font-bold text-slate-500">
            Filtrando estudiantes en la base de datos...
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="p-8 text-center text-xs font-bold text-slate-400">
            No se encontraron estudiantes activos matriculados para este curso, paralelo y jornada en su institución.
          </div>
        ) : (
          <div className="p-4 max-h-56 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {estudiantes.map((est, idx) => (
                <div key={est.id} className="p-2 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-800 truncate">
                      {est.apellidos} {est.nombres}
                    </span>
                  </div>
                  {est.cedula && (
                    <span className="text-[9px] text-slate-400 font-mono shrink-0">
                      {est.cedula}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. CRONOGRAMA RESULTANTE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: tipoBrigada === 'ENTRADA' ? '#1e3a8a' : '#4b4c99' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider flex justify-between items-center transition-colors"
        >
          <span>Cronograma de {tipoBrigada === 'ENTRADA' ? 'Entrada' : 'Salida'} ({cronograma.length} Días Asignados)</span>
          <span>{fechaInicio} al {fechaFin}</span>
        </div>

        {cronograma.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">
            Seleccione al menos un día hábil y verifique que el curso tenga estudiantes cargados.
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-[#4b4c99]">
                <tr>
                  <th className="p-3 border border-slate-200 text-center w-12">N°</th>
                  <th className="p-3 border border-slate-200 w-36">Fecha</th>
                  <th className="p-3 border border-slate-200">Representante 1 (Inicio Nómina)</th>
                  <th className="p-3 border border-slate-200">Representante 2 (Final Nómina)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cronograma.map((turno, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 border border-slate-200 text-center font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="p-3 border border-slate-200 font-bold text-slate-800">
                      <span className="text-indigo-700 block text-[11px]">{turno.diaSemana}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{turno.fechaStr}</span>
                    </td>
                    <td className="p-3 border border-slate-200 font-semibold text-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Estudiante:</span>
                      {turno.estudiante1}
                    </td>
                    <td className="p-3 border border-slate-200 font-semibold text-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Estudiante:</span>
                      {turno.estudiante2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}