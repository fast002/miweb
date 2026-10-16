'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EstudiantesNeePage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [docenteId, setDocenteId] = useState('')
  const [nombreDocente, setNombreDocente] = useState('')
  const [esAutoridad, setEsAutoridad] = useState(false)

  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [registrosNee, setRegistrosNee] = useState<any[]>([])
  const [estudiantesActivos, setEstudiantesActivos] = useState<any[]>([])
  const [docentesInstitucion, setDocentesInstitucion] = useState<any[]>([])

  // Modal para nuevo o editar registro
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [registroIdEditando, setRegistroIdEditando] = useState('')

  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState('')
  const [tipoDificultad, setTipoDificultad] = useState('Dificultad Específica del Aprendizaje (Dislexia / Discalculia)')
  const [otraDificultadEspecifica, setOtraDificultadEspecifica] = useState('')
  const [gradoAdaptacion, setGradoAdaptacion] = useState('Grado 2 (No significativa)')
  const [diagnostico, setDiagnostico] = useState('')
  const [estrategias, setEstrategias] = useState('')
  const [compromisos, setCompromisos] = useState('')
  const [estadoSeguimiento, setEstadoSeguimiento] = useState('En Seguimiento')

  // Filtros principales de la tabla
  const [filtroAnioLectivo, setFiltroAnioLectivo] = useState('')
  const [filtroJornada, setFiltroJornada] = useState('TODAS')
  const [filtroGrado, setFiltroGrado] = useState('TODOS')
  const [filtroDocente, setFiltroDocente] = useState('TODOS')
  const [busquedaTexto, setBusquedaTexto] = useState('')

  // Filtros internos dentro del Modal para seleccionar al estudiante fácilmente
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

      const { data: doc, error: docError } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (docError || !doc?.institucion_id) {
        router.push('/')
        return
      }

      setInstitucionId(doc.institucion_id)
      setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
      setCodigoAmie(doc.instituciones?.codigo_amie || '00H00000')
      setLogoUrl(doc.instituciones?.logo_url || '')
      setNombreDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim().toUpperCase())

      const rol = doc.rol?.toLowerCase() || ''
      const autoridadFlag = rol.includes('rector') || rol.includes('vicerrector') || rol.includes('director') || rol.includes('inspector')
      setEsAutoridad(autoridadFlag)

      const inst = doc.instituciones
      const periodos = inst?.periodos_disponibles || ['2026-2027']
      setPeriodosDisponibles(periodos)

      let anioActivo = inst?.anio_lectivo_activo || periodos[0] || '2026-2027'
      setAnioLectivoVigente(anioActivo)
      setFiltroAnioLectivo(anioActivo)

      await cargarRegistrosNee(doc.institucion_id, anioActivo)
      await cargarEstudiantes(doc.institucion_id, anioActivo)
      await cargarDocentesInstitucion(doc.institucion_id)
    } catch (err) {
      console.error('Error al inicializar módulo NEE:', err)
      router.push('/')
    } finally {
      setCargando(false)
    }
  }

  const cargarRegistrosNee = async (instId: string, anio: string) => {
    const { data, error } = await supabase
      .from('seguimiento_nee')
      .select(`
        *,
        estudiantes (
          nombres,
          apellidos,
          grado_curso,
          paralelo,
          cedula,
          jornada,
          anio_lectivo,
          institucion_id
        ),
        docentes:docente_registra_id (
          nombres,
          apellidos
        )
      `)
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .order('fecha_registro', { ascending: false })

    if (!error && data) {
      const datosSeguros = data.filter((item: any) => item.estudiantes?.institucion_id === instId)
      setRegistrosNee(datosSeguros)
    }
  }

  const cargarEstudiantes = async (instId: string, anio: string) => {
    const { data } = await supabase
      .from('estudiantes')
      .select('id, nombres, apellidos, grado_curso, paralelo, jornada, anio_lectivo, institucion_id')
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true })

    if (data) {
      const estudiantesSeguros = data.filter((est: any) => est.institucion_id === instId)
      setEstudiantesActivos(estudiantesSeguros)
    }
  }

  const cargarDocentesInstitucion = async (instId: string) => {
    const { data } = await supabase
      .from('docentes')
      .select('id, nombres, apellidos')
      .eq('institucion_id', instId)
      .order('apellidos', { ascending: true })

    if (data) setDocentesInstitucion(data)
  }

  const handleCambiarFiltroPeriodo = async (nuevoPeriodo: string) => {
    setFiltroAnioLectivo(nuevoPeriodo)
    if (institucionId) {
      await cargarRegistrosNee(institucionId, nuevoPeriodo)
      await cargarEstudiantes(institucionId, nuevoPeriodo)
    }
  }

  const abrirModalNuevo = () => {
    setModoEdicion(false)
    setRegistroIdEditando('')
    setEstudianteSeleccionadoId('')
    setTipoDificultad('Dificultad Específica del Aprendizaje (Dislexia / Discalculia)')
    setOtraDificultadEspecifica('')
    setGradoAdaptacion('Grado 2 (No significativa)')
    setDiagnostico('')
    setEstrategias('')
    setCompromisos('')
    setEstadoSeguimiento('En Seguimiento')
    setModalAbierto(true)
  }

  const abrirModalEdicion = (item: any) => {
    setModoEdicion(true)
    setRegistroIdEditando(item.id)
    setEstudianteSeleccionadoId(item.estudiante_id)

    // Evaluar si la dificultad es estándar o personalizada ("Otra: ...")
    if (item.tipo_dificultad && item.tipo_dificultad.startsWith('Otra: ')) {
      setTipoDificultad('Otra Necesidad Educativa Específica')
      setOtraDificultadEspecifica(item.tipo_dificultad.replace('Otra: ', ''))
    } else {
      setTipoDificultad(item.tipo_dificultad || 'Dificultad Específica del Aprendizaje (Dislexia / Discalculia)')
      setOtraDificultadEspecifica('')
    }

    setGradoAdaptacion(item.grado_adaptacion || 'Grado 2 (No significativa)')
    setDiagnostico(item.diagnostico_descripcion || '')
    setEstrategias(item.estrategias_pedagogicas || '')
    setCompromisos(item.acuerdos_compromisos || '')
    setEstadoSeguimiento(item.estado || 'En Seguimiento')
    setModalAbierto(true)
  }

  const handleGuardarRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!estudianteSeleccionadoId || !diagnostico.trim() || !estrategias.trim()) {
      setMensaje({ tipo: 'error', texto: 'Por favor selecciona un estudiante y completa el diagnóstico y las estrategias.' })
      return
    }

    const dificultadFinal = tipoDificultad === 'Otra Necesidad Educativa Específica' 
      ? `Otra: ${otraDificultadEspecifica.trim()}` 
      : tipoDificultad

    setProcesando(true)
    setMensaje(null)

    try {
      if (modoEdicion) {
        // Actualizar registro existente
        const { error } = await supabase
          .from('seguimiento_nee')
          .update({
            tipo_dificultad: dificultadFinal,
            grado_adaptacion: gradoAdaptacion,
            diagnostico_descripcion: diagnostico.trim(),
            estrategias_pedagogicas: estrategias.trim(),
            acuerdos_compromisos: compromisos.trim(),
            estado: estadoSeguimiento
          })
          .eq('id', registroIdEditando)

        if (error) throw error
        setMensaje({ tipo: 'exito', texto: 'Ficha de seguimiento actualizada correctamente.' })
      } else {
        // Crear nuevo registro
        const { error } = await supabase.from('seguimiento_nee').insert([{
          institucion_id: institucionId,
          estudiante_id: estudianteSeleccionadoId,
          docente_registra_id: docenteId,
          tipo_dificultad: dificultadFinal,
          grado_adaptacion: gradoAdaptacion,
          diagnostico_descripcion: diagnostico.trim(),
          estrategias_pedagogicas: estrategias.trim(),
          acuerdos_compromisos: compromisos.trim() || 'Seguimiento periódico y refuerzo en aula.',
          estado: estadoSeguimiento,
          anio_lectivo: filtroAnioLectivo
        }])

        if (error) throw error
        setMensaje({ tipo: 'exito', texto: 'Ficha de seguimiento y apoyo pedagógico registrada con éxito.' })
      }

      setEstudianteSeleccionadoId('')
      setDiagnostico('')
      setEstrategias('')
      setCompromisos('')
      setOtraDificultadEspecifica('')
      setModalAbierto(false)
      await cargarRegistrosNee(institucionId, filtroAnioLectivo)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al procesar: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  const generarInformePdfNee = (item: any) => {
    const ventana = window.open('', '_blank')
    if (!ventana) return

    const est = item.estudiantes || {}
    const docReg = item.docentes || {}
    const nombreDocenteEmisor = `${docReg.apellidos || ''} ${docReg.nombres || ''}`.trim() || 'Docente Responsable'
    const fechaReg = new Date(item.fecha_registro).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })

    ventana.document.write(`
      <html>
        <head>
          <title>Informe Psicopedagógico - ${est.apellidos} ${est.nombres}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; line-height: 1.6; }
            .container { max-width: 750px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 35px; border-radius: 12px; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #4b4c99; padding-bottom: 15px; margin-bottom: 25px; }
            .logo-container { width: 75px; text-align: center; margin-right: 20px; }
            .logo-container img { max-width: 70px; max-height: 70px; object-fit: contain; }
            .inst-info { flex: 1; text-align: center; }
            .inst-info h2 { margin: 0; font-size: 14px; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .inst-info p { margin: 2px 0; font-size: 10px; color: #475569; }
            .doc-title { text-align: center; margin-bottom: 20px; }
            .doc-title h1 { font-size: 13px; font-weight: 800; color: #4b4c99; text-transform: uppercase; background: rgba(75, 76, 153, 0.08); padding: 8px; border-radius: 6px; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; font-size: 11px; margin-bottom: 20px; }
            .info-box table { width: 100%; border-collapse: collapse; }
            .info-box td { padding: 4px 8px; vertical-align: top; }
            .section-title { font-size: 11px; font-weight: bold; color: #4b4c99; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 18px; margin-bottom: 8px; }
            .content-text { font-size: 11px; text-align: justify; white-space: pre-line; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid #edf2f7; }
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
                <p>DEPARTAMENTO DE CONSEJERÍA ESTUDIANTIL (DECE) — ADAPTACIONES CURRICULARES</p>
              </div>
            </div>

            <div class="doc-title">
              <h1>INFORME DE SEGUIMIENTO Y APOYO PEDAGÓGICO (NEE)</h1>
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
                  <td><strong>Tipo de Dificultad:</strong> ${item.tipo_dificultad}</td>
                  <td><strong>Grado de Adaptación:</strong> ${item.grado_adaptacion}</td>
                </tr>
                <tr>
                  <td><strong>Docente Emisor:</strong> ${nombreDocenteEmisor}</td>
                  <td><strong>Fecha de Registro:</strong> ${fechaReg}</td>
                </tr>
                <tr>
                  <td colspan="2"><strong>Estado Actual:</strong> <span style="text-transform: uppercase; color: #2563eb; font-weight: bold;">${item.estado}</span></td>
                </tr>
              </table>
            </div>

            <div class="section-title">1. Descripción del Diagnóstico y Necesidad Educativa</div>
            <div class="content-text">${item.diagnostico_descripcion}</div>

            <div class="section-title">2. Estrategias Pedagógicas y Metodológicas Aplicadas</div>
            <div class="content-text">${item.estrategias_pedagogicas}</div>

            <div class="section-title">3. Acuerdos y Compromisos (Docente / Representante / DECE)</div>
            <div class="content-text">${item.acuerdos_compromisos}</div>

            <div class="signatures">
              <div>
                <div class="sig-line">Docente Tutor / Emisor</div>
              </div>
              <div>
                <div class="sig-line">Responsable DECE</div>
              </div>
              <div>
                <div class="sig-line">Rector(a) / Vicerrector(a)</div>
              </div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `)
    ventana.document.close()
  }

  const gradosDisponibles = Array.from(new Set(estudiantesActivos.map(e => e.grado_curso))).sort()

  const registrosFiltrados = registrosNee.filter((r) => {
    const est = r.estudiantes || {}
    const texto = busquedaTexto.toLowerCase().trim()
    const nombreCompleto = `${est.apellidos || ''} ${est.nombres || ''}`.toLowerCase()
    const dificultad = (r.tipo_dificultad || '').toLowerCase()

    const matchTexto = !texto || nombreCompleto.includes(texto) || dificultad.includes(texto)
    const matchJornada = filtroJornada === 'TODAS' || (est.jornada || 'MATUTINA') === filtroJornada
    const matchGrado = filtroGrado === 'TODOS' || est.grado_curso === filtroGrado
    const matchDocente = filtroDocente === 'TODOS' || r.docente_registra_id === filtroDocente

    return matchTexto && matchJornada && matchGrado && matchDocente
  })

  const estudiantesModalFiltrados = estudiantesActivos.filter(est => {
    const matchJornada = modalFiltroJornada === 'TODAS' || (est.jornada || 'MATUTINA') === modalFiltroJornada
    const matchGrado = modalFiltroGrado === 'TODOS' || est.grado_curso === modalFiltroGrado
    return matchJornada && matchGrado
  })

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Necesidades Educativas (NEE)...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">

      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Inclusión y Apoyo Pedagógico • Periodo {filtroAnioLectivo} {esAutoridad ? '• [Vista Directiva Consolidada]' : '• [Vista Docente]'}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Estudiantes con Problemas de Aprendizaje y NEE
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Control, adaptaciones curriculares y seguimiento psicopedagógico.
          </p>
        </div>

        <button
          onClick={abrirModalNuevo}
          style={{ backgroundColor: '#4b4c99' }}
          className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2"
        >
          <span>+</span> Registrar Ficha de Seguimiento NEE
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* FILTROS AVANZADOS DE LA TABLA CONSOLIDADA */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-5 gap-3.5 text-xs">
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Año Lectivo</label>
          <select
            value={filtroAnioLectivo}
            onChange={(e) => handleCambiarFiltroPeriodo(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
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
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
          >
            <option value="TODAS">Todas las jornadas</option>
            <option value="MATUTINA">Matutina</option>
            <option value="VESPERTINA">Vespertina</option>
            <option value="NOCTURNA">Nocturna</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Año / Grado</label>
          <select
            value={filtroGrado}
            onChange={(e) => setFiltroGrado(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
          >
            <option value="TODOS">Todos los grados</option>
            {gradosDisponibles.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* FILTRO POR DOCENTE EMISOR (ÚTIL PARA AUTORIDADES) */}
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Docente Emisor</label>
          <select
            value={filtroDocente}
            onChange={(e) => setFiltroDocente(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
          >
            <option value="TODOS">Todos los docentes</option>
            {docentesInstitucion.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.apellidos} {doc.nombres}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Buscar Alumno</label>
          <input
            type="text"
            value={busquedaTexto}
            onChange={(e) => setBusquedaTexto(e.target.value)}
            placeholder="Apellidos o dificultad..."
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
          />
        </div>
      </div>

      {/* TABLA DE REGISTROS NEE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: '#4b4c99' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider shadow-2xs flex justify-between items-center"
        >
          <span>Consolidado de Informes NEE por Aula ({filtroAnioLectivo})</span>
          <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-xl">Registros Encontrados: {registrosFiltrados.length}</span>
        </div>

        {registrosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No se encontraron informes bajo los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Estudiante</th>
                  <th className="p-3.5">Curso / Paralelo</th>
                  <th className="p-3.5">Tipo de Dificultad</th>
                  <th className="p-3.5">Adaptación</th>
                  <th className="p-3.5">Docente Emisor</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {registrosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-800">
                      {item.estudiantes?.apellidos} {item.estudiantes?.nombres}
                      <span className="block font-mono text-[10px] text-slate-400 font-normal">Cédula: {item.estudiantes?.cedula || 'S/N'}</span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-700">{item.estudiantes?.grado_curso} "{item.estudiantes?.paralelo}"</td>
                    <td className="p-3.5 text-indigo-900 font-semibold">{item.tipo_dificultad}</td>
                    <td className="p-3.5 font-bold text-slate-600">{item.grado_adaptacion}</td>
                    <td className="p-3.5 font-semibold text-slate-700">
                      {item.docentes?.apellidos} {item.docentes?.nombres}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        item.estado === 'En Seguimiento' ? 'bg-amber-100 text-amber-800' :
                        item.estado === 'Superado' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                      } shadow-2xs inline-block`}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="p-3.5 text-center space-x-2">
                      <button
                        onClick={() => abrirModalEdicion(item)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl transition text-[11px] shadow-2xs cursor-pointer inline-block"
                      >
                        Editar / Estado
                      </button>
                      <button
                        onClick={() => generarInformePdfNee(item)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-[11px] shadow-2xs cursor-pointer inline-block"
                      >
                        Imprimir PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA NUEVO O EDITAR REGISTRO NEE */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                {modoEdicion ? 'Editar Ficha de Seguimiento NEE' : `Nueva Ficha de Seguimiento NEE (${filtroAnioLectivo})`}
              </h2>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleGuardarRegistro} className="space-y-4 text-xs">
              
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] font-bold uppercase text-[#4b4c99] block">
                  {modoEdicion ? 'Estudiante Asignado (No modificable)' : 'Filtrar Estudiante por Año de Básica y Jornada'}
                </span>

                {!modoEdicion && (
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
                )}

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Estudiante</label>
                  <select
                    required
                    disabled={modoEdicion}
                    value={estudianteSeleccionadoId}
                    onChange={(e) => setEstudianteSeleccionadoId(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Selecciona un estudiante ({estudiantesModalFiltrados.length} disponibles)...</option>
                    {estudiantesActivos.map((est) => (
                      <option key={est.id} value={est.id}>
                        {est.apellidos} {est.nombres} ({est.grado_curso} "{est.paralelo}" - {est.jornada || 'MATUTINA'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Tipo de Dificultad</label>
                  <select
                    value={tipoDificultad}
                    onChange={(e) => setTipoDificultad(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
                  >
                    <option value="Dificultad Específica del Aprendizaje (Dislexia / Discalculia)">Dislexia / Discalculia</option>
                    <option value="TDAH (Trastorno por Déficit de Atención e Hiperactividad)">TDAH (Atención e Hiperactividad)</option>
                    <option value="Discapacidad Intelectual / Cognitiva">Discapacidad Intelectual / Cognitiva</option>
                    <option value="Problemas de Comprensión Lectora y Escritura">Lectoescritura</option>
                    <option value="Otra Necesidad Educativa Específica">Otra Necesidad Educativa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Grado de Adaptación</label>
                  <select
                    value={gradoAdaptacion}
                    onChange={(e) => setGradoAdaptacion(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
                  >
                    <option value="Grado 1 (Acceso a la infraestructura y recursos)">Grado 1 (Acceso)</option>
                    <option value="Grado 2 (No significativa en metodología y evaluación)">Grado 2 (No significativa)</option>
                    <option value="Grado 3 (Significativa en contenidos y objetivos)">Grado 3 (Significativa)</option>
                  </select>
                </div>
              </div>

              {tipoDificultad === 'Otra Necesidad Educativa Específica' && (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-1.5">
                  <label className="block text-amber-900 font-bold uppercase text-[10px]">Especifique la Necesidad Educativa:</label>
                  <input
                    type="text"
                    required
                    value={otraDificultadEspecifica}
                    onChange={(e) => setOtraDificultadEspecifica(e.target.value)}
                    placeholder="Ej: Disgrafía severa, Trastorno del espectro autista..."
                    className="w-full p-2.5 border border-amber-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none shadow-2xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Diagnóstico y Observación Inicial</label>
                <textarea
                  required
                  rows={3}
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  placeholder="Detalle el diagnóstico o las dificultades observadas..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Estrategias Pedagógicas Aplicadas</label>
                <textarea
                  required
                  rows={3}
                  value={estrategias}
                  onChange={(e) => setEstrategias(e.target.value)}
                  placeholder="Ej: Material visual, tiempo adicional en evaluaciones..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Acuerdos y Compromisos</label>
                  <input
                    type="text"
                    value={compromisos}
                    onChange={(e) => setCompromisos(e.target.value)}
                    placeholder="Ej: Refuerzo en casa"
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Estado del Seguimiento</label>
                  <select
                    value={estadoSeguimiento}
                    onChange={(e) => setEstadoSeguimiento(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
                  >
                    <option value="En Seguimiento">En Seguimiento</option>
                    <option value="Superado">Superado</option>
                    <option value="Derivado al DECE / Distrito">Derivado al DECE</option>
                  </select>
                </div>
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
                  {procesando ? 'Guardando...' : (modoEdicion ? 'Actualizar Ficha NEE' : 'Guardar Ficha NEE')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}