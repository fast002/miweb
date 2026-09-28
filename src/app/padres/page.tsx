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

      // 1. Obtener datos del representante logueado y sus hijos vinculados
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

      // 2. Extraer lista completa de hijos (estudiantes vinculados) sin importar cuántos sean
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

  // Cargar información académica cuando cambia el hijo seleccionado o el período
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

      // Cargar calificaciones de la tabla public.calificaciones
      const { data: calData, error: calError } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('estudiante_id', estudianteId)
        .eq('anio_lectivo', anioLectivo)

      if (calError) console.error('Error al cargar calificaciones:', calError)
      setCalificaciones(calData || [])

      // Cargar asistencias de la tabla public.asistencias
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

  // Actualizar datos personales o contraseña
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

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando Panel del Representante...</p>
        </div>
      </div>
    )
  }

  const hijoActual = hijos.find(h => h.id === hijoSeleccionadoId)

  // --- CÁLCULO PRECISO DE INSUMOS (SOLO LOS CREADOS/EVALUADOS) ---
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

  // --- CÁLCULO DETALLADO DE ASISTENCIAS SEGÚN TU ESQUEMA ---
  const totalAsistencias = asistencias.filter(a => a.estado === 'Presente').length
  const totalAtrasos = asistencias.filter(a => a.estado === 'Atraso').length
  const totalFaltasJustificadas = asistencias.filter(a => a.estado === 'Falta Justificada').length
  const totalFaltasInjustificadas = asistencias.filter(a => a.estado === 'Falta Injustificada').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ENCABEZADO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-black uppercase tracking-wider">
              Portal de Padres y Representantes
            </span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
              ¡Bienvenido(a), {representante?.nombres} {representante?.apellidos}!
            </h1>
            <p className="text-xs text-slate-500 font-medium">Visualización de reportes académicos de sus representados.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Período Lectivo Activo</label>
              <select
                value={periodoActivo}
                onChange={(e) => setPeriodoActivo(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 outline-none"
              >
                {periodosDisponibles.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 self-end">
              <button
                onClick={() => setModalPerfilAbierto(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                ⚙️ Mi Perfil / Clave
              </button>
            </div>
          </div>
        </div>

        {/* SELECTOR DE HIJOS A CARGO (MUESTRA TODOS LOS REPRESENTADOS DISPONIBLES) */}
        {hijos.length > 0 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase">Seleccione el Representado a Consultar:</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {hijos.map((hijo) => (
                <button
                  key={hijo.id}
                  onClick={() => setHijoSeleccionadoId(hijo.id)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap shadow-xs cursor-pointer ${
                    hijoSeleccionadoId === hijo.id 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  👶 {hijo.apellidos} {hijo.nombres} ({hijo.grado_curso} "{hijo.paralelo}")
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VALIDACIÓN DE AÑO CERRADO */}
        {anioCerrado ? (
          <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center space-y-3">
            <span className="text-3xl">🔒</span>
            <h3 className="text-base font-black text-amber-900">Período Lectivo Cerrado</h3>
            <p className="text-xs text-amber-700 font-medium max-w-md mx-auto">
              El año lectivo seleccionado se encuentra cerrado. Las calificaciones, asistencias y reportes no se encuentran visibles hasta que inicie un nuevo período disponible.
            </p>
          </div>
        ) : (
          <>
            {/* DASHBOARDS DE RESUMEN (INSUMOS Y ASISTENCIAS DETALLADAS DEL HIJO SELECCIONADO) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Dashboard de Insumos */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">📚 Estado de Insumos ({hijoActual?.nombres})</h3>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Actualizado</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-black text-emerald-700">{insumosPresentados}</span>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Insumos Registrados</span>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-black text-rose-700">{insumosPendientes}</span>
                    <span className="text-[10px] font-bold text-rose-800 uppercase">Pendientes / Sin Nota</span>
                  </div>
                </div>
              </div>

              {/* Dashboard de Asistencias (Desglose Completo) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">📊 Control de Asistencia ({hijoActual?.nombres})</h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Registro Oficial</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                    <span className="block text-xl font-black text-emerald-700">{totalAsistencias}</span>
                    <span className="text-[9px] font-bold text-emerald-800 uppercase">Asistencias</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center">
                    <span className="block text-xl font-black text-blue-700">{totalAtrasos}</span>
                    <span className="text-[9px] font-bold text-blue-800 uppercase">Atrasos</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                    <span className="block text-xl font-black text-amber-700">{totalFaltasJustificadas}</span>
                    <span className="text-[9px] font-bold text-amber-800 uppercase">F. Justificadas</span>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-center">
                    <span className="block text-xl font-black text-rose-700">{totalFaltasInjustificadas}</span>
                    <span className="text-[9px] font-bold text-rose-800 uppercase">F. Injustificadas</span>
                  </div>
                </div>
              </div>

            </div>

            {/* HISTORIAL RECIENTE DE ASISTENCIAS DETALLADAS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">📅 Historial de Asistencia Detallado ({hijoActual?.nombres})</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {asistencias.map((a) => (
                  <div key={a.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="font-bold text-slate-700 block">{a.fecha}</span>
                      <span className="text-[10px] text-slate-500">{a.asignatura || 'General'}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      a.estado === 'Presente' ? 'bg-emerald-100 text-emerald-800' :
                      a.estado === 'Atraso' ? 'bg-blue-100 text-blue-800' :
                      a.estado === 'Falta Justificada' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {a.estado}
                    </span>
                  </div>
                ))}
                {asistencias.length === 0 && (
                  <p className="text-center text-slate-400 text-xs py-6">No hay registros de asistencia recientes para este estudiante.</p>
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {/* MODAL: ACTUALIZAR DATOS PERSONALES Y CONTRASEÑA */}
      {modalPerfilAbierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-slate-800">⚙️ Configuración de Perfil y Clave</h2>
              <button onClick={() => setModalPerfilAbierto(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            {mensajePerfil && (
              <div className={`p-3 rounded-xl text-xs font-bold text-center ${
                mensajePerfil.includes('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {mensajePerfil}
              </div>
            )}

            <form onSubmit={handleActualizarPerfil} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Correo Electrónico (No modificable):</label>
                <input
                  type="email"
                  disabled
                  value={representante?.email || ''}
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-500 bg-slate-100 outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Número Telefónico / Celular:</label>
                <input
                  type="text"
                  required
                  value={nuevoTelefono}
                  onChange={(e) => setNuevoTelefono(e.target.value)}
                  placeholder="0991234567"
                  className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="border-t pt-3">
                <p className="text-[10px] font-black text-indigo-700 uppercase mb-2">Cambiar Contraseña Temporal</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-600 font-bold uppercase mb-1">Nueva Contraseña:</label>
                    <input
                      type="password"
                      value={nuevaPassword}
                      onChange={(e) => setNuevaPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold uppercase mb-1">Confirmar Nueva Contraseña:</label>
                    <input
                      type="password"
                      value={confirmarPassword}
                      onChange={(e) => setConfirmarPassword(e.target.value)}
                      placeholder="Repita la contraseña"
                      className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setModalPerfilAbierto(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
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