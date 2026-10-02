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
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

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
        setEstudianteIdVinculo(estData[0].id)
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

  useEffect(() => {
    if (estudiantesFiltrados.length > 0) {
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
    setMensaje(null)

    if (!estudianteIdVinculo || estudianteIdVinculo.trim() === '') {
      setMensaje({ tipo: 'error', texto: 'Debe seleccionar un estudiante válido de la lista para vincular.' })
      return
    }

    setCargando(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailPadre.trim(),
        password: '123456',
      })

      if (authError && !authError.message.toLowerCase().includes('already registered')) throw authError

      let userIdFinal = authData?.user?.id
      if (!userIdFinal) throw new Error('El correo ingresado ya se encuentra registrado en el sistema o hubo un error de autenticación.')

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

      setMensaje({ tipo: 'exito', texto: 'Representante registrado y vinculado con éxito. Contraseña temporal: 123456 (Exigirá cambio al primer inicio).' })
      setEmailPadre('')
      setNombresPadre('')
      setApellidosPadre('')
      setCedulaPadre('')
      setTelefonoPadre('')
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error: ' + err.message })
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

      setMensaje({ tipo: 'exito', texto: 'Estudiante adicional vinculado con éxito.' })
      setModalVinculacionAbierto(false)
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al vincular estudiante: ' + err.message })
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

      setMensaje({ tipo: 'exito', texto: 'Datos actualizados con éxito.' })
      setModalEditarAbierto(false)
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al editar: ' + err.message })
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
      
      setMensaje({ tipo: 'exito', texto: `Representante ${!estadoActual ? 'activado' : 'inactivado / bloqueado'} correctamente.` })
      await cargarRepresentantes(institucionId)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al cambiar estado.' })
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
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Panel Directivo...</p>
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
            Panel Directivo • {nombreInstitucion}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Gestión de Cuentas y Representantes de Familia
          </h1>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Período:</span>
            <select
              value={anioLectivoFiltro}
              onChange={(e) => setAnioLectivoFiltro(e.target.value)}
              style={{ color: '#4b4c99' }}
              className="bg-transparent text-xs font-bold outline-none cursor-pointer"
            >
              {periodosDisponibles.map((periodo) => (
                <option key={periodo} value={periodo} className="text-slate-900 font-bold bg-white">{periodo}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs flex justify-between items-center ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <span>{mensaje.texto}</span>
          <button onClick={() => setMensaje(null)} className="font-bold ml-4 cursor-pointer">✕</button>
        </div>
      )}

      {/* FORMULARIO DE REGISTRO CON FILTROS EN CASCADA */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Crear y Vincular Representante</h2>
        
        <form onSubmit={handleCrearPadre} className="space-y-4 text-xs">
          
          {/* Filtros de Estudiantes: Jornada, Grado, Paralelo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
              <select
                value={jornadaFiltro}
                onChange={(e) => {
                  setJornadaFiltro(e.target.value)
                  const gradosJ = Array.from(new Set(estudiantesLista.filter(est => (est.jornada || 'MATUTINA').toUpperCase() === e.target.value.toUpperCase()).map(est => est.grado_curso)))
                  if (gradosJ.length > 0) setGradoFiltro(gradosJ[0] as string)
                }}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
              >
                <option value="MATUTINA" className="text-slate-900 font-bold bg-white">Matutina</option>
                <option value="VESPERTINA" className="text-slate-900 font-bold bg-white">Vespertina</option>
                <option value="NOCTURNA" className="text-slate-900 font-bold bg-white">Nocturna</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Año / Grado de Básica</label>
              <select
                value={gradoFiltro}
                onChange={(e) => {
                  setGradoFiltro(e.target.value)
                  const paralelosG = Array.from(new Set(estudiantesLista.filter(est => est.grado_curso === e.target.value).map(est => est.paralelo || 'A')))
                  if (paralelosG.length > 0) setParaleloFiltro(paralelosG[0] as string)
                }}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
              >
                {gradosDisponibles.map(g => (
                  <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
              <select
                value={paraleloFiltro}
                onChange={(e) => setParaleloFiltro(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
              >
                {paralelosDisponibles.map(par => (
                  <option key={par} value={par} className="text-slate-900 font-bold bg-white">Paralelo "{par}"</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selector del Estudiante Filtrado */}
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Seleccionar Estudiante Disponible ({anioLectivoFiltro})</label>
            <select 
              value={estudianteIdVinculo} 
              onChange={(e) => setEstudianteIdVinculo(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              required
            >
              {estudiantesFiltrados.map((est) => (
                <option key={est.id} value={est.id} className="text-slate-900 font-bold bg-white">
                  {est.apellidos} {est.nombres} — Paralelo "{est.paralelo}"
                </option>
              ))}
              {estudiantesFiltrados.length === 0 && (
                <option value="" className="text-slate-900 font-bold bg-white">No hay estudiantes disponibles en este curso/paralelo</option>
              )}
            </select>
          </div>

          {/* Datos del Representante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombres del Representante</label>
              <input 
                type="text" 
                required 
                value={nombresPadre} 
                onChange={(e) => setNombresPadre(e.target.value)}
                placeholder="Ej: Marco Antonio"
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Apellidos</label>
              <input 
                type="text" 
                required 
                value={apellidosPadre} 
                onChange={(e) => setApellidosPadre(e.target.value)}
                placeholder="Ej: Urgilez Pinos"
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Cédula de Identidad</label>
              <input 
                type="text" 
                required 
                maxLength={10}
                value={cedulaPadre} 
                onChange={(e) => setCedulaPadre(e.target.value)}
                placeholder="0301060601"
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Número Telefónico / Celular</label>
              <input 
                type="text" 
                required 
                value={telefonoPadre} 
                onChange={(e) => setTelefonoPadre(e.target.value)}
                placeholder="0991234567"
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Correo Electrónico (Acceso)</label>
              <input 
                type="email" 
                required 
                value={emailPadre} 
                onChange={(e) => setEmailPadre(e.target.value)}
                placeholder="representante@correo.com"
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Clave por defecto: 123456 (Obligatorio cambio en primer inicio).</span>
            </div>
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Parentesco</label>
              <select 
                value={parentescoPadre} 
                onChange={(e) => setParentescoPadre(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
              >
                <option value="Padre" className="text-slate-900 font-bold bg-white">Padre</option>
                <option value="Madre" className="text-slate-900 font-bold bg-white">Madre</option>
                <option value="Tutor/Representante" className="text-slate-900 font-bold bg-white">Tutor / Representante</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={cargando || estudiantesFiltrados.length === 0}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-6 py-3 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            {cargando ? 'Registrando...' : 'Crear Cuenta y Vincular'}
          </button>
        </form>
      </div>

      {/* TABLA INFERIOR: Representantes Registrados en el Plantel */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Representantes Registrados en el Plantel</span>
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por nombre, cédula o hijo..."
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none shadow-2xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">Representante (Datos)</th>
                <th className="p-3">Cédula / Teléfono</th>
                <th className="p-3">Estudiantes Vinculados (Hijos)</th>
                <th className="p-3 text-center">Estado / Bloqueo</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {padresFiltrados.map((p) => {
                const nombreCompletoRep = `${p.apellidos || ''} ${p.nombres || ''}`.trim() || 'Representante'
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-800">
                      <span className="block">{nombreCompletoRep}</span>
                      <span className="block text-[10px] text-slate-500 font-normal">{p.email}</span>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">
                      <span className="block">Cédula: {p.cedula}</span>
                      <span>Telf: {p.telefono}</span>
                    </td>
                    <td className="p-3">
                      <ul className="space-y-1">
                        {p.hijos.map((h: any) => (
                          <li key={h.vinculo_id} className="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                            <div>
                              <span className="font-bold text-slate-800">{h.nombreCompleto} <span className="text-[10px] text-slate-500">({h.cursoParalelo})</span></span>
                              <span className="block text-[9px] text-[#4b4c99] font-bold uppercase">Parentesco: {h.parentesco}</span>
                            </div>
                            <button
                              onClick={() => handleEliminarVinculo(h.vinculo_id)}
                              className="text-rose-600 hover:text-rose-800 font-bold text-xs ml-2 cursor-pointer"
                              title="Eliminar este estudiante vinculado"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shadow-2xs inline-block ${p.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {p.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditVinculoId(p.id)
                          setEditNombres(p.nombres || '')
                          setEditApellidos(p.apellidos || '')
                          setEditCedula(p.cedula || '')
                          setEditTelefono(p.telefono || '')
                          setModalEditarAbierto(true)
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[10px] transition cursor-pointer shadow-2xs"
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
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-[10px] transition cursor-pointer shadow-2xs"
                        title="Vincular otro hijo"
                      >
                        + Hijo
                      </button>
                      <button
                        onClick={() => handleToggleActivo(p.user_id, p.activo !== false)}
                        className={`px-2.5 py-1 font-bold rounded-xl text-[10px] transition cursor-pointer shadow-2xs ${p.activo !== false ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
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
                  <td colSpan={5} className="p-12 text-center text-slate-500 font-medium">
                    No hay representantes registrados en este plantel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Agregar Estudiante Adicional (+ Hijo) */}
      {modalVinculacionAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Agregar Estudiante a Representante</h2>
              <button onClick={() => setModalVinculacionAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleAgregarHijoExtra} className="space-y-3.5 text-xs">
              <p className="text-slate-600 font-medium">
                Representante: <strong className="text-slate-900">{representanteNombreDisplay}</strong>
              </p>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Seleccionar Estudiante:</label>
                <select
                  value={estudianteExtraId}
                  onChange={(e) => setEstudianteExtraId(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
                >
                  {estudiantesLista.map((est) => (
                    <option key={est.id} value={est.id} className="text-slate-900 font-bold bg-white">
                      {est.apellidos} {est.nombres} — {est.grado_curso} "{est.paralelo}"
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Parentesco:</label>
                <select
                  value={parentescoExtra}
                  onChange={(e) => setParentescoExtra(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
                >
                  <option value="Padre" className="text-slate-900 font-bold bg-white">Padre</option>
                  <option value="Madre" className="text-slate-900 font-bold bg-white">Madre</option>
                  <option value="Tutor/Representante" className="text-slate-900 font-bold bg-white">Tutor / Representante</option>
                </select>
              </div>
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setModalVinculacionAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Editar Datos del Representante</h2>
              <button onClick={() => setModalEditarAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleGuardarEdicion} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombres:</label>
                <input
                  type="text"
                  required
                  value={editNombres}
                  onChange={(e) => setEditNombres(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none shadow-2xs uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Apellidos:</label>
                <input
                  type="text"
                  required
                  value={editApellidos}
                  onChange={(e) => setEditApellidos(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none shadow-2xs uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Cédula:</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={editCedula}
                  onChange={(e) => setEditCedula(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Teléfono:</label>
                <input
                  type="text"
                  required
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none shadow-2xs"
                />
              </div>
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setModalEditarAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
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