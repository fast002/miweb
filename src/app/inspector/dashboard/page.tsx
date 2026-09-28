'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function DocenteDashboardPage() {
  const [cargando, setCargando] = useState(true)
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [nombreDocente, setNombreDocente] = useState('Docente')
  
  // Métricas reales del Dashboard
  const [pasesHoyCount, setPasesHoyCount] = useState(0)
  const [esquelasResumen, setEsquelasResumen] = useState({ leve: 0, grave: 0, muyGrave: 0 })
  const [asistenciaSubniveles, setAsistenciaSubniveles] = useState({ 
    elemental: 0, 
    media: 0, 
    superior: 0, 
    bachillerato: 0 
  })

  const cargarMetricas = useCallback(async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: docenteData } = await supabase
          .from('docentes')
          .select('nombres, apellidos')
          .eq('id', user.id)
          .single()

        if (docenteData) {
          setNombreDocente(`${docenteData.nombres || ''} ${docenteData.apellidos || ''}`.trim())
        }
      }

      // Obtener datos de la institución
      const { data: insts } = await supabase.from('instituciones').select('*').limit(1)
      if (insts && insts[0]) {
        setNombreInstitucion(insts[0].nombre_institucion || 'Unidad Educativa')
      }

      const hoy = new Date().toISOString().split('T')[0]

      // 1. Alerta de Retiros: Pases de Salida emitidos en el día
      const { count: countPases, error: errPases } = await supabase
        .from('pases_salida')
        .select('*', { count: 'exact', head: true })
        .eq('fecha', hoy)

      if (!errPases) setPasesHoyCount(countPases || 0)

      // 2. Reporte de Esquelas: Agrupadas por gravedad ('Leve', 'Grave', 'Muy Grave')
      const { data: esquelasData, error: errEsquelas } = await supabase
        .from('esquelas')
        .select('gravedad')

      if (!errEsquelas && esquelasData) {
        let l = 0, g = 0, mg = 0
        esquelasData.forEach(e => {
          const grav = (e.gravedad || 'Leve').toLowerCase()
          if (grav.includes('muy')) mg++
          else if (grav.includes('grave')) g++
          else l++
        })
        setEsquelasResumen({ leve: l, grave: g, muyGrave: mg })
      }

      // 3. KPIs de Asistencia: Asistencia general por subniveles basada en la tabla asistencias y estudiantes
      const { data: asistData, error: errAsist } = await supabase
        .from('asistencias')
        .select(`
          estado,
          estudiantes (grado_curso)
        `)
        .eq('fecha', hoy)

      if (!errAsist && asistData && asistData.length > 0) {
        // Corrección de sintaxis aplicada aquí con comas y tipos correctos
        const acumuladores: { [key: string]: { total: number; positivas: number } } = {
          elemental: { total: 0, positivas: 0 },
          media: { total: 0, positivas: 0 },
          superior: { total: 0, positivas: 0 },
          bachillerato: { total: 0, positivas: 0 }
        }

        asistData.forEach((item: any) => {
          const curso = (item.estudiantes?.grado_curso || '').toLowerCase()
          const estado = item.estado

          // Determinar subnivel escolar
          let subnivel = ''
          if (curso.includes('2do') || curso.includes('3ro') || curso.includes('4to')) subnivel = 'elemental'
          else if (curso.includes('5to') || curso.includes('6to') || curso.includes('7mo')) subnivel = 'media'
          else if (curso.includes('8vo') || curso.includes('9no') || curso.includes('10mo')) subnivel = 'superior'
          else if (curso.includes('1ro') || curso.includes('2do bgu') || curso.includes('3ro bgu') || curso.includes('bachillerato')) subnivel = 'bachillerato'

          if (subnivel && acumuladores[subnivel]) {
            acumuladores[subnivel].total += 1
            if (estado === 'Presente' || estado === 'Atraso') {
              acumuladores[subnivel].positivas += 1
            }
          }
        })

        setAsistenciaSubniveles({
          elemental: acumuladores.elemental.total > 0 ? Math.round((acumuladores.elemental.positivas / acumuladores.elemental.total) * 100) : 100,
          media: acumuladores.media.total > 0 ? Math.round((acumuladores.media.positivas / acumuladores.media.total) * 100) : 100,
          superior: acumuladores.superior.total > 0 ? Math.round((acumuladores.superior.positivas / acumuladores.superior.total) * 100) : 100,
          bachillerato: acumuladores.bachillerato.total > 0 ? Math.round((acumuladores.bachillerato.positivas / acumuladores.bachillerato.total) * 100) : 100,
        })
      }

    } catch (err) {
      console.error('Error cargando métricas del docente:', err)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarMetricas()
  }, [cargarMetricas])

  if (cargando) {
    return <div className="p-10 text-slate-900 font-bold bg-slate-50 min-h-screen">Cargando panel docente...</div>
  }

  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-8 bg-slate-50 min-h-screen text-slate-900">
      
      {/* Encabezado del Dashboard */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
            Portal Docente
          </span>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-2">¡Bienvenido(a), {nombreDocente}!</h1>
          <p className="text-xs font-bold text-slate-500">{nombreInstitucion} — Resumen operativo y seguimiento estudiantil.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={cargarMetricas}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border transition cursor-pointer"
          >
            🔄 Actualizar Datos
          </button>
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            ● Jornada Activa
          </div>
        </div>
      </div>

      {/* SECCIÓN DE KPIS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Alerta de Retiros (Pases de Salida hoy) */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between border-l-4 border-l-indigo-600">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Control Institucional</span>
            <h3 className="text-lg font-black text-slate-800 mt-1">Pases de Salida Emitidos</h3>
            <p className="text-xs text-slate-500 mt-1">Alumnos retirados con autorización durante el día.</p>
          </div>
          <div className="mt-6 flex items-baseline justify-between">
            <span className="text-4xl font-black text-indigo-600">{pasesHoyCount}</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">Estudiantes Hoy</span>
          </div>
        </div>

        {/* Resumen de Esquelas Disciplinarias */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between border-l-4 border-l-amber-500 md:col-span-2">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Convivencia Escolar</span>
            <h3 className="text-lg font-black text-slate-800 mt-1">Reporte de Esquelas Registradas</h3>
            <p className="text-xs text-slate-500 mt-1">Clasificación disciplinaria según el grado de gravedad.</p>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 md:gap-4 text-center">
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
              <span className="block text-[10px] font-black uppercase text-amber-800">Leves</span>
              <span className="text-2xl font-black text-amber-900">{esquelasResumen.leve}</span>
            </div>
            <div className="bg-orange-50 p-3 rounded-xl border border-orange-200">
              <span className="block text-[10px] font-black uppercase text-orange-800">Graves</span>
              <span className="text-2xl font-black text-orange-900">{esquelasResumen.grave}</span>
            </div>
            <div className="bg-red-50 p-3 rounded-xl border border-red-200">
              <span className="block text-[10px] font-black uppercase text-red-800">Muy Graves</span>
              <span className="text-2xl font-black text-red-900">{esquelasResumen.muyGrave}</span>
            </div>
          </div>
        </div>

      </div>

      {/* KPI DE ASISTENCIA POR SUBNIVELES */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
        <div>
          <h3 className="text-sm font-black uppercase text-slate-800 tracking-wide">KPIs de Asistencia General por Subniveles</h3>
          <p className="text-xs font-bold text-slate-400">Porcentaje de asistencia escolar consolidado por niveles educativos en la fecha actual.</p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Básica Elemental (2do, 3ro, 4to EGB)</span>
              <span className="text-emerald-600 font-black">{asistenciaSubniveles.elemental}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${asistenciaSubniveles.elemental}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Básica Media (5to, 6to, 7mo EGB)</span>
              <span className="text-blue-600 font-black">{asistenciaSubniveles.media}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${asistenciaSubniveles.media}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Básica Superior (8vo, 9no, 10mo EGB)</span>
              <span className="text-indigo-600 font-black">{asistenciaSubniveles.superior}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${asistenciaSubniveles.superior}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Bachillerato (1ro, 2do, 3ro BGU)</span>
              <span className="text-purple-600 font-black">{asistenciaSubniveles.bachillerato}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${asistenciaSubniveles.bachillerato}%` }}></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}