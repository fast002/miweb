'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RegistroAsistenciaPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  const [docenteId, setDocenteId] = useState('')
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [nombreDocente, setNombreDocente] = useState('Usuario')
  const [rolUsuario, setRolUsuario] = useState('docente')

  // Control Dinámico de Años Lectivos Sincronizado con periodos_disponibles de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Asignaciones del docente estrictamente del año vigente
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])

  // Filtros principales
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')
  const [asignatura, setAsignatura] = useState('')
  const [trimestre, setTrimestre] = useState('Trimestre 1')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])

  // Listas y datos
  const [listaAsignaturas, setListaAsignaturas] = useState<string[]>([])
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [asistenciaMap, setAsistenciaMap] = useState<{ [id: string]: string }>({})

  const esDocenteDeAula = ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB', '5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(grado)

  // Función para cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // 1. Cargar perfil docente / institución con identificación clara y año dinámico desde periodos_disponibles
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return; }
        setDocenteId(user.id)
        
        const { data: doc } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user.id).maybeSingle()
        
        let anioActivo = ''
        let periodosList: string[] = []
        let cerradosList: string[] = []

        if (doc) {
          setInstitucionId(doc.institucion_id || '')
          setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
          setNombreDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim() || 'Docente')
          setRolUsuario(doc.rol || 'docente')

          const inst = doc.instituciones
          if (inst) {
            periodosList = inst.periodos_disponibles || []
            setPeriodosDisponibles(periodosList)

            if (inst.anio_lectivo_activo && periodosList.includes(inst.anio_lectivo_activo)) {
              anioActivo = inst.anio_lectivo_activo
            } else if (periodosList.length > 0) {
              anioActivo = periodosList[0]
            }

            setAnioLectivoVigente(anioActivo)

            if (inst.anos_cerrados && Array.isArray(inst.anos_cerrados)) {
              cerradosList = inst.anos_cerrados
              setAnosCerrados(cerradosList)
            }
          }
        }

        // Cargar carga horaria asignada estrictamente del año lectivo vigente detectado
        if (anioActivo) {
          const { data: asigs } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asigs && asigs.length > 0) {
            setMisAsignaciones(asigs)
            setGrado(asigs[0].grado_curso)
            setParalelo(asigs[0].paralelo)
            setAsignatura(asigs[0].asignatura)
          } else {
            setMisAsignaciones([])
          }
        } else {
          setMisAsignaciones([])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  // Manejar cambio dinámico del periodo desde la lógica interna
  const handleCambiarPeriodo = async (nuevoAnio: string) => {
    setAnioLectivoVigente(nuevoAnio)
    if (docenteId && nuevoAnio) {
      const { data: asigs } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', docenteId)
        .eq('anio_lectivo', nuevoAnio)

      if (asigs && asigs.length > 0) {
        setMisAsignaciones(asigs)
        setGrado(asigs[0].grado_curso)
        setParalelo(asigs[0].paralelo)
        setAsignatura(asigs[0].asignatura)
      } else {
        setMisAsignaciones([])
        setGrado('')
        setParalelo('')
        setAsignatura('')
      }
    }
  }

  // 2. Cargar asignaturas según el subnivel y carga horaria del año vigente
  useEffect(() => {
    async function cargarAsignaturasConfiguradas() {
      if (!institucionId || !grado) return
      
      if (esDocenteDeAula) {
        setListaAsignaturas(['Asistencia Diaria (General)'])
        setAsignatura('Asistencia Diaria (General)')
        return
      }

      // Filtrar materias asignadas al docente para este grado específico en el año vigente
      const materiasDelGrado = Array.from(new Set(
        misAsignaciones
          .filter(a => a.grado_curso === grado && a.paralelo === paralelo)
          .map(a => a.asignatura)
      ))

      const mats = materiasDelGrado.length > 0 ? materiasDelGrado : ['Matemática', 'Lengua y Literatura']
      setListaAsignaturas(mats)
      if (!mats.includes(asignatura)) {
        setAsignatura(mats[0])
      }
    }
    cargarAsignaturasConfiguradas()
  }, [grado, paralelo, institucionId, esDocenteDeAula, misAsignaciones, asignatura])

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  // 3. Cargar estudiantes y asistencias estrictamente del año vigente
  const cargarDatos = useCallback(async () => {
    if (!institucionId || !asignatura || !grado || !anioLectivoVigente) return
    
    const { data: ests } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('institucion_id', institucionId)
      .eq('grado_curso', grado)
      .eq('paralelo', paralelo)
      .eq('anio_lectivo', anioLectivoVigente)
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true })

    setEstudiantes(ests || [])

    if (ests && ests.length > 0) {
      const { data: asists } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado')
        .in('estudiante_id', ests.map(e => e.id))
        .eq('fecha', fecha)
        .eq('asignatura', asignatura.trim())
        .eq('anio_lectivo', anioLectivoVigente)

      const mapa: any = {}
      asists?.forEach(a => mapa[a.estudiante_id] = a.estado)
      setAsistenciaMap(mapa)
    }
  }, [institucionId, grado, paralelo, asignatura, fecha, anioLectivoVigente])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // 4. Guardar asistencia con el año vigente
  const guardarAsistencia = async (estId: string, estado: string) => {
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado. No se puede modificar la asistencia.')
      return
    }

    setGuardandoId(estId)
    await supabase.from('asistencias').upsert({
      estudiante_id: estId, 
      docente_id: docenteId, 
      fecha, 
      estado, 
      asignatura: asignatura.trim(), 
      trimestre,
      anio_lectivo: anioLectivoVigente
    }, { onConflict: 'estudiante_id, fecha, asignatura, anio_lectivo' })
    
    setAsistenciaMap(prev => ({ ...prev, [estId]: estado }))
    setGuardandoId(null)
  }

  // Estilos limpios y profesionales para los botones de asistencia
  const getBotonEstilo = (estadoActual: string, estadoBoton: string) => {
    const s = estadoActual === estadoBoton
    const base = "px-3 py-1.5 rounded-xl text-xs transition border font-bold shadow-xs "
    if (estadoBoton === 'Presente') return s ? base + "bg-emerald-700 text-white border-emerald-900 shadow-sm" : base + "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
    if (estadoBoton === 'Atraso') return s ? base + "bg-amber-600 text-white border-amber-800 shadow-sm" : base + "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
    if (estadoBoton === 'Falta Justificada') return s ? base + "bg-blue-700 text-white border-blue-900 shadow-sm" : base + "bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
    return s ? base + "bg-red-700 text-white border-red-900 shadow-sm" : base + "bg-red-50 text-red-900 border-red-300 hover:bg-red-100"
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
        Cargando módulo de asistencia...
      </div>
    )
  }

  const gradosUnicos = Array.from(new Set(misAsignaciones.map(a => a.grado_curso)))
  const paralelosPermitidos = Array.from(new Set(misAsignaciones.filter(a => a.grado_curso === grado).map(a => a.paralelo)))

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ENCABEZADO INSTITUCIONAL Y TÍTULO DE UBICACIÓN */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">
              PANEL DOCENTE • MÓDULO DE ASISTENCIA ACADÉMICA ({anioLectivoVigente || 'Sin año activo'})
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Control y Registro de Asistencia Diaria
            </h1>
            <p className="text-xs text-slate-600 font-bold mt-1">
              {nombreInstitucion} • Docente: <span className="text-slate-900">{nombreDocente}</span> ({rolUsuario.toUpperCase()})
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => router.push('/docente/asistencia/reportes')}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-black text-xs rounded-xl border border-indigo-200 transition shadow-sm"
            >
              Ver Consolidado y Reportes
            </button>
          </div>
        </div>

        {/* AVISO SI NO HAY AÑO ACTIVO */}
        {!anioLectivoVigente && !cargando && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold">
            ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
          </div>
        )}

        {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
        {esAnioCerrado && anioLectivoVigente && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold flex items-center justify-between">
            <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. El registro de asistencia está en modo de solo lectura.</span>
            <span className="bg-red-200 px-2.5 py-1 rounded">Periodo Cerrado</span>
          </div>
        )}

        {/* FILTROS PRINCIPALES */}
        <div className="bg-white p-4 rounded-2xl border shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Fecha de Clase</label>
            <input 
              type="date" 
              value={fecha} 
              onChange={(e) => setFecha(e.target.value)}
              className="w-full p-2.5 border-2 rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Grado / Curso</label>
            <select
              value={grado}
              onChange={(e) => {
                const nuevoGrado = e.target.value
                setGrado(nuevoGrado)
                const par = misAsignaciones.find(a => a.grado_curso === nuevoGrado)?.paralelo || 'A'
                setParalelo(par)
              }}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
            >
              {gradosUnicos.length === 0 ? (
                <option value="">Sin carga asignada</option>
              ) : (
                gradosUnicos.map(g => <option key={g} value={g}>{g}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Paralelo</label>
            <select
              value={paralelo}
              onChange={(e) => setParalelo(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
            >
              {paralelosPermitidos.map(p => (
                <option key={p} value={p}>Paralelo {p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Asignatura</label>
            {esDocenteDeAula ? (
              <input
                type="text"
                disabled
                value="Asistencia General (Aula)"
                className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-500 bg-slate-200 cursor-not-allowed"
              />
            ) : (
              <select
                value={asignatura}
                onChange={(e) => setAsignatura(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
              >
                {listaAsignaturas.map(mat => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-indigo-700 uppercase mb-1">Trimestre</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(e.target.value)}
              className="w-full p-2.5 border-2 border-indigo-400 rounded-xl text-xs font-black text-indigo-900 bg-indigo-50 outline-none"
            >
              <option value="Trimestre 1">Trimestre 1</option>
              <option value="Trimestre 2">Trimestre 2</option>
              <option value="Trimestre 3">Trimestre 3</option>
            </select>
          </div>
        </div>

        {/* TABLA DE ASISTENCIA */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-100 border-b flex justify-between items-center">
            <span className="text-xs font-black uppercase text-slate-700">
              Nómina Estudiantil: {grado} "{paralelo}" — {esDocenteDeAula ? 'Registro General' : asignatura} ({anioLectivoVigente || 'Sin periodo'})
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Total Estudiantes: {estudiantes.length}
            </span>
          </div>

          {!anioLectivoVigente ? (
            <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50">
              ⚠️ No hay un año lectivo activo configurado en la institución.
            </div>
          ) : misAsignaciones.length === 0 ? (
            <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50">
              ⚠️ No tienes carga horaria asignada para el periodo vigente ({anioLectivoVigente}).
            </div>
          ) : estudiantes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xs">
              No hay estudiantes activos registrados en este curso y paralelo para el periodo {anioLectivoVigente}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-200 text-slate-900 font-black uppercase text-[10px]">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3 min-w-[250px]">Estudiante</th>
                    <th className="p-3 text-center">Control de Asistencia (Clic para marcar)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estudiantes.map((est, idx) => {
                    const estadoActual = asistenciaMap[est.id] || 'Presente'
                    const estaGuardando = guardandoId === est.id

                    return (
                      <tr key={est.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-600 text-center">{idx + 1}</td>
                        <td className="p-3 font-black text-slate-900 text-sm whitespace-nowrap">
                          {est.apellidos} {est.nombres}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-2 flex-wrap">
                            {['Presente', 'Atraso', 'Falta Justificada', 'Falta Injustificada'].map((estado) => (
                              <button
                                key={estado}
                                disabled={estaGuardando || esAnioCerrado}
                                onClick={() => guardarAsistencia(est.id, estado)}
                                className={`px-3 py-1.5 rounded-xl text-xs transition ${getBotonEstilo(asistenciaMap[est.id], estado)} disabled:opacity-50`}
                              >
                                {estado === 'Presente' && '✔ Presente'}
                                {estado === 'Atraso' && '⏱ Atraso'}
                                {estado === 'Falta Justificada' && '📄 Falta Just.'}
                                {estado === 'Falta Injustificada' && '❌ Falta Injust.'}
                              </button>
                            ))}
                          </div>
                          {estaGuardando && (
                            <span className="block text-[10px] text-indigo-700 font-bold mt-1">Guardando...</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}