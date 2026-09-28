'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function DocenteDashboardPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [docenteInfo, setDocenteInfo] = useState<any>(null)
  const [institucionNombre, setInstitucionNombre] = useState('')
  const [anioActivo, setAnioActivo] = useState('')
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])
  
  // Estados para Alertas Académicas y Resumen
  const [estudiantesRiesgo, setEstudiantesRiesgo] = useState<any[]>([])
  const [totalEstudiantes, setTotalEstudiantes] = useState(0)

  useEffect(() => {
    cargarDatosDocente()
  }, [])

  const cargarDatosDocente = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      // 1. Obtener datos del docente y su institución
      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (doc) {
        setDocenteInfo(doc)
        setInstitucionNombre(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setAnioActivo(doc.instituciones?.anio_lectivo_activo || '')

        // 2. Obtener las asignaciones de carga horaria de este docente
        const { data: asigs } = await supabase
          .from('docente_asignaciones')
          .select('*')
          .eq('docente_id', doc.id)
          .eq('anio_lectivo', doc.instituciones?.anio_lectivo_activo)

        if (asigs) {
          setMisAsignaciones(asigs)

          // 3. Buscar estudiantes y calificaciones para calcular alertas (< 8.0)
          if (asigs.length > 0) {
            const institucionId = doc.institucion_id
            const anio = doc.instituciones?.anio_lectivo_activo

            // Obtener estudiantes activos de la institución
            const { data: ests } = await supabase
              .from('estudiantes')
              .select('*')
              .eq('institucion_id', institucionId)
              .eq('anio_lectivo', anio)
              .eq('estado', 'activo')

            if (ests) {
              setTotalEstudiantes(ests.length)

              // Obtener calificaciones del periodo
              const { data: cals } = await supabase
                .from('calificaciones')
                .select('*')
                .eq('anio_lectivo', anio)

              if (cals) {
                // Calcular promedios por estudiante y filtrar los menores a 8.0
                const alertas: any[] = []
                ests.forEach((est) => {
                  const notasEst = cals.filter(c => c.estudiante_id === est.id)
                  if (notasEst.length > 0) {
                    const suma = notasEst.reduce((acc, curr) => acc + (Number(curr.promedio_parcial) || 0), 0)
                    const promedio = Number((suma / notasEst.length).toFixed(2))
                    if (promedio < 8.0 && promedio > 0) {
                      alertas.push({ ...est, promedio })
                    }
                  }
                })
                setEstudiantesRiesgo(alertas)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error cargando dashboard docente:', err)
    } finally {
      setCargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="text-center bg-white p-8 rounded-[36px] shadow-xl border-4 border-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Panel Docente...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full pb-12 selection:bg-[#f6c358] selection:text-slate-950">
      
      {/* 1. CABECERA DE BIENVENIDA ESTILO CLAYMORPHISM */}
      <div className="bg-white p-6 md:p-8 rounded-[36px] border-4 border-white shadow-[0_20px_50px_rgba(0,0,0,0.06),inset_0_2px_4px_rgba(255,255,255,0.8)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-[#4b4c99]/10 text-[#4b4c99] font-black text-[10px] px-3.5 py-1.5 rounded-2xl uppercase tracking-wider border-2 border-[#4b4c99]/20 shadow-inner">
            Periodo Lectivo: {anioActivo}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 mt-2.5 uppercase tracking-tight">
            ¡Bienvenido/a, Prof. {docenteInfo?.nombres} {docenteInfo?.apellidos}!
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {institucionNombre} • Panel de Gestión Docente
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="bg-slate-100 px-4 py-3 rounded-2xl border-2 border-white text-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Estudiantes</p>
            <p className="text-base font-black text-slate-800">{totalEstudiantes}</p>
          </div>
          <div className="bg-[#f6c358]/20 px-4 py-3 rounded-2xl border-2 border-amber-200 text-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
            <p className="text-[9px] font-black text-[#966b14] uppercase tracking-wider">Alertas</p>
            <p className="text-base font-black text-[#855d11]">{estudiantesRiesgo.length}</p>
          </div>
        </div>
      </div>

      {/* 2. TARJETAS DE ACCESOS RÁPIDOS ESTILO CLAYMORPHISM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Calificaciones */}
        <Link href="/docente/calificaciones" className="group bg-white p-6 rounded-[32px] border-4 border-white shadow-[0_15px_40px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] hover:shadow-[0_20px_50px_rgba(75,76,153,0.12)] transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30 border-2 border-white/40 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-sm tracking-tight group-hover:text-[#4b4c99] transition-colors">Calificaciones</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Registrar notas, parciales y promedios quimestrales.</p>
          </div>
          <div className="mt-4 flex items-center text-[11px] font-black text-[#4b4c99] gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

        {/* Control de Asistencia */}
        <Link href="/docente/asistencia" className="group bg-white p-6 rounded-[32px] border-4 border-white shadow-[0_15px_40px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] hover:shadow-[0_20px_50px_rgba(16,185,129,0.12)] transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30 border-2 border-white/40 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-sm tracking-tight group-hover:text-emerald-700 transition-colors">Control de Asistencia</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Llevar el registro diario de faltas y atrasos.</p>
          </div>
          <div className="mt-4 flex items-center text-[11px] font-black text-emerald-600 gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

        {/* Planificador Curricular */}
        <Link href="/docente/planificador" className="group bg-white p-6 rounded-[32px] border-4 border-white shadow-[0_15px_40px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] hover:shadow-[0_20px_50px_rgba(168,85,247,0.12)] transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30 border-2 border-white/40 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-sm tracking-tight group-hover:text-purple-700 transition-colors">Planificador Curricular</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Crear planificaciones con Inteligencia Artificial basadas en DCD.</p>
          </div>
          <div className="mt-4 flex items-center text-[11px] font-black text-purple-600 gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

        {/* Mi Horario Escolar */}
        <Link href="/docente/horarios" className="group bg-white p-6 rounded-[32px] border-4 border-white shadow-[0_15px_40px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] hover:shadow-[0_20px_50px_rgba(245,158,11,0.12)] transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30 border-2 border-white/40 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-sm tracking-tight group-hover:text-amber-700 transition-colors">Mi Horario Escolar</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Consultar las horas de clase asignadas por la institución.</p>
          </div>
          <div className="mt-4 flex items-center text-[11px] font-black text-amber-600 gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

      </div>

      {/* 3. SECCIÓN DE ALERTAS Y CURSOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel de Alertas Académicas */}
        <div className="bg-white rounded-[36px] border-4 border-white shadow-[0_20px_50px_rgba(0,0,0,0.06),inset_0_2px_4px_rgba(255,255,255,0.8)] p-6 space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
            <h2 className="font-black text-slate-800 text-xs uppercase tracking-wider">
              Alertas de Refuerzo (&lt; 8.0)
            </h2>
            <span className="px-3 py-1 bg-amber-100 text-amber-900 font-black text-[10px] rounded-2xl border border-amber-200">
              {estudiantesRiesgo.length} Alumnos
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {estudiantesRiesgo.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                <p className="text-xs text-emerald-600 font-black">¡Excelente noticia!</p>
                <p className="text-[11px] text-slate-500 mt-1 px-4">No hay estudiantes con promedios inferiores a 8.0 en este momento.</p>
              </div>
            ) : (
              estudiantesRiesgo.map((alerta) => (
                <div key={alerta.id} className="p-3.5 bg-amber-50/60 rounded-2xl border-2 border-amber-200/80 flex justify-between items-center shadow-2xs">
                  <div>
                    <p className="font-black text-slate-800 text-xs">{alerta.apellidos} {alerta.nombres}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{alerta.grado_curso} "{alerta.paralelo}"</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 bg-red-100 text-red-800 font-black text-[11px] rounded-xl border border-red-200">
                      {alerta.promedio.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-slate-400 text-center font-medium italic">
            * Sugerencia: Programar tutorías académicas o fichas de recuperación.
          </p>
        </div>

        {/* Mis Asignaciones */}
        <div className="bg-white rounded-[36px] border-4 border-white shadow-[0_20px_50px_rgba(0,0,0,0.06),inset_0_2px_4px_rgba(255,255,255,0.8)] p-6 space-y-4 lg:col-span-2">
          <div className="border-b-2 border-slate-100 pb-3 flex justify-between items-center">
            <h2 className="font-black text-slate-800 text-xs uppercase tracking-wider">
              Mis Cursos y Asignaturas Asignadas
            </h2>
            <span className="px-3 py-1 bg-[#4b4c99]/10 text-[#4b4c99] font-black text-[10px] rounded-2xl border border-[#4b4c99]/20">
              {misAsignaciones.length} Cursos
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {misAsignaciones.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10 col-span-full font-medium">No tienes asignaturas registradas para este periodo.</p>
            ) : (
              misAsignaciones.map((asig) => (
                <div key={asig.id} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 shadow-2xs flex justify-between items-center transition-all hover:bg-slate-100">
                  <div>
                    <p className="font-black text-slate-800 text-xs uppercase tracking-tight">{asig.asignatura}</p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{asig.grado_curso} "{asig.paralelo}" • {asig.jornada || 'Matutina'}</p>
                  </div>
                  <span className="px-3 py-1 bg-[#4b4c99]/10 text-[#4b4c99] font-black text-[10px] rounded-2xl border border-[#4b4c99]/20">
                    Activo
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  )
}