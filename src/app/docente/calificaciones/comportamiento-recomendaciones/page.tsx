'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ComportamientoRecomendacionesPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [docenteId, setDocenteId] = useState('')
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')

  // Control Dinámico de Años Lectivos Sincronizado con la Institución y el Rector
  const [anioLectivo, setAnioLectivo] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Carga Horaria Asignada por el Rector
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])

  // Filtros dinámicos
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')
  const [seccionTab, setSeccionTab] = useState<'calificaciones' | 'recomendaciones'>('calificaciones')
  
  // Ítems de evaluación según subnivel
  const [itemSeleccionado, setItemSeleccionado] = useState('Animación a la lectura')

  // Datos
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [datosMap, setDatosMap] = useState<{ [estudianteId: string]: any }>({})

  // Escalas cualitativas permitidas
  const escalasPermitidas = ['A+', 'A-', 'B+', 'B-', 'C+', 'C-', 'D+', 'D-', 'E+', 'E-']

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // 1. Carga inicial del docente, institución, periodos dinámicos y año activo configurado por el rector
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }
        setDocenteId(user.id)
        
        const { data: doc } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user.id).maybeSingle()
        
        let anioActivo = ''
        let cerradosList: string[] = []
        let periodosList: string[] = []

        if (doc) {
          setInstitucionId(doc.institucion_id || '')
          setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
          
          // Manejo seguro de la relación institucional (objeto o array)
          const inst: any = Array.isArray(doc.instituciones) ? doc.instituciones[0] : doc.instituciones
          if (inst) {
            periodosList = inst.periodos_disponibles || []
            setPeriodosDisponibles(periodosList)

            if (inst.anio_lectivo_activo && periodosList.includes(inst.anio_lectivo_activo)) {
              anioActivo = inst.anio_lectivo_activo
            } else if (periodosList.length > 0) {
              anioActivo = periodosList[0]
            }

            setAnioLectivo(anioActivo)

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
            setGrado(asignacionesData[0].grado_curso)
            setParalelo(asignacionesData[0].paralelo)
          } else {
            setMisAsignaciones([])
            setGrado('')
            setParalelo('')
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

  const esAnioCerrado = anosCerrados.includes(anioLectivo)

  // Determinar si el grado pertenece a Superior o Bachillerato para incluir Orientación Vocacional
  const esSuperiorOBachillerato = ['8vo EGB', '9no EGB', '10mo EGB', '1ro BGU', '2do BGU', '3ro BGU', '1ro BT', '2do BT', '3ro BT'].includes(grado)

  // Manejar cambio de Grado
  const handleGradoChange = (nuevoGrado: string) => {
    setGrado(nuevoGrado)
    const paralelosDeGrado = Array.from(new Set(misAsignaciones.filter(a => a.grado_curso === nuevoGrado).map(a => a.paralelo)))
    if (paralelosDeGrado.length > 0) {
      setParalelo(paralelosDeGrado[0])
    }
  }

  // Manejar cambio dinámico del periodo desde el selector superior si se desea cambiar de histórico
  const handleCambiarPeriodo = async (nuevoAnio: string) => {
    setAnioLectivo(nuevoAnio)
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
      } else {
        setMisAsignaciones([])
        setGrado('')
        setParalelo('')
      }
    }
  }

  // 2. Cargar Estudiantes y Registros de Supabase filtrando por el Año Lectivo Activo Institucional
  const cargarRegistros = useCallback(async () => {
    if (!institucionId || !grado || !paralelo || !anioLectivo) return

    setCargando(true)
    try {
      const { data: estData } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', grado)
        .eq('paralelo', paralelo)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      if (estData) {
        setEstudiantes(estData)
        const ids = estData.map((e) => e.id)

        // Cargar registros desde la tabla real de acompañamiento integral filtrando por periodo
        const { data: regData } = await supabase
          .from('acompanamiento_integral')
          .select('*')
          .in('estudiante_id', ids.length > 0 ? ids : ['none'])
          .eq('item', itemSeleccionado)
          .eq('anio_lectivo', anioLectivo)

        const mapa: any = {}
        estData.forEach((est) => {
          const reg = regData?.find((r) => r.estudiante_id === est.id)
          mapa[est.id] = {
            t1: reg?.t1 || '',
            t2: reg?.t2 || '',
            t3: reg?.t3 || '',
            rec_t1: reg?.rec_t1 || '',
            rec_t2: reg?.rec_t2 || '',
            rec_t3: reg?.rec_t3 || '',
            rec_anual: reg?.rec_anual || ''
          }
        })
        setDatosMap(mapa)
      }
    } catch (err) {
      console.error('Error al sincronizar datos:', err)
    } finally {
      setCargando(false)
    }
  }, [institucionId, grado, paralelo, itemSeleccionado, anioLectivo])

  useEffect(() => {
    cargarRegistros()
  }, [cargarRegistros])

  const handleChangeValor = (estudianteId: string, campo: string, valor: string) => {
    if (esAnioCerrado) return
    setDatosMap((prev) => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        [campo]: valor
      }
    }))
  }

  // Guardar datos en Supabase incluyendo el anio_lectivo activo institucional
  const handleGuardar = async () => {
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado. No se pueden modificar registros históricos.')
      return
    }
    setGuardando(true)
    setMensaje(null)

    try {
      const payload = estudiantes.map((est) => {
        const d = datosMap[est.id] || {}
        return {
          estudiante_id: est.id,
          docente_id: docenteId,
          institucion_id: institucionId,
          grado_curso: grado,
          paralelo: paralelo,
          item: itemSeleccionado,
          anio_lectivo: anioLectivo,
          t1: d.t1 || '',
          t2: d.t2 || '',
          t3: d.t3 || '',
          rec_t1: d.rec_t1 || '',
          rec_t2: d.rec_t2 || '',
          rec_t3: d.rec_t3 || '',
          rec_anual: d.rec_anual || '',
          updated_at: new Date().toISOString()
        }
      })

      const { error } = await supabase.from('acompanamiento_integral').upsert(payload, {
        onConflict: 'estudiante_id, item, anio_lectivo'
      })

      if (error) throw error
      setMensaje({ tipo: 'exito', texto: `¡Información guardada correctamente para el periodo ${anioLectivo}!` })
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  const gradosUnicos = Array.from(new Set(misAsignaciones.map(a => a.grado_curso)))
  const paralelosDisponibles = Array.from(new Set(misAsignaciones.filter(a => a.grado_curso === grado).map(a => a.paralelo)))

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ENCABEZADO */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              Control Cualitativo y Recomendaciones
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              {nombreInstitucion} • Gestión de Desarrollo Integral
            </p>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {/* SELECTOR O INDICADOR VISUAL DINÁMICO DEL AÑO LECTIVO */}
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase">📅 Periodo:</span>
              {periodosDisponibles.length === 0 ? (
                <span className="text-xs font-bold text-amber-600 italic">Sin años creados</span>
              ) : (
                <select
                  value={anioLectivo}
                  onChange={(e) => handleCambiarPeriodo(e.target.value)}
                  className="bg-transparent text-xs font-black text-indigo-700 outline-none cursor-pointer"
                >
                  {periodosDisponibles.map(p => (
                    <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                  ))}
                </select>
              )}
            </div>
            
            {!esAnioCerrado && anioLectivo && (
              <button
                onClick={handleGuardar}
                disabled={guardando || estudiantes.length === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            )}
          </div>
        </div>

        {/* AVISO SI NO HAY AÑO ACTIVO */}
        {!anioLectivo && !cargando && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold">
            ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
          </div>
        )}

        {/* AVISO SI EL PERIODO ESTÁ CERRADO */}
        {esAnioCerrado && anioLectivo && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold flex items-center justify-between">
            <span>🔒 El año lectivo vigente ({anioLectivo}) se encuentra cerrado y bloqueado. Los registros están en modo de solo lectura.</span>
            <span className="bg-red-200 px-2.5 py-1 rounded">Modo Histórico</span>
          </div>
        )}

        {/* MENSAJES */}
        {mensaje && (
          <div className={`p-4 rounded-xl text-sm font-bold border ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {/* FILTROS Y PESTAÑAS */}
        <div className="bg-white p-4 rounded-2xl border shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Año / Grado</label>
            <select
              value={grado}
              onChange={(e) => handleGradoChange(e.target.value)}
              disabled={gradosUnicos.length <= 1}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {gradosUnicos.length === 0 ? (
                <option value="">Sin cursos asignados</option>
              ) : (
                gradosUnicos.map((g) => <option key={g} value={g}>{g}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Paralelo</label>
            <select
              value={paralelo}
              onChange={(e) => setParalelo(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {paralelosDisponibles.map((p) => (
                <option key={p} value={p}>Paralelo {p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Vista del Módulo</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => seccionTab !== 'calificaciones' && setSeccionTab('calificaciones')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${seccionTab === 'calificaciones' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'}`}
              >
                Escalas Cualitativas
              </button>
              <button
                onClick={() => seccionTab !== 'recomendaciones' && setSeccionTab('recomendaciones')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${seccionTab === 'recomendaciones' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'}`}
              >
                Recomendaciones
              </button>
            </div>
          </div>

          {seccionTab === 'calificaciones' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Área / Ítem</label>
              <select
                value={itemSeleccionado}
                onChange={(e) => setItemSeleccionado(e.target.value)}
                className="w-full p-2.5 border-2 border-indigo-300 rounded-xl text-xs font-black text-indigo-900 bg-indigo-50 outline-none"
              >
                <option value="Animación a la lectura">Animación a la lectura</option>
                <option value="Acompañamiento integral">Acompañamiento integral</option>
                {esSuperiorOBachillerato && (
                  <option value="Orientación vocacional">Orientación vocacional</option>
                )}
              </select>
            </div>
          )}
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
          {cargando ? (
            <div className="p-12 text-center text-slate-500 font-semibold text-xs">
              Sincronizando información de estudiantes...
            </div>
          ) : !anioLectivo ? (
            <div className="p-12 text-center text-amber-800 space-y-2 bg-amber-50">
              <p className="font-bold text-sm">⚠️ No hay un año lectivo activo configurado en la institución.</p>
            </div>
          ) : misAsignaciones.length === 0 ? (
            <div className="p-12 text-center text-amber-800 space-y-2 bg-amber-50">
              <p className="font-bold text-sm">⚠️ No tienes cursos o materias asignadas por el Rectorado para el periodo {anioLectivo}.</p>
            </div>
          ) : estudiantes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <p className="font-semibold text-sm">No hay estudiantes activos en este curso ({grado} "{paralelo}").</p>
            </div>
          ) : seccionTab === 'calificaciones' ? (
            /* TABLA DE CALIFICACIONES CUALITATIVAS */
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="bg-[#1E3A8A] text-white font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 w-10 text-center border border-slate-300">Nro</th>
                  <th className="p-3 w-32 border border-slate-300">Cédula</th>
                  <th className="p-3 min-w-62.5 border border-slate-300">Apellidos y Nombres</th>
                  <th className="p-3 text-center w-36 border border-slate-300">1ER TRI</th>
                  <th className="p-3 text-center w-36 border border-slate-300">2DO TRI</th>
                  <th className="p-3 text-center w-36 border border-slate-300">3ER TRI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {estudiantes.map((est, idx) => {
                  const d = datosMap[est.id] || {}

                  return (
                    <tr key={est.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-400 text-center border border-slate-300">{idx + 1}</td>
                      <td className="p-2.5 font-mono text-slate-600 border border-slate-300">{est.cedula || 'S/N'}</td>
                      <td className="p-2.5 font-bold text-slate-800 border border-slate-300 uppercase whitespace-nowrap">
                        {est.apellidos} {est.nombres}
                      </td>

                      {['t1', 't2', 't3'].map((tri) => (
                        <td key={tri} className="p-2 border border-slate-300 text-center">
                          <select
                            value={d[tri] || ''}
                            disabled={esAnioCerrado}
                            onChange={(e) => handleChangeValor(est.id, tri, e.target.value)}
                            className="w-24 p-1.5 text-center border rounded-lg font-bold text-indigo-900 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                          >
                            <option value="">-- Seleccionar --</option>
                            {escalasPermitidas.map((esc) => (
                              <option key={esc} value={esc}>{esc}</option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            /* TABLA DE RECOMENDACIONES */
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="bg-[#1E3A8A] text-white font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 w-10 text-center border border-slate-300">Nro</th>
                  <th className="p-3 w-32 border border-slate-300">Cédula</th>
                  <th className="p-3 min-w-55 border border-slate-300">Apellidos y Nombres</th>
                  <th className="p-3 text-center border border-slate-300">1ER TRIMESTRE</th>
                  <th className="p-3 text-center border border-slate-300">2DO TRIMESTRE</th>
                  <th className="p-3 text-center border border-slate-300">3ER TRIMESTRE</th>
                  <th className="p-3 text-center border border-slate-300">ANUAL (FINAL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {estudiantes.map((est, idx) => {
                  const d = datosMap[est.id] || {}

                  return (
                    <tr key={est.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-400 text-center border border-slate-300">{idx + 1}</td>
                      <td className="p-2.5 font-mono text-slate-600 border border-slate-300">{est.cedula || 'S/N'}</td>
                      <td className="p-2.5 font-bold text-slate-800 border border-slate-300 uppercase whitespace-nowrap">
                        {est.apellidos} {est.nombres}
                      </td>

                      <td className="p-2 border border-slate-300">
                        <input
                          type="text"
                          value={d.rec_t1 || ''}
                          disabled={esAnioCerrado}
                          onChange={(e) => handleChangeValor(est.id, 'rec_t1', e.target.value)}
                          placeholder="Escribir recomendación..."
                          className="w-full p-1.5 border rounded-lg text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                      </td>

                      <td className="p-2 border border-slate-300">
                        <input
                          type="text"
                          value={d.rec_t2 || ''}
                          disabled={esAnioCerrado}
                          onChange={(e) => handleChangeValor(est.id, 'rec_t2', e.target.value)}
                          placeholder="Escribir recomendación..."
                          className="w-full p-1.5 border rounded-lg text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                      </td>

                      <td className="p-2 border border-slate-300">
                        <input
                          type="text"
                          value={d.rec_t3 || ''}
                          disabled={esAnioCerrado}
                          onChange={(e) => handleChangeValor(est.id, 'rec_t3', e.target.value)}
                          placeholder="Escribir recomendación..."
                          className="w-full p-1.5 border rounded-lg text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                      </td>

                      <td className="p-2 border border-slate-300 bg-amber-50/40">
                        <input
                          type="text"
                          value={d.rec_anual || ''}
                          disabled={esAnioCerrado}
                          onChange={(e) => handleChangeValor(est.id, 'rec_anual', e.target.value)}
                          placeholder="Recomendación final..."
                          className="w-full p-1.5 border border-amber-300 rounded-lg text-amber-950 font-bold bg-white outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
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