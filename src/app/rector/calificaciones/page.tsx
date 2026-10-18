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

export default function RegistroCalificacionesRectorPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')

  // Control de Año Lectivo Vigente de la institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Listas generales para el Rector
  const [docentesInstitucion, setDocentesInstitucion] = useState<any[]>([])
  const [docenteSeleccionadoId, setDocenteSeleccionadoId] = useState('')
  const [asignacionesDocente, setAsignacionesDocente] = useState<any[]>([])
  const [materiasOficiales, setMateriasOficiales] = useState<any[]>([])

  // Filtros dinámicos
  const [subnivel, setSubnivel] = useState<'Básica Elemental' | 'Básica Media' | 'Básica Superior' | 'Bachillerato'>('Básica Media')
  const [jornadaActual, setJornadaActual] = useState('MATUTINA')
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')
  const [asignatura, setAsignatura] = useState('')
  const [trimestre, setTrimestre] = useState('Trimestre 1')

  const [columnasInsumos, setColumnasInsumos] = useState<ColumnaInsumo[]>([])
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  
  // Mapas de notas exactas por ID (calificaciones_detalle y sumativas)
  const [notasMap, setNotasMap] = useState<{ [estudianteId: string]: { [insumoId: string]: number } }>({})
  const [sumativasMap, setSumativasMap] = useState<{ [estudianteId: string]: { refuerzo_pedagogico: number; proyecto_interdisciplinar: number; evaluacion_estructurada: number } }>({})

  useEffect(() => {
    async function initRector() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }
        
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

        const instIdFinal = doc?.institucion_id
        if (instIdFinal) {
          const { data: docsInst } = await supabase
            .from('docentes')
            .select('*')
            .eq('institucion_id', instIdFinal)
            .order('apellidos', { ascending: true })

          setDocentesInstitucion(docsInst || [])
          if (docsInst && docsInst.length > 0) {
            setDocenteSeleccionadoId(docsInst[0].id)
          }
        }
      } catch (err) {
        console.error('Error al iniciar panel rectoral de calificaciones:', err)
      } finally {
        setCargando(false)
      }
    }
    initRector()
  }, [router])

  // Cargar asignaciones del docente seleccionado en el año lectivo activo
  useEffect(() => {
    async function cargarAsignacionesDocente() {
      if (!docenteSeleccionadoId || !anioLectivoVigente) return

      const { data: asignacionesData } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', docenteSeleccionadoId)
        .eq('anio_lectivo', anioLectivoVigente)

      if (asignacionesData && asignacionesData.length > 0) {
        setAsignacionesDocente(asignacionesData)
        const jInicial = asignacionesData[0].jornada || 'MATUTINA'
        setJornadaActual(jInicial)
        setGrado(asignacionesData[0].grado_curso)
        setParalelo(asignacionesData[0].paralelo)
        setAsignatura(asignacionesData[0].asignatura)
        detectarSubnivel(asignacionesData[0].grado_curso)
      } else {
        setAsignacionesDocente([])
        setGrado('')
        setParalelo('')
        setAsignatura('')
      }
    }
    cargarAsignacionesDocente()
  }, [docenteSeleccionadoId, anioLectivoVigente])

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
    const asigJornada = asignacionesDocente.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada)
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
    const paralelosDeGrado = Array.from(new Set(asignacionesDocente.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === nuevoGrado).map(a => a.paralelo)))
    if (paralelosDeGrado.length > 0) {
      setParalelo(paralelosDeGrado[0])
      const asigMatch = asignacionesDocente.find(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === nuevoGrado && a.paralelo === paralelosDeGrado[0])
      if (asigMatch) setAsignatura(asigMatch.asignatura)
    }
  }

  // Carga sincronizada idéntica al calificador: estudiantes, insumos, detalles individuales y notas sumativas
  useEffect(() => {
    async function cargarEstructuraYNotasRector() {
      if (!institucionId || !docenteSeleccionadoId || !grado || !paralelo || !asignatura || !anioLectivoVigente) return

      try {
        // 1. Estudiantes del curso y jornada
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
        const idsEstudiantes = estData.map((e) => e.id)

        // 2. Insumos del docente para este curso, materia y trimestre
        const { data: insumosData } = await supabase
          .from('configuracion_insumos')
          .select('*')
          .eq('docente_id', docenteSeleccionadoId)
          .eq('asignatura', asignatura.trim())
          .eq('trimestre', trimestre)
          .eq('grado_curso', grado)
          .eq('paralelo', paralelo)
          .eq('jornada', jornadaActual)
          .eq('anio_lectivo', anioLectivoVigente)
          .order('created_at', { ascending: true })

        const colsCargadas: ColumnaInsumo[] = (insumosData || []).map((item, idx) => ({
          id: item.id,
          categoria: item.categoria as CategoriaInsumo,
          numero: idx + 1,
          descripcion: item.descripcion
        }))
        setColumnasInsumos(colsCargadas)

        const insumosIds = colsCargadas.map(c => c.id)

        // 3. Calificaciones individuales desde calificaciones_detalle
        let detallesNotas: any[] = []
        if (insumosIds.length > 0 && idsEstudiantes.length > 0) {
          const { data: detData } = await supabase
            .from('calificaciones_detalle')
            .select('*')
            .in('configuracion_insumo_id', insumosIds)
            .in('estudiante_id', idsEstudiantes)

          detallesNotas = detData || []
        }

        // 4. Aportes sumativos desde la tabla calificaciones
        let calResumen: any[] = []
        if (idsEstudiantes.length > 0) {
          const { data: resData } = await supabase
            .from('calificaciones')
            .select('*')
            .in('estudiante_id', idsEstudiantes)
            .eq('docente_id', docenteSeleccionadoId)
            .eq('asignatura', asignatura.trim())
            .eq('trimestre', trimestre)
            .eq('anio_lectivo', anioLectivoVigente)

          calResumen = resData || []
        }

        // 5. Mapear notas de forma inmutable por ID
        const mapaNotas: { [estId: string]: { [insId: string]: number } } = {}
        const mapaSum: { [estId: string]: any } = {}

        estData.forEach((est) => {
          mapaNotas[est.id] = {}
          colsCargadas.forEach((c) => {
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
        console.error('Error al sincronizar datos para el rector:', err)
      }
    }

    cargarEstructuraYNotasRector()
  }, [institucionId, docenteSeleccionadoId, grado, paralelo, asignatura, trimestre, jornadaActual, anioLectivoVigente])

  // Ordenamiento visual por categorías
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

  // =========================================================================
  // CÁLCULO DE PROMEDIO: TAREAS EN BLANCO COMPUTAN CON 0.00
  // =========================================================================
  const calcularNotaFinal = (estId: string) => {
    const notasIns = notasMap[estId] || {}
    const sum = sumativasMap[estId] || { refuerzo_pedagogico: 0, proyecto_interdisciplinar: 0, evaluacion_estructurada: 0 }

    // Verificar si el estudiante tiene alguna calificación ingresada
    const tieneAlgunaNotaInsumos = columnasInsumos.some(col => (notasIns[col.id] || 0) > 0)
    const tieneAlgunaNotaSumativa = (sum.refuerzo_pedagogico > 0) || (sum.proyecto_interdisciplinar > 0) || (sum.evaluacion_estructurada > 0)

    if (!tieneAlgunaNotaInsumos && !tieneAlgunaNotaSumativa) {
      return 0
    }

    // Casilleros en blanco computan con 0.00
    let valoresInsumos: number[] = columnasInsumos.map(col => Number(notasIns[col.id] || 0))

    // Refuerzo Pedagógico reemplaza la nota formativa más baja
    if (sum.refuerzo_pedagogico > 0 && valoresInsumos.length > 0) {
      const minNota = Math.min(...valoresInsumos)
      if (sum.refuerzo_pedagogico > minNota) {
        const minIndex = valoresInsumos.indexOf(minNota)
        valoresInsumos[minIndex] = sum.refuerzo_pedagogico
      }
    }

    if (subnivel === 'Básica Elemental') {
      const todas = [...valoresInsumos]
      todas.push(Number(sum.proyecto_interdisciplinar || 0))
      todas.push(Number(sum.evaluacion_estructurada || 0))

      if (todas.length === 0) return 0
      const suma = todas.reduce((a, b) => a + b, 0)
      return parseFloat((suma / todas.length).toFixed(2))
    }

    const promFormativo = valoresInsumos.length > 0
      ? valoresInsumos.reduce((a, b) => a + b, 0) / valoresInsumos.length
      : 0
    const aporte70 = promFormativo * 0.70

    const notaProy = Number(sum.proyecto_interdisciplinar || 0)
    const notaEv = Number(sum.evaluacion_estructurada || 0)
    const promSumativo = (notaProy + notaEv) / 2
    const aporte30 = promSumativo * 0.30

    return parseFloat((aporte70 + aporte30).toFixed(2))
  }

  const obtenerEscalaCualitativa = (prom: number) => {
    if (prom >= 9.00) return { label: 'DAR', color: 'bg-emerald-100 text-emerald-800' }
    if (prom >= 7.00) return { label: 'AAR', color: 'bg-blue-100 text-blue-800' }
    if (prom >= 4.01) return { label: 'PA', color: 'bg-amber-100 text-amber-800' }
    return { label: 'NA', color: 'bg-rose-100 text-rose-800' }
  }

  const getHeaderColor = (cat: CategoriaInsumo) => {
    switch (cat) {
      case 'Deberes / Indiv.': return 'bg-indigo-900 text-white'
      case 'Tareas en Clase': return 'bg-[#4b4c99] text-white'
      case 'Actividades Grupales': return 'bg-teal-700 text-white'
      case 'Lecciones': return 'bg-emerald-800 text-white'
      default: return 'bg-slate-800 text-white'
    }
  }

  const jornadasDisponibles = Array.from(new Set(asignacionesDocente.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(asignacionesDocente.filter(a => (a.jornada || 'MATUTINA') === jornadaActual).map(a => a.grado_curso)))
  const paralelosDisponibles = Array.from(new Set(asignacionesDocente.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado).map(a => a.paralelo)))
  
  const asignaturasDisponibles = materiasFiltradas.length > 0 
    ? materiasFiltradas 
    : Array.from(new Set(asignacionesDocente.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado && a.paralelo === paralelo).map(a => a.asignatura)))

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Calificaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Modo Supervisor / Rector
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Monitoreo de Calificaciones
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Año Lectivo Vigente: <strong style={{ color: '#4b4c99' }}>{anioLectivoVigente || 'Sin año activo'}</strong> ({trimestre})
          </p>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <button
            onClick={() => router.push('/rector')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer"
          >
            ← Panel Rectoral
          </button>
        </div>
      </div>

      {/* SELECTOR DE DOCENTE PARA REVISIÓN */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto flex-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Seleccionar Docente a Supervisar:</label>
          <select
            value={docenteSeleccionadoId}
            onChange={(e) => setDocenteSeleccionadoId(e.target.value)}
            style={{ color: '#4b4c99' }}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer shadow-2xs"
          >
            {docentesInstitucion.map((doc) => (
              <option key={doc.id} value={doc.id} className="text-slate-900 font-bold bg-white">
                {doc.apellidos} {doc.nombres} ({doc.email})
              </option>
            ))}
          </select>
        </div>
        <div 
          style={{ backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)', color: '#4b4c99' }}
          className="text-xs font-bold px-4 py-3 rounded-2xl border shadow-2xs shrink-0"
        >
          Visualización Directiva de Solo Lectura
        </div>
      </div>

      {/* FILTROS DINÁMICOS */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaActual}
            onChange={(e) => handleJornadaChange(e.target.value)}
            disabled={jornadasDisponibles.length <= 1}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {jornadasDisponibles.map((j) => <option key={j} value={j} className="text-slate-900 font-bold bg-white">{j}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Subnivel Educativo</label>
          <input
            type="text"
            disabled
            value={subnivel}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 outline-none cursor-not-allowed shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año / Grado</label>
          <select
            value={grado}
            onChange={(e) => handleGradoChange(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {gradosUnicos.length === 0 ? (
              <option value="" className="text-slate-900 font-bold bg-white">Sin cursos</option>
            ) : (
              gradosUnicos.map((g) => <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>)
            )}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
          <select
            value={paralelo}
            onChange={(e) => setParalelo(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {paralelosDisponibles.map((p) => (
              <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Asignatura</label>
          <select
            value={asignatura}
            onChange={(e) => setAsignatura(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {asignaturasDisponibles.map((asig) => (
              <option key={asig} value={asig} className="text-slate-900 font-bold bg-white">{asig}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Trimestre Activo</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            className="w-full p-2.5 border-2 border-indigo-300 rounded-xl text-xs font-black text-indigo-900 bg-indigo-50 outline-none shadow-2xs"
          >
            <option value="Trimestre 1" className="text-slate-900 font-bold bg-white">Trimestre 1</option>
            <option value="Trimestre 2" className="text-slate-900 font-bold bg-white">Trimestre 2</option>
            <option value="Trimestre 3" className="text-slate-900 font-bold bg-white">Trimestre 3</option>
          </select>
        </div>
      </div>

      {/* TABLA SÁBANA DIGITAL EN MODO SOLO LECTURA */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-x-auto">
        {cargando ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs">Cargando registros...</div>
        ) : asignacionesDocente.length === 0 ? (
          <div className="p-12 text-center text-amber-800 bg-amber-50 font-bold text-xs">
            El docente seleccionado no cuenta con asignaturas registradas para este periodo.
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs">
            No hay estudiantes matriculados en este curso.
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center bg-slate-50 border border-slate-200" rowSpan={2}>#</th>
                <th className="p-3 min-w-50 bg-slate-50 border border-slate-200" rowSpan={2}>Estudiante</th>

                {gruposHeader.length === 0 ? (
                  <th className="p-3 text-center bg-amber-50 text-amber-900 border border-slate-200 italic" colSpan={1}>
                    El docente no ha creado insumos para este trimestre
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

                <th className="p-2 text-center bg-amber-100 text-amber-950 border border-slate-200 font-bold" rowSpan={2}>
                  Refuerzo Pedag.
                </th>

                <th className="p-2 text-center bg-[#4b4c99] text-white border border-slate-200 font-bold" colSpan={2}>
                  APORTES SUMATIVOS {subnivel !== 'Básica Elemental' && '(30% - ' + trimestre + ')'}
                </th>

                <th className="p-3 text-center w-24 bg-slate-100 border border-slate-200 font-bold" rowSpan={2}>Prom. Final</th>
                <th className="p-3 text-center w-20 bg-slate-100 border border-slate-200 font-bold" rowSpan={2}>Escala</th>
              </tr>

              <tr className="bg-slate-50 text-slate-700 text-[9px] font-bold">
                {columnasOrdenadas.length === 0 ? (
                  <th className="p-2 text-center text-slate-400 border border-slate-200">Sin Insumos</th>
                ) : (
                  columnasOrdenadas.map((col) => (
                    <th key={col.id} className="p-2 text-center border border-slate-200 min-w-28 bg-white">
                      <span className="block font-bold text-slate-900 truncate" title={col.descripcion}>
                        {col.descripcion}
                      </span>
                      <span className="block text-[8px] font-medium text-slate-500">
                        {col.categoria} #{col.numero}
                      </span>
                    </th>
                  ))
                )}

                <th className="p-1.5 text-center bg-indigo-50 border border-slate-200 min-w-28">Proy. Interdisciplinar</th>
                <th className="p-1.5 text-center bg-indigo-50 border border-slate-200 min-w-28">Ev. Base Estructurada</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {estudiantes.map((est, idx) => {
                const promFinal = calcularNotaFinal(est.id)
                const cuali = obtenerEscalaCualitativa(promFinal)
                const sum = sumativasMap[est.id] || { refuerzo_pedagogico: 0, proyecto_interdisciplinar: 0, evaluacion_estructurada: 0 }

                return (
                  <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2.5 font-bold text-slate-400 text-center border border-slate-200">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-800 border border-slate-200 whitespace-nowrap">
                      {est.apellidos} {est.nombres}
                    </td>

                    {columnasOrdenadas.length === 0 ? (
                      <td className="p-2.5 text-center text-slate-300 border border-slate-200">-</td>
                    ) : (
                      columnasOrdenadas.map((col) => (
                        <td key={col.id} className="p-1.5 text-center border border-slate-200">
                          <input
                            type="number"
                            disabled={true}
                            value={notasMap[est.id]?.[col.id] > 0 ? notasMap[est.id][col.id] : ''}
                            placeholder="0.00"
                            className="w-14 p-1 text-center border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-100 cursor-not-allowed shadow-2xs placeholder:text-slate-400"
                          />
                        </td>
                      ))
                    )}

                    <td className="p-1.5 text-center bg-amber-50/30 border border-slate-200">
                      <input
                        type="number"
                        disabled={true}
                        value={sum.refuerzo_pedagogico > 0 ? sum.refuerzo_pedagogico : ''}
                        placeholder="Opt."
                        className="w-14 p-1 text-center border border-amber-300 rounded-xl font-semibold text-amber-900 bg-slate-100 cursor-not-allowed shadow-2xs placeholder:text-slate-400"
                      />
                    </td>

                    <td className="p-1.5 text-center bg-indigo-50/30 border border-slate-200">
                      <input
                        type="number"
                        disabled={true}
                        value={sum.proyecto_interdisciplinar > 0 ? sum.proyecto_interdisciplinar : ''}
                        placeholder="0.00"
                        className="w-16 p-1 text-center border border-indigo-300 rounded-xl font-semibold text-indigo-900 bg-slate-100 cursor-not-allowed shadow-2xs placeholder:text-slate-400"
                      />
                    </td>

                    <td className="p-1.5 text-center bg-indigo-50/30 border border-slate-200">
                      <input
                        type="number"
                        disabled={true}
                        value={sum.evaluacion_estructurada > 0 ? sum.evaluacion_estructurada : ''}
                        placeholder="0.00"
                        className="w-16 p-1 text-center border border-indigo-300 rounded-xl font-semibold text-indigo-900 bg-slate-100 cursor-not-allowed shadow-2xs placeholder:text-slate-400"
                      />
                    </td>

                    <td className="p-2.5 text-center bg-slate-50 font-bold text-xs text-slate-900 border border-slate-200">
                      {promFinal.toFixed(2)}
                    </td>

                    <td className="p-2.5 text-center bg-slate-50 border border-slate-200">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${cuali.color} shadow-2xs inline-block`}>
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

    </div>
  )
}