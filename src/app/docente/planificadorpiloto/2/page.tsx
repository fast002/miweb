'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PlanificadorMicrocurricular() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('id')

  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)
  
  const [gradosPermitidos, setGradosPermitidos] = useState<string[]>([])
  const [asignaturasPermitidas, setAsignaturasPermitidas] = useState<string[]>([])

  const añosPorSubnivel: Record<string, string[]> = {
    'Básica Elemental': ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'],
    'Básica Media': ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'],
    'Básica Superior': ['8vo Grado EGB', '9no Grado EGB', '10mo Grado EGB'],
    'Bachillerato': ['1er Año Bachillerato', '2do Año Bachillerato', '3er Año Bachillerato']
  }

  const subnivelesDisponibles = gradosPermitidos.length > 0
    ? Object.keys(añosPorSubnivel).filter(sub => 
        añosPorSubnivel[sub].some(grado => gradosPermitidos.includes(grado))
      )
    : Object.keys(añosPorSubnivel)

  const [subnivel, setSubnivel] = useState(subnivelesDisponibles[0] || 'Básica Elemental')
  
  const gradosDelSubnivel = añosPorSubnivel[subnivel] || []
  const gradosVisibles = gradosPermitidos.length > 0
    ? gradosDelSubnivel.filter(g => gradosPermitidos.includes(g))
    : gradosDelSubnivel

  const [gradoSeleccionado, setGradoSeleccionado] = useState(gradosVisibles[0] || '')
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('Matemática')
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
      temaPersonalizado: '',
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
          temaPersonalizado: '',
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

  const materiasDisponibles = [
    'Matemática', 'Lengua y Literatura', 'Ciencias Naturales', 'Estudios Sociales',
    'Educación Física', 'Educación Cultural y Artística (ECA)', 'Idioma Extranjero (Inglés)',
    'Biología', 'Física', 'Química','Historia y Geografía', 'Educación para la Ciudadanía', 'Filosofía', 'Emprendimiento y Gestión'
  ]

  const materiasVisibles = asignaturasPermitidas.length > 0
    ? materiasDisponibles.filter(m => asignaturasPermitidas.includes(m))
    : materiasDisponibles

  const handleSubnivelChange = (nuevoSubnivel: string) => {
    setSubnivel(nuevoSubnivel)
    const aniosDelSub = añosPorSubnivel[nuevoSubnivel] || []
    const permitidosEnSub = gradosPermitidos.length > 0 
      ? aniosDelSub.filter(g => gradosPermitidos.includes(g))
      : aniosDelSub
    
    if (permitidosEnSub.length > 0) {
      setGradoSeleccionado(permitidosEnSub[0])
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
      setInstitucion(doc.institutions || doc.instituciones)

      const gradosAutorizados: string[] = doc.grados_asignados || []
      const asignaturasAutorizadas: string[] = doc.asignaturas_asignadas || []

      setGradosPermitidos(gradosAutorizados)
      setAsignaturasPermitidas(asignaturasAutorizadas)

      if (gradosAutorizados.length > 0) {
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
      }

      if (asignaturasAutorizadas.length > 0) {
        const permitidasValidas = materiasDisponibles.filter(m => asignaturasAutorizadas.includes(m))
        if (permitidasValidas.length > 0) {
          setMateriaSeleccionada(permitidasValidas[0])
        }
      }
    }

    if (planId) {
      const { data: planData, error } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*')
        .eq('id', planId)
        .single()

      if (!error && planData) {
        setMateriaSeleccionada(planData.asignatura || 'Matemática')
        setSubnivel(planData.subnivel || 'Básica Elemental')
        setGradoSeleccionado(planData.grado_curso || '2do Grado EGB')
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
        } else {
          setSemanas(Array.from({ length: parseInt(totalSemanas) }, (_, i) => ({
            numero: i + 1,
            temaPersonalizado: '',
            inicio: '',
            desarrollo: '',
            cierre: '',
            recursos: 'Material concreto, soportes visuales, recursos digitales.',
            tecnica: 'Observación sistemática',
            instrumento: 'Rúbrica de evaluación / Lista de cotejo'
          })))
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

  const analizarEstructuraTematicaIA = async () => {
    if (generandoIA) return
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
        alert('⚠️ Por favor, selecciona al menos un indicador o saber en tus bloques de competencia antes de analizar.')
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
        alert('✨ ¡Estructura temática generada exclusivamente con tus selecciones!')
      }
    } catch (e: any) {
      alert('Error al analizar la estructura temática.')
    } finally {
      setGenerandoIA(false)
    }
  }

  const generarSecuenciaDUAIa = async () => {
    if (generandoIA) return
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
        alert('⚠️ Por favor, selecciona al menos un indicador o saber en tus bloques antes de generar la secuencia.')
        setGenerandoIA(false)
        return
      }

      const compsPrincipales = bloquesCompetencias
        .map(b => b.competencia)
        .filter(Boolean)

      // Enviamos también los temas personalizados que haya escrito el docente por semana
      const temasPorSemana = semanas.map(s => ({
        numero: s.numero,
        temaPersonalizado: s.temaPersonalizado || ''
      }))

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
          filasSaberes: filasSeleccionadas,
          temasPorSemana: temasPorSemana
        })
      })

      const data = await res.json()
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error desconocido en el servidor al generar la planificación.')
      }

      if (data.tituloSia || data.descripcionSia || data.asignaturasConexion) {
        setForm(prev => ({
          ...prev,
          tituloSia: data.tituloSia || prev.tituloSia,
          descripcionSia: data.descripcionSia || prev.descripcionSia,
          asignaturasConexion: data.asignaturasConexion || prev.asignaturasConexion
        }))
      }

      if (data.semanas && Array.isArray(data.semanas)) {
        const semanasMapeadas = data.semanas.map((s: any, idx: number) => ({
          numero: s.numero,
          temaPersonalizado: semanas[idx]?.temaPersonalizado || s.temaPersonalizado || '',
          inicio: s.sugerenciasInicio || '',
          desarrollo: s.sugerenciasDesarrollo || '',
          cierre: s.sugerenciasCierre || '',
          recursos: s.recursos || 'Material concreto, soportes visuales, recursos digitales.',
          tecnica: s.tecnica || 'Observación sistemática',
          instrumento: s.instrumento || 'Rúbrica de evaluación / Lista de cotejo'
        }))
        setSemanas(semanasMapeadas)
        alert('✨ ¡Planificación integral generada con éxito con tus temas personalizados!')
      }
    } catch (e: any) {
      console.error('Error detallado:', e)
      alert('❌ Error al generar con IA: ' + e.message)
    } finally {
      setGenerandoIA(false)
    }
  }

  const guardarPlanificacion = async () => {
    if (gradosPermitidos.length > 0 && !gradosPermitidos.includes(gradoSeleccionado)) {
      alert('🚫 Error: No tienes una licencia activa para planificar en este grado.')
      return
    }
    if (asignaturasPermitidas.length > 0 && !asignaturasPermitidas.includes(materiaSeleccionada)) {
      alert('🚫 Error: No tienes una licencia activa para esta asignatura.')
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
      doc.setTextColor(0, 0, 128)
      doc.text(`AÑO LECTIVO: ${institucion?.anio_lectivo_activo || '2026-2027'}`, pageWidth / 2, 30, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('EL NUEVO ECUADOR', pageWidth - 22, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('PLANIFICACIÓN MICROCURRICULAR', pageWidth / 2, 40, { align: 'center' })

      const compsTexto = bloquesCompetencias.map((b, i) => `[Bloque ${i+1}] ${b.competencia}`).join('\n')

      autoTable(doc, {
        startY: 43,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
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
        `Semana ${sem.numero}\n${sem.temaPersonalizado ? `Tema: ${sem.temaPersonalizado}` : ''}`,
        `• Sugerencias de Inicio:\n${sem.inicio}\n\n• Sugerencias de Desarrollo:\n${sem.desarrollo}\n\n• Sugerencias de Cierre:\n${sem.cierre}`,
        sem.recursos,
        `Técnica: ${sem.tecnica}\nInstrumento: ${sem.instrumento}`
      ])

      autoTable(doc, {
        startY: tableSemanasY,
        theme: 'grid',
        head: [['Semana / Tema', 'Estrategias metodológicas desde el DUA', 'Recursos', 'Técnicas e instrumentos de evaluación']],
        body: bodySemanas,
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
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
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; background-color: #f3f4f6;">
            Semana ${sem.numero}
            ${sem.temaPersonalizado ? `<br/><span style="color: #4f46e5; font-size: 8pt;">Tema: ${sem.temaPersonalizado}</span>` : ''}
          </td>
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
            h2 { text-align: center; color: #1e1b4b; font-size: 13pt; }
            h3 { background: #e0e7ff; padding: 6px; font-size: 10pt; color: #312e81; border-left: 4px solid #4f46e5; }
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
                  <th>Semana / Tema Específico</th>
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 relative">
      
      {generandoIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full mx-4 text-center space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl mx-auto flex items-center justify-center text-3xl animate-bounce">
              ✨
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-slate-800 text-base uppercase tracking-wide">
                Generando Planificación
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Estamos generando tu planificación con inteligencia artificial, esto tomará de 1 a 2 minutos. Por favor, espera...
              </p>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full animate-[indeterminate_1.5s_infinite_linear]" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* ENCABEZADO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-black text-slate-800 text-sm uppercase tracking-wide">
            {planId ? 'Editando Planificación Microcurricular' : 'Nueva Planificación Microcurricular Piloto'}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Matriz de competencias y saberes modulares desde la base de datos oficial.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={guardarPlanificacion}
            disabled={guardando}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl shadow transition cursor-pointer"
          >
            {guardando ? 'Guardando...' : '💾 Guardar Planificación'}
          </button>
          <button
            onClick={generarPDFPlanificacion}
            disabled={generandoPdf}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase rounded-xl shadow transition cursor-pointer"
          >
            {generandoPdf ? 'Generando PDF...' : '📋 PDF'}
          </button>
          <button
            onClick={generarWordPlanificacion}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl shadow transition cursor-pointer"
          >
            📄 Word
          </button>
        </div>
      </div>

      {/* DATOS INFORMATIVOS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide border-b pb-2">
          Datos Informativos (Plan Piloto Oficial)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-500 uppercase mb-1">Docente:</label>
            <input 
              type="text" 
              disabled 
              value={`${docente?.nombres || ''} ${docente?.apellidos || ''}`} 
              className="w-full p-3 border rounded-xl bg-slate-100 text-slate-900 font-bold" 
            />
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase mb-1">Subnivel Educativo:</label>
            <select 
              value={subnivel} 
              onChange={e => handleSubnivelChange(e.target.value)} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {subnivelesDisponibles.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase mb-1">Grado / Curso / Año:</label>
            <select 
              value={gradoSeleccionado} 
              onChange={e => setGradoSeleccionado(e.target.value)} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {gradosVisibles.length > 0 ? (
                gradosVisibles.map((anio, idx) => (
                  <option key={idx} value={anio}>{anio}</option>
                ))
              ) : (
                <option value="" disabled>🚫 Sin grados autorizados</option>
              )}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase mb-1">Asignatura:</label>
            <select 
              value={materiaSeleccionada} 
              onChange={e => setMateriaSeleccionada(e.target.value)} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {materiasVisibles.length > 0 ? (
                materiasVisibles.map((asig: string, idx: number) => (
                  <option key={idx} value={asig}>{asig}</option>
                ))
              ) : (
                <option value="" disabled>Sin asignaturas autorizadas</option>
              )}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase mb-1">Paralelo:</label>
            <input 
              type="text" 
              value={paraleloSeleccionado} 
              onChange={e => setParaleloSeleccionado(e.target.value)} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-bold outline-none" 
            />
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase mb-1">Trimestre:</label>
            <select 
              value={form.trimestre} 
              onChange={e => setForm({...form, trimestre: e.target.value})} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-bold outline-none"
            >
              <option value="Trimestre 1">Trimestre 1</option>
              <option value="Trimestre 2">Trimestre 2</option>
              <option value="Trimestre 3">Trimestre 3</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-indigo-700 uppercase mb-1">No. de Semanas (Dinámico):</label>
            <input 
              type="number" 
              min="1" 
              max="12" 
              value={form.noSemanas} 
              onChange={e => handleNoSemanasChange(e.target.value)} 
              className="w-full p-3 border-2 border-indigo-200 rounded-xl bg-indigo-50/40 text-indigo-900 font-black outline-none focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
        </div>
      </div>

      {/* MATRIZ DE COMPETENCIAS ESPECIFICAS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b pb-4 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
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
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs uppercase rounded-xl transition border border-indigo-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              + Agregar Bloque de Competencia
            </button>
            <button
              onClick={analizarEstructuraTematicaIA}
              disabled={generandoIA}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              Analizar y Estructurar Temas con IA
            </button>
            <button
              onClick={generarSecuenciaDUAIa}
              disabled={generandoIA}
              className={`px-4 py-2.5 bg-purple-600 text-white font-bold text-xs uppercase rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer ${
                generandoIA ? 'opacity-80 scale-[0.98] shadow-inner cursor-wait animate-pulse bg-purple-800' : 'hover:bg-purple-700'
              }`}
            >
              {generandoIA ? `⏳ Generando ${form.noSemanas} Semanas con IA...` : `Generar Secuencia (${form.noSemanas} Semanas) con IA`}
            </button>
          </div>
        </div>

        {estructuraTematica.length > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
            <h4 className="font-bold text-blue-900 text-xs uppercase">Estructura Temática Secuencial (Análisis IA):</h4>
            <div className="space-y-2 text-xs text-slate-800">
              {estructuraTematica.map((t, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-blue-100 space-y-1">
                  <div className="font-bold text-indigo-700">{t.orden}</div>
                  <div className="text-slate-600 italic">{t.subtitulo}</div>
                  <div className="font-semibold text-slate-700 mt-1">Indicadores:</div>
                  <pre className="whitespace-pre-wrap font-sans text-slate-600">{t.indicadores}</pre>
                  <div className="font-semibold text-slate-700 mt-1">Saberes Integrados:</div>
                  <pre className="whitespace-pre-wrap font-sans text-blue-900">
                    {`• Conceptual:\n${t.conceptual}\n• Procedimental:\n${t.procedimental}\n• Actitudinal:\n${t.actitudinal}`}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {bloquesCompetencias.map((bloque, index) => (
            <div key={bloque.id} className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 relative space-y-4 shadow-xs">
              
              <div className="flex justify-between items-center border-b border-indigo-100 pb-3 flex-wrap gap-2">
                <span className="font-bold text-xs text-indigo-700 uppercase">
                  Fila / Competencia {index + 1}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => agregarSubFilaSaber(bloque.id)}
                    disabled={generandoIA}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    + Agregar fila de indicador y saberes
                  </button>

                  {bloquesCompetencias.length > 1 && (
                    <button 
                      onClick={() => eliminarBloqueCompetencia(bloque.id)} 
                      disabled={generandoIA}
                      className="text-red-600 font-bold text-xs hover:underline ml-2 cursor-pointer"
                    >
                      Eliminar Bloque
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-indigo-900 text-xs uppercase">Competencia Específica de esta Fila:</label>
                <select
                  value={bloque.competencia}
                  onChange={e => actualizarBloqueCompetencia(bloque.id, e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white text-slate-900 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {competenciasDisponibles.map((comp, idx) => (
                    <option key={idx} value={comp}>{comp}</option>
                  ))}
                </select>
                <textarea 
                  rows={2} 
                  value={bloque.competencia} 
                  onChange={e => {
                    const val = e.target.value
                    setBloquesCompetencias(bloquesCompetencias.map(b => b.id === bloque.id ? { ...b, competencia: val } : b))
                  }} 
                  className="w-full p-2 border rounded-lg bg-white text-slate-900 text-xs font-medium outline-none mt-1" 
                />
              </div>

              {/* INTERRUPTOR DE SELECCIÓN 1 A 1 */}
              <div className="flex items-center gap-3 py-2 px-3 bg-white border border-indigo-100 rounded-xl shadow-2xs">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={bloque.activar1a1} 
                    onChange={() => toggleActivar1a1(bloque.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
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
                    <div key={subFila.id} className="p-4 rounded-xl border border-slate-200 bg-white relative space-y-3 shadow-2xs">
                      
                      {bloque.filasSaberes.length > 1 && (
                        <div className="flex justify-end">
                          <button 
                            onClick={() => eliminarSubFilaSaber(bloque.id, subFila.id)}
                            className="text-red-500 font-bold text-[10px] uppercase hover:underline cursor-pointer"
                          >
                            ✕ Quitar esta fila
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                        
                        {/* INDICADOR */}
                        <div className="space-y-1">
                          <label className="block font-bold text-slate-600 uppercase">Indicador:</label>
                          {bloque.activar1a1 ? (
                            <select
                              onChange={e => {
                                handleSeleccionarItem1a1(bloque.id, subFila.id, 'indicador', e.target.value)
                                e.target.value = ""
                              }}
                              className="w-full p-2 border rounded-lg bg-indigo-50 text-indigo-900 font-bold text-[11px] outline-none cursor-pointer"
                            >
                              <option value="">+ Añadir indicador ítem por ítem...</option>
                              {bloque.indicadoresDisponibles?.map((ind, i) => (
                                <option key={i} value={ind}>{ind}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'indicador', e.target.value)}
                              className="w-full p-2 border rounded-lg bg-indigo-50 text-indigo-900 font-bold text-[11px] outline-none cursor-pointer"
                            >
                              <option value="">-- Seleccionar individual --</option>
                              {bloque.indicadoresDisponibles?.map((ind, i) => (
                                <option key={i} value={ind}>{ind}</option>
                              ))}
                            </select>
                          )}
                          <textarea 
                            rows={3} 
                            value={subFila.indicador} 
                            onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'indicador', e.target.value)} 
                            className="w-full p-2 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                          />
                        </div>

                        {/* DECLARATIVO */}
                        <div className="space-y-1">
                          <label className="block font-bold text-blue-900 uppercase">Declarativo:</label>
                          {bloque.activar1a1 ? (
                            <select
                              onChange={e => {
                                handleSeleccionarItem1a1(bloque.id, subFila.id, 'declarativo', e.target.value)
                                e.target.value = ""
                              }}
                              className="w-full p-2 border rounded-lg bg-blue-50 text-blue-900 font-bold text-[11px] outline-none cursor-pointer"
                            >
                              <option value="">+ Añadir declarativo ítem por ítem...</option>
                              {declarativosDisponiblesFila.map((dec, i) => (
                                <option key={i} value={dec}>{dec}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'declarativo', e.target.value)}
                              className="w-full p-2 border rounded-lg bg-blue-50 text-blue-900 font-bold text-[11px] outline-none cursor-pointer"
                            >
                              <option value="">-- Seleccionar individual --</option>
                              {bloque.declarativosDisponibles?.map((dec, i) => (
                                <option key={i} value={dec}>{dec}</option>
                              ))}
                            </select>
                          )}
                          <textarea 
                            rows={3} 
                            value={subFila.declarativo} 
                            onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'declarativo', e.target.value)} 
                            className="w-full p-2 border rounded-lg bg-blue-50/40 text-slate-900 font-medium outline-none" 
                          />
                        </div>

                        {/* PROCEDIMENTAL */}
                        <div className="space-y-1">
                          <label className="block font-bold text-emerald-900 uppercase">Procedimental:</label>
                          {bloque.activar1a1 ? (
                            <select
                              onChange={e => {
                                handleSeleccionarItem1a1(bloque.id, subFila.id, 'procedimental', e.target.value)
                                e.target.value = ""
                              }}
                              className="w-full p-2 border rounded-lg bg-emerald-50 text-emerald-900 font-bold text-[11px] outline-none cursor-pointer"
                            >
                              <option value="">+ Añadir procedimental ítem por ítem...</option>
                              {procedimentalesDisponiblesFila.map((proc, i) => (
                                <option key={i} value={proc}>{proc}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'procedimental', e.target.value)}
                              className="w-full p-2 border rounded-lg bg-emerald-50 text-emerald-900 font-bold text-[11px] outline-none cursor-pointer"
                            >
                              <option value="">-- Seleccionar individual --</option>
                              {bloque.procedimentalesDisponibles?.map((proc, i) => (
                                <option key={i} value={proc}>{proc}</option>
                              ))}
                            </select>
                          )}
                          <textarea 
                            rows={3} 
                            value={subFila.procedimental} 
                            onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'procedimental', e.target.value)} 
                            className="w-full p-2 border rounded-lg bg-emerald-50/40 text-slate-900 font-medium outline-none" 
                          />
                        </div>

                        {/* ACTITUDINAL */}
                        <div className="space-y-1">
                          <label className="block font-bold text-amber-900 uppercase">Actitudinal:</label>
                          {bloque.activar1a1 ? (
                            <select
                              onChange={e => {
                                handleSeleccionarItem1a1(bloque.id, subFila.id, 'actitudinal', e.target.value)
                                e.target.value = ""
                              }}
                              className="w-full p-2 border rounded-lg bg-amber-50 text-amber-900 font-bold text-[11px] outline-none cursor-pointer"
                            >
                              <option value="">+ Añadir actitudinal ítem por ítem...</option>
                              {actitudinalesDisponiblesFila.map((act, i) => (
                                <option key={i} value={act}>{act}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'actitudinal', e.target.value)}
                              className="w-full p-2 border rounded-lg bg-amber-50 text-amber-900 font-bold text-[11px] outline-none cursor-pointer"
                            >
                              <option value="">-- Seleccionar individual --</option>
                              {bloque.actitudinalesDisponibles?.map((act, i) => (
                                <option key={i} value={act}>{act}</option>
                              ))}
                            </select>
                          )}
                          <textarea 
                            rows={3} 
                            value={subFila.actitudinal} 
                            onChange={e => handleSubFilaChange(bloque.id, subFila.id, 'actitudinal', e.target.value)} 
                            className="w-full p-2 border rounded-lg bg-amber-50/40 text-slate-900 font-medium outline-none" 
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
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b pb-2">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
            Situación de Aprendizaje (SIA) & Conexión Interdisciplinar
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Título de la SIA:</label>
            <input 
              type="text" 
              value={form.tituloSia} 
              onChange={e => setForm({...form, tituloSia: e.target.value})} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-medium outline-none" 
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Asignaturas en Conexión:</label>
            <textarea 
              rows={3} 
              value={form.asignaturasConexion} 
              onChange={e => setForm({...form, asignaturasConexion: e.target.value})} 
              className="w-full p-2.5 border rounded-xl bg-slate-50 text-slate-900 font-medium outline-none leading-relaxed" 
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 uppercase mb-1">Descripción de la SIA:</label>
            <textarea 
              rows={3} 
              value={form.descripcionSia} 
              onChange={e => setForm({...form, descripcionSia: e.target.value})} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-medium outline-none" 
            />
          </div>
        </div>
      </div>

      {/* SECUENCIA METODOLÓGICA SEMANAL CON TEMA PERSONALIZADO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide border-b pb-2">
          Estrategias Metodológicas DUA ({semanas.length} Semanas Configuradas con Temas Personalizados)
        </h3>

        <div className="space-y-6">
          {semanas.map((sem, idx) => (
            <div key={sem.numero} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h4 className="font-black text-xs text-indigo-700 uppercase">Semana {sem.numero}</h4>
              </div>

              {/* TEMA PERSONALIZADO POR SEMANA */}
              <div>
                <label className="block font-bold text-indigo-900 uppercase mb-1 text-[11px]">
                  📌 Tema Específico a impartir en esta Semana:
                </label>
                <input 
                  type="text"
                  placeholder="Ej: Resolución de ecuaciones de primer grado con denominadores..."
                  value={sem.temaPersonalizado}
                  onChange={e => handleSemanaChange(idx, 'temaPersonalizado', e.target.value)}
                  className="w-full p-3 border-2 border-indigo-200 rounded-xl bg-white text-indigo-950 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">[Principio DUA: Compromiso / Motivación]:</label>
                  <textarea 
                    rows={4} 
                    value={sem.inicio} 
                    onChange={e => handleSemanaChange(idx, 'inicio', e.target.value)} 
                    className="w-full p-2.5 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">[Principio DUA: Representación]:</label>
                  <textarea 
                    rows={4} 
                    value={sem.desarrollo} 
                    onChange={e => handleSemanaChange(idx, 'desarrollo', e.target.value)} 
                    className="w-full p-2.5 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">[Principio DUA: Acción y Expresión]:</label>
                  <textarea 
                    rows={4} 
                    value={sem.cierre} 
                    onChange={e => handleSemanaChange(idx, 'cierre', e.target.value)} 
                    className="w-full p-2.5 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2 border-t">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Recursos:</label>
                  <input 
                    type="text" 
                    value={sem.recursos} 
                    onChange={e => handleSemanaChange(idx, 'recursos', e.target.value)} 
                    className="w-full p-2.5 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Técnica:</label>
                  <input 
                    type="text" 
                    value={sem.tecnica} 
                    onChange={e => handleSemanaChange(idx, 'tecnica', e.target.value)} 
                    className="w-full p-2.5 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Instrumento:</label>
                  <input 
                    type="text" 
                    value={sem.instrumento} 
                    onChange={e => handleSemanaChange(idx, 'instrumento', e.target.value)} 
                    className="w-full p-3 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
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