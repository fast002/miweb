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

  // Filtros principales (Incluyendo Jornada)
  const [jornadaFiltro, setJornadaFiltro] = useState('MATUTINA')
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

        if (anioActivo) {
          const { data: asigs } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asigs && asigs.length > 0) {
            setMisAsignaciones(asigs)
            const primeraJornada = asigs[0].jornada || 'MATUTINA'
            setJornadaFiltro(primeraJornada)
            
            const gradosDeJornada = asigs.filter(a => (a.jornada || 'MATUTINA') === primeraJornada)
            if (gradosDeJornada.length > 0) {
              setGrado(gradosDeJornada[0].grado_curso)
              setParalelo(gradosDeJornada[0].paralelo)
              setAsignatura(gradosDeJornada[0].asignatura)
            }
          } else {
            setMisAsignaciones([])
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

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
        const primeraJornada = asigs[0].jornada || 'MATUTINA'
        setJornadaFiltro(primeraJornada)
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

  const handleJornadaChange = (nuevaJornada: string) => {
    setJornadaFiltro(nuevaJornada)
    const asigsDeJornada = misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada)
    if (asigsDeJornada.length > 0) {
      setGrado(asigsDeJornada[0].grado_curso)
      setParalelo(asigsDeJornada[0].paralelo)
      setAsignatura(asigsDeJornada[0].asignatura)
    } else {
      setGrado('')
      setParalelo('')
      setAsignatura('')
    }
  }

  useEffect(() => {
    async function cargarAsignaturasConfiguradas() {
      if (!institucionId || !grado) return
      
      if (esDocenteDeAula) {
        setListaAsignaturas(['Asistencia Diaria (General)'])
        setAsignatura('Asistencia Diaria (General)')
        return
      }

      const materiasDelGrado = Array.from(new Set(
        misAsignaciones
          .filter(a => (a.jornada || 'MATUTINA') === jornadaFiltro && a.grado_curso === grado && a.paralelo === paralelo)
          .map(a => a.asignatura)
      ))

      const mats = materiasDelGrado.length > 0 ? materiasDelGrado : ['Matemática', 'Lengua y Literatura']
      setListaAsignaturas(mats)
      if (!mats.includes(asignatura)) {
        setAsignatura(mats[0])
      }
    }
    cargarAsignaturasConfiguradas()
  }, [grado, paralelo, institucionId, esDocenteDeAula, misAsignaciones, asignatura, jornadaFiltro])

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  const cargarDatos = useCallback(async () => {
    if (!institucionId || !asignatura || !grado || !anioLectivoVigente) return
    
    const { data: ests } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('institucion_id', institucionId)
      .eq('jornada', jornadaFiltro)
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
  }, [institucionId, jornadaFiltro, grado, paralelo, asignatura, fecha, anioLectivoVigente])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const guardarAsistencia = async (estId: string, estado: string) => {
    if (esAnioCerrado) {
      alert('Este año lectivo está cerrado. No se puede modificar la asistencia.')
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

  const getBotonEstilo = (estadoActual: string, estadoBoton: string) => {
    const s = estadoActual === estadoBoton
    const base = "px-3 py-1.5 rounded-xl text-xs transition border font-bold shadow-2xs cursor-pointer "
    if (estadoBoton === 'Presente') return s ? base + "bg-emerald-700 text-white border-emerald-800 shadow-xs" : base + "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
    if (estadoBoton === 'Atraso') return s ? base + "bg-amber-600 text-white border-amber-700 shadow-xs" : base + "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
    if (estadoBoton === 'Falta Justificada') return s ? base + "bg-indigo-700 text-white border-indigo-800 shadow-xs" : base + "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
    return s ? base + "bg-rose-700 text-white border-rose-800 shadow-xs" : base + "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Asistencia...</p>
        </div>
      </div>
    )
  }

  const jornadasUnicas = Array.from(new Set(misAsignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaFiltro).map(a => a.grado_curso)))
  const paralelosPermitidos = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaFiltro && a.grado_curso === grado).map(a => a.paralelo)))

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Control Académico
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Control y Registro de Asistencia Diaria
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Docente: <span className="text-slate-700">{nombreDocente}</span> ({rolUsuario.toUpperCase()})
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Periodo:</span>
            {periodosDisponibles.length === 0 ? (
              <span className="text-xs font-bold text-amber-700 italic">Sin años creados</span>
            ) : (
              <select
                value={anioLectivoVigente}
                onChange={(e) => handleCambiarPeriodo(e.target.value)}
                style={{ color: '#4b4c99' }}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer"
              >
                {periodosDisponibles.map(p => (
                  <option key={p} value={p} className="text-slate-900 font-bold bg-white">{p} {anosCerrados.includes(p) ? ' (Cerrado)' : ''}</option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => router.push('/docente/asistencia/reportes')}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            Ver Consolidado y Reportes
          </button>
        </div>
      </div>

      {/* AVISO SI NO HAY AÑO ACTIVO */}
      {!anioLectivoVigente && !cargando && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
      {esAnioCerrado && anioLectivoVigente && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. El registro de asistencia está en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Modo Archivo</span>
        </div>
      )}

      {/* FILTROS PRINCIPALES */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5 text-xs">
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Fecha de Clase</label>
          <input 
            type="date" 
            value={fecha} 
            onChange={(e) => setFecha(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaFiltro}
            onChange={(e) => handleJornadaChange(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
          >
            {jornadasUnicas.map(j => (
              <option key={j} value={j} className="text-slate-900 font-bold bg-white">{j}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Grado / Curso</label>
          <select
            value={grado}
            onChange={(e) => {
              const nuevoGrado = e.target.value
              setGrado(nuevoGrado)
              const par = misAsignaciones.find(a => (a.jornada || 'MATUTINA') === jornadaFiltro && a.grado_curso === nuevoGrado)?.paralelo || 'A'
              setParalelo(par)
            }}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
          >
            {gradosUnicos.length === 0 ? (
              <option value="" className="text-slate-900 font-bold bg-white">Sin carga asignada</option>
            ) : (
              gradosUnicos.map(g => <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>)
            )}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo</label>
          <select
            value={paralelo}
            onChange={(e) => setParalelo(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
          >
            {paralelosPermitidos.map(p => (
              <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Asignatura</label>
          {esDocenteDeAula ? (
            <input
              type="text"
              disabled
              value="Asistencia General (Aula)"
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 cursor-not-allowed shadow-2xs"
            />
          ) : (
            <select
              value={asignatura}
              onChange={(e) => setAsignatura(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
            >
              {listaAsignaturas.map(mat => (
                <option key={mat} value={mat} className="text-slate-900 font-bold bg-white">{mat}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Trimestre</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            className="w-full p-3 border-2 border-indigo-300 rounded-xl text-xs font-black text-indigo-900 bg-indigo-50 outline-none shadow-2xs"
          >
            <option value="Trimestre 1" className="text-slate-900 font-bold bg-white">Trimestre 1</option>
            <option value="Trimestre 2" className="text-slate-900 font-bold bg-white">Trimestre 2</option>
            <option value="Trimestre 3" className="text-slate-900 font-bold bg-white">Trimestre 3</option>
          </select>
        </div>
      </div>

      {/* TABLA DE ASISTENCIA */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold uppercase text-slate-900">
          <span>
            Nómina Estudiantil [{jornadaFiltro}]: {grado} "{paralelo}" — {esDocenteDeAula ? 'Registro General' : asignatura} ({anioLectivoVigente || 'Sin periodo'})
          </span>
          <span className="text-[10px] text-slate-500">
            Total Estudiantes: {estudiantes.length}
          </span>
        </div>

        {!anioLectivoVigente ? (
          <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50/50">
            No hay un año lectivo activo configurado en la institución.
          </div>
        ) : misAsignaciones.length === 0 ? (
          <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50/50">
            No tienes carga horaria asignada para el periodo vigente ({anioLectivoVigente}).
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No hay estudiantes activos registrados en esta jornada, curso y paralelo para el periodo {anioLectivoVigente}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-200">
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
                    <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                        {est.apellidos} {est.nombres}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2 flex-wrap">
                          {['Presente', 'Atraso', 'Falta Justificada', 'Falta Injustificada'].map((estado) => (
                            <button
                              key={estado}
                              disabled={estaGuardando || esAnioCerrado}
                              onClick={() => guardarAsistencia(est.id, estado)}
                              className={getBotonEstilo(asistenciaMap[est.id], estado) + " disabled:opacity-50"}
                            >
                              {estado === 'Presente' && 'Presente'}
                              {estado === 'Atraso' && 'Atraso'}
                              {estado === 'Falta Justificada' && 'Falta Just.'}
                              {estado === 'Falta Injustificada' && 'Falta Injust.'}
                            </button>
                          ))}
                        </div>
                        {estaGuardando && (
                          <span className="block text-[10px] text-[#4b4c99] font-bold mt-1">Guardando...</span>
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
  )
}