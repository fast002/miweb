'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HistoricoAcademicoPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [autorizado, setAutorizado] = useState(false)
  
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('UNIDAD EDUCATIVA')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('03H00278')
  const [nombreAutoridad, setNombreAutoridad] = useState('')
  const [cargoAutoridad, setCargoAutoridad] = useState('RECTOR(A)')

  // Control Dinámico de Años Lectivos de la Institución
  const [aniosDisponibles, setAniosDisponibles] = useState<string[]>([])
  const [anioSeleccionado, setAnioSeleccionado] = useState('')
  const [anioActivoInstitucion, setAnioActivoInstitucion] = useState('')

  // Tipo de Reporte Directivo ('reporte_final' vs 'consolidado')
  const [tipoReporteDirectivo, setTipoReporteDirectivo] = useState<'reporte_final' | 'consolidado'>('reporte_final')

  // Filtros de búsqueda directiva
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('MATUTINA')
  const [gradoSeleccionado, setGradoSeleccionado] = useState('8vo EGB')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('A')
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState('')
  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState('')

  // Periodo para la libreta individual
  const [tipoTrimestreReporte, setTipoTrimestreReporte] = useState<'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Anual'>('Trimestre 1')

  // Listas de datos
  const [asignaturasDelCurso, setAsignaturasDelCurso] = useState<string[]>([])
  const [estudiantesCurso, setEstudiantesCurso] = useState<any[]>([])
  
  // Calificaciones globales del curso para el año y paralelo activo
  const [todasCalificacionesCurso, setTodasCalificacionesCurso] = useState<any[]>([])
  const [complementariosEstudiante, setComplementariosEstudiante] = useState<any>({})

  const gradosEGB = [
    '2do Grado EGB', '3ro Grado EGB', '4to Grado EGB',
    '5to Grado EGB', '6to Grado EGB', '7mo Grado EGB',
    '8vo EGB', '9no EGB', '10mo EGB',
    '1er Año BGU', '2do Año BGU', '3er Año BGU',
    '1ro BGU', '2do BGU', '3ro BGU'
  ]
  const paralelos = ['A', 'B', 'C', 'D', 'E']
  const jornadas = ['MATUTINA', 'VESPERTINA', 'NOCTURNA']

  // Normalizador de texto para comparar materias sin fallos de tildes o mayúsculas
  const normalizar = (texto: string = '') => {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim()
  }

  const coincidenMaterias = (mat1: string = '', mat2: string = '') => {
    const n1 = normalizar(mat1)
    const n2 = normalizar(mat2)
    return n1 === n2 || n1.includes(n2) || n2.includes(n1)
  }

  useEffect(() => {
    verificarSeguridadYCargarDatos()
  }, [])

  const verificarSeguridadYCargarDatos = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (!doc) {
        router.push('/')
        return
      }

      const rolUser = (doc.rol || '').toLowerCase()
      const esAutoridad = rolUser.includes('rector') || rolUser.includes('vicerrector') || rolUser.includes('director') || rolUser.includes('autoridad') || rolUser.includes('superadmin')

      if (!esAutoridad) {
        router.push('/docente')
        return
      }

      setAutorizado(true)
      if (doc?.institucion_id) {
        const instId = doc.institucion_id
        setInstitucionId(instId)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setInstitucionLogo(doc.instituciones?.logo_url || '')
        setCodigoAmie(doc.instituciones?.codigo_amie || '03H00278')
        setNombreAutoridad(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim().toUpperCase())
        setCargoAutoridad((doc.rol || 'RECTOR(A)').toUpperCase())

        const periodosInst = doc.instituciones?.periodos_disponibles || []
        setAniosDisponibles(periodosInst)

        let anioInicial = ''
        if (doc.instituciones?.anio_lectivo_activo && periodosInst.includes(doc.instituciones.anio_lectivo_activo)) {
          anioInicial = doc.instituciones.anio_lectivo_activo
        } else if (periodosInst.length > 0) {
          anioInicial = periodosInst[0]
        }

        setAnioActivoInstitucion(doc.instituciones?.anio_lectivo_activo || anioInicial)
        setAnioSeleccionado(anioInicial)
      }
    } catch (err) {
      console.error(err)
      router.push('/')
    } finally {
      setCargando(false)
    }
  }

  // Cargar lista dinámica de materias según las asignaciones o la base curricular
  useEffect(() => {
    async function cargarMateriasCurso() {
      if (!institucionId || !gradoSeleccionado || !anioSeleccionado) return

      try {
        const { data: asigsDoc } = await supabase
          .from('docente_asignaciones')
          .select('asignatura')
          .eq('institucion_id', institucionId)
          .eq('grado_curso', gradoSeleccionado)
          .eq('paralelo', paraleloSeleccionado)

        let unicas: string[] = []
        if (asigsDoc && asigsDoc.length > 0) {
          unicas = Array.from(new Set(asigsDoc.map((a: any) => a.asignatura.trim().toUpperCase())))
        }

        if (unicas.length === 0) {
          unicas = [
            'LENGUA Y LITERATURA',
            'MATEMÁTICAS',
            'ESTUDIOS SOCIALES',
            'CIENCIAS NATURALES',
            'INGLÉS',
            'EDUCACIÓN FÍSICA',
            'EDUCACIÓN CULTURAL Y ARTÍSTICA'
          ]
        }

        setAsignaturasDelCurso(unicas)
        if (!asignaturaSeleccionada || !unicas.includes(asignaturaSeleccionada)) {
          setAsignaturaSeleccionada(unicas[0])
        }
      } catch (e) {
        console.error('Error cargando materias:', e)
      }
    }
    cargarMateriasCurso()
  }, [institucionId, gradoSeleccionado, paraleloSeleccionado, anioSeleccionado])

  // Cargar estudiantes del curso seleccionado y sus calificaciones completas
  const cargarRegistrosYEstudiantes = useCallback(async () => {
    if (!institucionId || !anioSeleccionado || !gradoSeleccionado || !paraleloSeleccionado) return

    try {
      // 1. Estudiantes
      const { data: estData } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('anio_lectivo', anioSeleccionado)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      let estFiltradosJornada: any[] = []
      if (estData) {
        estFiltradosJornada = estData.filter(e => {
          const jEst = e.jornada ? e.jornada.trim().toUpperCase() : 'MATUTINA'
          return jEst === jornadaSeleccionada.trim().toUpperCase()
        })

        setEstudiantesCurso(estFiltradosJornada)
        if (estFiltradosJornada.length > 0) {
          if (!estudianteSeleccionadoId || !estFiltradosJornada.some(e => e.id === estudianteSeleccionadoId)) {
            setEstudianteSeleccionadoId(estFiltradosJornada[0].id)
          }
        } else {
          setEstudianteSeleccionadoId('')
        }
      }

      // 2. Traer todas las calificaciones para estos estudiantes sin importar el docente
      const estIds = estFiltradosJornada.map(e => e.id)
      if (estIds.length > 0) {
        const { data: cals } = await supabase
          .from('calificaciones')
          .select('*')
          .eq('institucion_id', institucionId)
          .eq('anio_lectivo', anioSeleccionado)
          .in('estudiante_id', estIds)

        setTodasCalificacionesCurso(cals || [])
      } else {
        setTodasCalificacionesCurso([])
      }
    } catch (err) {
      console.error('Error cargando estudiantes y calificaciones:', err)
    }
  }, [institucionId, anioSeleccionado, gradoSeleccionado, paraleloSeleccionado, jornadaSeleccionada, estudianteSeleccionadoId])

  useEffect(() => {
    if (institucionId && autorizado && anioSeleccionado) {
      cargarRegistrosYEstudiantes()
    }
  }, [institucionId, autorizado, anioSeleccionado, jornadaSeleccionada, gradoSeleccionado, paraleloSeleccionado, cargarRegistrosYEstudiantes])

  // Cargar notas complementarias de acompañamiento integral del estudiante
  const cargarAcompanamientoEstudiante = useCallback(async () => {
    if (!estudianteSeleccionadoId || !anioSeleccionado) return

    try {
      const { data: compData } = await supabase
        .from('acompanamiento_integral')
        .select('*')
        .eq('estudiante_id', estudianteSeleccionadoId)
        .eq('anio_lectivo', anioSeleccionado)

      const compMap: any = {}
      compData?.forEach((item: any) => {
        compMap[item.item] = {
          t1: item.t1, t2: item.t2, t3: item.t3,
          rec_t1: item.rec_t1, rec_t2: item.rec_t2, rec_t3: item.rec_t3, rec_anual: item.rec_anual
        }
      })
      setComplementariosEstudiante(compMap)
    } catch (err) {
      console.error('Error cargando notas individuales:', err)
    }
  }, [estudianteSeleccionadoId, anioSeleccionado])

  useEffect(() => {
    if (estudianteSeleccionadoId && autorizado && anioSeleccionado) {
      cargarAcompanamientoEstudiante()
    }
  }, [estudianteSeleccionadoId, anioSeleccionado, autorizado, cargarAcompanamientoEstudiante])

  // Calificaciones del estudiante actual seleccionado
  const calificacionesEstudianteActual = todasCalificacionesCurso.filter(
    c => c.estudiante_id === estudianteSeleccionadoId
  )

  // Subnivel educativo
  const obtenerNombreSubnivel = (gradoStr: string) => {
    if (!gradoStr) return ''
    if (['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoStr)) {
      return 'Básica Elemental'
    } else if (['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(gradoStr)) {
      return 'Básica Media'
    } else if (['8vo EGB', '9no EGB', '10mo EGB'].includes(gradoStr) || gradoStr.includes('8vo') || gradoStr.includes('9no') || gradoStr.includes('10mo')) {
      return 'Básica Superior'
    } else if (gradoStr.includes('BGU') || gradoStr.includes('BT') || gradoStr.includes('Bachillerato')) {
      return 'Bachillerato'
    }
    return ''
  }

  const subnivelActual = obtenerNombreSubnivel(gradoSeleccionado)
  const esBasicaElemental = subnivelActual === 'Básica Elemental'
  const esSuperiorOBachillerato = subnivelActual === 'Básica Superior' || subnivelActual === 'Bachillerato'

  const obtenerEscalaElemental = (nota: number) => {
    if (!nota || nota <= 0) return ''
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

  const obtenerEscalaCuantitativaCualitativa = (nota: number) => {
    if (!nota || nota <= 0) return 'NAAR'
    if (nota >= 9.00) return 'DAR'
    if (nota >= 7.00) return 'AAR'
    if (nota >= 4.01) return 'PAAR'
    return 'NAAR'
  }

  const obtenerRecomendacionTexto = () => {
    if (tipoTrimestreReporte !== 'Anual') {
      const campoKey = tipoTrimestreReporte === 'Trimestre 1' ? 'rec_t1' : tipoTrimestreReporte === 'Trimestre 2' ? 'rec_t2' : 'rec_t3'
      for (const itemKey of Object.keys(complementariosEstudiante)) {
        const val = complementariosEstudiante[itemKey]?.[campoKey]
        if (val && val.trim() !== '') return val
      }
      return 'No hay recomendaciones registradas.'
    } else {
      for (const itemKey of Object.keys(complementariosEstudiante)) {
        const val = complementariosEstudiante[itemKey]?.rec_anual
        if (val && val.trim() !== '') return val
      }
      return 'Sin recomendación final.'
    }
  }

  // Cálculos para el Consolidado de la materia activa
  let totalAprobados = 0
  let totalSupletorios = 0

  const filasConsolidadoProcesadas = estudiantesCurso.map(est => {
    // Filtrar todos los registros de notas de este alumno en esta asignatura
    const calsEstudianteMateria = todasCalificacionesCurso.filter(
      c => c.estudiante_id === est.id && coincidenMaterias(c.asignatura, asignaturaSeleccionada)
    )

    // Si existen trimestres registrados (T1, T2, T3)
    const t1 = Number(calsEstudianteMateria.find(c => c.trimestre === 'Trimestre 1')?.promedio_parcial) || 0
    const t2 = Number(calsEstudianteMateria.find(c => c.trimestre === 'Trimestre 2')?.promedio_parcial) || 0
    const t3 = Number(calsEstudianteMateria.find(c => c.trimestre === 'Trimestre 3')?.promedio_parcial) || 0
    const regSupletorio = calsEstudianteMateria.find(c => c.trimestre === 'SUPLETORIO')

    let promedio = 0
    const notasTrimestrales = [t1, t2, t3].filter(n => n > 0)

    if (notasTrimestrales.length > 0) {
      promedio = Number((notasTrimestrales.reduce((a, b) => a + b, 0) / notasTrimestrales.length).toFixed(2))
    } else {
      // Si solo hay un registro global
      const regUnico = calsEstudianteMateria[0]
      promedio = Number(regUnico?.promedio_parcial || regUnico?.calificacion_final || 0)
    }

    // Supletorio si aplica
    const supletorioVal = regSupletorio?.examen_supletorio ? Number(regSupletorio.examen_supletorio) : 0
    if (esSuperiorOBachillerato && supletorioVal > 0) {
      promedio = Number(((promedio + supletorioVal) / 2).toFixed(2))
    }

    const cualitativa = obtenerEscalaCuantitativaCualitativa(promedio)
    const esAprobado = promedio >= 7

    if (promedio > 0) {
      if (esAprobado) totalAprobados++
      else totalSupletorios++
    }

    return {
      estudiante: est,
      promedio,
      cualitativa,
      esAprobado
    }
  })

  const estudianteActualObj = estudiantesCurso.find(e => e.id === estudianteSeleccionadoId)

  // Función para convertir Logo a Base64 para el PDF
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

  // ================= GENERACIÓN DIRECTA DE PDF =================
  const handleDescargarPdfDirecto = async () => {
    if (estudiantesCurso.length === 0 || !anioSeleccionado) {
      alert('No hay estudiantes disponibles en este curso para generar el reporte.')
      return
    }

    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      let logoBase64 = null
      if (institucionLogo) {
        logoBase64 = await convertirLogoABase64(institucionLogo)
      }

      if (tipoReporteDirectivo === 'consolidado') {
        // ================= CONSOLIDADO POR MATERIA (A4 HORIZONTAL) =================
        const doc = new jsPDF('l', 'mm', 'a4')
        const pageWidth = doc.internal.pageSize.getWidth()

        // Membrete
        doc.setLineWidth(0.4)
        doc.rect(14, 12, pageWidth - 28, 22)
        doc.line(45, 12, 45, 34)
        doc.line(pageWidth - 45, 12, pageWidth - 45, 34)

        if (logoBase64) {
          doc.addImage(logoBase64 as string, 'PNG', 16, 13, 20, 20)
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(nombreInstitucion.toUpperCase(), pageWidth / 2, 18, { align: 'center' })
        doc.setFontSize(8)
        doc.text(`CÓDIGO AMIE: ${codigoAmie} • Azogues - Ecuador`, pageWidth / 2, 24, { align: 'center' })
        doc.setTextColor(75, 76, 153)
        doc.text(`AÑO LECTIVO: ${anioSeleccionado}`, pageWidth / 2, 30, { align: 'center' })
        doc.setTextColor(0, 0, 0)

        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('CONSOLIDADO ANUAL', pageWidth - 25, 23, { align: 'center' })

        // Datos del curso
        autoTable(doc, {
          startY: 38,
          theme: 'grid',
          headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          body: [
            [`Asignatura: ${asignaturaSeleccionada}`, `Grado / Curso: ${gradoSeleccionado} "${paraleloSeleccionado}"`],
            [`Jornada: ${jornadaSeleccionada}`, `Autoridad: ${nombreAutoridad} (${cargoAutoridad})`],
            [`Total Alumnos: ${filasConsolidadoProcesadas.length}`, `Periodo: ${anioSeleccionado}`]
          ]
        })

        const headers = ['#', 'Cédula', 'Apellidos y Nombres', 'Prom. Anual', 'Escala', 'Observación']
        const filas = filasConsolidadoProcesadas.map(({ estudiante, promedio, cualitativa, esAprobado }, idx) => [
          idx + 1,
          estudiante?.cedula || 'S/N',
          `${estudiante?.apellidos || ''} ${estudiante?.nombres || ''}`.toUpperCase(),
          promedio > 0 ? promedio.toFixed(2) : '0.00',
          promedio > 0 ? cualitativa : '-',
          promedio === 0 ? 'Sin notas' : esAprobado ? 'Aprobado' : 'Supletorio'
        ])

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 4,
          theme: 'grid',
          head: [headers],
          body: filas,
          headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 28 },
            2: { cellWidth: 90 },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 25, halign: 'center' },
            5: { cellWidth: 35, halign: 'center' }
          }
        })

        // Firmas al pie
        const finalY = (doc as any).lastAutoTable.finalY + 22
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.line(30, finalY, 100, finalY)
        doc.line(pageWidth - 100, finalY, pageWidth - 30, finalY)

        doc.text('SECRETARÍA GENERAL', 65, finalY + 4, { align: 'center' })
        doc.text(nombreAutoridad, pageWidth - 65, finalY + 4, { align: 'center' })

        doc.setFont('helvetica', 'normal')
        doc.text('SECRETARIO(A)', 65, finalY + 8, { align: 'center' })
        doc.text(cargoAutoridad, pageWidth - 65, finalY + 8, { align: 'center' })

        doc.save(`Consolidado_${anioSeleccionado}_${gradoSeleccionado}_${asignaturaSeleccionada}`.replace(/\s+/g, '_') + '.pdf')

      } else {
        // ================= LIBRETA POR ESTUDIANTE (A4 VERTICAL) =================
        const doc = new jsPDF('p', 'mm', 'a4')
        const pageWidth = doc.internal.pageSize.getWidth()

        // Membrete
        doc.setLineWidth(0.4)
        doc.rect(14, 12, pageWidth - 28, 22)
        doc.line(45, 12, 45, 34)
        doc.line(pageWidth - 45, 12, pageWidth - 45, 34)

        if (logoBase64) {
          doc.addImage(logoBase64 as string, 'PNG', 16, 13, 20, 20)
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(nombreInstitucion.toUpperCase(), pageWidth / 2, 18, { align: 'center' })
        doc.setFontSize(8)
        doc.text(`CÓDIGO AMIE: ${codigoAmie} • Azogues - Ecuador`, pageWidth / 2, 24, { align: 'center' })
        doc.setTextColor(75, 76, 153)
        doc.text(`AÑO LECTIVO: ${anioSeleccionado}`, pageWidth / 2, 30, { align: 'center' })
        doc.setTextColor(0, 0, 0)

        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('LIBRETA ACADÉMICA', pageWidth - 24, 23, { align: 'center' })

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`RENDIMIENTO ACADÉMICO - ${tipoTrimestreReporte.toUpperCase()} (${subnivelActual.toUpperCase()})`, pageWidth / 2, 40, { align: 'center' })

        autoTable(doc, {
          startY: 44,
          theme: 'grid',
          headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          body: [
            [`Estudiante: ${estudianteActualObj?.apellidos || ''} ${estudianteActualObj?.nombres || ''}`, `Cédula: ${estudianteActualObj?.cedula || 'S/N'}`],
            [`Grado / Curso: ${gradoSeleccionado} "${paraleloSeleccionado}"`, `Jornada: ${jornadaSeleccionada}`],
            [`Autoridad: ${nombreAutoridad}`, `Año Lectivo: ${anioSeleccionado}`]
          ]
        })

        if (tipoTrimestreReporte !== 'Anual') {
          const headers = esBasicaElemental
            ? ['Asignaturas', 'Calificación', 'Escala', 'Equivalencia']
            : ['Asignaturas', 'Ev. Formativa', '70%', 'Ev. Sumativa', '30%', 'Promedio', 'Cualitativo']

          const body = asignaturasDelCurso.map((asig) => {
            const reg = calificacionesEstudianteActual.find(c => 
              coincidenMaterias(c.asignatura, asig) && (c.trimestre || '').toLowerCase() === tipoTrimestreReporte.toLowerCase()
            )

            const prom = reg?.promedio_parcial !== undefined && reg?.promedio_parcial !== null ? Number(reg.promedio_parcial) : 0
            const formativo = reg?.insumo_1 !== undefined && reg?.insumo_1 !== null ? (Number(reg.insumo_1) + Number(reg.insumo_2 || 0)) / 2 : prom
            const formativo70 = Number((formativo * 0.70).toFixed(2))
            const sumativo = Number(reg?.proyecto_interdisciplinar || reg?.evaluacion_estructurada || prom)
            const sumativo30 = Number((sumativo * 0.30).toFixed(2))

            if (esBasicaElemental) {
              return [
                asig,
                prom > 0 ? prom.toFixed(2) : '0.00',
                obtenerEscalaElemental(prom),
                prom >= 7 ? 'Destreza alcanzada' : prom >= 4.01 ? 'En proceso' : 'Iniciada'
              ]
            }

            return [
              asig,
              formativo > 0 ? formativo.toFixed(2) : '0.00',
              formativo70 > 0 ? formativo70.toFixed(2) : '0.00',
              sumativo > 0 ? sumativo.toFixed(2) : '0.00',
              sumativo30 > 0 ? sumativo30.toFixed(2) : '0.00',
              prom > 0 ? prom.toFixed(2) : '0.00',
              obtenerEscalaCuantitativaCualitativa(prom)
            ]
          })

          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 4,
            theme: 'grid',
            head: [headers],
            body: body,
            headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
            bodyStyles: { fontSize: 7.5 }
          })
        } else {
          const headers = esSuperiorOBachillerato
            ? ['Asignaturas', '1er Trim', '2do Trim', '3er Trim', 'Supletorio', 'Prom. Anual', 'Cualitativa']
            : ['Asignaturas', '1er Trim', '2do Trim', '3er Trim', 'Prom. Anual', 'Cualitativa']

          const body = asignaturasDelCurso.map((asig) => {
            const regT1 = calificacionesEstudianteActual.find(c => coincidenMaterias(c.asignatura, asig) && (c.trimestre || '').includes('Trimestre 1'))
            const regT2 = calificacionesEstudianteActual.find(c => coincidenMaterias(c.asignatura, asig) && (c.trimestre || '').includes('Trimestre 2'))
            const regT3 = calificacionesEstudianteActual.find(c => coincidenMaterias(c.asignatura, asig) && (c.trimestre || '').includes('Trimestre 3'))
            const regSupletorio = calificacionesEstudianteActual.find(c => coincidenMaterias(c.asignatura, asig) && (c.trimestre || '').includes('SUPLETORIO'))

            const p1 = Number(regT1?.promedio_parcial || 0)
            const p2 = Number(regT2?.promedio_parcial || 0)
            const p3 = Number(regT3?.promedio_parcial || 0)
            
            let promAnual = Number(((p1 + p2 + p3) / (p1 && p2 && p3 ? 3 : (p1 || p2 || p3 ? 1 : 1))).toFixed(2))
            const supletorioVal = regSupletorio?.examen_supletorio ? Number(regSupletorio.examen_supletorio) : 0

            if (esSuperiorOBachillerato && supletorioVal > 0) {
              promAnual = Number(((promAnual + supletorioVal) / 2).toFixed(2))
            }

            if (esSuperiorOBachillerato) {
              return [
                asig,
                p1 > 0 ? p1.toFixed(2) : '0.00',
                p2 > 0 ? p2.toFixed(2) : '0.00',
                p3 > 0 ? p3.toFixed(2) : '0.00',
                supletorioVal > 0 ? supletorioVal.toFixed(2) : '-',
                promAnual > 0 ? promAnual.toFixed(2) : '0.00',
                obtenerEscalaCuantitativaCualitativa(promAnual)
              ]
            }

            return [
              asig,
              p1 > 0 ? p1.toFixed(2) : '0.00',
              p2 > 0 ? p2.toFixed(2) : '0.00',
              p3 > 0 ? p3.toFixed(2) : '0.00',
              promAnual > 0 ? promAnual.toFixed(2) : '0.00',
              obtenerEscalaCuantitativaCualitativa(promAnual)
            ]
          })

          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 4,
            theme: 'grid',
            head: [headers],
            body: body,
            headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
            bodyStyles: { fontSize: 7.5 }
          })
        }

        // Áreas de desarrollo integral y recomendaciones
        const finalTablaY = (doc as any).lastAutoTable.finalY + 4
        autoTable(doc, {
          startY: finalTablaY,
          theme: 'grid',
          head: [['ÁREAS DE DESARROLLO INTEGRAL', 'RECOMENDACIONES']],
          body: [
            [
              `• Acompañamiento Integral: ${complementariosEstudiante['Acompañamiento integral']?.[tipoTrimestreReporte === 'Trimestre 1' ? 't1' : tipoTrimestreReporte === 'Trimestre 2' ? 't2' : 't3'] || '-'}\n• Animación a la Lectura: ${complementariosEstudiante['Animación a la lectura']?.[tipoTrimestreReporte === 'Trimestre 1' ? 't1' : tipoTrimestreReporte === 'Trimestre 2' ? 't2' : 't3'] || '-'}`,
              obtenerRecomendacionTexto()
            ]
          ],
          headStyles: { fillColor: [218, 234, 138], textColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7.5 }
        })

        // Firmas al pie
        const finalFirmasY = (doc as any).lastAutoTable.finalY + 18
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.line(25, finalFirmasY, 85, finalFirmasY)
        doc.line(pageWidth - 85, finalFirmasY, pageWidth - 25, finalFirmasY)

        doc.text('SECRETARÍA GENERAL', 55, finalFirmasY + 4, { align: 'center' })
        doc.text(nombreAutoridad, pageWidth - 55, finalFirmasY + 4, { align: 'center' })

        doc.setFont('helvetica', 'normal')
        doc.text('SECRETARIO(A)', 55, finalFirmasY + 8, { align: 'center' })
        doc.text(cargoAutoridad, pageWidth - 55, finalFirmasY + 8, { align: 'center' })

        doc.save(`Libreta_${anioSeleccionado}_${estudianteActualObj?.apellidos || 'Estudiante'}`.replace(/\s+/g, '_') + '.pdf')
      }
    } catch (err: any) {
      console.error(err)
      alert('Error al generar el PDF: ' + err.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  if (cargando || !autorizado) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo Rectoral...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans max-w-7xl mx-auto">
      
      {/* ENCABEZADO PRINCIPAL RECTORADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
              className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
            >
              Control Rectoral General
            </span>
            {anioSeleccionado === anioActivoInstitucion ? (
              <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-0.5 rounded-lg border border-emerald-200">
                Periodo Activo Vigente ({anioSeleccionado})
              </span>
            ) : (
              <span className="bg-rose-100 text-rose-800 font-bold text-[10px] px-2.5 py-0.5 rounded-lg border border-rose-200">
                Archivo Histórico ({anioSeleccionado})
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Reportes Académicos y Archivo Histórico
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Emisión y descarga en PDF oficial de cualquier año lectivo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleDescargarPdfDirecto}
            disabled={generandoPdf || estudiantesCurso.length === 0 || !anioSeleccionado}
            style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
            className="px-5 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>📥</span> {generandoPdf ? 'Generando PDF...' : 'Descargar PDF Oficial'}
          </button>
          <button
            onClick={() => router.push('/rector')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer"
          >
            ← Volver al Panel Rectoral
          </button>
        </div>
      </div>

      {/* SELECTOR DE FORMATO */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4 flex-wrap">
        <span className="text-xs font-bold uppercase text-slate-700">Formato del Documento:</span>
        <div className="flex gap-2.5 flex-wrap">
          <button
            onClick={() => setTipoReporteDirectivo('reporte_final')}
            style={tipoReporteDirectivo === 'reporte_final' ? { backgroundColor: '#4b4c99' } : {}}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
              tipoReporteDirectivo === 'reporte_final' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Libreta de Calificaciones Oficial (Por Estudiante)
          </button>
          <button
            onClick={() => setTipoReporteDirectivo('consolidado')}
            style={tipoReporteDirectivo === 'consolidado' ? { backgroundColor: '#4b4c99' } : {}}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
              tipoReporteDirectivo === 'consolidado' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Consolidado General por Materia
          </button>
        </div>
      </div>

      {/* FILTROS DE BÚSQUEDA DIRECTIVA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-5 gap-3.5 text-xs">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año Lectivo (Cualquiera):</label>
          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(e.target.value)}
            style={{ color: '#4b4c99' }}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer shadow-2xs"
          >
            {aniosDisponibles.map(anio => (
              <option key={anio} value={anio} className="text-slate-900 font-bold bg-white">
                {anio} {anio === anioActivoInstitucion ? '• (Vigente Activo)' : '• (Histórico)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada:</label>
          <select
            value={jornadaSeleccionada}
            onChange={(e) => setJornadaSeleccionada(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
          >
            {jornadas.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso:</label>
          <select
            value={gradoSeleccionado}
            onChange={(e) => setGradoSeleccionado(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
          >
            {gradosEGB.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo:</label>
          <select
            value={paraleloSeleccionado}
            onChange={(e) => setParaleloSeleccionado(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
          >
            {paralelos.map(p => <option key={p} value={p}>Paralelo {p}</option>)}
          </select>
        </div>

        {tipoReporteDirectivo === 'consolidado' ? (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura:</label>
            <select
              value={asignaturaSeleccionada}
              onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
            >
              {asignaturasDelCurso.map(mat => <option key={mat} value={mat}>{mat}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Estudiante:</label>
            <select
              value={estudianteSeleccionadoId}
              onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
              className="w-full p-3 border-2 border-indigo-300 rounded-xl text-xs font-bold text-indigo-950 bg-indigo-50/50 outline-none shadow-2xs cursor-pointer"
            >
              {estudiantesCurso.length === 0 ? (
                <option value="">Sin estudiantes en este curso</option>
              ) : (
                estudiantesCurso.map(est => (
                  <option key={est.id} value={est.id} className="text-slate-900 font-bold bg-white">
                    {est.apellidos} {est.nombres}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </div>

      {tipoReporteDirectivo === 'reporte_final' && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <span className="text-xs font-bold uppercase text-slate-700">Periodo de la Libreta:</span>
          <select
            value={tipoTrimestreReporte}
            onChange={(e: any) => setTipoTrimestreReporte(e.target.value)}
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.05)', borderColor: 'rgba(75, 76, 153, 0.3)' }}
            className="p-2.5 border-2 rounded-xl text-xs font-bold outline-none shadow-2xs cursor-pointer"
          >
            <option value="Trimestre 1">1er Trimestre</option>
            <option value="Trimestre 2">2do Trimestre</option>
            <option value="Trimestre 3">3er Trimestre</option>
            <option value="Anual">Reporte Final (Anual)</option>
          </select>
        </div>
      )}

      {/* TABLA DE VISUALIZACIÓN EN PANTALLA */}
      {tipoReporteDirectivo === 'consolidado' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold uppercase text-slate-900 flex-wrap gap-2">
            <span>
              Consolidado General • {anioSeleccionado} • {asignaturaSeleccionada} ({gradoSeleccionado} "{paraleloSeleccionado}" - {jornadaSeleccionada})
            </span>
            <span className="text-[10px] text-slate-500">{estudiantesCurso.length} Alumnos</span>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 border border-slate-200 text-center w-12">Nro</th>
                  <th className="p-3 border border-slate-200 w-32">Cédula</th>
                  <th className="p-3 border border-slate-200">Apellidos y Nombres</th>
                  <th className="p-3 border border-slate-200 text-center w-28">Promedio Anual</th>
                  <th className="p-3 border border-slate-200 text-center w-24">Escala</th>
                  <th className="p-3 border border-slate-200 text-center w-36">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filasConsolidadoProcesadas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
                      No hay estudiantes registrados en este curso para el periodo {anioSeleccionado}.
                    </td>
                  </tr>
                ) : (
                  filasConsolidadoProcesadas.map(({ estudiante, promedio, cualitativa, esAprobado }, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 border border-slate-200 text-slate-600 font-mono">{estudiante?.cedula || 'S/N'}</td>
                      <td className="p-3 border border-slate-200 font-bold text-slate-800 uppercase">
                        {estudiante?.apellidos} {estudiante?.nombres}
                      </td>
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-900 bg-slate-50">
                        {promedio > 0 ? promedio.toFixed(2) : '0.00'}
                      </td>
                      <td className="p-3 border border-slate-200 text-center font-semibold text-slate-700">
                        {promedio > 0 ? cualitativa : '-'}
                      </td>
                      <td className={`p-3 border border-slate-200 text-center font-bold text-[10px] uppercase ${
                        promedio === 0 ? 'bg-slate-50 text-slate-400' :
                        esAprobado ? 'bg-indigo-50 text-indigo-800' : 'bg-amber-50 text-amber-800'
                      }`}>
                        {promedio === 0 ? 'Sin calificación' : esAprobado ? 'Aprobado' : 'Supletorio'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold uppercase text-slate-900 flex-wrap gap-2">
            <span>
              Vista Previa Libreta • {anioSeleccionado} ({tipoTrimestreReporte}) • {estudianteActualObj ? `${estudianteActualObj.apellidos} ${estudianteActualObj.nombres}` : 'Estudiante'}
            </span>
            <button
              onClick={handleDescargarPdfDirecto}
              disabled={generandoPdf}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-4 py-1.5 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {generandoPdf ? 'Generando...' : 'Descargar en PDF'}
            </button>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 border border-slate-200 text-center w-12">Nro</th>
                  <th className="p-3 border border-slate-200">Asignatura</th>
                  <th className="p-3 border border-slate-200 text-center w-28">Promedio</th>
                  <th className="p-3 border border-slate-200 text-center w-24">Escala</th>
                  <th className="p-3 border border-slate-200 text-center w-36">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {asignaturasDelCurso.map((asig, idx) => {
                  const reg = calificacionesEstudianteActual.find(c => {
                    const coincideNombre = coincidenMaterias(c.asignatura, asig)
                    const coincidePeriodo = tipoTrimestreReporte === 'Anual' ? true : (c.trimestre || '').trim().toLowerCase() === tipoTrimestreReporte.trim().toLowerCase()
                    return coincideNombre && coincidePeriodo
                  })

                  const prom = reg?.promedio_parcial !== undefined && reg?.promedio_parcial !== null ? Number(reg.promedio_parcial) : 0
                  const cual = obtenerEscalaCuantitativaCualitativa(prom)
                  const aprobado = prom >= 7

                  return (
                    <tr key={asig} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 border border-slate-200 font-bold text-slate-800 uppercase">{asig}</td>
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-900 bg-slate-50">{prom > 0 ? prom.toFixed(2) : '0.00'}</td>
                      <td className="p-3 border border-slate-200 text-center font-semibold text-slate-700">{prom > 0 ? cual : '-'}</td>
                      <td className={`p-3 border border-slate-200 text-center font-bold text-[10px] uppercase ${prom === 0 ? 'text-slate-400' : aprobado ? 'text-indigo-800 bg-indigo-50' : 'text-amber-800 bg-amber-50'}`}>
                        {prom === 0 ? 'Sin notas' : aprobado ? 'Aprobado' : 'Supletorio'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}