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

  // Función auxiliar para retornar el color distintivo por trimestre
  const getTrimestreColorStyle = (triKey: string) => {
    switch (triKey) {
      case 't1':
      case 'rec_t1':
        return { backgroundColor: '#4b4c99', color: '#ffffff', borderColor: '#3b3c7d' } // Índigo institucional
      case 't2':
      case 'rec_t2':
        return { backgroundColor: '#389186', color: '#ffffff', borderColor: '#2c736a' } // Turquesa / Esmeralda
      case 't3':
      case 'rec_t3':
        return { backgroundColor: '#d99b1e', color: '#ffffff', borderColor: '#b58117' } // Ámbar / Dorado sobrio
      default:
        return { backgroundColor: '#4b4c99', color: '#ffffff', borderColor: '#3b3c7d' }
    }
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

  // Guardar datos en Supabase
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

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo Cualitativo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99]/20 selection:text-[#4b4c99] font-sans">

      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
          >
            Año Lectivo Vigente: {anioLectivo || 'Sin año activo'}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            Control Cualitativo y Recomendaciones
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Gestión de Desarrollo Integral
          </p>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          {/* SELECTOR DE PERIODO */}
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">📅 Periodo:</span>
            {periodosDisponibles.length === 0 ? (
              <span className="text-xs font-bold text-amber-700 italic">Sin años creados</span>
            ) : (
              <select
                value={anioLectivo}
                onChange={(e) => handleCambiarPeriodo(e.target.value)}
                style={{ color: '#4b4c99' }}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer"
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
              style={{ backgroundColor: '#4b4c99' }}
              className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {guardando ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
          )}
        </div>
      </div>

      {/* AVISO SI NO HAY AÑO ACTIVO */}
      {!anioLectivo && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          ⚠️️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {/* AVISO SI EL PERIODO ESTÁ CERRADO */}
      {esAnioCerrado && anioLectivo && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>🔒 El año lectivo vigente ({anioLectivo}) se encuentra cerrado y bloqueado. Los registros están en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Modo Histórico</span>
        </div>
      )}

      {/* MENSAJES */}
      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* FILTROS Y PESTAÑAS */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 items-center">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año / Grado</label>
          <select
            value={grado}
            onChange={(e) => handleGradoChange(e.target.value)}
            disabled={gradosUnicos.length <= 1}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {gradosUnicos.length === 0 ? (
              <option value="">Sin cursos asignados</option>
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
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {paralelosDisponibles.map((p) => (
              <option key={p} value={p}>Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Vista del Módulo</label>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-2xs">
            <button
              onClick={() => seccionTab !== 'calificaciones' && setSeccionTab('calificaciones')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${seccionTab === 'calificaciones' ? 'bg-[#4b4c99] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Escalas Cualitativas
            </button>
            <button
              onClick={() => seccionTab !== 'recomendaciones' && setSeccionTab('recomendaciones')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${seccionTab === 'recomendaciones' ? 'bg-[#4b4c99] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Recomendaciones
            </button>
          </div>
        </div>

        {seccionTab === 'calificaciones' && (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Área / Ítem</label>
            <select
              value={itemSeleccionado}
              onChange={(e) => setItemSeleccionado(e.target.value)}
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.05)', borderColor: 'rgba(75, 76, 153, 0.3)' }}
              className="w-full p-2.5 border-2 rounded-xl text-xs font-bold outline-none shadow-2xs"
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
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-x-auto">
        {cargando ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs">
            Sincronizando información de estudiantes...
          </div>
        ) : !anioLectivo ? (
          <div className="p-12 text-center text-amber-800 space-y-2 bg-amber-50/50">
            <p className="font-bold text-sm">⚠️ No hay un año lectivo activo configurado en la institución.</p>
          </div>
        ) : misAsignaciones.length === 0 ? (
          <div className="p-12 text-center text-amber-800 space-y-2 bg-amber-50/50">
            <p className="font-bold text-sm">⚠️ No tienes cursos o materias asignadas por el Rectorado para el periodo {anioLectivo}.</p>
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <p className="font-semibold text-sm">No hay estudiantes activos en este curso ({grado} "{paralelo}").</p>
          </div>
        ) : seccionTab === 'calificaciones' ? (
          /* TABLA DE CALIFICACIONES CUALITATIVAS CON COLORES DISTINTIVOS POR TRIMESTRE */
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center border border-slate-200">Nro</th>
                <th className="p-3 w-32 border border-slate-200">Cédula</th>
                <th className="p-3 min-w-62.5 border border-slate-200">Apellidos y Nombres</th>
                <th className="p-3 text-center w-36 border border-slate-200 text-white" style={{ backgroundColor: '#4b4c99' }}>1ER TRI</th>
                <th className="p-3 text-center w-36 border border-slate-200 text-white" style={{ backgroundColor: '#389186' }}>2DO TRI</th>
                <th className="p-3 text-center w-36 border border-slate-200 text-white" style={{ backgroundColor: '#d99b1e' }}>3ER TRI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {estudiantes.map((est, idx) => {
                const d = datosMap[est.id] || {}

                return (
                  <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2.5 font-bold text-slate-400 text-center border border-slate-200">{idx + 1}</td>
                    <td className="p-2.5 font-mono text-slate-600 border border-slate-200">{est.cedula || 'S/N'}</td>
                    <td className="p-2.5 font-bold text-slate-800 border border-slate-200 uppercase whitespace-nowrap">
                      {est.apellidos} {est.nombres}
                    </td>

                    {['t1', 't2', 't3'].map((tri) => {
                      const colorStyle = getTrimestreColorStyle(tri)
                      return (
                        <td key={tri} className="p-2 border border-slate-200 text-center">
                          <select
                            value={d[tri] || ''}
                            disabled={esAnioCerrado}
                            onChange={(e) => handleChangeValor(est.id, tri, e.target.value)}
                            style={{ 
                              color: d[tri] ? colorStyle.backgroundColor : '#334155',
                              borderColor: d[tri] ? colorStyle.backgroundColor : '#cbd5e1'
                            }}
                            className="w-24 p-1.5 text-center border-2 rounded-xl font-black bg-white outline-none focus:ring-1 disabled:bg-slate-100 shadow-2xs cursor-pointer"
                          >
                            <option value="">-- Seleccionar --</option>
                            {escalasPermitidas.map((esc) => (
                              <option key={esc} value={esc}>{esc}</option>
                            ))}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* TABLA DE RECOMENDACIONES CON ENCABEZADOS A COLOR POR TRIMESTRE */
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center border border-slate-200">Nro</th>
                <th className="p-3 w-32 border border-slate-200">Cédula</th>
                <th className="p-3 min-w-55 border border-slate-200">Apellidos y Nombres</th>
                <th className="p-3 text-center border border-slate-200 text-white" style={{ backgroundColor: '#4b4c99' }}>1ER TRIMESTRE</th>
                <th className="p-3 text-center border border-slate-200 text-white" style={{ backgroundColor: '#389186' }}>2DO TRIMESTRE</th>
                <th className="p-3 text-center border border-slate-200 text-white" style={{ backgroundColor: '#d99b1e' }}>3ER TRIMESTRE</th>
                <th className="p-3 text-center border border-slate-200 bg-amber-100 text-amber-950 font-black">ANUAL (FINAL)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {estudiantes.map((est, idx) => {
                const d = datosMap[est.id] || {}

                return (
                  <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2.5 font-bold text-slate-400 text-center border border-slate-200">{idx + 1}</td>
                    <td className="p-2.5 font-mono text-slate-600 border border-slate-200">{est.cedula || 'S/N'}</td>
                    <td className="p-2.5 font-bold text-slate-800 border border-slate-200 uppercase whitespace-nowrap">
                      {est.apellidos} {est.nombres}
                    </td>

                    <td className="p-2 border border-slate-200">
                      <input
                        type="text"
                        value={d.rec_t1 || ''}
                        disabled={esAnioCerrado}
                        onChange={(e) => handleChangeValor(est.id, 'rec_t1', e.target.value)}
                        placeholder="Recomendación 1er Tri..."
                        className="w-full p-2 border border-slate-300 rounded-xl text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] disabled:bg-slate-100 shadow-2xs font-medium"
                      />
                    </td>

                    <td className="p-2 border border-slate-200">
                      <input
                        type="text"
                        value={d.rec_t2 || ''}
                        disabled={esAnioCerrado}
                        onChange={(e) => handleChangeValor(est.id, 'rec_t2', e.target.value)}
                        placeholder="Recomendación 2do Tri..."
                        className="w-full p-2 border border-slate-300 rounded-xl text-slate-900 bg-white outline-none focus:border-[#389186] focus:ring-1 focus:ring-[#389186] disabled:bg-slate-100 shadow-2xs font-medium"
                      />
                    </td>

                    <td className="p-2 border border-slate-200">
                      <input
                        type="text"
                        value={d.rec_t3 || ''}
                        disabled={esAnioCerrado}
                        onChange={(e) => handleChangeValor(est.id, 'rec_t3', e.target.value)}
                        placeholder="Recomendación 3er Tri..."
                        className="w-full p-2 border border-slate-300 rounded-xl text-slate-900 bg-white outline-none focus:border-[#d99b1e] focus:ring-1 focus:ring-[#d99b1e] disabled:bg-slate-100 shadow-2xs font-medium"
                      />
                    </td>

                    <td className="p-2 border border-slate-200 bg-amber-50/20">
                      <input
                        type="text"
                        value={d.rec_anual || ''}
                        disabled={esAnioCerrado}
                        onChange={(e) => handleChangeValor(est.id, 'rec_anual', e.target.value)}
                        placeholder="Recomendación final..."
                        className="w-full p-2 border border-amber-300 rounded-xl text-amber-950 font-bold bg-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:bg-slate-100 shadow-2xs"
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
  )
}