'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [docenteId, setDocenteId] = useState('')
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')

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
  const [notasMap, setNotasMap] = useState<{ [estudianteId: string]: { [colId: string]: number } }>({})

  // Función para cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // 1. Carga inicial sincronizada con periodos_disponibles y anio_lectivo_activo de la institución
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
          setInstitucionId(doc.institucion_id || '')
          setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')

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
          } else {
            setMisAsignaciones([])
            setGrado('')
            setParalelo('')
            setAsignatura('')
          }
        } else {
          setMisAsignaciones([])
        }
      } catch (err) {
        console.error('Error al iniciar perfil:', err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  // Filtrado de materias oficiales según el grado/curso seleccionado
  const materiasFiltradas = materiasOficiales
    .filter(m => !m.curso_nivel || m.curso_nivel.includes(grado.split(' ')[0]))
    .map(m => m.nombre)

  // Autodetectar subnivel según el grado seleccionado
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

  // Manejar cambio de Jornada
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

  // Manejar cambio de Grado desde las asignaciones
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

  // 2. Carga de Estudiantes, Insumos y Notas filtrados estrictamente por el año vigente
  useEffect(() => {
    async function cargarEstructuraYNotas() {
      if (!institucionId || !docenteId || !grado || !paralelo || !asignatura || !anioLectivoVigente) return

      try {
        let query = supabase
          .from('estudiantes')
          .select('*')
          .eq('institucion_id', institucionId)
          .eq('grado_curso', grado)
          .eq('paralelo', paralelo)
          .eq('estado', 'activo')

        const { data: estDataRaw } = await query.order('apellidos', { ascending: true })

        const estData = (estDataRaw || []).filter(e => {
          const jEst = e.jornada ? e.jornada.trim().toUpperCase() : 'MATUTINA'
          return jEst === jornadaActual.trim().toUpperCase()
        })

        if (estData) {
          setEstudiantes(estData)
          const ids = estData.map((e) => e.id)

          // Cargar insumos guardados para este curso, materia, trimestre y año vigente
          const { data: insumosData } = await supabase
            .from('configuracion_insumos')
            .select('*')
            .eq('docente_id', docenteId)
            .eq('asignatura', asignatura.trim())
            .eq('trimestre', trimestre)
            .eq('grado_curso', grado)
            .eq('paralelo', paralelo)
            .eq('anio_lectivo', anioLectivoVigente)
            .order('numero', { ascending: true })

          const colsCargadas: ColumnaInsumo[] = (insumosData || []).map((item) => ({
            id: item.id,
            categoria: item.categoria as CategoriaInsumo,
            numero: item.numero,
            descripcion: item.descripcion
          }))
          setColumnasInsumos(colsCargadas)

          // Cargar Calificaciones asociadas al año vigente
          const { data: calData } = await supabase
            .from('calificaciones')
            .select('*')
            .in('estudiante_id', ids.length > 0 ? ids : ['none'])
            .eq('docente_id', docenteId)
            .eq('asignatura', asignatura.trim())
            .eq('trimestre', trimestre)
            .eq('anio_lectivo', anioLectivoVigente)

          const mapa: any = {}
          estData.forEach((est) => {
            const cal = calData?.find((c) => c.estudiante_id === est.id)
            mapa[est.id] = {
              refuerzo_pedagogico: cal?.refuerzo_pedagogico || 0,
              proyecto_interdisciplinar: cal?.proyecto_interdisciplinar || 0,
              evaluacion_estructurada: cal?.evaluacion_estructurada || 0,
            }
            colsCargadas.forEach((col, index) => {
              const valorCol = cal ? (cal[`insumo_${index + 1}` as keyof typeof cal] || 0) : 0
              mapa[est.id][col.id] = valorCol
            })
          })
          setNotasMap(mapa)
        }
      } catch (err) {
        console.error('Error al sincronizar datos:', err)
      }
    }

    cargarEstructuraYNotas()
  }, [institucionId, docenteId, grado, paralelo, asignatura, trimestre, jornadaActual, anioLectivoVigente])

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  const handleNotaChange = (estudianteId: string, colId: string, valor: string) => {
    if (esAnioCerrado) return
    const num = Math.min(10, Math.max(0, parseFloat(valor) || 0))
    setNotasMap((prev) => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        [colId]: num
      }
    }))
  }

  // Crear y guardar Insumo en Supabase con el año vigente
  const handleAgregarColumna = async () => {
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado. No se pueden crear nuevos insumos.')
      return
    }
    if (!nuevaDesc.trim()) return

    const insumosMismaCat = columnasInsumos.filter((c) => c.categoria === nuevaCat)
    const proximoNumero = insumosMismaCat.length + 1
    const nuevoId = `col_${Date.now()}`

    const nuevaCol: ColumnaInsumo = {
      id: nuevoId,
      categoria: nuevaCat,
      numero: proximoNumero,
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
        categoria: nuevaCat,
        numero: proximoNumero,
        descripcion: nuevaDesc.trim(),
        anio_lectivo: anioLectivoVigente
      })

      if (error) throw error

      setColumnasInsumos((prev) => [...prev, nuevaCol])
      setNuevaDesc('')
      setMostrarModalNuevaColumna(false)
    } catch (err: any) {
      alert('Error al guardar el nuevo insumo: ' + err.message)
    }
  }

  // Eliminar Insumo de Supabase
  const handleEliminarColumna = async (idCol: string) => {
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado. No se pueden modificar registros.')
      return
    }
    if (!confirm('¿Estás seguro de eliminar este insumo y sus notas asociadas en esta columna?')) return

    try {
      const { error } = await supabase.from('configuracion_insumos').delete().eq('id', idCol)
      if (error) throw error

      setColumnasInsumos((prev) => prev.filter((c) => c.id !== idCol))
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

  const gruposHeader = ordenCategorias.map((cat) => {
    const cols = columnasOrdenadas.filter((c) => c.categoria === cat)
    return {
      categoria: cat,
      count: cols.length,
      cols
    }
  }).filter((g) => g.count > 0)

  const calcularNotaFinal = (n: any) => {
    if (!n) return 0
    const notasInsumosDinamicos: number[] = []
    columnasInsumos.forEach((col) => {
      const val = n[col.id] || 0
      if (val > 0) notasInsumosDinamicos.push(val)
    })

    if (n.refuerzo_pedagogico > 0) notasInsumosDinamicos.push(n.refuerzo_pedagogico)

    if (subnivel === 'Básica Elemental') {
      const todasLasNotas = [...notasInsumosDinamicos]
      if (n.proyecto_interdisciplinar > 0) todasLasNotas.push(n.proyecto_interdisciplinar)
      if (n.evaluacion_estructurada > 0) todasLasNotas.push(n.evaluacion_estructurada)

      if (todasLasNotas.length === 0) return 0
      const sumaTotal = todasLasNotas.reduce((a, b) => a + b, 0)
      return parseFloat((sumaTotal / todasLasNotas.length).toFixed(2))
    }

    const promFormativo = notasInsumosDinamicos.length > 0
      ? notasInsumosDinamicos.reduce((a, b) => a + b, 0) / notasInsumosDinamicos.length
      : 0
    const aporteFormativo70 = promFormativo * 0.70

    const notasSumativas = []
    if (n.proyecto_interdisciplinar > 0) notasSumativas.push(n.proyecto_interdisciplinar)
    if (n.evaluacion_estructurada > 0) notasSumativas.push(n.evaluacion_estructurada)

    const promSumativo = notasSumativas.length > 0
      ? notasSumativas.reduce((a, b) => a + b, 0) / notasSumativas.length
      : 0
    const aporteSumativo30 = promSumativo * 0.30

    return parseFloat((aporteFormativo70 + aporteSumativo30).toFixed(2))
  }

  const obtenerEscalaCualitativa = (prom: number) => {
    if (prom >= 9.00) return { label: 'DAR', color: 'bg-emerald-100 text-emerald-800' }
    if (prom >= 7.00) return { label: 'AAR', color: 'bg-blue-100 text-blue-800' }
    if (prom >= 4.01) return { label: 'PA', color: 'bg-amber-100 text-amber-800' }
    return { label: 'NA', color: 'bg-red-100 text-red-800' }
  }

  const getHeaderColor = (cat: CategoriaInsumo) => {
    switch (cat) {
      case 'Deberes / Indiv.': return 'bg-[#4b4c99] text-white'
      case 'Tareas en Clase': return 'bg-indigo-700 text-white'
      case 'Actividades Grupales': return 'bg-[#45b3a5] text-slate-950 font-black'
      case 'Lecciones': return 'bg-emerald-700 text-white'
      default: return 'bg-slate-800 text-white'
    }
  }

  const handleGuardarCalificaciones = async () => {
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado. No se pueden guardar calificaciones.')
      return
    }
    setGuardando(true)
    setMensaje(null)

    try {
      const payload = estudiantes.map((est) => {
        const n = notasMap[est.id] || {}
        const prom = calcularNotaFinal(n)
        const cuali = obtenerEscalaCualitativa(prom).label

        const insumo1Val = columnasOrdenadas[0] ? (n[columnasOrdenadas[0].id] || 0) : 0
        const insumo2Val = columnasOrdenadas[1] ? (n[columnasOrdenadas[1].id] || 0) : 0
        const insumo3Val = columnasOrdenadas[2] ? (n[columnasOrdenadas[2].id] || 0) : 0
        const insumo4Val = columnasOrdenadas[3] ? (n[columnasOrdenadas[3].id] || 0) : 0

        return {
          estudiante_id: est.id,
          docente_id: docenteId,
          institucion_id: institucionId,
          asignatura: asignatura.trim(),
          trimestre,
          paralelo,
          insumo_1: insumo1Val,
          insumo_2: insumo2Val,
          insumo_3: insumo3Val,
          insumo_4: insumo4Val,
          refuerzo_pedagogico: n.refuerzo_pedagogico || 0,
          proyecto_interdisciplinar: n.proyecto_interdisciplinar || 0,
          evaluacion_estructurada: n.evaluacion_estructurada || 0,
          promedio_parcial: prom,
          cualitativa: cuali,
          anio_lectivo: anioLectivoVigente,
          updated_at: new Date().toISOString()
        }
      })

      const { error } = await supabase.from('calificaciones').upsert(payload, {
        onConflict: 'estudiante_id, asignatura, trimestre, docente_id, anio_lectivo'
      })

      if (error) throw error
      setMensaje({ tipo: 'exito', texto: `¡Calificaciones y estructura de ${trimestre} guardadas correctamente para el periodo ${anioLectivoVigente}!` })
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  // Listas únicas filtradas desde las asignaciones del rector para el año vigente
  const jornadasDisponibles = Array.from(new Set(misAsignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual).map(a => a.grado_curso)))
  const paralelosDisponibles = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado).map(a => a.paralelo)))
  
  // Asignaturas cargadas dinámicamente desde la tabla oficial "asignaturas" y respaldadas por las asignaciones
  const asignaturasDisponibles = materiasFiltradas.length > 0 
    ? materiasFiltradas 
    : Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado && a.paralelo === paralelo).map(a => a.asignatura)))

  return (
    <div className="space-y-6 pb-12 selection:bg-[#f6c358] selection:text-slate-950">

      {/* ENCABEZADO PRINCIPAL LIQUID GLASS */}
      <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[32px] border border-white/80 shadow-[0_8px_30px_0_rgba(75,76,153,0.08)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-[#4b4c99]/10 text-[#4b4c99] font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider border border-[#4b4c99]/20">
            Año Lectivo Vigente: {anioLectivoVigente || 'Sin año activo'} ({trimestre})
          </span>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 mt-2 uppercase tracking-tight">
            Registro de Calificaciones
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Módulo Académico
          </p>
        </div>

        {/*  BOTONES CON LA PALETA DE MARCA OFICIAL */}
        <div className="flex gap-2.5 flex-wrap items-center">
          <button
            onClick={() => router.push('/docente/calificaciones/consolidado')}
            className="px-4 py-2.5 bg-white/90 hover:bg-white text-[#4b4c99] font-bold text-xs rounded-2xl border border-white/80 shadow-2xs transition cursor-pointer"
          >
            Consolidado
          </button>
          <button
            onClick={() => router.push('/docente/estudiantes')}
            className="px-4 py-2.5 bg-white/90 hover:bg-white text-slate-700 font-bold text-xs rounded-2xl border border-white/80 shadow-2xs transition cursor-pointer"
          >
            Nómina
          </button>
          
          {!esAnioCerrado && anioLectivoVigente && (
            <button
              onClick={() => setMostrarModalNuevaColumna(true)}
              className="px-4 py-2.5 font-bold text-xs rounded-2xl shadow-md transition cursor-pointer"
              style={{ backgroundColor: '#f6c358', color: '#1e293b' }}
            >
              + Nuevo Insumo
            </button>
          )}

          {!esAnioCerrado && anioLectivoVigente && (
            <button
              onClick={handleGuardarCalificaciones}
              disabled={guardando || estudiantes.length === 0}
              className="px-5 py-2.5 text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#4b4c99' }}
            >
              {guardando ? 'Guardando...' : '💾 Guardar'}
            </button>
          )}
        </div>
      </div>

      {/* AVISO SI NO HAY AÑO ACTIVO */}
      {!anioLectivoVigente && !cargando && (
        <div className="bg-amber-50/90 backdrop-blur-xl border border-amber-300/80 p-4 rounded-2xl text-amber-900 text-xs font-bold shadow-xs">
          ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
      {esAnioCerrado && anioLectivoVigente && (
        <div className="bg-red-50/90 backdrop-blur-xl border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold flex items-center justify-between shadow-xs">
          <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. Las calificaciones están en modo de solo lectura.</span>
          <span className="bg-red-200 px-2.5 py-1 rounded-full text-[10px]">Periodo Cerrado</span>
        </div>
      )}

      {/* MENSAJES */}
      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border backdrop-blur-xl shadow-xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50/90 text-emerald-900 border-emerald-200' : 'bg-red-50/90 text-red-900 border-red-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* FILTROS DINÁMICOS INTELIGENTES CON JORNADA */}
      <div className="bg-white/70 backdrop-blur-2xl p-5 rounded-[28px] border border-white/80 shadow-[0_8px_30px_0_rgba(75,76,153,0.06)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaActual}
            onChange={(e) => handleJornadaChange(e.target.value)}
            disabled={jornadasDisponibles.length <= 1}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/80 backdrop-blur-md outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
          >
            {jornadasDisponibles.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Subnivel Educativo</label>
          <input
            type="text"
            disabled
            value={subnivel}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/50 backdrop-blur-md outline-none cursor-not-allowed shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año / Grado</label>
          <select
            value={grado}
            onChange={(e) => handleGradoChange(e.target.value)}
            disabled={gradosUnicos.length <= 1}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/80 backdrop-blur-md outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
          >
            {gradosUnicos.length === 0 ? (
              <option value="">Sin cursos en este año</option>
            ) : (
              gradosUnicos.map((g) => <option key={g} value={g}>{g}</option>)
            )}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
          <select
            value={paralelo}
            onChange={(e) => setParalelo(e.target.value)}
            disabled={paralelosDisponibles.length <= 1}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/80 backdrop-blur-md outline-none disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
          >
            {paralelosDisponibles.map((p) => (
              <option key={p} value={p}>Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura / Rol</label>
          <select
            value={asignatura}
            onChange={(e) => setAsignatura(e.target.value)}
            className="w-full p-2.5 border border-white/80 rounded-xl text-xs font-bold text-slate-800 bg-white/80 backdrop-blur-md outline-none shadow-2xs"
          >
            {asignaturasDisponibles.map((asig) => (
              <option key={asig} value={asig}>{asig}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Trimestre Activo</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            className="w-full p-2.5 border-2 border-[#4b4c99]/40 rounded-xl text-xs font-black text-[#4b4c99] bg-[#4b4c99]/10 backdrop-blur-md outline-none shadow-2xs"
          >
            <option value="Trimestre 1">Trimestre 1</option>
            <option value="Trimestre 2">Trimestre 2</option>
            <option value="Trimestre 3">Trimestre 3</option>
          </select>
        </div>
      </div>

      {/* TABLA SÁBANA DIGITAL */}
      <div className="bg-white/75 backdrop-blur-2xl rounded-[32px] border border-white/80 shadow-[0_8px_30px_0_rgba(75,76,153,0.08)] overflow-x-auto">
        {cargando ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs">
            Sincronizando estructura e insumos para {trimestre} ({anioLectivoVigente || 'Sin año'})...
          </div>
        ) : !anioLectivoVigente ? (
          <div className="p-12 text-center text-amber-800 space-y-2 bg-amber-50/50">
            <p className="font-bold text-sm">⚠️ No hay un año lectivo activo configurado en la institución.</p>
            <p className="text-xs text-amber-700">El registro de calificaciones requiere que la Dirección aperture un periodo lectivo.</p>
          </div>
        ) : misAsignaciones.length === 0 ? (
          <div className="p-12 text-center text-amber-800 space-y-2 bg-amber-50/50">
            <p className="font-bold text-sm">⚠️ No tienes carga horaria asignada para el periodo vigente ({anioLectivoVigente}).</p>
            <p className="text-xs text-amber-700">Verifica que la Dirección te haya asignado materias en este año.</p>
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <p className="font-semibold text-sm">No hay estudiantes activos en este curso ({grado} "{paralelo}" - {jornadaActual}).</p>
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="text-slate-800 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center bg-white/90 border border-slate-200" rowSpan={2}>#</th>
                <th className="p-3 min-w-50 bg-white/90 border border-slate-200" rowSpan={2}>Estudiante</th>

                {gruposHeader.length === 0 ? (
                  <th className="p-3 text-center bg-amber-50/80 text-amber-900 border border-slate-200 italic" colSpan={1}>
                    ⚠️ No hay insumos registrados en este {trimestre}
                  </th>
                ) : (
                  gruposHeader.map((g) => (
                    <th 
                      key={g.categoria} 
                      className={`p-2 text-center border border-slate-200 text-xs font-black uppercase ${getHeaderColor(g.categoria)}`}
                      colSpan={g.count}
                    >
                      {g.categoria}
                    </th>
                  ))
                )}

                <th className="p-2 text-center bg-amber-100/90 text-amber-950 border border-slate-200 font-black" rowSpan={2}>
                  Refuerzo Pedag.
                </th>

                <th className="p-2 text-center bg-[#4b4c99] text-white border border-slate-200 font-black" colSpan={2}>
                  APORTES SUMATIVOS {subnivel !== 'Básica Elemental' && '(30% - ' + trimestre + ')'}
                </th>

                <th className="p-3 text-center w-24 bg-slate-100/90 border border-slate-200 font-black" rowSpan={2}>Prom. Final</th>
                <th className="p-3 text-center w-20 bg-slate-100/90 border border-slate-200 font-black" rowSpan={2}>Escala</th>
              </tr>

              <tr className="bg-white/80 text-slate-800 text-[9px] font-bold">
                {columnasOrdenadas.length === 0 ? (
                  <th className="p-2 text-center text-slate-400 border border-slate-200">Sin Insumos</th>
                ) : (
                  columnasOrdenadas.map((col) => (
                    <th key={col.id} className="p-2 text-center border border-slate-200 min-w-22.5 bg-white/60">
                      <span className="block font-black text-slate-900">INSUMO {col.numero}</span>
                      <span className="block text-[8px] font-medium text-slate-500 truncate" title={col.descripcion}>
                        {col.descripcion}
                      </span>
                      {!esAnioCerrado && (
                        <button
                          onClick={() => handleEliminarColumna(col.id)}
                          title="Eliminar este insumo"
                          className="text-red-500 hover:text-red-700 font-bold text-[10px] mt-0.5 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </th>
                  ))
                )}

                <th className="p-1.5 text-center bg-purple-50 border border-slate-200 min-w-27.5">Proy. Interdisciplinar</th>
                <th className="p-1.5 text-center bg-purple-50 border border-slate-200 min-w-30">Ev. Base Estructurada</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/60">
              {estudiantes.map((est, idx) => {
                const n = notasMap[est.id] || {}
                const promFinal = calcularNotaFinal(n)
                const cuali = obtenerEscalaCualitativa(promFinal)

                return (
                  <tr key={est.id} className="hover:bg-white/50 transition-colors">
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
                            value={n[col.id] > 0 ? n[col.id] : ''}
                            onChange={(e) => handleNotaChange(est.id, col.id, e.target.value)}
                            className="w-14 p-1 text-center border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#4b4c99] bg-white/80 disabled:bg-slate-100 shadow-2xs"
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
                        value={n.refuerzo_pedagogico > 0 ? n.refuerzo_pedagogico : ''}
                        onChange={(e) => handleNotaChange(est.id, 'refuerzo_pedagogico', e.target.value)}
                        placeholder="Opt."
                        className="w-14 p-1 text-center border border-amber-300/60 rounded-lg font-semibold text-amber-900 outline-none focus:ring-2 focus:ring-amber-500 bg-white/80 disabled:bg-slate-100 shadow-2xs"
                      />
                    </td>

                    <td className="p-1 text-center bg-purple-50/20 border border-slate-200">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        disabled={esAnioCerrado}
                        value={n.proyecto_interdisciplinar > 0 ? n.proyecto_interdisciplinar : ''}
                        onChange={(e) => handleNotaChange(est.id, 'proyecto_interdisciplinar', e.target.value)}
                        className="w-16 p-1 text-center border border-purple-300/60 rounded-lg font-semibold text-purple-900 outline-none focus:ring-2 focus:ring-purple-500 bg-white/80 disabled:bg-slate-100 shadow-2xs"
                      />
                    </td>

                    <td className="p-1 text-center bg-purple-50/20 border border-slate-200">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        disabled={esAnioCerrado}
                        value={n.evaluacion_estructurada > 0 ? n.evaluacion_estructurada : ''}
                        onChange={(e) => handleNotaChange(est.id, 'evaluacion_estructurada', e.target.value)}
                        className="w-16 p-1 text-center border border-purple-300/60 rounded-lg font-semibold text-purple-900 outline-none focus:ring-2 focus:ring-purple-500 bg-white/80 disabled:bg-slate-100 shadow-2xs"
                      />
                    </td>

                    <td className="p-2 text-center bg-white/90 font-black text-sm text-slate-900 border border-slate-200">
                      {promFinal.toFixed(2)}
                    </td>

                    <td className="p-2 text-center bg-white/90 border border-slate-200">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${cuali.color} shadow-2xs`}>
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-3xl rounded-[32px] max-w-md w-full p-6 space-y-4 shadow-2xl border border-white">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">➕ Crear Nuevo Insumo ({trimestre})</h2>
              <button onClick={() => setMostrarModalNuevaColumna(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1.5">Categoría:</label>
                <select
                  value={nuevaCat}
                  onChange={(e: any) => setNuevaCat(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 bg-white/80 outline-none shadow-2xs"
                >
                  <option value="Deberes / Indiv.">Deberes / Actividades Individuales</option>
                  <option value="Tareas en Clase">Tareas en Clase</option>
                  <option value="Actividades Grupales">Actividades Grupales</option>
                  <option value="Lecciones">Lecciones</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1.5">Descripción:</label>
                <input
                  type="text"
                  value={nuevaDesc}
                  onChange={(e) => setNuevaDesc(e.target.value)}
                  placeholder="Ej: Deber #1 - Lectura Crítica"
                  className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 bg-white/80 outline-none shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-200/60 pt-4">
              <button
                onClick={() => setMostrarModalNuevaColumna(false)}
                className="px-4 py-2.5 bg-slate-200/80 text-slate-700 font-bold text-xs rounded-2xl hover:bg-slate-300 transition-all duration-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregarColumna}
                disabled={!nuevaDesc.trim()}
                className="px-5 py-2.5 text-white font-bold text-xs rounded-2xl shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#4b4c99' }}
              >
                + Crear Insumo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}