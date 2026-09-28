'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function EditarPlanificacionPage() {
  const router = useRouter()
  const params = useParams()
  const planId = params.id

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Formulario Informativo
  const [titulo, setTitulo] = useState('')
  const [subnivel, setSubnivel] = useState('Básica Elemental')
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('A')
  const [asignatura, setAsignatura] = useState('')
  const [unidad, setUnidad] = useState('')
  const [semanas, setSemanas] = useState(1)
  const [estado, setEstado] = useState('borrador')

  // Campos Pedagógicos DUA / ERCA
  const [objetivos, setObjetivos] = useState('')
  const [criterios, setCriterios] = useState('')
  const [indicadores, setIndicadores] = useState('')
  const [estrategiasDua, setEstrategiasDua] = useState('')
  const [recursos, setRecursos] = useState('')
  const [evaluacion, setEvaluacion] = useState('')
  const [adaptaciones, setAdaptaciones] = useState('')

  useEffect(() => {
    if (planId) cargarPlanificacion()
  }, [planId])

  const cargarPlanificacion = async () => {
    try {
      const { data: plan, error } = await supabase
        .from('planificaciones')
        .select('*')
        .eq('id', planId)
        .single()

      if (error || !plan) {
        throw new Error('No se encontró la planificación solicitada.')
      }

      setTitulo(plan.titulo_planificación || '')
      setSubnivel(plan.subnivel || 'Básica Elemental')
      setGrado(plan.grado_curso || '')
      setParalelo(plan.paralelo || 'A')
      setAsignatura(plan.asignatura || '')
      setUnidad(plan.unidad_didactica || '')
      setSemanas(plan.duracion_semanas || 1)
      setEstado(plan.estado || 'borrador')

      setObjetivos(plan.objetivos_aprendizaje || '')
      setCriterios(plan.criterios_evaluacion || '')
      setIndicadores(plan.indicadores_evaluacion || '')
      setEstrategiasDua(plan.estrategias_dua || '')
      setRecursos(plan.recursos || '')
      setEvaluacion(plan.actividades_evaluacion || '')
      setAdaptaciones(plan.adaptaciones_curriculares || '')
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setCargando(false)
    }
  }

  const handleActualizarPlanificacion = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)

    try {
      const { error } = await supabase
        .from('planificaciones')
        .update({
          titulo_planificación: titulo.trim(),
          subnivel,
          grado_curso: grado,
          paralelo,
          asignatura,
          unidad_didactica: unidad,
          duracion_semanas: semanas,
          objetivos_aprendizaje: objetivos,
          criterios_evaluacion: criterios,
          indicadores_evaluacion: indicadores,
          estrategias_dua: estrategiasDua,
          recursos,
          actividades_evaluacion: evaluacion,
          adaptaciones_curriculares: adaptaciones,
          estado
        })
        .eq('id', planId)

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: '¡Planificación DUA actualizada con éxito!' })
      setTimeout(() => {
        router.push('/docnete/planificador')
      }, 1200)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center font-semibold text-slate-600">Cargando Planificación...</div>
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-md p-8">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Editar Planificación Microcurricular DUA</h1>
            <p className="text-xs text-slate-500">Diseño Universal para el Aprendizaje - Modelo ERCA</p>
          </div>
          <button 
            onClick={() => router.push('/planificador')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-lg transition"
          >
            Volver al Panel
          </button>
        </div>

        {mensaje && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-medium border shadow-sm ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleActualizarPlanificacion} className="space-y-8">
          
          {/* ESTADO Y DATOS INFORMATIVOS */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>📌</span> 1. Datos Informativos y Estado del Documento
              </h2>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Estado:</label>
                <select 
                  value={estado} 
                  onChange={(e) => setEstado(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-xs uppercase bg-white text-blue-900"
                >
                  <option value="borrador">Borrador (En Edición)</option>
                  <option value="enviado">Enviado para Revisión Rectoral</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Título del Plan / Tema de la Clase</label>
                <input 
                  type="text" 
                  required 
                  value={titulo} 
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Subnivel Educativo</label>
                <select 
                  value={subnivel} 
                  onChange={(e) => setSubnivel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 outline-none"
                >
                  <option value="Educación Inicial">Educación Inicial</option>
                  <option value="Básica Preparatoria">Básica Preparatoria (1º EGB)</option>
                  <option value="Básica Elemental">Básica Elemental (2º, 3º, 4º EGB)</option>
                  <option value="Básica Media">Básica Media (5º, 6º, 7º EGB)</option>
                  <option value="Básica Superior">Básica Superior (8º, 9º, 10º EGB)</option>
                  <option value="Bachillerato General Unificado">Bachillerato General Unificado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Grado / Curso</label>
                <input 
                  type="text" 
                  required 
                  value={grado} 
                  onChange={(e) => setGrado(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Asignatura</label>
                <input 
                  type="text" 
                  required 
                  value={asignatura} 
                  onChange={(e) => setAsignatura(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Paralelo</label>
                <input 
                  type="text" 
                  value={paralelo} 
                  onChange={(e) => setParalelo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 outline-none"
                />
              </div>
            </div>
          </div>

          {/* ALINEACIÓN CURRICULAR */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span></span> 2. Objetivos e Indicadores
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Objetivos de Aprendizaje</label>
                <textarea 
                  rows={3} 
                  value={objetivos} 
                  onChange={(e) => setObjetivos(e.target.value)}
                  className="w-full p-4 rounded-lg border border-slate-300 text-slate-900 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Criterios de Evaluación</label>
                <textarea 
                  rows={2} 
                  value={criterios} 
                  onChange={(e) => setCriterios(e.target.value)}
                  className="w-full p-4 rounded-lg border border-slate-300 text-slate-900 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Indicadores de Evaluación</label>
                <textarea 
                  rows={2} 
                  value={indicadores} 
                  onChange={(e) => setIndicadores(e.target.value)}
                  className="w-full p-4 rounded-lg border border-slate-300 text-slate-900 text-sm outline-none"
                />
              </div>
            </div>
          </div>

          {/* ESTRATEGIAS DUA Y ERCA */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span></span> 3. Estrategias DUA y ERCA
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Actividades de Aprendizaje (Ciclo ERCA con DUA)</label>
                <textarea 
                  rows={5} 
                  value={estrategiasDua} 
                  onChange={(e) => setEstrategiasDua(e.target.value)}
                  className="w-full p-4 rounded-lg border border-slate-300 text-slate-900 text-sm outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Recursos Didácticos</label>
                  <textarea 
                    rows={3} 
                    value={recursos} 
                    onChange={(e) => setRecursos(e.target.value)}
                    className="w-full p-4 rounded-lg border border-slate-300 text-slate-900 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Actividades de Evaluación</label>
                  <textarea 
                    rows={3} 
                    value={evaluacion} 
                    onChange={(e) => setEvaluacion(e.target.value)}
                    className="w-full p-4 rounded-lg border border-slate-300 text-slate-900 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Adaptaciones Curriculares (Atención a la Diversidad / NEE)</label>
                <textarea 
                  rows={3} 
                  value={adaptaciones} 
                  onChange={(e) => setAdaptaciones(e.target.value)}
                  className="w-full p-4 rounded-lg border border-slate-300 text-slate-900 text-sm outline-none"
                />
              </div>
            </div>
          </div>

          {/* BOTÓN DE GUARDAR */}
          <div className="flex justify-end gap-4">
            <button 
              type="button"
              onClick={() => router.push('/planificador')}
              className="px-6 py-3 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={guardando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition disabled:opacity-50"
            >
              {guardando ? 'Guardando Cambios...' : '💾 Guardar Cambios'}
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}