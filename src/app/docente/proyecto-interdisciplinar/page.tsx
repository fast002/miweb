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
  indicadores_disponibles: string[]
  declarativos_disponibles: string[]
  procedimentales_disponibles: string[]
  actitudinales_disponibles: string[]
}

// Comparador estricto segmento por segmento para códigos curriculares (CE.CN.4.1 -> CE.CN.4.2 -> CE.CN.4.3)
function compararCodigosCurriculares(a: string, b: string): number {
  const limpiar = (s: string) =>
    (s || '')
      .replace(/^[\s\u200B-\u200D\uFEFF\u00A0]+/, '')
      .replace(/^Ref\.\s*/i, '')
      .trim()

  const strA = limpiar(a)
  const strB = limpiar(b)

  // Extrae el código inicial (ej. "CE.CN.4.2.", "I.M.4.1.2.", "LL.4.1.d.1.")
  const regexCodigo = /^([A-Za-z]+(?:\.[A-Za-z0-9]+)+)/
  const matchA = strA.match(regexCodigo)
  const matchB = strB.match(regexCodigo)

  if (matchA && matchB) {
    const partesA = matchA[1].split('.').filter(Boolean)
    const partesB = matchB[1].split('.').filter(Boolean)
    const maxLen = Math.max(partesA.length, partesB.length)

    for (let i = 0; i < maxLen; i++) {
      const pA = partesA[i]
      const pB = partesB[i]

      if (pA === undefined) return -1
      if (pB === undefined) return 1

      const numA = Number(pA)
      const numB = Number(pB)

      // Si ambos segmentos son números (ej. 1, 2, 3, 10), comparar matemáticamente
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB
      } else {
        // Si son letras (ej. CE, CN, d, p, a), comparar alfabéticamente
        const cmp = pA.toUpperCase().localeCompare(pB.toUpperCase(), 'es')
        if (cmp !== 0) return cmp
      }
    }
  }

  // Respaldo por si algún ítem no empieza con código estándar
  return strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' })
}

