'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type CategoriaInsumo = 'Deberes / Indiv.' | 'Tareas en Clase' | 'Actividades Grupales' | 'Lecciones'

interface ColumnaInsumo {
  id: string
  categoria: CategoriaInsumo
  numero: number
  descripcion: string
}

export default function RegistroCalificacionesPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [docenteId, setDocenteId] = useState('')
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')

  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])
  const [materiasOficiales, setMateriasOficiales] = useState<any[]>([])

  const [subnivel, setSubnivel] = useState<'Básica Elemental' | 'Básica Media' | 'Básica Superior' | 'Bachillerato'>('Básica Media')
  const [jornadaActual, setJornadaActual] = useState('MATUTINA')
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')
  const [asignatura, setAsignatura] = useState('')
  const [trimestre, setTrimestre] = useState('Trimestre 1')

  const [columnasInsumos, setColumnasInsumos] = useState<ColumnaInsumo[]>([])
  const [mostrarModalNuevaColumna, setMostrarModalNuevaColumna] = useState(false)
  const [nuevaCat, setNuevaCat] = useState<CategoriaInsumo>('Deberes / Indiv.')
  const [nuevaDesc, setNuevaDesc] = useState('')

  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [notasMap, setNotasMap] = useState<{ [estudianteId: string]: { [insumoId: string]: number } }>({})
  const [sumativasMap, setSumativasMap] = useState<{ [estudianteId: string]: { refuerzo_pedagogico: number; proyecto_interdisciplinar: number; evaluacion_estructurada: number } }>({})
  const [nombresDocente, setNombresDocente] = useState('')

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }
        setDocenteId(user.id)
        
        const [{ data: doc }, { data: mats }] = await Promise.all([
          supabase.from('docentes').select('*, instituciones(*)').eq('id', user.id).maybeSingle(),
          supabase.from('asignaturas').select('*')
        ])

        setMateriasOficiales(mats || [])
        
        let anioActivo = ''
        let cerradosList: string[] = []

        if (doc) {
          setDocenteId(doc.id)
          setNombresDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim())
          setInstitucionId(doc.institucion_id || '')
          setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
          setCodigoAmie(doc.instituciones?.codigo_amie || '00H00000')
          setLogoUrl(doc.instituciones?.logo_url || '')

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
            setAsignatura(asignacionesData[0].asignatura)
            detectarSubnivel(asignacionesData[0].grado_curso)
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

  const materiasFiltradas = materiasOficiales
    .filter(m => !m.curso_nivel || m.curso_nivel.includes(grado.split(' ')[0]))
    .map(m => m.nombre)

  const detectarSubnivel = (gradoStr: string) => {
    if (['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(gradoStr)) {
      setSubnivel('Básica Elemental')
    } else if (['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(gradoStr)) {
      setSubnivel('Básica Media')
    } else if (['8vo EGB', '9no EGB', '10mo EGB'].includes(gradoStr)) {
      setSubnivel('Básica Superior')
    } else {
      setSubnivel('Bachillerato')
    }
  }

  const handleJornadaChange = (nuevaJornada: string) => {
    setJornadaActual(nuevaJornada)
    const asigJornada = misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada)
    if (asigJornada.length > 0) {
      setGrado(asigJornada[0].grado_curso)
      detectarSubnivel(asigJornada[0].grado_curso)
      setParalelo(asigJornada[0].paralelo)
      setAsignatura(asigJornada[0].asignatura)
    }
  }

  const handleGradoChange = (nuevoGrado: string) => {
    setGrado(nuevoGrado)
    detectarSubnivel(nuevoGrado)
    const paralelosDeGrado = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === nuevoGrado).map(a => a.paralelo)))
    if (paralelosDeGrado.length > 0) {
      setParalelo(paralelosDeGrado[0])
      const asigMatch = misAsignaciones.find(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === nuevoGrado && a.paralelo === paralelosDeGrado[0])
      if (asigMatch) setAsignatura(asigMatch.asignatura)
    }
  }

  useEffect(() => {
    async function cargarDatosCompletos() {
      if (!institucionId || !docenteId || !grado || !paralelo || !asignatura || !anioLectivoVigente) return

      try {
        const { data: estDataRaw } = await supabase
          .from('estudiantes')
          .select('*')
          .eq('institucion_id', institucionId)
          .eq('grado_curso', grado)
          .eq('paralelo', paralelo)
          .eq('estado', 'activo')
          .order('apellidos', { ascending: true })

        const estData = (estDataRaw || []).filter(e => {
          const jEst = e.jornada ? e.jornada.trim().toUpperCase() : 'MATUTINA'
          return jEst === jornadaActual.trim().toUpperCase()
        })

        setEstudiantes(estData)
        const idsEstudiantes = estData.map(e => e.id)

        const { data: insumosData } = await supabase
          .from('configuracion_insumos')
          .select('*')
          .eq('docente_id', docenteId)
          .eq('asignatura', asignatura.trim())
          .eq('trimestre', trimestre)
          .eq('grado_curso', grado)
          .eq('paralelo', paralelo)
          .eq('jornada', jornadaActual)
          .eq('anio_lectivo', anioLectivoVigente)
          .order('created_at', { ascending: true })

        const cols: ColumnaInsumo[] = (insumosData || []).map((item, idx) => ({
          id: item.id,
          categoria: item.categoria as CategoriaInsumo,
          numero: idx + 1,
          descripcion: item.descripcion
        }))
        setColumnasInsumos(cols)

        const insumosIds = cols.map(c => c.id)

        let detallesNotas: any[] = []
        if (insumosIds.length > 0 && idsEstudiantes.length > 0) {
          const { data: detData } = await supabase
            .from('calificaciones_detalle')
            .select('*')
            .in('configuracion_insumo_id', insumosIds)
            .in('estudiante_id', idsEstudiantes)

          detallesNotas = detData || []
        }

        let calResumen: any[] = []
        if (idsEstudiantes.length > 0) {
          const { data: resData } = await supabase
            .from('calificaciones')
            .select('*')
            .in('estudiante_id', idsEstudiantes)
            .eq('docente_id', docenteId)
            .eq('asignatura', asignatura.trim())
            .eq('trimestre', trimestre)
            .eq('anio_lectivo', anioLectivoVigente)

          calResumen = resData || []
        }

        const mapaNotas: { [estId: string]: { [insId: string]: number } } = {}
        const mapaSum: { [estId: string]: any } = {}

        estData.forEach(est => {
          mapaNotas[est.id] = {}
          cols.forEach(c => {
            const registroNota = detallesNotas.find(d => d.estudiante_id === est.id && d.configuracion_insumo_id === c.id)
            mapaNotas[est.id][c.id] = registroNota ? Number(registroNota.nota) : 0
          })

          const regSum = calResumen.find(r => r.estudiante_id === est.id)
          mapaSum[est.id] = {
            refuerzo_pedagogico: regSum ? Number(regSum.refuerzo_pedagogico || 0) : 0,
            proyecto_interdisciplinar: regSum ? Number(regSum.proyecto_interdisciplinar || 0) : 0,
            evaluacion_estructurada: regSum ? Number(regSum.evaluacion_estructurada || 0) : 0
          }
        })

        setNotasMap(mapaNotas)
        setSumativasMap(mapaSum)

      } catch (err) {
        console.error('Error al cargar datos de calificaciones:', err)
      }
    }

    cargarDatosCompletos()
  }, [institucionId, docenteId, grado, paralelo, asignatura, trimestre, jornadaActual, anioLectivoVigente])

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  const handleNotaDetalleChange = (estudianteId: string, insumoId: string, valor: string) => {
    if (esAnioCerrado) return
    const num = Math.min(10, Math.max(0, parseFloat(valor) || 0))
    setNotasMap(prev => ({
      ...prev,
      [estudianteId]: {
        ...(prev[estudianteId] || {}),
        [insumoId]: num
      }
    }))
  }

  const handleNotaSumativaChange = (estudianteId: string, campo: 'refuerzo_pedagogico' | 'proyecto_interdisciplinar' | 'evaluacion_estructurada', valor: string) => {
    if (esAnioCerrado) return
    const num = Math.min(10, Math.max(0, parseFloat(valor) || 0))
    setSumativasMap(prev => ({
      ...prev,
      [estudianteId]: {
        ...(prev[estudianteId] || { refuerzo_pedagogico: 0, proyecto_interdisciplinar: 0, evaluacion_estructurada: 0 }),
        [campo]: num
      }
    }))
  }

  const handleAgregarColumna = async () => {
    if (esAnioCerrado) {
      alert('Este año lectivo está cerrado.')
      return
    }
    if (!nuevaDesc.trim()) return

    const nuevoId = `ins_${Date.now()}`
    const insumosMismaCat = columnasInsumos.filter(c => c.categoria === nuevaCat)
    const nuevoNumero = insumosMismaCat.length + 1

    const nuevaCol: ColumnaInsumo = {
      id: nuevoId,
      categoria: nuevaCat,
      numero: nuevoNumero,
      descripcion: nuevaDesc.trim()
    }

    try {
      const { error } = await supabase.from('configuracion_insumos').insert({
        id: nuevoId,
        docente_id: docenteId,
        institucion_id: institucionId,
        asignatura: asignatura.trim(),
        trimestre,
        grado_curso: grado,
        paralelo,
        jornada: jornadaActual,
        categoria: nuevaCat,
        numero: nuevoNumero,
        descripcion: nuevaDesc.trim(),
        anio_lectivo: anioLectivoVigente
      })

      if (error) throw error

      setColumnasInsumos(prev => [...prev, nuevaCol])
      setNuevaDesc('')
      setMostrarModalNuevaColumna(false)
    } catch (err: any) {
      alert('Error al crear insumo: ' + err.message)
    }
  }

  const handleEliminarColumna = async (insumoId: string) => {
    if (esAnioCerrado) {
      alert('Periodo cerrado.')
      return
    }
    if (!confirm('¿Eliminar este insumo y todas las notas asociadas a él?')) return

    try {
      const { error } = await supabase.from('configuracion_insumos').delete().eq('id', insumoId)
      if (error) throw error

      setColumnasInsumos(prev => prev.filter(c => c.id !== insumoId))
      
      setNotasMap(prev => {
        const copia = { ...prev }
        Object.keys(copia).forEach(estId => {
          if (copia[estId]) delete copia[estId][insumoId]
        })
        return copia
      })
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  const ordenCategorias: CategoriaInsumo[] = ['Deberes / Indiv.', 'Tareas en Clase', 'Actividades Grupales', 'Lecciones']

  const columnasOrdenadas = [...columnasInsumos].sort((a, b) => {
    const idxA = ordenCategorias.indexOf(a.categoria)
    const idxB = ordenCategorias.indexOf(b.categoria)
    if (idxA !== idxB) return idxA - idxB
    return a.numero - b.numero
  })

  const gruposHeader = ordenCategorias.map(cat => {
    const cols = columnasOrdenadas.filter(c => c.categoria === cat)
    return {
      categoria: cat,
      count: cols.length,
      cols
    }
  }).filter(g => g.count > 0)

  // =========================================================================
  // CALCULO DE PROMEDIO: TAREAS NO PRESENTADAS / EN BLANCO SE PROMEDIAN CON 0.00
  // =========================================================================
  const calcularNotaFinal = (estId: string) => {
    const notasIns = notasMap[estId] || {}
    const sum = sumativasMap[estId] || { refuerzo_pedagogico: 0, proyecto_interdisciplinar: 0, evaluacion_estructurada: 0 }

    // 1. Verificar si el alumno tiene al menos una actividad calificada (> 0)
    const tieneAlgunaNotaInsumos = columnasInsumos.some(col => (notasIns[col.id] || 0) > 0)
    const tieneAlgunaNotaSumativa = (sum.refuerzo_pedagogico > 0) || (sum.proyecto_interdisciplinar > 0) || (sum.evaluacion_estructurada > 0)

    // Si todas las celdas del estudiante están vacías en el trimestre, se mantiene en 0.00
    if (!tieneAlgunaNotaInsumos && !tieneAlgunaNotaSumativa) {
      return 0
    }

    // 2. Extraer notas de todos los insumos creados: los casilleros en blanco computan con 0.00
    let valoresInsumos: number[] = columnasInsumos.map(col => Number(notasIns[col.id] || 0))

    // 3. Aplicar Refuerzo Pedagógico (si existe, reemplaza la nota formativa más baja)
    if (sum.refuerzo_pedagogico > 0 && valoresInsumos.length > 0) {
      const minNota = Math.min(...valoresInsumos)
      if (sum.refuerzo_pedagogico > minNota) {
        const minIndex = valoresInsumos.indexOf(minNota)
        valoresInsumos[minIndex] = sum.refuerzo_pedagogico
      }
    }

    // 4. Modalidad Básica Elemental (Promedio simple de todas las actividades e insumos)
    if (subnivel === 'Básica Elemental') {
      const todas = [...valoresInsumos]
      todas.push(Number(sum.proyecto_interdisciplinar || 0))
      todas.push(Number(sum.evaluacion_estructurada || 0))

      if (todas.length === 0) return 0
      const suma = todas.reduce((a, b) => a + b, 0)
      return parseFloat((suma / todas.length).toFixed(2))
    }

    // 5. Modalidad Básica Media, Superior y Bachillerato (70% Formativo + 30% Sumativo)
    const promFormativo = valoresInsumos.length > 0
      ? valoresInsumos.reduce((a, b) => a + b, 0) / valoresInsumos.length
      : 0
    const aporte70 = promFormativo * 0.70

    // Evaluaciones sumativas fijas (Proyecto Interdisciplinar + Evaluación Estructurada)
    const notaProy = Number(sum.proyecto_interdisciplinar || 0)
    const notaEv = Number(sum.evaluacion_estructurada || 0)
    const promSumativo = (notaProy + notaEv) / 2
    const aporte30 = promSumativo * 0.30

    return parseFloat((aporte70 + aporte30).toFixed(2))
  }

  const obtenerEscalaCualitativa = (prom: number) => {
    if (prom >= 9.00) return { label: 'DAR', color: 'bg-emerald-100 text-emerald-800 border border-emerald-200' }
    if (prom >= 7.00) return { label: 'AAR', color: 'bg-blue-100 text-blue-800 border border-blue-200' }
    if (prom >= 4.01) return { label: 'PA', color: 'bg-amber-100 text-amber-800 border border-amber-200' }
    return { label: 'NA', color: 'bg-rose-100 text-rose-800 border border-rose-200' }
  }

  const getHeaderColor = (cat: CategoriaInsumo) => {
    switch (cat) {
      case 'Deberes / Indiv.': return 'bg-[#4b4c99] text-white'
      case 'Tareas en Clase': return 'bg-indigo-700 text-white'
      case 'Actividades Grupales': return 'bg-[#45b3a5] text-slate-950'
      case 'Lecciones': return 'bg-teal-700 text-white'
      default: return 'bg-slate-800 text-white'
    }
  }

  const handleGuardarCalificaciones = async () => {
    if (esAnioCerrado) {
      alert('Periodo cerrado.')
      return
    }
    setGuardando(true)
    setMensaje(null)

    try {
      const payloadDetalles: any[] = []
      estudiantes.forEach(est => {
        columnasInsumos.forEach(col => {
          const notaVal = notasMap[est.id]?.[col.id] || 0
          payloadDetalles.push({
            configuracion_insumo_id: col.id,
            estudiante_id: est.id,
            docente_id: docenteId,
            nota: notaVal,
            updated_at: new Date().toISOString()
          })
        })
      })

      if (payloadDetalles.length > 0) {
        const { error: errDetalles } = await supabase
          .from('calificaciones_detalle')
          .upsert(payloadDetalles, { onConflict: 'configuracion_insumo_id, estudiante_id' })

        if (errDetalles) throw errDetalles
      }

      const payloadResumen = estudiantes.map(est => {
        const promFinal = calcularNotaFinal(est.id)
        const cuali = obtenerEscalaCualitativa(promFinal).label
        const sum = sumativasMap[est.id] || { refuerzo_pedagogico: 0, proyecto_interdisciplinar: 0, evaluacion_estructurada: 0 }

        const ins1 = columnasInsumos[0] ? (notasMap[est.id]?.[columnasInsumos[0].id] || 0) : 0
        const ins2 = columnasInsumos[1] ? (notasMap[est.id]?.[columnasInsumos[1].id] || 0) : 0
        const ins3 = columnasInsumos[2] ? (notasMap[est.id]?.[columnasInsumos[2].id] || 0) : 0
        const ins4 = columnasInsumos[3] ? (notasMap[est.id]?.[columnasInsumos[3].id] || 0) : 0

        return {
          estudiante_id: est.id,
          docente_id: docenteId,
          institucion_id: institucionId,
          asignatura: asignatura.trim(),
          trimestre,
          paralelo,
          insumo_1: ins1,
          insumo_2: ins2,
          insumo_3: ins3,
          insumo_4: ins4,
          refuerzo_pedagogico: sum.refuerzo_pedagogico,
          proyecto_interdisciplinar: sum.proyecto_interdisciplinar,
          evaluacion_estructurada: sum.evaluacion_estructurada,
          promedio_parcial: promFinal,
          cualitativa: cuali,
          anio_lectivo: anioLectivoVigente,
          updated_at: new Date().toISOString()
        }
      })

      const { error: errResumen } = await supabase
        .from('calificaciones')
        .upsert(payloadResumen, {
          onConflict: 'estudiante_id, asignatura, trimestre, docente_id, anio_lectivo'
        })

      if (errResumen) throw errResumen

      setMensaje({ tipo: 'exito', texto: 'Todas las calificaciones se guardaron correctamente.' })
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + err.message })
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

  const generarPdfCalificaciones = async () => {
    if (estudiantes.length === 0) {
      alert('No hay estudiantes para generar el reporte.')
      return
    }

    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('l', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (logoUrl) {
        logoBase64 = await convertirLogoABase64(logoUrl)
      }

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
      doc.text('REPORTE DE CALIFICACIONES', pageWidth - 22, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`REGISTRO DE EVALUACIÓN - ${trimestre.toUpperCase()}`, pageWidth / 2, 41, { align: 'center' })

      autoTable(doc, {
        startY: 45,
        theme: 'grid',
        headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        body: [
          [`Docente: ${nombresDocente}`, `Asignatura: ${asignatura}`],
          [`Grado / Curso: ${grado}`, `Paralelo: ${paralelo} (${jornadaActual})`],
          [`Subnivel: ${subnivel}`, `Periodo: ${trimestre}`]
        ]
      })

      const headersTabla = [
        '#',
        'Apellidos y Nombres',
        ...columnasOrdenadas.map(c => `${c.descripcion.substring(0, 14)} (${c.categoria.substring(0, 4)})`),
        'Ref. Ped.',
        'Proy. Inter.',
        'Ev. Estruct.',
        'Prom. Final',
        'Escala'
      ]

      const filasTabla = estudiantes.map((est, index) => {
        const promFinal = calcularNotaFinal(est.id)
        const cuali = obtenerEscalaCualitativa(promFinal)
        const sum = sumativasMap[est.id] || { refuerzo_pedagogico: 0, proyecto_interdisciplinar: 0, evaluacion_estructurada: 0 }

        const filaValores: any = [
          index + 1,
          `${est.apellidos} ${est.nombres}`
        ]

        columnasOrdenadas.forEach(col => {
          const val = notasMap[est.id]?.[col.id] || 0
          filaValores.push(val > 0 ? val.toFixed(2) : '0.00')
        })

        filaValores.push(sum.refuerzo_pedagogico > 0 ? sum.refuerzo_pedagogico.toFixed(2) : '-')
        filaValores.push(sum.proyecto_interdisciplinar > 0 ? sum.proyecto_interdisciplinar.toFixed(2) : '0.00')
        filaValores.push(sum.evaluacion_estructurada > 0 ? sum.evaluacion_estructurada.toFixed(2) : '0.00')
        filaValores.push(promFinal.toFixed(2))
        filaValores.push(cuali.label)

        return filaValores
      })

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 4,
        theme: 'grid',
        head: [headersTabla],
        body: filasTabla,
        headStyles: { fillColor: [75, 76, 153], fontSize: 7, halign: 'center' },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 55 }
        }
      })

      const finalY = (doc as any).lastAutoTable.finalY + 20
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.line(pageWidth / 2 - 40, finalY, pageWidth / 2 + 40, finalY)
      doc.text(nombresDocente, pageWidth / 2, finalY + 4, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.text('DOCENTE RESPONSABLE', pageWidth / 2, finalY + 8, { align: 'center' })

      doc.save(`Calificaciones_${asignatura}_${grado}_${paralelo}_${trimestre}.pdf`)
    } catch (e: any) {
      console.error(e)
      alert('Error al generar PDF: ' + e.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  const jornadasDisponibles = Array.from(new Set(misAsignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual).map(a => a.grado_curso)))
  const paralelosDisponibles = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado).map(a => a.paralelo)))
  
  const asignaturasDisponibles = materiasFiltradas.length > 0 
    ? materiasFiltradas 
    : Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado && a.paralelo === paralelo).map(a => a.asignatura)))

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Calificaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99]/20 selection:text-[#4b4c99] font-sans">

      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
          >
            Año Lectivo Vigente: {anioLectivoVigente || 'Sin año activo'} ({trimestre})
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            Registro de Calificaciones
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Ordenamiento por categorías de insumos
          </p>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <button
            onClick={() => router.push('/docente/calificaciones/consolidado')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer"
          >
            Consolidado
          </button>
          
          <button
            onClick={generarPdfCalificaciones}
            disabled={generandoPdf || estudiantes.length === 0}
            style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
            className="px-4 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {generandoPdf ? 'Generando PDF...' : 'Imprimir / PDF'}
          </button>

          {!esAnioCerrado && anioLectivoVigente && (
            <button
              onClick={() => setMostrarModalNuevaColumna(true)}
              style={{ backgroundColor: '#f6c358', color: '#594107' }}
              className="px-4 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Insumo
            </button>
          )}

          {!esAnioCerrado && anioLectivoVigente && (
            <button
              onClick={handleGuardarCalificaciones}
              disabled={guardando || estudiantes.length === 0}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar Calificaciones'}
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* FILTROS */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaActual}
            onChange={(e) => handleJornadaChange(e.target.value)}
            disabled={jornadasDisponibles.length <= 1}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
          >
            {jornadasDisponibles.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Subnivel</label>
          <input
            type="text"
            disabled
            value={subnivel}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none cursor-not-allowed shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año / Grado</label>
          <select
            value={grado}
            onChange={(e) => handleGradoChange(e.target.value)}
            disabled={gradosUnicos.length <= 1}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
          >
            {gradosUnicos.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
          <select
            value={paralelo}
            onChange={(e) => setParalelo(e.target.value)}
            disabled={paralelosDisponibles.length <= 1}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
          >
            {paralelosDisponibles.map((p) => <option key={p} value={p}>Paralelo {p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura</label>
          <select
            value={asignatura}
            onChange={(e) => setAsignatura(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {asignaturasDisponibles.map((asig) => <option key={asig} value={asig}>{asig}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Trimestre</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.05)', borderColor: 'rgba(75, 76, 153, 0.3)' }}
            className="w-full p-2.5 border-2 rounded-xl text-xs font-bold outline-none shadow-2xs"
          >
            <option value="Trimestre 1">Trimestre 1</option>
            <option value="Trimestre 2">Trimestre 2</option>
            <option value="Trimestre 3">Trimestre 3</option>
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE NOTAS ORGANIZADA POR CATEGORÍAS */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-x-auto">
        {cargando ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs">
            Cargando notas de {trimestre}...
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="font-semibold text-sm">No hay estudiantes activos en este curso ({grado} "{paralelo}").</p>
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center bg-slate-50 border border-slate-200" rowSpan={2}>#</th>
                <th className="p-3 min-w-52 bg-slate-50 border border-slate-200" rowSpan={2}>Estudiante</th>

                {gruposHeader.length === 0 ? (
                  <th className="p-3 text-center bg-amber-50 text-amber-900 border border-slate-200 italic" colSpan={1}>
                    Sin insumos creados. Haz clic en "+ Nuevo Insumo" para empezar.
                  </th>
                ) : (
                  gruposHeader.map((g) => (
                    <th 
                      key={g.categoria} 
                      className={`p-2 text-center border border-slate-200 text-xs font-bold uppercase ${getHeaderColor(g.categoria)}`}
                      colSpan={g.count}
                    >
                      {g.categoria}
                    </th>
                  ))
                )}

                <th className="p-2 text-center bg-amber-50 text-amber-900 border border-slate-200 font-bold" rowSpan={2}>
                  Refuerzo Pedag.
                </th>

                <th className="p-2 text-center bg-[#4b4c99] text-white border border-slate-200 font-bold" colSpan={2}>
                  APORTES SUMATIVOS {subnivel !== 'Básica Elemental' && '(30% - ' + trimestre + ')'}
                </th>

                <th className="p-3 text-center w-24 bg-slate-100 border border-slate-200 font-bold" rowSpan={2}>Prom. Final</th>
                <th className="p-3 text-center w-20 bg-slate-100 border border-slate-200 font-bold" rowSpan={2}>Escala</th>
              </tr>

              <tr className="bg-slate-50 text-slate-800 text-[9px] font-bold">
                {columnasOrdenadas.length === 0 ? (
                  <th className="p-2 text-center text-slate-400 border border-slate-200">Pulsa "+ Nuevo Insumo"</th>
                ) : (
                  columnasOrdenadas.map((col) => (
                    <th key={col.id} className="p-2 text-center border border-slate-200 min-w-28 bg-white">
                      <span className="block font-bold text-slate-900 truncate" title={col.descripcion}>
                        {col.descripcion}
                      </span>
                      <span className="block text-[8px] font-medium text-slate-500">
                        {col.categoria} #{col.numero}
                      </span>
                      {!esAnioCerrado && (
                        <button
                          onClick={() => handleEliminarColumna(col.id)}
                          title="Eliminar este insumo"
                          className="text-rose-500 hover:text-rose-700 font-bold text-[10px] mt-0.5 cursor-pointer"
                        >
                          ✕ Quitar
                        </button>
                      )}
                    </th>
                  ))
                )}

                <th className="p-1.5 text-center bg-indigo-50/50 border border-slate-200 min-w-28">Proy. Interdisciplinar</th>
                <th className="p-1.5 text-center bg-indigo-50/50 border border-slate-200 min-w-28">Ev. Base Estructurada</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {estudiantes.map((est, idx) => {
                const promFinal = calcularNotaFinal(est.id)
                const cuali = obtenerEscalaCualitativa(promFinal)
                const sum = sumativasMap[est.id] || { refuerzo_pedagogico: 0, proyecto_interdisciplinar: 0, evaluacion_estructurada: 0 }

                return (
                  <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 font-bold text-slate-400 text-center border border-slate-200">{idx + 1}</td>
                    <td className="p-2 font-bold text-slate-800 border border-slate-200 whitespace-nowrap">
                      {est.apellidos} {est.nombres}
                    </td>

                    {columnasOrdenadas.length === 0 ? (
                      <td className="p-2 text-center text-slate-300 border border-slate-200">-</td>
                    ) : (
                      columnasOrdenadas.map((col) => (
                        <td key={col.id} className="p-1 text-center border border-slate-200">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="10"
                            disabled={esAnioCerrado}
                            value={notasMap[est.id]?.[col.id] > 0 ? notasMap[est.id][col.id] : ''}
                            onChange={(e) => handleNotaDetalleChange(est.id, col.id, e.target.value)}
                            placeholder="0.00"
                            className="w-14 p-1 text-center border border-slate-300 rounded-lg font-semibold text-slate-900 outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] bg-white disabled:bg-slate-100 shadow-2xs placeholder:text-slate-300"
                          />
                        </td>
                      ))
                    )}

                    <td className="p-1 text-center bg-amber-50/20 border border-slate-200">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        disabled={esAnioCerrado}
                        value={sum.refuerzo_pedagogico > 0 ? sum.refuerzo_pedagogico : ''}
                        onChange={(e) => handleNotaSumativaChange(est.id, 'refuerzo_pedagogico', e.target.value)}
                        placeholder="Opt."
                        className="w-14 p-1 text-center border border-amber-300 rounded-lg font-semibold text-amber-900 outline-none focus:ring-1 focus:ring-amber-500 bg-white disabled:bg-slate-100 shadow-2xs"
                      />
                    </td>

                    <td className="p-1 text-center bg-indigo-50/20 border border-slate-200">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        disabled={esAnioCerrado}
                        value={sum.proyecto_interdisciplinar > 0 ? sum.proyecto_interdisciplinar : ''}
                        onChange={(e) => handleNotaSumativaChange(est.id, 'proyecto_interdisciplinar', e.target.value)}
                        placeholder="0.00"
                        className="w-16 p-1 text-center border border-indigo-200 rounded-lg font-semibold text-indigo-950 outline-none focus:ring-1 focus:ring-[#4b4c99] bg-white disabled:bg-slate-100 shadow-2xs placeholder:text-slate-300"
                      />
                    </td>

                    <td className="p-1 text-center bg-indigo-50/20 border border-slate-200">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        disabled={esAnioCerrado}
                        value={sum.evaluacion_estructurada > 0 ? sum.evaluacion_estructurada : ''}
                        onChange={(e) => handleNotaSumativaChange(est.id, 'evaluacion_estructurada', e.target.value)}
                        placeholder="0.00"
                        className="w-16 p-1 text-center border border-indigo-200 rounded-lg font-semibold text-indigo-950 outline-none focus:ring-1 focus:ring-[#4b4c99] bg-white disabled:bg-slate-100 shadow-2xs placeholder:text-slate-300"
                      />
                    </td>

                    <td className="p-2 text-center bg-slate-50 font-bold text-sm text-slate-900 border border-slate-200">
                      {promFinal.toFixed(2)}
                    </td>

                    <td className="p-2 text-center bg-slate-50 border border-slate-200">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${cuali.color} shadow-2xs inline-block`}>
                        {cuali.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL NUEVO INSUMO */}
      {mostrarModalNuevaColumna && !esAnioCerrado && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Crear Nuevo Insumo ({trimestre})</h2>
              <button onClick={() => setMostrarModalNuevaColumna(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Categoría:</label>
                <select
                  value={nuevaCat}
                  onChange={(e: any) => setNuevaCat(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer"
                >
                  <option value="Deberes / Indiv.">Deberes / Actividades Individuales</option>
                  <option value="Tareas en Clase">Tareas en Clase</option>
                  <option value="Actividades Grupales">Actividades Grupales</option>
                  <option value="Lecciones">Lecciones</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombre / Descripción del Insumo:</label>
                <input
                  type="text"
                  value={nuevaDesc}
                  onChange={(e) => setNuevaDesc(e.target.value)}
                  placeholder="Ej: Taller 1 - Ecuaciones de 1er grado"
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                onClick={() => setMostrarModalNuevaColumna(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregarColumna}
                disabled={!nuevaDesc.trim()}
                style={{ backgroundColor: '#4b4c99' }}
                className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                Crear Insumo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}