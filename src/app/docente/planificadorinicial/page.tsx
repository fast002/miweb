'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PlanificadorInicialPreparatoria() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('id')

  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)
  
  const [gradosPermitidos, setGradosPermitidos] = useState<string[]>([])
  const [asignaturasPermitidas, setAsignaturasPermitidas] = useState<string[]>([])

  const [gradoSeleccionado, setGradoSeleccionado] = useState('Preparatoria')
  const [ambitoSeleccionado, setAmbitoSeleccionado] = useState('Currículo Integrado Preparatoria')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('A')

  const ambitosPorGrado: Record<string, string[]> = {
    'Inicial 1': [
      'Currículo Integrado Inicial',
    ],
    'Inicial 2': [
      'Currículo Integrado Inicial',
    ],
    'Preparatoria': [
      'Currículo Integrado Preparatoria',
      'Educación Cultural y Artística (ECA)',
      'Educación Física',
    ]
  }

  const [registrosCurriculares, setRegistrosCurriculares] = useState<any[]>([])
  const [competenciasDisponibles, setCompetenciasDisponibles] = useState<string[]>([])
  const [cargandoCurriculo, setCargandoCurriculo] = useState(false)

  const [form, setForm] = useState({
    trimestre: 'Trimestre 1',
    noSemanas: '8',
    noNinos: '20',
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
      recursos: 'Material concreto, juguetes, recursos del entorno.',
      tecnica: 'Observación sistemática',
      instrumento: 'Lista de cotejo / Registro anecdótico'
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
          recursos: 'Material concreto, juguetes, recursos del entorno.',
          tecnica: 'Observación sistemática',
          instrumento: 'Lista de cotejo / Registro anecdótico'
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

  const gradosInicialPrepDisponibles = ['Inicial 1', 'Inicial 2', 'Preparatoria']

  const gradosDisponiblesParaDocente = gradosPermitidos.length > 0
    ? gradosInicialPrepDisponibles.filter(g => gradosPermitidos.includes(g))
    : gradosInicialPrepDisponibles

  const handleGradoChange = (nuevoGrado: string) => {
    setGradoSeleccionado(nuevoGrado)
    const ambitosDefault = ambitosPorGrado[nuevoGrado] || []
    if (ambitosDefault.length > 0) {
      const permitidasEnGrado = asignaturasPermitidas.filter(a => ambitosDefault.includes(a))
      if (permitidasEnGrado.length > 0) {
        setAmbitoSeleccionado(permitidasEnGrado[0])
      } else {
        setAmbitoSeleccionado(ambitosDefault[0])
      }
    }
  }

  useEffect(() => {
    cargarDatosDocente()
  }, [])

  useEffect(() => {
    if (gradoSeleccionado && ambitoSeleccionado) {
      cargarCurriculoDesdeBD()
    }
  }, [ambitoSeleccionado, gradoSeleccionado])

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
      
      const gradosAutorizados = doc.grados_asignados || []
      const asignaturasAutorizadas = doc.asignaturas_asignadas || []

      setGradosPermitidos(gradosAutorizados)
      setAsignaturasPermitidas(asignaturasAutorizadas)

      const gradosValidos = gradosInicialPrepDisponibles.filter(g => gradosAutorizados.includes(g))
      if (gradosValidos.length > 0 && !gradosValidos.includes(gradoSeleccionado)) {
        setGradoSeleccionado(gradosValidos[0])
      }
    }

    if (planId) {
      const { data: planData, error } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*')
        .eq('id', planId)
        .single()

      if (!error && planData) {
        setAmbitoSeleccionado(planData.asignatura || 'Currículo Integrado Preparatoria')
        setGradoSeleccionado(planData.grado_curso || 'Preparatoria')
        setParaleloSeleccionado(planData.paralelo || 'A')
        
        const semanasGuardadas = planData.semanas || []
        const totalSemanas = planData.no_semanas || (semanasGuardadas.length > 0 ? semanasGuardadas.length.toString() : '8')

        setForm({
          trimestre: planData.trimestre || 'Trimestre 1',
          noSemanas: totalSemanas,
          noNinos: planData.no_ninos || '20',
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
            inicio: '',
            desarrollo: '',
            cierre: '',
            recursos: 'Material concreto, juguetes, recursos del entorno.',
            tecnica: 'Observación sistemática',
            instrumento: 'Lista de cotejo / Registro anecdótico'
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
    setCargandoCurriculo(true)
    try {
      const { data, error } = await supabase
        .from('matriz_curricular_oficial')
        .select('*')
        .eq('asignatura', ambitoSeleccionado)
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
    } catch (e) {
      console.error('Error cargando currículo:', e)
    } finally {
      setCargandoCurriculo(false)
    }
  }

  const extraerYDesglosarItems = (registros: any[], campo: string) => {
    const itemsSeparados: string[] = []
    registros.forEach(reg => {
      const textoBruto = reg[campo]
      if (textoBruto) {
        const lineas = textoBruto.split(/\r?\n|•|- /).map((l: string) => l.trim()).filter((l: string) => l.length > 3)
        lineas.forEach((linea: string) => {
          if (!itemsSeparados.includes(linea)) {
            itemsSeparados.push(linea)
          }
        })
      }
    })
    return itemsSeparados
  }

  const actualizarBloqueCompetencia = (bloqueId: number, competenciaTexto: string, fuenteDatos = registrosCurriculares) => {
    const registrosDeCompetencia = fuenteDatos.filter(d => d.competencia === competenciaTexto)

    const bloqueActual = bloquesCompetencias.find(b => b.id === bloqueId)
    const es1a1 = bloqueActual?.activar1a1 || false

    const indUnicos = extraerYDesglosarItems(registrosDeCompetencia, 'indicador')
    const decUnicos = extraerYDesglosarItems(registrosDeCompetencia, 'declarativo')
    const procUnicos = extraerYDesglosarItems(registrosDeCompetencia, 'procedimental')
    const actUnicos = extraerYDesglosarItems(registrosDeCompetencia, 'actitudinal')

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
          indicadoresDisponibles: indUnicos,
          declarativosDisponibles: decUnicos,
          procedimentalesDisponibles: procUnicos,
          actitudinalesDisponibles: actUnicos,
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

  // 🤖 Función de análisis y estructuración de temas con IA
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
          asignatura: ambitoSeleccionado,
          subnivel: 'Educación Inicial y Preparatoria',
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

      const res = await fetch('/api/generar-plan', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoModelo: 'secuencia_copisi',
          asignatura: ambitoSeleccionado,
          subnivel: 'Educación Inicial y Preparatoria',
          grado: gradoSeleccionado,
          noSemanas: parseInt(form.noSemanas) || 8,
          competenciasPrincipales: compsPrincipales,
          filasSaberes: filasSeleccionadas
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

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
          recursos: s.recursos || 'Material concreto, juguetes, recursos lúdicos.',
          tecnica: s.tecnica || 'Observación sistemática',
          instrumento: s.instrumento || 'Lista de cotejo / Registro anecdótico'
        }))
        setSemanas(semanasMapeadas)
        alert('✨ ¡Experiencia de aprendizaje generada con éxito con IA!')
      }
    } catch (e: any) {
      alert('Error al conectar con la IA: ' + e.message)
    } finally {
      setGenerandoIA(false)
    }
  }

  const guardarPlanificacion = async () => {
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
        asignatura: ambitoSeleccionado,
        subnivel: 'Educación Inicial y Preparatoria',
        grado_curso: gradoSeleccionado,
        paralelo: paraleloSeleccionado,
        trimestre: form.trimestre,
        no_semanas: form.noSemanas,
        no_ninos: form.noNinos,
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

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

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
      doc.text('PLANIFICACIÓN MICROCURRICULAR - INICIAL Y PREPARATORIA', pageWidth / 2, 48, { align: 'center' })

      const compsTexto = bloquesCompetencias.map((b, i) => `[Bloque ${i+1}] ${b.competencia}`).join('\n')

      autoTable(doc, {
        startY: 52,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        body: [
          ['DATOS INFORMATIVOS', ''],
          [`Docente: ${docente?.nombres || ''} ${docente?.apellidos || ''}`, `Trimestre: ${form.trimestre}`],
          [`Nivel / Subnivel: Educación Inicial y Preparatoria`, `No. Semanas: ${form.noSemanas}`],
          [`Grado / Año: ${gradoSeleccionado}`, `No. de niñas y niños: ${form.noNinos}`],
          [`Paralelo: ${paraleloSeleccionado}`, `Ámbito: ${ambitoSeleccionado}`],
          ['SITUACIÓN DE APRENDIZAJE', ''],
          [`Título: ${form.tituloSia}`, `Descripción: ${form.descripcionSia}`],
          ['CONEXIONES CURRICULARES', ''],
          [`Ámbitos de desarrollo y aprendizaje:\n${form.asignaturasConexion}`, ''],
          ['COMPETENCIAS ESPECÍFICAS / DESTREZAS', ''],
          [compsTexto, '']
        ]
      })

      const todasLasFilas = bloquesCompetencias.flatMap(b => b.filasSaberes)
      const tableSaberesY = (doc as any).lastAutoTable.finalY + 4
      const bodySaberes = todasLasFilas.map(f => [
        f.indicador,
        f.declarativo,
        f.procedimental,
        f.actitudinal
      ])

      autoTable(doc, {
        startY: tableSaberesY,
        theme: 'grid',
        head: [['Indicadores de evaluación', 'Saberes Declarativos', 'Saberes Procedimentales', 'Saberes Actitudinales']],
        body: bodySaberes,
        headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
        styles: { fontSize: 8 }
      })

      const tableSemanasY = (doc as any).lastAutoTable.finalY + 4
      const bodySemanas = semanas.map((sem) => [
        `Semana ${sem.numero}`,
        `• Experiencia de Inicio: ${sem.inicio}\n• Experiencia de Desarrollo: ${sem.desarrollo}\n• Experiencia de Cierre: ${sem.cierre}`,
        sem.recursos,
        `Técnicas: ${sem.tecnica}\nInstrumentos: ${sem.instrumento}`
      ])

      autoTable(doc, {
        startY: tableSemanasY,
        theme: 'grid',
        head: [['Semana', 'Experiencias de aprendizaje y estrategias metodológicas DUA', 'Recursos', 'Evaluación']],
        body: bodySemanas,
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 }
      })

      doc.save(`Planificacion_Inicial_${gradoSeleccionado}_${ambitoSeleccionado}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans relative">
      
      {generandoIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full mx-4 text-center space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl mx-auto flex items-center justify-center text-3xl animate-bounce">
              ✨
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-slate-800 text-base uppercase tracking-wide">
                Generando Experiencia con IA
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Estructurando experiencias de aprendizaje lúdicas y adaptadas para Inicial y Preparatoria...
              </p>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full animate-[indeterminate_1.5s_infinite_linear]" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* ENCABEZADO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-black text-slate-800 text-sm uppercase tracking-wide">
            {planId ? 'Editando Planificación Inicial / Preparatoria' : 'Planificación Microcurricular - Inicial & Preparatoria'}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Formato oficial basado en Ámbitos de Desarrollo y Aprendizaje.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={guardarPlanificacion}
            disabled={guardando}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl shadow transition cursor-pointer"
          >
            {guardando ? 'Guardando...' : '💾 Guardar'}
          </button>
          <button
            onClick={generarPDFPlanificacion}
            disabled={generandoPdf}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase rounded-xl shadow transition cursor-pointer"
          >
            {generandoPdf ? 'Generando...' : '🖨️ PDF'}
          </button>
        </div>
      </div>

      {/* DATOS INFORMATIVOS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide border-b pb-2">
          Datos Informativos
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
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
            <label className="block font-bold text-slate-500 uppercase mb-1">Grado / Nivel:</label>
            <select 
              value={gradoSeleccionado} 
              onChange={e => handleGradoChange(e.target.value)} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {gradosDisponiblesParaDocente.length > 0 ? (
                gradosDisponiblesParaDocente.map((g, idx) => (
                  <option key={idx} value={g}>{g}</option>
                ))
              ) : (
                <option value="" disabled>Sin grados autorizados</option>
              )}
            </select>
            {gradosPermitidos.length > 0 && (
              <span className="text-[10px] text-indigo-600 font-bold mt-1 block">Filtrado por licencia comercial</span>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase mb-1">Ámbitos de Desarrollo y Aprendizaje:</label>
            <select 
              value={ambitoSeleccionado} 
              onChange={e => setAmbitoSeleccionado(e.target.value)} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(() => {
                const ambitosDelGrado = ambitosPorGrado[gradoSeleccionado] || []
                const ambitosVisibles = asignaturasPermitidas.length > 0
                  ? ambitosDelGrado.filter(a => asignaturasPermitidas.includes(a))
                  : ambitosDelGrado

                return ambitosVisibles.length > 0 ? (
                  ambitosVisibles.map((amb: string, idx: number) => (
                    <option key={idx} value={amb}>{amb}</option>
                  ))
                ) : (
                  <option value="" disabled>🚫 Sin ámbitos autorizados para este grado</option>
                )
              })()}
            </select>
            {asignaturasPermitidas.length > 0 && (
              <span className="text-[10px] text-purple-600 font-bold mt-1 block">Filtrado por licencia comercial</span>
            )}
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
            <label className="block font-bold text-slate-500 uppercase mb-1">No. de niñas y niños:</label>
            <input 
              type="text" 
              value={form.noNinos} 
              onChange={e => setForm({...form, noNinos: e.target.value})} 
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-bold outline-none" 
            />
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

      {/* MATRIZ DE COMPETENCIAS Y SABERES (CON BOTÓN DE ANÁLISIS IA & SOPORTE 1 A 1) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b pb-4 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
              Matriz de Competencias y Saberes
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Selecciona las destrezas, indicadores y saberes desde la base de datos oficial.
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap items-center">
            <button
              onClick={agregarBloqueCompetencia}
              disabled={generandoIA}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs uppercase rounded-xl transition border border-indigo-200 cursor-pointer"
            >
              + Agregar Bloque
            </button>
            <button
              onClick={analizarEstructuraTematicaIA}
              disabled={generandoIA}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              🤖 Analizar y Estructurar Temas con IA
            </button>
            <button
              onClick={generarSecuenciaDUAIa}
              disabled={generandoIA}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase rounded-xl shadow transition cursor-pointer"
            >
              {generandoIA ? `⏳ Generando ${form.noSemanas} Semanas...` : `✨ Generar Experiencia (${form.noSemanas} Semanas) con IA`}
            </button>
          </div>
        </div>

        {estructuraTematica.length > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
            <h4 className="font-bold text-blue-900 text-xs uppercase">📊 Estructura Temática Secuencial (Análisis IA):</h4>
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
            <div key={bloque.id} className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 relative space-y-4">
              
              <div className="flex justify-between items-center border-b border-indigo-100 pb-3 flex-wrap gap-2">
                <span className="font-bold text-xs text-indigo-700 uppercase">Bloque {index + 1}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => agregarSubFilaSaber(bloque.id)}
                    className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-[11px] uppercase rounded-lg cursor-pointer"
                  >
                    + Agregar fila de saberes
                  </button>
                  {bloquesCompetencias.length > 1 && (
                    <button onClick={() => eliminarBloqueCompetencia(bloque.id)} className="text-red-600 font-bold text-xs cursor-pointer">
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-indigo-900 text-xs uppercase">Competencia Específica / Destreza:</label>
                <select
                  value={bloque.competencia}
                  onChange={e => actualizarBloqueCompetencia(bloque.id, e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white text-slate-900 text-xs font-bold outline-none"
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

              {/* 🎛️ INTERRUPTOR DE SELECCIÓN 1 A 1 */}
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
                {bloque.filasSaberes.map((subFila) => {
                  const regAsociados = registrosCurriculares.filter(d => {
                    if (!subFila.indicador) return true;
                    return d.indicador && d.indicador.toLowerCase().includes(subFila.indicador.toLowerCase().substring(0, 20));
                  });

                  const declarativosDisponiblesFila = regAsociados.length > 0 
                    ? extraerYDesglosarItems(regAsociados, 'declarativo')
                    : bloque.declarativosDisponibles;

                  const procedimentalesDisponiblesFila = regAsociados.length > 0 
                    ? extraerYDesglosarItems(regAsociados, 'procedimental')
                    : bloque.procedimentalesDisponibles;

                  const actitudinalesDisponiblesFila = regAsociados.length > 0 
                    ? extraerYDesglosarItems(regAsociados, 'actitudinal')
                    : bloque.actitudinalesDisponibles;

                  return (
                    <div key={subFila.id} className="p-4 rounded-xl border border-slate-200 bg-white relative space-y-3">
                      {bloque.filasSaberes.length > 1 && (
                        <div className="flex justify-end">
                          <button onClick={() => eliminarSubFilaSaber(bloque.id, subFila.id)} className="text-red-500 font-bold text-[10px] uppercase cursor-pointer">
                            ✕ Quitar fila
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                        
                        {/* Indicador */}
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
                              <option value="">-- Seleccionar --</option>
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

                        {/* Declarativo */}
                        <div className="space-y-1">
                          <label className="block font-bold text-blue-900 uppercase">Declarativos:</label>
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
                              <option value="">-- Seleccionar --</option>
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

                        {/* Procedimental */}
                        <div className="space-y-1">
                          <label className="block font-bold text-emerald-900 uppercase">Procedimentales:</label>
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
                              <option value="">-- Seleccionar --</option>
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

                        {/* Actitudinal */}
                        <div className="space-y-1">
                          <label className="block font-bold text-amber-900 uppercase">Actitudinales:</label>
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
                              <option value="">-- Seleccionar --</option>
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

      {/* SITUACIÓN DE APRENDIZAJE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide border-b pb-2">
          Situación de Aprendizaje
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Título:</label>
            <input 
              type="text" 
              value={form.tituloSia} 
              onChange={e => setForm({...form, tituloSia: e.target.value})} 
              placeholder="Ej: Mis amigos los animales..."
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-medium outline-none" 
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Ámbitos de desarrollo y aprendizaje en conexión:</label>
            <textarea 
              rows={3} 
              value={form.asignaturasConexion} 
              onChange={e => setForm({...form, asignaturasConexion: e.target.value})} 
              placeholder="• Identidad y Autonomía\n• Convivencia"
              className="w-full p-2.5 border rounded-xl bg-slate-50 text-slate-900 font-medium outline-none" 
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 uppercase mb-1">Descripción:</label>
            <textarea 
              rows={3} 
              value={form.descripcionSia} 
              onChange={e => setForm({...form, descripcionSia: e.target.value})} 
              placeholder="Describa el escenario de aprendizaje lúdico..."
              className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 font-medium outline-none" 
            />
          </div>
        </div>
      </div>

      {/* DESARROLLO DE LA EXPERIENCIA DE APRENDIZAJE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide border-b pb-2">
          Desarrolla de la experiencia de aprendizaje (Estrategias DUA en {semanas.length} Semanas)
        </h3>

        <div className="space-y-6">
          {semanas.map((sem, idx) => (
            <div key={sem.numero} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <h4 className="font-black text-xs text-indigo-700 uppercase">Semana {sem.numero}</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Experiencias de Inicio:</label>
                  <textarea 
                    rows={4} 
                    value={sem.inicio} 
                    onChange={e => handleSemanaChange(idx, 'inicio', e.target.value)} 
                    className="w-full p-2.5 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Experiencias de Desarrollo:</label>
                  <textarea 
                    rows={4} 
                    value={sem.desarrollo} 
                    onChange={e => handleSemanaChange(idx, 'desarrollo', e.target.value)} 
                    className="w-full p-2.5 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Experiencias de Cierre:</label>
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
                  <label className="block font-bold text-slate-600 uppercase mb-1">Técnicas:</label>
                  <input 
                    type="text" 
                    value={sem.tecnica} 
                    onChange={e => handleSemanaChange(idx, 'tecnica', e.target.value)} 
                    className="w-full p-2.5 border rounded-lg bg-white text-slate-900 font-medium outline-none" 
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Instrumentos:</label>
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