// Función para desglosar respetando las siglas oficiales del Ministerio (I.CN., CN., etc.)
function extraerItemsCurriculares(
  texto: string | null | undefined, 
  tipo: 'indicador' | 'declarativo' | 'procedimental' | 'actitudinal',
  asignatura?: string
): string[] {
  if (!texto || typeof texto !== 'string') return []

  const lineas = texto.split(/\r?\n+/).map(l => l.trim()).filter(Boolean)
  const itemsCrudos: string[] = []

  lineas.forEach(linea => {
    const regexCodigo = /(?:(?:Ref\.\s*)?(?:I\.[A-Z]{1,4}|SC\.CE\.[A-Z]{1,4}|[A-Z]{1,4})\.\d+(?:\.[0-9a-z]+)*\.?\s+)/gi

    const indices: number[] = []
    let match: RegExpExecArray | null
    while ((match = regexCodigo.exec(linea)) !== null) {
      indices.push(match.index)
    }

    if (indices.length > 1) {
      for (let i = 0; i < indices.length; i++) {
        const inicio = indices[i]
        const fin = (i + 1 < indices.length) ? indices[i + 1] : linea.length
        const parte = linea.substring(inicio, fin).trim()
        if (parte) itemsCrudos.push(parte)
      }
    } else {
      itemsCrudos.push(linea)
    }
  })

  const itemsCorregidos = itemsCrudos.map(item => {
    let limpio = item.trim()
    const asigUpper = (asignatura || '').toUpperCase()
    let siglaAsig = 'CN'
    if (asigUpper.includes('MATEMÁTICA')) siglaAsig = 'M'
    else if (asigUpper.includes('LENGUA')) siglaAsig = 'LL'
    else if (asigUpper.includes('SOCIALES') || asigUpper.includes('HISTORIA')) siglaAsig = 'CS'
    else if (asigUpper.includes('INGLÉS') || asigUpper.includes('ENGLISH') || asigUpper.includes('EXTRANJERO') || asigUpper.includes('EFL')) siglaAsig = 'EFL'
    else if (asigUpper.includes('CULTURAL') || asigUpper.includes('ARTÍSTICA') || asigUpper.includes('ECA')) siglaAsig = 'ECA'
    else if (asigUpper.includes('FÍSICA')) siglaAsig = 'EF'

    if (tipo === 'indicador') {
      if (/^[A-Z]\.\d+\.\d+/i.test(limpio) && !limpio.startsWith('I.')) {
        limpio = `I.${siglaAsig}.${limpio.replace(/^[A-Z]\./i, '')}`
      } else if (/^I\.[A-Z]\.\d+/i.test(limpio) && !limpio.startsWith(`I.${siglaAsig}.`)) {
        limpio = limpio.replace(/^I\.[A-Z]\./i, `I.${siglaAsig}.`)
      }
    } else {
      if (/^[A-Z]\.\d+\.\d+\.[dpa]\.\d+/i.test(limpio) && !limpio.startsWith(`${siglaAsig}.`)) {
        limpio = `${siglaAsig}.${limpio.replace(/^[A-Z]\./i, '')}`
      }
    }

    return limpio
  })

  return Array.from(new Set(itemsCorregidos.filter(s => s.length > 5))).sort(compararCodigosCurriculares)
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

  // Control de cupo diario
  const [proyectosHoy, setProyectosHoy] = useState(0)
  const LIMITE_DIARIO = 10

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
  const [busquedaMateria, setBusquedaMateria] = useState('')

  // Control de acordeón abierto por materia
  const [materiaAbierta, setMateriaAbierta] = useState<string | null>(null)

  // 4. Mapas de selección 1 a 1 de Indicadores y Saberes desglosados
  const [indicadoresSeleccionadosMap, setIndicadoresSeleccionadosMap] = useState<{ [compKey: string]: string[] }>({})
  const [declarativosSeleccionadosMap, setDeclarativosSeleccionadosMap] = useState<{ [compKey: string]: string[] }>({})
  const [procedimentalesSeleccionadosMap, setProcedimentalesSeleccionadosMap] = useState<{ [compKey: string]: string[] }>({})
  const [actitudinalesSeleccionadosMap, setActitudinalesSeleccionadosMap] = useState<{ [compKey: string]: string[] }>({})

  useEffect(() => {
    setMounted(true)
    cargarDatosDocente()
  }, [])

  useEffect(() => {
    let intervalo: any
    if (generando && !proyectoListo) {
      intervalo = setInterval(() => {
        setPasoGeneracion(prev => (prev < mensajesProgreso.length - 1 ? prev + 1 : prev))
      }, 2500)
    }
    return () => clearInterval(intervalo)
  }, [generando, proyectoListo, mensajesProgreso.length])

  useEffect(() => {
    const listaGrados = gradosPorSubnivel[subnivel] || []
    if (listaGrados.length > 0 && !listaGrados.includes(grado)) {
      setGrado(listaGrados[0])
    }
  }, [subnivel])

  useEffect(() => {
    if (grado) {
      cargarCompetenciasDesdeMatriz(subnivel, grado)
    }
  }, [subnivel, grado])

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

  const cargarCompetenciasDesdeMatriz = async (subnivelElegido: string, gradoElegido: string) => {
    setCargandoCompetencias(true)
    setSeleccionadasIds([])
    setIndicadoresSeleccionadosMap({})
    setDeclarativosSeleccionadosMap({})
    setProcedimentalesSeleccionadosMap({})
    setActitudinalesSeleccionadosMap({})

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

        const mapaAgrupado = new Map<string, MatrizCurricularItem>()

        listaFinal.forEach((fila: any) => {
          const asigNorm = (fila.asignatura || '').trim()
          const compTexto = (fila.competencia || '').trim()

          if (!compTexto) return

          const clave = `${asigNorm.toUpperCase()}___${compTexto.toLowerCase()}`

          if (!mapaAgrupado.has(clave)) {
            mapaAgrupado.set(clave, {
              id: fila.id,
              asignatura: asigNorm,
              subnivel: fila.subnivel || subnivelElegido,
              grado_curso: fila.grado_curso || gradoElegido,
              competencia: compTexto,
              indicadores_disponibles: [],
              declarativos_disponibles: [],
              procedimentales_disponibles: [],
              actitudinales_disponibles: []
            })
          }

          const item = mapaAgrupado.get(clave)!

          const inds = extraerItemsCurriculares(fila.indicador, 'indicador', asigNorm)
          inds.forEach(i => {
            if (!item.indicadores_disponibles.includes(i)) item.indicadores_disponibles.push(i)
          })

          const decs = extraerItemsCurriculares(fila.declarativo, 'declarativo', asigNorm)
          decs.forEach(d => {
            if (!item.declarativos_disponibles.includes(d)) item.declarativos_disponibles.push(d)
          })

          const procs = extraerItemsCurriculares(fila.procedimental, 'procedimental', asigNorm)
          procs.forEach(p => {
            if (!item.procedimentales_disponibles.includes(p)) item.procedimentales_disponibles.push(p)
          })

          const acts = extraerItemsCurriculares(fila.actitudinal, 'actitudinal', asigNorm)
          acts.forEach(a => {
            if (!item.actitudinales_disponibles.includes(a)) item.actitudinales_disponibles.push(a)
          })
        })

        // Ordenar internamente los indicadores y saberes de cada competencia, y luego las competencias entre sí
        const catalogo = Array.from(mapaAgrupado.values())
          .map(item => ({
            ...item,
            indicadores_disponibles: [...item.indicadores_disponibles].sort(compararCodigosCurriculares),
            declarativos_disponibles: [...item.declarativos_disponibles].sort(compararCodigosCurriculares),
            procedimentales_disponibles: [...item.procedimentales_disponibles].sort(compararCodigosCurriculares),
            actitudinales_disponibles: [...item.actitudinales_disponibles].sort(compararCodigosCurriculares)
          }))
          .sort((a, b) => {
            const cmpAsig = a.asignatura.localeCompare(b.asignatura, 'es', { sensitivity: 'base' })
            if (cmpAsig !== 0) return cmpAsig
            return compararCodigosCurriculares(a.competencia, b.competencia)
          })

        setCatalogoCompetencias(catalogo)

        // Abrir la primera materia por defecto si existe
        if (catalogo.length > 0) {
          setMateriaAbierta(catalogo[0].asignatura)
        }
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

  // Agrupación por asignaturas manteniendo el orden secuencial de las competencias
  const agrupadoPorMaterias = useMemo(() => {
    const agrupado: { [asig: string]: MatrizCurricularItem[] } = {}
    catalogoCompetencias.forEach(item => {
      if (!agrupado[item.asignatura]) agrupado[item.asignatura] = []
      agrupado[item.asignatura].push(item)
    })

    Object.keys(agrupado).forEach(asig => {
      agrupado[asig] = [...agrupado[asig]].sort((a, b) =>
        compararCodigosCurriculares(a.competencia, b.competencia)
      )
    })

    return agrupado
  }, [catalogoCompetencias])

  // Filtrado de materias con el buscador
  const materiasFiltradas = useMemo(() => {
    const q = busquedaMateria.toLowerCase().trim()
    return Object.keys(agrupadoPorMaterias).filter(asig => {
      if (!q) return true
      return asig.toLowerCase().includes(q)
    })
  }, [agrupadoPorMaterias, busquedaMateria])

  const toggleSeleccion = (item: MatrizCurricularItem) => {
    const id = item.id
    setSeleccionadasIds(prev => {
      const existe = prev.includes(id)
      if (existe) {
        setIndicadoresSeleccionadosMap(m => { const c = { ...m }; delete c[id]; return c })
        setDeclarativosSeleccionadosMap(m => { const c = { ...m }; delete c[id]; return c })
        setProcedimentalesSeleccionadosMap(m => { const c = { ...m }; delete c[id]; return c })
        setActitudinalesSeleccionadosMap(m => { const c = { ...m }; delete c[id]; return c })
        return prev.filter(x => x !== id)
      } else {
        if (item.indicadores_disponibles.length > 0) {
          setIndicadoresSeleccionadosMap(m => ({ ...m, [id]: [...item.indicadores_disponibles].sort(compararCodigosCurriculares) }))
        }
        if (item.declarativos_disponibles.length > 0) {
          setDeclarativosSeleccionadosMap(m => ({ ...m, [id]: [...item.declarativos_disponibles].sort(compararCodigosCurriculares) }))
        }
        if (item.procedimentales_disponibles.length > 0) {
          setProcedimentalesSeleccionadosMap(m => ({ ...m, [id]: [...item.procedimentales_disponibles].sort(compararCodigosCurriculares) }))
        }
        if (item.actitudinales_disponibles.length > 0) {
          setActitudinalesSeleccionadosMap(m => ({ ...m, [id]: [...item.actitudinales_disponibles].sort(compararCodigosCurriculares) }))
        }
        return [...prev, id]
      }
    })
  }

  const toggleItem = (
    compId: string,
    valor: string,
    setter: React.Dispatch<React.SetStateAction<{ [key: string]: string[] }>>
  ) => {
    setter(prev => {
      const actuales = prev[compId] || []
      const existe = actuales.includes(valor)
      const actualizados = existe
        ? actuales.filter(i => i !== valor)
        : [...actuales, valor].sort(compararCodigosCurriculares)
      return {
        ...prev,
        [compId]: actualizados
      }
    })
  }

  const toggleTodosColumna = (
    compId: string,
    todosDisponibles: string[],
    seleccionadosActuales: string[],
    setter: React.Dispatch<React.SetStateAction<{ [key: string]: string[] }>>
  ) => {
    if (seleccionadosActuales.length === todosDisponibles.length) {
      setter(prev => ({ ...prev, [compId]: [] }))
    } else {
      setter(prev => ({ ...prev, [compId]: [...todosDisponibles].sort(compararCodigosCurriculares) }))
    }
  }

  const competenciasElegidas = catalogoCompetencias.filter(c => seleccionadasIds.includes(c.id))
  const materiasInvolucradas = Array.from(new Set(competenciasElegidas.map(c => c.asignatura)))

  // Función para obtener la insignia/sigla oficial por materia
  const getBadgeMateria = (nombre: string) => {
    const norm = nombre.toUpperCase()
    if (norm.includes('LENGUA')) return 'LL'
    if (norm.includes('NATURALES') || norm.includes('BIOLOGÍA') || norm.includes('QUÍMICA')) return 'CN'
    if (norm.includes('SOCIALES') || norm.includes('HISTORIA')) return 'CS'
    if (norm.includes('CULTURAL') || norm.includes('ARTÍSTICA') || norm.includes('ECA')) return 'ECA'
    if (norm.includes('MATEMÁTICA')) return 'M'
    if (norm.includes('FÍSICA')) return 'EF'
    if (norm.includes('INGLÉS') || norm.includes('ENGLISH') || norm.includes('EXTRANJERO') || norm.includes('EFL')) return 'EFL'
    return nombre.substring(0, 3).toUpperCase()
  }

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

    const totalHoy = await consultarConteoProyectosHoy(user.id)
    if (totalHoy >= LIMITE_DIARIO) {
      alert(`⚠️ Has alcanzado el límite diario permitido (${LIMITE_DIARIO} proyectos por día).\n\nPodrás generar nuevos proyectos a partir de mañana.`)
      return
    }

    setGenerando(true)
    setPasoGeneracion(0)
    setProyectoListo(false)
    setMensaje(null)

    try {
      const matrizDesglosada = competenciasElegidas.map(c => ({
        competencia_id: c.id,
        asignatura: c.asignatura,
        competencia: c.competencia,
        indicadores: [...(indicadoresSeleccionadosMap[c.id] || c.indicadores_disponibles)].sort(compararCodigosCurriculares),
        declarativos: [...(declarativosSeleccionadosMap[c.id] || c.declarativos_disponibles)].sort(compararCodigosCurriculares),
        procedimentales: [...(procedimentalesSeleccionadosMap[c.id] || c.procedimentales_disponibles)].sort(compararCodigosCurriculares),
        actitudinales: [...(actitudinalesSeleccionadosMap[c.id] || c.actitudinales_disponibles)].sort(compararCodigosCurriculares)
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

      setProyectosHoy(prev => prev + 1)
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
    <div className="space-y-6 pb-16 font-sans selection:bg-[#4b4c99] selection:text-white max-w-6xl mx-auto">
      
      {/* MODAL FLOTANTE DE GENERACIÓN */}
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
            {nombreInstitucion} • Módulo articulador para <strong className="text-slate-700">{grado}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-stretch md:self-auto justify-between md:justify-end">
          <div className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
            cupoAgotado 
              ? 'bg-rose-50 text-rose-800 border-rose-200' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            <span>{cupoAgotado ? `Límite diario alcanzado (${LIMITE_DIARIO}/${LIMITE_DIARIO})` : `${cuposRestantes} de ${LIMITE_DIARIO} disponibles hoy`}</span>
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

        {/* =========================================================================
            3. MATERIAS DEL PROYECTO (ORDENADAS SECUENCIALMENTE)
            ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          
          {/* Cabecera */}
          <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-indigo-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <h2 className="font-bold text-sm text-slate-900 tracking-tight">Materias del proyecto</h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {materiasInvolucradas.length} materias · {seleccionadasIds.length} competencias
            </span>
          </div>

          <div className="p-6 pt-4 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Abre una materia y elige sus competencias. Debajo aparecen solo los indicadores y saberes de esa materia en orden secuencial. Si no marcas ninguno, entran todos los de las competencias elegidas. Luego abre la siguiente materia.
            </p>

            {/* Buscador de materias */}
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Buscar materia..."
                value={busquedaMateria}
                onChange={(e) => setBusquedaMateria(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-2xs"
              />
            </div>

            {/* Listado de Acordeones por Materia */}
            {cargandoCompetencias ? (
              <div className="text-center py-10 space-y-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto"></div>
                <p className="text-xs text-slate-500 font-semibold">Cargando materias para {grado}...</p>
              </div>
            ) : materiasFiltradas.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                <p className="text-xs font-bold text-slate-700">No se encontraron materias con el filtro especificado.</p>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                {materiasFiltradas.map((asigNombre) => {
                  const competenciasDeMateria = agrupadoPorMaterias[asigNombre] || []
                  const compsSeleccionadasEnEstaMateria = competenciasDeMateria.filter(c => seleccionadasIds.includes(c.id))
                  const estaAbierta = materiaAbierta === asigNombre
                  const badgeSigla = getBadgeMateria(asigNombre)

                  return (
                    <div 
                      key={asigNombre} 
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        estaAbierta 
                          ? 'border-indigo-400/80 bg-white shadow-xs' 
                          : 'border-slate-200/90 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Barra Fila de la Materia */}
                      <button
                        type="button"
                        onClick={() => setMateriaAbierta(estaAbierta ? null : asigNombre)}
                        className="w-full p-3.5 sm:px-5 flex items-center justify-between gap-3 text-left cursor-pointer transition select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                            {badgeSigla}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-slate-800">
                            {asigNombre}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-500 font-medium text-xs">
                          <span>
                            {compsSeleccionadasEnEstaMateria.length} {compsSeleccionadasEnEstaMateria.length === 1 ? 'competencia' : 'competencias'}
                          </span>
                          <svg 
                            className={`w-4 h-4 transition-transform duration-200 ${estaAbierta ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Contenido desplegado: Competencias e Indicadores/Saberes vinculados */}
                      {estaAbierta && (
                        <div className="p-5 pt-2 border-t border-slate-100 space-y-5 bg-slate-50/50">
                          
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                              Selecciona la(s) competencia(s) de {asigNombre}:
                            </span>

                            {competenciasDeMateria.map(comp => {
                              const seleccionada = seleccionadasIds.includes(comp.id)

                              return (
                                <div key={comp.id} className="space-y-3">
                                  {/* Checkbox de la competencia */}
                                  <label
                                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                      seleccionada 
                                        ? 'bg-white border-indigo-500 shadow-2xs ring-1 ring-indigo-500' 
                                        : 'bg-white hover:bg-slate-100 border-slate-200'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={seleccionada}
                                      onChange={() => toggleSeleccion(comp)}
                                      className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                    />
                                    <div className="flex-1">
                                      <p className="text-xs font-bold text-slate-900 leading-relaxed">
                                        {comp.competencia}
                                      </p>
                                    </div>
                                  </label>

                                  {/* Si la competencia está seleccionada, se abren DE INMEDIATO sus 4 columnas 1 a 1 */}
                                  {seleccionada && (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 ml-2 sm:ml-4 animate-in fade-in duration-200">
                                      <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider block">
                                        Desglose 1 a 1 de Indicadores y Saberes:
                                      </span>

                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                        
                                        {/* 1. INDICADORES */}
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                                          <div>
                                            <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-200">
                                              <span className="font-bold text-[10px] uppercase text-indigo-950">Indicadores</span>
                                              <div className="flex items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleTodosColumna(comp.id, comp.indicadores_disponibles, indicadoresSeleccionadosMap[comp.id] || [], setIndicadoresSeleccionadosMap)}
                                                  className="text-[9px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                                                >
                                                  {(indicadoresSeleccionadosMap[comp.id] || []).length === comp.indicadores_disponibles.length ? 'Limpiar' : 'Todos'}
                                                </button>
                                                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                                                  {(indicadoresSeleccionadosMap[comp.id] || []).length}/{comp.indicadores_disponibles.length}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                              {comp.indicadores_disponibles.map((ind, iIdx) => {
                                                const check = (indicadoresSeleccionadosMap[comp.id] || []).includes(ind)
                                                return (
                                                  <label key={iIdx} className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer text-[11px] select-none">
                                                    <input
                                                      type="checkbox"
                                                      checked={check}
                                                      onChange={() => toggleItem(comp.id, ind, setIndicadoresSeleccionadosMap)}
                                                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                                                    />
                                                    <span className={check ? 'font-semibold text-slate-900 leading-snug' : 'text-slate-600 leading-snug'}>{ind}</span>
                                                  </label>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        </div>

                                        {/* 2. DECLARATIVOS */}
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                                          <div>
                                            <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-200">
                                              <span className="font-bold text-[10px] uppercase text-amber-950">Declarativos</span>
                                              <div className="flex items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleTodosColumna(comp.id, comp.declarativos_disponibles, declarativosSeleccionadosMap[comp.id] || [], setDeclarativosSeleccionadosMap)}
                                                  className="text-[9px] font-semibold text-amber-700 hover:underline cursor-pointer"
                                                >
                                                  {(declarativosSeleccionadosMap[comp.id] || []).length === comp.declarativos_disponibles.length ? 'Limpiar' : 'Todos'}
                                                </button>
                                                <span className="text-[9px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
                                                  {(declarativosSeleccionadosMap[comp.id] || []).length}/{comp.declarativos_disponibles.length}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                              {comp.declarativos_disponibles.map((dec, dIdx) => {
                                                const check = (declarativosSeleccionadosMap[comp.id] || []).includes(dec)
                                                return (
                                                  <label key={dIdx} className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer text-[11px] select-none">
                                                    <input
                                                      type="checkbox"
                                                      checked={check}
                                                      onChange={() => toggleItem(comp.id, dec, setDeclarativosSeleccionadosMap)}
                                                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0"
                                                    />
                                                    <span className={check ? 'font-semibold text-slate-900 leading-snug' : 'text-slate-600 leading-snug'}>{dec}</span>
                                                  </label>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        </div>

                                        {/* 3. PROCEDIMENTALES */}
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                                          <div>
                                            <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-200">
                                              <span className="font-bold text-[10px] uppercase text-teal-950">Procedimentales</span>
                                              <div className="flex items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleTodosColumna(comp.id, comp.procedimentales_disponibles, procedimentalesSeleccionadosMap[comp.id] || [], setProcedimentalesSeleccionadosMap)}
                                                  className="text-[9px] font-semibold text-teal-700 hover:underline cursor-pointer"
                                                >
                                                  {(procedimentalesSeleccionadosMap[comp.id] || []).length === comp.procedimentales_disponibles.length ? 'Limpiar' : 'Todos'}
                                                </button>
                                                <span className="text-[9px] font-bold text-teal-800 bg-teal-100/70 px-1.5 py-0.5 rounded">
                                                  {(procedimentalesSeleccionadosMap[comp.id] || []).length}/{comp.procedimentales_disponibles.length}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                              {comp.procedimentales_disponibles.map((proc, pIdx) => {
                                                const check = (procedimentalesSeleccionadosMap[comp.id] || []).includes(proc)
                                                return (
                                                  <label key={pIdx} className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer text-[11px] select-none">
                                                    <input
                                                      type="checkbox"
                                                      checked={check}
                                                      onChange={() => toggleItem(comp.id, proc, setProcedimentalesSeleccionadosMap)}
                                                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0"
                                                    />
                                                    <span className={check ? 'font-semibold text-slate-900 leading-snug' : 'text-slate-600 leading-snug'}>{proc}</span>
                                                  </label>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        </div>

                                        {/* 4. ACTITUDINALES */}
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                                          <div>
                                            <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-200">
                                              <span className="font-bold text-[10px] uppercase text-rose-950">Actitudinales</span>
                                              <div className="flex items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleTodosColumna(comp.id, comp.actitudinales_disponibles, actitudinalesSeleccionadosMap[comp.id] || [], setActitudinalesSeleccionadosMap)}
                                                  className="text-[9px] font-semibold text-rose-700 hover:underline cursor-pointer"
                                                >
                                                  {(actitudinalesSeleccionadosMap[comp.id] || []).length === comp.actitudinales_disponibles.length ? 'Limpiar' : 'Todos'}
                                                </button>
                                                <span className="text-[9px] font-bold text-rose-800 bg-rose-100/70 px-1.5 py-0.5 rounded">
                                                  {(actitudinalesSeleccionadosMap[comp.id] || []).length}/{comp.actitudinales_disponibles.length}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                              {comp.actitudinales_disponibles.map((act, aIdx) => {
                                                const check = (actitudinalesSeleccionadosMap[comp.id] || []).includes(act)
                                                return (
                                                  <label key={aIdx} className="flex items-start gap-2 p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer text-[11px] select-none">
                                                    <input
                                                      type="checkbox"
                                                      checked={check}
                                                      onChange={() => toggleItem(comp.id, act, setActitudinalesSeleccionadosMap)}
                                                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 shrink-0"
                                                    />
                                                    <span className={check ? 'font-semibold text-slate-900 leading-snug' : 'text-slate-600 leading-snug'}>{act}</span>
                                                  </label>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        </div>

                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* NOTA AL PIE OFICIAL */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-start gap-2.5 leading-relaxed font-normal">
          <span className="text-slate-600 text-sm mt-0.5">ℹ</span>
          <span>
            Esta herramienta pedagógica genera propuestas de planificación basadas en los lineamientos técnicos y formatos socializados en la fase de pilotaje. Es responsabilidad del docente validar y ajustar el contenido conforme a las disposiciones específicas de su institución educativa y distrito.
          </span>
        </div>

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