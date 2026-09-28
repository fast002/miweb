'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function AsistenciaGlobalPage() {
  const [cargando, setCargando] = useState(true)
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [asistenciaMap, setAsistenciaMap] = useState<{ [id: string]: string }>({})
  const [debugLog, setDebugLog] = useState<string>('')
  
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('2026-2027')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>(['2026-2027'])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [gradosDisponibles, setGradosDisponibles] = useState<string[]>([])
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('A')

  const esDocenteDeAula = ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB', '5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(grado)
  const [asignatura, setAsignatura] = useState('Asistencia Diaria (General)')
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const { data: insts } = await supabase.from('instituciones').select('*').limit(1)
        if (insts && insts[0]) {
          const inst = insts[0]
          setNombreInstitucion(inst.nombre_institucion || 'Unidad Educativa')
          setPeriodosDisponibles(inst.periodos_disponibles || ['2026-2027'])
          setAnosCerrados(inst.anos_cerrados || [])
          setAnioLectivoVigente(inst.anio_lectivo_activo || '2026-2027')
        }

        const { data: estsData } = await supabase
          .from('estudiantes')
          .select('grado_curso')
          .eq('estado', 'activo')

        if (estsData && estsData.length > 0) {
          const uniqueGrados = Array.from(new Set(estsData.map(d => d.grado_curso))) as string[]
          setGradosDisponibles(uniqueGrados)
          setGrado(uniqueGrados[0])
        }
      } catch (err) {
        console.error('Error al inicializar:', err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (esDocenteDeAula) {
      setAsignatura('Asistencia Diaria (General)')
    }
  }, [grado, esDocenteDeAula])

  const cargarDatos = useCallback(async () => {
    if (!grado || !anioLectivoVigente) return

    const { data: ests, error: errEsts } = await supabase
      .from('estudiantes')
      .select('id, nombres, apellidos')
      .eq('grado_curso', grado)
      .eq('paralelo', paralelo)
      .eq('anio_lectivo', anioLectivoVigente)
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true })

    if (errEsts) {
      setDebugLog('Error cargando estudiantes: ' + errEsts.message)
      return
    }

    setEstudiantes(ests || [])

    if (ests && ests.length > 0) {
      const idsEstudiantes = ests.map(e => e.id)
      const asignaturaConsulta = esDocenteDeAula ? 'Asistencia Diaria (General)' : asignatura

      setDebugLog(`Buscando asistencias para fecha: ${fecha}, asignatura: ${asignaturaConsulta}, año: ${anioLectivoVigente}`)

      // Consulta limpia sin joins problemáticos
      const { data: asists, error: errAsist } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado, asignatura, fecha, anio_lectivo')
        .in('estudiante_id', idsEstudiantes)
        .eq('fecha', fecha)
        .eq('asignatura', asignaturaConsulta.trim())
        .eq('anio_lectivo', anioLectivoVigente)

      if (errAsist) {
        setDebugLog('Error en consulta asistencias: ' + errAsist.message)
      } else {
        setDebugLog(`Registros encontrados en BD: ${asists?.length || 0}`)
      }

      const mapaEstado: { [id: string]: string } = {}
      asists?.forEach(a => {
        mapaEstado[a.estudiante_id] = a.estado
      })

      setAsistenciaMap(mapaEstado)
    } else {
      setAsistenciaMap({})
    }
  }, [grado, paralelo, asignatura, fecha, anioLectivoVigente, esDocenteDeAula])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const registrar = async (estId: string, estado: string) => {
    if (anosCerrados.includes(anioLectivoVigente)) {
      setMensaje('🔒 Este periodo lectivo está cerrado.')
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
      setMensaje('❌ Error al actualizar: ' + error.message)
    } else {
      setMensaje('✅ Registro actualizado correctamente.')
      setTimeout(() => setMensaje(null), 2000)
      cargarDatos()
    }
  }

  const getBotonEstilo = (estadoActual: string, estadoBoton: string) => {
    const s = estadoActual === estadoBoton
    const base = "px-3 py-1.5 rounded-xl text-xs transition border font-bold shadow-xs "
    if (estadoBoton === 'Presente') return s ? base + "bg-emerald-700 text-white border-emerald-900 shadow-sm" : base + "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
    if (estadoBoton === 'Atraso') return s ? base + "bg-amber-600 text-white border-amber-800 shadow-sm" : base + "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
    if (estadoBoton === 'Falta Justificada') return s ? base + "bg-blue-700 text-white border-blue-900 shadow-sm" : base + "bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
    return s ? base + "bg-red-700 text-white border-red-900 shadow-sm" : base + "bg-red-50 text-red-900 border-red-300 hover:bg-red-100"
  }

  if (cargando) {
    return <div className="p-10 text-slate-900 font-bold bg-slate-50 min-h-screen">Cargando panel de supervisión...</div>
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-black">Control Global y Auditoría de Asistencia</h1>
            <p className="text-xs font-bold text-slate-500">{nombreInstitucion} — Sincronización directa y limpia.</p>
          </div>
          <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
            Periodo Activo: {anioLectivoVigente}
          </div>
        </div>

        {mensaje && (
          <div className="p-3 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {mensaje}
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha de Clase</label>
            <input 
              type="date" 
              value={fecha} 
              onChange={(e) => setFecha(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900 outline-none" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Grado / Curso</label>
            <select 
              value={grado} 
              onChange={(e) => setGrado(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none cursor-pointer"
            >
              {gradosDisponibles.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Paralelo</label>
            <select 
              value={paralelo} 
              onChange={(e) => setParalelo(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none cursor-pointer"
            >
              {['A', 'B', 'C', 'D'].map(p => <option key={p} value={p}>Paralelo {p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Asignatura / Registro</label>
            {esDocenteDeAula ? (
              <input
                type="text"
                disabled
                value="Asistencia Diaria (General)"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 cursor-not-allowed"
              />
            ) : (
              <select 
                value={asignatura} 
                onChange={(e) => setAsignatura(e.target.value)} 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none cursor-pointer"
              >
                <option value="Matemática">Matemática</option>
                <option value="Lengua y Literatura">Lengua y Literatura</option>
                <option value="Ciencias Naturales">Ciencias Naturales</option>
                <option value="Estudios Sociales">Estudios Sociales</option>
              </select>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Periodo Lectivo</label>
            <select 
              value={anioLectivoVigente} 
              onChange={(e) => setAnioLectivoVigente(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-indigo-50 text-slate-900 outline-none cursor-pointer"
            >
              {periodosDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-100 border-b flex justify-between items-center text-xs font-bold text-slate-700">
            <span>Nómina: {grado} "{paralelo}" {esDocenteDeAula ? '— (Registro General)' : `— (${asignatura})`}</span>
            <span>Total Alumnos: {estudiantes.length}</span>
          </div>

          {estudiantes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xs">
              No hay estudiantes activos matriculados en este curso y paralelo para el periodo {anioLectivoVigente}.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 uppercase font-black text-[10px] text-slate-600 border-b">
                <tr>
                  <th className="p-3 text-left">Estudiante</th>
                  <th className="p-3 text-center">Estado Registrado y Auditoría (Modificable)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estudiantes.map(est => {
                  const estadoActual = asistenciaMap[est.id] || ''

                  return (
                    <tr key={est.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-black text-slate-900 text-sm">
                        {est.apellidos} {est.nombres}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex gap-2 flex-wrap justify-center">
                            {['Presente', 'Atraso', 'Falta Justificada', 'Falta Injustificada'].map(estd => (
                              <button 
                                key={estd}
                                onClick={() => registrar(est.id, estd)}
                                className={getBotonEstilo(estadoActual, estd)}
                              >
                                {estd === 'Presente' && '✔ Presente'}
                                {estd === 'Atraso' && '⏱ Atraso'}
                                {estd === 'Falta Justificada' && '📄 Falta Just.'}
                                {estd === 'Falta Injustificada' && '❌ Falta Injust.'}
                              </button>
                            ))}
                          </div>
                          <span className={`text-[10px] font-bold italic ${estadoActual ? 'text-indigo-700' : 'text-amber-700'}`}>
                            {estadoActual ? `Estado guardado: ${estadoActual}` : '⚠️ Sin registro docente en esta fecha'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}