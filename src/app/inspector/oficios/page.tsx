'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function InspectorOficiosCircularesPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [direccionInst, setDireccionInst] = useState('')
  const [autorId, setAutorId] = useState('')
  const [nombreAutor, setNombreAutor] = useState('')
  const [rolAutor, setRolAutor] = useState('INSPECTOR GENERAL')

  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [documentos, setDocumentos] = useState<any[]>([])

  // Filtros y búsqueda
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')

  // Modal de Emisión
  const [modalAbierto, setModalAbierto] = useState(false)
  const [tipoDoc, setTipoDoc] = useState<'CIRCULAR' | 'OFICIO'>('OFICIO')
  
  // Campos específicos del formato
  const [ubicacionEmision, setUbicacionEmision] = useState('Azogues')
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0])
  const [destinatarioNombre, setDestinatarioNombre] = useState('')
  const [destinatarioCargo, setDestinatarioCargo] = useState('')
  const [destinatariosGeneral, setDestinatariosGeneral] = useState('A todos los docentes, tutores y personal de la institución')
  const [departamentoEmisor, setDepartamentoEmisor] = useState('INSPECCIÓN GENERAL')
  const [asunto, setAsunto] = useState('')
  const [contenido, setContenido] = useState('')

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      setAutorId(user.id)

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (doc?.institucion_id) {
        setInstitucionId(doc.institucion_id)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setCodigoAmie(doc.instituciones?.codigo_amie || '00H00000')
        setLogoUrl(doc.instituciones?.logo_url || '')
        setDireccionInst(doc.instituciones?.direccion || 'Ecuador')
        setNombreAutor(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim().toUpperCase())
        
        const rolUsuario = (doc.rol || '').toUpperCase()
        setRolAutor(rolUsuario.includes('INSPECTOR') ? rolUsuario : 'INSPECTOR GENERAL')

        const inst = doc.instituciones
        const anioActivo = inst?.anio_lectivo_activo || inst?.periodos_disponibles?.[0] || '2026-2027'
        setAnioLectivoVigente(anioActivo)

        await cargarDocumentos(doc.institucion_id, anioActivo)
      }
    } catch (err) {
      console.error('Error al inicializar oficios de inspectoría:', err)
    } finally {
      setCargando(false)
    }
  }

  const cargarDocumentos = async (instId: string, anio: string) => {
    // Traemos los documentos emitidos por inspección o generales de la institución
    const { data, error } = await supabase
      .from('oficios_circulares')
      .select('*')
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .order('fecha', { ascending: false })

    if (!error && data) {
      setDocumentos(data)
    }
  }

  const generarSiglasInstitucion = (nombre: string) => {
    if (!nombre) return 'UE'
    const palabras = nombre.toUpperCase().split(' ').filter(p => p.length > 2 || p === 'UE' || p === 'U' || p === 'E')
    let siglas = ''
    palabras.forEach(palabra => {
      siglas += palabra[0]
    })
    return siglas.length >= 2 ? siglas : 'UEG'
  }

  const handleCrearDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asunto.trim() || !contenido.trim() || !ubicacionEmision.trim() || !fechaEmision) {
      setMensaje({ tipo: 'error', texto: 'Por favor completa todos los campos requeridos.' })
      return
    }

    setProcesando(true)
    setMensaje(null)

    try {
      const { count } = await supabase
        .from('oficios_circulares')
        .select('*', { count: 'exact', head: true })
        .eq('institucion_id', institucionId)
        .eq('tipo', tipoDoc)
        .eq('anio_lectivo', anioLectivoVigente)

      const secuencial = (count || 0) + 1
      const siglasInst = generarSiglasInstitucion(nombreInstitucion)
      const deptoLimpio = departamentoEmisor.trim().toUpperCase().replace(/\s+/g, '-')
      const codigoUnico = `${siglasInst}-${deptoLimpio}-${String(secuencial).padStart(4, '0')}`

      const destinatarioFinal = tipoDoc === 'OFICIO' 
        ? `${destinatarioNombre.trim()}|${destinatarioCargo.trim()}`
        : destinatariosGeneral.trim()

      const { error } = await supabase.from('oficios_circulares').insert([{
        institucion_id: institucionId,
        autor_id: autorId,
        tipo: tipoDoc,
        codigo_unico: codigoUnico,
        asunto: asunto.trim().toUpperCase(),
        contenido: contenido.trim(),
        destinatarios: destinatarioFinal,
        anio_lectivo: anioLectivoVigente,
        ubicacion: ubicacionEmision.trim(),
        fecha: fechaEmision
      }])

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: `¡${tipoDoc === 'CIRCULAR' ? 'Circular' : 'Oficio'} de Inspectoría emitido con éxito bajo el código ${codigoUnico}!` })
      setAsunto('')
      setContenido('')
      setDestinatarioNombre('')
      setDestinatarioCargo('')
      setModalAbierto(false)
      await cargarDocumentos(institucionId, anioLectivoVigente)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al emitir documento: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  const imprimirDocumento = (doc: any) => {
    const ventana = window.open('', '_blank')
    if (!ventana) return

    let fechaFormateada = doc.fecha
    if (doc.fecha) {
      const partes = doc.fecha.split('T')[0].split('-')
      if (partes.length === 3) {
        const anio = parseInt(partes[0], 10)
        const mesIndex = parseInt(partes[1], 10) - 1
        const dia = parseInt(partes[2], 10)
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        if (!isNaN(anio) && !isNaN(mesIndex) && !isNaN(dia)) {
          fechaFormateada = `${dia} de ${meses[mesIndex]} de ${anio}`
        }
      }
    }

    const ubicacionDoc = doc.ubicacion || 'Ecuador'

    let bloqueDestinatarioHtml = ''
    if (doc.tipo === 'OFICIO') {
      const partesDest = (doc.destinatarios || '').split('|')
      const nombreDest = partesDest[0] || 'Destinatario'
      const cargoDest = partesDest[1] || 'Cargo'

      bloqueDestinatarioHtml = `
        <div class="destinatario-oficio">
          <strong>${nombreDest}</strong><br/>
          <span>${cargoDest}</span><br/>
          <strong>Presente.</strong>
        </div>
      `
    } else {
      bloqueDestinatarioHtml = `
        <div class="destinatario-circular">
          <strong>A: ${doc.destinatarios}:</strong>
        </div>
      `
    }

    ventana.document.write(`
      <html>
        <head>
          <title>${doc.tipo} - ${doc.codigo_unico}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; line-height: 1.6; }
            .container { max-width: 720px; margin: 0 auto; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #de5860; padding-bottom: 15px; margin-bottom: 25px; }
            .logo-container { width: 75px; text-align: center; margin-right: 20px; }
            .logo-container img { max-width: 70px; max-height: 70px; object-fit: contain; }
            .inst-info { flex: 1; text-align: center; }
            .inst-info h2 { margin: 0; font-size: 14px; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .inst-info p { margin: 2px 0; font-size: 10px; color: #475569; }
            .top-right-date { text-align: right; font-size: 12px; margin-bottom: 20px; font-weight: 500; }
            .doc-number { font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 20px; text-transform: uppercase; }
            .destinatario-oficio { font-size: 12px; margin-bottom: 18px; line-height: 1.5; }
            .destinatario-circular { font-size: 12px; margin-bottom: 18px; font-weight: bold; }
            .asunto-box { font-size: 12px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
            .content { font-size: 12px; line-height: 1.8; text-align: justify; white-space: pre-line; margin-bottom: 40px; }
            .atentamente { text-align: center; font-weight: bold; margin-bottom: 40px; font-size: 12px; }
            .signatures { text-align: center; margin-top: 30px; }
            .sig-name { font-size: 12px; font-weight: bold; color: #0f172a; }
            .sig-cargo { font-size: 11px; color: #475569; font-weight: 600; margin-top: 2px; }
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
                ${direccionInst ? `<p><strong>DIRECCIÓN:</strong> ${direccionInst}</p>` : ''}
                <p>INSPECCIÓN GENERAL — GESTIÓN DOCUMENTAL Y DISCIPLINARIA</p>
              </div>
            </div>

            <div class="top-right-date">
              ${ubicacionDoc}, ${fechaFormateada}
            </div>

            <div class="doc-number">
              ${doc.tipo === 'OFICIO' ? 'OFICIO No.' : 'CIRCULAR No.'} ${doc.codigo_unico}
            </div>

            ${bloqueDestinatarioHtml}

            <div class="asunto-box">
              ASUNTO: ${doc.asunto}
            </div>

            <div class="content">
              ${doc.contenido}
            </div>

            <div class="atentamente">
              Atentamente,
            </div>

            <div class="signatures">
              <div class="sig-name">${nombreAutor}</div>
              <div class="sig-cargo">${rolAutor}</div>
              <div class="sig-cargo">${nombreInstitucion}</div>
            </div>
          </div>
          <script>
            window.print();
          </script>
        </body>
      </html>
    `)
    ventana.document.close()
  }

  const documentosFiltrados = documentos.filter((doc) => {
    const texto = busqueda.toLowerCase().trim()
    const matchTexto = !texto || (doc.codigo_unico || '').toLowerCase().includes(texto) || (doc.asunto || '').toLowerCase().includes(texto) || (doc.destinatarios || '').toLowerCase().includes(texto)
    const matchTipo = filtroTipo === 'TODOS' || doc.tipo === filtroTipo
    return matchTexto && matchTipo
  })

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#de5860] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div style={{ borderColor: '#de5860' }} className="h-8 w-8 animate-spin rounded-full border-3 border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Inspectoría...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#de5860] selection:text-white font-sans">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#de5860', backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Inspección General • Periodo {anioLectivoVigente}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Oficios y Circulares de Inspección General
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Emisión, citaciones oficiales y comunicados disciplinarios.
          </p>
        </div>

        <button
          onClick={() => setModalAbierto(true)}
          style={{ backgroundColor: '#de5860' }}
          className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm hover:opacity-95 transition cursor-pointer flex items-center gap-2"
        >
          <span>+</span> Emitir Documento de Inspección
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* FILTROS Y BÚSQUEDA */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3.5 items-center text-xs">
        <div className="md:col-span-2">
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Buscar por Código, Asunto o Destinatario</label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej: INSPECCION-GENERAL, Citación, Justificación..."
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Filtrar por Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs cursor-pointer"
          >
            <option value="TODOS">Todos los documentos</option>
            <option value="OFICIO">Oficios</option>
            <option value="CIRCULAR">Circulares</option>
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE DOCUMENTOS */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: '#de5860' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider shadow-2xs flex justify-between items-center"
        >
          <span>Historial de Oficios y Circulares Emitidas ({anioLectivoVigente})</span>
          <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-xl">Total Registrados: {documentosFiltrados.length}</span>
        </div>

        {documentosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No se encontraron oficios o circulares emitidas bajo los criterios de búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Código Único</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Destinatario / Dirigido a</th>
                  <th className="p-3.5">Asunto</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documentosFiltrados.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-[#de5860]">
                      {doc.codigo_unico}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        doc.tipo === 'CIRCULAR' ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'
                      } shadow-2xs inline-block`}>
                        {doc.tipo}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700 font-semibold">
                      {doc.tipo === 'OFICIO' ? doc.destinatarios.split('|')[0] : doc.destinatarios}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 max-w-xs truncate" title={doc.asunto}>{doc.asunto}</td>
                    <td className="p-3.5 text-slate-500">{doc.fecha}</td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => imprimirDocumento(doc)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-[11px] shadow-2xs cursor-pointer"
                      >
                        Imprimir / PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA CREAR NUEVO DOCUMENTO DE INSPECTORÍA */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                Emitir Documento de Inspección ({anioLectivoVigente})
              </h2>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleCrearDocumento} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Tipo de Documento</label>
                  <select
                    value={tipoDoc}
                    onChange={(e: any) => setTipoDoc(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs cursor-pointer"
                  >
                    <option value="OFICIO">Oficio de Inspectoría</option>
                    <option value="CIRCULAR">Circular Informativa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Departamento Emisor</label>
                  <input
                    type="text"
                    required
                    value={departamentoEmisor}
                    onChange={(e) => setDepartamentoEmisor(e.target.value)}
                    placeholder="Ej: INSPECCIÓN GENERAL"
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none uppercase focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Ubicación / Ciudad</label>
                  <input
                    type="text"
                    required
                    value={ubicacionEmision}
                    onChange={(e) => setUbicacionEmision(e.target.value)}
                    placeholder="Ej: Azogues"
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Fecha de Emisión</label>
                  <input
                    type="date"
                    required
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs cursor-pointer"
                  />
                </div>
              </div>

              {tipoDoc === 'OFICIO' ? (
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="col-span-2 text-[10px] font-bold text-[#de5860] uppercase">
                    Datos del Destinatario (Autoridad, Docente o Padre de Familia)
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombre y Título</label>
                    <input
                      type="text"
                      required
                      value={destinatarioNombre}
                      onChange={(e) => setDestinatarioNombre(e.target.value)}
                      placeholder="Ej: Lic. Mario Rodríguez / Sr. Juan Pérez"
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1.5">Cargo o Parentesco</label>
                    <input
                      type="text"
                      required
                      value={destinatarioCargo}
                      onChange={(e) => setDestinatarioCargo(e.target.value)}
                      placeholder="Ej: Docente Tutor / Representante Legal"
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Dirigido a (Destinatarios de la Circular)</label>
                  <input
                    type="text"
                    required
                    value={destinatariosGeneral}
                    onChange={(e) => setDestinatariosGeneral(e.target.value)}
                    placeholder="Ej: a los docentes tutores y personal docente"
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Asunto del Documento</label>
                <input
                  type="text"
                  required
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="Ej: Notificación de inasistencias reiteradas / Normas de uniforme"
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none uppercase focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Contenido / Cuerpo del Documento</label>
                <textarea
                  required
                  rows={7}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder="Por medio de la presente, la Inspección General se dirige a usted con la finalidad de comunicarle que..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white outline-none focus:border-[#de5860] focus:ring-1 focus:ring-[#de5860] shadow-2xs resize-none leading-relaxed"
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
                  style={{ backgroundColor: '#de5860' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {procesando ? 'Generando código...' : 'Emitir y Generar Código'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}