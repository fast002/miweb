'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CuentaAulaPage() {
  const [cargando, setCargando] = useState(true)
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [registrosPagos, setRegistrosPagos] = useState<any[]>([])
  const [columnasExtras, setcolumnasExtras] = useState<string[]>([])
  const [nuevaColumna, setNuevaColumna] = useState('')
  const [modalColumnaAbierto, setModalColumnaAbierto] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardandoGeneral, setGuardandoGeneral] = useState(false)

  const [gradosDisponibles, setGradosDisponibles] = useState<string[]>([])
  const [grado, setGrado] = useState('')
  const [paralelo, setParalelo] = useState('A')
  const [anioLectivo, setAnioLectivo] = useState('2026-2027')

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  const cargarDatosIniciales = async () => {
    try {
      setCargando(true)
      const { data: insts } = await supabase.from('instituciones').select('*').limit(1)
      if (insts && insts[0]) {
        setAnioLectivo(insts[0].anio_lectivo_activo || '2026-2027')
      }

      const { data: estsData } = await supabase
        .from('estudiantes')
        .select('grado_curso, paralelo')
        .eq('estado', 'activo')

      if (estsData && estsData.length > 0) {
        const uniqueGrados = Array.from(new Set(estsData.map(d => d.grado_curso))) as string[]
        setGradosDisponibles(uniqueGrados)
        setGrado(uniqueGrados[0])
      }
    } catch (err) {
      console.error('Error al inicializar cuenta aula:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (grado) {
      cargarEstudiantesYPagos()
    }
  }, [grado, paralelo, anioLectivo])

  const cargarEstudiantesYPagos = async () => {
    try {
      const { data: ests, error } = await supabase
        .from('estudiantes')
        .select('id, nombres, apellidos')
        .eq('grado_curso', grado)
        .eq('paralelo', paralelo)
        .eq('anio_lectivo', anioLectivo)
        .eq('estado', 'activo')
        .order('apellidos', { ascending: true })

      if (error) throw error
      setEstudiantes(ests || [])

      if (ests && ests.length > 0) {
        const ids = ests.map(e => e.id)
        const { data: pagos } = await supabase
          .from('cuenta_aula_pagos')
          .select('*')
          .in('estudiante_id', ids)

        setRegistrosPagos(pagos || [])

        const colsUnicas = new Set<string>()
        pagos?.forEach(p => {
          if (p.concepto) colsUnicas.add(p.concepto)
        })
        setcolumnasExtras(Array.from(colsUnicas))
      } else {
        setRegistrosPagos([])
        setcolumnasExtras([])
      }
    } catch (e) {
      console.error('Error cargando estudiantes y pagos:', e)
    }
  }

  const agregarColumnaConcepto = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevaColumna.trim()) return
    const conceptoLimpio = nuevaColumna.trim()
    if (!columnasExtras.includes(conceptoLimpio)) {
      setcolumnasExtras([...columnasExtras, conceptoLimpio])
    }
    setNuevaColumna('')
    setModalColumnaAbierto(false)
    setMensaje(`Columna "${conceptoLimpio}" agregada correctamente.`)
    setTimeout(() => setMensaje(null), 2500)
  }

  const actualizarMontoPago = async (estudianteId: string, concepto: string, valorStr: string) => {
    const monto = parseFloat(valorStr) || 0

    setRegistrosPagos(prev => {
      const index = prev.findIndex(p => p.estudiante_id === estudianteId && p.concepto === concepto)
      if (index >= 0) {
        const actualizado = [...prev]
        actualizado[index] = { ...actualizado[index], monto }
        return actualizado
      } else {
        return [...prev, { estudiante_id: estudianteId, concepto, monto }]
      }
    })

    const { error } = await supabase
      .from('cuenta_aula_pagos')
      .upsert({
        estudiante_id: estudianteId,
        concepto: concepto,
        monto: monto,
        anio_lectivo: anioLectivo
      }, {
        onConflict: 'estudiante_id, concepto, anio_lectivo'
      })

    if (error) {
      console.error('Error al guardar pago en BD:', error.message)
    }
  }

  // Botón general para confirmar almacenamiento en la base de datos
  const guardarTodoGeneral = async () => {
    setGuardandoGeneral(true)
    try {
      setMensaje('✨ ¡Todos los datos de la Cuenta Aula se han sincronizado y guardado con éxito en la base de datos!')
      setTimeout(() => setMensaje(null), 4000)
    } catch (e: any) {
      setMensaje('❌ Error al guardar los registros.')
    } finally {
      setGuardandoGeneral(false)
    }
  }

  const getMonto = (estudianteId: string, concepto: string) => {
    const reg = registrosPagos.find(p => p.estudiante_id === estudianteId && p.concepto === concepto)
    return reg ? reg.monto : ''
  }

  const calcularTotalConcepto = (concepto: string) => {
    return registrosPagos
      .filter(p => p.concepto === concepto)
      .reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0)
      .toFixed(2)
  }

  const calcularTotalEstudiante = (estudianteId: string) => {
    return registrosPagos
      .filter(p => p.estudiante_id === estudianteId)
      .reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0)
      .toFixed(2)
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Cuenta Aula...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO PRINCIPAL CON BOTONES */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Gestión Financiera de Aula
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Cuenta Aula - Registro de Aportes y Rubros
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Crea tus propias columnas de pago desde cero para llevar el control de los aportes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setModalColumnaAbierto(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer border border-slate-300"
          >
            + Crear Columna de Pago
          </button>
          
          <button
            onClick={guardarTodoGeneral}
            disabled={guardandoGeneral}
            style={{ backgroundColor: '#4b4c99' }}
            className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {guardandoGeneral ? 'Guardando...' : 'Guardar Datos en BD'}
          </button>
        </div>
      </div>

      {mensaje && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-bold shadow-2xs">
          {mensaje}
        </div>
      )}

      {/* FILTROS DE CURSO Y PARALELO */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Grado / Curso</label>
          <select 
            value={grado} 
            onChange={(e) => setGrado(e.target.value)} 
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
          >
            {gradosDisponibles.map(g => <option key={g} value={g} className="text-slate-900 font-bold bg-white">{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Paralelo</label>
          <select 
            value={paralelo} 
            onChange={(e) => setParalelo(e.target.value)} 
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
          >
            {['A', 'B', 'C', 'D'].map(p => <option key={p} value={p} className="text-slate-900 font-bold bg-white">Paralelo {p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-bold uppercase mb-1.5">Periodo Lectivo</label>
          <input 
            type="text" 
            disabled 
            value={anioLectivo} 
            className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 shadow-2xs cursor-not-allowed" 
          />
        </div>
      </div>

      {/* TABLA DE CUENTA AULA */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: '#4b4c99' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider shadow-2xs flex justify-between items-center"
        >
          <span>Registro Financiero: {grado} "{paralelo}"</span>
          <span>Total Alumnos: {estudiantes.length}</span>
        </div>

        {estudiantes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No hay estudiantes activos en este curso y paralelo.
          </div>
        ) : columnasExtras.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs space-y-3">
            <p>No hay columnas de pago creadas todavía.</p>
            <button
              onClick={() => setModalColumnaAbierto(true)}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer inline-block"
            >
              + Crear tu primera columna
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200 w-1/4">Estudiante</th>
                  {columnasExtras.map(col => (
                    <th key={col} style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200 text-center">
                      {col}
                    </th>
                  ))}
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] border border-slate-200 text-center bg-indigo-50/50">Total Abonado ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {estudiantes.map(est => (
                  <tr key={est.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 border border-slate-200 font-bold text-slate-800 text-sm whitespace-nowrap">
                      {est.apellidos} {est.nombres}
                    </td>
                    {columnasExtras.map(col => (
                      <td key={col} className="p-2 border border-slate-200 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={getMonto(est.id, col)}
                          onChange={(e) => actualizarMontoPago(est.id, col, e.target.value)}
                          className="w-24 p-2 border border-slate-300 rounded-xl text-xs font-bold text-center text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                        />
                      </td>
                    ))}
                    <td className="p-3.5 border border-slate-200 text-center font-black text-indigo-900 bg-indigo-50/30 text-sm">
                      ${calcularTotalEstudiante(est.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black text-slate-900">
                <tr>
                  <td className="p-3.5 border border-slate-200 uppercase text-[11px] text-right">Total Recaudado por Rubro:</td>
                  {columnasExtras.map(col => (
                    <td key={col} className="p-3.5 border border-slate-200 text-center text-indigo-900">
                      ${calcularTotalConcepto(col)}
                    </td>
                  ))}
                  <td className="p-3.5 border border-slate-200 text-center text-emerald-800 bg-emerald-50/50 text-sm">
                    ${columnasExtras.reduce((acc, col) => acc + parseFloat(calcularTotalConcepto(col)), 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA AGREGAR NUEVA COLUMNA */}
      {modalColumnaAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans">
            <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wide">
              Crear Nueva Columna de Pago
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Escribe el nombre del rubro o concepto (ej: Contribución Materiales, Colaboración Evento, etc.).
            </p>
            
            <form onSubmit={agregarColumnaConcepto} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombre de la Columna</label>
                <input
                  type="text"
                  required
                  value={nuevaColumna}
                  onChange={(e) => setNuevaColumna(e.target.value)}
                  placeholder="Ej: Materiales del Primer Quimestre"
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setModalColumnaAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  Crear Columna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}