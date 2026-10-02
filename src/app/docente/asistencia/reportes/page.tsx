'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ReporteAsistenciaPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)

  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('Usuario')
  const [rolUsuario, setRolUsuario] = useState('docente')
  const [institucionId, setInstitucionId] = useState('')

  // Control Dinámico de Años Lectivos Sincronizado con periodos_disponibles de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Carga Horaria Asignada por el Rector estrictamente del año vigente
  const [misAsignaciones, setMisAsignaciones] = useState<any[]>([])

  // Filtros de reporte
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('')
  const [asignatura, setAsignatura] = useState('')
  const [trimestre, setTrimestre] = useState('Trimestre 1')
  const [listaAsignaturas, setListaAsignaturas] = useState<string[]>([])

  // Datos consolidados
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [reporteMap, setReporteMap] = useState<{ [estId: string]: { [estado: string]: number } }>({})

  // Determinar si es docente de aula (EGB Elemental y Media)
  const esDocenteDeAula = ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB', '5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'].includes(grado)

  // 1. Cargar perfil, institución, año dinámico desde periodos_disponibles y asignaciones
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return; }

        const { data: doc } = await supabase.from('docentes').select('*, instituciones(*)').eq('id', user.id).maybeSingle()
        
        let anioActivo = ''
        let periodosList: string[] = []
        let cerradosList: string[] = []

        if (doc) {
          setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
          setNombreUsuario(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim() || 'Docente')
          setRolUsuario(doc.rol || 'docente')
          
          if (doc.institucion_id) {
            setInstitucionId(doc.institucion_id)
          }

          const inst = doc.instituciones
          if (inst) {
            periodosList = inst.periodos_disponibles || []

            if (inst.anio_lectivo_activo && periodosList.includes(inst.anio_lectivo_activo)) {
              anioActivo = inst.anio_lectivo_activo
            } else if (periodosList.length > 0) {
              anioActivo = periodosList[0]
            }

            setAnioLectivoVigente(anioActivo)

            if (inst.anos_cerrados) {
              cerradosList = inst.anos_cerrados
              setAnosCerrados(cerradosList)
            }
          }
        }

        // Cargar Asignaciones estrictamente del año lectivo vigente detectado
        if (anioActivo) {
          const { data: asignacionesData } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asignacionesData && asignacionesData.length > 0) {
            setMisAsignaciones(asignacionesData)
            setGrado(asignacionesData[0].grado_curso)
            setParalelo(asignacionesData[0].paralelo)
            setAsignatura(asignacionesData[0].asignatura)
          } else {
            setMisAsignaciones([])
          }
        } else {
          setMisAsignaciones([])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setCargando(false)
      }
    }
    init()
  }, [router])

  // Manejar cambio de Grado desde las asignaciones
  const handleGradoChange = (nuevoGrado: string) => {
    setGrado(nuevoGrado)
    const paralelosDeGrado = Array.from(new Set(misAsignaciones.filter(a => a.grado_curso === nuevoGrado).map(a => a.paralelo)))
    if (paralelosDeGrado.length > 0) {
      setParalelo(paralelosDeGrado[0])
      const asigMatch = misAsignaciones.find(a => a.grado_curso === nuevoGrado && a.paralelo === paralelosDeGrado[0])
      if (asigMatch) setAsignatura(asigMatch.asignatura)
    }
  }

  // 2. Cargar asignaturas según el subnivel y carga horaria del año vigente
  useEffect(() => {
    async function cargarAsignaturasConfiguradas() {
      if (!institucionId || !grado) return

      if (esDocenteDeAula) {
        setListaAsignaturas(['Asistencia General (Aula)'])
        setAsignatura('Asistencia General (Aula)')
        return
      }

      const materiasDelGrado = Array.from(new Set(
        misAsignaciones
          .filter(a => a.grado_curso === grado && a.paralelo === paralelo)
          .map(a => a.asignatura)
      ))

      const mats = materiasDelGrado.length > 0 ? materiasDelGrado : ['Matemática', 'Lengua y Literatura']
      setListaAsignaturas(mats)
      if (!mats.includes(asignatura)) {
        setAsignatura(mats[0])
      }
    }
    cargarAsignaturasConfiguradas()
  }, [grado, paralelo, institucionId, esDocenteDeAula, misAsignaciones, asignatura])

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  // 3. Cargar datos y consolidar conteos de asistencia estrictamente del año vigente
  const cargarConsolidado = useCallback(async () => {
    if (!institucionId || !grado || !anioLectivoVigente) return
    setCargando(true)
    try {
      const { data: ests } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', grado)
        .eq('paralelo', paralelo)
        .eq('anio_lectivo', anioLectivoVigente)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      setEstudiantes(ests || [])

      if (ests && ests.length > 0) {
        const estIds = ests.map(e => e.id)

        let query = supabase
          .from('asistencias')
          .select('estudiante_id, estado, asignatura')
          .in('estudiante_id', estIds)
          .eq('trimestre', trimestre)
          .eq('anio_lectivo', anioLectivoVigente)

        if (!esDocenteDeAula) {
          query = query.eq('asignatura', asignatura.trim())
        }

        const { data: asists } = await query

        const conteo: { [estId: string]: { [estado: string]: number } } = {}
        ests.forEach(e => {
          conteo[e.id] = { Presente: 0, Atraso: 0, 'Falta Justificada': 0, 'Falta Injustificada': 0 }
        })

        asists?.forEach(a => {
          if (conteo[a.estudiante_id] && conteo[a.estudiante_id][a.estado] !== undefined) {
            conteo[a.estudiante_id][a.estado] += 1
          }
        })

        setReporteMap(conteo)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }, [institucionId, grado, paralelo, asignatura, trimestre, esDocenteDeAula, anioLectivoVigente])

  useEffect(() => {
    cargarConsolidado()
  }, [cargarConsolidado])

  // Listas únicas filtradas de las asignaciones para el año vigente
  const gradosUnicos = Array.from(new Set(misAsignaciones.map(a => a.grado_curso)))
  const paralelosDisponibles = Array.from(new Set(misAsignaciones.filter(a => a.grado_curso === grado).map(a => a.paralelo)))

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Reporte de Asistencia...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Consolidado de Asistencia • {anioLectivoVigente || 'Sin año activo'}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Reporte General y Estadísticas de Asistencia
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {nombreInstitucion} • Docente: <span className="text-slate-700">{nombreUsuario}</span> ({rolUsuario.toUpperCase()})
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => router.push('/docente/asistencia')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer"
          >
            ← Volver al Registro Diario
          </button>
        </div>
      </div>

      {/* AVISO SI NO HAY AÑO ACTIVO */}
      {!anioLectivoVigente && !cargando && (
        <div 
          style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
          className="border p-4 rounded-2xl text-xs font-bold shadow-2xs"
        >
          La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
        </div>
      )}

      {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
      {esAnioCerrado && anioLectivoVigente && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. El reporte de asistencia está en modo de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Modo Archivo</span>
        </div>
      )}

      {/* FILTROS DE REPORTE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Grado / Curso</label>
          <select
            value={grado}
            onChange={(e) => handleGradoChange(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
          >
            {gradosUnicos.length === 0 ? (
              <option value="" className="text-slate-900 font-bold bg-white">Sin carga asignada</option>
            ) : (
              gradosUnicos.map((g) => <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>)
            )}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo</label>
          <select
            value={paralelo}
            onChange={(e) => setParalelo(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
          >
            {paralelosDisponibles.map((p) => (
              <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Asignatura</label>
          {esDocenteDeAula ? (
            <input
              type="text"
              disabled
              value="Asistencia General (Aula)"
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 cursor-not-allowed shadow-2xs"
            />
          ) : (
            <select
              value={asignatura}
              onChange={(e) => setAsignatura(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
            >
              {listaAsignaturas.map(mat => (
                <option key={mat} value={mat} className="text-slate-900 font-bold bg-white">{mat}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#4b4c99] uppercase mb-1.5">Trimestre / Periodo</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            className="w-full p-3 border-2 border-indigo-300 rounded-xl text-xs font-black text-indigo-900 bg-indigo-50 outline-none shadow-2xs cursor-pointer"
          >
            <option value="Trimestre 1" className="text-slate-900 font-bold bg-white">Trimestre 1</option>
            <option value="Trimestre 2" className="text-slate-900 font-bold bg-white">Trimestre 2</option>
            <option value="Trimestre 3" className="text-slate-900 font-bold bg-white">Trimestre 3</option>
          </select>
        </div>
      </div>

      {/* TABLA MATRIZ CONSOLIDADA */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold uppercase text-slate-900">
          <span>
            Consolidado: {grado} "{paralelo}" — {esDocenteDeAula ? 'Registro General' : asignatura} ({trimestre} - {anioLectivoVigente || 'Sin periodo'})
          </span>
          <span className="text-[10px] text-slate-500">
            Total Estudiantes: {estudiantes.length}
          </span>
        </div>

        {!anioLectivoVigente ? (
          <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50/50">
            No hay un año lectivo activo configurado en la institución.
          </div>
        ) : misAsignaciones.length === 0 ? (
          <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50/50">
            No tienes carga horaria asignada para el periodo vigente ({anioLectivoVigente}).
          </div>
        ) : cargando ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            Generando reporte consolidado...
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No hay registros o estudiantes activos en este curso para el periodo {anioLectivoVigente}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 min-w-[250px]">Estudiante</th>
                  <th className="p-3 text-center text-emerald-800 bg-emerald-50/30">Presentes</th>
                  <th className="p-3 text-center text-amber-800 bg-amber-50/30">Atrasos</th>
                  <th className="p-3 text-center text-indigo-800 bg-indigo-50/30">Faltas Justificadas</th>
                  <th className="p-3 text-center text-rose-800 bg-rose-50/30">Faltas Injustificadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {estudiantes.map((est, idx) => {
                  const datosEst = reporteMap[est.id] || { Presente: 0, Atraso: 0, 'Falta Justificada': 0, 'Falta Injustificada': 0 }

                  return (
                    <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                        {est.apellidos} {est.nombres}
                      </td>
                      <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/10">
                        {datosEst['Presente']}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-700 bg-amber-50/10">
                        {datosEst['Atraso']}
                      </td>
                      <td className="p-3 text-center font-bold text-indigo-700 bg-indigo-50/10">
                        {datosEst['Falta Justificada']}
                      </td>
                      <td className="p-3 text-center font-bold text-rose-700 bg-rose-50/10">
                        {datosEst['Falta Injustificada']}
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