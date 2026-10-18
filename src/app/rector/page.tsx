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
  
  // Estados para la Gestión de Años Lectivos propios de la institución
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

  // Lógica segura para subir el logo a Supabase Storage
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

    if (!confirm(`⚠️ ¿Estás seguro de CERRAR Y BLOQUEAR el periodo ${anioLectivo}?\n\nAl cerrarlo, los docentes ya no podrán modificar calificaciones ni ver cargas activas de este periodo.`)) {
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

  const verificarYAbrirPromocion = () => {
    if (!anioLectivo) {
      alert('Debe crear y seleccionar un año lectivo activo primero.')
      return
    }

    const esCerrado = anosCerrados.includes(anioLectivo)

    if (!esCerrado) {
      alert(`⚠️ Advertencia de Seguridad:\n\nEl año lectivo vigente (${anioLectivo}) aún no se ha cerrado. Debe hacer clic en el botón "Cerrar Periodo" antes de poder ejecutar la promoción anual.`)
      return
    }

    if (periodosDisponibles.length <= 1) {
      alert(`⚠️ Advertencia de Seguridad:\n\nNo se ha creado un nuevo año lectivo. Debe hacer clic en "+ Nuevo" y crear el siguiente periodo escolar antes de continuar con la promoción.`)
      return
    }

    setModalPromocionAbierto(true)
  }

  // Ejecución de la Promoción con validación estricta de notas y supletorios
  const ejecutarPromocionAnual = async () => {
    try {
      setProcesando(true)

      const { data, error } = await supabase.rpc('promover_estudiantes_anual', {
        inst_id: autoridad.institucion_id
      })

      if (error) throw error

      if (data && data.success === false) {
        let detalleAlumnos = (data.bloqueantes || [])
          .map((b: any) => `• ${b.nombre} (${b.curso}): ${b.motivo}`)
          .join('\n')

        alert(`❌ No se puede ejecutar la promoción anual.\n\n${data.message}\n\nEstudiantes pendientes o con supletorios reprobados:\n${detalleAlumnos}`)
      } else {
        alert('✅ ¡Promoción de estudiantes realizada con éxito para el nuevo periodo!')
        setModalPromocionAbierto(false)
      }
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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 font-sans">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#f6c358] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Panel Rectoral...</p>
        </div>
      </div>
    )
  }

  const iniciales = `${autoridad?.nombres?.[0] || ''}${autoridad?.apellidos?.[0] || ''}`.toUpperCase()
  const esAnioCerrado = anioLectivo ? anosCerrados.includes(anioLectivo) : false

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 selection:bg-[#f6c358] selection:text-slate-900 font-sans space-y-6">

      {/* ENCABEZADO SUPERIOR CON ESTILO MINIMALISTA Y LOGO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          {institucionLogo ? (
            <img 
              src={institucionLogo} 
              alt="Logo Institución" 
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 object-contain cursor-pointer hover:opacity-80 transition rounded-2xl p-1 border border-slate-200 bg-slate-50" 
              title="Cambiar logo institucional"
            />
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-2xl bg-amber-50 text-[#4b4c99] font-black text-sm flex items-center justify-center border border-amber-200 cursor-pointer hover:opacity-80 transition shadow-2xs"
              title="Subir logo institucional"
            >
              {iniciales || 'DR'}
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleUploadLogo} className="hidden" accept="image/*" />
          <div>
            <span 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
              className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
            >
              Dirección Institucional
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Panel Rectoral / Dirección
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              {nombreInstitucion} • <strong className="text-slate-700">Bienvenido/a, {autoridad?.nombres} {autoridad?.apellidos}</strong>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="text-[10px] font-bold text-[#4b4c99] hover:underline ml-1 cursor-pointer"
              >
                (Cambiar Logo)
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* SELECTOR Y GESTOR UNIFICADO DE AÑOS LECTIVOS INSTITUCIONALES */}
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-2 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Periodo:</span>
            {periodosDisponibles.length === 0 ? (
              <span className="text-xs font-bold text-amber-700 italic">Sin años creados</span>
            ) : (
              <select
                value={anioLectivo}
                onChange={(e) => handleCambiarAnioActivo(e.target.value)}
                style={{ color: '#4b4c99' }}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer"
              >
                {periodosDisponibles.map((p) => (
                  <option key={p} value={p} className="text-slate-900 font-bold bg-white">{p} {anosCerrados.includes(p) ? '🔒 (Cerrado)' : ''}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setModalNuevoAnioAbierto(true)}
              style={{ backgroundColor: '#f6c358' }}
              className="text-[10px] text-slate-900 font-bold px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer shadow-2xs hover:opacity-90"
              title="Crear nuevo año lectivo"
            >
              + Nuevo
            </button>
          </div>

          <div 
            style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-2xs"
          >
            <span>Licencia:</span> <strong className="font-bold">{licenciaVence}</strong>
          </div>

          <button
            onClick={handleSignOut}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* AVISO SI EL PERIODO ACTUAL ESTÁ CERRADO */}
      {esAnioCerrado && (
        <div 
          style={{ backgroundColor: 'rgba(222, 88, 96, 0.08)', borderColor: 'rgba(222, 88, 96, 0.3)', color: '#9b2c2c' }}
          className="border p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs"
        >
          <span>Este periodo lectivo ({anioLectivo}) se encuentra cerrado y bloqueado. Las calificaciones y asignaciones de este año son de solo lectura.</span>
          <span className="bg-rose-200/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-900">Modo Archivo</span>
        </div>
      )}

      {/* ACCESOS DIRECTOS DEL RECTOR CON ICONOS VECTORIALES (SVG) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* Registro de Usuarios */}
        <div 
          onClick={() => router.push('/rector/dashboard')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#f6c358] transition cursor-pointer space-y-2 group"
        >
          <div 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)' }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2 group-hover:bg-[#4b4c99] group-hover:text-white transition shadow-2xs"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide group-hover:text-[#4b4c99] transition">Registro de Usuarios</h2>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Alta y gestión de docentes y personal institucional.</p>
        </div>

        {/* Carga Horaria */}
        <div 
          onClick={() => router.push('/rector/asignaciones-docentes')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#f6c358] transition cursor-pointer space-y-2 group"
        >
          <div 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)' }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2 group-hover:bg-[#4b4c99] group-hover:text-white transition shadow-2xs"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4"></path></svg>
          </div>
          <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide group-hover:text-[#4b4c99] transition">Carga Horaria</h2>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Distributivo y asignación de materias por docente.</p>
        </div>

        {/* Asignaturas */}
        <div 
          onClick={() => router.push('/rector/asignaturas')} 
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#f6c358] transition cursor-pointer space-y-2 group"
        >
          <div 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)' }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2 group-hover:bg-[#4b4c99] group-hover:text-white transition shadow-2xs"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
          </div>
          <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide group-hover:text-[#4b4c99] transition">Asignaturas</h2>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Configuración de mallas y cátedras oficiales.</p>
        </div>

        {/* Revisión de Planificaciones */}
        <div 
          onClick={() => router.push('/rector/dashboard/revision')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#f6c358] transition cursor-pointer space-y-2 group"
        >
          <div 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)' }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2 group-hover:bg-[#4b4c99] group-hover:text-white transition shadow-2xs"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
          </div>
          <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide group-hover:text-[#4b4c99] transition">Planificaciones</h2>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Aprobación y seguimiento microcurricular.</p>
        </div>

        {/* Nómina de Estudiantes */}
        <div 
          onClick={() => router.push('/estudiantes')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#f6c358] transition cursor-pointer space-y-2 group"
        >
          <div 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)' }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2 group-hover:bg-[#4b4c99] group-hover:text-white transition shadow-2xs"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide group-hover:text-[#4b4c99] transition">Nómina Estudiantil</h2>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Matrícula y gestión de alumnos de todas las jornadas y cursos.</p>
        </div>

        {/* Histórico de Notas */}
        <div 
          onClick={() => router.push('/historico')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#f6c358] transition cursor-pointer space-y-2 group"
        >
          <div 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)' }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2 group-hover:bg-[#4b4c99] group-hover:text-white transition shadow-2xs"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide group-hover:text-[#4b4c99] transition">Histórico de Notas</h2>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Archivo directivo, consolidados y reportes finales.</p>
        </div>

      </div>

      {/* SECCIÓN DIRECTIVA DE CIERRE Y PROMOCIÓN ANUAL */}
      <div 
        style={{ backgroundColor: '#4b4c99' }}
        className="p-6 md:p-8 rounded-3xl text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-md border border-indigo-900/30"
      >
        <div className="space-y-1.5 text-center md:text-left">
          <span 
            style={{ backgroundColor: '#f6c358', color: '#1e293b' }}
            className="text-[10px] font-bold uppercase px-3 py-1 rounded-xl inline-block shadow-2xs"
          >
            Gestión de Periodo Lectivo ({anioLectivo || 'Sin periodo activo'}) {esAnioCerrado ? '• [CERRADO]' : ''}
          </span>
          <h2 className="text-lg font-bold mt-2 tracking-tight">Cierre de Ciclo, Bloqueo y Promoción de Estudiantes</h2>
          <p className="text-xs text-indigo-100 font-medium max-w-2xl leading-relaxed">
            Permite cerrar el año en curso para bloquear modificaciones y promover al siguiente grado. Las calificaciones anteriores se conservarán de manera segura en el Histórico.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-center">
          {!esAnioCerrado && anioLectivo && (
            <button
              onClick={handleCerrarPeriodoActual}
              disabled={procesando}
              style={{ backgroundColor: '#de5860' }}
              className="px-4 py-3 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5 border border-rose-500/40 cursor-pointer hover:opacity-90"
            >
              <span></span> Cerrar Periodo
            </button>
          )}
          <button
            onClick={verificarYAbrirPromocion}
            disabled={procesando || !anioLectivo}
            style={{ backgroundColor: '#f6c358', color: '#1e293b' }}
            className="px-5 py-3 font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-2 border border-amber-400/40 cursor-pointer hover:opacity-90"
          >
            <span></span> Ejecutar Promoción Anual
          </button>
        </div>
      </div>

      {/* MODAL PARA CREAR NUEVO AÑO LECTIVO */}
      {modalNuevoAnioAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200 font-sans">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Crear Nuevo Año Lectivo
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Ingresa el formato del nuevo periodo escolar para tu institución (Ejemplo: <strong className="text-[#4b4c99]">2026-2027</strong>).
            </p>
            <form onSubmit={handleCrearNuevoAnio} className="space-y-3.5 text-xs">
              <input
                type="text"
                placeholder="Ej. 2026-2027"
                value={nuevoAnioInput}
                onChange={(e) => setNuevoAnioInput(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevoAnioAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 font-sans">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Confirmar Cierre y Promoción Anual
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Estás a punto de iniciar la transición para el periodo escolar. El sistema evaluará automáticamente las notas finales y los supletorios de los alumnos de 8vo en adelante para validar su promoción.
            </p>
            <div 
              style={{ backgroundColor: 'rgba(246, 195, 88, 0.1)', borderColor: 'rgba(246, 195, 88, 0.4)', color: '#855d11' }}
              className="border p-3.5 rounded-2xl text-xs font-bold shadow-2xs"
            >
              Si existen estudiantes con promedios menores a 7.00 que no han aprobado el examen supletorio, el sistema detendrá el proceso e indicará quiénes son.
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setModalPromocionAbierto(false)}
                disabled={procesando}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarPromocionAnual}
                disabled={procesando}
                style={{ backgroundColor: '#4b4c99' }}
                className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {procesando ? 'Evaluando notas y promoviendo...' : 'Confirmar Promoción'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}