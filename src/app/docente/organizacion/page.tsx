'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CroquisAulaPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [pestanaActiva, setPestanaActiva] = useState<'croquis' | 'aseo' | 'firmas'>('croquis')
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<1 | 2 | 3 | 4>(1)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('00H00000')
  const [logoUrl, setLogoUrl] = useState('')
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])

  const [jornadaActual, setJornadaActual] = useState('MATUTINA')
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')

  const [estudiantes, setEstudiantes] = useState<any[]>([])
  
  // 5 bancas: Col 0 a 3 tienen 8 puestos; Col 4 tiene 9 puestos
  const [distribucionAula, setDistribucionAula] = useState<{ [banca: number]: { [asiento: number]: string } }>({
    0: {}, 1: {}, 2: {}, 3: {}, 4: {}
  })

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: doc } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user.id).maybeSingle()
        
        let anioActivo = ''
        if (doc) {
          setInstitucionId(doc.institucion_id || '')
          const inst = doc.instituciones
          if (inst) {
            setNombreInstitucion(inst.nombre_institucion || 'Unidad Educativa')
            setCodigoAmie(inst.codigo_amie || '00H00000')
            setLogoUrl(inst.logo_url || '')
            anioActivo = inst.anio_lectivo_activo || (inst.periodos_disponibles?.[0] || '2026-2027')
            setAnioLectivoVigente(anioActivo)
          }
        }

        if (anioActivo) {
          const { data: asignacionesData } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asignacionesData && asignacionesData.length > 0) {
            setMisAsignaciones(asignacionesData)
            setJornadaActual(asignacionesData[0].jornada || 'MATUTINA')
            setGrado(asignacionesData[0].grado_curso)
            setParalelo(asignacionesData[0].paralelo)
          }
        }
      } catch (err) {
        console.error('Error al iniciar:', err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  useEffect(() => {
    async function cargarEstudiantesYCroquis() {
      if (!institucionId || !grado || !paralelo || !anioLectivoVigente) return

      try {
        const { data: estData } = await supabase
          .from('estudiantes')
          .select('*')
          .eq('institucion_id', institucionId)
          .eq('grado_curso', grado)
          .eq('paralelo', paralelo)
          .eq('jornada', jornadaActual)
          .eq('anio_lectivo', anioLectivoVigente)
          .eq('estado', 'activo')
          .order('apellidos', { ascending: true })

        const lista = estData || []
        setEstudiantes(lista)

        const savedCroquis = localStorage.getItem(`croquis_5col_${grado}_${paralelo}_${jornadaActual}_${anioLectivoVigente}`)
        if (savedCroquis) {
          setDistribucionAula(JSON.parse(savedCroquis))
        } else {
          setDistribucionAula({ 0: {}, 1: {}, 2: {}, 3: {}, 4: {} })
        }
      } catch (err) {
        console.error('Error al cargar datos del aula:', err)
      }
    }

    cargarEstudiantesYCroquis()
  }, [institucionId, grado, paralelo, jornadaActual, anioLectivoVigente])

  const handleAsignarEstudiante = (bancaIndex: number, asientoIndex: number, estudianteId: string) => {
    setDistribucionAula(prev => ({
      ...prev,
      [bancaIndex]: {
        ...prev[bancaIndex],
        [asientoIndex]: estudianteId
      }
    }))
  }

  const handleGuardarCroquis = () => {
    setGuardando(true)
    setMensaje(null)
    try {
      localStorage.setItem(
        `croquis_5col_${grado}_${paralelo}_${jornadaActual}_${anioLectivoVigente}`,
        JSON.stringify(distribucionAula)
      )
      setMensaje({ tipo: 'exito', texto: '¡Distribución del aula guardada correctamente!' })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + e.message })
    } finally {
      setGuardando(false)
    }
  }

  const obtenerRolesRotados = (listaEstudiantes: any[], semana: number) => {
    const total = listaEstudiantes.length
    if (total === 0) return { limpiezas: [], trapeadores: [], revisiones: [] }

    const shift = (semana - 1) % 3
    const rotados = [...listaEstudiantes.slice(shift), ...listaEstudiantes.slice(0, shift)]

    const limpiezas = rotados.slice(0, 3)
    const trapeadores = rotados.slice(3, 6)
    const revisiones = rotados.slice(6, total)

    return { limpiezas, trapeadores, revisiones }
  }

  const convertirLogoABase64 = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      return null
    }
  }

  const generarPdfCroquis = async () => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('l', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (logoUrl) logoBase64 = await convertirLogoABase64(logoUrl)

      doc.setLineWidth(0.4)
      doc.rect(14, 12, pageWidth - 28, 22)
      doc.line(45, 12, 45, 34)
      doc.line(pageWidth - 45, 12, pageWidth - 45, 34)

      if (logoBase64) doc.addImage(logoBase64 as string, 'PNG', 16, 13, 20, 20)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text((nombreInstitucion || 'UNIDAD EDUCATIVA').toUpperCase(), pageWidth / 2, 18, { align: 'center' })
      doc.setFontSize(8)
      doc.text(`CÓDIGO AMIE: ${codigoAmie || '00H00000'}`, pageWidth / 2, 24, { align: 'center' })
      doc.setTextColor(75, 76, 153)
      doc.text(`AÑO LECTIVO: ${anioLectivoVigente || '2026-2027'}`, pageWidth / 2, 30, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('CROQUIS DE AULA', pageWidth - 22, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`ORGANIZACIÓN DE ESTUDIANTES POR 5 BANCAS - ${grado} "${paralelo}" (${jornadaActual})`, pageWidth / 2, 41, { align: 'center' })

      const headers = ['Puesto', 'Banca 1', 'Banca 2', 'Banca 3', 'Banca 4', 'Banca 5 (9 puestos)']
      const filas = []

      for (let i = 0; i < 9; i++) {
        const puestoNum = i + 1
        const estB1 = i < 8 ? estudiantes.find(e => e.id === distribucionAula[0]?.[i]) : null
        const estB2 = i < 8 ? estudiantes.find(e => e.id === distribucionAula[1]?.[i]) : null
        const estB3 = i < 8 ? estudiantes.find(e => e.id === distribucionAula[2]?.[i]) : null
        const estB4 = i < 8 ? estudiantes.find(e => e.id === distribucionAula[3]?.[i]) : null
        const estB5 = estudiantes.find(e => e.id === distribucionAula[4]?.[i])

        filas.push([
          `Puesto ${puestoNum}`,
          estB1 ? `${estB1.apellidos} ${estB1.nombres}` : (i < 8 ? '(Vacante)' : '-'),
          estB2 ? `${estB2.apellidos} ${estB2.nombres}` : (i < 8 ? '(Vacante)' : '-'),
          estB3 ? `${estB3.apellidos} ${estB3.nombres}` : (i < 8 ? '(Vacante)' : '-'),
          estB4 ? `${estB4.apellidos} ${estB4.nombres}` : (i < 8 ? '(Vacante)' : '-'),
          estB5 ? `${estB5.apellidos} ${estB5.nombres}` : '(Vacante)'
        ])
      }

      autoTable(doc, {
        startY: 46,
        theme: 'grid',
        head: [headers],
        body: filas,
        headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 },
          4: { cellWidth: 50 },
          5: { cellWidth: 50 }
        }
      })

      doc.save(`Croquis_Aula_5Bancas_${grado}_${paralelo}_${jornadaActual}.pdf`)
    } catch (e: any) {
      console.error(e)
      alert('Error al generar PDF: ' + e.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  const generarPdfAseo = async () => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (logoUrl) logoBase64 = await convertirLogoABase64(logoUrl)

      doc.setLineWidth(0.4)
      doc.rect(14, 12, pageWidth - 28, 22)
      doc.line(45, 12, 45, 34)
      doc.line(pageWidth - 45, 12, pageWidth - 45, 34)

      if (logoBase64) doc.addImage(logoBase64 as string, 'PNG', 16, 13, 20, 20)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text((nombreInstitucion || 'UNIDAD EDUCATIVA').toUpperCase(), pageWidth / 2, 18, { align: 'center' })
      doc.setFontSize(8)
      doc.text(`CÓDIGO AMIE: ${codigoAmie || '00H00000'}`, pageWidth / 2, 24, { align: 'center' })
      doc.setTextColor(75, 76, 153)
      doc.text(`AÑO LECTIVO: ${anioLectivoVigente || '2026-2027'}`, pageWidth / 2, 30, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('COMISIÓN DE ASEO', pageWidth - 22, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`ROL DE ASEO - SEMANA ${semanaSeleccionada} - ${grado} "${paralelo}" (${jornadaActual})`, pageWidth / 2, 41, { align: 'center' })

      const dias = [
        { dia: 'LUNES', banca: 0 },
        { dia: 'MARTES', banca: 1 },
        { dia: 'MIÉRCOLES', banca: 2 },
        { dia: 'JUEVES', banca: 3 },
        { dia: 'VIERNES', banca: 4 },
      ]

      const filasAseo: any[] = []

      dias.forEach(({ dia, banca }) => {
        const idsBanca = Object.values(distribucionAula[banca] || {})
        const listaEstBanca = idsBanca.map(id => estudiantes.find(e => e.id === id)).filter(Boolean)
        const { limpiezas, trapeadores, revisiones } = obtenerRolesRotados(listaEstBanca, semanaSeleccionada)

        filasAseo.push([
          dia,
          `Banca ${banca + 1}`,
          limpiezas.map(e => `• ${e.apellidos} ${e.nombres}`).join('\n') || 'Sin asignar',
          trapeadores.map(e => `• ${e.apellidos} ${e.nombres}`).join('\n') || 'Sin asignar',
          revisiones.map(e => `• ${e.apellidos} ${e.nombres}`).join('\n') || 'Sin asignar'
        ])
      })

      autoTable(doc, {
        startY: 46,
        theme: 'grid',
        head: [['Día', 'Hilera Turno', 'Limpian (3)', 'Trapean (3)', 'Verifican Bancas (3)']],
        body: filasAseo,
        headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 7, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 },
          4: { cellWidth: 40 }
        }
      })

      doc.save(`Rol_Aseo_Semana_${semanaSeleccionada}_${grado}_${paralelo}_${jornadaActual}.pdf`)
    } catch (e: any) {
      console.error(e)
      alert('Error al generar PDF de aseo: ' + e.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  const generarPdfFirmas = async () => {
    setGenerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      let logoBase64 = null
      if (logoUrl) logoBase64 = await convertirLogoABase64(logoUrl)

      doc.setLineWidth(0.4)
      doc.rect(14, 12, pageWidth - 28, 22)
      doc.line(45, 12, 45, 34)
      doc.line(pageWidth - 45, 12, pageWidth - 45, 34)

      if (logoBase64) doc.addImage(logoBase64 as string, 'PNG', 16, 13, 20, 20)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text((nombreInstitucion || 'UNIDAD EDUCATIVA').toUpperCase(), pageWidth / 2, 18, { align: 'center' })
      doc.setFontSize(8)
      doc.text(`CÓDIGO AMIE: ${codigoAmie || '00H00000'}`, pageWidth / 2, 24, { align: 'center' })
      doc.setTextColor(75, 76, 153)
      doc.text(`AÑO LECTIVO: ${anioLectivoVigente || '2026-2027'}`, pageWidth / 2, 30, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('CONTROL DE FIRMAS', pageWidth - 22, 22, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`REGISTRO DE FIRMAS DE CUMPLIMIENTO - SEMANA ${semanaSeleccionada} - ${grado} "${paralelo}" (${jornadaActual})`, pageWidth / 2, 41, { align: 'center' })

      const dias = [
        { dia: 'LUNES', banca: 0 },
        { dia: 'MARTES', banca: 1 },
        { dia: 'MIÉRCOLES', banca: 2 },
        { dia: 'JUEVES', banca: 3 },
        { dia: 'VIERNES', banca: 4 },
      ]

      const filasFirmas: any[] = []

      dias.forEach(({ dia, banca }) => {
        const idsBanca = Object.values(distribucionAula[banca] || {})
        const listaEstBanca = idsBanca.map(id => estudiantes.find(e => e.id === id)).filter(Boolean)
        const { limpiezas, trapeadores, revisiones } = obtenerRolesRotados(listaEstBanca, semanaSeleccionada)

        const agregarEstudiantesFila = (grupo: any[], rolNombre: string) => {
          grupo.forEach(e => {
            filasFirmas.push([
              dia,
              rolNombre,
              `${e.apellidos} ${e.nombres}`,
              '[  ] Cumplió   [  ] Incumplió',
              ''
            ])
          })
        }

        agregarEstudiantesFila(limpiezas, 'Limpian (3)')
        agregarEstudiantesFila(trapeadores, 'Trapean (3)')
        agregarEstudiantesFila(revisiones, 'Verifican Bancas (3)')
      })

      autoTable(doc, {
        startY: 46,
        theme: 'grid',
        head: [['Día', 'Actividad Asignada', 'Apellidos y Nombres', 'Estado', 'Firma de Cumplimiento']],
        body: filasFirmas,
        headStyles: { fillColor: [75, 76, 153], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, cellPadding: 3.5 },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 55 },
          3: { cellWidth: 38, halign: 'center' },
          4: { cellWidth: 32 }
        }
      })

      doc.save(`Firmas_Aseo_Semana_${semanaSeleccionada}_${grado}_${paralelo}_${jornadaActual}.pdf`)
    } catch (e: any) {
      console.error(e)
      alert('Error al generar PDF de firmas: ' + e.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  const jornadasDisponibles = Array.from(new Set(misAsignaciones.map(a => a.jornada || 'MATUTINA')))
  const gradosUnicos = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual).map(a => a.grado_curso)))
  const paralelosDisponibles = Array.from(new Set(misAsignaciones.filter(a => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === grado).map(a => a.paralelo)))

  const idsAsignados = Object.values(distribucionAula).flatMap(banca => Object.values(banca))

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans">
        <div className="text-center bg-white p-8 rounded-3xl border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Aula...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#4b4c99]/20 selection:text-[#4b4c99]">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border text-[#4b4c99] bg-[#4b4c99]/10 border-[#4b4c99]/20 inline-block">
            Periodo: {anioLectivoVigente}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            Gestión de Aula y Comisión de Aseo
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Organizador de bancas, roles rotativos y control de firmas de cumplimiento
          </p>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          {pestanaActiva === 'croquis' && (
            <>
              <button
                onClick={generarPdfCroquis}
                disabled={generandoPdf || estudiantes.length === 0}
                style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
                className="px-4 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {generandoPdf ? 'Generando PDF...' : 'Imprimir Croquis PDF'}
              </button>
              <button
                onClick={handleGuardarCroquis}
                disabled={guardando}
                style={{ backgroundColor: '#4b4c99' }}
                className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar Distribución'}
              </button>
            </>
          )}

          {pestanaActiva === 'aseo' && (
            <button
              onClick={generarPdfAseo}
              disabled={generandoPdf || estudiantes.length === 0}
              style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
              className="px-4 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {generandoPdf ? 'Generando PDF...' : `Imprimir Rol Semana ${semanaSeleccionada} PDF`}
            </button>
          )}

          {pestanaActiva === 'firmas' && (
            <button
              onClick={generarPdfFirmas}
              disabled={generandoPdf || estudiantes.length === 0}
              style={{ backgroundColor: '#45b3a5', color: '#0f2925' }}
              className="px-4 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {generandoPdf ? 'Generando PDF...' : `Imprimir Hoja de Firmas Semana ${semanaSeleccionada}`}
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* SELECTORES DE FILTRO */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jornada</label>
          <select
            value={jornadaActual}
            onChange={(e) => setJornadaActual(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {jornadasDisponibles.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Grado / Curso</label>
          <select
            value={grado}
            onChange={(e) => setGrado(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {gradosUnicos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paralelo</label>
          <select
            value={paralelo}
            onChange={(e) => setParalelo(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none shadow-2xs"
          >
            {paralelosDisponibles.map(p => <option key={p} value={p}>Paralelo {p}</option>)}
          </select>
        </div>
      </div>

      {/* PESTAÑAS Y SELECTOR DE SEMANA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setPestanaActiva('croquis')}
            style={pestanaActiva === 'croquis' ? { backgroundColor: '#4b4c99', color: '#ffffff' } : {}}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer border ${
              pestanaActiva === 'croquis' ? 'border-[#4b4c99] shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🪑 Croquis de Bancas (5 Columnas)
          </button>
          <button
            onClick={() => setPestanaActiva('aseo')}
            style={pestanaActiva === 'aseo' ? { backgroundColor: '#4b4c99', color: '#ffffff' } : {}}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer border ${
              pestanaActiva === 'aseo' ? 'border-[#4b4c99] shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🧹 Comisión de Aseo
          </button>
          <button
            onClick={() => setPestanaActiva('firmas')}
            style={pestanaActiva === 'firmas' ? { backgroundColor: '#4b4c99', color: '#ffffff' } : {}}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer border ${
              pestanaActiva === 'firmas' ? 'border-[#4b4c99] shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            ✍️ Firmas de Cumplimiento
          </button>
        </div>

        {pestanaActiva !== 'croquis' && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Semana del Mes:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSemanaSeleccionada(sem as any)}
                  style={semanaSeleccionada === sem ? { backgroundColor: '#4b4c99', color: '#ffffff' } : {}}
                  className={`w-7 h-7 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    semanaSeleccionada === sem ? 'border-[#4b4c99]' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* VISTA 1: CROQUIS DE BANCAS */}
      {pestanaActiva === 'croquis' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white text-center py-3 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-md">
            🪧 Pizarra / Escritorio del Docente (Frente del Aula) 🪧
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[0, 1, 2, 3, 4].map((bancaIndex) => {
              const cantidadPuestos = bancaIndex === 4 ? 9 : 8
              return (
                <div key={bancaIndex} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                    <h2 className="text-[11px] font-bold text-[#4b4c99] uppercase tracking-wider">
                      Banca {bancaIndex + 1}
                    </h2>
                    <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-lg">
                      {cantidadPuestos} Puestos
                    </span>
                  </div>

                  <div className="space-y-2">
                    {Array.from({ length: cantidadPuestos }).map((_, asientoIndex) => {
                      const estudianteSeleccionadoId = distribucionAula[bancaIndex]?.[asientoIndex] || ''
                      
                      return (
                        <div key={asientoIndex} className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 w-4 text-center">
                            {asientoIndex + 1}.
                          </span>
                          <select
                            value={estudianteSeleccionadoId}
                            onChange={(e) => handleAsignarEstudiante(bancaIndex, asientoIndex, e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded-xl text-[10px] font-semibold text-slate-800 bg-slate-50 hover:bg-white focus:bg-white outline-none transition shadow-2xs"
                          >
                            <option value="">-- Seleccionar --</option>
                            {estudiantes.map((est) => {
                              const yaAsignadoEnOtroLado = idsAsignados.includes(est.id) && estudianteSeleccionadoId !== est.id
                              return (
                                <option 
                                  key={est.id} 
                                  value={est.id}
                                  disabled={yaAsignadoEnOtroLado}
                                >
                                  {est.apellidos} {est.nombres} {yaAsignadoEnOtroLado ? ' (Ocupado)' : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VISTA 2: COMISIÓN DE ASEO */}
      {pestanaActiva === 'aseo' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-3xl flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-indigo-950">
                Rotación de Aseo • Semana {semanaSeleccionada} del Mes
              </h2>
              <p className="text-xs text-indigo-800 mt-0.5">
                Los roles rotan automáticamente cada semana (Limpian ➔ Trapean ➔ Verifican) manteniendo exactamente 3 estudiantes por función.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { dia: 'LUNES', banca: 0, color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
              { dia: 'MARTES', banca: 1, color: 'bg-blue-50 border-blue-200 text-blue-900' },
              { dia: 'MIÉRCOLES', banca: 2, color: 'bg-amber-50 border-amber-200 text-amber-900' },
              { dia: 'JUEVES', banca: 3, color: 'bg-purple-50 border-purple-200 text-purple-900' },
              { dia: 'VIERNES', banca: 4, color: 'bg-rose-50 border-rose-200 text-rose-900' },
            ].map(({ dia, banca, color }) => {
              const idsBanca = Object.values(distribucionAula[banca] || {})
              const listaEstBanca = idsBanca.map(id => estudiantes.find(e => e.id === id)).filter(Boolean)
              const { limpiezas, trapeadores, revisiones } = obtenerRolesRotados(listaEstBanca, semanaSeleccionada)

              return (
                <div key={dia} className="p-5 rounded-3xl border shadow-xs space-y-4 bg-white">
                  <div className={`p-3 rounded-2xl text-center border ${color}`}>
                    <h3 className="text-xs font-black uppercase">{dia}</h3>
                    <p className="text-[10px] font-bold mt-0.5 opacity-85">Hilera / Banca {banca + 1}</p>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-700 text-[10px] uppercase border-b border-slate-100 pb-1 mb-1">🧹 Limpian (3):</p>
                      {limpiezas.length === 0 ? <p className="text-[10px] text-slate-400 italic">Sin estudiantes</p> : (
                        <ul className="space-y-1">
                          {limpiezas.map((e, idx) => <li key={idx} className="text-[11px] font-semibold text-slate-800">• {e.apellidos} {e.nombres}</li>)}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="font-bold text-slate-700 text-[10px] uppercase border-b border-slate-100 pb-1 mb-1">🪣 Trapean Piso (3):</p>
                      {trapeadores.length === 0 ? <p className="text-[10px] text-slate-400 italic">Sin estudiantes</p> : (
                        <ul className="space-y-1">
                          {trapeadores.map((e, idx) => <li key={idx} className="text-[11px] font-semibold text-slate-800">• {e.apellidos} {e.nombres}</li>)}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="font-bold text-slate-700 text-[10px] uppercase border-b border-slate-100 pb-1 mb-1">🔍 Verifican Bancas (3):</p>
                      {revisiones.length === 0 ? <p className="text-[10px] text-slate-400 italic">Sin estudiantes</p> : (
                        <ul className="space-y-1">
                          {revisiones.map((e, idx) => <li key={idx} className="text-[11px] font-semibold text-slate-800">• {e.apellidos} {e.nombres}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VISTA 3: FIRMAS DE CUMPLIMIENTO */}
      {pestanaActiva === 'firmas' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hoja de Control y Firmas • Semana {semanaSeleccionada}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Visualización previa del listado listo para firmar al finalizar las actividades.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 border border-slate-200 w-24 text-center">Día</th>
                  <th className="p-3 border border-slate-200 w-44">Actividad Asignada</th>
                  <th className="p-3 border border-slate-200">Apellidos y Nombres</th>
                  <th className="p-3 border border-slate-200 text-center w-36">Estado</th>
                  <th className="p-3 border border-slate-200 text-center w-40">Firma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[
                  { dia: 'LUNES', banca: 0 },
                  { dia: 'MARTES', banca: 1 },
                  { dia: 'MIÉRCOLES', banca: 2 },
                  { dia: 'JUEVES', banca: 3 },
                  { dia: 'VIERNES', banca: 4 },
                ].map(({ dia, banca }) => {
                  const idsBanca = Object.values(distribucionAula[banca] || {})
                  const listaEstBanca = idsBanca.map(id => estudiantes.find(e => e.id === id)).filter(Boolean)
                  const { limpiezas, trapeadores, revisiones } = obtenerRolesRotados(listaEstBanca, semanaSeleccionada)

                  const renderFilasGrupo = (grupo: any[], rol: string) => (
                    grupo.map((e, idx) => (
                      <tr key={`${dia}-${rol}-${idx}`} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-center border border-slate-200 bg-slate-50/50">{idx === 0 ? dia : ''}</td>
                        <td className="p-2.5 font-semibold text-slate-700 border border-slate-200">{idx === 0 ? rol : ''}</td>
                        <td className="p-2.5 font-bold text-slate-900 border border-slate-200">{e.apellidos} {e.nombres}</td>
                        <td className="p-2.5 text-center text-slate-400 border border-slate-200 font-medium">▢ Cumplió</td>
                        <td className="p-2.5 border border-slate-200 text-center text-slate-300">________________</td>
                      </tr>
                    ))
                  )

                  return (
                    <div key={dia} style={{ display: 'contents' }}>
                      {renderFilasGrupo(limpiezas, 'Limpian (3)')}
                      {renderFilasGrupo(trapeadores, 'Trapean (3)')}
                      {renderFilasGrupo(revisiones, 'Verifican Bancas (3)')}
                    </div>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}