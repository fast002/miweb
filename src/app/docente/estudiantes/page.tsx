'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function GestionEstudiantesPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Datos del Usuario, Institución y Rol
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [esAutoridad, setEsAutoridad] = useState(false)
  const [userId, setUserId] = useState('')
  
  // Control Dinámico de Años Lectivos Propios de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Carga Horaria Asignada por el Rector (para docentes) o total de grados (para rector)
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])

  // Lista de Estudiantes y Filtros
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [filtroJornada, setFiltroJornada] = useState('MATUTINA')
  const [filtroGrado, setFiltroGrado] = useState('')
  const [filtroParalelo, setFiltroParalelo] = useState('')

  // Formulario Individual
  const [cedula, setCedula] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [nombres, setNombres] = useState('')
  const [subnivel, setSubnivel] = useState('Básica Media')
  const [jornadaForm, setJornadaForm] = useState('MATUTINA')
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('A')

  // Carga Masiva (Pegar Lista)
  const [mostrarModalMasivo, setMostrarModalMasivo] = useState(false)
  const [textoMasivo, setTextoMasivo] = useState('')

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  // Cargar datos institucionales, periodos creados y rol
  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')
      setUserId(user.id)

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
        const periodosInst = inst?.periodos_disponibles || []
        setPeriodosDisponibles(periodosInst)
        setAnosCerrados(inst?.anos_cerrados || [])

        let anioInicial = ''
        if (inst?.anio_lectivo_activo && periodosInst.includes(inst.anio_lectivo_activo)) {
          anioInicial = inst.anio_lectivo_activo
        } else if (periodosInst.length > 0) {
          anioInicial = periodosInst[0]
        }

        setAnioLectivoVigente(anioInicial)

        if (anioInicial) {
          await cargarAsignacionesYEstudiantes(user.id, doc.institucion_id, autoridadFlag, anioInicial)
        }
      }
    } catch (err: any) {
      console.error('Error al cargar datos iniciales:', err)
    } finally {
      setCargando(false)
    }
  }

  // Cargar asignaciones de carga horaria y alumnos según el periodo seleccionado
  const cargarAsignacionesYEstudiantes = async (uId: string, instId: string, autoridadFlag: boolean, anio: string) => {
    let asignacionesValidas = []
    if (autoridadFlag) {
      const { data: allAsigs } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('institucion_id', instId)
        .eq('anio_lectivo', anio)
      asignacionesValidas = allAsigs || []
    } else {
      const { data: asigs } = await supabase
        .from('docente_asignaciones')
        .select('*')
        .eq('docente_id', uId)
        .eq('anio_lectivo', anio)
      asignacionesValidas = asigs || []
    }

    setMisAsignaciones(asignacionesValidas)

    if (asignacionesValidas.length > 0) {
      const primeraAsignacion = asignacionesValidas[0]
      const primeraJornada = primeraAsignacion.jornada || 'MATUTINA'
      
      setFiltroJornada(primeraJornada)
      setJornadaForm(primeraJornada)
      
      const gradosDeJornada = Array.from(new Set(asignacionesValidas.filter(a => (a.jornada || 'MATUTINA') === primeraJornada).map(a => a.grado_curso)))
      if (gradosDeJornada.length > 0) {
        setGrado(gradosDeJornada[0])
        setFiltroGrado(gradosDeJornada[0])
        
        const paralelosDeGrado = asignacionesValidas.filter(a => (a.jornada || 'MATUTINA') === primeraJornada && a.grado_curso === gradosDeJornada[0])
        if (paralelosDeGrado.length > 0) {
          setParalelo(paralelosDeGrado[0].paralelo)
          setFiltroParalelo(paralelosDeGrado[0].paralelo)
        }
      }

      detectarSubnivel(gradosDeJornada[0] || '')
    } else {
      setMisAsignaciones([])
      setFiltroGrado('')
      setFiltroParalelo('')
    }

    await cargarEstudiantes(instId, anio)
  }

  // Cambio dinámico del periodo seleccionado en el selector superior
  const handleCambiarPeriodo = async (nuevoAnio: string) => {
    setAnioLectivoVigente(nuevoAnio)
    if (institucionId && userId) {
      await cargarAsignacionesYEstudiantes(userId, institucionId, esAutoridad, nuevoAnio)
    }
  }

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

  const handleJornadaFormChange = (nuevaJornada: string) => {
    setJornadaForm(nuevaJornada)
    const gradosDeJornada = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada).map(a => a.grado_curso)))
    if (gradosDeJornada.length > 0) {
      setGrado(gradosDeJornada[0])
      detectarSubnivel(gradosDeJornada[0])
      const paralelosDelGrado = misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada && a.grado_curso === gradosDeJornada[0])
      if (paralelosDelGrado.length > 0) {
        setParalelo(paralelosDelGrado[0].paralelo)
      }
    }
  }

  const handleGradoSelectChange = (nuevoGrado: string) => {
    setGrado(nuevoGrado)
    detectarSubnivel(nuevoGrado)
    const paralelosDelGrado = misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaForm && a.grado_curso === nuevoGrado)
    if (paralelosDelGrado.length > 0) {
      setParalelo(paralelosDelGrado[0].paralelo)
    }
  }

  const handleFiltroJornadaChange = (nuevaJornada: string) => {
    setFiltroJornada(nuevaJornada)
    const gradosDeJornada = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada).map(a => a.grado_curso)))
    if (gradosDeJornada.length > 0) {
      setFiltroGrado(gradosDeJornada[0])
      const paralelosDelGrado = misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada && a.grado_curso === gradosDeJornada[0])
      if (paralelosDelGrado.length > 0) {
        setFiltroParalelo(paralelosDelGrado[0].paralelo)
      }
    } else {
      setFiltroGrado('')
      setFiltroParalelo('')
    }
  }

  const cargarEstudiantes = async (instId: string, anio: string) => {
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .order('apellidos', { ascending: true })

    if (!error && data) {
      setEstudiantes(data)
    }
  }

  const esAnioCerrado = anioLectivoVigente ? anosCerrados.includes(anioLectivoVigente) : false

  // Registrar Alumno Individual
  const handleCrearEstudiante = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!anioLectivoVigente) {
      alert('Debe seleccionar un año lectivo válido.')
      return
    }
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado. No se pueden registrar nuevos estudiantes.')
      return
    }

    setProcesando(true)
    setMensaje(null)

    try {
      const { error } = await supabase.from('estudiantes').insert([{
        institucion_id: institucionId,
        cedula: cedula.trim(),
        apellidos: apellidos.trim().toUpperCase(),
        nombres: nombres.trim().toUpperCase(),
        subnivel,
        jornada: jornadaForm,
        grado_curso: grado,
        paralelo,
        estado: 'activo',
        anio_lectivo: anioLectivoVigente
      }])

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: '¡Estudiante registrado correctamente!' })
      setCedula('')
      setApellidos('')
      setNombres('')
      await cargarEstudiantes(institucionId, anioLectivoVigente)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al registrar: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  // Carga Masiva pegando texto
  const handleCargaMasiva = async () => {
    if (esAnioCerrado) return alert('🔒 Periodo cerrado.')
    if (!textoMasivo.trim()) return

    setProcesando(true)
    setMensaje(null)

    try {
      const lineas = textoMasivo.split('\n').filter((l) => l.trim().length > 0)
      const nuevosEstudiantes = lineas.map((linea) => {
        const partes = linea.trim().split(',')
        return {
          institucion_id: institucionId,
          apellidos: partes[0] ? partes[0].trim().toUpperCase() : '',
          nombres: partes[1] ? partes[1].trim().toUpperCase() : '',
          subnivel,
          jornada: jornadaForm,
          grado_curso: grado,
          paralelo,
          estado: 'activo',
          anio_lectivo: anioLectivoVigente
        }
      })

      const { error } = await supabase.from('estudiantes').insert(nuevosEstudiantes)
      if (error) throw error

      setMensaje({ tipo: 'exito', texto: `¡Se importaron ${nuevosEstudiantes.length} estudiantes correctamente en la jornada ${jornadaForm}!` })
      setTextoMasivo('')
      setMostrarModalMasivo(false)
      await cargarEstudiantes(institucionId, anioLectivoVigente)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error en carga masiva: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  const handleToggleEstado = async (id: string, estadoActual: string) => {
    if (esAnioCerrado) return alert('🔒 Periodo cerrado.')
    const nuevoEstado = estadoActual === 'activo' ? 'retirado' : 'activo'
    const { error } = await supabase
      .from('estudiantes')
      .update({ estado: nuevoEstado })
      .eq('id', id)

    if (!error) {
      setEstudiantes((prev) => prev.map((e) => (e.id === id ? { ...e, estado: nuevoEstado } : e)))
    }
  }

  const handleEliminarEstudiante = async (id: string) => {
    if (esAnioCerrado) return alert('🔒 Periodo cerrado.')
    if (!confirm('¿Estás seguro de eliminar permanentemente a este estudiante?')) return

    const { error } = await supabase
      .from('estudiantes')
      .delete()
      .eq('id', id)

    if (!error) {
      setEstudiantes((prev) => prev.filter((e) => e.id !== id))
      setMensaje({ tipo: 'exito', texto: 'Estudiante eliminado de la base de datos.' })
    } else {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar: ' + error.message })
    }
  }

  // Listas dinámicas para formulario e interfaz
  const jornadasUnicasForm = Array.from(new Set(misAsignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicosForm = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaForm).map(a => a.grado_curso)))
  const paralelosPermitidosForm = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaForm && a.grado_curso === grado).map(a => a.paralelo)))

  const jornadasUnicasFiltro = Array.from(new Set(misAsignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicosFiltro = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === filtroJornada).map(a => a.grado_curso)))
  const paralelosPermitidosFiltro = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === filtroJornada && (!filtroGrado || a.grado_curso === filtroGrado)).map(a => a.paralelo)))

  const estudiantesFiltrados = estudiantes.filter((e) => {
    const estJornada = e.jornada || 'MATUTINA'
    const cumpleJornada = estJornada === filtroJornada
    const cumpleGrado = !filtroGrado || e.grado_curso === filtroGrado
    const cumpleParalelo = !filtroParalelo || e.paralelo === filtroParalelo
    return cumpleJornada && cumpleGrado && cumpleParalelo
  })

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Nómina Estudiantil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO SUPERIOR CON ESTILO MINIMALISTA Y SELECTOR DE AÑOS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-wide uppercase">
              Nómina Institucional de Estudiantes 👥
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {nombreInstitucion} • <strong className="text-slate-700">{esAutoridad ? 'Rol Directivo' : 'Rol Docente [Carga Asignada]'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* SELECTOR DINÁMICO DE AÑOS LECTIVOS CREADOS POR LA INSTITUCIÓN */}
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">📅 Periodo:</span>
              {periodosDisponibles.length === 0 ? (
                <span className="text-xs font-bold text-amber-600 italic">Sin años creados</span>
              ) : (
                <select
                  value={anioLectivoVigente}
                  onChange={(e) => handleCambiarPeriodo(e.target.value)}
                  className="bg-transparent text-xs font-black text-indigo-700 outline-none cursor-pointer"
                >
                  {periodosDisponibles.map((p) => (
                    <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                  ))}
                </select>
              )}
            </div>

            {!esAnioCerrado && periodosDisponibles.length > 0 && (
              <button
                onClick={() => setMostrarModalMasivo(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-2xs transition"
              >
                📋 Carga Masiva de Lista
              </button>
            )}
          </div>
        </div>

        {/* AVISO SI EL PERIODO ESTÁ CERRADO */}
        {esAnioCerrado && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between text-red-900 text-xs font-bold">
            <span>🔒 El año lectivo vigente ({anioLectivoVigente}) se encuentra cerrado y bloqueado. La nómina está en modo de solo lectura.</span>
            <span className="bg-red-200 px-2.5 py-1 rounded-lg">Modo Archivo</span>
          </div>
        )}

        {/* AVISO SI NO HAY PERIODOS CREADOS */}
        {periodosDisponibles.length === 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold">
            ⚠️ No se han encontrado años lectivos configurados para esta institución. Por favor, créelos primero desde el Panel Principal.
          </div>
        )}

        {mensaje && (
          <div className={`p-4 rounded-xl text-sm font-bold border ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* FORMULARIO DE REGISTRO INDIVIDUAL */}
          {!esAnioCerrado && periodosDisponibles.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 h-fit">
              <h2 className="font-bold text-slate-800 text-sm uppercase">Registrar Estudiante ({anioLectivoVigente})</h2>
              
              <form onSubmit={handleCrearEstudiante} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Cédula (Opcional)</label>
                  <input
                    type="text"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="Ej: 0102030405"
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Apellidos Completo(s)</label>
                  <input
                    type="text"
                    required
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Ej: SIGUENCIA URGILEZ"
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nombres Completo(s)</label>
                  <input
                    type="text"
                    required
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    placeholder="Ej: AMY DANIELA"
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Jornada</label>
                  <select
                    value={jornadaForm}
                    onChange={(e) => handleJornadaFormChange(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
                  >
                    {jornadasUnicasForm.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Grado / Año</label>
                    <select
                      value={grado}
                      onChange={(e) => handleGradoSelectChange(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
                    >
                      {gradosUnicosForm.length === 0 ? (
                        <option value="">Sin grados</option>
                      ) : (
                        gradosUnicosForm.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Paralelo</label>
                    <select
                      value={paralelo}
                      onChange={(e) => setParalelo(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
                    >
                      {paralelosPermitidosForm.length === 0 ? (
                        <option value="">Sin paralelo</option>
                      ) : (
                        paralelosPermitidosForm.map((p) => (
                          <option key={p} value={p}>Paralelo {p}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={procesando || misAsignaciones.length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50 mt-2"
                >
                  {procesando ? 'Guardando...' : '+ Guardar Estudiante'}
                </button>
              </form>
            </div>
          )}

          {/* TABLA Y FILTROS DE LA NÓMINA CON JORNADA */}
          <div className={`${esAnioCerrado || periodosDisponibles.length === 0 ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4`}>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Jornada:</label>
                <select
                  value={filtroJornada}
                  onChange={(e) => handleFiltroJornadaChange(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  {jornadasUnicasFiltro.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Año / Grado:</label>
                <select
                  value={filtroGrado}
                  onChange={(e) => setFiltroGrado(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  {gradosUnicosFiltro.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Paralelo:</label>
                <select
                  value={filtroParalelo}
                  onChange={(e) => setFiltroParalelo(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  {paralelosPermitidosFiltro.map((p) => (
                    <option key={p} value={p}>Paralelo {p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Apellidos y Nombres</th>
                    <th className="p-3">Cédula</th>
                    <th className="p-3">Jornada / Curso</th>
                    <th className="p-3 text-center">Estado</th>
                    {!esAnioCerrado && <th className="p-3 text-center">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {estudiantesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={esAnioCerrado ? 5 : 6} className="p-8 text-center text-slate-500 font-medium">
                        No hay estudiantes registrados en esta jornada y curso para el periodo {anioLectivoVigente}.
                      </td>
                    </tr>
                  ) : (
                    estudiantesFiltrados.map((est, idx) => (
                      <tr key={est.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800">
                          {est.apellidos} {est.nombres}
                        </td>
                        <td className="p-3 text-slate-600 font-mono">{est.cedula || 'S/N'}</td>
                        <td className="p-3 text-slate-600 font-medium">
                          <span className="block font-bold text-indigo-700">{est.jornada || 'MATUTINA'}</span>
                          <span>{est.grado_curso} "{est.paralelo}"</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            est.estado === 'activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {est.estado}
                          </span>
                        </td>
                        {!esAnioCerrado && (
                          <td className="p-3 text-center space-x-2">
                            <button
                              onClick={() => handleToggleEstado(est.id, est.estado)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] transition"
                            >
                              {est.estado === 'activo' ? 'Retirar' : 'Reactivar'}
                            </button>
                            <button
                              onClick={() => handleEliminarEstudiante(est.id)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-[10px] transition"
                            >
                              Eliminar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL CARGA MASIVA DE LISTA */}
      {mostrarModalMasivo && !esAnioCerrado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-slate-800">📋 Carga Masiva (Jornada: {jornadaForm})</h2>
              <button onClick={() => setMostrarModalMasivo(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Pega la lista de tus alumnos (un estudiante por línea) en formato <strong>APELLIDOS, NOMBRES</strong>. Se registrarán bajo el periodo vigente ({anioLectivoVigente}).
            </p>

            <textarea
              rows={8}
              value={textoMasivo}
              onChange={(e) => setTextoMasivo(e.target.value)}
              placeholder="SIGUENCIA URGILEZ, AMY DANIELA&#10;PEREZ VACA, CARLOS ALBERTO&#10;ANDRADE PALACIOS, MARIA JOSE"
              className="w-full p-3 border rounded-xl text-xs font-mono text-slate-800 outline-none uppercase bg-slate-50"
            />

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setMostrarModalMasivo(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCargaMasiva}
                disabled={procesando || !textoMasivo.trim()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
              >
                {procesando ? 'Importando...' : 'Importar Lista a la Base de Datos'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}