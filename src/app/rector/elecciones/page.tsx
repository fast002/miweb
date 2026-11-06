'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Candidato {
  id?: string
  cargo: string
  nombres_apellidos: string
  foto_url?: string
}

interface ModalInfo {
  abierto: boolean
  titulo: string
  mensaje: string
  tipo: 'alerta' | 'confirmar'
  onConfirmar?: () => void
  textoBotonConfirmar?: string
}

export default function EleccionesRectorPage() {
  const [cargando, setCargando] = useState(true)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('UNIDAD EDUCATIVA')
  const [logoInstitucion, setLogoInstitucion] = useState('')
  const [anioActivo, setAnioActivo] = useState('')
  const [eleccion, setEleccion] = useState<any>(null)
  const [listas, setListas] = useState<any[]>([])
  const [mesas, setMesas] = useState<any[]>([])
  const [resultados, setResultados] = useState<{ [opcion: string]: number }>({})
  const [totalPadron, setTotalPadron] = useState(0)
  const [totalVotantes, setTotalVotantes] = useState(0)

  // Modal Flotante Unificado (Estilo Imagen Referencia)
  const [modalAviso, setModalAviso] = useState<ModalInfo>({
    abierto: false,
    titulo: '',
    mensaje: '',
    tipo: 'alerta'
  })

  // Modales funcionales
  const [modalLista, setModalLista] = useState(false)
  const [nombreLista, setNombreLista] = useState('')
  const [numLista, setNumLista] = useState('')
  const [presidente, setPresidente] = useState('')
  const [colorHex, setColorHex] = useState('#4b4c99')

  const [listaSeleccionada, setListaSeleccionada] = useState<any>(null)
  const [candidatosLista, setCandidatosLista] = useState<Candidato[]>([])
  const [nuevoCargo, setNuevoCargo] = useState('Presidente/a')
  const [nuevoNombreCandidato, setNuevoNombreCandidato] = useState('')
  const [archivoFoto, setArchivoFoto] = useState<File | null>(null)

  const [modalMesa, setModalMesa] = useState(false)
  const [nombreMesa, setNombreMesa] = useState('Mesa 01 - Laboratorio')

  const [modalCertificados, setModalCertificados] = useState(false)
  const [busquedaCertificado, setBusquedaCertificado] = useState('')
  const [cargandoPadronCertificados, setCargandoPadronCertificados] = useState(false)
  const [padronVotantes, setPadronVotantes] = useState<any[]>([])

  const mostrarAlerta = (titulo: string, mensaje: string) => {
    setModalAviso({
      abierto: true,
      titulo,
      mensaje,
      tipo: 'alerta'
    })
  }

  const mostrarConfirmacion = (titulo: string, mensaje: string, onConfirmar: () => void, textoBoton = 'Continuar') => {
    setModalAviso({
      abierto: true,
      titulo,
      mensaje,
      tipo: 'confirmar',
      onConfirmar,
      textoBotonConfirmar: textoBoton
    })
  }

  useEffect(() => {
    cargarContexto()
  }, [])

  const cargarContexto = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: doc } = await supabase
        .from('docentes')
        .select('institucion_id, instituciones(nombre_institucion, logo_url, anio_lectivo_activo)')
        .eq('id', user.id)
        .maybeSingle()

      if (!doc) return
      const instId = doc.institucion_id
      const instData: any = doc.instituciones
      const anio = instData?.anio_lectivo_activo || '2026-2027'
      
      setInstitucionId(instId)
      setNombreInstitucion(instData?.nombre_institucion || 'UNIDAD EDUCATIVA')
      setLogoInstitucion(instData?.logo_url || '')
      setAnioActivo(anio)

      // FIX PERSISTENCIA: Buscar la elección existente sin romper con maybeSingle
      const { data: eleccionesExistentes } = await supabase
        .from('elecciones')
        .select('*')
        .eq('institucion_id', instId)
        .eq('anio_lectivo', anio)
        .order('created_at', { ascending: false })
        .limit(1)

      let elec = eleccionesExistentes && eleccionesExistentes.length > 0 ? eleccionesExistentes[0] : null

      if (!elec) {
        const { data: nuevaElec, error: errNueva } = await supabase
          .from('elecciones')
          .insert({
            institucion_id: instId,
            anio_lectivo: anio,
            titulo: `Elección de Consejo Estudiantil ${anio}`,
            estado: 'configuracion'
          })
          .select()
          .single()

        if (errNueva) throw errNueva
        elec = nuevaElec
      }

      setEleccion(elec)
      if (elec) {
        await cargarDatosEleccion(elec.id)
      }
    } catch (err: any) {
      console.error('Error al inicializar módulo de elecciones:', err)
      mostrarAlerta('Error de Inicialización', err.message || 'No se pudo cargar la elección.')
    } finally {
      setCargando(false)
    }
  }

  const cargarDatosEleccion = async (eleccionId: string) => {
    try {
      // 1. Listas
      const { data: lis } = await supabase
        .from('elecciones_listas')
        .select('*, elecciones_candidatos(*)')
        .eq('eleccion_id', eleccionId)
        .order('numero_lista', { ascending: true })
      setListas(lis || [])

      // 2. Mesas
      const { data: mes } = await supabase
        .from('elecciones_mesas')
        .select('*')
        .eq('eleccion_id', eleccionId)
        .order('created_at', { ascending: true })
      setMesas(mes || [])

      // 3. Padrón
      const { count: cPadron } = await supabase
        .from('elecciones_padron')
        .select('id', { count: 'exact', head: true })
        .eq('eleccion_id', eleccionId)

      const { count: cVotos } = await supabase
        .from('elecciones_padron')
        .select('id', { count: 'exact', head: true })
        .eq('eleccion_id', eleccionId)
        .eq('ya_voto', true)

      setTotalPadron(cPadron || 0)
      setTotalVotantes(cVotos || 0)

      // 4. Resultados de Votos
      const { data: votos } = await supabase
        .from('elecciones_votos')
        .select('opcion_voto')
        .eq('eleccion_id', eleccionId)

      const mapa: { [key: string]: number } = { BLANCO: 0, NULO: 0 }
      ;(lis || []).forEach((l: any) => { mapa[l.id] = 0 })
      ;(votos || []).forEach((v: any) => {
        mapa[v.opcion_voto] = (mapa[v.opcion_voto] || 0) + 1
      })
      setResultados(mapa)
    } catch (e: any) {
      console.error('Error cargando datos de la elección:', e)
    }
  }

  const sincronizarPadron = async () => {
    mostrarConfirmacion(
      'Sincronizar Padrón Electoral',
      '¿Deseas poblar el padrón con todos los estudiantes activos del año lectivo? Los que ya estén inscritos conservarán su estado.',
      async () => {
        setModalAviso(prev => ({ ...prev, abierto: false }))
        try {
          setCargando(true)
          const { data: ests } = await supabase
            .from('estudiantes')
            .select('id')
            .eq('institucion_id', institucionId)
            .eq('estado', 'activo')
            .eq('anio_lectivo', anioActivo)

          if (!ests || ests.length === 0) {
            mostrarAlerta('Sin Estudiantes', 'No se encontraron estudiantes matriculados en estado activo para este periodo.')
            return
          }

          const rows = ests.map(e => ({
            eleccion_id: eleccion.id,
            estudiante_id: e.id,
            ya_voto: false
          }))

          const { error } = await supabase
            .from('elecciones_padron')
            .upsert(rows, { onConflict: 'eleccion_id, estudiante_id' })

          if (error) throw error
          await cargarDatosEleccion(eleccion.id)
          mostrarAlerta('Padrón Actualizado', `Se han sincronizado ${rows.length} estudiantes correctamente al padrón electoral.`)
        } catch (e: any) {
          mostrarAlerta('Error de Sincronización', e.message)
        } finally {
          setCargando(false)
        }
      }
    )
  }

  const guardarLista = async () => {
    if (!nombreLista.trim() || !numLista.trim()) {
      mostrarAlerta('Campos Requeridos', 'Por favor llena el número y el nombre de la lista.')
      return
    }

    try {
      const { data: listaInsertada, error } = await supabase
        .from('elecciones_listas')
        .insert({
          eleccion_id: eleccion.id,
          numero_lista: numLista.trim(),
          nombre_lista: nombreLista.trim(),
          candidato_presidente: presidente.trim(),
          color_hex: colorHex
        })
        .select()
        .single()

      if (error) throw error

      if (presidente.trim() && listaInsertada) {
        await supabase.from('elecciones_candidatos').insert({
          lista_id: listaInsertada.id,
          cargo: 'Presidente/a',
          nombres_apellidos: presidente.trim(),
          orden: 1
        })
      }

      setModalLista(false)
      setNombreLista('')
      setNumLista('')
      setPresidente('')
      await cargarDatosEleccion(eleccion.id)
      mostrarAlerta('Lista Registrada', 'La lista candidata ha sido inscrita satisfactoriamente.')
    } catch (e: any) {
      mostrarAlerta('Error al Registrar', e.message)
    }
  }

  const abrirGestionCandidatos = async (lista: any) => {
    setListaSeleccionada(lista)
    const { data } = await supabase
      .from('elecciones_candidatos')
      .select('*')
      .eq('lista_id', lista.id)
      .order('orden', { ascending: true })

    setCandidatosLista(data || [])
    setNuevoCargo('Presidente/a')
    setNuevoNombreCandidato('')
    setArchivoFoto(null)
  }

  const agregarCandidato = async () => {
    if (!nuevoNombreCandidato.trim() || !listaSeleccionada) return
    setSubiendoFoto(true)
    try {
      let fotoUrlFinal = ''

      if (archivoFoto) {
        const fileExt = archivoFoto.name.split('.').pop()
        const fileName = `candidato_${listaSeleccionada.id}_${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('elecciones')
          .upload(filePath, archivoFoto, { upsert: true })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('elecciones')
          .getPublicUrl(filePath)

        fotoUrlFinal = urlData.publicUrl
      }

      const { data: nuevo, error } = await supabase
        .from('elecciones_candidatos')
        .insert({
          lista_id: listaSeleccionada.id,
          cargo: nuevoCargo,
          nombres_apellidos: nuevoNombreCandidato.trim(),
          foto_url: fotoUrlFinal,
          orden: candidatosLista.length + 1
        })
        .select()
        .single()

      if (error) throw error

      setCandidatosLista(prev => [...prev, nuevo])
      setNuevoNombreCandidato('')
      setArchivoFoto(null)
      await cargarDatosEleccion(eleccion.id)
    } catch (err: any) {
      mostrarAlerta('Error al Subir', err.message)
    } finally {
      setSubiendoFoto(false)
    }
  }

  const eliminarCandidato = (id: string) => {
    mostrarConfirmacion(
      'Retirar Candidato',
      '¿Estás seguro de que deseas eliminar este integrante de la lista electoral?',
      async () => {
        setModalAviso(prev => ({ ...prev, abierto: false }))
        try {
          const { error } = await supabase.from('elecciones_candidatos').delete().eq('id', id)
          if (error) throw error
          setCandidatosLista(prev => prev.filter(c => c.id !== id))
          await cargarDatosEleccion(eleccion.id)
        } catch (err: any) {
          mostrarAlerta('Error al Eliminar', err.message)
        }
      }
    )
  }

  const crearMesa = async () => {
    if (!nombreMesa.trim()) return
    const idGenerado = `MESA-${mesas.length + 1}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    try {
      const { error } = await supabase.from('elecciones_mesas').insert({
        eleccion_id: eleccion.id,
        nombre_mesa: nombreMesa.trim(),
        identificador_maquina: idGenerado
      })
      if (error) throw error
      setModalMesa(false)
      await cargarDatosEleccion(eleccion.id)
      mostrarAlerta('Máquina Habilitada', `Se generó el identificador ${idGenerado} con éxito.`)
    } catch (e: any) {
      mostrarAlerta('Error al Crear Máquina', e.message)
    }
  }

  const cambiarEstadoEleccion = (nuevoEstado: string) => {
    const accion = nuevoEstado === 'activa' ? 'iniciar la votación oficial' : 'cerrar definitivamente el sufragio'
    mostrarConfirmacion(
      'Cambio de Estado Electoral',
      `¿Deseas ${accion}? Las cabinas de sufragio se adaptarán inmediatamente.`,
      async () => {
        setModalAviso(prev => ({ ...prev, abierto: false }))
        try {
          const { error } = await supabase
            .from('elecciones')
            .update({ estado: nuevoEstado })
            .eq('id', eleccion.id)

          if (error) throw error
          setEleccion({ ...eleccion, estado: nuevoEstado })
        } catch (e: any) {
          mostrarAlerta('Error de Cambio de Estado', e.message)
        }
      }
    )
  }

  const imprimirActaResultados = async () => {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF('p', 'mm', 'a4')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('ACTA OFICIAL DE ESCRUTINIO ELECTORAL', 105, 16, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${eleccion?.titulo || 'Elección Consejo Estudiantil'} • Periodo: ${anioActivo}`, 105, 21, { align: 'center' })

    const totalEmitidos = Object.values(resultados).reduce((a, b) => a + b, 0)
    const filas = listas.map(l => {
      const votos = resultados[l.id] || 0
      const porc = totalEmitidos > 0 ? ((votos / totalEmitidos) * 100).toFixed(2) : '0.00'
      return [l.numero_lista, l.nombre_lista, l.candidato_presidente, String(votos), `${porc}%`]
    })

    filas.push(['-', 'VOTOS BLANCOS', 'N/A', String(resultados['BLANCO'] || 0), totalEmitidos > 0 ? (((resultados['BLANCO'] || 0) / totalEmitidos) * 100).toFixed(2) + '%' : '0.00%'])
    filas.push(['-', 'VOTOS NULOS', 'N/A', String(resultados['NULO'] || 0), totalEmitidos > 0 ? (((resultados['NULO'] || 0) / totalEmitidos) * 100).toFixed(2) + '%' : '0.00%'])

    autoTable(doc, {
      startY: 28,
      theme: 'grid',
      head: [['Lista', 'Nombre de la Lista', 'Candidato Presidencial', 'Votos Obtenidos', 'Porcentaje']],
      body: filas,
      headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
      styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
      columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 16
    doc.setFontSize(8)
    doc.text(`Total Padrón Electoral: ${totalPadron} alumnos`, 14, finalY)
    doc.text(`Total Sufragantes que acudieron: ${totalVotantes} (${totalPadron > 0 ? ((totalVotantes / totalPadron) * 100).toFixed(2) : 0}%)`, 14, finalY + 5)
    doc.text(`Ausentismo: ${totalPadron - totalVotantes}`, 14, finalY + 10)

    doc.line(30, finalY + 30, 80, finalY + 30)
    doc.text('Rector(a) / Presidente Tribunal', 55, finalY + 34, { align: 'center' })

    doc.line(130, finalY + 30, 180, finalY + 30)
    doc.text('Secretario(a) del Tribunal', 155, finalY + 34, { align: 'center' })

    doc.save(`Acta_Final_Escrutinio_${anioActivo}.pdf`)
  }

  // Consulta y Reimpresión de Certificados
  const abrirModalCertificados = async () => {
    setModalCertificados(true)
    if (!eleccion) return
    setCargandoPadronCertificados(true)

    try {
      const { data, error } = await supabase
        .from('elecciones_padron')
        .select(`
          id,
          ya_voto,
          fecha_voto,
          codigo_certificado,
          mesa_id,
          estudiantes (
            id,
            apellidos,
            nombres,
            cedula,
            grado_curso,
            paralelo
          ),
          elecciones_mesas (
            nombre_mesa
          )
        `)
        .eq('eleccion_id', eleccion.id)
        .order('ya_voto', { ascending: false })

      if (error) throw error
      setPadronVotantes(data || [])
    } catch (err: any) {
      mostrarAlerta('Error de Carga', err.message)
    } finally {
      setCargandoPadronCertificados(false)
    }
  }

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

  const reimprimirCertificadoIndividual = async (registro: any) => {
    const est = registro.estudiantes
    const mesa = registro.elecciones_mesas?.nombre_mesa || 'Mesa Electoral'
    const fechaStr = registro.fecha_voto 
      ? new Date(registro.fecha_voto).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
      : new Date().toLocaleDateString('es-EC')
    const codigo = registro.codigo_certificado || `CERT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({
      orientation: 'l',
      unit: 'mm',
      format: [75, 50]
    })

    doc.setDrawColor(75, 76, 153)
    doc.setLineWidth(0.4)
    doc.rect(2, 2, 71, 46)

    if (logoInstitucion) {
      const logoB64 = await convertirImagenBase64(logoInstitucion)
      if (logoB64) {
        doc.addImage(logoB64 as string, 'PNG', 3.5, 3.5, 7.5, 7.5)
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(30, 41, 59)
    doc.text(nombreInstitucion.toUpperCase(), 40, 5.5, { align: 'center', maxWidth: 55 })

    doc.setFontSize(4.5)
    doc.setTextColor(75, 76, 153)
    doc.text('TRIBUNAL ELECTORAL ESTUDIANTIL', 40, 8.5, { align: 'center' })

    doc.setFontSize(6)
    doc.setTextColor(0, 0, 0)
    doc.text('CERTIFICADO DE VOTACIÓN (DUPLICADO)', 40, 12, { align: 'center' })

    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.2)
    doc.line(4, 13.5, 71, 13.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.2)
    doc.setTextColor(71, 85, 105)
    doc.text('Estudiante:', 4, 16.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.2)
    doc.setTextColor(15, 23, 42)
    doc.text(`${est.apellidos} ${est.nombres}`, 18, 16.5, { maxWidth: 52 })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.2)
    doc.setTextColor(71, 85, 105)
    doc.text('C.I. / Matrícula:', 4, 20.5)
    doc.text('Curso / Paralelo:', 4, 24)
    doc.text('Terminal / Mesa:', 4, 27.5)
    doc.text('Fecha / Emisión:', 4, 31)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(est.cedula || 'S/N', 22, 20.5)
    doc.text(`${est.grado_curso} "${est.paralelo}"`, 22, 24)
    doc.text(mesa, 22, 27.5)
    doc.text(fechaStr, 22, 31)

    doc.line(10, 39, 36, 39)
    doc.setFontSize(3.8)
    doc.setFont('helvetica', 'normal')
    doc.text('Presidente(a) de Mesa', 23, 41.5, { align: 'center' })

    doc.line(42, 39, 68, 39)
    doc.text('Rectorado / Tribunal', 55, 41.5, { align: 'center' })

    doc.setFont('courier', 'bold')
    doc.setFontSize(4.2)
    doc.setTextColor(75, 76, 153)
    doc.text(`VALIDACIÓN: ${codigo}`, 37.5, 45.5, { align: 'center' })

    doc.save(`Certificado_${est.apellidos.replace(/\s+/g, '_')}_${est.nombres.replace(/\s+/g, '_')}.pdf`)
  }

  const votantesFiltrados = padronVotantes.filter(p => {
    const est = p.estudiantes
    if (!est) return false
    const matchTxt = `${est.apellidos} ${est.nombres} ${est.cedula || ''}`.toLowerCase()
    return matchTxt.includes(busquedaCertificado.toLowerCase())
  })

  if (cargando) return <div className="p-8 text-center text-xs font-bold text-slate-500">Cargando Centro Electoral...</div>

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans selection:bg-[#4b4c99] selection:text-white">
      
      {/* CABECERA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-bold px-3 py-1 rounded-xl uppercase tracking-wider bg-indigo-50 text-[#4b4c99] border border-indigo-200 inline-block mb-1">
            Menú Rectoral • Tribunal Electoral Institucional
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">{eleccion?.titulo}</h1>
          <p className="text-xs text-slate-500 font-semibold">Estado actual: <strong className="uppercase text-[#4b4c99]">{eleccion?.estado}</strong></p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {eleccion?.estado === 'configuracion' && (
            <button
              onClick={() => cambiarEstadoEleccion('activa')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
            >
              ▶ Iniciar Votaciones
            </button>
          )}

          {eleccion?.estado === 'activa' && (
            <button
              onClick={() => cambiarEstadoEleccion('cerrada')}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
            >
              ⏹ Finalizar y Cerrar Elecciones
            </button>
          )}

          <button
            onClick={abrirModalCertificados}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-[#4b4c99] border border-indigo-200 font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Certificados de Votación</span>
          </button>

          <button
            onClick={imprimirActaResultados}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-4 py-2.5 hover:opacity-90 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
          >
            Descargar Acta Final (PDF)
          </button>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total Padrón Estudiantil</span>
          <div className="flex justify-between items-baseline mt-1">
            <span className="text-2xl font-black text-slate-900">{totalPadron}</span>
            <button onClick={sincronizarPadron} className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">Sincronizar Alumnos</button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Votos Registrados en Urna</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{totalVotantes}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Porcentaje de Participación</span>
          <p className="text-2xl font-black text-[#4b4c99] mt-1">
            {totalPadron > 0 ? ((totalVotantes / totalPadron) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* TERMINALES / MESAS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase text-slate-800">Terminales Receptoras del Voto ({mesas.length} máquinas autorizadas)</h2>
            <p className="text-[11px] text-slate-500">Usa este identificador en cada máquina para acceder a la cabina de votación secreta.</p>
          </div>
          <button
            onClick={() => setModalMesa(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
          >
            + Autorizar Nueva Máquina
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mesas.map(m => (
            <div key={m.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <strong className="block text-xs font-bold text-slate-900">{m.nombre_mesa}</strong>
                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 mt-1 inline-block">
                  {m.identificador_maquina}
                </span>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${m.activa ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {m.activa ? 'Habilitada' : 'Inactiva'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* LISTAS CANDIDATAS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase text-slate-800">Listas Candidatas y Conteo en Vivo</h2>
            <p className="text-[11px] text-slate-500">Administra los candidatos, dignidades y fotos de cada lista participante.</p>
          </div>
          <button
            onClick={() => setModalLista(true)}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#4b4c99] border border-indigo-200 font-bold text-xs rounded-xl cursor-pointer"
          >
            + Inscribir Lista
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listas.map(l => {
            const v = resultados[l.id] || 0
            const porc = totalVotantes > 0 ? ((v / totalVotantes) * 100).toFixed(1) : 0
            const candidatos = l.elecciones_candidatos || []

            return (
              <div key={l.id} className="p-5 rounded-3xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span style={{ backgroundColor: l.color_hex }} className="text-white text-xs font-black px-2.5 py-1 rounded-xl">
                      {l.numero_lista}
                    </span>
                    <span className="text-base font-black text-slate-900">{v} votos ({porc}%)</span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{l.nombre_lista}</h3>
                    <p className="text-xs text-slate-500 font-medium">Presidente/a: <strong>{l.candidato_presidente}</strong></p>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                      Directiva ({candidatos.length} miembros inscritos):
                    </span>
                    <div className="flex items-center -space-x-2 overflow-hidden mb-2">
                      {candidatos.slice(0, 5).map((cand: any) => (
                        <div key={cand.id} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shrink-0" title={`${cand.cargo}: ${cand.nombres_apellidos}`}>
                          {cand.foto_url ? (
                            <img src={cand.foto_url} alt={cand.nombres_apellidos} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-600 bg-slate-300">
                              {cand.nombres_apellidos.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                      ))}
                      {candidatos.length > 5 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                          +{candidatos.length - 5}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div style={{ width: `${porc}%`, backgroundColor: l.color_hex }} className="h-full rounded-full transition-all duration-500"></div>
                  </div>
                </div>

                <button
                  onClick={() => abrirGestionCandidatos(l)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-center"
                >
                  Gestionar Candidatos y Fotos →
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE CONSULTA Y REIMPRESIÓN DE CERTIFICADOS DE VOTACIÓN               */}
      {/* ========================================================================= */}
      {modalCertificados && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-indigo-50 text-[#4b4c99] uppercase tracking-wider">
                  Reimpresión Oficial de Documentos
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-1">
                  Certificados de Votación Emitidos ({padronVotantes.filter(p => p.ya_voto).length} sufragantes)
                </h2>
              </div>
              <button 
                onClick={() => setModalCertificados(false)} 
                className="text-slate-400 font-bold hover:text-slate-600 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar estudiante por apellidos, nombres o número de cédula..."
                value={busquedaCertificado}
                onChange={e => setBusquedaCertificado(e.target.value)}
                className="flex-1 p-3 border border-slate-300 rounded-2xl text-xs font-semibold outline-none focus:border-[#4b4c99]"
              />
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl">
              {cargandoPadronCertificados ? (
                <div className="p-8 text-center text-xs font-bold text-slate-500">Consultando padrón electoral...</div>
              ) : votantesFiltrados.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">No se encontraron estudiantes con ese criterio.</div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                    <tr>
                      <th className="p-3">Estudiante</th>
                      <th className="p-3">Curso / Paralelo</th>
                      <th className="p-3">Identificación</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3">Código Validación</th>
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {votantesFiltrados.map((item) => {
                      const est = item.estudiantes
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-bold text-slate-900">
                            {est.apellidos} {est.nombres}
                          </td>
                          <td className="p-3 text-slate-600">
                            {est.grado_curso} "{est.paralelo}"
                          </td>
                          <td className="p-3 font-mono text-slate-500">
                            {est.cedula || 'S/N'}
                          </td>
                          <td className="p-3 text-center">
                            {item.ya_voto ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Sufragó
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-indigo-700 font-bold text-[11px]">
                            {item.codigo_certificado || '---'}
                          </td>
                          <td className="p-3 text-center">
                            {item.ya_voto ? (
                              <button
                                onClick={() => reimprimirCertificadoIndividual(item)}
                                className="px-3 py-1.5 bg-[#4b4c99] hover:opacity-90 text-white font-bold text-[11px] rounded-xl transition cursor-pointer shadow-xs inline-flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Reimprimir PDF (7.5x5cm)</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No disponible</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t text-xs">
              <span className="text-slate-500">
                Los certificados se generan automáticamente en formato credencial apaisado de <strong>7.5 cm × 5.0 cm</strong> con el logo de {nombreInstitucion}.
              </span>
              <button
                onClick={() => setModalCertificados(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIÓN DE CANDIDATOS */}
      {listaSeleccionada && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span style={{ backgroundColor: listaSeleccionada.color_hex }} className="text-white text-[10px] font-black px-2 py-0.5 rounded-lg uppercase">
                  {listaSeleccionada.numero_lista}
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-1">{listaSeleccionada.nombre_lista} - Miembros y Fotografías</h2>
              </div>
              <button onClick={() => setListaSeleccionada(null)} className="text-slate-400 font-bold hover:text-slate-600 text-sm cursor-pointer">✕</button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase block">Agregar Nuevo Integrante a la Papeleta</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Dignidad / Cargo</label>
                  <select value={nuevoCargo} onChange={e => setNuevoCargo(e.target.value)} className="w-full p-2.5 bg-white border rounded-xl font-semibold">
                    <option value="Presidente/a">Presidente/a</option>
                    <option value="Vicepresidente/a">Vicepresidente/a</option>
                    <option value="Secretario/a">Secretario/a</option>
                    <option value="Tesorero/a">Tesorero/a</option>
                    <option value="1er Vocal Principal">1er Vocal Principal</option>
                    <option value="2do Vocal Principal">2do Vocal Principal</option>
                    <option value="3er Vocal Principal">3er Vocal Principal</option>
                    <option value="1er Vocal Suplente">1er Vocal Suplente</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Nombres y Apellidos</label>
                  <input
                    type="text"
                    value={nuevoNombreCandidato}
                    onChange={e => setNuevoNombreCandidato(e.target.value)}
                    placeholder="Ej: David Castro"
                    className="w-full p-2.5 bg-white border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Fotografía del Candidato</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setArchivoFoto(e.target.files?.[0] || null)}
                    className="w-full text-[11px] p-1.5 bg-white border rounded-xl file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[#4b4c99] file:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  onClick={agregarCandidato}
                  disabled={subiendoFoto || !nuevoNombreCandidato.trim()}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-4 py-2 text-white font-bold text-xs rounded-xl disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {subiendoFoto ? 'Subiendo fotografía...' : '+ Guardar Candidato'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase block">Lista de Integrantes Inscritos ({candidatosLista.length})</span>
              {candidatosLista.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No hay candidatos registrados en esta lista todavía.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {candidatosLista.map(cand => (
                    <div key={cand.id} className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border overflow-hidden shrink-0">
                          {cand.foto_url ? (
                            <img src={cand.foto_url} alt={cand.nombres_apellidos} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                              Sin foto
                            </div>
                          )}
                        </div>
                        <div>
                          <strong className="block text-xs text-slate-900 font-bold">{cand.nombres_apellidos}</strong>
                          <span className="text-[11px] font-semibold text-[#4b4c99]">{cand.cargo}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => eliminarCandidato(cand.id!)}
                        className="text-rose-500 hover:text-rose-700 font-bold text-xs p-1 cursor-pointer"
                        title="Retirar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setListaSeleccionada(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSCRIBIR LISTA */}
      {modalLista && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-bold uppercase text-slate-900">Inscribir Lista Electoral</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Número / Identificador de Lista</label>
                <input value={numLista} onChange={e => setNumLista(e.target.value)} placeholder="Ej: Lista 1" className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Nombre del Movimiento o Lista</label>
                <input value={nombreLista} onChange={e => setNombreLista(e.target.value)} placeholder="Ej: Juventud en Acción" className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Candidato(a) a Presidente</label>
                <input value={presidente} onChange={e => setPresidente(e.target.value)} placeholder="Nombre del alumno..." className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Color Distintivo</label>
                <input type="color" value={colorHex} onChange={e => setColorHex(e.target.value)} className="w-full h-10 p-1 border rounded-xl cursor-pointer" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setModalLista(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button>
              <button onClick={guardarLista} style={{ backgroundColor: '#4b4c99' }} className="px-5 py-2 text-white rounded-xl font-bold text-xs cursor-pointer">Guardar Lista</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA MESA */}
      {modalMesa && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-bold uppercase text-slate-900">Autorizar Terminal de Votación</h2>
            <div className="space-y-3 text-xs">
              <label className="block font-bold text-slate-700 uppercase mb-1">Ubicación / Nombre del Equipo</label>
              <input value={nombreMesa} onChange={e => setNombreMesa(e.target.value)} placeholder="Ej: Máquina 03 - Biblioteca" className="w-full p-2.5 border rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setModalMesa(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button>
              <button onClick={crearMesa} style={{ backgroundColor: '#4b4c99' }} className="px-5 py-2 text-white rounded-xl font-bold text-xs cursor-pointer">Generar Identificador</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FLOTANTE DE MENSAJES Y ADVERTENCIAS (ESTILO IMAGEN DE REFERENCIA)  */}
      {/* ========================================================================= */}
      {modalAviso.abierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-7 text-center space-y-4 shadow-2xl border border-slate-200">
            
            {/* Ícono Ilustrativo Documento con Lupa */}
            <div className="w-16 h-16 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-center mx-auto text-[#4b4c99]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 21l-3.5-3.5m0 0a5 5 0 10-7.072-7.072 5 5 0 007.072 7.072z" />
              </svg>
            </div>

            {/* Textos */}
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {modalAviso.titulo}
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {modalAviso.mensaje}
              </p>
            </div>

            {/* Botones de Acción (Rojo Cancelar / Violeta Continuar) */}
            <div className="pt-2">
              {modalAviso.tipo === 'confirmar' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModalAviso(prev => ({ ...prev, abierto: false }))}
                    className="w-full py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={modalAviso.onConfirmar}
                    style={{ backgroundColor: '#4b4c99' }}
                    className="w-full py-2.5 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {modalAviso.textoBotonConfirmar || 'Continue'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalAviso(prev => ({ ...prev, abierto: false }))}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="w-full py-2.5 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Entendido
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}