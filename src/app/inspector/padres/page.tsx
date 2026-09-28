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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando Módulo de Representantes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Encabezado Principal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black uppercase">
              Panel de Inspección • {nombreInstitucion}
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Visualización y Control de Cuentas de Representantes
            </h1>
          </div>
        </div>

        {mensaje && (
          <div className="p-4 bg-blue-50 text-blue-900 rounded-xl text-sm font-medium border border-blue-200 shadow-xs flex justify-between items-center">
            <span>{mensaje}</span>
            <button onClick={() => setMensaje('')} className="text-blue-900 font-bold ml-4">✕</button>
          </div>
        )}

        {/* TABLA: Representantes Registrados en el Plantel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Representantes Registrados en el Plantel</h3>
            <div className="w-full sm:w-72">
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="🔍 Buscar por nombre, cédula o hijo..."
                className="w-full px-3 py-2 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 border">Representante (Datos)</th>
                  <th className="p-3 border">Cédula / Teléfono</th>
                  <th className="p-3 border">Estudiantes Vinculados (Hijos)</th>
                  <th className="p-3 border text-center">Estado / Bloqueo</th>
                  <th className="p-3 border text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {padresFiltrados.map((p) => {
                  const nombreCompletoRep = `${p.apellidos || ''} ${p.nombres || ''}`.trim() || 'Representante'
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 border">
                        <span className="block font-bold text-slate-900">{nombreCompletoRep}</span>
                        <span className="block text-[10px] text-slate-500">{p.email}</span>
                      </td>
                      <td className="p-3 border">
                        <span className="block font-semibold text-slate-800">Cédula: {p.cedula}</span>
                        <span className="block text-slate-600">Telf: {p.telefono}</span>
                      </td>
                      <td className="p-3 border">
                        <ul className="space-y-1">
                          {p.hijos.map((h: any) => (
                            <li key={h.vinculo_id} className="bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                              <span className="font-bold text-slate-800">{h.nombreCompleto} <span className="text-[10px] text-slate-500">({h.cursoParalelo})</span></span>
                              <span className="block text-[9px] text-blue-600 font-black uppercase">Parentesco: {h.parentesco}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-3 border text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${p.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {p.activo !== false ? 'ACTIVO' : 'INACTIVO / BLOQUEADO'}
                        </span>
                      </td>
                      <td className="p-3 border text-center space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActivo(p.user_id, p.activo !== false)}
                          className={`px-3 py-1 font-bold rounded text-[10px] ${p.activo !== false ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}`}
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
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      No hay representantes registrados en este plantel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}