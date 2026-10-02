'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

  // VALIDACIÓN DE LÍMITE DIARIO DE 5 USOS EXITOSOS DE IA
  const verificarCuotaIA = async () => {
    const hoy = new Date().toISOString().split('T')[0]
    const { count, error } = await supabase
      .from('planificaciones_microcurriculares')
      .select('*', { count: 'exact', head: true })
      .eq('docente_id', docente?.id)
      .gte('created_at', `${hoy}T00:00:00`)

    if (error) {
      console.error('Error al verificar cuota:', error)
      return true
    }

    if ((count || 0) >= 5) {
      alert('⚠️ Has alcanzado el límite diario de 5 generaciones exitosas con Inteligencia Artificial. Tu cupo se renovará mañana.')
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
      alert('❌ La IA falló y no se ha descontado de tu límite diario. Detalle: ' + e.message)
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
      alert('❌ La IA falló y no se ha descontado de tu límite diario. Detalle: ' + e.message)
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
      doc.setTextColor(75, 76, 153)
      doc.text(`AÑO LECTIVO: ${institucion?.anio_lectivo_activo || '2026-2027'}`, pageWidth / 2, 35, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.text('PLANIFICACIÓN MICROCURRICULAR - INICIAL Y PREPARATORIA', pageWidth / 2, 48, { align: 'center' })

      const compsTexto = bloquesCompetencias.map((b, i) => `[Bloque ${i+1}] ${b.competencia}`).join('\n')

      autoTable(doc, {
        startY: 52,
        theme: 'grid',
        headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
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
        headStyles: { fillColor: [75, 76, 153], fontSize: 8 },
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
    <div className="space-y-6 max-w-6xl mx-auto pb-12 relative font-sans selection:bg-[#4b4c99] selection:text-white">
      
      {generandoIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full mx-4 text-center space-y-4">
            <div className="w-14 h-14 bg-indigo-50 text-[#4b4c99] rounded-2xl mx-auto flex items-center justify-center text-2xl font-black">
              ✨
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                Generando Experiencia con IA
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Estructurando experiencias de aprendizaje lúdicas y adaptadas para Inicial y Preparatoria...
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
            Módulo Inicial y Preparatoria
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {planId ? 'Editando Planificación Inicial / Preparatoria' : 'Planificación Microcurricular - Inicial & Preparatoria'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Formato oficial basado en Ámbitos de Desarrollo y Aprendizaje.
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
            style={{ backgroundColor: '#4b4c99' }}
            className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {generandoPdf ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      {/* DATOS INFORMATIVOS */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-3">
          Datos Informativos
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
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
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Grado / Nivel:</label>
            <select 
              value={gradoSeleccionado} 
              onChange={e => handleGradoChange(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              {gradosDisponiblesParaDocente.length > 0 ? (
                gradosDisponiblesParaDocente.map((g, idx) => (
                  <option key={idx} value={g} className="text-slate-900 font-bold bg-white">{g}</option>
                ))
              ) : (
                <option value="" disabled className="text-slate-500 font-bold bg-white">Sin grados autorizados</option>
              )}
            </select>
            {gradosPermitidos.length > 0 && (
              <span className="text-[10px] text-[#4b4c99] font-bold mt-1 block">Filtrado por licencia comercial</span>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Ámbitos de Desarrollo y Aprendizaje:</label>
            <select 
              value={ambitoSeleccionado} 
              onChange={e => setAmbitoSeleccionado(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              {(() => {
                const ambitosDelGrado = ambitosPorGrado[gradoSeleccionado] || []
                const ambitosVisibles = asignaturasPermitidas.length > 0
                  ? ambitosDelGrado.filter(a => asignaturasPermitidas.includes(a))
                  : ambitosDelGrado

                return ambitosVisibles.length > 0 ? (
                  ambitosVisibles.map((amb: string, idx: number) => (
                    <option key={idx} value={amb} className="text-slate-900 font-bold bg-white">{amb}</option>
                  ))
                ) : (
                  <option value="" disabled className="text-slate-500 font-bold bg-white">Sin ámbitos autorizados para este grado</option>
                )
              })()}
            </select>
            {asignaturasPermitidas.length > 0 && (
              <span className="text-[10px] text-[#4b4c99] font-bold mt-1 block">Filtrado por licencia comercial</span>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo:</label>
            <input 
              type="text" 
              value={paraleloSeleccionado} 
              onChange={e => setParaleloSeleccionado(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Trimestre:</label>
            <select 
              value={form.trimestre} 
              onChange={e => setForm({...form, trimestre: e.target.value})} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
            >
              <option value="Trimestre 1" className="text-slate-900 font-bold bg-white">Trimestre 1</option>
              <option value="Trimestre 2" className="text-slate-900 font-bold bg-white">Trimestre 2</option>
              <option value="Trimestre 3" className="text-slate-900 font-bold bg-white">Trimestre 3</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">No. de niñas y niños:</label>
            <input 
              type="text" 
              value={form.noNinos} 
              onChange={e => setForm({...form, noNinos: e.target.value})} 
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
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

      {/* MATRIZ DE COMPETENCIAS Y SABERES */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-4 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
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
              {generandoIA ? `Generando ${form.noSemanas} Semanas...` : `Generar Experiencia (${form.noSemanas} Semanas)`}
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
                <span className="font-bold text-xs text-slate-800 uppercase">Bloque {index + 1}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => agregarSubFilaSaber(bloque.id)}
                    disabled={generandoIA}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] uppercase rounded-xl transition cursor-pointer"
                  >
                    + Agregar fila de saberes
                  </button>
                  {bloquesCompetencias.length > 1 && (
                    <button onClick={() => eliminarBloqueCompetencia(bloque.id)} disabled={generandoIA} className="text-rose-600 font-bold text-xs hover:underline cursor-pointer">
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Competencia Específica / Destreza:</label>
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
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none mt-1 shadow-2xs" 
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
                    <div key={subFila.id} className="p-4 rounded-2xl border border-slate-200 bg-white relative space-y-3 shadow-2xs">
                      {bloque.filasSaberes.length > 1 && (
                        <div className="flex justify-end">
                          <button onClick={() => eliminarSubFilaSaber(bloque.id, subFila.id)} className="text-rose-600 font-bold text-[10px] uppercase hover:underline cursor-pointer">
                            Quitar fila
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 text-xs">
                        
                        {/* Indicador (#4b4c99) */}
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

                        {/* Declarativo (#f6c358) */}
                        <div className="space-y-1.5 p-3 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs">
                          <label style={{ color: '#b45309' }} className="block font-black uppercase text-[11px]">Declarativos:</label>
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
                              {declarativosDisponiblesFila.map((dec, i) => (
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

                        {/* Procedimental (#45b3a5) */}
                        <div className="space-y-1.5 p-3 rounded-2xl border border-teal-200 bg-teal-50/20 shadow-2xs">
                          <label style={{ color: '#115e59' }} className="block font-black uppercase text-[11px]">Procedimentales:</label>
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
                              {procedimentalesDisponiblesFila.map((proc, i) => (
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

                        {/* Actitudinal (#de5860) */}
                        <div className="space-y-1.5 p-3 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-2xs">
                          <label style={{ color: '#de5860' }} className="block font-black uppercase text-[11px]">Actitudinales:</label>
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
                              {actitudinalesDisponiblesFila.map((act, i) => (
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

      {/* SITUACIÓN DE APRENDIZAJE */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
            Situación de Aprendizaje
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Título:</label>
            <input 
              type="text" 
              value={form.tituloSia} 
              onChange={e => setForm({...form, tituloSia: e.target.value})} 
              placeholder="Ej: Mis amigos los animales..."
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
          </div>
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Ámbitos de desarrollo y aprendizaje en conexión:</label>
            <textarea 
              rows={3} 
              value={form.asignaturasConexion} 
              onChange={e => setForm({...form, asignaturasConexion: e.target.value})} 
              placeholder="• Identidad y Autonomía&#10;• Convivencia"
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Descripción:</label>
            <textarea 
              rows={3} 
              value={form.descripcionSia} 
              onChange={e => setForm({...form, descripcionSia: e.target.value})} 
              placeholder="Describa el escenario de aprendizaje lúdico..."
              className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
            />
          </div>
        </div>
      </div>

      {/* DESARROLLO DE LA EXPERIENCIA DE APRENDIZAJE */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-3">
          Desarrolla de la experiencia de aprendizaje (Estrategias DUA en {semanas.length} Semanas)
        </h3>

        <div className="space-y-6">
          {semanas.map((sem, idx) => (
            <div key={sem.numero} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3 shadow-2xs">
              <h4 className="font-bold text-xs text-slate-900 uppercase">Semana {sem.numero}</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Experiencias de Inicio:</label>
                  <textarea 
                    rows={4} 
                    value={sem.inicio} 
                    onChange={e => handleSemanaChange(idx, 'inicio', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Experiencias de Desarrollo:</label>
                  <textarea 
                    rows={4} 
                    value={sem.desarrollo} 
                    onChange={e => handleSemanaChange(idx, 'desarrollo', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Experiencias de Cierre:</label>
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
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Técnicas:</label>
                  <input 
                    type="text" 
                    value={sem.tecnica} 
                    onChange={e => handleSemanaChange(idx, 'tecnica', e.target.value)} 
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:border-[#4b4c99] shadow-2xs" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Instrumentos:</label>
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