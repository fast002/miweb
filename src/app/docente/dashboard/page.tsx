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
        const anioInstitucion = doc.instituciones?.anio_lectivo_activo || ''
        setAnioActivo(anioInstitucion)

        // 2. Obtener las asignaciones de carga horaria de este docente
        const { data: asigs } = await supabase
          .from('docente_asignaciones')
          .select('*')
          .eq('docente_id', doc.id)
          .eq('anio_lectivo', anioInstitucion)

        if (asigs) {
          setMisAsignaciones(asigs)

          // 3. Buscar estudiantes y calificaciones para calcular alertas reales (< 8.0)
          if (asigs.length > 0) {
            const institucionId = doc.institucion_id

            // Cursos a cargo del docente
            const cursosDocente = Array.from(new Set(asigs.map(a => a.grado_curso).filter(Boolean)))
            const materiasDocente = Array.from(new Set(asigs.map(a => a.asignatura.trim().toUpperCase()).filter(Boolean)))

            // Obtener estudiantes activos en los cursos del docente
            let queryEsts = supabase
              .from('estudiantes')
              .select('*')
              .eq('institucion_id', institucionId)
              .eq('estado', 'activo')

            if (anioInstitucion) {
              queryEsts = queryEsts.eq('anio_lectivo', anioInstitucion)
            }
            if (cursosDocente.length > 0) {
              queryEsts = queryEsts.in('grado_curso', cursosDocente)
            }

            const { data: ests } = await queryEsts

            if (ests) {
              setTotalEstudiantes(ests.length)

              // Obtener calificaciones de este docente en el periodo activo
              let queryCals = supabase
                .from('calificaciones')
                .select('*')
                .eq('docente_id', doc.id)

              if (anioInstitucion) {
                queryCals = queryCals.eq('anio_lectivo', anioInstitucion)
              }

              const { data: cals } = await queryCals

              if (cals && cals.length > 0) {
                const alertas: any[] = []

                ests.forEach((est) => {
                  // Filtramos solo las materias de este docente que no sean exámenes supletorios
                  const notasEst = cals.filter(c => 
                    c.estudiante_id === est.id && 
                    c.trimestre !== 'SUPLETORIO' &&
                    materiasDocente.includes((c.asignatura || '').trim().toUpperCase())
                  )

                  if (notasEst.length > 0) {
                    const notasBase10: number[] = []

                    notasEst.forEach((reg) => {
                      // 1. Extraemos los insumos formativos individuales
                      const insumos = [
                        reg.insumo_1,
                        reg.insumo_2,
                        reg.insumo_3,
                        reg.insumo_4
                      ].map(Number).filter(n => !isNaN(n) && n > 0)

                      if (reg.refuerzo_pedagogico && Number(reg.refuerzo_pedagogico) > 0) {
                        insumos.push(Number(reg.refuerzo_pedagogico))
                      }

                      // 2. Extraemos las evaluaciones sumativas (proyecto o examen estructurado)
                      const evalProyecto = Number(reg.proyecto_interdisciplinar) || 0
                      const evalEstructurada = Number(reg.evaluacion_estructurada) || 0
                      const tieneSumativa = evalProyecto > 0 || evalEstructurada > 0

                      if (tieneSumativa) {
                        // CASO A: Ya se rindió el examen/sumativa -> usar el promedio trimestral completo sobre 10
                        const promTrimestral = Number(reg.promedio_parcial) || 0
                        if (promTrimestral > 0) {
                          notasBase10.push(promTrimestral)
                        }
                      } else if (insumos.length > 0) {
                        // CASO B: Aún NO hay examen -> evaluar los formativos sobre 10 directamente
                        const promFormativoPuro = insumos.reduce((a, b) => a + b, 0) / insumos.length
                        if (promFormativoPuro > 0) {
                          notasBase10.push(promFormativoPuro)
                        }
                      }
                    })

                    // Si hay notas evaluables, calculamos su promedio general en base 10
                    if (notasBase10.length > 0) {
                      const suma = notasBase10.reduce((acc, curr) => acc + curr, 0)
                      const promedioReal = Number((suma / notasBase10.length).toFixed(2))

                      // Solo alerta si realmente está por debajo de 8.00 sobre 10
                      if (promedioReal < 8.0 && promedioReal > 0) {
                        alertas.push({ ...est, promedio: promedioReal })
                      }
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
      
      {/* 1. CABECERA DE BIENVENIDA */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block"
          >
            Periodo Lectivo: {anioActivo || 'Sin periodo activo'}
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mis Alumnos</p>
            <p className="text-base font-bold text-slate-900">{totalEstudiantes}</p>
          </div>
          <div 
            style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)' }}
            className="px-4 py-3 rounded-2xl border text-center shadow-2xs"
          >
            <p className="text-[10px] font-bold text-[#b88611] uppercase tracking-wider">Alertas (&lt; 8.0)</p>
            <p className="text-base font-bold text-[#966b14]">{estudiantesRiesgo.length}</p>
          </div>
        </div>
      </div>

      {/* 2. TARJETAS DE ACCESOS RÁPIDOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Calificaciones */}
        <Link 
          href="/docente/calificaciones" 
          className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div 
              style={{ backgroundColor: '#4b4c99' }}
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-[#4b4c99] transition-colors">Calificaciones</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Registrar notas, tareas, lecciones y evaluaciones sumativas.</p>
          </div>
          <div style={{ color: '#4b4c99' }} className="mt-4 flex items-center text-[11px] font-bold gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

        {/* Control de Asistencia */}
        <Link 
          href="/docente/asistencia" 
          className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div 
              style={{ backgroundColor: '#45b3a5' }}
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Planificador Curricular */}
        <Link 
          href="/docente/planificador" 
          className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div 
              style={{ backgroundColor: '#4b4c99' }}
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-[#4b4c99] transition-colors">Planificador Curricular</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Crear planificaciones regulares y piloto por competencias.</p>
          </div>
          <div style={{ color: '#4b4c99' }} className="mt-4 flex items-center text-[11px] font-bold gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

        {/* Control Disciplina */}
        <Link 
          href="/docente/disciplina" 
          className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div 
              style={{ backgroundColor: '#f6c358', color: '#594107' }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform font-black"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-[#b88611] transition-colors">Control Disciplina</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">Registrar incidencias, reportes verbales y méritos estudiantiles.</p>
          </div>
          <div style={{ color: '#b88611' }} className="mt-4 flex items-center text-[11px] font-bold gap-1">
            <span>Acceder al módulo</span> →
          </div>
        </Link>

      </div>

      {/* 3. SECCIÓN DE ALERTAS Y CURSOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel de Alertas Académicas Reales (< 8.0) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                Alertas de Refuerzo (&lt; 8.0)
              </h2>
              <span className="text-[10px] text-slate-400 font-medium">Cálculo en base 10 real</span>
            </div>
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
                <p className="text-[11px] text-slate-500 mt-1 px-4 font-medium">
                  No hay estudiantes con promedio ponderado inferior a 8.0 en este momento.
                </p>
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
                    <p className="text-[10px] text-slate-500 font-semibold">{alerta.grado_curso} "{alerta.paralelo}" • {alerta.jornada || 'Matutina'}</p>
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
            Evalúa el desempeño actual sobre 10 (con o sin examen sumativo registrado).
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