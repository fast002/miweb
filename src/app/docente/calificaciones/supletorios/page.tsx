'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SupletoriosPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [docenteId, setDocenteId] = useState('')
  const [nombreDocente, setNombreDocente] = useState('')

  // Control de Autoridades basado en la columna `rol` de la tabla docentes
  const [autoridadesDisponibles, setAutoridadesDisponibles] = useState<{ nombre: string; cargo: string }[]>([])
  const [autoridadSeleccionadaIndex, setAutoridadSeleccionadaIndex] = useState(0)

  // Control Dinámico de Años Lectivos Sincronizado con periodos_disponibles de la Institución
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setAnosCerrados] = useState<string[]>([])

  // Asignaciones del Rector filtradas desde 8vo en adelante para el año vigente
  const [asignacionesValidas, setAsignacionesValidas] = useState<any[]>([])
  
  // Filtros seleccionados
  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('')
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState('')

  // Listas de datos
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [calificacionesMap, setCalificacionesMap] = useState<{ [estudianteId: string]: { califFinal: number; exaSupletorio: string } }>({})

  useEffect(() => {
    cargarDatosDocente()
  }, [])

  useEffect(() => {
    if (gradoSeleccionado && paraleloSeleccionado && institucionId && anioLectivoVigente) {
      cargarEstudiantesYCalificaciones()
    }
  }, [gradoSeleccionado, paraleloSeleccionado, asignaturaSeleccionada, anioLectivoVigente, institucionId])

  // Validar si el grado pertenece a Básica Superior o Bachillerato (8vo en adelante)
  const esGradoValidoParaSupletorios = (grado: string) => {
    if (!grado) return false
    const gradosSuperioresOBachillerato = [
      '8vo EGB', '8vo Grado EGB', '9no EGB', '9no Grado EGB', '10mo EGB', '10mo Grado EGB',
      '1ro BGU', '2do BGU', '3ro BGU', '1ro BT', '2do BT', '3ro BT', '1ro Curso', '2do Curso', '3ro Curso'
    ]
    return gradosSuperioresOBachillerato.some(g => grado.toLowerCase().includes(g.toLowerCase()))
  }

  const cargarDatosDocente = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      setDocenteId(user.id)

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      let anioActivo = ''
      let periodosList: string[] = []
      let cerradosList: string[] = []
      let instId = ''

      if (doc) {
        setNombreDocente(`${doc.nombres || ''} ${doc.apellidos || ''}`.trim().toUpperCase())
        instId = doc.institucion_id || ''
        setInstitucionId(instId)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')
        setInstitucionLogo(doc.instituciones?.logo_url || '')

        const inst = doc.instituciones
        if (inst) {
          periodosList = inst.periodos_disponibles || []
          setPeriodosDisponibles(periodosList)

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

        // Cargar autoridades (Rector / Vicerrector / Director) de la misma institución evaluando la columna rol
        if (instId) {
          const { data: autoridadesData } = await supabase
            .from('docentes')
            .select('nombres, apellidos, rol')
            .eq('institucion_id', instId)
            
          if (autoridadesData) {
            const filtrados = autoridadesData.filter(d => {
              const r = (d.rol || '').toLowerCase()
              return r.includes('rector') || r.includes('vicerrector') || r.includes('director')
            })

            const listaAutoridades = filtrados.map(d => ({
              nombre: `${d.nombres || ''} ${d.apellidos || ''}`.trim().toUpperCase(),
              cargo: (d.rol || 'RECTOR').toUpperCase()
            }))
            
            if (listaAutoridades.length > 0) {
              setAutoridadesDisponibles(listaAutoridades)
              setAutoridadSeleccionadaIndex(0)
            } else {
              setAutoridadesDisponibles([{ nombre: 'RAUL PINOS', cargo: 'RECTOR' }])
              setAutoridadSeleccionadaIndex(0)
            }
          }
        }

        // Cargar asignaciones del docente estrictamente del año vigente
        if (anioActivo) {
          const { data: asigs } = await supabase
            .from('docente_asignaciones')
            .select('*')
            .eq('docente_id', user.id)
            .eq('anio_lectivo', anioActivo)

          if (asigs && asigs.length > 0) {
            const filtradas = asigs.filter(a => esGradoValidoParaSupletorios(a.grado_curso))
            setAsignacionesValidas(filtradas)

            if (filtradas.length > 0) {
              setGradoSeleccionado(filtradas[0].grado_curso)
              setParaleloSeleccionado(filtradas[0].paralelo)
              setAsignaturaSeleccionada(filtradas[0].asignatura)
            }
          } else {
            setAsignacionesValidas([])
          }
        } else {
          setAsignacionesValidas([])
        }
      }
    } catch (err) {
      console.error('Error al cargar datos de supletorios:', err)
    } finally {
      setCargando(false)
    }
  }

  const cargarEstudiantesYCalificaciones = async () => {
    try {
      const { data: estData } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('institucion_id', institucionId)
        .eq('grado_curso', gradoSeleccionado)
        .eq('paralelo', paraleloSeleccionado)
        .eq('anio_lectivo', anioLectivoVigente)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      if (estData) {
        setEstudiantes(estData)

        const estIds = estData.map(e => e.id)
        
        // Consultar todas las calificaciones de estos estudiantes para esta materia y año
        const { data: calData } = await supabase
          .from('calificaciones')
          .select('*')
          .eq('docente_id', docenteId)
          .eq('asignatura', asignaturaSeleccionada)
          .eq('anio_lectivo', anioLectivoVigente)
          .in('estudiante_id', estIds.length > 0 ? estIds : ['none'])

        const nuevoMapa: { [key: string]: { califFinal: number; exaSupletorio: string } } = {}
        
        estData.forEach(est => {
          const regSupletorio = calData?.find(c => c.estudiante_id === est.id && c.trimestre === 'SUPLETORIO')
          const registrosTrimestrales = calData?.filter(c => c.estudiante_id === est.id && c.trimestre !== 'SUPLETORIO') || []
          
          let califFinalCalculada = 0
          if (registrosTrimestrales.length > 0) {
            const sumaCalificaciones = registrosTrimestrales.reduce((acc, curr) => {
              const notaVal = curr.calificacion_final || curr.promedio_parcial || curr.calificacion || 0
              return acc + Number(notaVal)
            }, 0)
            califFinalCalculada = Number((sumaCalificaciones / registrosTrimestrales.length).toFixed(2))
          } else {
            const regGeneral = calData?.find(c => c.estudiante_id === est.id && !c.trimestre)
            califFinalCalculada = regGeneral?.calificacion_final || regGeneral?.promedio_parcial || 0
          }

          const valorSupletorioBD = regSupletorio?.examen_supletorio ?? regSupletorio?.ex_supletorio ?? regSupletorio?.supletorio ?? ''
          const valorSupletorioTexto = valorSupletorioBD !== '' && valorSupletorioBD !== null ? valorSupletorioBD.toString() : ''

          nuevoMapa[est.id] = {
            califFinal: califFinalCalculada,
            exaSupletorio: valorSupletorioTexto
          }
        })

        setCalificacionesMap(nuevoMapa)
      }
    } catch (err) {
      console.error('Error al cargar estudiantes:', err)
    }
  }

  const esAnioCerrado = anosCerrados.includes(anioLectivoVigente)

  const handleCambioSupletorio = (estudianteId: string, valor: string) => {
    if (esAnioCerrado) return
    setCalificacionesMap(prev => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        exaSupletorio: valor
      }
    }))
  }

  const handleGuardarSupletorios = async () => {
    if (esAnioCerrado) {
      alert('🔒 Este año lectivo está cerrado. No se pueden guardar notas supletorias.')
      return
    }

    setGuardando(true)
    setMensaje(null)

    try {
      for (const est of estudiantes) {
        const datosEst = calificacionesMap[est.id]
        if (!datosEst) continue

        const exaNum = datosEst.exaSupletorio.trim() !== '' ? parseFloat(datosEst.exaSupletorio) : null

        const { error: errorUpsert } = await supabase
          .from('calificaciones')
          .upsert({
            estudiante_id: est.id,
            docente_id: docenteId,
            asignatura: asignaturaSeleccionada,
            trimestre: 'SUPLETORIO',
            examen_supletorio: exaNum,
            anio_lectivo: anioLectivoVigente
          }, { onConflict: 'estudiante_id,docente_id,asignatura,trimestre,anio_lectivo' })

        if (errorUpsert) {
          throw new Error(errorUpsert.message)
        }
      }

      setMensaje({ tipo: 'exito', texto: `¡Exámenes supletorios guardados con éxito para el periodo ${anioLectivoVigente}!` })
      await cargarEstudiantesYCalificaciones()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar supletorios: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Módulo de Supletorios...</p>
        </div>
      </div>
    )
  }

  const autoridadActual = autoridadesDisponibles[autoridadSeleccionadaIndex] || { nombre: 'RAUL PINOS', cargo: 'RECTOR' }

  if (asignacionesValidas.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs max-w-md text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-base font-black text-slate-900">Módulo No Disponible para su Nivel</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Los exámenes supletorios aplican únicamente desde 8vo de EGB en adelante (Básica Superior y Bachillerato) para el periodo vigente ({anioLectivoVigente || 'Sin año activo'}).
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => router.push('/docente')}
              className="px-4 py-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition"
            >
              ← Menú Docente
            </button>
            <button
              onClick={() => router.push('/calificaciones')}
              className="px-4 py-2.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300 transition"
            >
              Volver a Calificaciones
            </button>
          </div>
        </div>
      </div>
    )
  }

  const gradosUnicos = Array.from(new Set(asignacionesValidas.map(a => a.grado_curso)))
  const paralelosPermitidos = Array.from(new Set(asignacionesValidas.filter(a => a.grado_curso === gradoSeleccionado).map(a => a.paralelo)))
  const asignaturasPermitidas = Array.from(new Set(asignacionesValidas.filter(a => a.grado_curso === gradoSeleccionado && a.paralelo === paraleloSeleccionado).map(a => a.asignatura)))

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 print:p-0 print:bg-white">
      
      {/* REGLA CSS GLOBAL DE IMPRESIÓN CON MARCOS EXTERIORES TIPO MATRIZ INSTITUCIONAL */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden;
          }
          #printable-supletorios-area, #printable-supletorios-area * {
            visibility: visible;
          }
          #printable-supletorios-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
            border: 2px solid #0f172a !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          table th, table td {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6 print:space-y-1 print:max-w-none">

        {/* ENCABEZADO Y CONTROLES SUPERIORES */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div>
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase">
              Módulo Académico • Exámenes Supletorios 📝 ({anioLectivoVigente || 'Sin año activo'})
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Registro y Cálculo de Supletorios
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {nombreInstitucion} • Exclusivo Básica Superior y Bachillerato
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border px-3 py-1.5 rounded-xl">
              <label className="text-[10px] font-black text-slate-700 uppercase">Firma:</label>
              <select
                value={autoridadSeleccionadaIndex}
                onChange={(e) => setAutoridadSeleccionadaIndex(Number(e.target.value))}
                className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
              >
                {autoridadesDisponibles.map((aut, idx) => (
                  <option key={idx} value={idx}>{aut.nombre} ({aut.cargo})</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
            >
              🖨️ Imprimir Reporte
            </button>
          </div>
        </div>

        {esAnioCerrado && anioLectivoVigente && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-900 text-xs font-bold flex items-center justify-between print:hidden">
            El año lectivo vigente ({anioLectivoVigente}) ha sido cerrado y bloqueado por la Dirección. El módulo de supletorios está en modo de solo lectura.
            <span className="bg-red-200 px-2.5 py-1 rounded">Periodo Cerrado</span>
          </div>
        )}

        {mensaje && (
          <div className={`p-4 rounded-xl text-sm font-bold border print:hidden ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {/* SELECTORES DE FILTRO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Grado / Curso:</label>
            <select
              value={gradoSeleccionado}
              onChange={(e) => {
                const nuevoGrado = e.target.value
                setGradoSeleccionado(nuevoGrado)
                const par = asignacionesValidas.find(a => a.grado_curso === nuevoGrado)?.paralelo || 'A'
                setParaleloSeleccionado(par)
              }}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {gradosUnicos.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Paralelo:</label>
            <select
              value={paraleloSeleccionado}
              onChange={(e) => setParaleloSeleccionado(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {paralelosPermitidos.map(p => (
                <option key={p} value={p}>Paralelo {p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Asignatura:</label>
            <select
              value={asignaturaSeleccionada}
              onChange={(e) => setAsignaturaSeleccionada(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {asignaturasPermitidas.map(mat => (
                <option key={mat} value={mat}>{mat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLA DE SUPLEMENTORIOS CON MARCOS EXTERIORES E INTERIORES DEFINIDOS */}
        <div id="printable-supletorios-area" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 print:border-2 print:border-slate-900 print:rounded-none print:shadow-none print:p-4">
          
          {/* ENCABEZADO MINISTERIAL (SOLO APARECE AL IMPRIMIR) */}
          <div className="hidden print:flex border-b-2 border-slate-900 pb-2 justify-between items-center mb-2">
            <div className="flex items-center gap-3 text-left">
              {institucionLogo ? (
                <img src={institucionLogo} alt="Logo Institución" className="w-12 h-12 object-contain" />
              ) : (
                <img src="https://upload.wikimedia.org/wikipedia/commons/e/e8/Escudo_del_Ecuador_%28oficial%29.svg" alt="Escudo Ecuador" className="w-10 h-10 object-contain" />
              )}
              <div>
                <h2 className="text-xs font-black uppercase text-slate-900">{nombreInstitucion || 'UNIDAD EDUCATIVA GUAPAN'}</h2>
                <p className="text-[9px] font-black text-slate-800">CÓDIGO AMIE: 03H00278 • Azogues - Ecuador</p>
                <p className="text-[9px] font-black text-indigo-900 uppercase mt-0.5">CONSOLIDADO GENERAL DE RENDIMIENTO ACADÉMICO</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase bg-slate-200 px-2 py-0.5 border border-slate-800 rounded text-slate-900">
                PERIODO {anioLectivoVigente || 'S/N'}
              </span>
            </div>
          </div>

          {/* DATOS INFORMATIVOS (SOLO APARECE AL IMPRIMIR) */}
          <div className="hidden print:grid grid-cols-2 gap-x-6 gap-y-0.5 text-[10px] border border-slate-800 p-2 bg-slate-50 rounded font-bold text-slate-900 mb-2">
            <div><strong>ASIGNATURA:</strong> {asignaturaSeleccionada || 'N/A'}</div>
            <div><strong>PARALELO:</strong> {paraleloSeleccionado || 'N/A'}</div>
            <div><strong>GRADO / CURSO:</strong> {gradoSeleccionado || 'N/A'}</div>
            <div><strong>JORNADA:</strong> MATUTINA</div>
            <div><strong>DOCENTE:</strong> {nombreDocente}</div>
            <div><strong>AUTORIDAD:</strong> {autoridadActual.nombre} ({autoridadActual.cargo})</div>
          </div>

          <div className="p-4 bg-slate-900 text-white flex justify-between items-center print:hidden">
            <h2 className="text-xs font-black uppercase tracking-wider">
              Materia: {asignaturaSeleccionada || 'Seleccione materia'} • {gradoSeleccionado} "{paraleloSeleccionado}" ({anioLectivoVigente || 'Sin año activo'})
            </h2>
            {!esAnioCerrado && anioLectivoVigente && (
              <button
                onClick={handleGuardarSupletorios}
                disabled={guardando}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
              >
                {guardando ? 'Guardando...' : '💾 Guardar Notas Supletorias'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto p-4 print:p-0">
            <table className="w-full text-xs text-left border-collapse border border-slate-200 print:border-2 print:border-slate-900">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] print:bg-slate-200 print:text-slate-950">
                <tr>
                  <th className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center w-10">Nro</th>
                  <th className="p-2 border border-slate-200 print:border-2 print:border-slate-900 w-28">Cédula</th>
                  <th className="p-2 border border-slate-200 print:border-2 print:border-slate-900">Apellidos y Nombres</th>
                  <th className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center w-24 bg-amber-50">Calif. Final</th>
                  <th className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center w-28 bg-amber-100 text-slate-900">Exa. Supletorio</th>
                  <th className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center w-24 bg-indigo-50">Promedio Final</th>
                  <th className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center w-20">Cualit.</th>
                  <th className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center w-32">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-900">
                {!anioLectivoVigente ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-amber-800 font-bold bg-amber-50">
                      ⚠️ No hay un año lectivo activo configurado en la institución.
                    </td>
                  </tr>
                ) : estudiantes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                      No hay estudiantes matriculados en este curso y paralelo para el periodo {anioLectivoVigente}.
                    </td>
                  </tr>
                ) : (
                  estudiantes.map((est, idx) => {
                    const datos = calificacionesMap[est.id] || { califFinal: 0, exaSupletorio: '' }
                    const exaNum = datos.exaSupletorio !== '' ? parseFloat(datos.exaSupletorio) : null
                    
                    let promedioVisual = datos.califFinal
                    if (exaNum !== null) {
                      promedioVisual = Number(((datos.califFinal + exaNum) / 2).toFixed(2))
                    }
                    const esPromovido = promedioVisual >= 7
                    const cualitativaVisual = promedioVisual >= 9 ? 'DAR' : promedioVisual >= 7 ? 'AAR' : promedioVisual >= 5 ? 'PA' : 'NA'

                    return (
                      <tr key={est.id} className="hover:bg-slate-50/80">
                        <td className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center font-bold text-slate-400 print:text-slate-800">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-slate-600 print:text-slate-800 font-mono">{est.cedula || 'S/N'}</td>
                        <td className="p-2 border border-slate-200 print:border-2 print:border-slate-900 font-bold text-slate-800 print:text-slate-900 uppercase">
                          {est.apellidos} {est.nombres}
                        </td>
                        <td className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center font-bold text-slate-800 print:text-slate-900 bg-amber-50/50 print:bg-transparent">
                          {datos.califFinal.toFixed(2)}
                        </td>
                        <td className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center bg-amber-100/30 print:bg-transparent">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="10"
                            disabled={esAnioCerrado}
                            value={datos.exaSupletorio}
                            onChange={(e) => handleCambioSupletorio(est.id, e.target.value)}
                            placeholder="0.00"
                            className="w-16 p-1 text-center font-bold border border-amber-300 rounded-lg bg-white text-slate-900 outline-none text-xs shadow-2xs focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 print:border-none print:bg-transparent print:w-full"
                          />
                        </td>
                        <td className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center font-black text-indigo-900 print:text-indigo-950 bg-indigo-50/50 print:bg-transparent">
                          {promedioVisual.toFixed(2)}
                        </td>
                        <td className="p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center font-bold text-slate-700 print:text-slate-900">
                          {cualitativaVisual}
                        </td>
                        <td className={`p-2 border border-slate-200 print:border-2 print:border-slate-900 text-center font-black text-[10px] print:text-xs ${
                          esPromovido ? 'bg-blue-100 print:bg-transparent text-blue-800 print:text-blue-700' : 'bg-red-100 print:bg-transparent text-red-800 print:text-amber-700'
                        }`}>
                          {esPromovido ? 'PROMOVIDO' : 'NO PROMOVIDO'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* FIRMAS DE RESPONSABILIDAD (SOLO APARECEN AL IMPRIMIR) */}
          <div className="hidden print:grid grid-cols-2 pt-10 pb-2 text-center text-xs text-slate-900 font-bold px-4">
            <div className="space-y-1">
              <div className="border-t-2 border-slate-900 w-56 mx-auto pt-1 font-black">{nombreDocente}</div>
              <div className="font-black">DOCENTE DE LA ASIGNATURA</div>
            </div>
            <div className="space-y-1">
              <div className="border-t-2 border-slate-900 w-56 mx-auto pt-1 font-black">{autoridadActual.nombre}</div>
              <div className="font-black">{autoridadActual.cargo}</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}