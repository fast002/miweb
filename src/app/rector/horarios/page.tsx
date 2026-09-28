'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// CONFIGURACIÓN CURRICULAR OFICIAL (ECUADOR)
const CONFIG_NIVELES: any = {
  'Básica Elemental': { 
    'Matemáticas': 7, 'Lengua y Literatura': 7, 'Ciencias Naturales': 3, 
    'Estudios Sociales': 3, 'Inglés': 2, 'Educación Física': 3, 'ECA': 2, 
    'Animación a la Lectura': 1, 'Acompañamiento': 2 
  },
  'Básica Media': { 
    'Matemáticas': 6, 'Lengua y Literatura': 6, 'Ciencias Naturales': 4, 
    'Estudios Sociales': 4, 'Inglés': 3, 'Educación Física': 2, 'ECA': 2, 
    'Animación a la Lectura': 1, 'Cívica': 1, 'Acompañamiento': 1 
  },
  'Básica Superior': { 
    'Matemáticas': 6, 'Lengua y Literatura': 6, 'Ciencias Naturales': 4, 
    'Estudios Sociales': 4, 'Inglés': 3, 'Educación Física': 2, 'ECA': 2, 
    'Acompañamiento': 1, 'Orientación Vocacional': 1, 'Animación a la Lectura': 1 
  },
  'Bachillerato': { 
    'Matemáticas': 5, 'Lengua y Literatura': 5, 'Física': 3, 'Química': 3, 
    'Biología': 3, 'Inglés': 3, 'Historia': 2, 'Educación para la Ciudadanía': 2, 
    'Filosofía': 2, 'ECA': 2, 'Emprendimiento': 2, 'Cívica': 1 
  }
}

