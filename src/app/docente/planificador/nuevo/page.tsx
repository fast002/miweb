'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function FormularioPlanificacionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planIdEditar = searchParams.get('id')

  // Estados de carga y feedback
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [generandoIa, setGenerandoIa] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null)

  // Datos del perfil docente e institución
  const [docenteId, setDocenteId] = useState('')
  const [institucionId, setInstitucionId] = useState('')
  const [nombreDocente, setNombreDocente] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [gradoAsignado, setGradoAsignado] = useState('')

  // Control Dinámico de Años Lectivos Sincronizado con la Institución y el Rector
  const [anioLectivoActivo, setAnioLectivoActivo] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])
  const [esAnioCerrado, setEsAnioCerrado] = useState(false)

  // Lista de asignaciones permitidas para el docente actual
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])

  // Selección de Modelo
  const [tipoModelo, setTipoModelo] = useState<'trimestral_disciplinar' | 'multigrado_eje'>('trimestral_disciplinar')

  // Datos comunes informativos
  const [titulo, setTitulo] = useState('')
  const [subnivel, setSubnivel] = useState('Básica Media')
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('A')
  const [asignatura, setAsignatura] = useState('')
  const [ejeTematico, setEjeTematico] = useState('1. El Yo y la Identidad')
  
  // Fechas de inicio y fin para el Modelo 1
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')

  const [observacionRector, setObservacionRector] = useState<string | null>(null)

  // Campos pedagógicos para Modelo 1
  const [objetivos, setObjetivos] = useState('')
  const [criterios, setCriterios] = useState('')
  const [indicadores, setIndicadores] = useState('')
  const [estrategiasDua, setEstrategiasDua] = useState('')
  const [evaluacion, setEvaluacion] = useState('')

  // Estructura multigrado para Modelo 2 (Desglosada por los 3 grados)
  const [contenidoMultigrado, setContenidoMultigrado] = useState<any[]>([
    { indicadores: '', orientaciones: '', evaluacion: '' },
    { indicadores: '', orientaciones: '', evaluacion: '' },
    { indicadores: '', orientaciones: '', evaluacion: '' }
  ])

  useEffect(() => {
    cargarDatosIniciales()
  }, [planIdEditar])

  // Función para calcular dinámicamente los nombres de los 3 grados según el curso seleccionado
  const obtenerGradosSubnivel = (cursoSeleccionado: string) => {
    if (cursoSeleccionado.includes('2do') || cursoSeleccionado.includes('3ro') || cursoSeleccionado.includes('4to') || cursoSeleccionado.includes('Elemental')) {
      return ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB']
    } else if (cursoSeleccionado.includes('5to') || cursoSeleccionado.includes('6to') || cursoSeleccionado.includes('7mo') || cursoSeleccionado.includes('Media')) {
      return ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB']
    } else if (cursoSeleccionado.includes('8vo') || cursoSeleccionado.includes('9no') || cursoSeleccionado.includes('10mo') || cursoSeleccionado.includes('Superior')) {
      return ['8vo EGB', '9no EGB', '10mo EGB']
    } else if (cursoSeleccionado.includes('BGU') || cursoSeleccionado.includes('BT')) {
      return ['1ro Curso', '2do Curso', '3ro Curso']
    }
    return ['Grado 1', 'Grado 2', 'Grado 3']
  }

  const gradosActuales = obtenerGradosSubnivel(grado || '5to Grado EGB')

  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return router.push('/')

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', userData.user.id)
        .maybeSingle()

      let anioActivo = ''
      let cerradosList: string[] = []
      let periodosList: string[] = []

      if (doc) {
        setDocenteId(doc.id)
        setInstitucionId(doc.institucion_id)
        setNombreDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim() || 'Docente')
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setGradoAsignado(doc.grado_asignado || 'Básica Elemental / Media')

        // CARGAR EL LOGO CORRECTAMENTE DESDE EL BUCKET "instituciones" DE SUPABASE
        const rawLogo = doc.instituciones?.logo_url || ''
        if (rawLogo) {
          if (rawLogo.startsWith('http://') || rawLogo.startsWith('https://')) {
            setInstitucionLogo(rawLogo)
          } else {
            const nombreArchivo = rawLogo.includes('/') ? rawLogo.split('/').pop() : rawLogo
            const { data: publicUrlData } = supabase.storage
              .from('instituciones')
              .getPublicUrl(nombreArchivo || rawLogo)
            
            setInstitucionLogo(publicUrlData?.publicUrl || '')
          }
        }

        // Sincronizar año lectivo activo institucional y años cerrados dinámicamente desde la institución
        const inst = doc.instituciones
        if (inst) {
          periodosList = inst.periodos_disponibles || []
          setPeriodosDisponibles(periodosList)

          if (inst.anio_lectivo_activo && periodosList.includes(inst.anio_lectivo_activo)) {
            anioActivo = inst.anio_lectivo_activo
          } else if (periodosList.length > 0) {
            anioActivo = periodosList[0]
          }

          setAnioLectivoActivo(anioActivo)

          if (inst.anos_cerrados && Array.isArray(inst.anos_cerrados)) {
            cerradosList = inst.anos_cerrados
            setAnosCerrados(cerradosList)
            if (anioActivo && cerradosList.includes(anioActivo)) {
              setEsAnioCerrado(true)
            }
          }
        }

        if (anioActivo) {
          const { data: asigs } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', doc.id)
            .eq('anio_lectivo', anioActivo)

          if (asigs && asigs.length > 0) {
            setMisAsignaciones(asigs)
            if (!planIdEditar) {
              setGrado(asigs[0].grado_curso)
              setParalelo(asigs[0].paralelo)
              setAsignatura(asigs[0].asignatura)
              actualizarSubnivelAutomatico(asigs[0].grado_curso)
            }
          }
        }
      } else {
        setDocenteId(userData.user.id)
        setNombreDocente('Docente')
      }

      if (planIdEditar) {
        const { data: planToEdit, error } = await supabase
          .from('planificaciones')
          .select('*')
          .eq('id', planIdEditar)
          .maybeSingle()

        if (!error && planToEdit) {
          setTipoModelo(planToEdit.tipo_modelo || 'trimestral_disciplinar')
          setTitulo(planToEdit.titulo_planificación || planToEdit.tema || '')
          setSubnivel(planToEdit.subnivel || 'Básica Media')
          const gradoGuardado = planToEdit.grado_curso || planToEdit.grado || ''
          setGrado(gradoGuardado)
          setParalelo(planToEdit.paralelo || 'A')
          setAsignatura(planToEdit.asignatura || '')
          setEjeTematico(planToEdit.eje_tematico || '1. El Yo y la Identidad')
          
          setFechaInicio(planToEdit.fecha_inicio || '')
          setFechaFin(planToEdit.fecha_fin || '')

          setObjetivos(planToEdit.objetivos_aprendizaje || planToEdit.objetivos || '')
          setCriterios(planToEdit.criterios_evaluacion || planToEdit.criterios || '')
          setIndicadores(planToEdit.indicadores_evaluacion || planToEdit.indicadores || '')
          setEstrategiasDua(planToEdit.estrategias_dua || '')
          setEvaluacion(planToEdit.actividades_evaluacion || planToEdit.evaluacion || '')
          
          if (planToEdit.contenido_multigrado && Array.isArray(planToEdit.contenido_multigrado)) {
            setContenidoMultigrado(planToEdit.contenido_multigrado)
          }

          setObservacionRector(planToEdit.observaciones_rector || null)
          actualizarSubnivelAutomatico(gradoGuardado)
        }
      }
    } catch (err) {
      console.error('Error al cargar datos iniciales:', err)
    } finally {
      setCargando(false)
    }
  }

  // Manejar cambio dinámico del periodo desde el selector superior si se desea cambiar de histórico
  const handleCambiarPeriodo = async (nuevoAnio: string) => {
    setAnioLectivoActivo(nuevoAnio)
    setEsAnioCerrado(anosCerrados.includes(nuevoAnio))
    if (docenteId && nuevoAnio) {
      const { data: asignacionesData } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', docenteId)
        .eq('anio_lectivo', nuevoAnio)

      if (asignacionesData && asignacionesData.length > 0) {
        setMisAsignaciones(asignacionesData)
        setGrado(asignacionesData[0].grado_curso)
        setParalelo(asignacionesData[0].paralelo)
        setAsignatura(asignacionesData[0].asignatura)
        actualizarSubnivelAutomatico(asignacionesData[0].grado_curso)
      } else {
        setMisAsignaciones([])
        setGrado('')
        setParalelo('')
        setAsignatura('')
      }
    }
  }

  const actualizarSubnivelAutomatico = (cursoSeleccionado: string) => {
    if (!cursoSeleccionado) return

    if (['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'].includes(cursoSeleccionado)) {
      setSubnivel('Básica Elemental')
    } else if (['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(cursoSeleccionado)) {
      setSubnivel('Básica Media')
    } else if (['8vo EGB', '9no EGB', '10mo EGB'].includes(cursoSeleccionado)) {
      setSubnivel('Básica Superior')
    } else {
      setSubnivel('Bachillerato')
    }
  }

  const handleCambiarGradoManual = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoGrado = e.target.value
    setGrado(nuevoGrado)
    actualizarSubnivelAutomatico(nuevoGrado)
  }

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleGenerarConIA = async () => {
    if (esAnioCerrado) {
      setMensaje({ tipo: 'error', texto: 'Este año lectivo está cerrado. No se pueden generar nuevas planificaciones.' })
      return
    }

    if (!titulo.trim()) {
      setMensaje({ tipo: 'error', texto: 'Por favor, escribe primero el Título o Tema de la Clase.' })
      return
    }

    setGenerandoIa(true)
    setMensaje({ tipo: 'info', texto: 'La IA está estructurando la planificación oficial en la matriz normada...' })

    // PROMPT REFORZADO Y ADAPTADO PARA AMBOS MODELOS (EVITANDO CÓDIGOS CE. EN FAVOR DE DCD)
    const promptSistemaPredeterminado = `
Actúa como un experto metodólogo y docente del Ministerio de Educación de Ecuador. 
Tu objetivo es generar una planificación microcurricular estructurada estrictamente bajo el formato normado y oficial ecuatoriano.

Recibirás los siguientes datos:
- Modelo seleccionado: ${tipoModelo === 'multigrado_eje' ? 'Modelo 2: Multigrado por Ejes Temáticos' : 'Modelo 1: Trimestral Disciplinar'}
- Tema o Título de la clase: ${titulo}
- Subnivel educativo: ${subnivel}
- Grado o Curso: ${grado}
- Asignatura: ${asignatura}
- Eje temático: ${ejeTematico || 'N/A'}

REGLA CRÍTICA E INQUEBRANTABLE SOBRE LOS CÓDIGOS:
- Bajo ningún concepto incluyas Criterios de Evaluación (los códigos que empiezan con "CE.", por ejemplo: CE.M.2.1, CE.LL.4.8). 
- Únicamente debes extraer y colocar **Destrezas con Criterio de Desempeño (DCD)** acompañadas de su código curricular oficial (por ejemplo: LL.4.5.1, M.2.1.2, CN.2.1.2). Esto aplica estrictamente para cualquier modelo seleccionado (incluyendo el Modelo Multigrado).

Debes responder exclusivamente en un formato JSON limpio (sin bloques de código markdown adicionales como \`\`\`json) que contenga los siguientes campos:
1. "objetivos": Objetivos de aprendizaje claros y medibles alineados al tema.
2. "criterios": Únicamente las Destrezas con Criterio de Desempeño (DCD) con sus respectivos códigos curriculares específicos (Ej: M.2.1.2. Describir y reproducir patrones...).
3. "indicadores": Indicadores de evaluación correspondientes que se relacionen directamente con las DCD seleccionadas.
4. "estrategiasDua": Actividades metodológicas activas estructuradas bajo el ciclo de aprendizaje ERCA (Experiencia, Reflexión, Conceptualización, Aplicación) integrando pautas DUA.
5. "evaluacion": Actividades e instrumentos de evaluación formativa y sumativa.
6. "grados": (Solo para el Modelo Multigrado) Array con la estructura exacta para los 3 grados del subnivel.
`;

    try {
      const res = await fetch('/api/generar-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoModelo,
          tema: titulo,
          subnivel,
          grado,
          asignatura,
          ejeTematico,
          promptSistema: promptSistemaPredeterminado
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al comunicarse con la IA')

      if (tipoModelo === 'multigrado_eje') {
        setObjetivos(data.objetivos || '')
        setCriterios(data.criterios || '')
        setEvaluacion(data.evaluacion || '')
        if (data.grados && Array.isArray(data.grados)) {
          setContenidoMultigrado(data.grados)
        }
      } else {
        setObjetivos(data.objetivos || '')
        setCriterios(data.criterios || '')
        setIndicadores(data.indicadores || '')
        setEstrategiasDua(data.estrategiasDua || '')
        setEvaluacion(data.evaluacion || '')
      }

      setMensaje({ tipo: 'exito', texto: '✨ ¡Planificación redactada con éxito por la IA en el formato normado!' })
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setGenerandoIa(false)
    }
  }

  const handleGuardarPlanificacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (esAnioCerrado) {
      setMensaje({ tipo: 'error', texto: '🔒 Este año lectivo está cerrado. No se pueden guardar cambios.' })
      return
    }

    if (!anioLectivoActivo) {
      setMensaje({ tipo: 'error', texto: '⚠️ No hay un año lectivo activo seleccionado. Por favor, asegúrese de que el rector haya configurado el periodo.' })
      return
    }

    setGuardando(true)
    setMensaje(null)

    if (!grado || !asignatura || !paralelo) {
      setMensaje({ tipo: 'error', texto: 'Por favor, selecciona un Curso, Asignatura y Paralelo válidos.' })
      setGuardando(false)
      return
    }

    try {
      const payload: any = {
        docente_id: docenteId,
        institucion_id: institucionId,
        tipo_modelo: tipoModelo,
        eje_tematico: tipoModelo === 'multigrado_eje' ? ejeTematico : null,
        titulo_planificación: titulo.trim(),
        tema: titulo.trim(),
        subnivel,
        grado_curso: grado,
        grado: grado,
        paralelo,
        asignatura,
        anio_lectivo: anioLectivoActivo,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        objetivos_aprendizaje: objetivos,
        objetivos: objetivos,
        criterios_evaluacion: criterios,
        criterios: criterios,
        indicadores_evaluacion: indicadores,
        indicadores: indicadores,
        estrategias_dua: estrategiasDua,
        actividades_evaluacion: evaluacion,
        evaluacion: evaluacion,
        contenido_multigrado: contenidoMultigrado,
        estado: 'borrador'
      }

      let errorInsertUpdate = null

      if (planIdEditar) {
        const { error } = await supabase
          .from('planificaciones')
          .update(payload)
          .eq('id', planIdEditar)
        errorInsertUpdate = error
      } else {
        payload.created_at = new Date().toISOString()
        const { error } = await supabase
          .from('planificaciones')
          .insert([payload])
        errorInsertUpdate = error
      }

      if (errorInsertUpdate) throw errorInsertUpdate

      setMensaje({ 
        tipo: 'exito', 
        texto: planIdEditar 
          ? '¡Planificación actualizada con éxito! Redirigiendo a tus planificaciones...' 
          : '¡Planificación guardada con éxito! Redirigiendo a tus planificaciones...' 
      })

      setTimeout(() => {
        router.push('/docente/planificador')
      }, 1000)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + err.message })
      setGuardando(false)
    }
  }

  if (cargando) return <div className="p-8 text-center font-semibold text-slate-600">Cargando Planificador...</div>

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-md p-6 md:p-8 space-y-6">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              {planIdEditar ? 'Edición / Corrección de Planificación' : 'Creación de Nueva Planificación'}
            </h1>
            <div className="text-sm font-bold text-blue-700 mt-1 flex items-center gap-2 flex-wrap">
              <span>Bienvenido, @{nombreDocente}</span>
              {/* SELECTOR O INDICADOR VISUAL DINÁMICO DEL AÑO LECTIVO */}
              <div className="bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 flex items-center gap-1.5 inline-flex">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Periodo:</span>
                {periodosDisponibles.length === 0 ? (
                  <span className="text-xs font-bold text-amber-600 italic">Sin años creados</span>
                ) : (
                  <select
                    value={anioLectivoActivo}
                    onChange={(e) => handleCambiarPeriodo(e.target.value)}
                    className="bg-transparent text-xs font-black text-indigo-700 outline-none cursor-pointer"
                  >
                    {periodosDisponibles.map(p => (
                      <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-xs font-semibold text-slate-600">
              <span className="bg-slate-100 px-3 py-1 rounded-full border">
              Institución: <strong className="text-slate-800">{nombreInstitucion}</strong>
              </span>
              <span className="bg-slate-100 px-3 py-1 rounded-full border">
              Nivel: <strong className="text-slate-800">{gradoAsignado}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => router.push('/planificador')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-300"
            >
              ← Volver a Mis Planificaciones
            </button>
          </div>
        </div>

        {/* AVISO SI NO HAY AÑO ACTIVO */}
        {!anioLectivoActivo && !cargando && (
          <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-xs font-bold">
            La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
          </div>
        )}

        {/* AVISO SI EL AÑO ESTÁ CERRADO */}
        {esAnioCerrado && anioLectivoActivo && (
          <div className="p-4 bg-red-50 border border-red-300 text-red-900 rounded-2xl text-xs font-bold">
            El año lectivo activo ({anioLectivoActivo}) se encuentra cerrado y bloqueado por la Dirección. Esta planificación está en modo de solo lectura.
          </div>
        )}

        {/* ALERTA SI VIENE CON OBSERVACIONES DE LA AUTORIDAD */}
        {observacionRector && (
          <div className="p-4 bg-red-50 border border-red-300 text-red-900 rounded-2xl text-xs space-y-1 shadow-sm">
            <strong className="block font-bold text-sm uppercase">Observaciones de Corrección del Rector/a:</strong>
            <p className="whitespace-pre-wrap">{observacionRector}</p>
          </div>
        )}

        {/* NOTIFICACIONES */}
        {mensaje && (
          <div className={`p-4 rounded-xl text-sm font-medium border ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
            mensaje.tipo === 'info' ? 'bg-blue-50 text-blue-900 border-blue-200 animate-pulse' :
            'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {/* SELECTOR DE MODELO DE PLANIFICACIÓN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setTipoModelo('trimestral_disciplinar')}
            className={`p-4 rounded-xl border text-left font-bold transition ${
              tipoModelo === 'trimestral_disciplinar' 
                ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500' 
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Modelo 1: Trimestral Disciplinar
            <p className="text-xs font-normal text-slate-500 mt-1">Matriz Oficial con Competencias del Currículo e Inserciones Curriculares.</p>
          </button>

          <button
            type="button"
            onClick={() => setTipoModelo('multigrado_eje')}
            className={`p-4 rounded-xl border text-left font-bold transition ${
              tipoModelo === 'multigrado_eje' 
                ? 'bg-purple-50 border-purple-600 text-purple-900 ring-2 ring-purple-500' 
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Modelo 2: Multigrado por Ejes Temáticos
            <p className="text-xs font-normal text-slate-500 mt-1">Especial para escuelas unidocentes o multigrado con matriz por grado.</p>
          </button>
        </div>

        <form onSubmit={handleGuardarPlanificacion} className="space-y-6">
          
          {/* DATOS INFORMATIVOS LIMPIOS Y ORDENADOS */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <h2 className="font-bold text-slate-800 text-sm uppercase">1. Datos Informativos Generales</h2>
            
            {tipoModelo === 'multigrado_eje' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Eje Temático</label>
                <input 
                  type="text" 
                  value={ejeTematico} 
                  onChange={(e) => setEjeTematico(e.target.value)}
                  placeholder="Ej: 1. El Yo y la Identidad"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-purple-500 outline-none text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Tema / Unidad Didáctica</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    required 
                    value={titulo} 
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ej: Reconocer elementos en textos de literatura oral"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleGenerarConIA}
                    disabled={generandoIa || esAnioCerrado || !anioLectivoActivo}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 rounded-lg whitespace-nowrap transition disabled:opacity-50 text-xs shadow flex items-center gap-1"
                  >
                    ✨ {generandoIa ? 'Redactando...' : 'Generar con IA'}
                  </button>
                </div>
              </div>

              {/* SUBNIVEL BLOQUEADO QUE CAMBIA AUTOMÁTICAMENTE */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Subnivel (Automático)</label>
                <input 
                  type="text" 
                  disabled
                  value={subnivel} 
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-200 text-slate-700 font-bold outline-none text-xs cursor-not-allowed" 
                />
              </div>

              {/* GRADO / CURSO COMO DESPLEGABLE BASADO EN ASIGNACIONES */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Grado(s) / Curso(s)</label>
                {misAsignaciones.length > 0 ? (
                  <select 
                    value={grado} 
                    onChange={handleCambiarGradoManual}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  >
                    <option value="">-- Selecciona el Grado/Curso --</option>
                    {Array.from(new Set(misAsignaciones.map(a => a.grado_curso))).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={grado} 
                    onChange={(e) => setGrado(e.target.value)} 
                    placeholder="No tienes asignaciones del rector aún"
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none text-xs" 
                  />
                )}
              </div>

              {/* ASIGNATURA COMO DESPLEGABLE BASADO EN ASIGNACIONES */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Asignatura</label>
                {misAsignaciones.length > 0 ? (
                  <select 
                    value={asignatura} 
                    onChange={(e) => setAsignatura(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  >
                    <option value="">-- Selecciona la Asignatura --</option>
                    {misAsignaciones
                      .filter(a => !grado || a.grado_curso === grado)
                      .map(a => (
                        <option key={a.id} value={a.asignatura}>{a.asignatura}</option>
                      ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={asignatura} 
                    onChange={(e) => setAsignatura(e.target.value)} 
                    placeholder="Asignatura..."
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none text-xs" 
                  />
                )}
              </div>

              {/* PARALELO COMO DESPLEGABLE BASADO EN ASIGNACIONES */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Paralelo</label>
                {misAsignaciones.length > 0 ? (
                  <select 
                    value={paralelo} 
                    onChange={(e) => setParalelo(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  >
                    <option value="">-- Selecciona el Paralelo --</option>
                    {Array.from(new Set(misAsignaciones.map(a => a.paralelo))).map(p => (
                      <option key={p} value={p}>Paralelo {p}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={paralelo} 
                    onChange={(e) => setParalelo(e.target.value)} 
                    placeholder="A"
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none text-xs" 
                  />
                )}
              </div>

              {/* FECHA INICIO Y FECHA FIN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Fecha de Inicio</label>
                <input 
                  type="date" 
                  value={fechaInicio} 
                  onChange={(e) => setFechaInicio(e.target.value)} 
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none text-xs" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Fecha de Fin</label>
                <input 
                  type="date" 
                  value={fechaFin} 
                  onChange={(e) => setFechaFin(e.target.value)} 
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none text-xs" 
                />
              </div>

            </div>
          </div>

          {/* DESARROLLO PEDAGÓGICO */}
          <div className="space-y-3">
            <h2 className="font-bold text-slate-800 text-sm uppercase">2. Desarrollo Pedagógico (Vista Oficial de Impresión)</h2>

            {tipoModelo === 'trimestral_disciplinar' ? (
              <div className="bg-white border border-black space-y-0 text-black font-sans text-xs rounded-lg overflow-hidden shadow-sm">
                
                {/* CABECERA CON LOGO INSTITUCIONAL DINÁMICO */}
                <table className="w-full border-collapse border-b border-black text-center text-xs">
                  <tbody>
                    <tr>
                      <td className="w-1/5 border-r border-black p-2 text-center align-middle">
                        {institucionLogo ? (
                          <img src={institucionLogo} alt="Logo Institución" className="w-12 h-12 object-contain mx-auto" />
                        ) : (
                          <span className="font-bold text-[10px]">LOGO</span>
                        )}
                      </td>
                      <td className="w-3/5 border-r border-black p-2 font-bold">
                        <p className="text-sm font-black uppercase">{nombreInstitucion || 'UNIDAD EDUCATIVA'}</p>
                        <p className="text-[10px] font-normal">Resolución Nro. 089-DDE-03D01-2014</p>
                        <p className="text-[10px] font-normal uppercase">EDUCACION INICIAL – EGB – BGU – BACHILLERATO TÉCNICO</p>
                      </td>
                      <td className="w-1/5 p-2 text-right font-black italic text-blue-900 text-sm align-middle">
                        EL NUEVO ECUADOR
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="border-b border-black text-center font-black text-xs uppercase py-1 bg-slate-100 text-blue-900">
                  PLANIFICACION MICROCURRICULAR POR TRIMESTRE
                </div>

                {/* TABLA DE DATOS INFORMATIVOS CON FECHA INICIO Y FIN */}
                <table className="w-full border-collapse border-b border-black text-xs text-left">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-2 font-bold uppercase w-1/4 border-r border-black">SUBNIVEL:</td>
                      <td className="p-2">{subnivel}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-2 font-bold uppercase border-r border-black">PARALELO:</td>
                      <td className="p-2">{paralelo}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-2 font-bold uppercase border-r border-black">FECHA INICIO:</td>
                      <td className="p-2">{fechaInicio ? new Date(fechaInicio + 'T00:00:00').toLocaleDateString() : '--/--/----'}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold uppercase border-r border-black">FECHA FIN:</td>
                      <td className="p-2">{fechaFin ? new Date(fechaFin + 'T00:00:00').toLocaleDateString() : '--/--/----'}</td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full border-collapse border-b border-black text-xs">
                  <thead>
                    <tr className="bg-blue-200 border-b border-black text-[10px] font-bold text-slate-900 uppercase">
                      <th className="w-1/2 border-r border-black p-1 text-left">COMPETENCIAS DEL CURRICULO PRIORIZADO</th>
                      <th className="w-1/2 p-1 text-left">INSERCIONES CURRICULARES</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-black p-2 align-top text-[11px] space-y-1">
                        <p>• Competencia comunicacional.</p>
                        <p>• Competencia matemática.</p>
                        <p>• Competencia digital.</p>
                        <p>• Competencia socioemocional.</p>
                      </td>
                      <td className="p-2 align-top text-[11px] space-y-1">
                        <p>• Educación Cívica, Ética e integral.</p>
                        <p>• Educación para el Desarrollo Sostenible.</p>
                        <p>• Educación Socioemocional.</p>
                        <p>• Educación Financiera.</p>
                        <p>• Educación para la Seguridad Vial y Movilidad Sostenible.</p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="border-b border-black text-center font-bold text-xs uppercase py-1 bg-slate-100">
                  APRENDIZAJE DISCIPLINAR
                </div>

                <div className="border-b border-black p-2 text-xs">
                  <label className="block font-bold text-slate-700 uppercase mb-1">OBJETIVOS DE APRENDIZAJE:</label>
                  <textarea 
                    rows={2} 
                    value={objetivos} 
                    onChange={(e) => setObjetivos(e.target.value)} 
                    disabled={esAnioCerrado || !anioLectivoActivo}
                    placeholder="Escribe o genera objetivos..."
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs outline-none focus:bg-white disabled:bg-slate-100"
                  />
                </div>

                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-blue-200 border-b border-black text-[10px] font-bold text-slate-900 uppercase">
                      <th className="w-1/4 border-r border-black p-2 text-left">DESTREZAS CON CRITERIOS DE DESEMPEÑO</th>
                      <th className="w-1/4 border-r border-black p-2 text-left">INDICADORES DE EVALUACIÓN</th>
                      <th className="w-1/3 border-r border-black p-2 text-left">ESTRATEGIAS METODOLÓGICAS ACTIVAS (DUA/ERCA)</th>
                      <th className="w-1/6 p-2 text-left">ACTIVIDADES EVALUATIVAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-black p-2 align-top">
                        <textarea 
                          rows={6} 
                          value={criterios} 
                          onChange={(e) => setCriterios(e.target.value)} 
                          disabled={esAnioCerrado || !anioLectivoActivo}
                          placeholder="Destrezas..."
                          className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs outline-none focus:bg-white disabled:bg-slate-100"
                        />
                      </td>
                      <td className="border-r border-black p-2 align-top">
                        <textarea 
                          rows={6} 
                          value={indicadores} 
                          onChange={(e) => setIndicadores(e.target.value)} 
                          disabled={esAnioCerrado || !anioLectivoActivo}
                          placeholder="Indicadores..."
                          className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs outline-none focus:bg-white disabled:bg-slate-100"
                        />
                      </td>
                      <td className="border-r border-black p-2 align-top font-mono">
                        <textarea 
                          rows={6} 
                          value={estrategiasDua} 
                          onChange={(e) => setEstrategiasDua(e.target.value)} 
                          disabled={esAnioCerrado || !anioLectivoActivo}
                          placeholder="Estrategias DUA / ERCA..."
                          className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs outline-none focus:bg-white disabled:bg-slate-100"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <textarea 
                          rows={6} 
                          value={evaluacion} 
                          onChange={(e) => setEvaluacion(e.target.value)} 
                          disabled={esAnioCerrado || !anioLectivoActivo}
                          placeholder="Actividades e instrumentos..."
                          className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs outline-none focus:bg-white disabled:bg-slate-100"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-black space-y-0 text-black font-sans text-xs rounded-lg overflow-hidden shadow-sm">
                
                {/* CABECERA MULTIGRADO CON LOGO INSTITUCIONAL DINÁMICO */}
                <table className="w-full border-collapse border-b border-black text-xs">
                  <tbody>
                    <tr>
                      <td className="w-1/4 border-r border-black p-2 text-center align-middle">
                        {institucionLogo ? (
                          <img src={institucionLogo} alt="Logo Institución" className="w-12 h-12 object-contain mx-auto" />
                        ) : (
                          <span className="font-bold text-[10px]">LOGO</span>
                        )}
                      </td>
                      <td className="w-3/4 p-2 text-right align-middle">
                        <p className="text-lg font-black uppercase text-blue-900">MINISTERIO DE EDUCACIÓN</p>
                        <p className="text-xs font-bold uppercase">PLANIFICACIÓN MICROCURRICULAR - Multigrado</p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="bg-amber-200 border-b border-black text-center font-black text-xs uppercase py-1 text-slate-900">
                  EJE TEMÁTICO: {ejeTematico || '1. El Yo y la Identidad'}
                </div>

                {/* MATRIZ MULTIGRADO EXACTA */}
                <table className="w-full border-collapse text-xs border-black">
                  <thead>
                    <tr className="bg-blue-100 border-b border-black text-[10px] font-bold text-slate-900 uppercase text-center">
                      <th className="w-1/4 border-r border-black p-2" rowSpan={2}>
                        DESTREZAS CON CRITERIOS DE DESEMPEÑO
                      </th>
                      <th className="w-2/5 border-r border-black p-1" colSpan={3}>
                        INDICADORES DE EVALUACIÓN Y/O LOGRO
                      </th>
                      <th className="w-2/5 border-r border-black p-1" colSpan={3}>
                        ORIENTACIONES METODOLÓGICAS (ERCA)
                      </th>
                      <th className="w-1/6 p-2" rowSpan={2}>
                        Actividades Evaluativas
                      </th>
                    </tr>
                    <tr className="bg-blue-200 border-b border-black text-[9px] font-bold text-slate-900 uppercase text-center">
                      <th className="border-r border-black p-1">{gradosActuales[0]}</th>
                      <th className="border-r border-black p-1">{gradosActuales[1]}</th>
                      <th className="border-r border-black p-1">{gradosActuales[2]}</th>
                      <th className="border-r border-black p-1">{gradosActuales[0]}</th>
                      <th className="border-r border-black p-1">{gradosActuales[1]}</th>
                      <th className="border-r border-black p-1">{gradosActuales[2]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-black p-2 align-top">
                        <textarea 
                          rows={14} 
                          value={criterios} 
                          onChange={(e) => setCriterios(e.target.value)} 
                          disabled={esAnioCerrado || !anioLectivoActivo}
                          placeholder="Destrezas comunes..."
                          className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-[11px] outline-none disabled:bg-slate-100"
                        />
                      </td>

                      {[0, 1, 2].map((idx) => (
                        <td key={`ind-${idx}`} className="border-r border-black p-1.5 align-top">
                          <textarea
                            rows={14}
                            value={contenidoMultigrado?.[idx]?.indicadores || ''}
                            onChange={(e) => {
                              const nuevo = [...contenidoMultigrado];
                              nuevo[idx] = { ...nuevo[idx], indicadores: e.target.value };
                              setContenidoMultigrado(nuevo);
                            }}
                            disabled={esAnioCerrado || !anioLectivoActivo}
                            placeholder={`Ind. ${gradosActuales[idx]}...`}
                            className="w-full p-1 border border-slate-300 rounded bg-slate-50 text-slate-900 text-[10px] disabled:bg-slate-100"
                          />
                        </td>
                      ))}

                      {[0, 1, 2].map((idx) => (
                        <td key={`erca-${idx}`} className={`p-1.5 align-top ${idx < 2 ? 'border-r border-black' : 'border-r border-black'}`}>
                          <textarea
                            rows={14}
                            value={contenidoMultigrado?.[idx]?.orientaciones || ''}
                            onChange={(e) => {
                              const nuevo = [...contenidoMultigrado];
                              nuevo[idx] = { ...nuevo[idx], orientaciones: e.target.value };
                              setContenidoMultigrado(nuevo);
                            }}
                            disabled={esAnioCerrado || !anioLectivoActivo}
                            placeholder={`ERCA ${gradosActuales[idx]}...`}
                            className="w-full p-1 border border-slate-300 rounded bg-slate-50 text-slate-900 text-[10px] font-mono disabled:bg-slate-100"
                          />
                        </td>
                      ))}

                      <td className="p-2 align-top">
                        <textarea 
                          rows={14} 
                          value={evaluacion} 
                          onChange={(e) => setEvaluacion(e.target.value)} 
                          disabled={esAnioCerrado || !anioLectivoActivo}
                          placeholder="Actividades evaluativas..."
                          className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-[11px] outline-none disabled:bg-slate-100"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!esAnioCerrado && anioLectivoActivo && (
            <div className="flex justify-end gap-4 pt-4 border-t">
              <button 
                type="submit" 
                disabled={guardando} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow transition disabled:opacity-50 text-xs"
              >
                {guardando ? 'Guardando...' : planIdEditar ? '💾 Guardar Cambios Correctivos' : '💾 Guardar Planificación'}
              </button>
            </div>
          )}

        </form>

      </div>
    </div>
  )
}

export default function NuevaPlanificacionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-semibold text-slate-600">Cargando Planificador...</div>}>
      <FormularioPlanificacionContent />
    </Suspense>
  )
}