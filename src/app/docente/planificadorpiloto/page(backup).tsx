'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

const NIVELES_EDUCATIVOS: { [subnivel: string]: string[] } = {
  'Inicial': ['Inicial 1', 'Inicial 2'],
  'Preparatoria': ['Preparatoria'],
  'Básica Elemental': ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'],
  'Básica Media': ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'],
  'Básica Superior': ['8vo Grado EGB', '9no Grado EGB', '10mo Grado EGB'],
  'Bachillerato': ['1er Año Bachillerato', '2do Año Bachillerato', '3er Año Bachillerato'],
}

const MATERIAS_GLOBALES = [
  'Matemática', 'Lengua y Literatura', 'Ciencias Naturales', 'Estudios Sociales',
  'Educación Física', 'Educación Cultural y Artística (ECA)', 'Idioma Extranjero (Inglés)',
  'Biología', 'Física', 'Química', 'Historia y Geografía', 'Educación para la Ciudadanía', 
  'Filosofía', 'Emprendimiento y Gestión', 'Currículo Integrado Inicial', 'Currículo Integrado Preparatoria'
]

export default function PlanificadorMicrocurricular() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('id')

  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)
  
  const [gradosPermitidos, setGradosPermitidos] = useState<string[]>([])
  const [asignaturasPermitidas, setAsignaturasPermitidas] = useState<string[]>([])
  const [sinAsignacion, setSinAsignacion] = useState(false)

  const añosPorSubnivel: Record<string, string[]> = NIVELES_EDUCATIVOS

  // Subniveles filtrados estrictamente por lo que el Superadministrador le asignó
  const subnivelesDisponibles = gradosPermitidos.length > 0
    ? Object.keys(añosPorSubnivel).filter(sub => 
        añosPorSubnivel[sub].some(grado => gradosPermitidos.includes(grado))
      )
    : []

  const [subnivel, setSubnivel] = useState('')
  
  const gradosDelSubnivel = subnivel ? (añosPorSubnivel[subnivel] || []) : []
  const gradosVisibles = gradosDelSubnivel.filter(g => gradosPermitidos.includes(g))

  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('A')

  const [registrosCurriculares, setRegistrosCurriculares] = useState<any[]>([])
  const [competenciasDisponibles, setCompetenciasDisponibles] = useState<string[]>([])
  const [cargandoCurriculo, setCargandoCurriculo] = useState(false)

  const [form, setForm] = useState({
    trimestre: 'Trimestre 1',
    noSemanas: '8',
    tituloSia: '',
    descripcionSia: '',
    asignaturasConexion: '',
    competenciaEspecifica: ''
  })

  const [bloquesCompetencias, setBloquesCompetencias] = useState([
    {
      id: 1,
      competencia: '',
      activar1a1: false, 
      indicadoresDisponibles: [] as string[],
      declarativosDisponibles: [] as string[],
      procedimentalesDisponibles: [] as string[],
      actitudinalesDisponibles: [] as string[],
      filasSaberes: [
        { id: Date.now(), indicador: '', declarativo: '', procedimental: '', actitudinal: '' }
      ]
    }
  ])

  const [estructuraTematica, setEstructuraTematica] = useState<any[]>([])

  const [semanas, setSemanas] = useState(
    Array.from({ length: 8 }, (_, i) => ({
      numero: i + 1,
      inicio: '',
      desarrollo: '',
      cierre: '',
      recursos: 'Material concreto, soportes visuales, recursos digitales.',
      tecnica: 'Observación sistemática',
      instrumento: 'Rúbrica de evaluación / Lista de cotejo'
    }))
  )

  const handleNoSemanasChange = (nuevoValor: string) => {
    const num = parseInt(nuevoValor) || 8
    const cantidad = Math.max(1, Math.min(12, num))
    setForm(prev => ({ ...prev, noSemanas: cantidad.toString() }))
    
    setSemanas(prev => {
      if (cantidad === prev.length) return prev
      if (cantidad > prev.length) {
        const extra = Array.from({ length: cantidad - prev.length }, (_, i) => ({
          numero: prev.length + i + 1,
          inicio: '',
          desarrollo: '',
          cierre: '',
          recursos: 'Material concreto, soportes visuales, recursos digitales.',
          tecnica: 'Observación sistemática',
          instrumento: 'Rúbrica de evaluación / Lista de cotejo'
        }))
        return [...prev, ...extra]
      } else {
        return prev.slice(0, cantidad)
      }
    })
  }

  const [guardando, setGuardando] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [generandoIA, setGenerandoIA] = useState(false)

  // Asignaturas visibles limitadas exclusivamente a la carga horaria del Superadmin
  const materiasVisibles = asignaturasPermitidas

  const handleSubnivelChange = (nuevoSubnivel: string) => {
    setSubnivel(nuevoSubnivel)
    const aniosDelSub = añosPorSubnivel[nuevoSubnivel] || []
    const permitidosEnSub = aniosDelSub.filter(g => gradosPermitidos.includes(g))
    
    if (permitidosEnSub.length > 0) {
      setGradoSeleccionado(permitidosEnSub[0])
    } else {
      setGradoSeleccionado('')
    }
  }

  useEffect(() => {
    cargarDatosDocente()
  }, [])

  useEffect(() => {
    if (gradoSeleccionado && materiaSeleccionada) {
      cargarCurriculoDesdeBD()
    }
  }, [materiaSeleccionada, gradoSeleccionado])

  const cargarDatosDocente = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: doc } = await supabase
      .from('docentes')
      .select('*, instituciones(*)')
      .eq('id', user.id)
      .single()

    if (doc) {
      setDocente(doc)
      setInstitucion(doc.instituciones)

      const gradosAutorizados: string[] = doc.grados_asignados || []
      const asignaturasAutorizadas: string[] = doc.asignaturas_asignadas || []

      setGradosPermitidos(gradosAutorizados)
      setAsignaturasPermitidas(asignaturasAutorizadas)

      // Si no tiene carga horaria asignada por el Superadmin
      if (gradosAutorizados.length === 0 || asignaturasAutorizadas.length === 0) {
        setSinAsignacion(true)
        return
      }

      // Inicializar subnivel y grado autorizado
      const subnivelesValidos = Object.keys(añosPorSubnivel).filter(sub => 
        añosPorSubnivel[sub].some(g => gradosAutorizados.includes(g))
      )
      
      if (subnivelesValidos.length > 0) {
        const primerSub = subnivelesValidos[0]
        setSubnivel(primerSub)

        const gradosDelSub = añosPorSubnivel[primerSub].filter(g => gradosAutorizados.includes(g))
        if (gradosDelSub.length > 0) {
          setGradoSeleccionado(gradosDelSub[0])
        }
      }

      if (asignaturasAutorizadas.length > 0) {
        setMateriaSeleccionada(asignaturasAutorizadas[0])
      }
    }

    if (planId) {
      const { data: planData, error } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*')
        .eq('id', planId)
        .single()

      if (!error && planData) {
        setMateriaSeleccionada(planData.asignatura || '')
        setSubnivel(planData.subnivel || '')
        setGradoSeleccionado(planData.grado_curso || '')
        setParaleloSeleccionado(planData.paralelo || 'A')
        
        const semanasGuardadas = planData.semanas || []
        const totalSemanas = planData.no_semanas || (semanasGuardadas.length > 0 ? semanasGuardadas.length.toString() : '8')

        setForm({
          trimestre: planData.trimestre || 'Trimestre 1',
          noSemanas: totalSemanas,
          tituloSia: planData.titulo_sia || '',
          descripcionSia: planData.descripcion_sia || '',
          asignaturasConexion: planData.asignaturas_conexion || '',
          competenciaEspecifica: planData.competencia_especifica || ''
        })

        if (semanasGuardadas.length > 0) {
          setSemanas(semanasGuardadas)
        }

        if (planData.filas_saberes && planData.filas_saberes.length > 0) {
          setBloquesCompetencias([{
            id: 1,
            competencia: planData.competencia_especifica || '',
            activar1a1: false,
            indicadoresDisponibles: [],
            declarativosDisponibles: [],
            procedimentalesDisponibles: [],
            actitudinalesDisponibles: [],
            filasSaberes: planData.filas_saberes
          }])
        }
      }
    }
  }

  const cargarCurriculoDesdeBD = async () => {
    if (!gradoSeleccionado || !materiaSeleccionada) return
    setCargandoCurriculo(true)
    try {
      const { data, error } = await supabase
        .from('matriz_curricular_oficial')
        .select('*')
        .eq('asignatura', materiaSeleccionada)
        .eq('grado_curso', gradoSeleccionado)

      if (error) throw error

      if (data && data.length > 0) {
        setRegistrosCurriculares(data)
        const compsUnicas = Array.from(new Set(data.map(d => d.competencia)))
        setCompetenciasDisponibles(compsUnicas)

        if (compsUnicas.length > 0) {
          actualizarBloqueCompetencia(bloquesCompetencias[0].id, compsUnicas[0], data)
        }
      } else {
        setRegistrosCurriculares([])
        setCompetenciasDisponibles([])
      }
    } catch (e: any) {
      console.error('Error cargando currículo modular:', e.message || e)
    } finally {
      setCargandoCurriculo(false)
    }
  }

  const actualizarBloqueCompetencia = (bloqueId: number, competenciaTexto: string, fuenteDatos = registrosCurriculares) => {
    const registrosDeCompetencia = fuenteDatos.filter(d => d.competencia === competenciaTexto)

    const extraerUnicos = (campo: string) => {
      const valores = registrosDeCompetencia.map(d => d[campo]).filter(Boolean)
      return Array.from(new Set(valores))
    }

    const bloqueActual = bloquesCompetencias.find(b => b.id === bloqueId)
    const es1a1 = bloqueActual?.activar1a1 || false

    const filasGeneradas = !es1a1 && registrosDeCompetencia.length > 0
      ? registrosDeCompetencia.map((reg, index) => ({
          id: Date.now() + index,
          indicador: reg.indicador || '',
          declarativo: reg.declarativo || '',
          procedimental: reg.procedimental || '',
          actitudinal: reg.actitudinal || ''
        }))
      : [{ id: Date.now(), indicador: '', declarativo: '', procedimental: '', actitudinal: '' }]

    setBloquesCompetencias(prev => prev.map(b => {
      if (b.id === bloqueId) {
        return {
          ...b,
          competencia: competenciaTexto,
          indicadoresDisponibles: extraerUnicos('indicador'),
          declarativosDisponibles: extraerUnicos('declarativo'),
          procedimentalesDisponibles: extraerUnicos('procedimental'),
          actitudinalesDisponibles: extraerUnicos('actitudinal'),
          filasSaberes: filasGeneradas
        }
      }
      return b
    }))
  }

  const toggleActivar1a1 = (bloqueId: number) => {
    setBloquesCompetencias(prev => prev.map(b => {
      if (b.id === bloqueId) {
        const nuevoEstado = !b.activar1a1
        const registrosDeCompetencia = registrosCurriculares.filter(d => d.competencia === b.competencia)
        
        const nuevasFilas = nuevoEstado 
          ? [{ id: Date.now(), indicador: '', declarativo: '', procedimental: '', actitudinal: '' }]
          : (registrosDeCompetencia.length > 0 
              ? registrosDeCompetencia.map((reg, idx) => ({ id: Date.now() + idx, indicador: reg.indicador || '', declarativo: reg.declarativo || '', procedimental: reg.procedimental || '', actitudinal: reg.actitudinal || '' }))
              : [{ id: Date.now(), indicador: '', declarativo: '', procedimental: '', actitudinal: '' }])

        return {
          ...b,
          activar1a1: nuevoEstado,
          filasSaberes: nuevasFilas
        }
      }
      return b
    }))
  }

  const agregarBloqueCompetencia = () => {
    const primeraComp = competenciasDisponibles[0] || ''
    const nuevoId = Date.now()
    setBloquesCompetencias([
      ...bloquesCompetencias,
      {
        id: nuevoId,
        competencia: primeraComp,
        activar1a1: false,
        indicadoresDisponibles: [],
        declarativosDisponibles: [],
        procedimentalesDisponibles: [],
        actitudinalesDisponibles: [],
        filasSaberes: [
          { id: Date.now() + 1, indicador: '', declarativo: '', procedimental: '', actitudinal: '' }
        ]
      }
    ])
    if (primeraComp) {
      actualizarBloqueCompetencia(nuevoId, primeraComp)
    }
  }

  const eliminarBloqueCompetencia = (id: number) => {
    if (bloquesCompetencias.length === 1) return
    setBloquesCompetencias(bloquesCompetencias.filter(b => b.id !== id))
  }

  const agregarSubFilaSaber = (bloqueId: number) => {
    setBloquesCompetencias(bloquesCompetencias.map(b => {
      if (b.id === bloqueId) {
        return {
          ...b,
          filasSaberes: [
            ...b.filasSaberes,
            {
              id: Date.now(),
              indicador: '',
              declarativo: '',
              procedimental: '',
              actitudinal: ''
            }
          ]
        }
      }
      return b
    }))
  }

  const eliminarSubFilaSaber = (bloqueId: number, subFilaId: number) => {
    setBloquesCompetencias(bloquesCompetencias.map(b => {
      if (b.id === bloqueId) {
        if (b.filasSaberes.length === 1) return b
        return {
          ...b,
          filasSaberes: b.filasSaberes.filter(f => f.id !== subFilaId)
        }
      }
      return b
    }))
  }

  const handleSubFilaChange = (bloqueId: number, subFilaId: number, campo: string, valor: string) => {
    setBloquesCompetencias(bloquesCompetencias.map(b => {
      if (b.id === bloqueId) {
        return {
          ...b,
          filasSaberes: b.filasSaberes.map(f => f.id === subFilaId ? { ...f, [campo]: valor } : f)
        }
      }
      return b
    }))
  }

  const handleSeleccionarItem1a1 = (bloqueId: number, subFilaId: number, campo: string, itemSeleccionado: string) => {
    if (!itemSeleccionado) return
    setBloquesCompetencias(bloquesCompetencias.map(b => {
      if (b.id === bloqueId) {
        return {
          ...b,
          filasSaberes: b.filasSaberes.map(f => {
            if (f.id === subFilaId) {
              const valorActual = (f as any)[campo] || ''
              const nuevoValor = valorActual ? `${valorActual}\n• ${itemSeleccionado}` : `• ${itemSeleccionado}`
              return { ...f, [campo]: nuevoValor }
            }
            return f
          })
        }
      }
      return b
    }))
  }

  const handleSemanaChange = (index: number, campo: string, valor: string) => {
    const nuevasSemanas = [...semanas]
    nuevasSemanas[index] = { ...nuevasSemanas[index], [campo]: valor }
    setSemanas(nuevasSemanas)
  }

  const verificarCuotaIA = async () => {
    const hoy = new Date().toISOString().split('T')[0]
    const { count, error } = await supabase
      .from('planificaciones_microcurriculares')
      .select('*', { count: 'exact', head: true })
      .eq('docente_id', docente?.id)
      .gte('created_at', `${hoy}T00:00:00`)

    if (error) return true
    if ((count || 0) >= 5) {
      alert('Has alcanzado el límite diario de 5 generaciones exitosas con Inteligencia Artificial.')
      return false
    }
    return true
  }

  const analizarEstructuraTematicaIA = async () => {
    if (generandoIA) return
    const cuotaDisponible = await verificarCuotaIA()
    if (!cuotaDisponible) return

    setGenerandoIA(true)
    try {
      const filasSeleccionadas = bloquesCompetencias.flatMap(b => 
        b.filasSaberes
          .filter(f => (f.indicador && f.indicador.trim() !== '') || (f.declarativo && f.declarativo.trim() !== '') || (f.procedimental && f.procedimental.trim() !== ''))
          .map(f => ({
            competenciaFila: b.competencia,
            ...f
          }))
      )

      if (filasSeleccionadas.length === 0) {
        alert('Por favor, selecciona al menos un indicador o saber antes de analizar.')
        setGenerandoIA(false)
        return
      }

      const res = await fetch('/api/generar-plan', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoModelo: 'estructura_tematica',
          asignatura: materiaSeleccionada,
          subnivel: subnivel,
          grado: gradoSeleccionado,
          filasSaberes: filasSeleccionadas
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (data.temas && Array.isArray(data.temas)) {
        setEstructuraTematica(data.temas)
        alert('Estructura temática generada con éxito.')
      }
    } catch (e: any) {
      alert('La IA falló: ' + e.message)
    } finally {
      setGenerandoIA(false)
    }
  }

  const generarSecuenciaDUAIa = async () => {
    if (generandoIA) return
    const cuotaDisponible = await verificarCuotaIA()
    if (!cuotaDisponible) return

    setGenerandoIA(true)
    try {
      const filasSeleccionadas = bloquesCompetencias.flatMap(b => 
        b.filasSaberes
          .filter(f => (f.indicador && f.indicador.trim() !== '') || (f.declarativo && f.declarativo.trim() !== '') || (f.procedimental && f.procedimental.trim() !== ''))
          .map(f => ({
            competenciaFila: b.competencia,
            ...f
          }))
      )

      if (filasSeleccionadas.length === 0) {
        alert('Por favor, selecciona al menos un indicador o saber antes de generar la secuencia.')
        setGenerandoIA(false)
        return
      }

      const compsPrincipales = bloquesCompetencias.map(b => b.competencia).filter(Boolean)

      const res = await fetch('/api/generar-plan', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoModelo: 'secuencia_copisi',
          asignatura: materiaSeleccionada,
          subnivel: subnivel,
          grado: gradoSeleccionado,
          noSemanas: parseInt(form.noSemanas) || 8,
          competenciasPrincipales: compsPrincipales,
          filasSaberes: filasSeleccionadas
        })
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Error en el servidor.')

      if (data.tituloSia || data.descripcionSia || data.asignaturasConexion) {
        setForm(prev => ({
          ...prev,
          tituloSia: data.tituloSia || prev.tituloSia,
          descripcionSia: data.descripcionSia || prev.descripcionSia,
          asignaturasConexion: data.asignaturasConexion || prev.asignaturasConexion
        }))
      }

      if (data.semanas && Array.isArray(data.semanas)) {
        const semanasMapeadas = data.semanas.map((s: any) => ({
          numero: s.numero,
          inicio: s.sugerenciasInicio || '',
          desarrollo: s.sugerenciasDesarrollo || '',
          cierre: s.sugerenciasCierre || '',
          recursos: s.recursos || 'Material concreto, soportes visuales, recursos digitales.',
          tecnica: s.tecnica || 'Observación sistemática',
          instrumento: s.instrumento || 'Rúbrica de evaluación / Lista de cotejo'
        }))
        setSemanas(semanasMapeadas)
        alert('Planificación integral generada con éxito.')
      }
    } catch (e: any) {
      alert('La IA falló: ' + e.message)
    } finally {
      setGenerandoIA(false)
    }
  }

  const guardarPlanificacion = async () => {
    if (!gradosPermitidos.includes(gradoSeleccionado)) {
      alert('Acceso denegado: El Superadministrador no te ha asignado este grado en tu carga horaria.')
      return
    }
    if (!asignaturasPermitidas.includes(materiaSeleccionada)) {
      alert('Acceso denegado: El Superadministrador no te ha asignado esta asignatura en tu carga horaria.')
      return
    }

    setGuardando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay usuario autenticado.')

      const todasLasFilas = bloquesCompetencias.flatMap(b => 
        b.filasSaberes.map(f => ({
          competenciaFila: b.competencia,
          ...f
        }))
      )

      const datosPlan = {
        docente_id: user.id,
        institucion_id: docente?.institucion_id,
        asignatura: materiaSeleccionada,
        subnivel: subnivel,
        grado_curso: gradoSeleccionado,
        paralelo: paraleloSeleccionado,
        trimestre: form.trimestre,
        no_semanas: form.noSemanas,
        titulo_sia: form.tituloSia,
        descripcion_sia: form.descripcionSia,
        asignaturas_conexion: form.asignaturasConexion,
        competencia_especifica: bloquesCompetencias.map(b => b.competencia).filter(Boolean).join(' | '),
        filas_saberes: todasLasFilas,
        semanas: semanas
      }

      let error = null
      if (planId) {
        const res = await supabase.from('planificaciones_microcurriculares').update(datosPlan).eq('id', planId)
        error = res.error
      } else {
        const res = await supabase.from('planificaciones_microcurriculares').insert([datosPlan])
        error = res.error
      }

      if (error) throw error

      alert(planId ? '¡Planificación actualizada con éxito!' : '¡Planificación guardada con éxito!')
      router.push('/docente/planificadorpiloto/planes-guardados')
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

  const generarPDFPlanificacion = async () => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('l', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (institucion?.logo_url) {
        logoBase64 = await convertirLogoABase64(institucion.logo_url)
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
      doc.text((institucion?.nombre_institucion || 'UNIDAD EDUCATIVA').toUpperCase(), pageWidth / 2, 18, { align: 'center' })
      doc.setFontSize(8)
      doc.text(`CÓDIGO AMIE: ${institucion?.codigo_amie || '03H00106'}`, pageWidth / 2, 24, { align: 'center' })
      doc.setTextColor(75, 76, 153)
      doc.text(`AÑO LECTIVO: ${institucion?.anio_lectivo_activo || '2026-2027'}`, pageWidth / 2, 30, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('EDUCAMET', pageWidth - 22, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('PLANIFICACIÓN MICROCURRICULAR', pageWidth / 2, 40, { align: 'center' })

      const compsTexto = bloquesCompetencias.map((b, i) => `[Bloque ${i+1}] ${b.competencia}`).join('\n')

      autoTable(doc, {
        startY: 43,
        theme: 'grid',
        headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        body: [
          ['DATOS INFORMATIVOS', ''],
          [`Docente: ${docente?.nombres || ''} ${docente?.apellidos || ''}`, `Asignatura: ${materiaSeleccionada}`],
          [`Subnivel: ${subnivel}`, `Grado/Curso: ${gradoSeleccionado}`],
          [`Paralelo: ${paraleloSeleccionado}`, `Trimestre: ${form.trimestre} (${form.noSemanas} semanas)`],
          ['SITUACIÓN DE APRENDIZAJE', ''],
          [`Título: ${form.tituloSia}`, ''],
          [`Descripción: ${form.descripcionSia}`, ''],
          ['CONEXIÓN INTERDISCIPLINAR', ''],
          [`Asignaturas: ${form.asignaturasConexion}`, ''],
          ['COMPETENCIAS ESPECÍFICAS', ''],
          [compsTexto, '']
        ]
      })

      const bodySaberes = estructuraTematica.length > 0
        ? estructuraTematica.map(t => [t.indicadores || '', t.conceptual || '', t.procedimental || '', t.actitudinal || ''])
        : bloquesCompetencias.flatMap(b => b.filasSaberes).map(f => [f.indicador, f.declarativo, f.procedimental, f.actitudinal])

      const tableSaberesY = (doc as any).lastAutoTable.finalY + 3
      autoTable(doc, {
        startY: tableSaberesY,
        theme: 'grid',
        head: [['Indicadores de evaluación', 'Saberes Declarativos', 'Saberes Procedimentales', 'Saberes Actitudinales']],
        body: bodySaberes,
        headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
        styles: { fontSize: 7 }
      })

      const tableSemanasY = (doc as any).lastAutoTable.finalY + 3
      const bodySemanas = semanas.map((sem) => [
        `Semana ${sem.numero}`,
        `• Sugerencias de Inicio:\n${sem.inicio}\n\n• Sugerencias de Desarrollo:\n${sem.desarrollo}\n\n• Sugerencias de Cierre:\n${sem.cierre}`,
        sem.recursos,
        `Técnica: ${sem.tecnica}\nInstrumento: ${sem.instrumento}`
      ])

      autoTable(doc, {
        startY: tableSemanasY,
        theme: 'grid',
        head: [['Semana', 'Estrategias metodológicas desde el DUA', 'Recursos', 'Técnicas e instrumentos de evaluación']],
        body: bodySemanas,
        headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 }
      })

      doc.save(`Planificacion_${materiaSeleccionada}_${gradoSeleccionado}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF de la planificación.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  const generarWordPlanificacion = () => {
    try {
      const compsTexto = bloquesCompetencias.map((b, i) => `<p><b>[Bloque ${i+1}]</b> ${b.competencia}</p>`).join('')
      
      const filasSaberesHtml = estructuraTematica.length > 0
        ? estructuraTematica.map(t => `
          <tr>
            <td style="border: 1px solid #000; padding: 6px;">${t.indicadores || ''}</td>
            <td style="border: 1px solid #000; padding: 6px;">${t.conceptual || ''}</td>
            <td style="border: 1px solid #000; padding: 6px;">${t.procedimental || ''}</td>
            <td style="border: 1px solid #000; padding: 6px;">${t.actitudinal || ''}</td>
          </tr>
        `).join('')
        : bloquesCompetencias.flatMap(b => b.filasSaberes).map(f => `
          <tr>
            <td style="border: 1px solid #000; padding: 6px;">${f.indicador || ''}</td>
            <td style="border: 1px solid #000; padding: 6px;">${f.declarativo || ''}</td>
            <td style="border: 1px solid #000; padding: 6px;">${f.procedimental || ''}</td>
            <td style="border: 1px solid #000; padding: 6px;">${f.actitudinal || ''}</td>
          </tr>
        `).join('')

      const filasSemanasHtml = semanas.map(sem => `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; background-color: #f3f4f6;">Semana ${sem.numero}</td>
          <td style="border: 1px solid #000; padding: 6px;">
            <p style="margin: 0 0 6px 0;">• <b>Sugerencias de Inicio:</b><br/>${sem.inicio.replace(/\n/g, '<br/>')}</p>
            <p style="margin: 0 0 6px 0;">• <b>Sugerencias de Desarrollo:</b><br/>${sem.desarrollo.replace(/\n/g, '<br/>')}</p>
            <p style="margin: 0;">• <b>Sugerencias de Cierre:</b><br/>${sem.cierre.replace(/\n/g, '<br/>')}</p>
          </td>
          <td style="border: 1px solid #000; padding: 6px;">${sem.recursos.replace(/\n/g, '<br/>')}</td>
          <td style="border: 1px solid #000; padding: 6px;"><b>Técnica:</b> ${sem.tecnica}<br/><b>Instrumento:</b> ${sem.instrumento}</td>
        </tr>
      `).join('')

      const contenidoWordXML = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Planificación Microcurricular</title>
          <!--[if gte mso 9]>
          <xml>
           <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
           </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page Section1 {
              size: 842.35pt 595.3pt;
              mso-page-orientation: landscape;
              margin: 36pt 36pt 36pt 36pt;
            }
            div.Section1 { page: Section1; }
            body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; }
            h2 { text-align: center; color: #4b4c99; font-size: 13pt; }
            h3 { background: #e0e7ff; padding: 6px; font-size: 10pt; color: #4b4c99; border-left: 4px solid #4b4c99; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; mso-yfti-tbllook: 1184; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; font-size: 9pt; vertical-align: top; }
            th { background-color: #f3f4f6; color: #1f2937; }
          </style>
        </head>
        <body>
          <div class="Section1">
            <h2>${(institucion?.nombre_institucion || 'UNIDAD EDUCATIVA').toUpperCase()}</h2>
            <p style="text-align: center; font-size: 9pt;">CÓDIGO AMIE: ${institucion?.codigo_amie || '03H00106'} | AÑO LECTIVO: ${institucion?.anio_lectivo_activo || '2026-2027'}</p>
            <h2 style="margin-top: 15px;">PLANIFICACIÓN MICROCURRICULAR</h2>

            <h3>DATOS INFORMATIVOS</h3>
            <table>
              <tr>
                <td><b>Docente:</b> ${docente?.nombres || ''} ${docente?.apellidos || ''}</td>
                <td><b>Asignatura:</b> ${materiaSeleccionada}</td>
              </tr>
              <tr>
                <td><b>Subnivel:</b> ${subnivel}</td>
                <td><b>Grado/Curso:</b> ${gradoSeleccionado}</td>
              </tr>
              <tr>
                <td><b>Paralelo:</b> ${paraleloSeleccionado}</td>
                <td><b>Trimestre:</b> ${form.trimestre} (${form.noSemanas} semanas)</td>
              </tr>
            </table>

            <h3>SITUACIÓN DE APRENDIZAJE</h3>
            <p><b>Título:</b> ${form.tituloSia}</p>
            <p><b>Descripción:</b> ${form.descripcionSia}</p>

            <h3>CONEXIÓN INTERDISCIPLINAR</h3>
            <p><b>Asignaturas:</b> ${form.asignaturasConexion.replace(/\n/g, '<br/>')}</p>

            <h3>COMPETENCIAS ESPECÍFICAS</h3>
            ${compsTexto}

            <h3>MATRIZ DE SABERES E INDICADORES</h3>
            <table>
              <thead>
                <tr>
                  <th>Indicadores de evaluación</th>
                  <th>Saberes Declarativos</th>
                  <th>Saberes Procedimentales</th>
                  <th>Saberes Actitudinales</th>
                </tr>
              </thead>
              <tbody>
                ${filasSaberesHtml}
              </tbody>
            </table>

            <h3>ESTRATEGIAS METODOLÓGICAS DESDE EL DUA</h3>
            <table>
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Estrategias metodológicas desde el DUA</th>
                  <th>Recursos</th>
                  <th>Técnicas e instrumentos de evaluación</th>
                </tr>
              </thead>
              <tbody>
                ${filasSemanasHtml}
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `

      const blob = new Blob(['\ufeff', contenidoWordXML], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Planificacion_${materiaSeleccionada}_${gradoSeleccionado}.doc`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('Error al generar el documento Word.')
    }
  }

  if (sinAsignacion) {
    return (
      <div className="flex h-[70vh] items-center justify-center font-sans p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-rose-200 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl mx-auto flex items-center justify-center text-2xl font-black">
            ⚠️
          </div>
          <h2 className="text-base font-bold text-slate-900 uppercase">Sin Carga Horaria Asignada</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            No tienes grados ni asignaturas configuradas en tu perfil. Solicita al Superadministrador que te asigne tu carga horaria desde su panel de control.
          </p>
          <button
            onClick={() => router.push('/docente')}
            className="px-5 py-2.5 bg-[#4b4c99] text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            Volver al Panel Docente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 relative font-sans selection:bg-[#4b4c99] selection:text-white">
      
      {generandoIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full mx-4 text-center space-y-4">
            <div className="w-14 h-14 bg-indigo-50 text-[#4b4c99] rounded-2xl mx-auto flex items-center justify-center text-2xl font-black">
              ✨
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                Generando Planificación
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Estamos generando tu planificación con inteligencia artificial, esto tomará de 1 a 2 minutos. Por favor, espera...
              </p>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div style={{ backgroundColor: '#4b4c99', width: '60%' }} className="h-full rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex justify-between items-center flex-wrap gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Módulo Curricular • Carga Horaria Verificada
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {planId ? 'Editando Planificación Microcurricular' : 'Nueva Planificación Microcurricular Piloto'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Matriz de competencias y saberes modulares restringida a tus asignaciones del Superadmin.
          </p>
        </div>

        <div className="flex gap-2.5 flex-wrap">
          <button
            onClick={guardarPlanificacion}
            disabled={guardando}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar Planificación'}
          </button>
          <button
            onClick={generarPDFPlanificacion}
            disabled={generandoPdf}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {generandoPdf ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
          <button
            onClick={generarWordPlanificacion}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition shadow-2xs cursor-pointer"
          >
            Descargar Word
          </button>
        </div>
      </div>

      {/* DATOS INFORMATIVOS */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-3">
          Datos Informativos (Restringido por Asignatura y Grado Autorizado)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Docente:</label>
            <input 
              type="text" 
              disabled 
              value={`${docente?.nombres || ''} ${docente?.apellidos || ''}`} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-slate-100 text-slate-700 font-bold shadow-2xs" 
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Subnivel Educativo:</label>
            <select 
              value={subnivel} 
              onChange={e => handleSubnivelChange(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              {subnivelesDisponibles.map((sub, idx) => (
                <option key={idx} value={sub} className="text-slate-900 font-bold bg-white">{sub}</option>
              ))}
            </select>
            <span className="text-[10px] text-[#4b4c99] font-bold mt-1 block">Filtrado por carga horaria</span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Grado / Curso / Año:</label>
            <select 
              value={gradoSeleccionado} 
              onChange={e => setGradoSeleccionado(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              {gradosVisibles.length > 0 ? (
                gradosVisibles.map((anio, idx) => (
                  <option key={idx} value={anio} className="text-slate-900 font-bold bg-white">{anio}</option>
                ))
              ) : (
                <option value="" disabled className="text-slate-500 font-bold bg-white">Sin grados autorizados en este subnivel</option>
              )}
            </select>
            <span className="text-[10px] text-[#4b4c99] font-bold mt-1 block">Filtrado por carga horaria</span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Asignatura:</label>
            <select 
              value={materiaSeleccionada} 
              onChange={e => setMateriaSeleccionada(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              {materiasVisibles.length > 0 ? (
                materiasVisibles.map((asig: string, idx: number) => (
                  <option key={idx} value={asig} className="text-slate-900 font-bold bg-white">{asig}</option>
                ))
              ) : (
                <option value="" disabled className="text-slate-500 font-bold bg-white">Sin asignaturas autorizadas</option>
              )}
            </select>
            <span className="text-[10px] text-[#4b4c99] font-bold mt-1 block">Filtrado por carga horaria</span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo:</label>
            <input 
              type="text" 
              value={paraleloSeleccionado} 
              onChange={e => setParaleloSeleccionado(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs" 
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Trimestre:</label>
            <select 
              value={form.trimestre} 
              onChange={e => setForm({...form, trimestre: e.target.value})} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              <option value="Trimestre 1" className="text-slate-900 font-bold bg-white">Trimestre 1</option>
              <option value="Trimestre 2" className="text-slate-900 font-bold bg-white">Trimestre 2</option>
              <option value="Trimestre 3" className="text-slate-900 font-bold bg-white">Trimestre 3</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">No. de Semanas (Dinámico):</label>
            <input 
              type="number" 
              min="1" 
              max="12" 
              value={form.noSemanas} 
              onChange={e => handleNoSemanasChange(e.target.value)} 
              className="w-full p-3 border-2 border-indigo-200 rounded-xl bg-indigo-50/50 text-indigo-900 font-black outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
          </div>
        </div>
      </div>

      {/* MATRIZ DE COMPETENCIAS ESPECIFICAS */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-4 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
              Matriz de Competencias Específicas
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Al seleccionar la competencia, se despliegan automáticamente todas sus filas e indicadores asociados.
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap items-center">
            <button
              onClick={agregarBloqueCompetencia}
              disabled={generandoIA}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl transition border border-slate-300 shadow-2xs cursor-pointer"
            >
              + Agregar Bloque
            </button>
            <button
              onClick={analizarEstructuraTematicaIA}
              disabled={generandoIA}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs uppercase rounded-xl transition border border-indigo-200 shadow-2xs cursor-pointer"
            >
              Analizar Temas con IA
            </button>
            <button
              onClick={generarSecuenciaDUAIa}
              disabled={generandoIA}
              style={{ backgroundColor: '#4b4c99' }}
              className={`px-4 py-2.5 text-white font-bold text-xs uppercase rounded-xl shadow-sm transition cursor-pointer ${
                generandoIA ? 'opacity-80 scale-[0.98] shadow-inner cursor-wait animate-pulse' : 'hover:opacity-95'
              }`}
            >
              {generandoIA ? `Generando ${form.noSemanas} Semanas...` : `Generar Secuencia (${form.noSemanas} Semanas)`}
            </button>
          </div>
        </div>

        {estructuraTematica.length > 0 && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3 shadow-2xs">
            <h4 className="font-bold text-indigo-900 text-xs uppercase">Estructura Temática Secuencial (Análisis IA):</h4>
            <div className="space-y-2 text-xs text-slate-800">
              {estructuraTematica.map((t, idx) => (
                <div key={idx} className="bg-white p-3.5 rounded-xl border border-indigo-100 space-y-1 shadow-2xs">
                  <div className="font-bold text-[#4b4c99]">{t.orden}</div>
                  <div className="text-slate-600 font-medium italic">{t.subtitulo}</div>
                  <div className="font-bold text-slate-700 mt-1">Indicadores:</div>
                  <pre className="whitespace-pre-wrap font-sans text-slate-600">{t.indicadores}</pre>
                  <div className="font-bold text-slate-700 mt-1">Saberes Integrados:</div>
                  <pre className="whitespace-pre-wrap font-sans text-indigo-950 font-medium">
                    {`• Conceptual:\n${t.conceptual}\n• Procedimental:\n${t.procedimental}\n• Actitudinal:\n${t.actitudinal}`}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {bloquesCompetencias.map((bloque, index) => (
            <div key={bloque.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 relative space-y-4 shadow-2xs">
              
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 flex-wrap gap-2">
                <span className="font-bold text-xs text-slate-800 uppercase">
                  Fila / Competencia {index + 1}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => agregarSubFilaSaber(bloque.id)}
                    disabled={generandoIA}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] uppercase rounded-xl transition cursor-pointer"
                  >
                    + Agregar fila de indicador y saberes
                  </button>

                  {bloquesCompetencias.length > 1 && (
                    <button 
                      onClick={() => eliminarBloqueCompetencia(bloque.id)} 
                      disabled={generandoIA}
                      className="text-rose-600 font-bold text-xs hover:underline ml-2 cursor-pointer"
                    >
                      Eliminar Bloque
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Competencia Específica de esta Fila:</label>
                <select
                  value={bloque.competencia}
                  onChange={e => actualizarBloqueCompetencia(bloque.id, e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-xs font-bold outline-none focus:border-[#4b4c99] cursor-pointer shadow-2xs"
                >
                  {competenciasDisponibles.map((comp, idx) => (
                    <option key={idx} value={comp} className="text-slate-900 font-bold bg-white">{comp}</option>
                  ))}
                </select>
                <textarea 
                  rows={2} 
                  value={bloque.competencia} 
                  onChange={e => {
                    const val = e.target.value
                    setBloquesCompetencias(bloquesCompetencias.map(b => b.id === bloque.id ? { ...b, competencia: val } : b))
                  }} 
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-xs font-medium outline-none mt-1 shadow-2xs" 
                />
              </div>

              {/* INTERRUPTOR DE SELECCIÓN 1 A 1 */}
              <div className="flex items-center gap-3 py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl shadow-2xs">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={bloque.activar1a1} 
                    onChange={() => toggleActivar1a1(bloque.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4b4c99]"></div>
                </label>
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Activar selección indicadores y saberes 1 a 1
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {bloque.filasSaberes.map((subFila, subIdx) => {
                  const regAsociados = registrosCurriculares.filter(d => 
                    subFila.indicador ? d.indicador === subFila.indicador : true
                  )
                  const declarativosDisponiblesFila = Array.from(new Set(regAsociados.map(d => d.declarativo).filter(Boolean)))
                  const procedimentalesDisponiblesFila = Array.from(new Set(regAsociados.map(d => d.procedimental).filter(Boolean)))
                  const actitudinalesDisponiblesFila = Array.from(new Set(regAsociados.map(d => d.actitudinal).filter(Boolean)))

                  return (
                    <div key={subFila.id} className="p-4 rounded-2xl border border-slate-200 bg-white relative space-y-3 shadow-2xs">
                      
                      {bloque.filasSaberes.length > 1 && (
                        <div className="flex justify-end">
                          <button 
                            onClick={() => eliminarSubFilaSaber(bloque.id, subFila.id)}
                            className="text-rose-600 font-bold text-[10px] uppercase hover:underline cursor-pointer"
                          >
                            Quitar esta fila
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 text-xs">
                        
                        {/* INDICADOR (#4b4c99) */}
                        <div className="space-y-1.5 p-3 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
                          <label style={{ color: '#4b4c99' }} className="block font-black uppercase text-[11px]">Indicador:</label>
                          {bloque.activar1a1 ? (
                            <select
                              onChange={e => {
                                handleSeleccionarItem1a1(bloque.id, subFila.id, 'indicador', e.target.value)
                                e.target.value = ""
                              }}
                              className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white text-slate-900 font-bold text-[11px] outline-none cursor-pointer shadow-2xs"
                            >
                              <option value="" className="text-slate-900 font-bold bg-white">+ Añadir indicador ítem por ítem...</option>
                              {bloque.indicadoresDisponibles?.map((ind, i) => (
                                <option key={i} value={ind} className="text-slate-900 font-bold bg-white">{ind}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'indicador', e.target.value)}
                              className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white text-slate-900 font-bold text-[11px] outline-none cursor-pointer shadow-2xs"
                            >
                              <option value="" className="text-slate-900 font-bold bg-white">-- Seleccionar individual --</option>
                              {bloque.indicadoresDisponibles?.map((ind, i) => (
                                <option key={i} value={ind} className="text-slate-900 font-bold bg-white">{ind}</option>
                              ))}
                            </select>
                          )}
                          <textarea 
                            rows={3} 
                            value={subFila.indicador} 
                            onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'indicador', e.target.value)} 
                            className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white text-slate-900 font-medium outline-none shadow-2xs focus:border-[#4b4c99]" 
                          />
                        </div>

                        {/* DECLARATIVO (#f6c358) */}
                        <div className="space-y-1.5 p-3 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs">
                          <label style={{ color: '#b45309' }} className="block font-black uppercase text-[11px]">Declarativo:</label>
                          {bloque.activar1a1 ? (
                            <select
                              onChange={e => {
                                handleSeleccionarItem1a1(bloque.id, subFila.id, 'declarativo', e.target.value)
                                e.target.value = ""
                              }}
                              className="w-full p-2.5 border border-amber-200 rounded-xl bg-white text-slate-900 font-bold text-[11px] outline-none cursor-pointer shadow-2xs"
                            >
                              <option value="" className="text-slate-900 font-bold bg-white">+ Añadir declarativo ítem por ítem...</option>
                              {declarativosDisponiblesFila.map((dec, i) => (
                                <option key={i} value={dec} className="text-slate-900 font-bold bg-white">{dec}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'declarativo', e.target.value)}
                              className="w-full p-2.5 border border-amber-200 rounded-xl bg-white text-slate-900 font-bold text-[11px] outline-none cursor-pointer shadow-2xs"
                            >
                              <option value="" className="text-slate-900 font-bold bg-white">-- Seleccionar individual --</option>
                              {bloque.declarativosDisponibles?.map((dec, i) => (
                                <option key={i} value={dec} className="text-slate-900 font-bold bg-white">{dec}</option>
                              ))}
                            </select>
                          )}
                          <textarea 
                            rows={3} 
                            value={subFila.declarativo} 
                            onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'declarativo', e.target.value)} 
                            className="w-full p-2.5 border border-amber-200 rounded-xl bg-white text-slate-900 font-medium outline-none shadow-2xs focus:border-[#f6c358]" 
                          />
                        </div>

                        {/* PROCEDIMENTAL (#45b3a5) */}
                        <div className="space-y-1.5 p-3 rounded-2xl border border-teal-200 bg-teal-50/20 shadow-2xs">
                          <label style={{ color: '#115e59' }} className="block font-black uppercase text-[11px]">Procedimental:</label>
                          {bloque.activar1a1 ? (
                            <select
                              onChange={e => {
                                handleSeleccionarItem1a1(bloque.id, subFila.id, 'procedimental', e.target.value)
                                e.target.value = ""
                              }}
                              className="w-full p-2.5 border border-teal-200 rounded-xl bg-white text-slate-900 font-bold text-[11px] outline-none cursor-pointer shadow-2xs"
                            >
                              <option value="" className="text-slate-900 font-bold bg-white">+ Añadir procedimental ítem por ítem...</option>
                              {procedimentalesDisponiblesFila.map((proc, i) => (
                                <option key={i} value={proc} className="text-slate-900 font-bold bg-white">{proc}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'procedimental', e.target.value)}
                              className="w-full p-2.5 border border-teal-200 rounded-xl bg-white text-slate-900 font-bold text-[11px] outline-none cursor-pointer shadow-2xs"
                            >
                              <option value="" className="text-slate-900 font-bold bg-white">-- Seleccionar individual --</option>
                              {bloque.procedimentalesDisponibles?.map((proc, i) => (
                                <option key={i} value={proc} className="text-slate-900 font-bold bg-white">{proc}</option>
                              ))}
                            </select>
                          )}
                          <textarea 
                            rows={3} 
                            value={subFila.procedimental} 
                            onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'procedimental', e.target.value)} 
                            className="w-full p-2.5 border border-teal-200 rounded-xl bg-white text-slate-900 font-medium outline-none shadow-2xs focus:border-[#45b3a5]" 
                          />
                        </div>

                        {/* ACTITUDINAL (#de5860) */}
                        <div className="space-y-1.5 p-3 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-2xs">
                          <label style={{ color: '#de5860' }} className="block font-black uppercase text-[11px]">Actitudinal:</label>
                          {bloque.activar1a1 ? (
                            <select
                              onChange={e => {
                                handleSeleccionarItem1a1(bloque.id, subFila.id, 'actitudinal', e.target.value)
                                e.target.value = ""
                              }}
                              className="w-full p-2.5 border border-rose-200 rounded-xl bg-white text-slate-900 font-bold text-[11px] outline-none cursor-pointer shadow-2xs"
                            >
                              <option value="" className="text-slate-900 font-bold bg-white">+ Añadir actitudinal ítem por ítem...</option>
                              {actitudinalesDisponiblesFila.map((act, i) => (
                                <option key={i} value={act} className="text-slate-900 font-bold bg-white">{act}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'actitudinal', e.target.value)}
                              className="w-full p-2.5 border border-rose-200 rounded-xl bg-white text-slate-900 font-bold text-[11px] outline-none cursor-pointer shadow-2xs"
                            >
                              <option value="" className="text-slate-900 font-bold bg-white">-- Seleccionar individual --</option>
                              {bloque.actitudinalesDisponibles?.map((act, i) => (
                                <option key={i} value={act} className="text-slate-900 font-bold bg-white">{act}</option>
                              ))}
                            </select>
                          )}
                          <textarea 
                            rows={3} 
                            value={subFila.actitudinal} 
                            onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'actitudinal', e.target.value)} 
                            className="w-full p-2.5 border border-rose-200 rounded-xl bg-white text-slate-900 font-medium outline-none shadow-2xs focus:border-[#de5860]" 
                          />
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* SITUACIÓN DE APRENDIZAJE & CONEXIONES */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
            Situación de Aprendizaje (SIA) & Conexión Interdisciplinar
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Título de la SIA:</label>
            <input 
              type="text" 
              value={form.tituloSia} 
              onChange={e => setForm({...form, tituloSia: e.target.value})} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
          </div>
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Asignaturas en Conexión:</label>
            <textarea 
              rows={3} 
              value={form.asignaturasConexion} 
              onChange={e => setForm({...form, asignaturasConexion: e.target.value})} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Descripción de la SIA:</label>
            <textarea 
              rows={3} 
              value={form.descripcionSia} 
              onChange={e => setForm({...form, descripcionSia: e.target.value})} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
          </div>
        </div>
      </div>

      {/* SECUENCIA METODOLÓGICA SEMANAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-3">
          Estrategias Metodológicas DUA ({semanas.length} Semanas Configuradas)
        </h3>

        <div className="space-y-6">
          {semanas.map((sem, idx) => (
            <div key={sem.numero} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3 shadow-2xs">
              <h4 className="font-bold text-xs text-slate-900 uppercase">Semana {sem.numero}</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">[Principio DUA: Compromiso / Motivación]:</label>
                  <textarea 
                    rows={4} 
                    value={sem.inicio} 
                    onChange={e => handleSemanaChange(idx, 'inicio', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">[Principio DUA: Representación]:</label>
                  <textarea 
                    rows={4} 
                    value={sem.desarrollo} 
                    onChange={e => handleSemanaChange(idx, 'desarrollo', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">[Principio DUA: Acción y Expresión]:</label>
                  <textarea 
                    rows={4} 
                    value={sem.cierre} 
                    onChange={e => handleSemanaChange(idx, 'cierre', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Recursos:</label>
                  <input 
                    type="text" 
                    value={sem.recursos} 
                    onChange={e => handleSemanaChange(idx, 'recursos', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Técnica:</label>
                  <input 
                    type="text" 
                    value={sem.tecnica} 
                    onChange={e => handleSemanaChange(idx, 'tecnica', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Instrumento:</label>
                  <input 
                    type="text" 
                    value={sem.instrumento} 
                    onChange={e => handleSemanaChange(idx, 'instrumento', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}