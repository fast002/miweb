'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PadreDashboardPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [representante, setRepresentante] = useState<any>(null)
  const [hijos, setHijos] = useState<any[]>([])
  const [hijoSeleccionadoId, setHijoSeleccionadoId] = useState<string>('')
  
  // Períodos y años lectivos
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [periodoActivo, setPeriodoActivo] = useState('')
  const [anioCerrado, setAnioCerrado] = useState(false)

  // Datos académicos del hijo seleccionado
  const [calificaciones, setCalificaciones] = useState<any[]>([])
  const [asistencias, setAsistencias] = useState<any[]>([])

  // Modal / Vista de Actualización de Datos y Contraseña
  const [modalPerfilAbierto, setModalPerfilAbierto] = useState(false)
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [mensajePerfil, setMensajePerfil] = useState('')

  useEffect(() => {
    cargarDatosPadre()
  }, [])

  const cargarDatosPadre = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: repData, error: repError } = await supabase
        .from('estudiante_representantes')
        .select('*, estudiantes(*, instituciones(*))')
        .eq('user_id', user.id)

      if (repError || !repData || repData.length === 0) {
        throw new Error('No se encontraron registros de representación para este usuario.')
      }

      const datosRep = {
        nombres: repData[0].nombres,
        apellidos: repData[0].apellidos,
        email: repData[0].email || user.email,
        telefono: repData[0].telefono,
        user_id: user.id
      }
      setRepresentante(datosRep)
      setNuevoTelefono(datosRep.telefono || '')

      const listaHijos = repData.map((item: any) => item.estudiantes).filter(Boolean)
      setHijos(listaHijos)

      if (listaHijos.length > 0) {
        setHijoSeleccionadoId(listaHijos[0].id)

        const institucion = listaHijos[0].instituciones
        if (institucion) {
          const periodos = institucion.periodos_disponibles || ['2025-2026', '2026-2027']
          setPeriodosDisponibles(periodos)
          const activo = institucion.anio_lectivo_activo || periodos[0]
          setPeriodoActivo(activo)
          setAnioCerrado(institucion.anio_cerrado || false)
        }
      }

    } catch (err: any) {
      console.error('Error al cargar datos del padre:', err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (hijoSeleccionadoId && periodoActivo) {
      cargarDetallesAcademicos(hijoSeleccionadoId, periodoActivo)
    }
  }, [hijoSeleccionadoId, periodoActivo])

  const cargarDetallesAcademicos = async (estudianteId: string, anioLectivo: string) => {
    try {
      if (anioCerrado) {
        setCalificaciones([])
        setAsistencias([])
        return
      }

      const { data: calData, error: calError } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('estudiante_id', estudianteId)
        .eq('anio_lectivo', anioLectivo)

      if (calError) console.error('Error al cargar calificaciones:', calError)
      setCalificaciones(calData || [])

      const { data: asisData, error: asisError } = await supabase
        .from('asistencias')
        .select('*')
        .eq('estudiante_id', estudianteId)
        .eq('anio_lectivo', anioLectivo)

      if (asisError) console.error('Error al cargar asistencias:', asisError)
      setAsistencias(asisData || [])

    } catch (err) {
      console.error('Error al cargar detalles académicos:', err)
    }
  }

  const handleActualizarPerfil = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensajePerfil('')

    try {
      if (nuevaPassword && nuevaPassword.length < 8) {
        throw new Error('La nueva contraseña debe tener al menos 8 caracteres.')
      }

      if (nuevaPassword && nuevaPassword !== confirmarPassword) {
        throw new Error('Las contraseñas no coinciden.')
      }

      const { error: updateError } = await supabase
        .from('estudiante_representantes')
        .update({ telefono: nuevoTelefono.trim() })
        .eq('user_id', representante.user_id)

      if (updateError) throw updateError

      if (nuevaPassword) {
        const { error: passError } = await supabase.auth.updateUser({
          password: nuevaPassword
        })
        if (passError) throw passError
      }

      setMensajePerfil('¡Datos actualizados con éxito!')
      setTimeout(() => {
        setModalPerfilAbierto(false)
        setMensajePerfil('')
        setNuevaPassword('')
        setConfirmarPassword('')
      }, 1500)

    } catch (err: any) {
      setMensajePerfil('Error: ' + err.message)
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Panel del Representante...</p>
        </div>
      </div>
    )
  }

  const hijoActual = hijos.find(h => h.id === hijoSeleccionadoId)

  let insumosPresentados = 0
  let insumosPendientes = 0

  calificaciones.forEach(c => {
    const insumos = [c.insumo_1, c.insumo_2, c.insumo_3, c.insumo_4]
    insumos.forEach(val => {
      if (val !== null && val !== undefined) {
        insumosPresentados++
      } else {
        insumosPendientes++
      }
    })
  })

  const totalAsistencias = asistencias.filter(a => a.estado === 'Presente').length
  const totalAtrasos = asistencias.filter(a => a.estado === 'Atraso').length
  const totalFaltasJustificadas = asistencias.filter(a => a.estado === 'Falta Justificada').length
  const totalFaltasInjustificadas = asistencias.filter(a => a.estado === 'Falta Injustificada').length

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans max-w-7xl mx-auto">

      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Portal de Padres y Representantes
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            ¡Bienvenido(a), {representante?.nombres} {representante?.apellidos}!
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Visualización de reportes académicos y control de asistencia de sus representados.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Período Lectivo Activo</label>
            <select
              value={periodoActivo}
              onChange={(e) => setPeriodoActivo(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
            >
              {periodosDisponibles.map((p) => (
                <option key={p} value={p} className="text-slate-900 font-bold bg-white">{p}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 self-end">
            <button
              onClick={() => setModalPerfilAbierto(true)}
              style={{ backgroundColor: '#4b4c99' }}
              className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              Mi Perfil / Clave
            </button>
          </div>
        </div>
      </div>

      {/* SELECTOR DE HIJOS A CARGO */}
      {hijos.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2.5">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Seleccione el Representado a Consultar:</label>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {hijos.map((hijo) => (
              <button
                key={hijo.id}
                onClick={() => setHijoSeleccionadoId(hijo.id)}
                style={hijoSeleccionadoId === hijo.id ? { backgroundColor: '#4b4c99' } : {}}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap shadow-2xs cursor-pointer ${
                  hijoSeleccionadoId === hijo.id 
                    ? 'text-white shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                {hijo.apellidos} {hijo.nombres} ({hijo.grado_curso} "{hijo.paralelo}")
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VALIDACIÓN DE AÑO CERRADO */}
      {anioCerrado ? (
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-3xl text-center space-y-3 shadow-2xs">
          <span className="text-3xl"></span>
          <h3 className="text-sm font-bold text-amber-900 uppercase">Período Lectivo Cerrado</h3>
          <p className="text-xs text-amber-700 font-medium max-w-md mx-auto">
            El año lectivo seleccionado se encuentra cerrado. Las calificaciones, asistencias y reportes no se encuentran visibles hasta que inicie un nuevo período disponible.
          </p>
        </div>
      ) : (
        <>
          {/* DASHBOARDS DE RESUMEN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Dashboard de Insumos */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Estado de Insumos ({hijoActual?.nombres})</h3>
                <span style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)' }} className="text-[10px] font-bold px-2.5 py-1 rounded-xl">Actualizado</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="block text-2xl font-black text-emerald-800">{insumosPresentados}</span>
                  <span className="text-[10px] font-bold text-emerald-900 uppercase mt-1 block">Insumos Registrados</span>
                </div>
                <div className="bg-rose-50/60 border border-rose-200 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="block text-2xl font-black text-rose-800">{insumosPendientes}</span>
                  <span className="text-[10px] font-bold text-rose-900 uppercase mt-1 block">Pendientes / Sin Nota</span>
                </div>
              </div>
            </div>

            {/* Dashboard de Asistencias */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Control de Asistencia ({hijoActual?.nombres})</h3>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">Registro Oficial</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-2xl text-center shadow-2xs">
                  <span className="block text-xl font-black text-emerald-800">{totalAsistencias}</span>
                  <span className="text-[9px] font-bold text-emerald-900 uppercase mt-1 block">Asistencias</span>
                </div>
                <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-2xl text-center shadow-2xs">
                  <span className="block text-xl font-black text-blue-800">{totalAtrasos}</span>
                  <span className="text-[9px] font-bold text-blue-900 uppercase mt-1 block">Atrasos</span>
                </div>
                <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-2xl text-center shadow-2xs">
                  <span className="block text-xl font-black text-amber-800">{totalFaltasJustificadas}</span>
                  <span className="text-[9px] font-bold text-amber-900 uppercase mt-1 block">F. Justificadas</span>
                </div>
                <div className="bg-rose-50/60 border border-rose-200 p-3 rounded-2xl text-center shadow-2xs">
                  <span className="block text-xl font-black text-rose-800">{totalFaltasInjustificadas}</span>
                  <span className="text-[9px] font-bold text-rose-900 uppercase mt-1 block">F. Injustificadas</span>
                </div>
              </div>
            </div>

          </div>

          {/* HISTORIAL RECIENTE DE ASISTENCIAS DETALLADAS */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-3">
              Historial de Asistencia Detallado ({hijoActual?.nombres})
            </h3>
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {asistencias.map((a) => (
                <div key={a.id} className="flex justify-between items-center bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 text-xs shadow-2xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{a.fecha}</span>
                    <span className="text-[10px] text-slate-500 font-semibold">{a.asignatura || 'General'}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase shadow-2xs ${
                    a.estado === 'Presente' ? 'bg-emerald-100 text-emerald-800' :
                    a.estado === 'Atraso' ? 'bg-blue-100 text-blue-800' :
                    a.estado === 'Falta Justificada' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {a.estado}
                  </span>
                </div>
              ))}
              {asistencias.length === 0 && (
                <p className="text-center text-slate-400 font-medium text-xs py-8">No hay registros de asistencia recientes para este estudiante.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL: ACTUALIZAR DATOS PERSONALES Y CONTRASEÑA */}
      {modalPerfilAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Configuración de Perfil y Clave</h2>
              <button onClick={() => setModalPerfilAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            {mensajePerfil && (
              <div className={`p-3.5 rounded-2xl text-xs font-bold text-center border shadow-2xs ${
                mensajePerfil.includes('Error') ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {mensajePerfil}
              </div>
            )}

            <form onSubmit={handleActualizarPerfil} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Correo Electrónico (No modificable):</label>
                <input
                  type="email"
                  disabled
                  value={representante?.email || ''}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 outline-none cursor-not-allowed shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Número Telefónico / Celular:</label>
                <input
                  type="text"
                  required
                  value={nuevoTelefono}
                  onChange={(e) => setNuevoTelefono(e.target.value)}
                  placeholder="0991234567"
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                />
              </div>

              <div className="border-t border-slate-200 pt-3.5">
                <p style={{ color: '#4b4c99' }} className="text-[10px] font-bold uppercase tracking-wider mb-2.5">Cambiar Contraseña Temporal</p>
                
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1.5">Nueva Contraseña:</label>
                    <input
                      type="password"
                      value={nuevaPassword}
                      onChange={(e) => setNuevaPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1.5">Confirmar Nueva Contraseña:</label>
                    <input
                      type="password"
                      value={confirmarPassword}
                      onChange={(e) => setConfirmarPassword(e.target.value)}
                      placeholder="Repita la contraseña"
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-3.5">
                <button
                  type="button"
                  onClick={() => setModalPerfilAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}