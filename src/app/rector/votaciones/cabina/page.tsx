'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CabinaVotacionPage() {
  const [identificadorMaquina, setIdentificadorMaquina] = useState('')
  const [mesaAutenticada, setMesaAutenticada] = useState<any>(null)
  const [busqueda, setBusqueda] = useState('')
  const [estudiantesCoincidentes, setEstudiantesCoincidentes] = useState<any[]>([])
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<any>(null)
  const [listas, setListas] = useState<any[]>([])
  const [votoProcesado, setVotoProcesado] = useState(false)
  const [certificadoActual, setCertificadoActual] = useState<any>(null)
  const [guardandoVoto, setGuardandoVoto] = useState(false)

  // Estado para la ventana flotante de confirmación de voto
  const [modalConfirmacion, setModalConfirmacion] = useState<{
    abierto: boolean
    opcionId: string
    nombreOpcion: string
    color?: string
  }>({
    abierto: false,
    opcionId: '',
    nombreOpcion: '',
    color: '#4b4c99'
  })

  // NUEVO: Estado para la ventana flotante de "Estudiante Ya Votó"
  const [modalYaVoto, setModalYaVoto] = useState<{
    abierto: boolean
    estudiante: string
    hora: string
  }>({
    abierto: false,
    estudiante: '',
    hora: ''
  })

  // 1. Autenticar equipo en la mesa
  const verificarMaquina = async () => {
    const idLimpio = identificadorMaquina.trim()
    if (!idLimpio) return

    try {
      const { data: mesa, error } = await supabase
        .from('elecciones_mesas')
        .select(`
          id,
          nombre_mesa,
          identificador_maquina,
          eleccion_id,
          activa,
          elecciones (
            id,
            titulo,
            estado,
            institucion_id
          )
        `)
        .eq('identificador_maquina', idLimpio)
        .eq('activa', true)
        .maybeSingle()

      if (error || !mesa) {
        alert('Identificador de máquina no encontrado o terminal no autorizada.')
        return
      }

      const eleccionAsociada = mesa.elecciones as any
      if (!eleccionAsociada) {
        alert('La máquina no tiene un proceso electoral vinculado.')
        return
      }

      if (eleccionAsociada.estado !== 'activa') {
        alert(`El proceso electoral está en estado "${eleccionAsociada.estado.toUpperCase()}". Debe ser iniciado desde el panel Rector.`)
        return
      }

      // Obtener datos y logo de la institución
      let instData: any = { nombre_institucion: 'UNIDAD EDUCATIVA', logo_url: '' }
      if (eleccionAsociada.institucion_id) {
        const { data: inst } = await supabase
          .from('instituciones')
          .select('nombre_institucion, logo_url')
          .eq('id', eleccionAsociada.institucion_id)
          .maybeSingle()

        if (inst) instData = inst
      }

      setMesaAutenticada({
        ...mesa,
        elecciones: {
          ...eleccionAsociada,
          instituciones: instData
        }
      })

      // Cargar listas con sus integrantes y fotos
      const { data: lis } = await supabase
        .from('elecciones_listas')
        .select('*, elecciones_candidatos(*)')
        .eq('eleccion_id', mesa.eleccion_id)
        .order('numero_lista', { ascending: true })

      setListas(lis || [])
    } catch (err: any) {
      alert('Error de conexión: ' + err.message)
    }
  }

  // 2. Buscar estudiante en el padrón
  const handleBuscarEstudiantes = async (texto: string) => {
    setBusqueda(texto)
    if (texto.trim().length < 3) {
      setEstudiantesCoincidentes([])
      return
    }

    const { data: ests } = await supabase
      .from('estudiantes')
      .select('id, apellidos, nombres, cedula, grado_curso, paralelo')
      .eq('institucion_id', mesaAutenticada.elecciones.institucion_id)
      .or(`apellidos.ilike.%${texto}%,nombres.ilike.%${texto}%,cedula.ilike.%${texto}%`)
      .limit(6)

    setEstudiantesCoincidentes(ests || [])
  }

  // 3. Seleccionar estudiante y chequear padrón
  const seleccionarEstudiante = async (est: any) => {
    const { data: padron } = await supabase
      .from('elecciones_padron')
      .select('*')
      .eq('eleccion_id', mesaAutenticada.eleccion_id)
      .eq('estudiante_id', est.id)
      .maybeSingle()

    // Si ya votó, activamos el modal flotante estilizado
    if (padron && padron.ya_voto) {
      const horaStr = padron.fecha_voto 
        ? new Date(padron.fecha_voto).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Horario no registrado'

      setModalYaVoto({
        abierto: true,
        estudiante: `${est.apellidos} ${est.nombres}`,
        hora: horaStr
      })
      return
    }

    setEstudianteSeleccionado(est)
    setEstudiantesCoincidentes([])
    setBusqueda('')
  }

  // 4. Abrir ventana flotante de confirmación
  const solicitarConfirmacionVoto = (opcionId: string, nombreOpcion: string, color?: string) => {
    setModalConfirmacion({
      abierto: true,
      opcionId,
      nombreOpcion,
      color: color || '#4b4c99'
    })
  }

  // 5. Sufragar anónimamente tras confirmar en el modal
  const ejecutarEmisionVoto = async () => {
    const { opcionId } = modalConfirmacion
    setGuardandoVoto(true)

    try {
      const codigoCert = `CERT-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`

      // A. Urna electrónica anónima
      const { error: errVoto } = await supabase.from('elecciones_votos').insert({
        eleccion_id: mesaAutenticada.eleccion_id,
        mesa_id: mesaAutenticada.id,
        opcion_voto: opcionId
      })
      if (errVoto) throw errVoto

      // B. Actualizar padrón electoral
      const { error: errPadron } = await supabase
        .from('elecciones_padron')
        .update({
          ya_voto: true,
          fecha_voto: new Date().toISOString(),
          mesa_id: mesaAutenticada.id,
          codigo_certificado: codigoCert
        })
        .eq('eleccion_id', mesaAutenticada.eleccion_id)
        .eq('estudiante_id', estudianteSeleccionado.id)

      if (errPadron) throw errPadron

      const datosCertificado = {
        institucion: mesaAutenticada.elecciones.instituciones.nombre_institucion,
        logo_url: mesaAutenticada.elecciones.instituciones.logo_url,
        proceso: mesaAutenticada.elecciones.titulo,
        estudiante: `${estudianteSeleccionado.apellidos} ${estudianteSeleccionado.nombres}`,
        cedula: estudianteSeleccionado.cedula || 'S/N',
        curso: `${estudianteSeleccionado.grado_curso} "${estudianteSeleccionado.paralelo}"`,
        mesa: mesaAutenticada.nombre_mesa,
        fecha: new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }),
        codigo: codigoCert
      }

      setCertificadoActual(datosCertificado)
      setModalConfirmacion({ abierto: false, opcionId: '', nombreOpcion: '' })
      setVotoProcesado(true)
    } catch (err: any) {
      alert('Error registrando voto: ' + err.message)
    } finally {
      setGuardandoVoto(false)
    }
  }

  // Convertidor de URL de logo a Base64 para incrustar en PDF
  const convertirImagenBase64 = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  // 6. Descargar Certificado Horizontal de 7.5 cm x 5.0 cm (75 mm x 50 mm)
  const imprimirCertificado = async () => {
    if (!certificadoActual) return
    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF({
      orientation: 'l',
      unit: 'mm',
      format: [75, 50]
    })

    // Borde
    doc.setDrawColor(75, 76, 153)
    doc.setLineWidth(0.4)
    doc.rect(2, 2, 71, 46)

    // Logo institucional si existe
    if (certificadoActual.logo_url) {
      const logoB64 = await convertirImagenBase64(certificadoActual.logo_url)
      if (logoB64) {
        doc.addImage(logoB64 as string, 'PNG', 3.5, 3.5, 7.5, 7.5)
      }
    }

    // Encabezado
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(30, 41, 59)
    doc.text((certificadoActual.institucion || 'UNIDAD EDUCATIVA').toUpperCase(), 40, 5.5, { align: 'center', maxWidth: 55 })

    doc.setFontSize(4.5)
    doc.setTextColor(75, 76, 153)
    doc.text('TRIBUNAL ELECTORAL ESTUDIANTIL', 40, 8.5, { align: 'center' })

    doc.setFontSize(6)
    doc.setTextColor(0, 0, 0)
    doc.text('CERTIFICADO DE VOTACIÓN', 40, 12, { align: 'center' })

    // Línea separadora
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.2)
    doc.line(4, 13.5, 71, 13.5)

    // Datos del Estudiante
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.2)
    doc.setTextColor(71, 85, 105)
    doc.text('Estudiante:', 4, 16.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.2)
    doc.setTextColor(15, 23, 42)
    doc.text(certificadoActual.estudiante, 18, 16.5, { maxWidth: 52 })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.2)
    doc.setTextColor(71, 85, 105)
    doc.text('C.I. / Matrícula:', 4, 20.5)
    doc.text('Curso / Paralelo:', 4, 24)
    doc.text('Terminal / Mesa:', 4, 27.5)
    doc.text('Fecha / Emisión:', 4, 31)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(certificadoActual.cedula, 22, 20.5)
    doc.text(certificadoActual.curso, 22, 24)
    doc.text(certificadoActual.mesa, 22, 27.5)
    doc.text(certificadoActual.fecha, 22, 31)

    // Firmas
    doc.line(10, 39, 36, 39)
    doc.setFontSize(3.8)
    doc.setFont('helvetica', 'normal')
    doc.text('Presidente(a) de Mesa', 23, 41.5, { align: 'center' })

    doc.line(42, 39, 68, 39)
    doc.text('Secretario(a) Electoral', 55, 41.5, { align: 'center' })

    // Código de Validación
    doc.setFont('courier', 'bold')
    doc.setFontSize(4.2)
    doc.setTextColor(75, 76, 153)
    doc.text(`VALIDACIÓN: ${certificadoActual.codigo}`, 37.5, 45.5, { align: 'center' })

    doc.save(`Certificado_${certificadoActual.estudiante.replace(/\s+/g, '_')}.pdf`)
  }

  const reiniciarParaSiguiente = () => {
    setEstudianteSeleccionado(null)
    setVotoProcesado(false)
    setCertificadoActual(null)
    setBusqueda('')
  }

  // PANTALLA 1: Identificación de la Máquina
  if (!mesaAutenticada) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 max-w-md w-full shadow-lg space-y-4">
          <span className="text-[10px] font-bold px-3 py-1 rounded-xl bg-indigo-50 text-[#4b4c99] uppercase tracking-wider inline-block">
            Terminal de Sufragio Estudiantil
          </span>
          <h1 className="text-xl font-bold text-slate-900">Configuración de Máquina</h1>
          <p className="text-xs text-slate-500">Ingresa el identificador único asignado por el Rectorado para esta computadora.</p>

          <input
            type="text"
            placeholder="Ej: MESA-01-A4B7"
            value={identificadorMaquina}
            onChange={e => setIdentificadorMaquina(e.target.value.toUpperCase())}
            className="w-full p-3 font-mono font-bold text-sm border border-slate-300 rounded-xl outline-none focus:border-[#4b4c99]"
          />

          <button
            onClick={verificarMaquina}
            style={{ backgroundColor: '#4b4c99' }}
            className="w-full py-3 text-white font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer shadow-sm"
          >
            Habilitar Cabina en este Equipo
          </button>
        </div>
      </div>
    )
  }

  // PANTALLA 2: Voto emitido con éxito + Descarga de Certificado Credencial
  if (votoProcesado) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <h2 className="text-lg font-bold text-slate-900">¡Sufragio Registrado Exitosamente!</h2>
          <p className="text-xs text-slate-600">Tu voto se ha depositado de manera anónima y secreta en la urna digital.</p>

          <div className="p-4 bg-slate-50 rounded-2xl border text-xs font-mono text-left space-y-1">
            <p><strong>Estudiante:</strong> {certificadoActual?.estudiante}</p>
            <p><strong>Formato Credencial:</strong> 7.5 cm × 5.0 cm (Horizontal)</p>
            <p><strong>Código de Validación:</strong> {certificadoActual?.codigo}</p>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              onClick={imprimirCertificado}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Descargar Certificado</span>
            </button>
            <button
              onClick={reiniciarParaSiguiente}
              style={{ backgroundColor: '#4b4c99' }}
              className="flex-1 py-3 text-white font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer shadow-sm"
            >
              Siguiente Alumno →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PANTALLA 3: Padrón y Papeleta Digital con Fotografías
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans selection:bg-[#4b4c99] selection:text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ENCABEZADO CABINA */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex justify-between items-center shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-indigo-700 uppercase">{mesaAutenticada.nombre_mesa}</span>
            <h1 className="text-lg font-bold text-slate-900">{mesaAutenticada.elecciones.titulo}</h1>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 px-3 py-1 rounded-xl text-slate-600">
            {mesaAutenticada.identificador_maquina}
          </span>
        </div>

        {/* 1. SELECCIÓN DE ESTUDIANTE */}
        {!estudianteSeleccionado ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4 max-w-2xl mx-auto">
            <h2 className="text-sm font-bold uppercase text-slate-800">Paso 1: Localizar al Estudiante en el Padrón</h2>
            <input
              type="text"
              placeholder="Buscar por Apellidos, Nombres o Cédula..."
              value={busqueda}
              onChange={e => handleBuscarEstudiantes(e.target.value)}
              className="w-full p-3.5 border border-slate-300 rounded-2xl text-xs font-semibold outline-none focus:border-[#4b4c99]"
            />

            {estudiantesCoincidentes.length > 0 && (
              <div className="divide-y divide-slate-100 border rounded-2xl overflow-hidden">
                {estudiantesCoincidentes.map(est => (
                  <div
                    key={est.id}
                    onClick={() => seleccionarEstudiante(est)}
                    className="p-3.5 hover:bg-indigo-50/60 transition cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <strong className="text-xs text-slate-900 block">{est.apellidos} {est.nombres}</strong>
                      <span className="text-[11px] text-slate-500">{est.grado_curso} "{est.paralelo}" • CI: {est.cedula || 'S/N'}</span>
                    </div>
                    <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1 rounded-xl border border-indigo-200">
                      Habilitar Voto →
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 2. PAPELETA ELECTRÓNICA CON FOTOGRAFÍAS */
          <div className="space-y-6">
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-indigo-700">Estudiante frente a la cabina:</span>
                <p className="text-xs font-bold text-indigo-950">
                  {estudianteSeleccionado.apellidos} {estudianteSeleccionado.nombres} ({estudianteSeleccionado.grado_curso} "{estudianteSeleccionado.paralelo}")
                </p>
              </div>
              <button onClick={() => setEstudianteSeleccionado(null)} className="text-xs text-rose-600 font-bold hover:underline cursor-pointer">
                Cambiar Estudiante
              </button>
            </div>

            <div className="text-center">
              <h2 className="text-lg font-black text-slate-900 uppercase">Papeleta Electoral Digital</h2>
              <p className="text-xs text-slate-500 font-semibold">Toca o haz clic sobre la lista o la opción por la que deseas votar</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {listas.map(lista => {
                const candidatos = lista.elecciones_candidatos || []
                return (
                  <div
                    key={lista.id}
                    className="bg-white rounded-3xl border-2 border-slate-200 hover:border-[#4b4c99] hover:shadow-xl transition flex flex-col justify-between overflow-hidden"
                  >
                    {/* ENCABEZADO DE LISTA */}
                    <div style={{ backgroundColor: lista.color_hex }} className="p-4 text-white flex justify-between items-center">
                      <span className="text-base font-black uppercase tracking-wider">{lista.numero_lista}</span>
                      <h3 className="font-bold text-sm tracking-tight">{lista.nombre_lista}</h3>
                    </div>

                    {/* DIRECTIVA CON FOTOS */}
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {candidatos.map((cand: any) => (
                          <div key={cand.id} className="p-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 text-center flex flex-col items-center">
                            <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden mb-2 border border-slate-300">
                              {cand.foto_url ? (
                                <img src={cand.foto_url} alt={cand.nombres_apellidos} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                                  Sin foto
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-indigo-800 uppercase block line-clamp-1">{cand.cargo}</span>
                            <span className="text-[11px] font-semibold text-slate-900 block line-clamp-2 leading-tight">{cand.nombres_apellidos}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* BOTÓN SUFRAGAR */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <button
                        onClick={() => solicitarConfirmacionVoto(lista.id, `${lista.numero_lista} - ${lista.nombre_lista}`, lista.color_hex)}
                        style={{ backgroundColor: lista.color_hex }}
                        className="w-full py-3 text-white font-bold text-xs rounded-xl shadow-sm hover:opacity-95 transition cursor-pointer"
                      >
                        Votar por {lista.numero_lista}
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* OPCIONES BLANCO Y NULO */}
              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-6 flex flex-col justify-between space-y-4 text-center">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Opción Democrática</span>
                  <h3 className="text-base font-bold text-slate-700 mt-1">Voto en Blanco</h3>
                  <p className="text-xs text-slate-400 mt-1">No respaldar a ninguna lista candidata.</p>
                </div>
                <button
                  onClick={() => solicitarConfirmacionVoto('BLANCO', 'Voto en Blanco', '#64748b')}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Votar en Blanco
                </button>
              </div>

              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-6 flex flex-col justify-between space-y-4 text-center">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Opción Democrática</span>
                  <h3 className="text-base font-bold text-slate-700 mt-1">Anular el Voto</h3>
                  <p className="text-xs text-slate-400 mt-1">Invalidar voluntariamente el sufragio.</p>
                </div>
                <button
                  onClick={() => solicitarConfirmacionVoto('NULO', 'Voto Nulo', '#e11d48')}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer border border-rose-200"
                >
                  Votar Nulo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CONFIRMACIÓN DE VOTO                                            */}
      {/* ========================================================================= */}
      {modalConfirmacion.abierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-center mx-auto text-[#4b4c99]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19h14M8 19v2m8-2v2" />
              </svg>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Confirmación de Sufragio
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Estás a punto de emitir tu voto por:
              </p>
              <div 
                style={{ borderColor: modalConfirmacion.color }}
                className="mt-2.5 p-3 rounded-2xl bg-slate-50 border-2 font-bold text-xs text-slate-900"
              >
                {modalConfirmacion.nombreOpcion}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Haz clic en <strong>"Continuar"</strong> para confirmar y depositar tu voto en la urna, o en <strong>"Cancelar"</strong> para volver a la papeleta[cite: 3, 4].
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={guardandoVoto}
                onClick={() => setModalConfirmacion({ abierto: false, opcionId: '', nombreOpcion: '' })}
                className="w-full py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoVoto}
                onClick={ejecutarEmisionVoto}
                style={{ backgroundColor: '#4b4c99' }}
                className="w-full py-2.5 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {guardandoVoto ? 'Emitiendo...' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADVERTENCIA "EL ESTUDIANTE YA VOTÓ" (ESTILO DE LA IMAGEN)        */}
      {/* ========================================================================= */}
      {modalYaVoto.abierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-7 text-center space-y-4 shadow-2xl border border-slate-200">
            
            {/* Ícono Ilustrativo de Documento / Lupa de la Imagen */}
            <div className="w-16 h-16 rounded-2xl bg-indigo-50/70 border border-indigo-100/80 flex items-center justify-center mx-auto text-[#4b4c99]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 21l-3.5-3.5m0 0a5 5 0 10-7.072-7.072 5 5 0 007.072 7.072z" />
              </svg>
            </div>

            {/* Título de Alerta */}
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Sufragio Ya Registrado
              </h3>
              
              {/* Contenedor del Estudiante */}
              <div className="my-2.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/80 font-bold text-xs text-amber-950">
                {modalYaVoto.estudiante}
              </div>

              {/* Mensaje descriptivo con hora exacta */}
              <p className="text-xs text-slate-500 leading-relaxed">
                Este estudiante <strong>ya ejerció su derecho al voto</strong> en el sistema a las <span className="font-mono font-bold text-[#4b4c99]">{modalYaVoto.hora}</span>.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                El padrón electoral digital impide duplicar votos para garantizar la transparencia del proceso.
              </p>
            </div>

            {/* Botón de cierre con el color institucional */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setModalYaVoto({ abierto: false, estudiante: '', hora: '' })}
                style={{ backgroundColor: '#4b4c99' }}
                className="w-full py-3 text-white font-bold text-xs rounded-xl hover:opacity-90 shadow-sm transition cursor-pointer"
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}