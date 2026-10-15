'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AsistenciaGlobalPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [asistenciaMap, setAsistenciaMap] = useState<{ [id: string]: string }>({})
  
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('2026-2027')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>(['2026-2027'])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  
  // Filtros de Jornada, Grado y Paralelo
  const [jornadasDisponibles, setJornadasDisponibles] = useState<string[]>(['MATUTINA'])
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('MATUTINA')
  const [gradosDisponibles, setGradosDisponibles] = useState<string[]>([])
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('A')

  const esDocenteDeAula = ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB', '5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(grado)
  const [asignatura, setAsignatura] = useState('Asistencia Diaria (General)')
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return; }

        // Consultar la institución del inspector/usuario actual logueado
        const { data: doc } = await supabase
          .from('docentes')
          .select('*, instituciones(*)')
          .eq('id', user.id)
          .maybeSingle()

        let instId = ''
        let anioActivo = '2026-2027'

        if (doc?.institucion_id) {
          instId = doc.institucion_id
          setInstitucionId(instId)
          setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')

          const inst = doc.instituciones
          if (inst) {
            setPeriodosDisponibles(inst.periodos_disponibles || ['2026-2027'])
            setAnosCerrados(inst.anos_cerrados || [])
            if (inst.anio_lectivo_activo) {
              anioActivo = inst.anio_lectivo_activo
            }
            setAnioLectivoVigente(anioActivo)
          }
        }

        if (instId) {
          // Filtrar estrictamente los estudiantes de la institución del inspector
          const { data: estsData } = await supabase
            .from('estudiantes')
            .select('grado_curso, jornada')
            .eq('institucion_id', instId)
            .eq('anio_lectivo', anioActivo)
            .eq('estado', 'activo')

          if (estsData && estsData.length > 0) {
            const jornadasUnicas = Array.from(new Set(estsData.map(d => (d.jornada || 'MATUTINA').trim().toUpperCase()))) as string[]
            setJornadasDisponibles(jornadasUnicas.length > 0 ? jornadasUnicas : ['MATUTINA'])
            const primeraJornada = jornadasUnicas[0] || 'MATUTINA'
            setJornadaSeleccionada(primeraJornada)

            const gradosDeJornada = Array.from(new Set(
              estsData
                .filter(d => ((d.jornada || 'MATUTINA').trim().toUpperCase() === primeraJornada))
                .map(d => d.grado_curso)
            )) as string[]

            setGradosDisponibles(gradosDeJornada)
            if (gradosDeJornada.length > 0) setGrado(gradosDeJornada[0])
          }
        }
      } catch (err) {
        console.error('Error al inicializar inspector:', err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  // Actualizar grados disponibles cuando cambia la jornada seleccionada respetando la institución
  const handleJornadaChange = async (nuevaJornada: string) => {
    setJornadaSeleccionada(nuevaJornada)
    if (!institucionId) return

    const { data: estsData } = await supabase
      .from('estudiantes')
      .select('grado_curso, jornada')
      .eq('institucion_id', institucionId)
      .eq('anio_lectivo', anioLectivoVigente)
      .eq('estado', 'activo')

    if (estsData) {
      const gradosDeJornada = Array.from(new Set(
        estsData
          .filter(d => ((d.jornada || 'MATUTINA').trim().toUpperCase() === nuevaJornada.trim().toUpperCase()))
          .map(d => d.grado_curso)
      )) as string[]

      setGradosDisponibles(gradosDeJornada)
      if (gradosDeJornada.length > 0) setGrado(gradosDeJornada[0])
      else setGrado('')
    }
  }

  useEffect(() => {
    if (esDocenteDeAula) {
      setAsignatura('Asistencia Diaria (General)')
    }
  }, [grado, esDocenteDeAula])

  const cargarDatos = useCallback(async () => {
    if (!grado || !anioLectivoVigente || !jornadaSeleccionada || !institucionId) return

    // Consulta estricta filtrando por institucion_id
    const { data: estsRaw, error: errEsts } = await supabase
      .from('estudiantes')
      .select('id, nombres, apellidos, grado_curso, paralelo, jornada, institucion_id')
      .eq('institucion_id', institucionId)
      .eq('grado_curso', grado)
      .eq('paralelo', paralelo)
      .eq('anio_lectivo', anioLectivoVigente)
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true })

    if (errEsts) return

    const ests = (estsRaw || []).filter(e => {
      const jEst = e.jornada ? e.jornada.trim().toUpperCase() : 'MATUTINA'
      return jEst === jornadaSeleccionada.trim().toUpperCase()
    })

    setEstudiantes(ests || [])

    if (ests && ests.length > 0) {
      const idsEstudiantes = ests.map(e => e.id)
      const asignaturaConsulta = esDocenteDeAula ? 'Asistencia Diaria (General)' : asignatura

      const { data: asists } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado, asignatura, fecha, anio_lectivo')
        .in('estudiante_id', idsEstudiantes)
        .eq('fecha', fecha)
        .eq('asignatura', asignaturaConsulta.trim())
        .eq('anio_lectivo', anioLectivoVigente)

      const mapaEstado: { [id: string]: string } = {}
      asists?.forEach(a => {
        mapaEstado[a.estudiante_id] = a.estado
      })

      setAsistenciaMap(mapaEstado)
    } else {
      setAsistenciaMap({})
    }
  }, [institucionId, grado, paralelo, jornadaSeleccionada, asignatura, fecha, anioLectivoVigente, esDocenteDeAula])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const registrar = async (estId: string, estado: string) => {
    if (anosCerrados.includes(anioLectivoVigente)) {
      setMensaje('Este periodo lectivo está cerrado.')
      setTimeout(() => setMensaje(null), 3000)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const asignaturaGuardar = esDocenteDeAula ? 'Asistencia Diaria (General)' : asignatura

    const { error } = await supabase.from('asistencias').upsert({
      estudiante_id: estId,
      docente_id: user?.id,
      fecha,
      estado,
      asignatura: asignaturaGuardar.trim(),
      trimestre: 'Trimestre 1',
      anio_lectivo: anioLectivoVigente
    }, { 
      onConflict: 'estudiante_id, fecha, asignatura, anio_lectivo' 
    })

    if (error) {
      setMensaje('Error al actualizar: ' + error.message)
    } else {
      setMensaje('Registro actualizado correctamente.')
      setTimeout(() => setMensaje(null), 2000)
      cargarDatos()
    }
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
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Panel de Supervisión...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO PRINCIPAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Supervisión y Auditoría
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Control Global y Auditoría de Asistencia
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Sincronización institucional estricta.
          </p>
        </div>

        <div className="bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-200 text-xs font-bold text-indigo-900 shadow-2xs">
          Periodo Activo: {anioLectivoVigente}
        </div>
      </div>

      {mensaje && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-bold shadow-2xs">
          {mensaje}
        </div>
      )}

      {/* FILTROS PRINCIPALES (Con aislamiento institucional y jornada) */}
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
            value={jornadaSeleccionada} 
            onChange={(e) => handleJornadaChange(e.target.value)} 
            disabled={jornadasDisponibles.length <= 1}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
          >
            {jornadasDisponibles.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Grado / Curso</label>
          <select 
            value={grado} 
            onChange={(e) => setGrado(e.target.value)} 
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
          >
            {gradosDisponibles.map(g => <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo</label>
          <select 
            value={paralelo} 
            onChange={(e) => setParalelo(e.target.value)} 
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
          >
            {['A', 'B', 'C', 'D'].map(p => <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Asignatura / Registro</label>
          {esDocenteDeAula ? (
            <input
              type="text"
              disabled
              value="Asistencia Diaria (General)"
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 cursor-not-allowed shadow-2xs"
            />
          ) : (
            <select 
              value={asignatura} 
              onChange={(e) => setAsignatura(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              <option value="Matemática" className="text-slate-900 font-bold bg-white">Matemática</option>
              <option value="Lengua y Literatura" className="text-slate-900 font-bold bg-white">Lengua y Literatura</option>
              <option value="Ciencias Naturales" className="text-slate-900 font-bold bg-white">Ciencias Naturales</option>
              <option value="Estudios Sociales" className="text-slate-900 font-bold bg-white">Estudios Sociales</option>
            </select>
          )}
        </div>
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Periodo Lectivo</label>
          <select 
            value={anioLectivoVigente} 
            onChange={(e) => setAnioLectivoVigente(e.target.value)} 
            style={{ color: '#4b4c99' }}
            className="w-full p-3 border-2 border-indigo-300 rounded-xl text-xs font-black bg-indigo-50 outline-none shadow-2xs cursor-pointer"
          >
            {periodosDisponibles.map(p => <option key={p} value={p} className="text-slate-900 font-bold bg-white">{p}</option>)}
          </select>
        </div>
      </div>

      {/* TABLA DE ASISTENCIA */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: '#4b4c99' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider shadow-2xs flex justify-between items-center"
        >
          <span>Nómina: {jornadaSeleccionada} • {grado} "{paralelo}" {esDocenteDeAula ? '— (Registro General)' : `— (${asignatura})`}</span>
          <span>Total Alumnos: {estudiantes.length}</span>
        </div>

        {estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No hay estudiantes activos matriculados en esta jornada, curso y paralelo para el periodo {anioLectivoVigente}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] w-1/3">Estudiante</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] text-center">Estado Registrado y Auditoría (Modificable)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {estudiantes.map(est => {
                  const estadoActual = asistenciaMap[est.id] || ''

                  return (
                    <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-800 text-sm whitespace-nowrap">
                        {est.apellidos} {est.nombres}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex gap-2 flex-wrap justify-center">
                            {['Presente', 'Atraso', 'Falta Justificada', 'Falta Injustificada'].map(estd => (
                              <button 
                                key={estd}
                                onClick={() => registrar(est.id, estd)}
                                className={getBotonEstilo(estadoActual, estd)}
                              >
                                {estd === 'Presente' && 'Presente'}
                                {estd === 'Atraso' && 'Atraso'}
                                {estd === 'Falta Justificada' && 'Falta Just.'}
                                {estd === 'Falta Injustificada' && 'Falta Injust.'}
                              </button>
                            ))}
                          </div>
                          <span className={`text-[10px] font-bold italic ${estadoActual ? 'text-[#4b4c99]' : 'text-amber-700'}`}>
                            {estadoActual ? `Estado guardado: ${estadoActual}` : 'Sin registro docente en esta fecha'}
                          </span>
                        </div>
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