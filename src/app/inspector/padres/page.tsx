'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function InspectorPadresPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [padresAgrupados, setPadresAgrupados] = useState<any[]>([])
  const [filtroTexto, setFiltroTexto] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  // CARGA PRINCIPAL DEL INSPECTOR
  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Obtener datos del inspector y su institución
      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (!doc || !doc.institucion_id) {
        setCargando(false)
        return
      }

      setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Institución')
      await cargarRepresentantes(doc.institucion_id)

    } catch (err) {
      console.error('Error al inicializar:', err)
    } finally {
      setCargando(false)
    }
  }

  // CARGA SEGURA DE REPRESENTANTES DE LA INSTITUCIÓN
  const cargarRepresentantes = async (instId: string) => {
    const { data: padresData, error: padresError } = await supabase
      .from('estudiante_representantes')
      .select('*, estudiantes!inner(id, nombres, apellidos, grado_curso, paralelo, institucion_id)')
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

  // FILTRO DE BÚSQUEDA
  const padresFiltrados = padresAgrupados.filter(p => {
    const texto = filtroTexto.toLowerCase()
    const nombreCompleto = `${p.nombres} ${p.apellidos}`.toLowerCase()
    const cedula = (p.cedula || '').toLowerCase()
    const coincideHijo = p.hijos.some((h: any) => h.nombreCompleto.toLowerCase().includes(texto) || h.cursoParalelo.toLowerCase().includes(texto))
    return nombreCompleto.includes(texto) || cedula.includes(texto) || coincideHijo
  })

  // ACCIÓN: Activar o Inactivar / Bloquear cuenta
  const handleToggleActivo = async (userId: string, estadoActual: boolean) => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: doc } = await supabase.from('docentes').select('institucion_id').eq('id', user?.id).single()

      await supabase.from('estudiante_representantes')
        .update({ activo: !estadoActual })
        .eq('user_id', userId)
      
      setMensaje(`Representante ${!estadoActual ? 'activado' : 'inactivado / bloqueado'} correctamente.`)
      if (doc?.institucion_id) await cargarRepresentantes(doc.institucion_id)
    } catch (err: any) {
      setMensaje('Error al cambiar estado.')
    } finally {
      setCargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Representantes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">

      {/* ENCABEZADO PRINCIPAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Panel de Inspección • {nombreInstitucion}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Visualización y Control de Cuentas de Representantes
          </h1>
        </div>
      </div>

      {mensaje && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-bold shadow-2xs flex justify-between items-center">
          <span>{mensaje}</span>
          <button onClick={() => setMensaje('')} className="text-indigo-900 font-bold ml-4 cursor-pointer">✕</button>
        </div>
      )}

      {/* TABLA: Representantes Registrados en el Plantel */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: '#4b4c99' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
        >
          <span>Representantes Registrados en el Plantel</span>
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por nombre, cédula o hijo..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200">Representante (Datos)</th>
                <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200">Cédula / Teléfono</th>
                <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200">Estudiantes Vinculados (Hijos)</th>
                <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200 text-center">Estado / Bloqueo</th>
                <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {padresFiltrados.map((p) => {
                const nombreCompletoRep = `${p.apellidos || ''} ${p.nombres || ''}`.trim() || 'Representante'
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 border border-slate-200">
                      <span className="block font-bold text-slate-800">{nombreCompletoRep}</span>
                      <span className="block text-[10px] text-slate-500">{p.email}</span>
                    </td>
                    <td className="p-3.5 border border-slate-200">
                      <span className="block font-bold text-slate-800">Cédula: {p.cedula}</span>
                      <span className="block text-slate-600 font-medium">Telf: {p.telefono}</span>
                    </td>
                    <td className="p-3.5 border border-slate-200">
                      <ul className="space-y-1.5">
                        {p.hijos.map((h: any) => (
                          <li key={h.vinculo_id} className="bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                            <span className="font-bold text-slate-800">{h.nombreCompleto} <span className="text-[10px] text-slate-500 font-normal">({h.cursoParalelo})</span></span>
                            <span className="block text-[9px] text-[#4b4c99] font-black uppercase mt-0.5">Parentesco: {h.parentesco}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3.5 border border-slate-200 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shadow-2xs ${p.activo !== false ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                        {p.activo !== false ? 'Activo' : 'Inactivo / Bloqueado'}
                      </span>
                    </td>
                    <td className="p-3.5 border border-slate-200 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActivo(p.user_id, p.activo !== false)}
                        className={`px-3.5 py-2 font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer ${
                          p.activo !== false 
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200' 
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}
                        title="Activar o bloquear cuenta"
                      >
                        {p.activo !== false ? 'Inactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {padresFiltrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 font-medium text-xs">
                    No hay representantes registrados en este plantel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}