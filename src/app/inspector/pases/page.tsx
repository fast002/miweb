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
      setMensaje('Debe seleccionar un estudiante.')
      return
    }
    if (!motivo || !personaRetira || !horaSalida) {
      setMensaje('Por favor complete todos los campos obligatorios.')
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
      setMensaje('Error al emitir el pase: ' + error.message)
    } else {
      setMensaje('Pase de salida emitido correctamente.')
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
              border-bottom: 2px solid #4b4c99;
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
              font-size: 18px;
              text-transform: uppercase;
              color: #0f172a;
            }
            .header p {
              margin: 0;
              font-size: 11px;
              color: #475569;
            }
            .title-badge {
              text-align: center;
              font-weight: bold;
              font-size: 14px;
              text-transform: uppercase;
              background: rgba(75, 76, 153, 0.08);
              padding: 8px;
              border: 1px solid rgba(75, 76, 153, 0.2);
              margin-bottom: 20px;
              border-radius: 8px;
              color: #4b4c99;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              font-size: 13px;
              margin-bottom: 20px;
            }
            .grid-full {
              grid-column: span 2;
            }
            .label {
              font-weight: bold;
              color: #334155;
              display: block;
              font-size: 10px;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .value {
              font-size: 14px;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 4px;
            }
            .signatures {
              margin-top: 50px;
              display: flex;
              justify-content: space-around;
              text-align: center;
              font-size: 11px;
            }
            .sig-line {
              width: 200px;
              border-top: 1px solid #64748b;
              padding-top: 5px;
              margin-top: 40px;
              font-weight: bold;
              color: #334155;
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
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Pases...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Gestión de Retiros • {nombreInstitucion}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Control y Emisión de Pases de Salida
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Gestión de autorizaciones de retiro estudiantil.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => router.push('/inspector')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer"
          >
            ← Volver al Menú
          </button>
          <div className="bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-200 text-xs font-bold text-indigo-900 shadow-2xs">
            Periodo: {anioLectivoVigente}
          </div>
        </div>
      </div>

      {mensaje && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-bold shadow-2xs">
          {mensaje}
        </div>
      )}

      {/* FORMULARIO CON FILTROS Y NUEVO PASE */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wide">Emitir Nuevo Pase - Filtros de Búsqueda</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Filtrar por Grado / Curso</label>
            <select value={filtroGrado} onChange={(e) => setFiltroGrado(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer">
              <option value="" className="text-slate-900 font-bold bg-white">Todos los Grados</option>
              {Array.from(new Set(estudiantes.map(e => e.grado_curso))).map(g => <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Filtrar por Paralelo</label>
            <select value={filtroParalelo} onChange={(e) => setFiltroParalelo(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer">
              <option value="" className="text-slate-900 font-bold bg-white">Todos los Paralelos</option>
              {['A', 'B', 'C', 'D'].map(p => <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Filtrar por Jornada</label>
            <select value={filtroJornada} onChange={(e) => setFiltroJornada(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer">
              <option value="" className="text-slate-900 font-bold bg-white">Todas las Jornadas</option>
              <option value="Matutina" className="text-slate-900 font-bold bg-white">Matutina</option>
              <option value="Vespertina" className="text-slate-900 font-bold bg-white">Vespertina</option>
            </select>
          </div>
        </div>

        <form onSubmit={crearPase} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs pt-2">
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Estudiante Filtrado</label>
            <select
              value={estudianteId}
              onChange={(e) => setEstudianteId(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              {estudiantesFiltrados.length === 0 ? (
                <option value="" className="text-slate-900 font-bold bg-white">No hay estudiantes con este filtro</option>
              ) : (
                estudiantesFiltrados.map(est => (
                  <option key={est.id} value={est.id} className="text-slate-900 font-bold bg-white">
                    {est.apellidos} {est.nombres} ({est.grado_curso} "{est.paralelo}")
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Persona que Retira</label>
            <input
              type="text"
              placeholder="Nombre del representante o familiar"
              value={personaRetira}
              onChange={(e) => setPersonaRetira(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Motivo del Retiro</label>
            <input
              type="text"
              placeholder="Cita médica, calamidad, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1.5">Hora de Salida</label>
            <input
              type="time"
              value={horaSalida}
              onChange={(e) => setHoraSalida(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              style={{ backgroundColor: '#4b4c99' }}
              className="w-full py-3 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              Generar y Autorizar Pase
            </button>
          </div>
        </form>
      </div>

      {/* LISTADO DE PASES EMITIDOS CON FILTROS */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: '#4b4c99' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
        >
          <span>Historial de Pases Emitidos</span>
          
          {/* FILTROS PARA EL HISTORIAL */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              placeholder="Buscar estudiante o familiar..."
              value={filtroHistorialBusqueda}
              onChange={(e) => setFiltroHistorialBusqueda(e.target.value)}
              className="p-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
            />
            <select 
              value={filtroHistorialGrado} 
              onChange={(e) => setFiltroHistorialGrado(e.target.value)} 
              className="p-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
            >
              <option value="" className="text-slate-900 font-bold bg-white">Todos los Grados</option>
              {Array.from(new Set(estudiantes.map(e => e.grado_curso))).map(g => <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>)}
            </select>
            <select 
              value={filtroHistorialParalelo} 
              onChange={(e) => setFiltroHistorialParalelo(e.target.value)} 
              className="p-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
            >
              <option value="" className="text-slate-900 font-bold bg-white">Todos los Paralelos</option>
              {['A', 'B', 'C', 'D'].map(p => <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>)}
            </select>
          </div>

          <span>Mostrando: {pasesFiltrados.length} de {pases.length}</span>
        </div>

        {pasesFiltrados.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No se encontraron pases de salida con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200">Fecha / Hora</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200">Estudiante (Curso)</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200">Retira a cargo de</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200">Motivo</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200 text-center">Estado</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pasesFiltrados.map(pase => {
                  const est = pase.estudiantes || {}
                  return (
                    <tr key={pase.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 border border-slate-200 font-bold text-slate-700">
                        {pase.fecha} <span className="text-slate-400 font-normal">({pase.hora_salida})</span>
                      </td>
                      <td className="p-3.5 border border-slate-200 font-bold text-slate-900">
                        {est.apellidos} {est.nombres} <span className="text-slate-500 font-normal">({est.grado_curso} "{est.paralelo}")</span>
                      </td>
                      <td className="p-3.5 border border-slate-200 font-bold text-[#4b4c99]">
                        {pase.persona_retira}
                      </td>
                      <td className="p-3.5 border border-slate-200 text-slate-600 font-medium">
                        {pase.motivo}
                      </td>
                      <td className="p-3.5 border border-slate-200 text-center">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg font-bold text-[10px] uppercase shadow-2xs">
                          {pase.estado}
                        </span>
                      </td>
                      <td className="p-3.5 border border-slate-200 text-center whitespace-nowrap">
                        <button
                          onClick={() => imprimirPase(pase)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs shadow-2xs cursor-pointer"
                        >
                          Imprimir Pase
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}