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
                // Calcular promedios por estudiante y filtrar los menores al umbral
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
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Panel Docente...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full pb-12 selection:bg-[#f6c358]/30 selection:text-slate-950 font-sans">
      
      {/* 1. CABECERA DE BIENVENIDA ESTILO CLAYMORPHISM INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
          >
            Periodo Lectivo: {anioActivo}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
            ¡Bienvenido/a, Prof. {docenteInfo?.nombres} {docenteInfo?.apellidos}!
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {institucionNombre} • Panel de Gestión Docente
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 text-center shadow-2xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estudiantes</p>
            <p className="text-base font-bold text-slate-900">{totalEstudiantes}</p>
          </div>
          <div 
            style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)' }}
            className="px-4 py-3 rounded-2xl border text-center shadow-2xs"
          >
            <p className="text-[10px] font-bold text-[#b88611] uppercase tracking-wider">Alertas</p>
            <p className="text-base font-bold text-[#966b14]">{estudiantesRiesgo.length}</p>
          </div>
        </div>
      </div>

      {/* 2. TARJETAS DE ACCESOS RÁPIDOS (UTILIZANDO LOS 4 COLORES DE MARCA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Calificaciones (Índigo: #4b4c99) */}
        <Link 
          href="/docente/calificaciones" 
          className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div 
              style={{ backgroundColor: '#4b4c99' }}
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-[#4b4c99] transition-colors">Calificaciones</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Registrar notas, parciales y promedios quimestrales.</p>
          </div>
          <div style={{ color: '#4b4c99' }} className="mt-4 flex items-center text-[11px] font-bold gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

        {/* Control de Asistencia (Turquesa / Esmeralda: #45b3a5) */}
        <Link 
          href="/docente/asistencia" 
          className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div 
              style={{ backgroundColor: '#45b3a5' }}
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-[#389186] transition-colors">Control de Asistencia</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Llevar el registro diario de faltas y atrasos.</p>
          </div>
          <div style={{ color: '#389186' }} className="mt-4 flex items-center text-[11px] font-bold gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

        {/* Planificador Curricular (Índigo de marca: #4b4c99) */}
        <Link 
          href="/docente/planificador" 
          className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div 
              style={{ backgroundColor: '#4b4c99' }}
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-[#4b4c99] transition-colors">Planificador Curricular</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Crear planificaciones con Inteligencia Artificial basadas en DCD.</p>
          </div>
          <div style={{ color: '#4b4c99' }} className="mt-4 flex items-center text-[11px] font-bold gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

        {/* Mi Horario Escolar (Ámbar / Amarillo: #f6c358) */}
        <Link 
          href="/docente/horarios" 
          className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div 
              style={{ backgroundColor: '#f6c358', color: '#594107' }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform font-black"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-[#b88611] transition-colors">Mi Horario Escolar</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Consultar las horas de clase asignadas por la institución.</p>
          </div>
          <div style={{ color: '#b88611' }} className="mt-4 flex items-center text-[11px] font-bold gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

      </div>

      {/* 3. SECCIÓN DE ALERTAS Y CURSOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel de Alertas Académicas (Acento Coral: #de5860) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
              Alertas de Refuerzo (&lt; 8.0)
            </h2>
            <span 
              style={{ backgroundColor: 'rgba(246, 195, 88, 0.15)', color: '#966b14', borderColor: 'rgba(246, 195, 88, 0.4)' }}
              className="font-bold text-[10px] px-2.5 py-0.5 rounded-lg border"
            >
              {estudiantesRiesgo.length} Alumnos
            </span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {estudiantesRiesgo.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100">
                <p style={{ color: '#45b3a5' }} className="text-xs font-bold">¡Excelente noticia!</p>
                <p className="text-[11px] text-slate-500 mt-1 px-4 font-medium">No hay estudiantes con promedios inferiores a 8.0 en este momento.</p>
              </div>
            ) : (
              estudiantesRiesgo.map((alerta) => (
                <div 
                  key={alerta.id} 
                  style={{ backgroundColor: 'rgba(222, 88, 96, 0.04)', borderColor: 'rgba(222, 88, 96, 0.2)' }}
                  className="p-3 rounded-2xl border flex justify-between items-center shadow-2xs"
                >
                  <div>
                    <p className="font-bold text-slate-900 text-xs">{alerta.apellidos} {alerta.nombres}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{alerta.grado_curso} "{alerta.paralelo}"</p>
                  </div>
                  <div className="text-right">
                    <span 
                      style={{ backgroundColor: 'rgba(222, 88, 96, 0.1)', color: '#de5860', borderColor: 'rgba(222, 88, 96, 0.3)' }}
                      className="font-bold text-[11px] px-2.5 py-1 rounded-xl border"
                    >
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
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4 lg:col-span-2">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
              Mis Cursos y Asignaturas Asignadas
            </h2>
            <span 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
              className="font-bold text-[10px] px-2.5 py-0.5 rounded-lg border"
            >
              {misAsignaciones.length} Cursos
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {misAsignaciones.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10 col-span-full font-medium">No tienes asignaturas registradas para este periodo.</p>
            ) : (
              misAsignaciones.map((asig) => (
                <div key={asig.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60 shadow-2xs flex justify-between items-center transition-all hover:bg-slate-100/70">
                  <div>
                    <p className="font-bold text-slate-900 text-xs uppercase tracking-tight">{asig.asignatura}</p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{asig.grado_curso} "{asig.paralelo}" • {asig.jornada || 'Matutina'}</p>
                  </div>
                  <span 
                    style={{ color: '#45b3a5', backgroundColor: 'rgba(69, 179, 165, 0.1)', borderColor: 'rgba(69, 179, 165, 0.3)' }}
                    className="font-bold text-[10px] px-2.5 py-1 rounded-xl border"
                  >
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