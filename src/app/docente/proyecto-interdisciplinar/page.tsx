'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface MatrizCurricularItem {
  id: string
  asignatura: string
  subnivel: string
  grado_curso: string
  competencia: string
  indicadores_disponibles?: string[]
  saberes_disponibles?: string[]
}

export default function NuevoProyectoInterdisciplinarPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [cargandoCompetencias, setCargandoCompetencias] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [pasoGeneracion, setPasoGeneracion] = useState(0)
  const [proyectoListo, setProyectoListo] = useState(false)
  const [rellenandoIa, setRellenandoIa] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [mounted, setMounted] = useState(false)

  // Control de cupo diario (Máximo 4 proyectos por día)
  const [proyectosHoy, setProyectosHoy] = useState(0)
  const LIMITE_DIARIO = 4

  // Mensajes dinámicos que cambian cada 2.5 segundos
  const mensajesProgreso = [
    'Iniciando articulación pedagógica curricular...',
    'Realizando cruce entre competencias, indicadores y saberes disciplinares...',
    'Estructurando las 5 fases metodológicas para cada materia...',
    'Diseñando situaciones de aprendizaje, preguntas orientadoras y recursos...',
    'Formulando instrumentos de evaluación sumativa (rúbricas analíticas)...'
  ]

  // Datos Institucionales y Docente
  const [docenteId, setDocenteId] = useState('')
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')

  // 1. Contexto del Proyecto
  const subnivelesOficiales = [
    'Educación Inicial',
    'Básica Elemental',
    'Básica Media',
    'Básica Superior',
    'Bachillerato'
  ]

  const gradosPorSubnivel: { [key: string]: string[] } = {
    'Educación Inicial': ['Inicial 3-4 años', 'Inicial 4-5 años'],
    'Básica Elemental': ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'],
    'Básica Media': ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'],
    'Básica Superior': ['8vo Grado EGB', '9no Grado EGB', '10mo Grado EGB'],
    'Bachillerato': ['1er Año Bachillerato', '2do Año Bachillerato', '3er Año Bachillerato']
  }

  const [subnivel, setSubnivel] = useState('Básica Superior')
  const [grado, setGrado] = useState('8vo Grado EGB')
  const [trimestre, setTrimestre] = useState('1')
  const [numeroSemanas, setNumeroSemanas] = useState(2)
  const [paralelo, setParalelo] = useState('A')

  // 2. Información del Proyecto
  const [titulo, setTitulo] = useState('')
  const [situacionAprendizaje, setSituacionAprendizaje] = useState('')
  const [desafio, setDesafio] = useState('')
  const [producto, setProducto] = useState('')

  // 3. Catálogo y Selección de Competencias
  const [catalogoCompetencias, setCatalogoCompetencias] = useState<MatrizCurricularItem[]>([])
  const [seleccionadasIds, setSeleccionadasIds] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')

  // 4. Selección 1 a 1 de Indicadores y Saberes
  const [mostrarDetalleCurricular, setMostrarDetalleCurricular] = useState(false)
  const [indicadoresSeleccionadosMap, setIndicadoresSeleccionadosMap] = useState<{ [compKey: string]: string[] }>({})
  const [saberesSeleccionadosMap, setSaberesSeleccionadosMap] = useState<{ [compKey: string]: string[] }>({})

  useEffect(() => {
    setMounted(true)
    cargarDatosDocente()
  }, [])

  // Temporizador para cambio de textos dinámicos
  useEffect(() => {
    let intervalo: any
    if (generando && !proyectoListo) {
      intervalo = setInterval(() => {
        setPasoGeneracion(prev => (prev < mensajesProgreso.length - 1 ? prev + 1 : prev))
      }, 2500)
    }
    return () => clearInterval(intervalo)
  }, [generando, proyectoListo, mensajesProgreso.length])

  // Sincronizar grados cuando cambia el subnivel
  useEffect(() => {
    const listaGrados = gradosPorSubnivel[subnivel] || []
    if (listaGrados.length > 0 && !listaGrados.includes(grado)) {
      setGrado(listaGrados[0])
    }
  }, [subnivel])

  // Cargar competencias filtrando por el año de básica (grado)
  useEffect(() => {
    if (grado) {
      cargarCompetenciasDesdeMatriz(subnivel, grado)
    }
  }, [subnivel, grado])

  // Contar proyectos interdisciplinares generados hoy
  const consultarConteoProyectosHoy = async (userId: string) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const inicioDiaISO = hoy.toISOString()

      const { count, error } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*', { count: 'exact', head: true })
        .eq('docente_id', userId)
        .eq('asignatura', 'PROYECTO INTERDISCIPLINAR')
        .gte('created_at', inicioDiaISO)

      if (!error && count !== null) {
        setProyectosHoy(count)
        return count
      }
    } catch (e) {
      console.error('Error al consultar cupo diario de proyectos:', e)
    }
    return 0
  }

  const cargarDatosDocente = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setDocenteId(user.id)

      await consultarConteoProyectosHoy(user.id)

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (doc) {
        setInstitucionId(doc.institucion_id || '')
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')

        const inst = doc.instituciones
        const periodos = inst?.periodos_disponibles || ['2026-2027']
        setPeriodosDisponibles(periodos)

        const activo = inst?.anio_lectivo_activo && periodos.includes(inst.anio_lectivo_activo)
          ? inst.anio_lectivo_activo
          : periodos[0] || '2026-2027'

        setAnioLectivoVigente(activo)
      }
    } catch (err) {
      console.error('Error al inicializar datos:', err)
    } finally {
      setCargando(false)
    }
  }

  const obtenerVariantesGrado = (gradoOriginal: string) => {
    const limpio = gradoOriginal.trim()
    const variantes = new Set<string>()
    variantes.add(limpio)

    if (limpio.includes('Grado EGB')) {
      variantes.add(limpio.replace('Grado EGB', 'EGB').trim())
      variantes.add(limpio.replace(' Grado EGB', '').trim())
    }
    if (limpio.includes('Año Bachillerato')) {
      variantes.add(limpio.replace('Año Bachillerato', 'BGU').trim())
      variantes.add(limpio.replace(' Año Bachillerato', '').trim())
    }

    return Array.from(variantes)
  }

  const generarElementosCurriculares = (asig: string, compTexto: string) => {
    const indList: string[] = []
    const sabList: string[] = []

    if (asig.includes('MATEMÁTICA')) {
      indList.push(`I.M. Resuelve problemas aplicando ${compTexto.substring(0, 50)}... en contextos cotidianos.`)
      indList.push(`I.M. Emplea modelos cuantitativos y estrategias de cálculo asociadas a la competencia.`)
      sabList.push(`Operaciones combinadas, proporcionalidad y ecuaciones aplicadas`)
      sabList.push(`Modelización matemática y resolución de problemas del entorno`)
    } else if (asig.includes('LENGUA')) {
      indList.push(`I.LL. Aplica los saberes lingüísticos y argumentativos para sustentar el producto interdisciplinar.`)
      indList.push(`I.LL. Produce textos coherentes orientados a comunicar los resultados del proyecto.`)
      sabList.push(`Tipologías textuales: textos expositivos, argumentativos y fichas técnicas`)
      sabList.push(`Comunicación asertiva, divulgación comunitaria y redacción formal`)
    } else if (asig.includes('CIENCIAS NATURALES') || asig.includes('BIOLOGÍA') || asig.includes('QUÍMICA')) {
      indList.push(`I.CN. Analiza y formula explicaciones científicas con base en ${compTexto.substring(0, 50)}...`)
      indList.push(`I.CN. Argumenta la importancia de la conservación y el desarrollo sostenible.`)
      sabList.push(`Dinámica de ecosistemas, recursos naturales y biomasa`)
      sabList.push(`Método científico, experimentación y sustentabilidad ambiental`)
    } else if (asig.includes('SOCIALES') || asig.includes('HISTORIA')) {
      indList.push(`I.CS. Reconoce las causas y consecuencias socio-históricas vinculadas al tema del proyecto.`)
      indList.push(`I.CS. Plantea compromisos ciudadanos y soluciones éticas para su comunidad.`)
      sabList.push(`Problemáticas socioambientales contemporáneas y participación comunitaria`)
      sabList.push(`Organización territorial, impacto humano y derechos sociales`)
    } else if (asig.includes('CULTURAL') || asig.includes('ARTÍSTICA') || asig.includes('ECA')) {
      indList.push(`I.ECA. Diseña y elabora prototipos visuales/artísticos integrando materiales del medio.`)
      indList.push(`I.ECA. Demuestra creatividad y estética en la presentación final del proyecto.`)
      sabList.push(`Creación plástica, montaje de stands y diseño funcional de maquetas`)
      sabList.push(`Expresión visual contemporánea y memoria artística comunitaria`)
    } else {
      indList.push(`Evalúa la aplicación práctica de la competencia en el producto final integrador.`)
      indList.push(`Demuestra dominio procedimental y conceptual en las actividades interdisciplinares.`)
      sabList.push(`Conceptos y aplicaciones esenciales de ${asig}`)
      sabList.push(`Trabajo colaborativo interdisciplinar y fundamentación técnica`)
    }

    return { indList, sabList }
  }

  const cargarCompetenciasDesdeMatriz = async (subnivelElegido: string, gradoElegido: string) => {
    setCargandoCompetencias(true)
    setSeleccionadasIds([])
    setIndicadoresSeleccionadosMap({})
    setSaberesSeleccionadosMap({})

    try {
      const variantes = obtenerVariantesGrado(gradoElegido)

      let { data, error } = await supabase
        .from('matriz_curricular_oficial')
        .select('*')
        .in('grado_curso', variantes)
        .order('asignatura', { ascending: true })

      if ((!data || data.length === 0) && !error) {
        const prefijo = gradoElegido.split(' ')[0]
        const resIlike = await supabase
          .from('matriz_curricular_oficial')
          .select('*')
          .ilike('grado_curso', `${prefijo}%`)
          .order('asignatura', { ascending: true })

        if (!resIlike.error && resIlike.data && resIlike.data.length > 0) {
          data = resIlike.data
        }
      }

      if (!error && data && data.length > 0) {
        const prefijoGrado = gradoElegido.split(' ')[0].toLowerCase()
        const filtradasEstrictas = data.filter((item: any) => {
          const gItem = (item.grado_curso || '').toLowerCase()
          return gItem.includes(prefijoGrado)
        })

        const listaFinal = filtradasEstrictas.length > 0 ? filtradasEstrictas : data

        const mapaUnicas = new Map<string, MatrizCurricularItem>()

        listaFinal.forEach((item: any) => {
          const asigNorm = (item.asignatura || '').trim().toUpperCase()
          const compTexto = (item.competencia || '').trim()

          if (!compTexto) return

          const clave = `${asigNorm}_${compTexto.toLowerCase()}`
          if (!mapaUnicas.has(clave)) {
            const bdInd = item.indicador || item.indicadores_evaluacion
            const bdSab = item.contenidos_saberes || item.contenido_saber || item.saberes

            const { indList, sabList } = generarElementosCurriculares(asigNorm, compTexto)

            mapaUnicas.set(clave, {
              id: item.id,
              asignatura: asigNorm,
              subnivel: item.subnivel || subnivelElegido,
              grado_curso: item.grado_curso || gradoElegido,
              competencia: compTexto,
              indicadores_disponibles: bdInd ? [bdInd, ...indList] : indList,
              saberes_disponibles: bdSab ? [bdSab, ...sabList] : sabList
            })
          }
        })

        setCatalogoCompetencias(Array.from(mapaUnicas.values()))
      } else {
        setCatalogoCompetencias([])
      }
    } catch (e) {
      console.error('Error cargando competencias de la matriz curricular:', e)
      setCatalogoCompetencias([])
    } finally {
      setCargandoCompetencias(false)
    }
  }

  const gruposFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    const filtrados = catalogoCompetencias.filter(c => {
      if (!q) return true
      return (
        c.asignatura.toLowerCase().includes(q) ||
        c.competencia.toLowerCase().includes(q)
      )
    })

    const agrupado: { [asig: string]: MatrizCurricularItem[] } = {}
    filtrados.forEach(item => {
      if (!agrupado[item.asignatura]) agrupado[item.asignatura] = []
      agrupado[item.asignatura].push(item)
    })
    return agrupado
  }, [catalogoCompetencias, busqueda])

  const toggleSeleccion = (item: MatrizCurricularItem) => {
    const id = item.id
    setSeleccionadasIds(prev => {
      const existe = prev.includes(id)
      if (existe) {
        setIndicadoresSeleccionadosMap(prevInd => {
          const copia = { ...prevInd }
          delete copia[id]
          return copia
        })
        setSaberesSeleccionadosMap(prevSab => {
          const copia = { ...prevSab }
          delete copia[id]
          return copia
        })
        return prev.filter(x => x !== id)
      } else {
        if (item.indicadores_disponibles && item.indicadores_disponibles.length > 0) {
          setIndicadoresSeleccionadosMap(prevInd => ({
            ...prevInd,
            [id]: [item.indicadores_disponibles![0]]
          }))
        }
        if (item.saberes_disponibles && item.saberes_disponibles.length > 0) {
          setSaberesSeleccionadosMap(prevSab => ({
            ...prevSab,
            [id]: [item.saberes_disponibles![0]]
          }))
        }
        return [...prev, id]
      }
    })
  }

  const removerSeleccion = (id: string) => {
    setSeleccionadasIds(prev => prev.filter(x => x !== id))
    setIndicadoresSeleccionadosMap(prevInd => {
      const copia = { ...prevInd }
      delete copia[id]
      return copia
    })
    setSaberesSeleccionadosMap(prevSab => {
      const copia = { ...prevSab }
      delete copia[id]
      return copia
    })
  }

  const toggleIndicadorDeCompetencia = (compId: string, textoIndicador: string) => {
    setIndicadoresSeleccionadosMap(prev => {
      const actuales = prev[compId] || []
      const existe = actuales.includes(textoIndicador)
      return {
        ...prev,
        [compId]: existe ? actuales.filter(i => i !== textoIndicador) : [...actuales, textoIndicador]
      }
    })
  }

  const toggleSaberDeCompetencia = (compId: string, textoSaber: string) => {
    setSaberesSeleccionadosMap(prev => {
      const actuales = prev[compId] || []
      const existe = actuales.includes(textoSaber)
      return {
        ...prev,
        [compId]: existe ? actuales.filter(s => s !== textoSaber) : [...actuales, textoSaber]
      }
    })
  }

  const competenciasElegidas = catalogoCompetencias.filter(c => seleccionadasIds.includes(c.id))
  const materiasInvolucradas = Array.from(new Set(competenciasElegidas.map(c => c.asignatura)))

  // Rellenar estructura básica con IA
  const handleRellenarEstructuraConIA = async () => {
    setRellenandoIa(true)
    setMensaje(null)

    try {
      const competenciasTextos = competenciasElegidas.map(c => `[${c.asignatura}] ${c.competencia}`)

      const res = await fetch('/api/generar-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'sugerir_estructura_proyecto',
          subnivel,
          grado_curso: grado,
          trimestre,
          numero_semanas: numeroSemanas,
          competencias_seleccionadas: competenciasTextos,
          materias_involucradas: materiasInvolucradas
        })
      })

      const data = await res.json()

      if (!res.ok || !data.titulo) {
        const nombreTema = materiasInvolucradas.length > 0 
          ? `Guardianes del Ecosistema: ${materiasInvolucradas.slice(0, 2).join(' y ')} para la Sostenibilidad`
          : `Innovación y Saberes para la Comunidad Educativa (${grado})`

        setTitulo(nombreTema)
        setSituacionAprendizaje(`En la comunidad educativa de ${grado}, los estudiantes abordan problemas reales integrando aprendizajes de ${materiasInvolucradas.join(', ') || 'las materias articuladas'}, aplicando rigor científico, creativo y cuantitativo.`)
        setDesafio(`¿Cómo podemos formular y construir una propuesta innovadora que responda a esta problemática en nuestra institución?`)
        setProducto(`Feria de proyectos con prototipo funcional, informe técnico y panel de divulgación comunitaria.`)
      } else {
        if (data.titulo) setTitulo(data.titulo)
        if (data.situacion_aprendizaje) setSituacionAprendizaje(data.situacion_aprendizaje)
        if (data.desafio) setDesafio(data.desafio)
        if (data.producto) setProducto(data.producto)
      }

      setMensaje({ tipo: 'exito', texto: '¡Estructura del proyecto generada con IA exitosamente!' })
    } catch (err: any) {
      setTitulo(`Proyecto Interdisciplinar Integrador de Saberes (${grado})`)
      setSituacionAprendizaje(`Los estudiantes de ${grado} abordan situaciones de su entorno integrando los saberes y competencias seleccionadas.`)
      setDesafio(`¿Cómo podemos solucionar de forma práctica este reto utilizando los contenidos aprendidos?`)
      setProducto(`Prototipo y panel interactivo de exposición multidisciplinar.`)
    } finally {
      setRellenandoIa(false)
    }
  }

  // Generar Proyecto Completo
  const handleGenerarProyecto = async (e: React.FormEvent) => {
    e.preventDefault()

    if (seleccionadasIds.length < 2 || materiasInvolucradas.length < 2) {
      setMensaje({
        tipo: 'error',
        texto: 'Un proyecto interdisciplinar requiere evaluar al menos 2 competencias provenientes de diferentes materias.'
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('No hay una sesión activa de docente.')
      return
    }

    // Verificación de límite diario (4 proyectos)
    const totalHoy = await consultarConteoProyectosHoy(user.id)
    if (totalHoy >= LIMITE_DIARIO) {
      alert(`⚠️ Has alcanzado el límite diario permitido (${LIMITE_DIARIO} proyectos por día).\n\nPodrás generar nuevos proyectos a partir de mañana.`)
      return
    }

    // Activar inmediatamente el modal
    setGenerando(true)
    setPasoGeneracion(0)
    setProyectoListo(false)
    setMensaje(null)

    try {
      const matrizDesglosada = competenciasElegidas.map(c => ({
        competencia_id: c.id,
        asignatura: c.asignatura,
        competencia: c.competencia,
        indicadores: indicadoresSeleccionadosMap[c.id] || c.indicadores_disponibles?.slice(0, 1) || [],
        saberes: saberesSeleccionadosMap[c.id] || c.saberes_disponibles?.slice(0, 1) || []
      }))

      const payload = {
        docente_id: docenteId,
        institucion_id: institucionId,
        anio_lectivo: anioLectivoVigente,
        subnivel,
        grado_curso: grado,
        paralelo,
        trimestre,
        numero_semanas: numeroSemanas,
        titulo: titulo.trim(),
        situacion_aprendizaje: situacionAprendizaje.trim(),
        desafio: desafio.trim(),
        producto: producto.trim(),
        materias_participantes: materiasInvolucradas,
        competencias_a_evaluar: competenciasElegidas,
        desglose_curricular_interdisciplinar: matrizDesglosada,
        tipo: 'cnc_proyecto'
      }

      const res = await fetch('/api/generar-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar el proyecto con IA')

      // Actualizar contador visual
      setProyectosHoy(prev => prev + 1)

      // Paso final: mostrar "¡Tu proyecto está listo!"
      setProyectoListo(true)

      setTimeout(() => {
        router.push(`/docente/proyecto-interdisciplinar/ver?id=${data.id || ''}`)
      }, 1500)

    } catch (err: any) {
      setGenerando(false)
      setProyectoListo(false)
      setMensaje({ tipo: 'error', texto: err.message || 'Error al procesar la planificación.' })
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Planificador Interdisciplinar...</p>
        </div>
      </div>
    )
  }

  const cuposRestantes = Math.max(0, LIMITE_DIARIO - proyectosHoy)
  const cupoAgotado = cuposRestantes === 0

  return (
    <div className="space-y-6 pb-16 font-sans selection:bg-[#4b4c99] selection:text-white max-w-5xl mx-auto">
      
      {/* MODAL FLOTANTE RENDERIZADO CON PORTAL EN DOCUMENT.BODY */}
      {generando && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 text-center space-y-6 animate-in zoom-in-95 duration-200">
            
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              {!proyectoListo ? (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-[#4b4c99]/20 border-t-[#4b4c99] animate-spin"></div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#4b4c99]">
                    <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                </>
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-in zoom-in-75 duration-300 shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                {proyectoListo ? '¡Tu proyecto está listo!' : 'Estamos generando tu proyecto'}
              </h3>
              <p className="text-xs font-semibold text-slate-600 min-h-[40px] flex items-center justify-center leading-relaxed transition-all duration-300">
                {proyectoListo 
                  ? 'Abriendo la planificación oficial en formato vertical...'
                  : mensajesProgreso[pasoGeneracion]
                }
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    proyectoListo ? 'bg-emerald-500 w-full' : 'bg-[#4b4c99]'
                  }`}
                  style={{ width: proyectoListo ? '100%' : `${((pasoGeneracion + 1) / mensajesProgreso.length) * 90}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 font-mono">
                <span>{materiasInvolucradas.length} materias articuladas</span>
                <span>{proyectoListo ? '100%' : `${Math.round(((pasoGeneracion + 1) / mensajesProgreso.length) * 90)}%`}</span>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* CABECERA PRINCIPAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <button
              onClick={() => router.push('/docente/planificador')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver al Menú
            </button>
            <span 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
              className="font-bold text-[10px] px-3 py-0.5 rounded-xl uppercase tracking-wider border shadow-2xs"
            >
              Evaluación de Competencias • CNC
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Nuevo Proyecto Interdisciplinar (Evaluación Sumativa)
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Selección de competencias con sus indicadores y saberes para <strong className="text-slate-700">{grado}</strong>.
          </p>
        </div>

        {/* SELECTOR DE PERIODO, CUPO Y CONTADOR */}
        <div className="flex items-center gap-2.5 flex-wrap self-stretch md:self-auto justify-between md:justify-end">
          {/* Indicador visual de cupos diarios */}
          <div className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
            cupoAgotado 
              ? 'bg-rose-50 text-rose-800 border-rose-200' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            <span>{cupoAgotado ? 'Límite diario alcanzado (4/4)' : `${cuposRestantes} de ${LIMITE_DIARIO} disponibles hoy`}</span>
          </div>

          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Periodo:</span>
            <select
              value={anioLectivoVigente}
              onChange={(e) => setAnioLectivoVigente(e.target.value)}
              style={{ color: '#4b4c99' }}
              className="bg-transparent text-xs font-bold outline-none cursor-pointer"
            >
              {periodosDisponibles.map((p) => (
                <option key={p} value={p} className="text-slate-900 font-bold bg-white">{p}</option>
              ))}
            </select>
          </div>

          <div className="bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold px-3 py-2 rounded-xl shadow-2xs flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>{materiasInvolucradas.length} {materiasInvolucradas.length === 1 ? 'Materia vinculada' : 'Materias vinculadas'}</span>
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

      <form onSubmit={handleGenerarProyecto} className="space-y-6">

        {/* 1. SECCIÓN CONTEXTO OFICIAL */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#4b4c99] flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">Contexto del Proyecto</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Subnivel Educativo</label>
              <select
                value={subnivel}
                onChange={(e) => setSubnivel(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
              >
                {subnivelesOficiales.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Año / Grado de Educación</label>
              <select
                value={grado}
                onChange={(e) => setGrado(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
              >
                {(gradosPorSubnivel[subnivel] || []).map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Trimestre</label>
              <select
                value={trimestre}
                onChange={(e) => setTrimestre(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
              >
                <option value="1">Primer Trimestre</option>
                <option value="2">Segundo Trimestre</option>
                <option value="3">Tercer Trimestre</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Duración (Semanas)</label>
              <input
                type="number"
                min="1"
                max="6"
                value={numeroSemanas}
                onChange={(e) => setNumeroSemanas(Number(e.target.value))}
                className="w-full p-3 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo</label>
              <input
                type="text"
                placeholder="Ej. A"
                maxLength={10}
                value={paralelo}
                onChange={(e) => setParalelo(e.target.value.toUpperCase())}
                className="w-full p-3 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* 2. SECCIÓN ESTRUCTURA DEL PROYECTO */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#45b3a5] flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
              </div>
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">Estructura del Proyecto</h2>
            </div>

            <button
              type="button"
              onClick={handleRellenarEstructuraConIA}
              disabled={rellenandoIa}
              style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
              className="px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5 hover:opacity-95 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{rellenandoIa ? 'Completando con IA...' : 'Completar Estructura con IA'}</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombre del Proyecto Interdisciplinar</label>
              <input
                type="text"
                required
                placeholder="Ej. Guardianes del ecosistema: ciencia, cálculo y arte para la sostenibilidad"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">
                Situación de Aprendizaje / Problemática
              </label>
              <textarea
                rows={3}
                placeholder="Contexto o problema real que enfrentarán los estudiantes. La IA lo articulará con las competencias seleccionadas."
                value={situacionAprendizaje}
                onChange={(e) => setSituacionAprendizaje(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-medium text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Desafío / Pregunta Guía</label>
                <textarea
                  rows={2}
                  placeholder="Ej. ¿Cómo podemos diseñar un prototipo sostenible para reducir el desperdicio de agua en la comunidad?"
                  value={desafio}
                  onChange={(e) => setDesafio(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl font-medium text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Producto Final Integrador</label>
                <input
                  type="text"
                  placeholder="Ej. Stand interactivo, Maqueta funcional, Revista científica, Podcast, Informe experimental…"
                  value={producto}
                  onChange={(e) => setProducto(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. SECCIÓN COMPETENCIAS DE MATRIZ CURRICULAR OFICIAL */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#4b4c99] flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                Competencias Exclusivas de: <span className="text-[#4b4c99]">{grado}</span>
              </h2>
            </div>
            <span style={{ backgroundColor: '#4b4c99' }} className="text-white text-[10px] font-bold px-3 py-1 rounded-xl shadow-2xs">
              {seleccionadasIds.length} seleccionadas
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Selecciona al menos dos competencias de distintas asignaturas para estructurar la evaluación sumativa integradora.
          </p>

          {/* BUSCADOR */}
          <div className="relative">
            <input
              type="text"
              placeholder={`Buscar competencia dentro de ${grado}...`}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full p-3 pl-10 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-slate-50 outline-none focus:bg-white focus:border-[#4b4c99] shadow-2xs transition"
            />
            <span className="absolute left-3.5 top-3.5 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          {/* CHIPS DE COMPETENCIAS SELECCIONADAS */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Competencias Seleccionadas para Evaluación</span>
            {competenciasElegidas.length === 0 ? (
              <span className="text-xs text-slate-400 italic">Marca las competencias en el panel inferior para evaluarlas en este proyecto.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {competenciasElegidas.map(c => (
                  <span 
                    key={c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs max-w-md truncate"
                  >
                    <span style={{ color: '#4b4c99' }}>{c.asignatura}:</span>
                    <span className="text-[11px] font-normal text-slate-600 truncate">{c.competencia}</span>
                    <button
                      type="button"
                      onClick={() => removerSeleccion(c.id)}
                      className="text-rose-500 hover:text-rose-700 p-0.5 ml-1 cursor-pointer rounded-full transition shrink-0"
                      title="Quitar"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* LISTA DE COMPETENCIAS AGRUPADAS POR ASIGNATURAS */}
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {cargandoCompetencias ? (
              <div className="text-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4b4c99] border-t-transparent mx-auto mb-2"></div>
                <p className="text-slate-500 text-xs font-semibold">Cargando competencias para {grado}...</p>
              </div>
            ) : Object.keys(gruposFiltrados).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <p className="text-xs font-bold text-slate-700">No se encontraron competencias para {grado}.</p>
                <p className="text-[11px] text-slate-500">Verifique los registros de la matriz curricular oficial para este curso.</p>
              </div>
            ) : (
              Object.keys(gruposFiltrados).map((asignaturaNombre, idx) => {
                const items = gruposFiltrados[asignaturaNombre]
                const colorFondo = idx % 2 === 0 ? 'bg-indigo-50/40 border-indigo-200' : 'bg-teal-50/40 border-teal-200'
                const colorBadge = idx % 2 === 0 ? 'bg-[#4b4c99] text-white' : 'bg-[#45b3a5] text-slate-950'

                return (
                  <div key={asignaturaNombre} className={`p-4 rounded-2xl border ${colorFondo} space-y-3`}>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${colorBadge}`}>
                        {asignaturaNombre.substring(0, 4).toUpperCase()}
                      </span>
                      <h3 className="font-bold text-xs text-slate-900 uppercase">{asignaturaNombre}</h3>
                      <span className="text-[10px] text-slate-500 font-semibold">({items.length} disponibles)</span>
                    </div>

                    <div className="space-y-2">
                      {items.map(comp => {
                        const seleccionada = seleccionadasIds.includes(comp.id)
                        return (
                          <label
                            key={comp.id}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                              seleccionada 
                                ? 'bg-white border-[#4b4c99] shadow-2xs ring-1 ring-[#4b4c99]' 
                                : 'bg-white/90 hover:bg-white border-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionada}
                              onChange={() => toggleSeleccion(comp)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99] cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                                {comp.competencia}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5 inline-block">
                                Grado asignado: {comp.grado_curso}
                              </span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 4. SECCIÓN DESGLOSE 1 A 1: INDICADORES Y SABERES */}
        {competenciasElegidas.length > 0 && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div className="space-y-0.5 max-w-xl">
                <h3 className="text-xs font-bold uppercase text-slate-900 flex items-center gap-2">
                  <span>Indicadores y Saberes de las Competencias Seleccionadas</span>
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-[#4b4c99] rounded-md font-extrabold border border-indigo-100">
                    {competenciasElegidas.length} Competencias activas
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cada competencia seleccionada incluye sus indicadores de logro y saberes disciplinares específicos. Puedes elegir individualmente cuáles evaluar 1 a 1.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarDetalleCurricular(!mostrarDetalleCurricular)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border shadow-2xs ${
                  mostrarDetalleCurricular
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {mostrarDetalleCurricular ? 'Ocultar desglose detallado' : '➕ Personalizar Indicadores y Saberes 1 a 1'}
              </button>
            </div>

            {mostrarDetalleCurricular && (
              <div className="space-y-4 pt-2">
                {competenciasElegidas.map(c => {
                  const indSeleccionados = indicadoresSeleccionadosMap[c.id] || []
                  const sabSeleccionados = saberesSeleccionadosMap[c.id] || []

                  return (
                    <div key={c.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                      <div className="border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-black uppercase text-[#4b4c99] block mb-0.5">
                          {c.asignatura} • Competencia a Evaluar:
                        </span>
                        <p className="text-xs font-bold text-slate-800 leading-snug">
                          {c.competencia}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[11px] text-slate-700 uppercase">Indicadores de Evaluación</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{indSeleccionados.length} elegidos</span>
                          </div>
                          <div className="space-y-1.5">
                            {c.indicadores_disponibles?.map((ind, iIdx) => {
                              const check = indSeleccionados.includes(ind)
                              return (
                                <label key={iIdx} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-[11px] text-slate-700 select-none">
                                  <input
                                    type="checkbox"
                                    checked={check}
                                    onChange={() => toggleIndicadorDeCompetencia(c.id, ind)}
                                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99]"
                                  />
                                  <span className={check ? 'font-semibold text-slate-900' : 'text-slate-600'}>{ind}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[11px] text-slate-700 uppercase">Contenidos y Saberes</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{sabSeleccionados.length} elegidos</span>
                          </div>
                          <div className="space-y-1.5">
                            {c.saberes_disponibles?.map((sab, sIdx) => {
                              const check = sabSeleccionados.includes(sab)
                              return (
                                <label key={sIdx} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-[11px] text-slate-700 select-none">
                                  <input
                                    type="checkbox"
                                    checked={check}
                                    onChange={() => toggleSaberDeCompetencia(c.id, sab)}
                                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#45b3a5] focus:ring-[#45b3a5]"
                                  />
                                  <span className={check ? 'font-semibold text-slate-900' : 'text-slate-600'}>{sab}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* BOTONES DE ACCIÓN */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/docente/planificador')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={generando || cupoAgotado || seleccionadasIds.length < 2 || materiasInvolucradas.length < 2}
            style={{ backgroundColor: cupoAgotado ? '#94a3b8' : '#4b4c99' }}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-bold text-xs shadow-sm hover:opacity-95 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span>{generando ? 'Generando con Inteligencia Artificial...' : cupoAgotado ? 'Límite diario alcanzado' : 'Generar Proyecto Interdisciplinar'}</span>
          </button>
        </div>

      </form>
    </div>
  )
}