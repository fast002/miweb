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
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Módulo de Asignaturas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO SUPERIOR */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Gestión Académica
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Gestión de Asignaturas Oficiales
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • <strong className="text-slate-700">Rector/a: {nombreRector}</strong>
          </p>
        </div>
      </div>

      {/* RUTA DE NAVEGACIÓN (BREADCRUMB) */}
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
        Panel / Gestión Académica / Asignaturas
      </div>

      {/* SELECTOR DE SUBNIVEL */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
          Seleccione Subnivel para Gestionar
        </label>
        <select 
          value={filtroSubnivel} 
          onChange={(e) => setFiltroSubnivel(e.target.value)} 
          style={{ color: '#4b4c99' }}
          className="w-full p-3 border border-slate-300 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] cursor-pointer shadow-2xs"
        >
          {['Básica Elemental', 'Básica Media', 'Básica Superior', 'Bachillerato'].map(s => (
            <option key={s} value={s} className="text-slate-900 font-bold bg-white">{s}</option>
          ))}
        </select>
      </div>

      {/* FORMULARIO DE INGRESO */}
      <form onSubmit={handleAgregarAsignatura} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center">
        <input 
          value={nombreAsignatura} 
          onChange={(e) => setNombreAsignatura(e.target.value)}
          placeholder={`Escriba el nombre de la nueva materia en ${filtroSubnivel}...`}
          className="flex-grow w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
        />
        <button 
          disabled={guardando} 
          style={{ backgroundColor: '#4b4c99' }}
          className="w-full sm:w-auto text-white px-6 py-3 rounded-xl font-bold text-xs transition shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
        >
          {guardando ? 'Guardando...' : '+ Agregar Materia'}
        </button>
      </form>

      {/* LISTADO / TABLA DE ASIGNATURAS */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 font-bold text-xs uppercase border-b border-slate-200 text-slate-900 flex justify-between items-center">
           <span>Administrando Malla Curricular: <strong style={{ color: '#4b4c99' }}>{filtroSubnivel}</strong></span>
           <span className="text-[10px] bg-indigo-50 text-[#4b4c99] px-2.5 py-1 rounded-lg font-bold border border-indigo-100 shadow-2xs">
             {asignaturasFiltradas.length} Registrada(s)
           </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <tbody className="divide-y divide-slate-200">
              {asignaturasFiltradas.length === 0 ? (
                <tr>
                  <td className="p-12 text-center text-slate-500 font-medium italic">
                    No hay asignaturas registradas para este subnivel.
                  </td>
                </tr>
              ) : (
                asignaturasFiltradas.map(mat => (
                  <tr key={mat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      {editandoId === mat.id ? (
                        <input 
                          value={valorEdicion} 
                          onChange={(e) => setValorEdicion(e.target.value)} 
                          className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-xs text-slate-900 bg-white outline-none shadow-2xs" 
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
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition border border-emerald-200 cursor-pointer shadow-2xs text-[10px]"
                          >
                            Guardar
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setEditandoId(mat.id); setValorEdicion(mat.nombre_asignatura) }} 
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition border border-indigo-200 cursor-pointer shadow-2xs text-[10px]"
                          >
                            Editar
                          </button>
                        )}
                        <button 
                          onClick={() => handleEliminar(mat.id)} 
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition border border-rose-200 cursor-pointer shadow-2xs text-[10px]"
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
  )
}