'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DocenteDisciplinaPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [docenteId, setDocenteId] = useState('')
  const [gradosDocente, setGradosDocente] = useState<string[]>([])
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('2026-2027')

  const [alertas, setAlertas] = useState<any[]>([])
  const [estudiantesActivos, setEstudiantesActivos] = useState<any[]>([])

  // Modal de registro de alerta
  const [modalAbierto, setModalAbierto] = useState(false)
  const [estudianteId, setEstudianteId] = useState('')
  const [tipoAlerta, setTipoAlerta] = useState('Indisciplina en Aula')
  const [gravedad, setGravedad] = useState('Leve')
  const [descripcion, setDescripcion] = useState('')
  const [fechaIncidente, setFechaIncidente] = useState(new Date().toISOString().split('T')[0])

  // Filtros internos dentro del modal para búsqueda rápida
  const [modalFiltroJornada, setModalFiltroJornada] = useState('TODAS')
  const [modalFiltroGrado, setModalFiltroGrado] = useState('TODOS')

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      setDocenteId(user.id)

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (!doc?.institucion_id) return router.push('/')

      setInstitucionId(doc.institucion_id)
      setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
      const grados = doc.grados_asignados || []
      setGradosDocente(grados)

      const anioActivo = doc.instituciones?.anio_lectivo_activo || '2026-2027'
      setAnioLectivoVigente(anioActivo)

      await cargarAlertasDocente(user.id, doc.institucion_id, anioActivo)
      await cargarEstudiantesPermitidos(doc.institucion_id, anioActivo, grados)
    } catch (err) {
      console.error('Error al inicializar módulo de disciplina:', err)
    } finally {
      setCargando(false)
    }
  }

  const cargarAlertasDocente = async (docId: string, instId: string, anio: string) => {
    const { data } = await supabase
      .from('alertas_disciplinarias')
      .select(`
        *,
        estudiantes (nombres, apellidos, grado_curso, paralelo)
      `)
      .eq('institucion_id', instId)
      .eq('docente_emisor_id', docId)
      .eq('anio_lectivo', anio)
      .order('created_at', { ascending: false })

    if (data) setAlertas(data)
  }

  const cargarEstudiantesPermitidos = async (instId: string, anio: string, grados: string[]) => {
    let query = supabase
      .from('estudiantes')
      .select('id, nombres, apellidos, grado_curso, paralelo, jornada, anio_lectivo')
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .eq('estado', 'activo')

    if (grados.length > 0) {
      query = query.in('grado_curso', grados)
    }

    const { data } = await query.order('apellidos', { ascending: true })
    if (data) setEstudiantesActivos(data)
  }

  const handleCrearAlerta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!estudianteId || !descripcion.trim()) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un estudiante y describe la incidencia.' })
      return
    }

    // Si es felicitación, guardamos gravedad como 'N/A' (No Aplica)
    const gravedadFinal = tipoAlerta === 'Felicitación / Mérito' ? 'N/A' : gravedad

    setProcesando(true)
    setMensaje(null)

    try {
      const { error } = await supabase.from('alertas_disciplinarias').insert([{
        institucion_id: institucionId,
        estudiante_id: estudianteId,
        docente_emisor_id: docenteId,
        tipo_alerta: tipoAlerta,
        gravedad: gravedadFinal,
        descripcion: descripcion.trim(),
        fecha_incidente: fechaIncidente,
        anio_lectivo: anioLectivoVigente
      }])

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: 'Alerta o reconocimiento registrado con éxito.' })
      setEstudianteId('')
      setDescripcion('')
      setModalAbierto(false)
      await cargarAlertasDocente(docenteId, institucionId, anioLectivoVigente)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al registrar: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  const gradosModalDisponibles = Array.from(new Set(estudiantesActivos.map(e => e.grado_curso))).sort()

  const estudiantesModalFiltrados = estudiantesActivos.filter(est => {
    const matchJornada = modalFiltroJornada === 'TODAS' || (est.jornada || 'MATUTINA') === modalFiltroJornada
    const matchGrado = modalFiltroGrado === 'TODOS' || est.grado_curso === modalFiltroGrado
    return matchJornada && matchGrado
  })

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo Disciplinario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#4b4c99] selection:text-white">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border bg-indigo-50 text-[#4b4c99] border-indigo-200 inline-block mb-1.5">
            Convivencia Escolar • Periodo {anioLectivoVigente}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Control Disciplinario y Alertas de Estudiantes
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Registro de incidencias y reconocimientos.
          </p>
        </div>

        <button
          onClick={() => setModalAbierto(true)}
          style={{ backgroundColor: '#4b4c99' }}
          className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2"
        >
          <span>+</span> Registrar Nueva Alerta / Mérito
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* TABLA DE ALERTAS REGISTRADAS POR EL DOCENTE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div style={{ backgroundColor: '#4b4c99' }} className="p-4 text-xs font-bold uppercase text-white tracking-wider flex justify-between items-center">
          <span>Mis Alertas e Incidencias Registradas</span>
          <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-xl">Total: {alertas.length}</span>
        </div>

        {alertas.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No has registrado alertas disciplinarias ni reconocimientos en este periodo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Estudiante</th>
                  <th className="p-3.5">Grado / Curso</th>
                  <th className="p-3.5">Tipo de Incidencia</th>
                  <th className="p-3.5">Gravedad</th>
                  <th className="p-3.5">Descripción</th>
                  <th className="p-3.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {alertas.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/85 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-600">{item.fecha_incidente}</td>
                    <td className="p-3.5 font-bold text-slate-800">{item.estudiantes?.apellidos} {item.estudiantes?.nombres}</td>
                    <td className="p-3.5 font-bold text-slate-700">{item.estudiantes?.grado_curso} "{item.estudiantes?.paralelo}"</td>
                    <td className="p-3.5 text-indigo-900 font-semibold">{item.tipo_alerta}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        item.gravedad === 'Leve' ? 'bg-amber-100 text-amber-800' :
                        item.gravedad === 'Grave' ? 'bg-orange-100 text-orange-800' :
                        item.gravedad === 'Muy Grave' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.gravedad}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 max-w-xs truncate">{item.descripcion}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {item.estado_notificacion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA NUEVA ALERTA */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                Registrar Incidencia o Mérito Estudiantil
              </h2>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleCrearAlerta} className="space-y-4 text-xs">
              
              {/* FILTROS RÁPIDOS DE JORNADA Y AÑO DE BÁSICA */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="text-[10px] font-bold uppercase text-[#4b4c99] block">Filtrar Estudiante (Año Lectivo: {anioLectivoVigente})</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Jornada</label>
                    <select
                      value={modalFiltroJornada}
                      onChange={(e) => setModalFiltroJornada(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="TODAS">Todas</option>
                      <option value="MATUTINA">Matutina</option>
                      <option value="VESPERTINA">Vespertina</option>
                      <option value="NOCTURNA">Nocturna</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Año / Grado</label>
                    <select
                      value={modalFiltroGrado}
                      onChange={(e) => setModalFiltroGrado(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="TODOS">Todos</option>
                      {gradosModalDisponibles.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5 mt-2">Seleccionar Estudiante</label>
                  <select
                    required
                    value={estudianteId}
                    onChange={(e) => setEstudianteId(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
                  >
                    <option value="">Selecciona un estudiante ({estudiantesModalFiltrados.length} disponibles)...</option>
                    {estudiantesModalFiltrados.map((est) => (
                      <option key={est.id} value={est.id}>
                        {est.apellidos} {est.nombres} ({est.grado_curso} "{est.paralelo}" - {est.jornada || 'MATUTINA'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Tipo de Registro</label>
                  <select
                    value={tipoAlerta}
                    onChange={(e) => setTipoAlerta(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
                  >
                    <option value="Indisciplina en Aula">Indisciplina en Aula</option>
                    <option value="Atraso Injustificado">Atraso Injustificado</option>
                    <option value="Falta de Materiales / Deberes">Falta de Materiales / Deberes</option>
                    <option value="Falta de Respeto">Falta de Respeto</option>
                    <option value="Felicitación / Mérito">Felicitación / Mérito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Gravedad</label>
                  <select
                    value={tipoAlerta === 'Felicitación / Mérito' ? 'N/A' : gravedad}
                    disabled={tipoAlerta === 'Felicitación / Mérito'}
                    onChange={(e) => setGravedad(e.target.value)}
                    className={`w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs cursor-pointer ${
                      tipoAlerta === 'Felicitación / Mérito' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                    }`}
                  >
                    {tipoAlerta === 'Felicitación / Mérito' ? (
                      <option value="N/A">No Aplica (Mérito)</option>
                    ) : (
                      <>
                        <option value="Leve">Leve</option>
                        <option value="Grave">Grave</option>
                        <option value="Muy Grave">Muy Grave</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Fecha del Incidente</label>
                <input
                  type="date"
                  required
                  value={fechaIncidente}
                  onChange={(e) => setFechaIncidente(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Descripción Detallada</label>
                <textarea
                  required
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalla lo sucedido o el motivo del reconocimiento..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={procesando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {procesando ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}