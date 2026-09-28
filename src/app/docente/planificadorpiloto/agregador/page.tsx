'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CargarMatrizCurricular() {
  const [pestanaActiva, setPestanaActiva] = useState<'formulario' | 'listado'>('formulario')

  // --- ESTADOS DEL FORMULARIO DE CARGA ---
  const [asignatura, setAsignatura] = useState('Matemática')
  const [subnivel, setSubnivel] = useState('Básica Elemental')
  const [gradoCurso, setGradoCurso] = useState('2do Grado EGB')
  
  const [competencia, setCompetencia] = useState('')
  
  const [indicadores, setIndicadores] = useState([''])
  const [declarativos, setDeclarativos] = useState([''])
  const [procedimentales, setProcedimentales] = useState([''])
  const [actitudinales, setActitudinales] = useState([''])

  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  // --- ESTADOS DEL GESTOR / LISTADO ---
  const [registros, setRegistros] = useState<any[]>([])
  const [cargandoListado, setCargandoListado] = useState(false)
  const [filtroAsignatura, setFiltroAsignatura] = useState('Todas')
  const [filtroSubnivel, setFiltroSubnivel] = useState('Todos')
  const [filtroGrado, setFiltroGrado] = useState('Todos')
  const [busquedaTexto, setBusquedaTexto] = useState('')

  // Modal de edición por bloque completo
  const [bloqueEdicion, setBloqueEdicion] = useState<{
    idsOriginales: string[]
    asignatura: string
    subnivel: string
    grado_curso: string
    competencia: string
    indicadores: string[]
    declarativos: string[]
    procedimentales: string[]
    actitudinales: string[]
  } | null>(null)

  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const gradosPorSubnivel: Record<string, string[]> = {
    'Inicial': ['Inicial 1', 'Inicial 2'],
    'Preparatoria': ['Preparatoria'],
    'Básica Elemental': ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB'],
    'Básica Media': ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB'],
    'Básica Superior': ['8vo Grado EGB', '9no Grado EGB', '10mo Grado EGB'],
    'Bachillerato': ['1er Año Bachillerato', '2do Año Bachillerato', '3er Año Bachillerato']
  }

  const materiasDisponibles = [
    'Matemática', 'Lengua y Literatura', 'Ciencias Naturales', 'Estudios Sociales',
    'Educación Física', 'Educación Cultural y Artística (ECA)', 'Idioma Extranjero (Inglés)',
    'Biología', 'Física', 'Química','Historia y Geografía', 'Educación para la Ciudadanía', 'Filosofía', 
    'Emprendimiento y Gestión', 'Currículo Integrado Preparatoria', 'Currículo Integrado Inicial'
  ]

  const subnivelesDisponibles = Object.keys(gradosPorSubnivel)

  const handleSubnivelChange = (nuevoSubnivel: string) => {
    setSubnivel(nuevoSubnivel)
    const opciones = gradosPorSubnivel[nuevoSubnivel] || []
    if (opciones.length > 0) {
      setGradoCurso(opciones[0])
    }
  }

  const agregarCampo = (setLista: any, lista: string[]) => setLista([...lista, ''])
  const eliminarCampo = (setLista: any, lista: string[], index: number) => {
    if (lista.length === 1) return
    setLista(lista.filter((_, i) => i !== index))
  }
  const cambiarCampo = (setLista: any, lista: string[], index: number, valor: string) => {
    const nuevaLista = [...lista]
    nuevaLista[index] = valor
    setLista(nuevaLista)
  }

  const agregarCampoEdicion = (campo: 'indicadores' | 'declarativos' | 'procedimentales' | 'actitudinales') => {
    if (!bloqueEdicion) return
    setBloqueEdicion({ ...bloqueEdicion, [campo]: [...bloqueEdicion[campo], ''] })
  }

  const eliminarCampoEdicion = (campo: 'indicadores' | 'declarativos' | 'procedimentales' | 'actitudinales', index: number) => {
    if (!bloqueEdicion || bloqueEdicion[campo].length === 1) return
    setBloqueEdicion({ ...bloqueEdicion, [campo]: bloqueEdicion[campo].filter((_, i) => i !== index) })
  }

  const cambiarCampoEdicion = (campo: 'indicadores' | 'declarativos' | 'procedimentales' | 'actitudinales', index: number, valor: string) => {
    if (!bloqueEdicion) return
    const nuevaLista = [...bloqueEdicion[campo]]
    nuevaLista[index] = valor
    setBloqueEdicion({ ...bloqueEdicion, [campo]: nuevaLista })
  }

  const guardarRegistroBD = async (e: React.FormEvent) => {
    e.preventDefault()
    const indsValidos = indicadores.filter(i => i.trim() !== '')
    if (!competencia.trim() || indsValidos.length === 0) {
      setMensaje('⚠️ La Competencia y al menos un Indicador son obligatorios.')
      return
    }

    setCargando(true)
    setMensaje('')

    try {
      const registrosAInsertar = indsValidos.map(ind => ({
        asignatura,
        subnivel,
        grado_curso: gradoCurso,
        competencia: competencia.trim(),
        indicador: ind.trim(),
        declarativo: declarativos.filter(d => d.trim() !== '').join('\n'),
        procedimental: procedimentales.filter(p => p.trim() !== '').join('\n'),
        actitudinal: actitudinales.filter(a => a.trim() !== '').join('\n')
      }))

      const { error } = await supabase.from('matriz_curricular_oficial').insert(registrosAInsertar)

      if (error) throw error

      setMensaje('✅ ¡Registros guardados con éxito en Supabase!')
      setCompetencia('')
      setIndicadores([''])
      setDeclarativos([''])
      setProcedimentales([''])
      setActitudinales([''])
    } catch (err: any) {
      setMensaje('❌ Error al guardar: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  const cargarRegistros = async () => {
    setCargandoListado(true)
    try {
      const { data, error } = await supabase
        .from('matriz_curricular_oficial')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRegistros(data || [])
    } catch (err: any) {
      alert('Error al cargar registros: ' + err.message)
    } finally {
      setCargandoListado(false)
    }
  }

  useEffect(() => {
    if (pestanaActiva === 'listado') {
      cargarRegistros()
    }
  }, [pestanaActiva])

  const bloquesAgrupados = registros.reduce((acc: any[], fila: any) => {
    const clave = `${fila.asignatura}__${fila.subnivel}__${fila.grado_curso}__${fila.competencia}`
    let bloque = acc.find(b => b.clave === clave)

    if (!bloque) {
      bloque = {
        clave,
        ids: [fila.id],
        asignatura: fila.asignatura,
        subnivel: fila.subnivel,
        grado_curso: fila.grado_curso,
        competencia: fila.competencia,
        indicadores: fila.indicador ? [fila.indicador] : [],
        declarativos: fila.declarativo ? fila.declarativo.split(/\r?\n/).filter(Boolean) : [],
        procedimentales: fila.procedimental ? fila.procedimental.split(/\r?\n/).filter(Boolean) : [],
        actitudinales: fila.actitudinal ? fila.actitudinal.split(/\r?\n/).filter(Boolean) : []
      }
      acc.push(bloque)
    } else {
      bloque.ids.push(fila.id)
      if (fila.indicador && !bloque.indicadores.includes(fila.indicador)) {
        bloque.indicadores.push(fila.indicador)
      }
      const decs = fila.declarativo ? fila.declarativo.split(/\r?\n/).filter(Boolean) : []
      decs.forEach((d: string) => { if (!bloque.declarativos.includes(d)) bloque.declarativos.push(d) })
      
      const procs = fila.procedimental ? fila.procedimental.split(/\r?\n/).filter(Boolean) : []
      procs.forEach((p: string) => { if (!bloque.procedimentales.includes(p)) bloque.procedimentales.push(p) })

      const acts = fila.actitudinal ? fila.actitudinal.split(/\r?\n/).filter(Boolean) : []
      acts.forEach((a: string) => { if (!bloque.actitudinales.includes(a)) bloque.actitudinales.push(a) })
    }

    return acc
  }, [])

  const eliminarBloqueCompleto = async (ids: string[]) => {
    if (!confirm(`¿Estás seguro de eliminar este bloque curricular (${ids.length} fila/s en BD)?`)) return

    try {
      const { error } = await supabase
        .from('matriz_curricular_oficial')
        .delete()
        .in('id', ids)

      if (error) throw error
      setRegistros(prev => prev.filter(r => !ids.includes(r.id)))
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  const abrirModalEdicionBloque = (bloque: any) => {
    setBloqueEdicion({
      idsOriginales: bloque.ids,
      asignatura: bloque.asignatura,
      subnivel: bloque.subnivel,
      grado_curso: bloque.grado_curso,
      competencia: bloque.competencia,
      indicadores: bloque.indicadores.length > 0 ? [...bloque.indicadores] : [''],
      declarativos: bloque.declarativos.length > 0 ? [...bloque.declarativos] : [''],
      procedimentales: bloque.procedimentales.length > 0 ? [...bloque.procedimentales] : [''],
      actitudinales: bloque.actitudinales.length > 0 ? [...bloque.actitudinales] : ['']
    })
  }

  const guardarCambiosBloqueCompleto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bloqueEdicion) return

    const indsValidos = bloqueEdicion.indicadores.filter(i => i.trim() !== '')
    if (!bloqueEdicion.competencia.trim() || indsValidos.length === 0) {
      alert('La Competencia y al menos un Indicador son obligatorios.')
      return
    }

    setGuardandoEdicion(true)
    try {
      const { error: deleteError } = await supabase
        .from('matriz_curricular_oficial')
        .delete()
        .in('id', bloqueEdicion.idsOriginales)

      if (deleteError) throw deleteError

      const nuevosRegistros = indsValidos.map(ind => ({
        asignatura: bloqueEdicion.asignatura,
        subnivel: bloqueEdicion.subnivel,
        grado_curso: bloqueEdicion.grado_curso,
        competencia: bloqueEdicion.competencia.trim(),
        indicador: ind.trim(),
        declarativo: bloqueEdicion.declarativos.filter(d => d.trim() !== '').join('\n'),
        procedimental: bloqueEdicion.procedimentales.filter(p => p.trim() !== '').join('\n'),
        actitudinal: bloqueEdicion.actitudinales.filter(a => a.trim() !== '').join('\n')
      }))

      const { error: insertError } = await supabase
        .from('matriz_curricular_oficial')
        .insert(nuevosRegistros)

      if (insertError) throw insertError

      setBloqueEdicion(null)
      await cargarRegistros()
      alert('Bloque curricular actualizado con éxito')
    } catch (err: any) {
      alert('Error al guardar cambios: ' + err.message)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const bloquesFiltrados = bloquesAgrupados.filter(b => {
    const coincideAsignatura = filtroAsignatura === 'Todas' || b.asignatura === filtroAsignatura
    const coincideSubnivel = filtroSubnivel === 'Todos' || b.subnivel === filtroSubnivel
    const coincideGrado = filtroGrado === 'Todos' || b.grado_curso === filtroGrado
    const texto = busquedaTexto.toLowerCase()
    const coincideTexto = !busquedaTexto || 
      b.competencia?.toLowerCase().includes(texto) ||
      b.indicadores?.some((i: string) => i.toLowerCase().includes(texto)) ||
      b.declarativos?.some((d: string) => d.toLowerCase().includes(texto)) ||
      b.procedimentales?.some((p: string) => p.toLowerCase().includes(texto)) ||
      b.actitudinales?.some((a: string) => a.toLowerCase().includes(texto))

    return coincideAsignatura && coincideSubnivel && coincideGrado && coincideTexto
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 text-slate-900">
      
      {/* ENCABEZADO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">
            Módulo de Carga Modular: Matriz Curricular Oficial
          </h2>
          <p className="text-xs text-slate-600 font-semibold mt-0.5">
            Añade, consulta y edita indicadores y saberes modulares.
          </p>
        </div>

        <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-bold gap-1">
          <button
            type="button"
            onClick={() => setPestanaActiva('formulario')}
            className={`px-4 py-2 rounded-lg transition ${
              pestanaActiva === 'formulario'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Formulario de Carga
          </button>
          <button
            type="button"
            onClick={() => setPestanaActiva('listado')}
            className={`px-4 py-2 rounded-lg transition ${
              pestanaActiva === 'listado'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Gestor / Ver Registros ({bloquesAgrupados.length})
          </button>
        </div>
      </div>

      {/* VISTA 1: FORMULARIO PRINCIPAL */}
      {pestanaActiva === 'formulario' && (
        <form onSubmit={guardarRegistroBD} className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Asignatura:</label>
              <select
                value={asignatura}
                onChange={e => setAsignatura(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {materiasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Subnivel:</label>
              <select
                value={subnivel}
                onChange={e => handleSubnivelChange(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {subnivelesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Grado / Curso:</label>
              <select
                value={gradoCurso}
                onChange={e => setGradoCurso(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {(gradosPorSubnivel[subnivel] || []).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-800 uppercase mb-1">Competencia Específica (Núcleo):</label>
              <textarea 
                rows={3} 
                value={competencia} 
                onChange={e => setCompetencia(e.target.value)} 
                placeholder="Ej: CE.M.2.1. Construir patrones y agrupar objetos..." 
                className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500" 
                required 
              />
            </div>

            <div className="space-y-2 p-4 rounded-xl border border-slate-300 bg-slate-50">
              <div className="flex justify-between items-center">
                <label className="font-bold text-slate-800 uppercase">Indicadores de Evaluación (Múltiples):</label>
                <button 
                  type="button" 
                  onClick={() => agregarCampo(setIndicadores, indicadores)}
                  className="px-3 py-1 bg-indigo-600 text-white font-bold text-[10px] rounded-lg shadow hover:bg-indigo-700 transition"
                >
                  + Añadir Indicador
                </button>
              </div>
              {indicadores.map((ind, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <textarea 
                    rows={2} 
                    value={ind} 
                    onChange={e => cambiarCampo(setIndicadores, indicadores, index, e.target.value)} 
                    placeholder={`Indicador ${index + 1} (Ej: I.M.2.1.1...)`} 
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium outline-none" 
                    required 
                  />
                  {indicadores.length > 1 && (
                    <button type="button" onClick={() => eliminarCampo(setIndicadores, indicadores, index)} className="text-red-600 font-bold text-xs p-2">🗑️</button>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Declarativos */}
              <div className="space-y-2 p-3 rounded-xl border border-blue-300 bg-blue-50/50">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-blue-950 uppercase text-[11px]">Declarativos:</label>
                  <button type="button" onClick={() => agregarCampo(setDeclarativos, declarativos)} className="px-2 py-0.5 bg-blue-700 text-white font-bold text-[10px] rounded shadow">+ Añadir</button>
                </div>
                {declarativos.map((item, index) => (
                  <div key={index} className="flex gap-1 items-center">
                    <textarea rows={2} value={item} onChange={e => cambiarCampo(setDeclarativos, declarativos, index, e.target.value)} placeholder="Concepto..." className="w-full p-2 border border-blue-200 rounded bg-white text-slate-900 font-medium text-xs outline-none" />
                    {declarativos.length > 1 && <button type="button" onClick={() => eliminarCampo(setDeclarativos, declarativos, index)} className="text-red-600 font-bold text-xs">×</button>}
                  </div>
                ))}
              </div>

              {/* Procedimentales */}
              <div className="space-y-2 p-3 rounded-xl border border-emerald-300 bg-emerald-50/50">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-emerald-950 uppercase text-[11px]">Procedimentales:</label>
                  <button type="button" onClick={() => agregarCampo(setProcedimentales, procedimentales)} className="px-2 py-0.5 bg-emerald-700 text-white font-bold text-[10px] rounded shadow">+ Añadir</button>
                </div>
                {procedimentales.map((item, index) => (
                  <div key={index} className="flex gap-1 items-center">
                    <textarea rows={2} value={item} onChange={e => cambiarCampo(setProcedimentales, procedimentales, index, e.target.value)} placeholder="Acción..." className="w-full p-2 border border-emerald-200 rounded bg-white text-slate-900 font-medium text-xs outline-none" />
                    {procedimentales.length > 1 && <button type="button" onClick={() => eliminarCampo(setProcedimentales, procedimentales, index)} className="text-red-600 font-bold text-xs">×</button>}
                  </div>
                ))}
              </div>

              {/* Actitudinales */}
              <div className="space-y-2 p-3 rounded-xl border border-amber-300 bg-amber-50/50">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-amber-950 uppercase text-[11px]">Actitudinales:</label>
                  <button type="button" onClick={() => agregarCampo(setActitudinales, actitudinales)} className="px-2 py-0.5 bg-amber-700 text-white font-bold text-[10px] rounded shadow">+ Añadir</button>
                </div>
                {actitudinales.map((item, index) => (
                  <div key={index} className="flex gap-1 items-center">
                    <textarea rows={2} value={item} onChange={e => cambiarCampo(setActitudinales, actitudinales, index, e.target.value)} placeholder="Actitud..." className="w-full p-2 border border-amber-200 rounded bg-white text-slate-900 font-medium text-xs outline-none" />
                    {actitudinales.length > 1 && <button type="button" onClick={() => eliminarCampo(setActitudinales, actitudinales, index)} className="text-red-600 font-bold text-xs">×</button>}
                  </div>
                ))}
              </div>

            </div>

          </div>

          {mensaje && (
            <div className={`p-3 rounded-xl text-xs font-bold ${mensaje.includes('✅') ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-100 text-red-900 border border-red-300'}`}>
              {mensaje}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={cargando} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase rounded-xl shadow transition">
              {cargando ? 'Guardando en Módulos...' : 'Registrar Estructura Modular en BD'}
            </button>
          </div>
        </form>
      )}

      {/* VISTA 2: GESTOR Y LISTADO */}
      {pestanaActiva === 'listado' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                Competencias Registradas en BD ({bloquesFiltrados.length})
              </h3>
              <p className="text-[11px] text-slate-600 font-semibold">
                Agrupadas por competencia con edición completa de indicadores y saberes.
              </p>
            </div>
            <button
              onClick={cargarRegistros}
              disabled={cargandoListado}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs rounded-xl transition border border-slate-300"
            >
              {cargandoListado ? 'Cargando...' : 'Actualizar Lista'}
            </button>
          </div>

          {/* FILTROS */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Filtrar Asignatura:</label>
              <select
                value={filtroAsignatura}
                onChange={e => setFiltroAsignatura(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none"
              >
                <option value="Todas">Todas las Asignaturas</option>
                {materiasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Filtrar Subnivel:</label>
              <select
                value={filtroSubnivel}
                onChange={e => {
                  setFiltroSubnivel(e.target.value)
                  setFiltroGrado('Todos')
                }}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none"
              >
                <option value="Todos">Todos los Subniveles</option>
                {subnivelesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Filtrar Grado:</label>
              <select
                value={filtroGrado}
                onChange={e => setFiltroGrado(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none"
              >
                <option value="Todos">Todos los Grados</option>
                {filtroSubnivel !== 'Todos'
                  ? (gradosPorSubnivel[filtroSubnivel] || []).map(g => <option key={g} value={g}>{g}</option>)
                  : Object.values(gradosPorSubnivel).flat().map((g, i) => <option key={i} value={g}>{g}</option>)
                }
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Buscar por texto:</label>
              <input
                type="text"
                value={busquedaTexto}
                onChange={e => setBusquedaTexto(e.target.value)}
                placeholder="Competencia, saber, indicador..."
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none"
              />
            </div>
          </div>

          {/* LISTA DE TARJETAS */}
          {cargandoListado ? (
            <p className="text-center py-8 text-xs text-slate-700 font-bold">Cargando registros desde Supabase...</p>
          ) : bloquesFiltrados.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-2xl border-slate-300">
              <p className="text-xs text-slate-500 font-bold uppercase">No se encontraron bloques con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="space-y-5">
              {bloquesFiltrados.map((bloque, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-indigo-200 bg-white space-y-4 shadow-sm">
                  <div className="flex justify-between items-start flex-wrap gap-2 border-b border-slate-100 pb-3">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="px-3 py-1 bg-indigo-700 text-white text-xs font-black rounded-lg uppercase">
                        {bloque.asignatura}
                      </span>
                      <span className="px-3 py-1 bg-slate-800 text-white text-xs font-bold rounded-lg uppercase">
                        {bloque.subnivel} • {bloque.grado_curso}
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-bold rounded-lg">
                        {bloque.indicadores.length} Indicador(es)
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirModalEdicionBloque(bloque)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
                      >
                        Editar Bloque Completo
                      </button>
                      <button
                        onClick={() => eliminarBloqueCompleto(bloque.ids)}
                        className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Competencia */}
                  <div className="space-y-1">
                    <span className="font-extrabold text-xs text-indigo-950 uppercase block">Competencia Específica:</span>
                    <p className="text-xs font-bold text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-300 leading-relaxed">
                      {bloque.competencia}
                    </p>
                  </div>

                  {/* Saberes e Indicadores */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    
                    <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 space-y-1">
                      <span className="font-black text-indigo-950 uppercase text-[11px] block border-b border-indigo-200 pb-1">
                        Indicadores ({bloque.indicadores.length}):
                      </span>
                      <ul className="list-disc pl-4 text-slate-900 text-xs font-medium space-y-1 pt-1">
                        {bloque.indicadores.map((ind: string, i: number) => <li key={i}>{ind}</li>)}
                      </ul>
                    </div>

                    <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 space-y-1">
                      <span className="font-black text-blue-950 uppercase text-[11px] block border-b border-blue-200 pb-1">
                        Declarativos ({bloque.declarativos.length}):
                      </span>
                      <ul className="list-disc pl-4 text-slate-900 text-xs font-medium space-y-1 pt-1">
                        {bloque.declarativos.map((dec: string, i: number) => <li key={i}>{dec}</li>)}
                      </ul>
                    </div>

                    <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-1">
                      <span className="font-black text-emerald-950 uppercase text-[11px] block border-b border-emerald-200 pb-1">
                        Procedimentales ({bloque.procedimentales.length}):
                      </span>
                      <ul className="list-disc pl-4 text-slate-900 text-xs font-medium space-y-1 pt-1">
                        {bloque.procedimentales.map((proc: string, i: number) => <li key={i}>{proc}</li>)}
                      </ul>
                    </div>

                    <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-1">
                      <span className="font-black text-amber-950 uppercase text-[11px] block border-b border-amber-200 pb-1">
                        Actitudinales ({bloque.actitudinales.length}):
                      </span>
                      <ul className="list-disc pl-4 text-slate-900 text-xs font-medium space-y-1 pt-1">
                        {bloque.actitudinales.map((act: string, i: number) => <li key={i}>{act}</li>)}
                      </ul>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE EDICIÓN */}
      {bloqueEdicion && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto border border-slate-300">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-sm uppercase">Editar Bloque Modular Completo</h3>
                <p className="text-xs text-slate-600 font-semibold">Agrega, elimina o edita los indicadores y saberes de esta competencia.</p>
              </div>
              <button
                onClick={() => setBloqueEdicion(null)}
                className="text-slate-500 hover:text-slate-900 font-black text-xl px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarCambiosBloqueCompleto} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Asignatura:</label>
                  <select
                    value={bloqueEdicion.asignatura}
                    onChange={e => setBloqueEdicion({ ...bloqueEdicion, asignatura: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none"
                  >
                    {materiasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Subnivel:</label>
                  <select
                    value={bloqueEdicion.subnivel}
                    onChange={e => {
                      const nuevoSub = e.target.value
                      const opciones = gradosPorSubnivel[nuevoSub] || []
                      setBloqueEdicion({ 
                        ...bloqueEdicion, 
                        subnivel: nuevoSub,
                        grado_curso: opciones[0] || bloqueEdicion.grado_curso
                      })
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none"
                  >
                    {subnivelesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Grado / Curso:</label>
                  <select
                    value={bloqueEdicion.grado_curso}
                    onChange={e => setBloqueEdicion({ ...bloqueEdicion, grado_curso: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold outline-none"
                  >
                    {(gradosPorSubnivel[bloqueEdicion.subnivel] || []).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 uppercase mb-1">Competencia Específica:</label>
                <textarea
                  rows={3}
                  value={bloqueEdicion.competencia}
                  onChange={e => setBloqueEdicion({ ...bloqueEdicion, competencia: e.target.value })}
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Indicadores dinámicos */}
              <div className="space-y-2 p-4 rounded-xl border border-slate-300 bg-slate-50">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-800 uppercase text-xs">Indicadores de Evaluación:</label>
                  <button 
                    type="button" 
                    onClick={() => agregarCampoEdicion('indicadores')}
                    className="px-3 py-1 bg-indigo-600 text-white font-bold text-xs rounded-lg shadow hover:bg-indigo-700 transition"
                  >
                    + Añadir Indicador
                  </button>
                </div>
                {bloqueEdicion.indicadores.map((ind, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <textarea 
                      rows={2} 
                      value={ind} 
                      onChange={e => cambiarCampoEdicion('indicadores', index, e.target.value)} 
                      placeholder={`Indicador ${index + 1}`} 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium outline-none" 
                      required 
                    />
                    {bloqueEdicion.indicadores.length > 1 && (
                      <button type="button" onClick={() => eliminarCampoEdicion('indicadores', index)} className="text-red-600 font-bold text-sm px-2">🗑️</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Saberes dinámicos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Declarativos */}
                <div className="space-y-2 p-3 rounded-xl border border-blue-300 bg-blue-50/60">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-blue-950 uppercase text-[11px]">Declarativos:</label>
                    <button type="button" onClick={() => agregarCampoEdicion('declarativos')} className="px-2 py-0.5 bg-blue-700 text-white font-bold text-[10px] rounded shadow">+ Añadir</button>
                  </div>
                  {bloqueEdicion.declarativos.map((item, index) => (
                    <div key={index} className="flex gap-1 items-center">
                      <textarea rows={2} value={item} onChange={e => cambiarCampoEdicion('declarativos', index, e.target.value)} placeholder="Concepto..." className="w-full p-2 border border-blue-300 rounded bg-white text-slate-900 font-medium text-xs outline-none" />
                      {bloqueEdicion.declarativos.length > 1 && <button type="button" onClick={() => eliminarCampoEdicion('declarativos', index)} className="text-red-600 font-bold text-xs">×</button>}
                    </div>
                  ))}
                </div>

                {/* Procedimentales */}
                <div className="space-y-2 p-3 rounded-xl border border-emerald-300 bg-emerald-50/60">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-emerald-950 uppercase text-[11px]">Procedimentales:</label>
                    <button type="button" onClick={() => agregarCampoEdicion('procedimentales')} className="px-2 py-0.5 bg-emerald-700 text-white font-bold text-[10px] rounded shadow">+ Añadir</button>
                  </div>
                  {bloqueEdicion.procedimentales.map((item, index) => (
                    <div key={index} className="flex gap-1 items-center">
                      <textarea rows={2} value={item} onChange={e => cambiarCampoEdicion('procedimentales', index, e.target.value)} placeholder="Acción..." className="w-full p-2 border border-emerald-300 rounded bg-white text-slate-900 font-medium text-xs outline-none" />
                      {bloqueEdicion.procedimentales.length > 1 && <button type="button" onClick={() => eliminarCampoEdicion('procedimentales', index)} className="text-red-600 font-bold text-xs">×</button>}
                    </div>
                  ))}
                </div>

                {/* Actitudinales */}
                <div className="space-y-2 p-3 rounded-xl border border-amber-300 bg-amber-50/60">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-amber-950 uppercase text-[11px]">Actitudinales:</label>
                    <button type="button" onClick={() => agregarCampoEdicion('actitudinales')} className="px-2 py-0.5 bg-amber-700 text-white font-bold text-[10px] rounded shadow">+ Añadir</button>
                  </div>
                  {bloqueEdicion.actitudinales.map((item, index) => (
                    <div key={index} className="flex gap-1 items-center">
                      <textarea rows={2} value={item} onChange={e => cambiarCampoEdicion('actitudinales', index, e.target.value)} placeholder="Actitud..." className="w-full p-2 border border-amber-300 rounded bg-white text-slate-900 font-medium text-xs outline-none" />
                      {bloqueEdicion.actitudinales.length > 1 && <button type="button" onClick={() => eliminarCampoEdicion('actitudinales', index)} className="text-red-600 font-bold text-xs">×</button>}
                    </div>
                  ))}
                </div>

              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setBloqueEdicion(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition"
                >
                  {guardandoEdicion ? 'Guardando...' : '💾 Guardar Todo el Bloque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}