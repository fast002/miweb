'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function InspectorDisciplinaPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [institucionId, setInstitucionId] = useState('')
  const [inspectorId, setInspectorId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('Unidad Educativa')
  const [logoUrl, setLogoUrl] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [anioLectivo, setAnioLectivo] = useState('2026-2027')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])

  const [alertasInstitucionales, setAlertasInstitucionales] = useState<any[]>([])
  const [estudiantesInstitucion, setEstudiantesInstitucion] = useState<any[]>([])
  const [docentesInstitucion, setDocentesInstitucion] = useState<any[]>([])
  
  // Filtros de la tabla principal para el Inspector
  const [filtroJornada, setFiltroJornada] = useState('TODAS')
  const [filtroGrado, setFiltroGrado] = useState('TODOS')
  const [filtroGravedad, setFiltroGravedad] = useState('TODAS')
  const [busquedaTexto, setBusquedaTexto] = useState('')

  // Modal para cambiar el estado de notificación / seguimiento de una alerta existente
  const [modalAbierto, setModalAbierto] = useState(false)
  const [alertaSeleccionada, setAlertaSeleccionada] = useState<any>(null)
  const [nuevoEstadoNotificacion, setNuevoEstadoNotificacion] = useState('Notificado al Representante')

  // Modal para CREAR una nueva alerta desde Inspección
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
  const [modalFiltroJornada, setModalFiltroJornada] = useState('TODAS')
  const [modalFiltroGrado, setModalFiltroGrado] = useState('TODOS')
  const [estudianteId, setEstudianteId] = useState('')
  const [docenteEmisorSeleccionado, setDocenteEmisorSeleccionado] = useState('')
  const [tipoAlerta, setTipoAlerta] = useState('Indisciplina en Aula')
  const [gravedad, setGravedad] = useState('Leve')
  const [descripcion, setDescripcion] = useState('')
  const [fechaIncidente, setFechaIncidente] = useState(new Date().toISOString().split('T')[0])
  const [estadoInicial, setEstadoInicial] = useState('Pendiente de Revisión')

  useEffect(() => {
    cargarDatosInspector()
  }, [])

  const cargarDatosInspector = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      setInspectorId(user.id)
      setDocenteEmisorSeleccionado(user.id)

      const { data: doc, error } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (error || !doc?.institucion_id) return router.push('/')

      // Validar estrictamente que sea Inspector o Autoridad general
      const rol = (doc.rol || '').toLowerCase()
      if (!rol.includes('inspector') && !rol.includes('rector') && !rol.includes('director') && !rol.includes('vicerrector')) {
        router.push('/docente')
        return
      }

      setInstitucionId(doc.institucion_id)
      const inst = doc.instituciones
      setNombreInstitucion(inst?.nombre_institucion || 'Unidad Educativa')
      setCodigoAmie(inst?.codigo_amie || '00H00000')
      setLogoUrl(inst?.logo_url || '')

      const periodos = inst?.periodos_disponibles || ['2026-2027']
      setPeriodosDisponibles(periodos)
      const anioActivo = inst?.anio_lectivo_activo || periodos[0] || '2026-2027'
      setAnioLectivo(anioActivo)

      await Promise.all([
        cargarAlertasInstitucion(doc.institucion_id, anioActivo),
        cargarEstudiantesInstitucion(doc.institucion_id, anioActivo),
        cargarDocentesInstitucion(doc.institucion_id)
      ])
    } catch (err) {
      console.error('Error al inicializar inspector:', err)
      router.push('/')
    } finally {
      setCargando(false)
    }
  }

  const cargarAlertasInstitucion = async (instId: string, anio: string) => {
    const { data, error } = await supabase
      .from('alertas_disciplinarias')
      .select(`
        *,
        estudiantes (
          nombres,
          apellidos,
          grado_curso,
          paralelo,
          jornada,
          cedula
        ),
        docentes:docente_emisor_id (
          nombres,
          apellidos
        )
      `)
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAlertasInstitucionales(data)
    }
  }

  const cargarEstudiantesInstitucion = async (instId: string, anio: string) => {
    const { data } = await supabase
      .from('estudiantes')
      .select('id, nombres, apellidos, grado_curso, paralelo, jornada, anio_lectivo, institucion_id')
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true })

    if (data) {
      setEstudiantesInstitucion(data.filter((e: any) => e.institucion_id === instId))
    }
  }

  const cargarDocentesInstitucion = async (instId: string) => {
    const { data } = await supabase
      .from('docentes')
      .select('id, nombres, apellidos, rol')
      .eq('institucion_id', instId)
      .eq('activo', true)
      .order('apellidos', { ascending: true })

    if (data) setDocentesInstitucion(data)
  }

  const handleCambiarPeriodo = async (nuevoAnio: string) => {
    setAnioLectivo(nuevoAnio)
    if (institucionId) {
      await Promise.all([
        cargarAlertasInstitucion(institucionId, nuevoAnio),
        cargarEstudiantesInstitucion(institucionId, nuevoAnio)
      ])
    }
  }

  const abrirModalCrear = () => {
    setEstudianteId('')
    setDocenteEmisorSeleccionado(inspectorId)
    setTipoAlerta('Indisciplina en Aula')
    setGravedad('Leve')
    setDescripcion('')
    setFechaIncidente(new Date().toISOString().split('T')[0])
    setEstadoInicial('Pendiente de Revisión')
    setModalCrearAbierto(true)
  }

  const handleCrearAlertaInspector = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!estudianteId || !descripcion.trim()) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un estudiante y describe la incidencia.' })
      return
    }

    const gravedadFinal = tipoAlerta === 'Felicitación / Mérito' ? 'N/A' : gravedad

    setProcesando(true)
    setMensaje(null)

    try {
      const { error } = await supabase.from('alertas_disciplinarias').insert([{
        institucion_id: institucionId,
        estudiante_id: estudianteId,
        docente_emisor_id: docenteEmisorSeleccionado || inspectorId,
        tipo_alerta: tipoAlerta,
        gravedad: gravedadFinal,
        descripcion: descripcion.trim(),
        fecha_incidente: fechaIncidente,
        estado_notificacion: estadoInicial,
        anio_lectivo: anioLectivo
      }])

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: 'Incidencia o mérito registrado correctamente por Inspección.' })
      setEstudianteId('')
      setDescripcion('')
      setModalCrearAbierto(false)
      await cargarAlertasInstitucion(institucionId, anioLectivo)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al registrar: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  const abrirModalEditarEstado = (item: any) => {
    setAlertaSeleccionada(item)
    setNuevoEstadoNotificacion(item.estado_notificacion || 'Notificado al Representante')
    setModalAbierto(true)
  }

  const guardarEstadoAlerta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alertaSeleccionada) return

    setProcesando(true)
    setMensaje(null)

    try {
      const { error } = await supabase
        .from('alertas_disciplinarias')
        .update({ estado_notificacion: nuevoEstadoNotificacion })
        .eq('id', alertaSeleccionada.id)

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: 'Estado de la alerta actualizado correctamente.' })
      setModalAbierto(false)
      await cargarAlertasInstitucion(institucionId, anioLectivo)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  const generarCitacionPdf = (item: any) => {
    const ventana = window.open('', '_blank')
    if (!ventana) return

    const est = item.estudiantes || {}
    const docenteEmisor = item.docentes || {}
    const nombreDocente = `${docenteEmisor.apellidos || ''} ${docenteEmisor.nombres || ''}`.trim() || 'Inspectoría / Docente'
    const fechaActual = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })

    ventana.document.write(`
      <html>
        <head>
          <title>Citación / Notificación Disciplinaria - ${est.apellidos} ${est.nombres}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; line-height: 1.6; }
            .container { max-width: 750px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 35px; border-radius: 12px; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
            .logo-container { width: 75px; text-align: center; margin-right: 20px; }
            .logo-container img { max-width: 70px; max-height: 70px; object-fit: contain; }
            .inst-info { flex: 1; text-align: center; }
            .inst-info h2 { margin: 0; font-size: 14px; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .inst-info p { margin: 2px 0; font-size: 10px; color: #475569; }
            .doc-title { text-align: center; margin-bottom: 20px; }
            .doc-title h1 { font-size: 13px; font-weight: 800; color: #1d4ed8; text-transform: uppercase; background: rgba(59, 130, 246, 0.08); padding: 8px; border-radius: 6px; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; font-size: 11px; margin-bottom: 20px; }
            .info-box table { width: 100%; border-collapse: collapse; }
            .info-box td { padding: 4px 8px; vertical-align: top; }
            .section-title { font-size: 11px; font-weight: bold; color: #1d4ed8; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 18px; margin-bottom: 8px; }
            .content-text { font-size: 11px; text-align: justify; white-space: pre-line; background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #edf2f7; }
            .signatures { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; }
            .sig-line { border-top: 1px solid #64748b; width: 200px; padding-top: 6px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-container">
                ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : '<div style="font-size:9px; font-weight:bold; color:#94a3b8; border:1px dashed #cbd5e1; padding:8px;">SIN LOGO</div>'}
              </div>
              <div class="inst-info">
                <h2>${nombreInstitucion}</h2>
                <p><strong>CÓDIGO AMIE:</strong> ${codigoAmie}</p>
                <p>INSPECCIÓN GENERAL — CONTROL DISCIPLINARIO Y CONVIVENCIA ESCOLAR</p>
              </div>
            </div>

            <div class="doc-title">
              <h1>NOTIFICACIÓN E INCIDENCIA DISCIPLINARIA</h1>
            </div>

            <div class="info-box">
              <table>
                <tr>
                  <td><strong>Estudiante:</strong> ${est.apellidos} ${est.nombres}</td>
                  <td><strong>Cédula:</strong> ${est.cedula || 'S/N'}</td>
                </tr>
                <tr>
                  <td><strong>Curso / Paralelo:</strong> ${est.grado_curso} "${est.paralelo}"</td>
                  <td><strong>Jornada:</strong> ${est.jornada || 'MATUTINA'}</td>
                </tr>
                <tr>
                  <td><strong>Tipo de Registro:</strong> ${item.tipo_alerta}</td>
                  <td><strong>Gravedad:</strong> ${item.gravedad}</td>
                </tr>
                <tr>
                  <td><strong>Reportado por:</strong> ${nombreDocente}</td>
                  <td><strong>Fecha del Incidente:</strong> ${item.fecha_incidente}</td>
                </tr>
                <tr>
                  <td colspan="2"><strong>Estado de Notificación:</strong> <span style="color: #2563eb; font-weight: bold;">${item.estado_notificacion}</span></td>
                </tr>
              </table>
            </div>

            <div class="section-title">Descripción Detallada de los Hechos</div>
            <div class="content-text">${item.descripcion}</div>

            <p style="font-size: 11px; margin-top: 25px; text-align: justify;">
              Estimado padre de familia o representante legal: Se pone en su conocimiento el presente reporte formativo/disciplinario. En caso de requerirse su presencia, agradecemos acercarse a la Inspectoría General del plantel para coordinar acciones de apoyo y compromiso conjunto.
            </p>

            <p style="font-size: 10px; color: #64748b; text-align: right; margin-top: 10px;">Fecha de emisión del reporte: ${fechaActual}</p>

            <div class="signatures">
              <div>
                <div class="sig-line">Inspector(a) General</div>
              </div>
              <div>
                <div class="sig-line">Firma del Representante</div>
              </div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `)
    ventana.document.close()
  }

  // Grados obtenidos tanto de los estudiantes activos como de las alertas existentes
  const gradosDisponibles = Array.from(
    new Set([
      ...estudiantesInstitucion.map(e => e.grado_curso),
      ...alertasInstitucionales.map(a => a.estudiantes?.grado_curso)
    ].filter(Boolean))
  ).sort()

  const alertasFiltradas = alertasInstitucionales.filter((item) => {
    const est = item.estudiantes || {}
    const texto = busquedaTexto.toLowerCase().trim()
    const nombreEstudiante = `${est.apellidos || ''} ${est.nombres || ''}`.toLowerCase()
    const tipo = (item.tipo_alerta || '').toLowerCase()

    const matchTexto = !texto || nombreEstudiante.includes(texto) || tipo.includes(texto)
    const matchJornada = filtroJornada === 'TODAS' || (est.jornada || 'MATUTINA') === filtroJornada
    const matchGrado = filtroGrado === 'TODOS' || est.grado_curso === filtroGrado
    const matchGravedad = filtroGravedad === 'TODAS' || item.gravedad === filtroGravedad

    return matchTexto && matchJornada && matchGrado && matchGravedad
  })

  // Estudiantes filtrados dentro del modal de creación rápida
  const estudiantesModalFiltrados = estudiantesInstitucion.filter(est => {
    const matchJornada = modalFiltroJornada === 'TODAS' || (est.jornada || 'MATUTINA') === modalFiltroJornada
    const matchGrado = modalFiltroGrado === 'TODOS' || est.grado_curso === modalFiltroGrado
    return matchJornada && matchGrado
  })

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Inspección y Disciplina...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#4b4c99] selection:text-white">
      
      {/* ENCABEZADO CON BOTÓN DE REGISTRO DIRECTO PARA INSPECCIÓN */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-200 inline-block mb-1.5">
            Inspección General • Periodo {anioLectivo} • [Control Consolidado]
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Consolidado Institucional de Disciplina y Alertas
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Gestión de incidencias, reportes verbales docentes, faltas y citaciones.
          </p>
        </div>

        <button
          onClick={abrirModalCrear}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2 shrink-0"
        >
          <span>+</span> Registrar Alerta / Reporte Verbal
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* FILTROS DE BÚSQUEDA */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-5 gap-3.5 text-xs">
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Año Lectivo</label>
          <select
            value={anioLectivo}
            onChange={(e) => handleCambiarPeriodo(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
          >
            {periodosDisponibles.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Jornada</label>
          <select
            value={filtroJornada}
            onChange={(e) => setFiltroJornada(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
          >
            <option value="TODAS">Todas las jornadas</option>
            <option value="MATUTINA">Matutina</option>
            <option value="VESPERTINA">Vespertina</option>
            <option value="NOCTURNA">Nocturna</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Curso / Grado</label>
          <select
            value={filtroGrado}
            onChange={(e) => setFiltroGrado(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
          >
            <option value="TODOS">Todos los cursos</option>
            {gradosDisponibles.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Gravedad</label>
          <select
            value={filtroGravedad}
            onChange={(e) => setFiltroGravedad(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
          >
            <option value="TODAS">Todas las gravedades</option>
            <option value="Leve">Leve</option>
            <option value="Grave">Grave</option>
            <option value="Muy Grave">Muy Grave</option>
            <option value="N/A">No Aplica (Mérito)</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Buscar Alumno</label>
          <input
            type="text"
            value={busquedaTexto}
            onChange={(e) => setBusquedaTexto(e.target.value)}
            placeholder="Apellidos o incidencia..."
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs"
          />
        </div>
      </div>

      {/* TABLA DE CONSOLIDADO INSTITUCIONAL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 text-xs font-bold uppercase text-white tracking-wider flex justify-between items-center bg-blue-600">
          <span>Incidencias Disciplinarias Registradas ({anioLectivo})</span>
          <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-xl">Total Registros: {alertasFiltradas.length}</span>
        </div>

        {alertasFiltradas.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No se encontraron alertas o incidencias bajo los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Estudiante</th>
                  <th className="p-3.5">Curso / Paralelo</th>
                  <th className="p-3.5">Tipo de Incidencia</th>
                  <th className="p-3.5">Reportado Por</th>
                  <th className="p-3.5 text-center">Gravedad</th>
                  <th className="p-3.5 text-center">Estado Seguimiento</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {alertasFiltradas.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/85 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-600">{item.fecha_incidente}</td>
                    <td className="p-3.5 font-bold text-slate-800">{item.estudiantes?.apellidos} {item.estudiantes?.nombres}</td>
                    <td className="p-3.5 font-bold text-slate-700">{item.estudiantes?.grado_curso} "{item.estudiantes?.paralelo}"</td>
                    <td className="p-3.5 text-blue-900 font-semibold">{item.tipo_alerta}</td>
                    <td className="p-3.5 font-medium text-slate-700">{item.docentes?.apellidos} {item.docentes?.nombres}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        item.gravedad === 'Leve' ? 'bg-amber-100 text-amber-800' :
                        item.gravedad === 'Grave' ? 'bg-orange-100 text-orange-800' :
                        item.gravedad === 'Muy Grave' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.gravedad}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        item.estado_notificacion === 'Resuelto' ? 'bg-emerald-100 text-emerald-800' :
                        item.estado_notificacion === 'Notificado al Representante' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.estado_notificacion}
                      </span>
                    </td>
                    <td className="p-3.5 text-center space-x-2">
                      <button
                        onClick={() => abrirModalEditarEstado(item)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition text-[11px] shadow-2xs cursor-pointer inline-block"
                      >
                        Gestionar
                      </button>
                      <button
                        onClick={() => generarCitacionPdf(item)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-[11px] shadow-2xs cursor-pointer inline-block"
                      >
                        Imprimir Citación
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA CREAR NUEVA ALERTA O REPORTE VERBAL DESDE INSPECCIÓN */}
      {modalCrearAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                Registrar Alerta Disciplinaria / Reporte Verbal ({anioLectivo})
              </h2>
              <button onClick={() => setModalCrearAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleCrearAlertaInspector} className="space-y-4 text-xs">
              
              {/* FILTROS RÁPIDOS DE JORNADA Y AÑO DE BÁSICA */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="text-[10px] font-bold uppercase text-blue-700 block">
                  Buscar Estudiante por Jornada y Año / Curso
                </span>
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
                      {gradosDisponibles.map((g) => (
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
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
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

              {/* SELECTOR DE DOCENTE QUE INFORMA (POR SI ES REPORTE VERBAL) */}
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">
                  Reportado / Informado por (Inspectoría o Docente que informó verbalmente)
                </label>
                <select
                  value={docenteEmisorSeleccionado}
                  onChange={(e) => setDocenteEmisorSeleccionado(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
                >
                  {docentesInstitucion.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.apellidos} {doc.nombres} ({doc.rol || 'Docente'}) {doc.id === inspectorId ? '— [Yo / Inspectoría]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Tipo de Registro</label>
                  <select
                    value={tipoAlerta}
                    onChange={(e) => setTipoAlerta(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
                  >
                    <option value="Indisciplina en Aula">Indisciplina en Aula</option>
                    <option value="Atraso Injustificado">Atraso Injustificado</option>
                    <option value="Falta Injustificada">Falta Injustificada</option>
                    <option value="Falta de Materiales / Deberes">Falta de Materiales / Deberes</option>
                    <option value="Falta de Respeto">Falta de Respeto</option>
                    <option value="Uso de Celular / Dispositivos">Uso de Celular / Dispositivos</option>
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

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Estado Inicial</label>
                  <select
                    value={estadoInicial}
                    onChange={(e) => setEstadoInicial(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
                  >
                    <option value="Pendiente de Revisión">Pendiente de Revisión</option>
                    <option value="Notificado al Representante">Notificado al Representante</option>
                    <option value="Resuelto">Resuelto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Descripción Detallada de los Hechos</label>
                <textarea
                  required
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalla lo sucedido o el reporte verbal recibido del docente..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setModalCrearAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={procesando}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {procesando ? 'Registrando...' : 'Guardar Alerta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA ACTUALIZAR ESTADO DE LA ALERTA */}
      {modalAbierto && alertaSeleccionada && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                Gestión de Inspectoría
              </h2>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
              <p><strong>Estudiante:</strong> {alertaSeleccionada.estudiantes?.apellidos} {alertaSeleccionada.estudiantes?.nombres}</p>
              <p><strong>Incidencia:</strong> {alertaSeleccionada.tipo_alerta} ({alertaSeleccionada.gravedad})</p>
              <p className="text-slate-600 pt-1"><strong>Detalle:</strong> {alertaSeleccionada.descripcion}</p>
            </div>

            <form onSubmit={guardarEstadoAlerta} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Estado de Seguimiento / Notificación</label>
                <select
                  value={nuevoEstadoNotificacion}
                  onChange={(e) => setNuevoEstadoNotificacion(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
                >
                  <option value="Pendiente de Revisión">Pendiente de Revisión</option>
                  <option value="Notificado al Representante">Notificado al Representante</option>
                  <option value="Resuelto">Resuelto</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
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
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {procesando ? 'Guardando...' : 'Actualizar Estado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}