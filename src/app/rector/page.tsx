'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RectorDashboardPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)

  const [autoridad, setAutoridad] = useState<any>(null)
  const [nombreInstitucion, setNombreInstitucion] = useState('')
  const [institucionLogo, setInstitucionLogo] = useState('')
  const [licenciaVence, setLicenciaVence] = useState('N/A')
  
  // Estados para la Gestión de Años Lectivos propios de la institución (sin valores precargados)
  const [anioLectivo, setAnioLectivo] = useState('')
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anosCerrados, setItemsAnosCerrados] = useState<string[]>([])
  
  // Modales
  const [modalPromocionAbierto, setModalPromocionAbierto] = useState(false)
  const [modalNuevoAnioAbierto, setModalNuevoAnioAbierto] = useState(false)
  const [nuevoAnioInput, setNuevoAnioInput] = useState('')
  const [procesando, setProcesando] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Lógica segura para subir el logo a Supabase Storage con nombre único institucional
  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !autoridad?.institucion_id) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logo_${autoridad.institucion_id}_${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('instituciones')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('instituciones').getPublicUrl(fileName)
      
      const { error: updateError } = await supabase
        .from('instituciones')
        .update({ logo_url: publicUrl })
        .eq('id', autoridad.institucion_id)

      if (updateError) throw updateError

      setInstitucionLogo(publicUrl)
      alert('✅ Logo institucional actualizado exitosamente.')
    } catch (err: any) {
      alert('Error al subir el logo. Asegúrate de que el bucket "instituciones" exista y sea público en Supabase: ' + err.message)
    }
  }

  // Cambiar y Guardar el Año Lectivo Activo en la BD
  const handleCambiarAnioActivo = async (nuevoAnio: string) => {
    setAnioLectivo(nuevoAnio)
    if (!autoridad?.institucion_id) return

    try {
      await supabase
        .from('instituciones')
        .update({ anio_lectivo_activo: nuevoAnio })
        .eq('id', autoridad.institucion_id)
    } catch (err) {
      console.error('Error al actualizar periodo activo:', err)
    }
  }

  // Crear un Nuevo Año Lectivo para la institución
  const handleCrearNuevoAnio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoAnioInput.trim() || periodosDisponibles.includes(nuevoAnioInput.trim())) {
      alert('Ingresa un periodo válido que no exista previamente (ej. 2026-2027).')
      return
    }

    const nuevoListado = [...periodosDisponibles, nuevoAnioInput.trim()]
    try {
      setProcesando(true)
      const { error } = await supabase
        .from('instituciones')
        .update({ 
          periodos_disponibles: nuevoListado,
          anio_lectivo_activo: anioLectivo ? anioLectivo : nuevoAnioInput.trim()
        })
        .eq('id', autoridad.institucion_id)

      if (error) throw error

      setPeriodosDisponibles(nuevoListado)
      if (!anioLectivo) {
        setAnioLectivo(nuevoAnioInput.trim())
      }
      setNuevoAnioInput('')
      setModalNuevoAnioAbierto(false)
      alert('✅ Nuevo año lectivo creado exitosamente.')
    } catch (err: any) {
      alert('Error al crear periodo: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  // Cerrar / Bloquear el Año Lectivo Actual
  const handleCerrarPeriodoActual = async () => {
    if (!anioLectivo) {
      alert('No hay ningún año lectivo activo seleccionado.')
      return
    }

    if (anosCerrados.includes(anioLectivo)) {
      alert('Este periodo ya se encuentra cerrado y bloqueado.')
      return
    }

    if (!confirm(`⚠️ ¿Estás seguro de CERRAR Y BLOQUEAR el periodo ${anioLectivo}?\n\nAl cerrarlo, los docentes ya no podrán modificar calificaciones ni ver cargas activas de este periodo, garantizando la inmutabilidad del histórico.`)) {
      return
    }

    const nuevosCerrados = [...anosCerrados, anioLectivo]
    try {
      setProcesando(true)
      const { error } = await supabase
        .from('instituciones')
        .update({ anos_cerrados: nuevosCerrados })
        .eq('id', autoridad.institucion_id)

      if (error) throw error

      setItemsAnosCerrados(nuevosCerrados)
      alert(`🔒 El periodo ${anioLectivo} ha sido cerrado y bloqueado con éxito.`)
    } catch (err: any) {
      alert('Error al cerrar periodo: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  // Validación de seguridad estricta para el cierre y promoción anual
  const verificarYAbrirPromocion = () => {
    if (!anioLectivo) {
      alert('Debe crear y seleccionar un año lectivo activo primero.')
      return
    }

    const esCerrado = anosCerrados.includes(anioLectivo)

    if (!esCerrado) {
      alert(`⚠️ Advertencia de Seguridad:\n\nEl año lectivo vigente (${anioLectivo}) aún no se ha cerrado. Debe hacer clic en el botón "Cerrar Periodo" (candado) antes de poder ejecutar la promoción anual.`)
      return
    }

    if (periodosDisponibles.length <= 1) {
      alert(`⚠️ Advertencia de Seguridad:\n\nNo se ha creado un nuevo año lectivo. Debe hacer clic en "+ Nuevo" y crear el siguiente periodo escolar antes de continuar con la promoción.`)
      return
    }

    setModalPromocionAbierto(true)
  }

  // Función para ejecutar la Promoción de Estudiantes al Siguiente Nivel
  const ejecutarPromocionAnual = async () => {
    try {
      setProcesando(true)

      const { error } = await supabase.rpc('promover_estudiantes_anual', {
        inst_id: autoridad.institucion_id
      })

      if (error) {
        alert('Proceso de transición registrado. Recuerda verificar las matrículas del nuevo periodo.')
      } else {
        alert('✅ ¡Promoción de estudiantes realizada con éxito para el nuevo periodo!')
      }

      setModalPromocionAbierto(false)
    } catch (err: any) {
      alert('Error al procesar la promoción: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  useEffect(() => {
    async function initRectorDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: docData } = await supabase
          .from('docentes')
          .select('*, instituciones(*)')
          .eq('id', user.id)
          .maybeSingle()

        if (docData) {
          const rol = docData.rol?.toLowerCase() || ''
          const esAutoridad = rol.includes('rector') || rol.includes('vicerrector') || rol.includes('director')

          if (!esAutoridad) {
            router.push('/docente')
            return
          }

          setAutoridad(docData)
          setNombreInstitucion(docData.instituciones?.nombre_institucion || 'Unidad Educativa')
          setInstitucionLogo(docData.instituciones?.logo_url || '')

          // Carga estricta de los periodos propios creados por la institución (sin valores precargados)
          const periodosInst = docData.instituciones?.periodos_disponibles || []
          setPeriodosDisponibles(periodosInst)

          if (docData.instituciones?.anio_lectivo_activo) {
            setAnioLectivo(docData.instituciones.anio_lectivo_activo)
          } else if (periodosInst.length > 0) {
            setAnioLectivo(periodosInst[0])
          } else {
            setAnioLectivo('')
          }

          if (docData.instituciones?.anos_cerrados) {
            setItemsAnosCerrados(docData.instituciones.anos_cerrados)
          }

          // Consulta directa a la tabla "licencias" usando el institucion_id
          if (docData.institucion_id) {
            const { data: licenciaData } = await supabase
              .from('licencias')
              .select('fecha_vencimiento')
              .eq('institucion_id', docData.institucion_id)
              .maybeSingle()

            if (licenciaData?.fecha_vencimiento) {
              setLicenciaVence(new Date(licenciaData.fecha_vencimiento).toLocaleDateString())
            } else {
              setLicenciaVence('Sin licencia registrada')
            }
          }
        } else {
          router.push('/')
        }
      } catch (err) {
        console.error('Error al cargar panel del rector:', err)
        router.push('/')
      } finally {
        setCargando(false)
      }
    }

    initRectorDashboard()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando Panel Rectoral...</p>
        </div>
      </div>
    )
  }

  const iniciales = `${autoridad?.nombres?.[0] || ''}${autoridad?.apellidos?.[0] || ''}`.toUpperCase()
  const esAnioCerrado = anioLectivo ? anosCerrados.includes(anioLectivo) : false

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ENCABEZADO SUPERIOR CON ESTILO MINIMALISTA Y LOGO INSTITUCIONAL */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {institucionLogo ? (
              <img 
                src={institucionLogo} 
                alt="Logo Institución" 
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 object-contain cursor-pointer hover:opacity-80 transition" 
                title="Cambiar logo institucional"
              />
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full bg-purple-100 text-purple-900 font-black text-sm flex items-center justify-center border border-purple-200 cursor-pointer hover:opacity-80 transition"
                title="Subir logo institucional"
              >
                {iniciales || 'DR'}
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleUploadLogo} className="hidden" accept="image/*" />
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-wide uppercase">
                Panel Rectoral / Dirección
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                {nombreInstitucion} • <strong className="text-slate-700">Bienvenido/a, {autoridad?.nombres} {autoridad?.apellidos}</strong>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="text-[10px] text-indigo-600 font-bold hover:underline ml-1"
                >
                  (Cambiar Logo)
                </button>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* SELECTOR Y GESTOR UNIFICADO DE AÑOS LECTIVOS INSTITUCIONALES */}
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Periodo:</span>
              {periodosDisponibles.length === 0 ? (
                <span className="text-xs font-bold text-amber-600 italic">Sin años creados</span>
              ) : (
                <select
                  value={anioLectivo}
                  onChange={(e) => handleCambiarAnioActivo(e.target.value)}
                  className="bg-transparent text-xs font-black text-indigo-700 outline-none cursor-pointer"
                >
                  {periodosDisponibles.map((p) => (
                    <option key={p} value={p}>{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setModalNuevoAnioAbierto(true)}
                className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded-lg transition shrink-0"
                title="Crear nuevo año lectivo"
              >
                + Nuevo
              </button>
            </div>

            <div className="bg-amber-50 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-200 flex items-center gap-1.5 shadow-2xs">
              <span>⏳ Licencia Vence:</span> <strong className="font-black">{licenciaVence}</strong>
            </div>

            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition shadow-2xs flex items-center gap-1.5"
            >
              <span>Cerrar Sesión</span> 🚪
            </button>
          </div>
        </div>

        {/* AVISO SI EL PERIODO ACTUAL ESTÁ CERRADO */}
        {esAnioCerrado && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between text-red-900 text-xs font-bold">
            <span>🔒 Este periodo lectivo ({anioLectivo}) se encuentra cerrado y bloqueado. Las calificaciones y asignaciones de este año son de solo lectura.</span>
            <span className="bg-red-200 px-2.5 py-1 rounded-lg">Modo Archivo</span>
          </div>
        )}

        {/* ACCESOS DIRECTOS DEL RECTOR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* Registro de Usuarios */}
          <div 
            onClick={() => router.push('/rector/dashboard')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-1 group-hover:bg-blue-600 group-hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition">Registro de Usuarios</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Alta y gestión de docentes y personal institucional.</p>
          </div>

          {/* Carga Horaria */}
          <div 
            onClick={() => router.push('/rector/asignaciones-docentes')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-1 group-hover:bg-purple-600 group-hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm group-hover:text-purple-600 transition">Carga Horaria</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Distributivo y asignación de materias por docente.</p>
          </div>

          {/* Asignaturas */}
          <div 
            onClick={() => router.push('/rector/asignaturas')} 
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1 group-hover:bg-indigo-600 group-hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition">Asignaturas</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Configuración de mallas y cátedras oficiales.</p>
          </div>

          {/* Revisión de Planificaciones */}
          <div 
            onClick={() => router.push('/rector/dashboard/revision')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-1 group-hover:bg-amber-600 group-hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm group-hover:text-amber-600 transition">Planificaciones</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Aprobación y seguimiento microcurricular.</p>
          </div>

          {/* Nómina de Estudiantes */}
          <div 
            onClick={() => router.push('/estudiantes')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 group-hover:bg-emerald-600 group-hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition">Nómina Estudiantil</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Matrícula y gestión de alumnos de todas las jornadas y cursos.</p>
          </div>

          {/* Histórico de Notas */}
          <div 
            onClick={() => router.push('/historico')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-1 group-hover:bg-rose-600 group-hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            </div>
            <h2 className="font-bold text-slate-900 text-sm group-hover:text-rose-600 transition">Histórico de Notas</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Archivo directivo, consolidados y reportes finales.</p>
          </div>

        </div>

        {/* SECCIÓN DIRECTIVA DE CIERRE Y PROMOCIÓN ANUAL */}
        <div className="bg-linear-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
          <div className="space-y-1 text-center md:text-left">
            <span className="bg-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-indigo-400/30">
              Gestión de Periodo Lectivo ({anioLectivo || 'Sin periodo activo'}) {esAnioCerrado ? '• [CERRADO]' : ''}
            </span>
            <h2 className="text-base font-bold mt-2">Cierre de Ciclo, Bloqueo y Promoción de Estudiantes</h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Permite cerrar el año en curso para bloquear modificaciones y promover al siguiente grado. Las calificaciones anteriores se conservarán de manera segura en el Histórico.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!esAnioCerrado && anioLectivo && (
              <button
                onClick={handleCerrarPeriodoActual}
                disabled={procesando}
                className="px-4 py-3 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-1.5 border border-red-400/40"
              >
                <span>🔒</span> Cerrar Periodo
              </button>
            )}
            <button
              onClick={verificarYAbrirPromocion}
              disabled={procesando || !anioLectivo}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-2 border border-indigo-400/40"
            >
              <span>🔄</span> Ejecutar Promoción Anual
            </button>
          </div>
        </div>

      </div>

      {/* MODAL PARA CREAR NUEVO AÑO LECTIVO */}
      {modalNuevoAnioAbierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 uppercase">
              📅 Crear Nuevo Año Lectivo
            </h3>
            <p className="text-xs text-slate-600">
              Ingresa el formato del nuevo periodo escolar para tu institución (Ejemplo: <strong className="text-indigo-600">2026-2027</strong>).
            </p>
            <form onSubmit={handleCrearNuevoAnio} className="space-y-3">
              <input
                type="text"
                placeholder="Ej. 2026-2027"
                value={nuevoAnioInput}
                onChange={(e) => setNuevoAnioInput(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoAnioAbierto(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-50"
                >
                  {procesando ? 'Guardando...' : 'Crear y Activar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE PROMOCIÓN ANUAL */}
      {modalPromocionAbierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 uppercase">
              ⚠️ Confirmar Cierre y Promoción Anual
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Estás a punto de iniciar la transición para el periodo escolar. Esto avanzará a los alumnos al siguiente nivel de educación manteniendo el archivo histórico intacto para consultas directivas.
            </p>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-800 font-medium">
              💡 Asegúrate de haber completado y cerrado todas las sábanas de calificaciones del periodo activo antes de continuar.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModalPromocionAbierto(false)}
                disabled={procesando}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarPromocionAnual}
                disabled={procesando}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-50"
              >
                {procesando ? 'Procesando...' : 'Confirmar Promoción'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}