'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Asignatura {
  id: number
  institucion_id: string
  subnivel: string
  nombre_asignatura: string
}

export default function RectorAsignaturasPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  
  const [nombreRector, setNombreRector] = useState('Administrador')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [institucionId, setInstitucionId] = useState('')
  const [filtroSubnivel, setFiltroSubnivel] = useState('Básica Elemental')
  const [nombreAsignatura, setNombreAsignatura] = useState('')
  
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [valorEdicion, setValorEdicion] = useState('')

  // Función para cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return; }

      const { data: doc } = await supabase
        .from('docentes')
        .select('nombres, apellidos, institucion_id, instituciones(nombre_institucion)')
        .eq('id', user.id)
        .maybeSingle()

      if (doc) {
        setNombreRector(`${doc.nombres || ''} ${doc.apellidos || ''}`)
        setInstitucionId(doc.institucion_id)
        
        const instData: any = doc.instituciones
        const nombreInst = Array.isArray(instData) ? instData[0]?.nombre_institucion : instData?.nombre_institucion
        setNombreInstitucion(nombreInst || 'Unidad Educativa')
        
        cargarAsignaturas(doc.institucion_id)
      }
      setCargando(false)
    }
    init()
  }, [router])

  const cargarAsignaturas = async (instId: string) => {
    const { data } = await supabase.from('configuracion_asignaturas').select('*').eq('institucion_id', instId)
    
    // FILTRO DE DEDUPLICACIÓN ESTRICTA
    if (data) {
      const unicas = data.filter((v, i, a) => 
        a.findIndex(t => (t.nombre_asignatura === v.nombre_asignatura && t.subnivel === v.subnivel)) === i
      );
      setAsignaturas(unicas)
    }
  }

  const handleAgregarAsignatura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombreAsignatura.trim()) return
    setGuardando(true)
    await supabase.from('configuracion_asignaturas').insert({ 
      institucion_id: institucionId, 
      subnivel: filtroSubnivel, 
      nombre_asignatura: nombreAsignatura.trim() 
    })
    setNombreAsignatura('')
    cargarAsignaturas(institucionId)
    setGuardando(false)
  }

  const handleGuardarEdicion = async (id: number) => {
    if (!valorEdicion.trim()) return
    await supabase.from('configuracion_asignaturas').update({ nombre_asignatura: valorEdicion.trim() }).eq('id', id)
    setEditandoId(null)
    cargarAsignaturas(institucionId)
  }

  const asignaturasFiltradas = useMemo(() => {
    return asignaturas.filter(a => a.subnivel === filtroSubnivel)
  }, [asignaturas, filtroSubnivel])

  const handleEliminar = async (id: number) => {
    if(!confirm('¿Eliminar esta materia?')) return
    await supabase.from('configuracion_asignaturas').delete().eq('id', id)
    cargarAsignaturas(institucionId)
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Módulo de Asignaturas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ENCABEZADO SUPERIOR CON ESTILO MINIMALISTA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-wide uppercase">
              Gestión de Asignaturas Oficiales 📚
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {nombreInstitucion} • <strong className="text-slate-700">Rector/a: {nombreRector}</strong>
            </p>
          </div>
          <div className="flex items-center gap-3">
          </div>
        </div>

        {/* RUTA DE NAVEGACIÓN (BREADCRUMB) */}
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
          PANEL &gt; GESTIÓN ACADÉMICA &gt; ASIGNATURAS
        </div>

        {/* SELECTOR DE SUBNIVEL */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
            Seleccione Subnivel para Gestionar
          </label>
          <select 
            value={filtroSubnivel} 
            onChange={(e) => setFiltroSubnivel(e.target.value)} 
            className="w-full p-3 border border-slate-300 rounded-xl font-bold text-xs text-indigo-900 bg-indigo-50/50 outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
          >
            {['Básica Elemental', 'Básica Media', 'Básica Superior', 'Bachillerato'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* FORMULARIO DE INGRESO */}
        <form onSubmit={handleAgregarAsignatura} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center">
          <input 
            value={nombreAsignatura} 
            onChange={(e) => setNombreAsignatura(e.target.value)}
            placeholder={`Escriba el nombre de la nueva materia en ${filtroSubnivel}...`}
            className="flex-grow w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button 
            disabled={guardando} 
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-xs transition shadow-2xs disabled:opacity-50 shrink-0"
          >
            {guardando ? 'Guardando...' : '+ Agregar Materia'}
          </button>
        </form>

        {/* LISTADO / TABLA DE ASIGNATURAS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 font-bold text-xs uppercase border-b border-slate-200 text-slate-700 flex justify-between items-center">
             <span>Administrando Malla Curricular: <strong className="text-indigo-700">{filtroSubnivel}</strong></span>
             <span className="text-[10px] bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
               {asignaturasFiltradas.length} Registrada(s)
             </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <tbody className="divide-y divide-slate-100">
                {asignaturasFiltradas.length === 0 ? (
                  <tr>
                    <td className="p-12 text-center text-slate-400 font-semibold italic">
                      No hay asignaturas registradas para este subnivel.
                    </td>
                  </tr>
                ) : (
                  asignaturasFiltradas.map(mat => (
                    <tr key={mat.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        {editandoId === mat.id ? (
                          <input 
                            value={valorEdicion} 
                            onChange={(e) => setValorEdicion(e.target.value)} 
                            className="w-full p-2 border border-indigo-300 rounded-lg font-bold text-xs text-indigo-900 bg-indigo-50 outline-none" 
                            autoFocus
                          />
                        ) : (
                          <span className="font-bold text-slate-800 text-xs">{mat.nombre_asignatura}</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end items-center">
                          {editandoId === mat.id ? (
                            <button 
                              onClick={() => handleGuardarEdicion(mat.id)} 
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition border border-emerald-200"
                            >
                              Guardar
                            </button>
                          ) : (
                            <button 
                              onClick={() => { setEditandoId(mat.id); setValorEdicion(mat.nombre_asignatura) }} 
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition border border-blue-200"
                            >
                              Editar
                            </button>
                          )}
                          <button 
                            onClick={() => handleEliminar(mat.id)} 
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg transition border border-red-200"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}