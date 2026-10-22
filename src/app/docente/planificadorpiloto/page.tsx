'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PlanificadorPilotoNuevoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('id')

  const [docente, setDocente] = useState<any>(null)
  const [institucion, setInstitucion] = useState<any>(null)
  
  const [gradosPermitidos, setGradosPermitidos] = useState<string[]>([])
  const [asignaturasPermitidas, setAsignaturasPermitidas] = useState<string[]>([])
  const [sinAsignacion, setSinAsignacion] = useState(false)

  // Control de cupo diario (Máximo 5 por día)
  const [planificacionesHoy, setPlanificacionesHoy] = useState(0)
  const LIMITE_DIARIO = 5

  const añosPorSubnivel: Record<string, string[]> = {
    'Básica Elemental': ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'],
    'Básica Media': ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'],
    'Básica Superior': ['8vo Grado EGB', '9no Grado EGB', '10mo Grado EGB'],
    'Bachillerato': ['1er Año Bachillerato', '2do Año Bachillerato', '3er Año Bachillerato'],
    'Educación Inicial': ['Inicial 3-4 años', 'Inicial 4-5 años']
  }

  const subnivelesDisponibles = gradosPermitidos.length > 0
    ? Object.keys(añosPorSubnivel).filter(sub => 
        añosPorSubnivel[sub].some(grado => gradosPermitidos.includes(grado))
      )
    : Object.keys(añosPorSubnivel)

  const [subnivel, setSubnivel] = useState('')
  
  const gradosDelSubnivel = subnivel ? (añosPorSubnivel[subnivel] || []) : []
  const gradosVisibles = gradosPermitidos.length > 0
    ? gradosDelSubnivel.filter(g => gradosPermitidos.includes(g))
    : gradosDelSubnivel

  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('A')

  const [registrosCurriculares, setRegistrosCurriculares] = useState<any[]>([])
  const [competenciasDisponibles, setCompetenciasDisponibles] = useState<string[]>([])
  const [cargandoCurriculo, setCargandoCurriculo] = useState(false)

  const [form, setForm] = useState({
    trimestre: 'Primer Trimestre',
    noSemanas: '7',
    tituloSia: 'Pensamiento crítico, voz ética y creación',
    descripcionSia: '',
    asignaturasConexion: '',
    competenciaEspecifica: ''
  })

  const [bloquesCompetencias, setBloquesCompetencias] = useState([
    {
      id: 1,
      competencia: '',
      indicadoresDisponibles: [] as string[],
      declarativosDisponibles: [] as string[],
      procedimentalesDisponibles: [] as string[],
      actitudinalesDisponibles: [] as string[],
      indicadoresSeleccionados: [] as string[],
      declarativosSeleccionados: [] as string[],
      procedimentalesSeleccionados: [] as string[],
      actitudinalesSeleccionados: [] as string[]
    }
  ])

  const [mostrarIndicadoresManuales, setMostrarIndicadoresManuales] = useState(false)
  const [formatoImpresion, setFormatoImpresion] = useState<'piloto_oficial' | 'piloto_v2'>('piloto_oficial')

  const [semanas, setSemanas] = useState(
    Array.from({ length: 7 }, (_, i) => ({
      numero: i + 1,
      tema: `Tema ${i + 1}`,
      indicador: '',
      inicio: '',
      desarrollo: '',
      cierre: '',
      recursos: 'Material concreto, soportes visuales, recursos digitales.',
      tecnica: 'Observación sistemática',
      instrumento: 'Rúbrica de evaluación / Lista de cotejo'
    }))
  )

  const materiasDisponibles = [
    'Matemática', 'Lengua y Literatura', 'Ciencias Naturales', 'Estudios Sociales',
    'Educación Física', 'Educación Cultural y Artística (ECA)', 'Idioma Extranjero (Inglés)',
    'Biología', 'Física', 'Química', 'Historia y Geografía', 'Educación para la Ciudadanía', 
    'Filosofía', 'Emprendimiento y Gestión',
  ]

  const materiasVisibles = asignaturasPermitidas.length > 0
    ? materiasDisponibles.filter(m => asignaturasPermitidas.includes(m))
    : materiasDisponibles

  const [generandoIA, setGenerandoIA] = useState(false)
  const [mensajeEstadoIA, setMensajeEstadoIA] = useState('')

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

  // Función para contar planificaciones exitosas creadas hoy
  const consultarConteoDiario = async (userId: string) => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const inicioDiaISO = hoy.toISOString()

      const { count, error } = await supabase
        .from('planificaciones_microcurriculares')
        .select('*', { count: 'exact', head: true })
        .eq('docente_id', userId)
        .gte('created_at', inicioDiaISO)

      if (!error && count !== null) {
        setPlanificacionesHoy(count)
        return count
      }
    } catch (e) {
      console.error('Error al consultar cupo diario:', e)
    }
    return 0
  }

  const cargarDatosDocente = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Consultar conteo de planificaciones de hoy
    await consultarConteoDiario(user.id)

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

      if (gradosAutorizados.length === 0 || asignaturasAutorizadas.length === 0) {
        setSinAsignacion(true)
        return
      }

      if (gradosAutorizados.length > 0) {
        const subnivelesValidos = Object.keys(añosPorSubnivel).filter(sub => 
          añosPorSubnivel[sub].some(g => gradosAutorizados.includes(g))
        )
        if (subnivelesValidos.length > 0) {
          const primerSub = subnivelesValidos[0]
          setSubnivel(primerSub)
          const gradosDelSub = añosPorSubnivel[primerSub].filter(g => gradosAutorizados.includes(g))
          if (gradosDelSub.length > 0) setGradoSeleccionado(gradosDelSub[0])
        }
      }

      if (asignaturasAutorizadas.length > 0) {
        const permitidasValidas = materiasDisponibles.filter(m => asignaturasAutorizadas.includes(m))
        if (permitidasValidas.length > 0) setMateriaSeleccionada(permitidasValidas[0])
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
      console.error('Error cargando currículo:', e.message || e)
    } finally {
      setCargandoCurriculo(false)
    }
  }

  const actualizarBloqueCompetencia = (bloqueId: number, competenciaTexto: string, fuenteDatos = registrosCurriculares) => {
    const registrosDeCompetencia = fuenteDatos.filter(d => d.competencia === competenciaTexto)
    const extraerListaUnica = (campo: string) => {
      const todos = registrosDeCompetencia.flatMap(d => {
        const val = d[campo]
        if (!val) return []
        return typeof val === 'string' ? val.split('\n').map(s => s.trim()).filter(Boolean) : [val]
      })
      return Array.from(new Set(todos))
    }

    setBloquesCompetencias(prev => prev.map(b => {
      if (b.id === bloqueId) {
        return {
          ...b,
          competencia: competenciaTexto,
          indicadoresDisponibles: extraerListaUnica('indicador'),
          declarativosDisponibles: extraerListaUnica('declarativo'),
          procedimentalesDisponibles: extraerListaUnica('procedimental'),
          actitudinalesDisponibles: extraerListaUnica('actitudinal'),
          indicadoresSeleccionados: [],
          declarativosSeleccionados: [],
          procedimentalesSeleccionados: [],
          actitudinalesSeleccionados: []
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
        indicadoresDisponibles: [],
        declarativosDisponibles: [],
        procedimentalesDisponibles: [],
        actitudinalesDisponibles: [],
        indicadoresSeleccionados: [],
        declarativosSeleccionados: [],
        procedimentalesSeleccionados: [],
        actitudinalesSeleccionados: []
      }
    ])
    if (primeraComp) actualizarBloqueCompetencia(nuevoId, primeraComp)
  }

  const eliminarBloqueCompetencia = (id: number) => {
    if (bloquesCompetencias.length === 1) return
    setBloquesCompetencias(bloquesCompetencias.filter(b => b.id !== id))
  }

  const toggleSeleccion = (bloqueId: number, campo: 'indicadoresSeleccionados' | 'declarativosSeleccionados' | 'procedimentalesSeleccionados' | 'actitudinalesSeleccionados', valor: string) => {
    setBloquesCompetencias(prev => prev.map(b => {
      if (b.id === bloqueId) {
        const listaActual = b[campo]
        const existe = listaActual.includes(valor)
        const nuevaLista = existe ? listaActual.filter(item => item !== valor) : [...listaActual, valor]
        return { ...b, [campo]: nuevaLista }
      }
      return b
    }))
  }

  const handleNoSemanasChange = (nuevoValor: string) => {
    const num = parseInt(nuevoValor) || 7
    const cantidad = Math.max(1, Math.min(12, num))
    setForm(prev => ({ ...prev, noSemanas: cantidad.toString() }))
    
    setSemanas(prev => {
      if (cantidad === prev.length) return prev
      if (cantidad > prev.length) {
        const extra = Array.from({ length: cantidad - prev.length }, (_, i) => ({
          numero: prev.length + i + 1,
          tema: `Tema ${prev.length + i + 1}`,
          indicador: '',
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

  const generarYGuardarPlanificacion = async () => {
    if (gradosPermitidos.length > 0 && !gradosPermitidos.includes(gradoSeleccionado)) {
      alert('Acceso denegado: El Superadministrador no te ha asignado este grado en tu carga horaria.')
      return
    }
    if (asignaturasPermitidas.length > 0 && !asignaturasPermitidas.includes(materiaSeleccionada)) {
      alert('Acceso denegado: El Superadministrador no te ha asignado esta asignatura en tu carga horaria.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('No hay una sesión activa de docente.')
      return
    }

    // 1. Verificación previa de cupo en base de datos
    const totalHoy = await consultarConteoDiario(user.id)
    if (totalHoy >= LIMITE_DIARIO) {
      alert(`⚠️ Has alcanzado el límite máximo diario (${LIMITE_DIARIO} planificaciones por día).\n\nPodrás generar nuevas planificaciones a partir de mañana.`)
      return
    }

    if (generandoIA) return
    setGenerandoIA(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 240000)

    try {
      setMensajeEstadoIA('Analizando matriz curricular y organizando orden pedagógico DUA/ERCA...')

      const res = await fetch('/api/generar-plan', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          tipoModelo: 'secuencia_piloto_zona6',
          asignatura: materiaSeleccionada,
          subnivel: subnivel,
          grado: gradoSeleccionado,
          trimestre: form.trimestre,
          noSemanas: parseInt(form.noSemanas) || 7,
          bloquesManuales: bloquesCompetencias,
          formatoImpresion: formatoImpresion
        })
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Error del servidor (${res.status}). Intenta nuevamente.`)
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setMensajeEstadoIA('Guardando planificación en tu perfil...')

      const semanasGeneradas = data.semanas && Array.isArray(data.semanas) 
        ? data.semanas.map((s: any, idx: number) => ({
            numero: s.numero || (idx + 1),
            tema: s.temaSemana || s.tema || `Tema ${idx + 1}`,
            indicador: s.codigoIndicador || s.indicador || '',
            inicio: s.sugerenciasInicio || '',
            desarrollo: s.sugerenciasDesarrollo || '',
            cierre: s.sugerenciasCierre || '',
            recursos: s.recursos || 'Material concreto, fichas de trabajo, recursos didácticos.',
            tecnica: s.tecnica || 'Observación sistemática',
            instrumento: s.instrumento || 'Lista de cotejo'
          }))
        : semanas

      const datosPlan = {
        docente_id: user.id,
        institucion_id: docente?.institucion_id,
        asignatura: materiaSeleccionada,
        subnivel: subnivel,
        grado_curso: gradoSeleccionado,
        paralelo: paraleloSeleccionado,
        trimestre: form.trimestre,
        no_semanas: form.noSemanas,
        titulo_sia: data.tituloSia || form.tituloSia,
        descripcion_sia: data.descripcionSia || form.descripcionSia,
        asignaturas_conexion: data.asignaturasConexion || form.asignaturasConexion,
        competencia_especifica: bloquesCompetencias.map(b => b.competencia).filter(Boolean).join(' | '),
        bloques_competencias: bloquesCompetencias,
        semanas: semanasGeneradas
      }

      // 2. Inserción en la base de datos (si algo falló antes de aquí, NO se consume cupo)
      let queryRes = null
      if (planId) {
        queryRes = await supabase.from('planificaciones_microcurriculares').update(datosPlan).eq('id', planId).select().single()
      } else {
        queryRes = await supabase.from('planificaciones_microcurriculares').insert([datosPlan]).select().single()
      }

      if (queryRes.error) throw queryRes.error

      // Actualizar contador visual
      setPlanificacionesHoy(prev => prev + 1)

      const nuevoId = queryRes.data.id
      const formatoParam = formatoImpresion === 'piloto_v2' ? 'actualizado' : 'oficial'
      router.push(`/docente/planificadorpiloto/ver?id=${nuevoId}&formato=${formatoParam}`)

    } catch (e: any) {
      clearTimeout(timeoutId)
      // Si existió error, NO se guarda nada y se notifica al usuario
      if (e.name === 'AbortError') {
        alert('⏱️ La generación tardó más de lo esperado en responder. Tu intento NO fue consumido; por favor intenta nuevamente.')
      } else {
        alert('❌ Error al generar planificación: ' + e.message + '\n\n(Tu cupo diario no fue consumido).')
      }
      setGenerandoIA(false)
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

  const cuposRestantes = Math.max(0, LIMITE_DIARIO - planificacionesHoy)
  const cupoAgotado = cuposRestantes === 0

  return (
    <div className="planificador-app bg-slate-100 min-h-screen p-6 font-sans relative selection:bg-[#4b4c99] selection:text-white">
      
      {generandoIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full mx-4 text-center space-y-4">
            <div className="w-14 h-14 bg-indigo-50 text-[#4b4c99] rounded-2xl mx-auto flex items-center justify-center text-2xl font-black animate-bounce">
              ✨
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                Generando Planificación Inteligente
              </h3>
              <p className="text-xs text-slate-600 font-bold leading-relaxed transition-all duration-300">
                {mensajeEstadoIA}
              </p>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div style={{ backgroundColor: '#4b4c99' }} className="h-full rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex justify-between items-center flex-wrap gap-4">
          <div>
            <Link href="/docente/planificadorpiloto" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold mb-2 transition">
              ← Volver al listado
            </Link>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Nueva microcurricular por competencias (Piloto Zona 6)
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Currículo por Competencias. Elige las competencias del trimestre; la IA arma las semanas secuenciales.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Indicador visual de cupo diario */}
            <div className={`px-4 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              cupoAgotado 
                ? 'bg-rose-50 text-rose-800 border-rose-200' 
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <span className="w-2 h-2 rounded-full bg-current"></span>
              <span>{cupoAgotado ? 'Límite diario alcanzado (5/5)' : `${cuposRestantes} de ${LIMITE_DIARIO} disponibles hoy`}</span>
            </div>

            <button
              type="button"
              onClick={generarYGuardarPlanificacion}
              disabled={generandoIA || cupoAgotado}
              style={{ backgroundColor: cupoAgotado ? '#94a3b8' : '#4b4c99' }}
              className="px-7 py-3.5 text-white font-black text-xs rounded-2xl shadow-md hover:opacity-95 transition active:scale-[0.98] uppercase tracking-wider cursor-pointer border-0 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              <span></span> {generandoIA ? 'Procesando...' : cupoAgotado ? 'Límite alcanzado' : 'Generar planificación'}
            </button>
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xs border border-slate-200/80">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              Contexto curricular
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              
              <div>
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Subnivel</label>
                <select 
                  className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs cursor-pointer text-left"
                  value={subnivel}
                  onChange={(e) => handleSubnivelChange(e.target.value)}
                >
                  {subnivelesDisponibles.map((sub, i) => (
                    <option key={i} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Grado / Curso</label>
                <select 
                  className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs cursor-pointer text-left"
                  value={gradoSeleccionado}
                  onChange={(e) => setGradoSeleccionado(e.target.value)}
                >
                  {gradosVisibles.map((g, i) => (
                    <option key={i} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Asignatura</label>
                <select 
                  className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs cursor-pointer text-left"
                  value={materiaSeleccionada}
                  onChange={(e) => setMateriaSeleccionada(e.target.value)}
                >
                  {materiasVisibles.map((mat, i) => (
                    <option key={i} value={mat}>{mat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Trimestre</label>
                <select 
                  className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs cursor-pointer text-left"
                  value={form.trimestre}
                  onChange={(e) => setForm({...form, trimestre: e.target.value})}
                >
                  <option value="Primer Trimestre">Primer Trimestre</option>
                  <option value="Segundo Trimestre">Segundo Trimestre</option>
                  <option value="Tercer Trimestre">Tercer Trimestre</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Paralelo</label>
                <input 
                  type="text" 
                  className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-black text-slate-900 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs text-left uppercase"
                  value={paraleloSeleccionado}
                  onChange={(e) => setParaleloSeleccionado(e.target.value)}
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">N.° de semanas</label>
                <input 
                  type="number" 
                  min="1"
                  max="12"
                  className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-black text-slate-900 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs text-left"
                  value={form.noSemanas}
                  onChange={(e) => handleNoSemanasChange(e.target.value)}
                />
              </div>

            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xs border border-slate-200/80">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 flex-wrap gap-2">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Competencias específicas
              </h2>
              <button 
                type="button" 
                onClick={agregarBloqueCompetencia}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition border border-indigo-200 cursor-pointer shadow-2xs"
              >
                + Añadir Bloque de Competencia
              </button>
            </div>
            
            <div className="space-y-6">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Marca las competencias de este trimestre. Si dejas indicadores y saberes vacíos, la IA elige 2 o 3 por competencia.
              </p>

              {bloquesCompetencias.map((bloque, idx) => (
                <div key={bloque.id} className="p-5 border-2 border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-700 uppercase">Bloque de Competencia #{idx + 1}</span>
                    {bloquesCompetencias.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => eliminarBloqueCompetencia(bloque.id)}
                        className="text-xs font-bold text-rose-600 hover:underline bg-transparent border-0 cursor-pointer"
                      >
                        Eliminar bloque
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Competencia:</label>
                    <select 
                      className="w-full p-3.5 border-2 border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs cursor-pointer"
                      value={bloque.competencia}
                      onChange={(e) => actualizarBloqueCompetencia(bloque.id, e.target.value)}
                    >
                      <option value="">-- Seleccionar competencia de la matriz --</option>
                      {competenciasDisponibles.map((comp, i) => (
                        <option key={i} value={comp}>{comp}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-50/40 p-6 rounded-3xl shadow-xs border-2 border-indigo-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                Elige indicadores y saberes: 
                <button 
                  type="button" 
                  onClick={() => setMostrarIndicadoresManuales(!mostrarIndicadoresManuales)}
                  className="text-indigo-600 underline font-bold cursor-pointer bg-transparent border-0 text-xs"
                >
                  Cambiar
                </button>
              </span>
              <button 
                type="button" 
                onClick={() => setMostrarIndicadoresManuales(!mostrarIndicadoresManuales)}
                className="text-xs text-indigo-600 font-bold bg-transparent border-0 cursor-pointer flex items-center gap-1"
              >
                {mostrarIndicadoresManuales ? 'Ocultar ∧' : 'Ocultar ∨'}
              </button>
            </div>
            
            {mostrarIndicadoresManuales && (
              <div className="mt-4 p-6 bg-white rounded-2xl text-xs space-y-6 border border-indigo-100 shadow-md">
                <div className="border-b pb-2">
                  <h4 className="font-black text-slate-800 text-sm">Selección Manual 1 a 1 de Indicadores y Saberes</h4>
                  <p className="text-slate-500 text-[11px]">Marca individualmente cada ítem curricular.</p>
                </div>

                {bloquesCompetencias.map((bloque, bIndex) => (
                  <div key={bloque.id} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h5 className="font-bold text-indigo-900 text-xs uppercase">
                      Bloque #{bIndex + 1}: {bloque.competencia || 'Seleccione una competencia arriba'}
                    </h5>

                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 block uppercase text-[10px]">Indicadores de Evaluación:</span>
                      {bloque.indicadoresDisponibles.map((ind, i) => (
                        <label key={i} className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                          <input 
                            type="checkbox" 
                            checked={bloque.indicadoresSeleccionados.includes(ind)}
                            onChange={() => toggleSeleccion(bloque.id, 'indicadoresSeleccionados', ind)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer shrink-0"
                          />
                          <span className="text-slate-800 font-medium leading-relaxed">{ind}</span>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-amber-700 block uppercase text-[10px]">Saberes Declarativos:</span>
                      {bloque.declarativosDisponibles.map((sab, i) => (
                        <label key={i} className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                          <input 
                            type="checkbox" 
                            checked={bloque.declarativosSeleccionados.includes(sab)}
                            onChange={() => toggleSeleccion(bloque.id, 'declarativosSeleccionados', sab)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 cursor-pointer shrink-0"
                          />
                          <span className="text-slate-800 font-medium leading-relaxed">{sab}</span>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-teal-700 block uppercase text-[10px]">Saberes Procedimentales:</span>
                      {bloque.procedimentalesDisponibles.map((sab, i) => (
                        <label key={i} className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                          <input 
                            type="checkbox" 
                            checked={bloque.procedimentalesSeleccionados.includes(sab)}
                            onChange={() => toggleSeleccion(bloque.id, 'procedimentalesSeleccionados', sab)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 cursor-pointer shrink-0"
                          />
                          <span className="text-slate-800 font-medium leading-relaxed">{sab}</span>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-rose-700 block uppercase text-[10px]">Saberes Actitudinales:</span>
                      {bloque.actitudinalesDisponibles.map((sab, i) => (
                        <label key={i} className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                          <input 
                            type="checkbox" 
                            checked={bloque.actitudinalesSeleccionados.includes(sab)}
                            onChange={() => toggleSeleccion(bloque.id, 'actitudinalesSeleccionados', sab)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 cursor-pointer shrink-0"
                          />
                          <span className="text-slate-800 font-medium leading-relaxed">{sab}</span>
                        </label>
                      ))}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xs border border-slate-200/80">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              Datos administrativos
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Formato Word / PDF</label>
                  <select 
                    className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs cursor-pointer"
                    value={formatoImpresion}
                    onChange={(e) => setFormatoImpresion(e.target.value as any)}
                  >
                    <option value="piloto_oficial">Formato piloto oficial (inicio / desarrollo / cierre)</option>
                    <option value="piloto_v2">Formato actualizado (semana / fase)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Título</label>
                  <input 
                    type="text" 
                    value={form.tituloSia}
                    onChange={(e) => setForm({...form, tituloSia: e.target.value})}
                    className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition shadow-2xs" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Situación de aprendizaje <span className="text-orange-600 font-bold uppercase text-[9px]">Opcional</span></label>
                <textarea 
                  rows={2} 
                  value={form.descripcionSia}
                  onChange={(e) => setForm({...form, descripcionSia: e.target.value})}
                  placeholder="Opcional. Si lo dejas vacío, la IA redacta la descripción del trimestre." 
                  className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition resize-none shadow-2xs"
                ></textarea>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">Temas del trimestre <span className="text-orange-600 font-bold uppercase text-[9px]">Opcional</span></label>
                <textarea 
                  rows={2} 
                  value={form.asignaturasConexion}
                  onChange={(e) => setForm({...form, asignaturasConexion: e.target.value})}
                  placeholder="Escribe un tema por línea..." 
                  className="w-full p-3.5 border-2 border-slate-300 rounded-2xl text-xs font-semibold text-slate-800 bg-white focus:border-[#4b4c99] outline-none transition resize-none shadow-2xs"
                ></textarea>
              </div>

            </div>
          </div>

          <div className="flex justify-end items-center gap-3 pt-3">
            <Link 
              href="/docente/planificadorpiloto" 
              className="px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl border-2 border-slate-300 transition text-center shadow-2xs flex items-center justify-center"
            >
              Cancelar
            </Link>
            <button 
              type="button"
              onClick={generarYGuardarPlanificacion}
              disabled={generandoIA || cupoAgotado}
              style={{ backgroundColor: cupoAgotado ? '#94a3b8' : '#4b4c99' }}
              className="px-9 py-3.5 text-white font-black text-xs rounded-2xl shadow-lg hover:opacity-95 transition active:scale-[0.98] uppercase tracking-wider cursor-pointer border-0 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              <span></span> {generandoIA ? 'Generando...' : cupoAgotado ? 'Límite alcanzado' : 'Generar planificación'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}