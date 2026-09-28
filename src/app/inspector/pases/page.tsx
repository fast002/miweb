'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PasesSalidaPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [pases, setPases] = useState<any[]>([])
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  
  // Filtros de búsqueda para estudiantes (Formulario)
  const [filtroGrado, setFiltroGrado] = useState('')
  const [filtroParalelo, setFiltroParalelo] = useState('')
  const [filtroJornada, setFiltroJornada] = useState('')

  // Filtros de búsqueda para el Historial de Pases Emitidos
  const [filtroHistorialGrado, setFiltroHistorialGrado] = useState('')
  const [filtroHistorialParalelo, setFiltroHistorialParalelo] = useState('')
  const [filtroHistorialBusqueda, setFiltroHistorialBusqueda] = useState('')

  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('2026-2027')
  
  // Formulario nuevo pase
  const [estudianteId, setEstudianteId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [personaRetira, setPersonaRetira] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return; }

        const { data: insts } = await supabase.from('instituciones').select('*').limit(1)
        if (insts && insts[0]) {
          setNombreInstitucion(insts[0].nombre_institucion || 'Unidad Educativa')
          setAnioLectivoVigente(insts[0].anio_lectivo_activo || '2026-2027')
          setLogoUrl(insts[0].logo_url || '')
        }

        const { data: ests } = await supabase
          .from('estudiantes')
          .select('id, nombres, apellidos, grado_curso, paralelo, jornada')
          .eq('estado', 'activo')
          .order('apellidos')

        setEstudiantes(ests || [])
        if (ests && ests.length > 0) {
          setEstudianteId(ests[0].id)
        }
      } catch (err) {
        console.error('Error al inicializar:', err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  // Lógica de filtrado dinámico para la lista de estudiantes (Formulario)
  const estudiantesFiltrados = useMemo(() => {
    return estudiantes.filter(e => {
      return (filtroGrado === '' || e.grado_curso === filtroGrado) &&
             (filtroParalelo === '' || e.paralelo === filtroParalelo) &&
             (filtroJornada === '' || e.jornada === filtroJornada)
    })
  }, [estudiantes, filtroGrado, filtroParalelo, filtroJornada])

  // Auto-seleccionar primer estudiante filtrado
  useEffect(() => {
    if (estudiantesFiltrados.length > 0) {
      const existe = estudiantesFiltrados.some(e => e.id === estudianteId)
      if (!existe) {
        setEstudianteId(estudiantesFiltrados[0].id)
      }
    } else {
      setEstudianteId('')
    }
  }, [estudiantesFiltrados, estudianteId])

  // Lógica de filtrado dinámico para el Historial de Pases Emitidos
  const pasesFiltrados = useMemo(() => {
    return pases.filter(pase => {
      const est = pase.estudiantes || {}
      const nombreCompleto = `${est.apellidos || ''} ${est.nombres || ''}`.toLowerCase()
      const personaRetiraTexto = (pase.persona_retira || '').toLowerCase()
      const textoBusqueda = filtroHistorialBusqueda.toLowerCase()

      const coincideTexto = textoBusqueda === '' || 
                            nombreCompleto.includes(textoBusqueda) || 
                            personaRetiraTexto.includes(textoBusqueda)

      const coincideGrado = filtroHistorialGrado === '' || est.grado_curso === filtroHistorialGrado
      const coincideParalelo = filtroHistorialParalelo === '' || est.paralelo === filtroHistorialParalelo

      return coincideTexto && coincideGrado && coincideParalelo
    })
  }, [pases, filtroHistorialBusqueda, filtroHistorialGrado, filtroHistorialParalelo])

  const cargarPases = useCallback(async () => {
    const { data, error } = await supabase
      .from('pases_salida')
      .select('*, estudiantes(nombres, apellidos, grado_curso, paralelo, jornada)')
      .eq('anio_lectivo', anioLectivoVigente)
      .order('fecha', { ascending: false })

    if (!error) setPases(data || [])
  }, [anioLectivoVigente])

  useEffect(() => { cargarPases() }, [cargarPases])

  const crearPase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!estudianteId) {
      setMensaje('❌ Debe seleccionar un estudiante.')
      return
    }
    if (!motivo || !personaRetira || !horaSalida) {
      setMensaje('❌ Por favor complete todos los campos obligatorios.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('pases_salida').insert({
      estudiante_id: estudianteId, 
      docente_id: user?.id, 
      motivo, 
      persona_retira: personaRetira,
      hora_salida: horaSalida, 
      fecha, 
      anio_lectivo: anioLectivoVigente, 
      estado: 'Autorizado'
    })

    if (error) {
      setMensaje('❌ Error al emitir el pase: ' + error.message)
    } else {
      setMensaje('✅ Pase de salida emitido correctamente.')
      setMotivo('')
      setPersonaRetira('')
      setHoraSalida('')
      setTimeout(() => setMensaje(null), 3000)
      cargarPases()
    }
  }

  // Función para imprimir el pase individual con el logo institucional
  const imprimirPase = (pase: any) => {
    const est = pase.estudiantes || {}
    const ventanaImpresion = window.open('', '_blank')
    if (!ventanaImpresion) return

    const contenidoHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pase de Salida - ${est.apellidos || ''} ${est.nombres || ''}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #000;
              margin: 0;
              padding: 20px;
            }
            .ticket {
              max-width: 700px;
              margin: 0 auto;
              border: 2px dashed #333;
              padding: 30px;
              border-radius: 12px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .logo {
              max-height: 70px;
              object-fit: contain;
              margin-bottom: 8px;
            }
            .header h2 {
              margin: 0 0 5px 0;
              font-size: 20px;
              text-transform: uppercase;
            }
            .header p {
              margin: 0;
              font-size: 12px;
              color: #555;
            }
            .title-badge {
              text-align: center;
              font-weight: bold;
              font-size: 16px;
              text-transform: uppercase;
              background: #f1f5f9;
              padding: 8px;
              border: 1px solid #cbd5e1;
              margin-bottom: 20px;
              border-radius: 6px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              font-size: 14px;
              margin-bottom: 20px;
            }
            .grid-full {
              grid-column: span 2;
            }
            .label {
              font-weight: bold;
              color: #334155;
              display: block;
              font-size: 11px;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .value {
              font-size: 15px;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 4px;
            }
            .signatures {
              margin-top: 50px;
              display: flex;
              justify-content: space-around;
              text-align: center;
              font-size: 12px;
            }
            .sig-line {
              width: 200px;
              border-top: 1px solid #000;
              padding-top: 5px;
              margin-top: 40px;
            }
            @media print {
              body { padding: 0; }
              .ticket { border: 2px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo Institucional" />` : ''}
              <h2>${nombreInstitucion}</h2>
              <p>PASE DE SALIDA OFICIAL — AÑO LECTIVO: ${pase.anio_lectivo}</p>
            </div>

            <div class="title-badge">
              Autorización de Retiro Estudiantil
            </div>

            <div class="grid">
              <div>
                <span class="label">Estudiante:</span>
                <div class="value"><strong>${est.apellidos || ''} ${est.nombres || ''}</strong></div>
              </div>
              <div>
                <span class="label">Grado / Curso:</span>
                <div class="value">${est.grado_curso || ''} "${est.paralelo || ''}"</div>
              </div>
              <div>
                <span class="label">Fecha de Salida:</span>
                <div class="value">${pase.fecha}</div>
              </div>
              <div>
                <span class="label">Hora Autorizada:</span>
                <div class="value"><strong>${pase.hora_salida}</strong></div>
              </div>
              <div class="grid-full">
                <span class="label">Persona Autorizada que Retira:</span>
                <div class="value"><strong>${pase.persona_retira}</strong></div>
              </div>
              <div class="grid-full">
                <span class="label">Motivo del Retiro:</span>
                <div class="value">${pase.motivo}</div>
              </div>
            </div>

            <div class="signatures">
              <div>
                <div class="sig-line">Autorizado por (Inspector/Rector)</div>
              </div>
              <div>
                <div class="sig-line">Recibe Conforme (Firma Representante)</div>
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `

    ventanaImpresion.document.write(contenidoHtml)
    ventanaImpresion.document.close()
  }

  if (cargando) {
    return <div className="p-10 text-slate-900 font-bold bg-slate-50 min-h-screen">Cargando módulo de pases...</div>
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO INSTITUCIONAL */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-black">Control y Emisión de Pases de Salida</h1>
            <p className="text-xs font-bold text-slate-500">{nombreInstitucion} — Gestión de autorizaciones de retiro estudiantil.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/inspector')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
            >
              ← Volver al Menú
            </button>
            <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
              Periodo: {anioLectivoVigente}
            </div>
          </div>
        </div>

        {mensaje && (
          <div className="p-3 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {mensaje}
          </div>
        )}

        {/* FORMULARIO CON FILTROS Y NUEVO PASE */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
          <h2 className="text-sm font-black uppercase text-slate-700">Emitir Nuevo Pase - Filtros de Búsqueda</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Filtrar por Grado / Curso</label>
              <select value={filtroGrado} onChange={(e) => setFiltroGrado(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold bg-white outline-none">
                <option value="">Todos los Grados</option>
                {Array.from(new Set(estudiantes.map(e => e.grado_curso))).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Filtrar por Paralelo</label>
              <select value={filtroParalelo} onChange={(e) => setFiltroParalelo(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold bg-white outline-none">
                <option value="">Todos los Paralelos</option>
                {['A', 'B', 'C', 'D'].map(p => <option key={p} value={p}>Paralelo {p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Filtrar por Jornada</label>
              <select value={filtroJornada} onChange={(e) => setFiltroJornada(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold bg-white outline-none">
                <option value="">Todas las Jornadas</option>
                <option value="Matutina">Matutina</option>
                <option value="Vespertina">Vespertina</option>
              </select>
            </div>
          </div>

          <form onSubmit={crearPase} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Estudiante Filtrado</label>
              <select
                value={estudianteId}
                onChange={(e) => setEstudianteId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900 outline-none"
              >
                {estudiantesFiltrados.length === 0 ? (
                  <option value="">No hay estudiantes con este filtro</option>
                ) : (
                  estudiantesFiltrados.map(est => (
                    <option key={est.id} value={est.id}>
                      {est.apellidos} {est.nombres} ({est.grado_curso} "{est.paralelo}")
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Persona que Retira</label>
              <input
                type="text"
                placeholder="Nombre del representante o familiar"
                value={personaRetira}
                onChange={(e) => setPersonaRetira(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Motivo del Retiro</label>
              <input
                type="text"
                placeholder="Cita médica, calamidad, etc."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Hora de Salida</label>
              <input
                type="time"
                value={horaSalida}
                onChange={(e) => setHoraSalida(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900 outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow transition cursor-pointer"
              >
                Generar y Autorizar Pase 📄
              </button>
            </div>
          </form>
        </div>

        {/* LISTADO DE PASES EMITIDOS CON FILTROS */}
        <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-100 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-bold text-slate-700">
            <span>Historial de Pases Emitidos</span>
            
            {/* FILTROS PARA EL HISTORIAL */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="🔍 Buscar estudiante o familiar..."
                value={filtroHistorialBusqueda}
                onChange={(e) => setFiltroHistorialBusqueda(e.target.value)}
                className="p-1.5 border rounded-lg text-xs font-bold bg-white outline-none"
              />
              <select 
                value={filtroHistorialGrado} 
                onChange={(e) => setFiltroHistorialGrado(e.target.value)} 
                className="p-1.5 border rounded-lg text-xs font-bold bg-white outline-none"
              >
                <option value="">Todos los Grados</option>
                {Array.from(new Set(estudiantes.map(e => e.grado_curso))).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select 
                value={filtroHistorialParalelo} 
                onChange={(e) => setFiltroHistorialParalelo(e.target.value)} 
                className="p-1.5 border rounded-lg text-xs font-bold bg-white outline-none"
              >
                <option value="">Todos los Paralelos</option>
                {['A', 'B', 'C', 'D'].map(p => <option key={p} value={p}>Paralelo {p}</option>)}
              </select>
            </div>

            <span>Mostrando: {pasesFiltrados.length} de {pases.length}</span>
          </div>

          {pasesFiltrados.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xs">
              No se encontraron pases de salida con los filtros seleccionados.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 uppercase font-black text-[10px] text-slate-600 border-b">
                <tr>
                  <th className="p-3 text-left">Fecha / Hora</th>
                  <th className="p-3 text-left">Estudiante (Curso)</th>
                  <th className="p-3 text-left">Retira a cargo de</th>
                  <th className="p-3 text-left">Motivo</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pasesFiltrados.map(pase => {
                  const est = pase.estudiantes || {}
                  return (
                    <tr key={pase.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-700">
                        {pase.fecha} <span className="text-slate-400">({pase.hora_salida})</span>
                      </td>
                      <td className="p-3 font-black text-slate-900">
                        {est.apellidos} {est.nombres} <span className="text-slate-500 font-normal">({est.grado_curso} "{est.paralelo}")</span>
                      </td>
                      <td className="p-3 font-bold text-indigo-700">
                        {pase.persona_retira}
                      </td>
                      <td className="p-3 text-slate-600">
                        {pase.motivo}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-black text-[10px]">
                          {pase.estado}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => imprimirPase(pase)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white font-black text-[10px] rounded-xl shadow-sm transition cursor-pointer"
                        >
                          🖨️ Imprimir Pase
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}