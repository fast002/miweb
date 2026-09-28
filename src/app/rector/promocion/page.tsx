'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function GestionPromocionPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null)

  // Datos de Institución
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [esAutoridad, setEsAutoridad] = useState(false)

  // Periodos y Años
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])
  const [anioSeleccionado, setAnioSeleccionado] = useState('')
  
  // Periodo destino seleccionado
  const [nuevoAnioDestino, setNuevoAnioDestino] = useState('')

  // Estudiantes evaluados para promoción
  const [estudiantesPromocion, setEstudiantesPromocion] = useState<any[]>([])
  const [notaMinima, setNotaMinima] = useState(7.0)

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (doc?.institucion_id) {
        setInstitucionId(doc.institucion_id)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')

        const rol = doc.rol?.toLowerCase() || ''
        const autoridadFlag = rol.includes('rector') || rol.includes('vicerrector') || rol.includes('director')
        setEsAutoridad(autoridadFlag)

        const inst = doc.instituciones
        const periodosInst: string[] = inst?.periodos_disponibles || []
        setPeriodosDisponibles(periodosInst)
        setAnosCerrados(inst?.anos_cerrados || [])

        let anioInicial = ''
        if (inst?.anio_lectivo_activo && periodosInst.includes(inst.anio_lectivo_activo)) {
          anioInicial = inst.anio_lectivo_activo
        } else if (periodosInst.length > 0) {
          anioInicial = periodosInst[0]
        }

        setAnioSeleccionado(anioInicial)

        // Tipado explícito de 'p' para evitar el error de TypeScript
        const siguientePeriodo = periodosInst.find((p: string) => p !== anioInicial) || ''
        setNuevoAnioDestino(siguientePeriodo)

        if (anioInicial) {
          await evaluarPromocionEstudiantes(doc.institucion_id, anioInicial)
        }
      }
    } catch (err: any) {
      console.error('Error al cargar datos de promoción:', err)
    } finally {
      setCargando(false)
    }
  }

  // Evaluar promedios anuales de los estudiantes para determinar promoción
  const evaluarPromocionEstudiantes = async (instId: string, anio: string) => {
    try {
      const { data: estudiantesData, error: estError } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', instId)
        .eq('anio_lectivo', anio)
        .eq('estado', 'activo')

      if (estError) throw estError

      const { data: califData, error: calError } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('anio_lectivo', anio)

      if (calError) throw calError

      const evaluados = estudiantesData.map((est: any) => {
        const notasEstudiante = califData.filter((c: any) => c.estudiante_id === est.id)
        
        if (notasEstudiante.length === 0) {
          return { ...est, promedioGeneral: 0, estadoPromocion: 'SIN CALIFICACIONES' }
        }

        const sumaNotas = notasEstudiante.reduce((acc: number, curr: any) => acc + (Number(curr.promedio_parcial) || 0), 0)
        const promedio = Number((sumaNotas / notasEstudiante.length).toFixed(2))

        let estadoPromocion = 'PROMOVIDO'
        if (promedio < notaMinima) {
          estadoPromocion = 'SUPLETORIO / REPROBADO'
        }

        return {
          ...est,
          promedioGeneral: promedio,
          estadoPromocion
        }
      })

      setEstudiantesPromocion(evaluados)
    } catch (err: any) {
      console.error('Error evaluando promoción:', err)
    }
  }

  // Función para avanzar al siguiente grado
  const obtenerSiguienteGrado = (gradoActual: string) => {
    const mapaGrados: { [key: string]: string } = {
      '2do Grado EGB': '3ro Grado EGB',
      '3ro Grado EGB': '4to Grado EGB',
      '4to Grado EGB': '5to Grado EGB',
      '5to Grado EGB': '6to Grado EGB',
      '6to Grado EGB': '7mo Grado EGB',
      '7mo Grado EGB': '8vo EGB',
      '8vo EGB': '9no EGB',
      '9no EGB': '10mo EGB',
      '10mo EGB': '1ro Curso BGU',
      '1ro Curso': '2do Curso',
      '2do Curso': '3ro Curso'
    }
    return mapaGrados[gradoActual] || gradoActual
  }

  // Ejecutar el Cierre de Ciclo y Promoción Automática
  const handleEjecutarCierreYPromocion = async () => {
    if (!esAutoridad) {
      alert('⚠️ Solo las autoridades institucionales (Rector/Vicerrector) pueden ejecutar el cierre de ciclo.')
      return
    }

    if (!nuevoAnioDestino.trim()) {
      alert('⚠️ Por favor, selecciona un año lectivo de destino válido de la lista.')
      return
    }

    if (nuevoAnioDestino === anioSeleccionado) {
      alert('⚠️ El periodo de destino no puede ser el mismo que estás cerrando.')
      return
    }

    if (anosCerrados.includes(anioSeleccionado)) {
      alert('⚠️ Este año lectivo ya se encuentra cerrado.')
      return
    }

    if (!confirm(`¿Estás seguro de cerrar el año ${anioSeleccionado}, promover a los estudiantes aprobados al periodo institucional (${nuevoAnioDestino}) y congelar registros?`)) {
      return
    }

    setProcesando(true)
    setMensaje(null)

    try {
      const promovidos = estudiantesPromocion.filter((e: any) => e.estadoPromocion === 'PROMOVIDO')
      
      const nuevosRegistros = promovidos.map((est: any) => ({
        institucion_id: institucionId,
        cedula: est.cedula,
        apellidos: est.apellidos,
        nombres: est.nombres,
        subnivel: est.subnivel,
        jornada: est.jornada,
        grado_curso: obtenerSiguienteGrado(est.grado_curso),
        paralelo: est.paralelo,
        estado: 'activo',
        anio_lectivo: nuevoAnioDestino
      }))

      if (nuevosRegistros.length > 0) {
        const { error: insertError } = await supabase.from('estudiantes').insert(nuevosRegistros)
        if (insertError) throw insertError
      }

      const nuevosAnosCerrados = [...anosCerrados, anioSeleccionado]

      const { error: updateInstError } = await supabase
        .from('instituciones')
        .update({
          anos_cerrados: nuevosAnosCerrados,
          anio_lectivo_activo: nuevoAnioDestino
        })
        .eq('id', institucionId)

      if (updateInstError) throw updateInstError

      setMensaje({ 
        tipo: 'exito', 
        texto: `🎉 ¡Cierre de año ejecutado con éxito! Se promovieron ${nuevosRegistros.length} estudiantes al periodo oficial ${nuevoAnioDestino}.` 
      })

      setAnosCerrados(nuevosAnosCerrados)
      setAnioSeleccionado(nuevoAnioDestino)
      await cargarDatosIniciales()

    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al ejecutar cierre de ciclo: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Módulo de Promoción y Cierre...</p>
        </div>
      </div>
    )
  }

  const esActualCerrado = anosCerrados.includes(anioSeleccionado)
  const periodosDestinoValidos = periodosDisponibles.filter((p: string) => p !== anioSeleccionado)

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-wide uppercase">
              Cierre de Ciclo y Promoción Estudiantil 🎓
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {nombreInstitucion} • <strong className="text-slate-700">{esAutoridad ? 'Panel Directivo [Control de Promoción]' : 'Acceso Restringido'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">📅 Periodo a Evaluar:</span>
              <select
                value={anioSeleccionado}
                onChange={async (e) => {
                  const val = e.target.value
                  setAnioSeleccionado(val)
                  const siguienteVal = periodosDisponibles.find((p: string) => p !== val) || ''
                  setNuevoAnioDestino(siguienteVal)
                  await evaluarPromocionEstudiantes(institucionId, val)
                }}
                className="bg-transparent text-xs font-black text-indigo-700 outline-none cursor-pointer"
              >
                {periodosDisponibles.map((p: string) => (
                  <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!esAutoridad && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-xs font-bold">
            ⚠️ Este módulo está reservado exclusivamente para Autoridades Institucionales (Rectores / Directores).
          </div>
        )}

        {mensaje && (
          <div className={`p-4 rounded-xl text-sm font-bold border ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {/* PANEL DE ACCIÓN DE CIERRE */}
        {esAutoridad && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-800 text-sm uppercase">Asistente de Cierre de Año Lectivo ({anioSeleccionado})</h2>
            
            {esActualCerrado ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-bold">
                🔒 El periodo {anioSeleccionado} ya se encuentra cerrado y archivado oficialmente.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 p-4 rounded-xl border">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nota Mínima de Aprobación</label>
                  <input
                    type="number"
                    step="0.1"
                    value={notaMinima}
                    onChange={(e) => setNotaMinima(Number(e.target.value))}
                    className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Periodo Institucional de Destino</label>
                  <select
                    value={nuevoAnioDestino}
                    onChange={(e) => setNuevoAnioDestino(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-white outline-none cursor-pointer"
                  >
                    <option value="">-- Selecciona periodo de destino --</option>
                    {periodosDestinoValidos.map((p: string) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleEjecutarCierreYPromocion}
                  disabled={procesando || !nuevoAnioDestino}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
                >
                  {procesando ? 'Procesando Cierre...' : '🔒 Ejecutar Cierre y Promover Alumnos'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TABLA DE EVALUACIÓN DE PROMOCIÓN */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <h2 className="font-bold text-slate-800 text-xs uppercase">Estado de Promoción de Estudiantes ({anioSeleccionado})</h2>
            <span className="text-xs text-slate-500 font-semibold">Total Evaluados: {estudiantesPromocion.length}</span>
          </div>

          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Apellidos y Nombres</th>
                <th className="p-3">Grado / Curso Actual</th>
                <th className="p-3 text-center">Promedio Anual</th>
                <th className="p-3 text-center">Estado Académico</th>
                <th className="p-3 text-center">Grado al que Avanza</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {estudiantesPromocion.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    No hay estudiantes activos en el periodo {anioSeleccionado}.
                  </td>
                </tr>
              ) : (
                estudiantesPromocion.map((est: any, idx: number) => (
                  <tr key={est.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-800">{est.apellidos} {est.nombres}</td>
                    <td className="p-3 font-medium text-slate-600">{est.grado_curso} "{est.paralelo}"</td>
                    <td className="p-3 text-center font-black text-slate-800">{est.promedioGeneral.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        est.estadoPromocion === 'PROMOVIDO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {est.estadoPromocion}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-indigo-700">
                      {est.estadoPromocion === 'PROMOVIDO' ? obtenerSiguienteGrado(est.grado_curso) : '---'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}