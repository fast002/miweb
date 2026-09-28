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

  // Función para cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

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

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ENCABEZADO */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">
              PANEL DOCENTE • CONSOLIDADO DE ASISTENCIA ({anioLectivoVigente || 'Sin año activo'})
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Reporte General y Estadísticas de Asistencia
            </h1>
            <p className="text-xs text-slate-600 font-bold mt-1">
              {nombreInstitucion} • Docente: <span className="text-slate-900">{nombreUsuario}</span> ({rolUsuario.toUpperCase()})
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => router.push('/docente/asistencia')}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs rounded-xl border transition"
            >
              ← Volver al Registro Diario
            </button>
          </div>
        </div>

        {/* AVISO SI NO HAY AÑO ACTIVO */}
        {!anioLectivoVigente && !cargando && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-amber-900 text-xs font-bold">
            ⚠️ La Dirección aún no ha aperturado ni establecido un año lectivo activo en el sistema. Por favor, solicite al rector que configure y active el periodo escolar.
          </div>
        )}

        {/* AVISO SI EL PERIODO VIGENTE ESTÁ CERRADO */}
        {esAnioCerrado && anioLectivoVigente && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold flex items-center justify-between">
            <span>El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. El reporte de asistencia está en modo de solo lectura.</span>
            <span className="bg-red-200 px-2.5 py-1 rounded">Periodo Cerrado</span>
          </div>
        )}

        {/* FILTROS DE REPORTE */}
        <div className="bg-white p-4 rounded-2xl border shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Grado / Curso</label>
            <select
              value={grado}
              onChange={(e) => handleGradoChange(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
            >
              {gradosUnicos.length === 0 ? (
                <option value="">Sin carga asignada</option>
              ) : (
                gradosUnicos.map((g) => <option key={g} value={g}>{g}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Paralelo</label>
            <select
              value={paralelo}
              onChange={(e) => setParalelo(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
            >
              {paralelosDisponibles.map((p) => (
                <option key={p} value={p}>Paralelo {p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Asignatura</label>
            {esDocenteDeAula ? (
              <input
                type="text"
                disabled
                value="Asistencia General (Aula)"
                className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-500 bg-slate-200 cursor-not-allowed"
              />
            ) : (
              <select
                value={asignatura}
                onChange={(e) => setAsignatura(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none"
              >
                {listaAsignaturas.map(mat => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-indigo-700 uppercase mb-1">Trimestre / Periodo</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(e.target.value)}
              className="w-full p-2.5 border-2 border-indigo-400 rounded-xl text-xs font-black text-indigo-900 bg-indigo-50 outline-none"
            >
              <option value="Trimestre 1">Trimestre 1</option>
              <option value="Trimestre 2">Trimestre 2</option>
              <option value="Trimestre 3">Trimestre 3</option>
            </select>
          </div>
        </div>

        {/* TABLA MATRIZ CONSOLIDADA */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-100 border-b flex justify-between items-center">
            <span className="text-xs font-black uppercase text-slate-700">
              Consolidado: {grado} "{paralelo}" — {esDocenteDeAula ? 'Registro General' : asignatura} ({trimestre} - {anioLectivoVigente || 'Sin periodo'})
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Total Estudiantes: {estudiantes.length}
            </span>
          </div>

          {!anioLectivoVigente ? (
            <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50">
              ⚠️ No hay un año lectivo activo configurado en la institución.
            </div>
          ) : misAsignaciones.length === 0 ? (
            <div className="p-12 text-center text-amber-800 font-bold text-xs bg-amber-50">
              ⚠️ No tienes carga horaria asignada para el periodo vigente ({anioLectivoVigente}).
            </div>
          ) : cargando ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xs">
              Generando reporte consolidado...
            </div>
          ) : estudiantes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xs">
              No hay registros o estudiantes activos en este curso para el periodo {anioLectivoVigente}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-200 text-slate-900 font-black uppercase text-[10px]">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3 min-w-[250px]">Estudiante</th>
                    <th className="p-3 text-center text-emerald-800">Presentes</th>
                    <th className="p-3 text-center text-amber-800">Atrasos</th>
                    <th className="p-3 text-center text-blue-800">Faltas Justificadas</th>
                    <th className="p-3 text-center text-red-800">Faltas Injustificadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estudiantes.map((est, idx) => {
                    const datosEst = reporteMap[est.id] || { Presente: 0, Atraso: 0, 'Falta Justificada': 0, 'Falta Injustificada': 0 }

                    return (
                      <tr key={est.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-600 text-center">{idx + 1}</td>
                        <td className="p-3 font-black text-slate-900 text-sm whitespace-nowrap">
                          {est.apellidos} {est.nombres}
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-700">
                          {datosEst['Presente']}
                        </td>
                        <td className="p-3 text-center font-bold text-amber-700">
                          {datosEst['Atraso']}
                        </td>
                        <td className="p-3 text-center font-bold text-blue-700">
                          {datosEst['Falta Justificada']}
                        </td>
                        <td className="p-3 text-center font-bold text-red-700">
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
    </div>
  )
}