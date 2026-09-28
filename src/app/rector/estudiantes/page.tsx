'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function GestionEstudiantesRectorPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Datos del Rector y la Institución
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  
  // Control Dinámico de Años Lectivos Propios de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Listas Globales de la Institución para el Rector
  const [gradosInstitucion, setGradosInstitucion] = useState<any[]>([])
  
  // Lista de Estudiantes y Filtros Globales
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [filtroJornada, setFiltroJornada] = useState('MATUTINA')
  const [filtroGrado, setFiltroGrado] = useState('')
  const [filtroParalelo, setFiltroParalelo] = useState('')

  // Formulario Individual de Registro
  const [cedula, setCedula] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [nombres, setNombres] = useState('')
  const [subnivel, setSubnivel] = useState('Básica Media')
  const [jornadaForm, setJornadaForm] = useState('MATUTINA')
  const [gradoForm, setGradoForm] = useState('')
  const [paraleloForm, setParaleloForm] = useState('A')

  // Carga Masiva (Pegar Lista)
  const [mostrarModalMasivo, setMostrarModalMasivo] = useState(false)
  const [textoMasivo, setTextoMasivo] = useState('')

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
        const instId = doc.institucion_id
        setInstitucionId(instId)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')

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
          await sincronizarDatosInstitucionales(instId, anioInicial)
        }
      }
    } catch (err: any) {
      console.error('Error al cargar datos iniciales del rector:', err)
    } finally {
      setCargando(false)
    }
  }

  // Cargar todas las asignaciones o cursos existentes en la institución para el periodo activo
  const sincronizarDatosInstitucionales = async (instId: string, anio: string) => {
    // Como es el rector, consultamos todas las asignaciones de la institución para mapear grados y paralelos globales
    const { data: allAsigs } = await supabase
      .from('docente_asignaciones')
      .select('*')
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)

    const asignaciones = allAsigs || []
    setGradosInstitucion(asignaciones)

    if (asignaciones.length > 0) {
      const primeraJornada = asignaciones[0].jornada || 'MATUTINA'
      setFiltroJornada(primeraJornada)
      setJornadaForm(primeraJornada)

      const gradosJor = Array.from(new Set(asignaciones.filter(a => (a.jornada || 'MATUTINA') === primeraJornada).map(a => a.grado_curso)))
      if (gradosJor.length > 0) {
        setFiltroGrado(gradosJor[0])
        setGradoForm(gradosJor[0])
        detectarSubnivel(gradosJor[0])

        const paralelosJor = asignaciones.filter(a => (a.jornada || 'MATUTINA') === primeraJornada && a.grado_curso === gradosJor[0])
        if (paralelosJor.length > 0) {
          setFiltroParalelo(paralelosJor[0].paralelo)
          setParaleloForm(paralelosJor[0].paralelo)
        }
      }
    } else {
      // Si la institución aún no tiene asignaciones creadas, dejamos valores por defecto
      setFiltroGrado('4to Grado EGB')
      setGradoForm('4to Grado EGB')
      setFiltroParalelo('A')
      setParaleloForm('A')
    }

    await cargarEstudiantesGlobales(instId, anio)
  }

  const handleCambiarPeriodo = async (nuevoAnio: string) => {
    setAnioLectivoVigente(nuevoAnio)
    if (institucionId) {
      await sincronizarDatosInstitucionales(institucionId, nuevoAnio)
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
    const gradosJor = Array.from(new Set(gradosInstitucion.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada).map(a => a.grado_curso)))
    if (gradosJor.length > 0) {
      setGradoForm(gradosJor[0])
      detectarSubnivel(gradosJor[0])
      const pars = gradosInstitucion.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada && a.grado_curso === gradosJor[0])
      if (pars.length > 0) setParaleloForm(pars[0].paralelo)
    }
  }

  const handleGradoFormChange = (nuevoGrado: string) => {
    setGradoForm(nuevoGrado)
    detectarSubnivel(nuevoGrado)
    const pars = gradosInstitucion.filter(a => (a.jornada || 'MATUTINA') === jornadaForm && a.grado_curso === nuevoGrado)
    if (pars.length > 0) setParaleloForm(pars[0].paralelo)
  }

  const handleFiltroJornadaChange = (nuevaJornada: string) => {
    setFiltroJornada(nuevaJornada)
    const gradosJor = Array.from(new Set(gradosInstitucion.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada).map(a => a.grado_curso)))
    if (gradosJor.length > 0) {
      setFiltroGrado(gradosJor[0])
      const pars = gradosInstitucion.filter(a => (a.jornada || 'MATUTINA') === nuevaJornada && a.grado_curso === gradosJor[0])
      if (pars.length > 0) setFiltroParalelo(pars[0].paralelo)
    } else {
      setFiltroGrado('')
      setFiltroParalelo('')
    }
  }

  const cargarEstudiantesGlobales = async (instId: string, anio: string) => {
    const { data } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .order('apellidos', { ascending: true })

    if (data) {
      setEstudiantes(data)
    }
  }

  const esAnioCerrado = anioLectivoVigente ? anosCerrados.includes(anioLectivoVigente) : false

  // Registrar Estudiante Individual por el Rector
  const handleCrearEstudiante = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!anioLectivoVigente || esAnioCerrado) return alert('🔒 Periodo cerrado o no válido.')

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
        grado_curso: gradoForm,
        paralelo: paraleloForm,
        estado: 'activo',
        anio_lectivo: anioLectivoVigente
      }])

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: '¡Estudiante registrado correctamente por la Dirección!' })
      setCedula('')
      setApellidos('')
      setNombres('')
      await cargarEstudiantesGlobales(institucionId, anioLectivoVigente)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al registrar: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  // Carga Masiva Institucional
  const handleCargaMasiva = async () => {
    if (esAnioCerrado || !textoMasivo.trim()) return

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
          grado_curso: gradoForm,
          paralelo: paraleloForm,
          estado: 'activo',
          anio_lectivo: anioLectivoVigente
        }
      })

      const { error } = await supabase.from('estudiantes').insert(nuevosEstudiantes)
      if (error) throw error

      setMensaje({ tipo: 'exito', texto: `¡Se importaron ${nuevosEstudiantes.length} estudiantes correctamente al curso ${gradoForm} "${paraleloForm}"!` })
      setTextoMasivo('')
      setMostrarModalMasivo(false)
      await cargarEstudiantesGlobales(institucionId, anioLectivoVigente)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error en carga masiva: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  const handleToggleEstado = async (id: string, estadoActual: string) => {
    if (esAnioCerrado) return
    const nuevoEstado = estadoActual === 'activo' ? 'retirado' : 'activo'
    const { error } = await supabase.from('estudiantes').update({ estado: nuevoEstado }).eq('id', id)
    if (!error) {
      setEstudiantes(prev => prev.map(e => e.id === id ? { ...e, estado: nuevoEstado } : e))
    }
  }

  const handleEliminarEstudiante = async (id: string) => {
    if (esAnioCerrado) return
    if (!confirm('¿Estás seguro de eliminar permanentemente a este estudiante del registro directivo?')) return

    const { error } = await supabase.from('estudiantes').delete().eq('id', id)
    if (!error) {
      setEstudiantes(prev => prev.filter(e => e.id !== id))
    }
  }

  // Opciones globales extraídas de la institución
  const jornadasUnicas = ['MATUTINA', 'VESPERTINA', 'NOCTURNA']
  const gradosDisponiblesCatalogo = [
    '2do Grado EGB', '3ro Grado EGB', '4to Grado EGB', 
    '5to Grado EGB', '6to Grado EGB', '7mo Grado EGB', 
    '8vo EGB', '9no EGB', '10mo EGB', 
    '1ro Bachillerato', '2do Bachillerato', '3ro Bachillerato'
  ]

  const estudiantesFiltrados = estudiantes.filter((e) => {
    const estJornada = (e.jornada || 'MATUTINA').toUpperCase()
    const cumpleJornada = estJornada === filtroJornada.toUpperCase()
    const cumpleGrado = !filtroGrado || e.grado_curso === filtroGrado
    const cumpleParalelo = !filtroParalelo || e.paralelo === filtroParalelo
    return cumpleJornada && cumpleGrado && cumpleParalelo
  })

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Nómina Directiva...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO SUPERIOR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-wide uppercase">
                Gestión Directiva de Estudiantes 🏫
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {nombreInstitucion} • <strong className="text-indigo-600">Supervisión y Matrícula Global</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">📅 Periodo:</span>
              <select
                value={anioLectivoVigente}
                onChange={(e) => handleCambiarPeriodo(e.target.value)}
                className="bg-transparent text-xs font-black text-indigo-700 outline-none cursor-pointer"
              >
                {periodosDisponibles.map((p) => (
                  <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => router.push('/rector')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition"
            >
              ← Panel Rectoral
            </button>

            {!esAnioCerrado && periodosDisponibles.length > 0 && (
              <button
                onClick={() => setMostrarModalMasivo(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-2xs transition"
              >
                📋 Carga Masiva
              </button>
            )}
          </div>
        </div>

        {esAnioCerrado && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold">
            🔒 El año lectivo vigente ({anioLectivoVigente}) está cerrado y bloqueado. La nómina directiva se encuentra en modo de solo lectura.
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
          
          {/* FORMULARIO DE REGISTRO INDIVIDUAL GLOBAL */}
          {!esAnioCerrado && periodosDisponibles.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 h-fit">
              <h2 className="font-bold text-slate-800 text-sm uppercase">Matricular Alumno ({anioLectivoVigente})</h2>
              
              <form onSubmit={handleCrearEstudiante} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Cédula de Identidad</label>
                  <input
                    type="text"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="Ej: 0301020304"
                    maxLength={10}
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Ej: URGILEZ PINOS"
                    className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nombres</label>
                  <input
                    type="text"
                    required
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    placeholder="Ej: MARCO ANTONIO"
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
                    {jornadasUnicas.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Grado / Curso</label>
                    <select
                      value={gradoForm}
                      onChange={(e) => handleGradoFormChange(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
                    >
                      {gradosDisponiblesCatalogo.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Paralelo</label>
                    <select
                      value={paraleloForm}
                      onChange={(e) => setParaleloForm(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 outline-none"
                    >
                      {['A', 'B', 'C', 'D', 'E', 'U'].map((p) => (
                        <option key={p} value={p}>Paralelo {p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={procesando}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50 mt-2"
                >
                  {procesando ? 'Guardando...' : '+ Registrar Alumno'}
                </button>
              </form>
            </div>
          )}

          {/* FILTROS GLOBALES Y TABLA DE ESTUDIANTES */}
          <div className={`${esAnioCerrado || periodosDisponibles.length === 0 ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4`}>
            
            {/* FILTROS SUPERIORES */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filtrar Jornada:</label>
                <select
                  value={filtroJornada}
                  onChange={(e) => handleFiltroJornadaChange(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  {jornadasUnicas.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filtrar Grado:</label>
                <select
                  value={filtroGrado}
                  onChange={(e) => setFiltroGrado(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  <option value="">Todos los Grados</option>
                  {gradosDisponiblesCatalogo.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filtrar Paralelo:</label>
                <select
                  value={filtroParalelo}
                  onChange={(e) => setFiltroParalelo(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  <option value="">Todos</option>
                  {['A', 'B', 'C', 'D', 'E', 'U'].map((p) => (
                    <option key={p} value={p}>Paralelo {p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* TABLA */}
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
                        No hay estudiantes registrados con los filtros seleccionados para el periodo {anioLectivoVigente}.
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

      {/* MODAL CARGA MASIVA */}
      {mostrarModalMasivo && !esAnioCerrado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-slate-800">📋 Carga Masiva Directiva ({gradoForm} "{paraleloForm}")</h2>
              <button onClick={() => setMostrarModalMasivo(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Pega la lista de alumnos en formato <strong>APELLIDOS, NOMBRES</strong> (uno por línea). Se matricularán en el curso seleccionado bajo el periodo vigente ({anioLectivoVigente}).
            </p>

            <textarea
              rows={8}
              value={textoMasivo}
              onChange={(e) => setTextoMasivo(e.target.value)}
              placeholder="URGILEZ PINOS, MARCO ANTONIO&#10;SIGUENCIA PADILLA, ROCIO&#10;ANDRADE VACA, CARLOS ALBERTO"
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
                {procesando ? 'Importando...' : 'Importar a la Base de Datos'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}