export default function GestionHorariosPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const [duracionHora, setDuracionHora] = useState(40) 
  const [totalHorasDiarias, setTotalHorasDiarias] = useState(7) 
  const [tipoBloque, setTipoBloque] = useState('CLASE') 
  const [horaInicioJornada, setHoraInicioJornada] = useState('07:00')
  const [horaFinJornada, setHoraFinJornada] = useState('13:00') // Referencia de cierre

  // Configuración de Recesos independientes (Tras qué hora de clase van)
  const [posReceso1DespuesDe, setPosReceso1DespuesDe] = useState(3) // Tras 3ª hora (25 min)
  const [posReceso2DespuesDe, setPosReceso2DespuesDe] = useState(5) // Tras 5ª hora (15 min)

  const [institucionId, setInstitucionId] = useState('')
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [anioLectivoVigente, setAnioLectivoVigente] = useState('')
  const [esAutoridad, setEsAutoridad] = useState(false)

  const [jornadaActual, setJornadaActual] = useState('MATUTINA')
  const [gradoSeleccionado, setGradoSeleccionado] = useState('')
  const [paraleloSeleccionado, setParaleloSeleccionado] = useState('A')

  const [asignacionesInstitucion, setAsignacionesInstitucion] = useState<any[]>([])
  const [horarioData, setHorarioData] = useState<any[]>([])

  const [modalAbierto, setModalAbierto] = useState(false)
  const [celdaActual, setCeldaActual] = useState<{ dia: string; hora: number; tipo: string } | null>(null)
  const [asignaturaElegida, setAsignaturaElegida] = useState('')

  const diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES']
  const horasPeriodos = Array.from({ length: totalHorasDiarias }, (_, i) => i + 1)

  // Cálculo cronológico exacto que inserta filas de receso con sus duraciones específicas (25m y 15m)
  const calcularFilasConRecesos = () => {
    const [hStr, mStr] = horaInicioJornada.split(':')
    let minutosActuales = parseInt(hStr || '7') * 60 + parseInt(mStr || '0')
    const filas: any[] = []

    let contadorClase = 1
    for (let i = 1; i <= totalHorasDiarias; i++) {
      // 1. Agregar Hora de Clase
      const inicioClase = minutosActuales
      const finClase = inicioClase + duracionHora
      
      const formatear = (m: number) => {
        const h = Math.floor(m / 60) % 24
        const min = m % 60
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      }

      filas.push({
        tipo: 'CLASE',
        numeroHora: i,
        etiqueta: `${contadorClase}ª Hora`,
        rango: `${formatear(inicioClase)} - ${formatear(finClase)}`
      })
      contadorClase++
      minutosActuales = finClase

      // 2. Insertar Receso 1 (25 minutos) si corresponde tras esta hora
      if (i === Number(posReceso1DespuesDe)) {
        const inicioRec = minutosActuales
        const finRec = inicioRec + 25
        filas.push({
          tipo: 'RECESO',
          idReceso: 1,
          etiqueta: 'RECESO 1',
          rango: `${formatear(inicioRec)} - ${formatear(finRec)}`
        })
        minutosActuales = finRec
      }

      // 3. Insertar Receso 2 (15 minutos) si corresponde tras esta hora
      if (i === Number(posReceso2DespuesDe)) {
        const inicioRec = minutosActuales
        const finRec = inicioRec + 15
        filas.push({
          tipo: 'RECESO',
          idReceso: 2,
          etiqueta: 'RECESO 2',
          rango: `${formatear(inicioRec)} - ${formatear(finRec)}`
        })
        minutosActuales = finRec
      }
    }
    return filas
  }

  const filasCronologicas = calcularFilasConRecesos()

  const generarColorAsignatura = (nombre: string) => {
    if (!nombre) return 'bg-white text-slate-800 border-slate-200'
    const mapaColores: { [key: string]: string } = {
      'Matemáticas': 'bg-blue-100 text-blue-900 border-blue-300',
      'Lengua y Literatura': 'bg-rose-100 text-rose-900 border-rose-300',
      'Ciencias Naturales': 'bg-emerald-100 text-emerald-900 border-emerald-300',
      'Estudios Sociales': 'bg-amber-100 text-amber-900 border-amber-300',
      'Inglés': 'bg-purple-100 text-purple-900 border-purple-300',
      'Educación Física': 'bg-cyan-100 text-cyan-900 border-cyan-300',
      'ECA': 'bg-indigo-100 text-indigo-900 border-indigo-300',
      'Física': 'bg-teal-100 text-teal-900 border-teal-300',
      'Química': 'bg-orange-100 text-orange-900 border-orange-300',
      'Biología': 'bg-lime-100 text-lime-900 border-lime-300',
      'Historia': 'bg-yellow-100 text-yellow-900 border-yellow-300',
      'Filosofía': 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
      'Emprendimiento': 'bg-sky-100 text-sky-900 border-sky-300'
    }
    if (mapaColores[nombre]) return mapaColores[nombre]
    const coloresGenericos = ['bg-blue-100 text-blue-900', 'bg-emerald-100 text-emerald-900', 'bg-purple-100 text-purple-900']
    let hash = 0
    for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
    return coloresGenericos[Math.abs(hash) % coloresGenericos.length]
  }

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      const { data: doc } = await supabase
        .from('docentes')
        .select('*, instituciones(*)')
        .eq('id', user.id)
        .maybeSingle()

      if (doc?.institucion_id) {
        setInstitucionId(doc.institucion_id)
        setNombreInstitucion(doc.instituciones?.nombre_institucion || 'Unidad Educativa')

        const rol = doc.rol?.toLowerCase() || ''
        const autoridadFlag = rol.includes('rector') || rol.includes('vicerrector') || rol.includes('director')
        setEsAutoridad(autoridadFlag)

        const anioActivo = doc.instituciones?.anio_lectivo_activo || ''
        setAnioLectivoVigente(anioActivo)

        if (anioActivo) {
          const { data: asigs } = await supabase
            .from('docente_asignaciones')
            .select('*, docentes:docente_id(nombres, apellidos)')
            .eq('institucion_id', doc.institucion_id)
            .eq('anio_lectivo', anioActivo)

          if (asigs && asigs.length > 0) {
            const asigsFormateadas = asigs.map((a: any) => ({
              ...a,
              docente_nombre: a.docentes ? `${a.docentes.nombres} ${a.docentes.apellidos}` : 'Sin Docente'
            }))

            setAsignacionesInstitucion(asigsFormateadas)
            const primeraJornada = asigsFormateadas[0].jornada || 'MATUTINA'
            const primerGrado = asigsFormateadas[0].grado_curso
            const primerParalelo = asigsFormateadas[0].paralelo

            setJornadaActual(primeraJornada)
            setGradoSeleccionado(primerGrado)
            setParaleloSeleccionado(primerParalelo)

            await cargarHorario(doc.institucion_id, anioActivo, primerGrado, primerParalelo)
          }
        }
      }
    } catch (err: any) {
      console.error('Error al cargar datos iniciales de horarios:', err)
    } finally {
      setCargando(false)
    }
  }

  const cargarHorario = async (instId: string, anio: string, grado: string, paralelo: string) => {
    const { data, error } = await supabase
      .from('horarios_clases')
      .select('*')
      .eq('institucion_id', instId)
      .eq('anio_lectivo', anio)
      .eq('grado_curso', grado)
      .eq('paralelo', paralelo)

    if (!error && data) {
      setHorarioData(data)
    } else {
      setHorarioData([])
    }
  }

  const handleFiltroChange = async (nuevoGrado: string, nuevoParalelo: string) => {
    setGradoSeleccionado(nuevoGrado)
    setParaleloSeleccionado(nuevoParalelo)

    const gLower = nuevoGrado.toLowerCase()
    if (gLower.includes('2do') || gLower.includes('3ro') || gLower.includes('4to') || gLower.includes('5to') || gLower.includes('6to') || gLower.includes('7mo')) {
      setTotalHorasDiarias(6) 
    } else {
      setTotalHorasDiarias(7) 
    }

    if (institucionId && anioLectivoVigente) {
      await cargarHorario(institucionId, anioLectivoVigente, nuevoGrado, nuevoParalelo)
    }
  }

  // Generador Automático respetando las 6, 7 u 8 horas de clase intactas
  const handleGenerarHorarioAutomatico = async () => {
    if (!esAutoridad) {
      alert('⚠️ Solo las autoridades institucionales pueden generar horarios automáticos.')
      return
    }

    if (!confirm('¿Generar horarios automáticos manteniendo las horas de clase intactas y evitando cruces de docentes?')) {
      return
    }

    setCargando(true)
    setMensaje(null)

    try {
      await supabase
        .from('horarios_clases')
        .delete()
        .eq('institucion_id', institucionId)
        .eq('anio_lectivo', anioLectivoVigente)

      const paralelosUnicos = Array.from(
        new Set(asignacionesInstitucion.map((a: any) => `${a.grado_curso}|${a.paralelo}|${a.jornada || 'MATUTINA'}`))
      )

      const nuevosHorariosMasivos: any[] = []
      const ocupacionDocentes: { [key: string]: boolean } = {}

      for (const pStr of paralelosUnicos) {
        const [grado, paralelo] = pStr.split('|')
        const materiasGrado = asignacionesInstitucion.filter((a: any) => a.grado_curso === grado && a.paralelo === paralelo)
        
        const gLower = grado.toLowerCase()
        let subnivel = 'Básica Media'
        if (gLower.includes('2do') || gLower.includes('3ro') || gLower.includes('4to')) subnivel = 'Básica Elemental'
        else if (gLower.includes('5to') || gLower.includes('6to') || gLower.includes('7mo')) subnivel = 'Básica Media'
        else if (gLower.includes('8vo') || gLower.includes('9no') || gLower.includes('10mo')) subnivel = 'Básica Superior'
        else subnivel = 'Bachillerato'

        const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES']
        const horas = Array.from({ length: totalHorasDiarias }, (_, i) => i + 1)

        const grillaParalelo: { [dia: string]: { [hora: number]: any } } = {}
        dias.forEach(d => grillaParalelo[d] = {})

        let esElementalOMedia = (subnivel === 'Básica Elemental' || subnivel === 'Básica Media')
        let troncales: any[] = []
        let secundarias: any[] = []

        materiasGrado.forEach((m: any) => {
          if (esElementalOMedia && (m.asignatura.includes('Matemáticas') || m.asignatura.includes('Lengua'))) {
            troncales.push(m)
          } else {
            secundarias.push(m)
          }
        })

        const colocarMateriasEnGrilla = (listaMaterias: any[], preferirPrimerasHoras: boolean) => {
          listaMaterias.forEach((m: any) => {
            const horasSemanales = CONFIG_NIVELES[subnivel]?.[m.asignatura] || 4
            let horasAsignadas = 0

            for (const dia of dias) {
              if (horasAsignadas >= horasSemanales) break
              const tamBloque = (horasSemanales - horasAsignadas >= 2) ? 2 : 1

              let ordenHoras = [...horas]
              if (preferirPrimerasHoras) {
                ordenHoras.sort((a, b) => (a <= 3 ? 0 : 1) - (b <= 3 ? 0 : 1))
              }

              for (let i = 0; i <= ordenHoras.length - tamBloque; i++) {
                let h = ordenHoras[i]
                let espacioLibre = true

                for (let b = 0; b < tamBloque; b++) {
                  let horaActual = h + b
                  let docenteKey = `${m.docente_id}|${dia}|${horaActual}`
                  if (grillaParalelo[dia][horaActual] || (m.docente_id && ocupacionDocentes[docenteKey])) {
                    espacioLibre = false
                    break
                  }
                }

                if (espacioLibre) {
                  for (let b = 0; b < tamBloque; b++) {
                    let horaActual = h + b
                    grillaParalelo[dia][horaActual] = { tipo_bloque: 'CLASE', ...m }
                    if (m.docente_id) {
                      ocupacionDocentes[`${m.docente_id}|${dia}|${horaActual}`] = true
                    }
                  }
                  horasAsignadas += tamBloque
                  break
                }
              }
            }
          })
        }

        colocarMateriasEnGrilla(troncales, true)
        colocarMateriasEnGrilla(secundarias, false)

        for (const dia of dias) {
          for (const hora of horas) {
            const mat = grillaParalelo[dia][hora]
            if (mat) {
              nuevosHorariosMasivos.push({
                institucion_id: institucionId,
                anio_lectivo: anioLectivoVigente,
                grado_curso: grado,
                paralelo: paralelo,
                dia: dia,
                hora_periodo: hora,
                tipo_bloque: 'CLASE',
                asignatura: mat.asignatura,
                docente_nombre: mat.docente_nombre || 'Docente'
              })
            }
          }
        }
      }

      if (nuevosHorariosMasivos.length > 0) {
        const { error: insertError } = await supabase.from('horarios_clases').insert(nuevosHorariosMasivos)
        if (insertError) throw insertError
      }

      setMensaje({ tipo: 'exito', texto: '🚀 ¡Horarios de clase generados correctamente!' })
      await cargarHorario(institucionId, anioLectivoVigente, gradoSeleccionado, paraleloSeleccionado)

    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al generar horario automático: ' + err.message })
    } finally {
      setCargando(false)
    }
  }

  const abrirModalAsignacion = (dia: string, hora: number) => {
    if (!esAutoridad) {
      alert('⚠️ Solo las autoridades institucionales pueden modificar el horario escolar.')
      return
    }
    setCeldaActual({ dia, hora, tipo: 'CLASE' })
    const existente = horarioData.find(h => h.dia === dia && h.hora_periodo === hora)
    setAsignaturaElegida(existente ? existente.asignatura_id : '')
    setTipoBloque(existente ? (existente.tipo_bloque || 'CLASE') : 'CLASE')
    setModalAbierto(true)
  }

  const handleGuardarCelda = async () => {
    if (!celdaActual || !institucionId || !anioLectivoVigente) return

    setGuardando(true)
    setMensaje(null)

    try {
      const asignaturaObj = asignacionesInstitucion.find((a: any) => a.id === asignaturaElegida)

      const payload = {
        institucion_id: institucionId,
        anio_lectivo: anioLectivoVigente,
        grado_curso: gradoSeleccionado,
        paralelo: paraleloSeleccionado,
        dia: celdaActual.dia,
        hora_periodo: celdaActual.hora,
        tipo_bloque: tipoBloque,
        asignatura: tipoBloque === 'RECESO' ? 'RECESO' : (asignaturaObj ? asignaturaObj.asignatura : ''),
        docente_nombre: tipoBloque === 'RECESO' ? '---' : (asignaturaObj ? asignaturaObj.docente_nombre : '')
      }

      const existente = horarioData.find(h => h.dia === celdaActual.dia && h.hora_periodo === celdaActual.hora)

      if (existente) {
        const { error } = await supabase
          .from('horarios_clases')
          .update(payload)
          .eq('id', existente.id)

        if (error) throw error
      } else if (asignaturaElegida || tipoBloque === 'RECESO') {
        const { error } = await supabase
          .from('horarios_clases')
          .insert([payload])

        if (error) throw error
      }

      setMensaje({ tipo: 'exito', texto: '¡Horario actualizado correctamente!' })
      setModalAbierto(false)
      await cargarHorario(institucionId, anioLectivoVigente, gradoSeleccionado, paraleloSeleccionado)
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar horario: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarCelda = async (dia: string, hora: number) => {
    if (!esAutoridad) return
    if (!confirm('¿Deseas dejar esta hora libre?')) return

    const existente = horarioData.find(h => h.dia === dia && h.hora_periodo === hora)
    if (existente) {
      const { error } = await supabase.from('horarios_clases').delete().eq('id', existente.id)
      if (error) {
        alert('Error al eliminar: ' + error.message)
        return
      }
      await cargarHorario(institucionId, anioLectivoVigente, gradoSeleccionado, paraleloSeleccionado)
    }
  }

  const gradosDisponibles = Array.from(new Set(asignacionesInstitucion.filter((a: any) => (a.jornada || 'MATUTINA') === jornadaActual).map((a: any) => a.grado_curso)))
  const paralelosDisponibles = Array.from(new Set(asignacionesInstitucion.filter((a: any) => (a.jornada || 'MATUTINA') === jornadaActual && a.grado_curso === gradoSeleccionado).map((a: any) => a.paralelo)))
  const asignaturasPermitidas = asignacionesInstitucion.filter((a: any) => a.grado_curso === gradoSeleccionado && a.paralelo === paraleloSeleccionado)

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Matriz de Horarios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO Y CONFIGURACIÓN DE PARÁMETROS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-wide uppercase">
              Matriz de Horarios de Clases 🕒 ({anioLectivoVigente})
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {nombreInstitucion} • <strong className="text-slate-700">{esAutoridad ? 'Panel Directivo [Carga Horaria & Recesos]' : 'Vista de Horarios'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {esAutoridad && (
              <button
                onClick={handleGenerarHorarioAutomatico}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
              >
                ⚡ Generar Automático
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition"
            >
              🖨️ PDF
            </button>
          </div>
        </div>

        {/* PARÁMETROS RECTORALES (Jornada, Recesos y Duración) */}
        {esAutoridad && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Duración:</label>
              <select
                value={duracionHora}
                onChange={(e) => setDuracionHora(Number(e.target.value))}
                className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-white outline-none"
              >
                <option value={40}>40 Min</option>
                <option value={45}>45 Min</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Ingreso:</label>
              <input
                type="time"
                value={horaInicioJornada}
                onChange={(e) => setHoraInicioJornada(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Salida:</label>
              <input
                type="time"
                value={horaFinJornada}
                onChange={(e) => setHoraFinJornada(e.target.value)}
                className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Periodos:</label>
              <select
                value={totalHorasDiarias}
                onChange={(e) => setTotalHorasDiarias(Number(e.target.value))}
                className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-white outline-none"
              >
                <option value={6}>6 Horas</option>
                <option value={7}>7 Horas</option>
                <option value={8}>8 Horas</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Receso 1 (25m):</label>
              <select
                value={posReceso1DespuesDe}
                onChange={(e) => setPosReceso1DespuesDe(Number(e.target.value))}
                className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-white outline-none"
              >
                <option value={0}>Ninguno</option>
                {horasPeriodos.map(h => <option key={h} value={h}>Tras {h}ª Hora</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Receso 2 (15m):</label>
              <select
                value={posReceso2DespuesDe}
                onChange={(e) => setPosReceso2DespuesDe(Number(e.target.value))}
                className="w-full p-2 border rounded-xl text-xs font-bold text-slate-800 bg-white outline-none"
              >
                <option value={0}>No aplica</option>
                {horasPeriodos.map(h => <option key={h} value={h}>Tras {h}ª Hora</option>)}
              </select>
            </div>
          </div>
        )}

        {mensaje && (
          <div className={`p-4 rounded-xl text-sm font-bold border ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {/* FILTROS DE SELECCIÓN DE CLASE */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Jornada:</label>
            <select
              value={jornadaActual}
              onChange={(e) => {
                const j = e.target.value
                setJornadaActual(j)
                const gList = Array.from(new Set(asignacionesInstitucion.filter((a: any) => (a.jornada || 'MATUTINA') === j).map((a: any) => a.grado_curso)))
                if (gList.length > 0) {
                  setGradoSeleccionado(gList[0] as string)
                  const pList = Array.from(new Set(asignacionesInstitucion.filter((a: any) => (a.jornada || 'MATUTINA') === j && a.grado_curso === gList[0]).map((a: any) => a.paralelo)))
                  if (pList.length > 0) {
                    setParaleloSeleccionado(pList[0] as string)
                    handleFiltroChange(gList[0] as string, pList[0] as string)
                  }
                }
              }}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {Array.from(new Set(asignacionesInstitucion.map((a: any) => a.jornada || 'MATUTINA'))).map((j: any) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Grado / Curso:</label>
            <select
              value={gradoSeleccionado}
              onChange={(e) => {
                const g = e.target.value
                setGradoSeleccionado(g)
                const pList = Array.from(new Set(asignacionesInstitucion.filter((a: any) => a.grado_curso === g).map((a: any) => a.paralelo)))
                if (pList.length > 0) {
                  setParaleloSeleccionado(pList[0] as string)
                  handleFiltroChange(g, pList[0] as string)
                }
              }}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {gradosDisponibles.map((g: any) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Paralelo:</label>
            <select
              value={paraleloSeleccionado}
              onChange={(e) => handleFiltroChange(gradoSeleccionado, e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
            >
              {paralelosDisponibles.map((p: any) => (
                <option key={p} value={p}>Paralelo {p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLA / GRILLA DEL HORARIO SEMANAL (CON FILAS DE CLASE INTACTAS Y FILAS DE RECESO INSERTADAS) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-100 border-b flex justify-between items-center">
            <h2 className="font-bold text-slate-800 text-xs uppercase">
              Horario de Clases: {gradoSeleccionado} "{paraleloSeleccionado}" ({jornadaActual})
            </h2>
            <span className="text-[11px] text-slate-500 font-semibold">Haz clic en cualquier celda para asignar materia</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-800 font-bold uppercase text-center">
                  <th className="p-3 border w-36">Hora / Rango</th>
                  {diasSemana.map((dia) => (
                    <th key={dia} className="p-3 border">{dia}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filasCronologicas.map((fila, idx) => {
                  if (fila.tipo === 'RECESO') {
                    // FILA DE RECESO INSERTADA AUTOMÁTICAMENTE
                    return (
                      <tr key={`receso-${idx}`} className="text-center bg-amber-400">
                        <td className="p-3 border font-black text-amber-950 uppercase">
                          {fila.etiqueta}<br/>
                          <span className="text-[10px] font-semibold">{fila.rango}</span>
                        </td>
                        {diasSemana.map((dia) => (
                          <td key={dia} className="p-3 border font-black text-amber-950 uppercase tracking-widest bg-amber-400">
                            RECESO
                          </td>
                        ))}
                      </tr>
                    )
                  }

                  // FILAS DE CLASE INTACTAS
                  const hora = fila.numeroHora
                  return (
                    <tr key={`clase-${hora}`} className="text-center">
                      <td className="p-3 border font-bold bg-slate-50 text-slate-700">
                        {fila.etiqueta}<br/>
                        <span className="text-[10px] text-indigo-600 font-semibold">{fila.rango}</span>
                      </td>
                      {diasSemana.map((dia) => {
                        const item = horarioData.find((h: any) => h.dia === dia && h.hora_periodo === hora)
                        const estiloColor = item ? generarColorAsignatura(item.asignatura) : 'hover:bg-indigo-50/50 bg-white text-slate-400'
                        
                        return (
                          <td
                            key={dia}
                            onClick={() => abrirModalAsignacion(dia, hora)}
                            className={`p-3 border h-20 align-middle cursor-pointer transition group relative border-slate-200 ${estiloColor}`}
                          >
                            {item ? (
                              <div className="space-y-1">
                                <p className="font-black uppercase text-[11px]">{item.asignatura}</p>
                                <p className="text-[10px] font-semibold opacity-90">{item.docente_nombre}</p>
                                {esAutoridad && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEliminarCelda(dia, hora)
                                    }}
                                    className="absolute top-1 right-1 text-red-500 opacity-0 group-hover:opacity-100 font-bold text-[10px] bg-white px-1.5 py-0.5 rounded shadow"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] group-hover:text-indigo-600 font-bold uppercase">
                                + Asignar
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL PARA CONFIGURAR HORA */}
      {modalAbierto && celdaActual && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-sm font-bold text-slate-800">
                Asignar Materia ({celdaActual.dia} - {celdaActual.hora}ª Hora)
              </h2>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Seleccionar Asignatura / Docente</label>
              <select
                value={asignaturaElegida}
                onChange={(e) => setAsignaturaElegida(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none"
              >
                <option value="">-- Seleccionar Materia --</option>
                {asignaturasPermitidas.map((asig: any) => (
                  <option key={asig.id} value={asig.id}>
                    {asig.asignatura} ({asig.docente_nombre || 'Sin docente'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setModalAbierto(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarCelda}
                disabled={guardando}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {guardando ? 'Guardando...' : 'Guardar en Horario'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}