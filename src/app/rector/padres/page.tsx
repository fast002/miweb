'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RectorPadresPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  
  // Datos base
  const [estudiantesLista, setEstudiantesLista] = useState<any[]>([])
  const [padresAgrupados, setPadresAgrupados] = useState<any[]>([])
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  
  // Filtros superiores
  const [anioLectivoFiltro, setAnioLectivoFiltro] = useState('')
  const [jornadaFiltro, setJornadaFiltro] = useState('MATUTINA')
  const [gradoFiltro, setGradoFiltro] = useState('')
  const [paraleloFiltro, setParaleloFiltro] = useState('')
  const [filtroTexto, setFiltroTexto] = useState('')

  // Formulario Registro de Padre
  const [emailPadre, setEmailPadre] = useState('')
  const [nombresPadre, setNombresPadre] = useState('')
  const [apellidosPadre, setApellidosPadre] = useState('')
  const [cedulaPadre, setCedulaPadre] = useState('')
  const [telefonoPadre, setTelefonoPadre] = useState('')
  const [estudianteIdVinculo, setEstudianteIdVinculo] = useState('')
  const [parentescoPadre, setParentescoPadre] = useState('Padre')
  const [mensaje, setMensaje] = useState('')

  // Modales auxiliares
  const [modalVinculacionAbierto, setModalVinculacionAbierto] = useState(false)
  const [representanteSeleccionadoUserId, setRepresentanteSeleccionadoUserId] = useState('')
  const [representanteNombreDisplay, setRepresentanteNombreDisplay] = useState('')
  const [estudianteExtraId, setEstudianteExtraId] = useState('')
  const [parentescoExtra, setParentescoExtra] = useState('Padre')

  const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
  const [editVinculoId, setEditVinculoId] = useState('')
  const [editNombres, setEditNombres] = useState('')
  const [editApellidos, setEditApellidos] = useState('')
  const [editCedula, setEditCedula] = useState('')
  const [editTelefono, setEditTelefono] = useState('')

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  // CARGA PRINCIPAL DESDE CERO
  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Obtener datos del docente y su institución
      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (!doc || !doc.institucion_id) {
        setCargando(false)
        return
      }

      setInstitucionId(doc.institucion_id)
      setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Institución')

      // Extraer periodos_disponibles de la tabla instituciones
      const institucion = doc.instituciones
      if (institucion && institucion.periodos_disponibles) {
        setPeriodosDisponibles(institucion.periodos_disponibles)
        setAnioLectivoFiltro(institucion.anio_lectivo_activo || institucion.periodos_disponibles[0])
      }

      // Cargar estudiantes de la institución
      const { data: estData } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', doc.institucion_id)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      if (estData && estData.length > 0) {
        setEstudiantesLista(estData)
        setGradoFiltro(estData[0].grado_curso || '')
        setParaleloFiltro(estData[0].paralelo || 'A')
        setEstudianteIdVinculo(estData[0].id) // Asignación inicial segura
        setEstudianteExtraId(estData[0].id)
      }

      await cargarRepresentantes(doc.institucion_id)

    } catch (err) {
      console.error('Error al inicializar:', err)
    } finally {
      setCargando(false)
    }
  }

  // CARGA SEGURA CON FILTRO ESTRICTO DE INSTITUCIÓN
  const cargarRepresentantes = async (instId: string) => {
    const { data: padresData, error: padresError } = await supabase
      .from('estudiante_representantes')
      .select('*, estudiantes!inner(id, nombres, apellidos, grado_curso, paralelo, institucion_id, anio_lectivo)')
      .eq('estudiantes.institucion_id', instId)

    if (padresError) {
      console.error('Error al cargar representantes:', padresError)
      return
    }

    if (padresData) {
      const mapa: { [key: string]: any } = {}

      padresData.forEach((item: any) => {
        if (item.estudiantes) {
          const uid = item.user_id || item.id
          if (!mapa[uid]) {
            mapa[uid] = {
              id: item.id,
              user_id: uid,
              nombres: item.nombres || '',
              apellidos: item.apellidos || '',
              cedula: item.cedula || 'S/N',
              telefono: item.telefono || 'S/N',
              email: item.email || '',
              activo: item.activo ?? true,
              hijos: []
            }
          }
          mapa[uid].hijos.push({
            vinculo_id: item.id,
            estudiante_id: item.estudiantes.id,
            nombreCompleto: `${item.estudiantes.apellidos} ${item.estudiantes.nombres}`,
            cursoParalelo: `${item.estudiantes.grado_curso} "${item.estudiantes.paralelo}"`,
            parentesco: item.parentesco || 'Representante'
          })
        }
      })
      setPadresAgrupados(Object.values(mapa))
    }
  }

  // Listas dinámicas para filtros
  const gradosDisponibles = Array.from(new Set(
    estudiantesLista
      .filter(e => (e.jornada || 'MATUTINA').toUpperCase() === jornadaFiltro.toUpperCase())
      .map(e => e.grado_curso)
  ))

  const paralelosDisponibles = Array.from(new Set(
    estudiantesLista
      .filter(e => (e.jornada || 'MATUTINA').toUpperCase() === jornadaFiltro.toUpperCase() && e.grado_curso === gradoFiltro)
      .map(e => e.paralelo || 'A')
  ))

  const estudiantesFiltrados = estudiantesLista.filter(e => {
    const coincidePeriodo = anioLectivoFiltro ? e.anio_lectivo === anioLectivoFiltro : true
    const coincideJornada = (e.jornada || 'MATUTINA').toUpperCase() === jornadaFiltro.toUpperCase()
    const coincideGrado = gradoFiltro ? e.grado_curso === gradoFiltro : true
    const coincideParalelo = paraleloFiltro ? (e.paralelo || 'A') === paraleloFiltro : true
    return coincidePeriodo && coincideJornada && coincideGrado && coincideParalelo
  })

  // Cada vez que cambien los estudiantes filtrados, aseguramos que el select tenga un ID válido seleccionado
  useEffect(() => {
    if (estudiantesFiltrados.length > 0) {
      // Si el estudiante seleccionado actual ya no está en la lista filtrada, tomamos el primero
      const existe = estudiantesFiltrados.some(e => e.id === estudianteIdVinculo)
      if (!existe) {
        setEstudianteIdVinculo(estudiantesFiltrados[0].id)
      }
    } else {
      setEstudianteIdVinculo('')
    }
  }, [estudiantesFiltrados, estudianteIdVinculo])

  const padresFiltrados = padresAgrupados.filter(p => {
    const texto = filtroTexto.toLowerCase()
    const nombreCompleto = `${p.nombres} ${p.apellidos}`.toLowerCase()
    const cedula = (p.cedula || '').toLowerCase()
    const coincideHijo = p.hijos.some((h: any) => h.nombreCompleto.toLowerCase().includes(texto) || h.cursoParalelo.toLowerCase().includes(texto))
    return nombreCompleto.includes(texto) || cedula.includes(texto) || coincideHijo
  })

  // ACCIÓN: Registrar Padre y vincular estudiante
  const handleCrearPadre = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')

    // Validación estricta para evitar el error
    if (!estudianteIdVinculo || estudianteIdVinculo.trim() === '') {
      setMensaje('Error: Debe seleccionar un estudiante válido de la lista para vincular.')
      return
    }

    setCargando(true)

    try {
      // Crear cuenta en auth.users con clave temporal 123456
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailPadre.trim(),
        password: '123456',
      })

      if (authError && !authError.message.toLowerCase().includes('already registered')) throw authError

      let userIdFinal = authData?.user?.id
      if (!userIdFinal) throw new Error('El correo ingresado ya se encuentra registrado en el sistema o hubo un error de autenticación.')

      // Insertar en estudiante_representantes
      const { error: vinculoError } = await supabase
        .from('estudiante_representantes')
        .insert([{
          user_id: userIdFinal,
          estudiante_id: estudianteIdVinculo,
          parentesco: parentescoPadre,
          nombres: nombresPadre.trim().toUpperCase(),
          apellidos: apellidosPadre.trim().toUpperCase(),
          cedula: cedulaPadre.trim(),
          telefono: telefonoPadre.trim(),
          email: emailPadre.trim(),
          activo: true
        }])

      if (vinculoError) throw vinculoError

      setMensaje('¡Representante registrado y vinculado con éxito! Clave temporal: 123456 (Exigirá cambio al primer inicio).')
      setEmailPadre('')
      setNombresPadre('')
      setApellidosPadre('')
      setCedulaPadre('')
      setTelefonoPadre('')
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      setMensaje('Error: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  // ACCIÓN: Agregar estudiante adicional a representante existente
  const handleAgregarHijoExtra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!estudianteExtraId) {
      alert('Debe seleccionar un estudiante.')
      return
    }
    setCargando(true)
    try {
      const padreActual = padresAgrupados.find(p => p.user_id === representanteSeleccionadoUserId)
      if (!padreActual) throw new Error('Representante no encontrado.')

      const { error } = await supabase.from('estudiante_representantes').insert([{
        user_id: representanteSeleccionadoUserId,
        estudiante_id: estudianteExtraId,
        parentesco: parentescoExtra,
        nombres: padreActual.nombres,
        apellidos: padreActual.apellidos,
        cedula: padreActual.cedula,
        telefono: padreActual.telefono,
        email: padreActual.email,
        activo: true
      }])

      if (error) throw error

      setMensaje('¡Estudiante adicional vinculado con éxito!')
      setModalVinculacionAbierto(false)
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      setMensaje('Error al vincular estudiante: ' + err.message)
      setCargando(false)
    }
  }

  // ACCIÓN: Guardar edición de datos del representante
  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    try {
      const { error } = await supabase
        .from('estudiante_representantes')
        .update({
          nombres: editNombres.trim().toUpperCase(),
          apellidos: editApellidos.trim().toUpperCase(),
          cedula: editCedula.trim(),
          telefono: editTelefono.trim()
        })
        .eq('id', editVinculoId)

      if (error) throw error

      setMensaje('¡Datos actualizados con éxito!')
      setModalEditarAbierto(false)
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      setMensaje('Error al editar: ' + err.message)
      setCargando(false)
    }
  }

  // ACCIÓN: Activar o Inactivar / Bloquear cuenta
  const handleToggleActivo = async (userId: string, estadoActual: boolean) => {
    try {
      setCargando(true)
      await supabase.from('estudiante_representantes')
        .update({ activo: !estadoActual })
        .eq('user_id', userId)
      
      setMensaje(`Representante ${!estadoActual ? 'activado' : 'inactivado / bloqueado'} correctamente.`)
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      setMensaje('Error al cambiar estado.')
      setCargando(false)
    }
  }

  // ACCIÓN: Eliminar vínculo específico de un estudiante
  const handleEliminarVinculo = async (vinculoId: string) => {
    if (!confirm('¿Está seguro de eliminar este vínculo o estudiante del representante?')) return
    try {
      setCargando(true)
      await supabase.from('estudiante_representantes').delete().eq('id', vinculoId)
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
      setCargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando Panel Directivo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Encabezado Principal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-black uppercase">
              Panel Directivo • {nombreInstitucion}
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Gestión de Cuentas y Representantes de Familia
            </h1>
          </div>
          
          {/* Cabecera con Periodos Disponibles */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <label className="block text-[10px] font-black text-slate-500 uppercase">Año Lectivo / Período Activo</label>
              <select
                value={anioLectivoFiltro}
                onChange={(e) => setAnioLectivoFiltro(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
              >
                {periodosDisponibles.map((periodo) => (
                  <option key={periodo} value={periodo}>{periodo}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {mensaje && (
          <div className="p-4 bg-blue-50 text-blue-900 rounded-xl text-sm font-medium border border-blue-200 shadow-xs flex justify-between items-center">
            <span>{mensaje}</span>
            <button onClick={() => setMensaje('')} className="text-blue-900 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Formulario de Registro con Filtros en Cascada */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Crear y Vincular Representante</h2>
          
          <form onSubmit={handleCrearPadre} className="space-y-4">
            
            {/* Filtros de Estudiantes: Jornada, Grado, Paralelo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Jornada</label>
                <select
                  value={jornadaFiltro}
                  onChange={(e) => {
                    setJornadaFiltro(e.target.value)
                    const gradosJ = Array.from(new Set(estudiantesLista.filter(est => (est.jornada || 'MATUTINA').toUpperCase() === e.target.value.toUpperCase()).map(est => est.grado_curso)))
                    if (gradosJ.length > 0) setGradoFiltro(gradosJ[0] as string)
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none"
                >
                  <option value="MATUTINA">Matutina</option>
                  <option value="VESPERTINA">Vespertina</option>
                  <option value="NOCTURNA">Nocturna</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Año / Grado de Básica</label>
                <select
                  value={gradoFiltro}
                  onChange={(e) => {
                    setGradoFiltro(e.target.value)
                    const paralelosG = Array.from(new Set(estudiantesLista.filter(est => est.grado_curso === e.target.value).map(est => est.paralelo || 'A')))
                    if (paralelosG.length > 0) setParaleloFiltro(paralelosG[0] as string)
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none"
                >
                  {gradosDisponibles.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Paralelo</label>
                <select
                  value={paraleloFiltro}
                  onChange={(e) => setParaleloFiltro(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none"
                >
                  {paralelosDisponibles.map(par => (
                    <option key={par} value={par}>Paralelo "{par}"</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selector del Estudiante Filtrado */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Seleccionar Estudiante Disponible ({anioLectivoFiltro})</label>
              <select 
                value={estudianteIdVinculo} 
                onChange={(e) => setEstudianteIdVinculo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                required
              >
                {estudiantesFiltrados.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.apellidos} {est.nombres} — Paralelo "{est.paralelo}"
                  </option>
                ))}
                {estudiantesFiltrados.length === 0 && (
                  <option value="">No hay estudiantes disponibles en este curso/paralelo</option>
                )}
              </select>
            </div>

            {/* Datos del Representante */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nombres del Representante</label>
                <input 
                  type="text" 
                  required 
                  value={nombresPadre} 
                  onChange={(e) => setNombresPadre(e.target.value)}
                  placeholder="Ej: Marco Antonio"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Apellidos</label>
                <input 
                  type="text" 
                  required 
                  value={apellidosPadre} 
                  onChange={(e) => setApellidosPadre(e.target.value)}
                  placeholder="Ej: Urgilez Pinos"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cédula de Identidad</label>
                <input 
                  type="text" 
                  required 
                  maxLength={10}
                  value={cedulaPadre} 
                  onChange={(e) => setCedulaPadre(e.target.value)}
                  placeholder="0301060601"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Número Telefónico / Celular</label>
                <input 
                  type="text" 
                  required 
                  value={telefonoPadre} 
                  onChange={(e) => setTelefonoPadre(e.target.value)}
                  placeholder="0991234567"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Correo Electrónico (Acceso)</label>
                <input 
                  type="email" 
                  required 
                  value={emailPadre} 
                  onChange={(e) => setEmailPadre(e.target.value)}
                  placeholder="representante@correo.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Clave por defecto: 123456 (Obligatorio cambio en primer inicio).</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Parentesco</label>
                <select 
                  value={parentescoPadre} 
                  onChange={(e) => setParentescoPadre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
                >
                  <option value="Padre">Padre</option>
                  <option value="Madre">Madre</option>
                  <option value="Tutor/Representante">Tutor / Representante</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={cargando || estudiantesFiltrados.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
            >
              {cargando ? 'Registrando...' : 'Crear Cuenta y Vincular'}
            </button>
          </form>
        </div>

        {/* TABLA INFERIOR: Representantes Registrados en el Plantel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Representantes Registrados en el Plantel</h3>
            <div className="w-full sm:w-72">
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="🔍 Buscar por nombre, cédula o hijo..."
                className="w-full px-3 py-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 border">Representante (Datos)</th>
                  <th className="p-3 border">Cédula / Teléfono</th>
                  <th className="p-3 border">Estudiantes Vinculados (Hijos)</th>
                  <th className="p-3 border text-center">Estado / Bloqueo</th>
                  <th className="p-3 border text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {padresFiltrados.map((p) => {
                  const nombreCompletoRep = `${p.apellidos || ''} ${p.nombres || ''}`.trim() || 'Representante'
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 border">
                        <span className="block font-bold text-slate-900">{nombreCompletoRep}</span>
                        <span className="block text-[10px] text-slate-500">{p.email}</span>
                      </td>
                      <td className="p-3 border">
                        <span className="block font-semibold text-slate-800">Cédula: {p.cedula}</span>
                        <span className="block text-slate-600">Telf: {p.telefono}</span>
                      </td>
                      <td className="p-3 border">
                        <ul className="space-y-1">
                          {p.hijos.map((h: any) => (
                            <li key={h.vinculo_id} className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                              <div>
                                <span className="font-bold text-slate-800">{h.nombreCompleto} <span className="text-[10px] text-slate-500">({h.cursoParalelo})</span></span>
                                <span className="block text-[9px] text-indigo-600 font-black uppercase">Parentesco: {h.parentesco}</span>
                              </div>
                              <button
                                onClick={() => handleEliminarVinculo(h.vinculo_id)}
                                className="text-red-500 hover:text-red-700 font-bold text-[10px] ml-2"
                                title="Eliminar este estudiante vinculado"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-3 border text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${p.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {p.activo !== false ? 'ACTIVO' : 'INACTIVO / BLOQUEADO'}
                        </span>
                      </td>
                      <td className="p-3 border text-center space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditVinculoId(p.id)
                            setEditNombres(p.nombres || '')
                            setEditApellidos(p.apellidos || '')
                            setEditCedula(p.cedula || '')
                            setEditTelefono(p.telefono || '')
                            setModalEditarAbierto(true)
                          }}
                          className="px-2 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 font-bold rounded text-[10px]"
                          title="Editar datos"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setRepresentanteSeleccionadoUserId(p.user_id)
                            setRepresentanteNombreDisplay(nombreCompletoRep)
                            setModalVinculacionAbierto(true)
                          }}
                          className="px-2 py-1 bg-purple-100 text-purple-800 hover:bg-purple-200 font-bold rounded text-[10px]"
                          title="Vincular otro hijo"
                        >
                          + Hijo
                        </button>
                        <button
                          onClick={() => handleToggleActivo(p.user_id, p.activo !== false)}
                          className={`px-2 py-1 font-bold rounded text-[10px] ${p.activo !== false ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}`}
                          title="Activar o bloquear"
                        >
                          {p.activo !== false ? 'Inactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {padresFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      No hay representantes registrados en este plantel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL: Agregar Estudiante Adicional (+ Hijo) */}
      {modalVinculacionAbierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-slate-800">➕ Agregar Estudiante a Representante</h2>
              <button onClick={() => setModalVinculacionAbierto(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleAgregarHijoExtra} className="space-y-3 text-xs">
              <p className="text-slate-600 font-semibold">
                Representante: <strong className="text-slate-900">{representanteNombreDisplay}</strong>
              </p>
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Seleccionar Estudiante:</label>
                <select
                  value={estudianteExtraId}
                  onChange={(e) => setEstudianteExtraId(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  {estudiantesLista.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.apellidos} {est.nombres} — {est.grado_curso} "{est.paralelo}"
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Parentesco:</label>
                <select
                  value={parentescoExtra}
                  onChange={(e) => setParentescoExtra(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                >
                  <option value="Padre">Padre</option>
                  <option value="Madre">Madre</option>
                  <option value="Tutor/Representante">Tutor / Representante</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setModalVinculacionAbierto(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow"
                >
                  Vincular Estudiante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Datos del Representante */}
      {modalEditarAbierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-slate-800">✏️ Editar Datos del Representante</h2>
              <button onClick={() => setModalEditarAbierto(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleGuardarEdicion} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Nombres:</label>
                <input
                  type="text"
                  required
                  value={editNombres}
                  onChange={(e) => setEditNombres(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Apellidos:</label>
                <input
                  type="text"
                  required
                  value={editApellidos}
                  onChange={(e) => setEditApellidos(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Cédula:</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={editCedula}
                  onChange={(e) => setEditCedula(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Teléfono:</label>
                <input
                  type="text"
                  required
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setModalEditarAbierto(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}