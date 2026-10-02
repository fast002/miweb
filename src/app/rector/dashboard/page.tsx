'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AutoridadPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [autoridad, setAutoridad] = useState<any>(null)
  const [docentes, setDocentes] = useState<any[]>([])
  const [limiteDocentes, setLimiteDocentes] = useState<number>(0)
  const [licenciaInfo, setLicenciaInfo] = useState<any>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Formulario de creación de docente
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'advertencia'; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Modal y Estados de Edición de Docente
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false)
  const [docenteEditandoId, setDocenteEditandoId] = useState<string | null>(null)
  const [editNombres, setEditNombres] = useState('')
  const [editApellidos, setEditApellidos] = useState('')
  const [editEmail, setEditEmail] = useState('')

  useEffect(() => {
    cargarDatosAutoridad()
  }, [])

  const cargarDatosAutoridad = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/')
        return
      }

      // 1. Cargar perfil de la autoridad y datos de su licencia
      const { data: aut, error: autError } = await supabase
        .from('docentes')
        .select('*, instituciones(*, licencias(*))')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (autError || !aut) {
        router.push('/')
        return
      }

      setAutoridad(aut)
      setLogoUrl(aut.instituciones?.logo_url || '')

      // Obtener datos de la licencia de la institución
      const lic = aut.instituciones?.licencias?.[0] || null
      setLicenciaInfo(lic)
      setLimiteDocentes(lic?.limite_docentes || 0)

      // 2. Cargar todos los docentes pertenecientes a la MISMA institución
      const { data: docData } = await supabase
        .from('docentes')
        .select('*')
        .eq('institucion_id', aut.institucion_id)
        .eq('rol', 'docente')
        .order('created_at', { ascending: false })

      if (docData) {
        setDocentes(docData)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  // Cargar / Actualizar Logo Institucional
  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !autoridad?.institucion_id) return

    try {
      setSubiendoLogo(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `logo_${autoridad.institucion_id}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('instituciones').upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('instituciones').getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('instituciones')
        .update({ logo_url: publicUrl })
        .eq('id', autoridad.institucion_id)

      if (updateError) throw updateError

      setLogoUrl(publicUrl)
      setMensaje({ tipo: 'exito', texto: 'Logo institucional actualizado con éxito.' })
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al subir el logo: ' + err.message })
    } finally {
      setSubiendoLogo(false)
    }
  }

  // Crear Docente con Validación de Límite
  const handleCrearDocente = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje(null)

    const activosCount = docentes.filter(d => d.activo !== false).length

    if (activosCount >= limiteDocentes) {
      setMensaje({
        tipo: 'advertencia',
        texto: `Has alcanzado el límite máximo de ${limiteDocentes} docentes activos contratados para tu institución. Si requieres registrar más usuarios, contacta con Soporte para ampliar tu plan.`
      })
      return
    }

    setGuardando(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: '123456',
        options: {
          data: {
            nombres: nombres.trim(),
            apellidos: apellidos.trim(),
            requiere_cambio_password: true
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: docError } = await supabase
          .from('docentes')
          .upsert([{
            id: authData.user.id,
            institucion_id: autoridad.institucion_id,
            email: email.trim().toLowerCase(),
            nombres: nombres.trim(),
            apellidos: apellidos.trim(),
            rol: 'docente',
            es_superadmin: false,
            activo: true,
            requiere_cambio_password: true,
            requiere_cambio_clave: true
          }])

        if (docError) throw docError

        if (sessionData?.session) {
          await supabase.auth.setSession(sessionData.session)
        }

        setMensaje({
          tipo: 'exito',
          texto: `Cuenta docente creada con éxito. Contraseña temporal: 123456 (Se le exigirá actualizarla al iniciar sesión).`
        })
        setNombres('')
        setApellidos('')
        setEmail('')
        cargarDatosAutoridad()
      }
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al crear docente: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  // Abrir modal de edición con datos precargados
  const abrirModalEditar = (doc: any) => {
    setDocenteEditandoId(doc.id)
    setEditNombres(doc.nombres || '')
    setEditApellidos(doc.apellidos || '')
    setEditEmail(doc.email || '')
    setMostrarModalEditar(true)
  }

  // Guardar Cambios de Edición de Docente
  const handleGuardarEdicionDocente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docenteEditandoId) return

    setGuardando(true)
    setMensaje(null)

    try {
      const { error } = await supabase
        .from('docentes')
        .update({
          nombres: editNombres.trim(),
          apellidos: editApellidos.trim(),
          email: editEmail.trim().toLowerCase()
        })
        .eq('id', docenteEditandoId)

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: 'Datos del docente actualizados correctamente.' })
      setMostrarModalEditar(false)
      setDocenteEditandoId(null)
      cargarDatosAutoridad()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar docente: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  // Restablecer contraseña conectándose directamente a la API de administración
  const handleResetearPassword = async (emailDocente: string, nombresDocente: string, docenteId: string) => {
    if (!confirm(`¿Deseas restablecer la contraseña de ${nombresDocente} a la clave temporal "123456" y exigir cambio obligatorio?`)) {
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: docenteId,
          targetEmail: emailDocente,
          requesterUserId: user?.id
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al restablecer contraseña')

      setMensaje({
        tipo: 'exito',
        texto: `Contraseña restablecida con éxito a "123456". El docente ${emailDocente} deberá cambiarla obligatoriamente al reingresar.`
      })
      cargarDatosAutoridad()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar credencial: ' + err.message })
    }
  }

  // Inactivar / Activar Docente
  const handleToggleActivoDocente = async (docenteId: string, estadoActual: boolean, nombreDocente: string) => {
    const nuevoEstado = !estadoActual
    const accionTexto = nuevoEstado ? 'activar' : 'inactivar'

    if (!confirm(`¿Estás seguro de ${accionTexto} al docente ${nombreDocente}? ${!nuevoEstado ? 'El docente no podrá iniciar sesión, pero conservarás intacto su registro histórico de notas y planificaciones.' : ''}`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('docentes')
        .update({ activo: nuevoEstado })
        .eq('id', docenteId)

      if (error) throw error

      setMensaje({
        tipo: 'exito',
        texto: `Docente ${nuevoEstado ? 'activado' : 'inactivado'} correctamente. Sus registros académicos previos se mantienen intactos.`
      })
      cargarDatosAutoridad()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: 'Error al cambiar estado: ' + err.message })
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#f6c358] selection:text-slate-900">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando Panel Rectoral...</p>
        </div>
      </div>
    )
  }

  const docentesActivosCount = docentes.filter(d => d.activo !== false).length
  const licenciasDisponibles = limiteDocentes - docentesActivosCount

  const fechaVencimientoFormatted = licenciaInfo?.fecha_vencimiento 
    ? new Date(licenciaInfo.fecha_vencimiento).toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'No registrada'

  const iniciales = `${autoridad?.nombres?.[0] || ''}${autoridad?.apellidos?.[0] || ''}`.toUpperCase()

  return (
    <div className="space-y-6 pb-12 selection:bg-[#f6c358] selection:text-slate-900 font-sans">
      
      {/* ENCABEZADO INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer group flex items-center justify-center"
            title="Hacer clic para cambiar logo institucional"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo Institución" className="w-14 h-14 object-contain group-hover:opacity-80 transition rounded-2xl p-1 border border-slate-200 bg-slate-50" />
            ) : (
              <div className="w-14 h-14 flex items-center justify-center bg-amber-50 text-[#4b4c99] font-black text-sm rounded-2xl group-hover:opacity-80 transition border border-amber-200 shadow-2xs">
                {iniciales || 'DR'}
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleUploadLogo} className="hidden" accept="image/png, image/jpeg, image/jpg" disabled={subiendoLogo} />

          <div>
            <span 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
              className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
            >
              Control de Personal Docente
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Registro y Gestión de Usuarios
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              {autoridad?.instituciones?.nombre_institucion || 'Unidad Educativa'} • <strong className="text-slate-700">Bienvenido/a, {autoridad?.nombres} {autoridad?.apellidos}</strong>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="text-[10px] font-bold text-[#4b4c99] hover:underline ml-1 cursor-pointer"
              >
                {subiendoLogo ? '(Subiendo...)' : '(Cambiar Logo)'}
              </button>
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} 
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Cerrar Sesión</span> 🚪
          </button>
        </div>
      </div>

      {/* TARJETAS INFORMATIVAS DE LICENCIA Y CUPOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Vencimiento de Licencia */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vencimiento de Licencia</span>
          <p className="text-xs font-bold text-slate-900 capitalize">{fechaVencimientoFormatted}</p>
          <div>
            <span 
              style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
              className="inline-block mt-1 px-2.5 py-0.5 text-[10px] font-bold rounded-lg border shadow-2xs uppercase"
            >
              Plan {licenciaInfo?.tipo_licencia || 'Estándar'}
            </span>
          </div>
        </div>

        {/* Límite Contratado */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Límite Contratado</span>
          <p className="text-xl font-bold text-slate-900">{limiteDocentes} Usuarios</p>
        </div>

        {/* Docentes Registrados */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Docentes Activos</span>
          <p className="text-xl font-bold text-emerald-700">{docentesActivosCount} Usuarios</p>
        </div>

        {/* Cupos Disponibles */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cupos Disponibles</span>
          <p className={`text-xl font-bold ${licenciasDisponibles > 0 ? 'text-[#4b4c99]' : 'text-[#de5860]'}`}>
            {licenciasDisponibles} Cupos
          </p>
        </div>

      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs ${
          mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
          mensaje.tipo === 'advertencia' ? 'bg-amber-50 text-amber-900 border-amber-300' :
          'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA 1: CREAR DOCENTE */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 h-fit">
          <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
            👤 Registrar Nuevo Docente
          </h2>
          
          <form onSubmit={handleCrearDocente} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombres</label>
              <input 
                type="text" 
                required 
                value={nombres} 
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Ej: María Elena"
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Apellidos</label>
              <input 
                type="text" 
                required 
                value={apellidos} 
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Ej: Andrade Vaca"
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Correo Electrónico</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="docente@escuela.edu.ec"
                className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
              />
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200/80 p-3 rounded-xl space-y-1">
              <p className="text-[11px] font-bold text-indigo-900">🔒 Requisitos de Seguridad:</p>
              <ul className="text-[10px] text-indigo-800/90 list-disc list-inside space-y-0.5 font-medium">
                <li>Contraseña inicial por defecto: <strong className="font-mono">123456</strong></li>
                <li>Se le exigirá actualizarla obligatoriamente en su primer inicio de sesión.</li>
              </ul>
            </div>

            <button 
              type="submit" 
              disabled={guardando || docentesActivosCount >= limiteDocentes}
              style={{ backgroundColor: '#4b4c99' }}
              className="w-full py-3 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 mt-2"
            >
              {guardando ? 'Creando...' : docentesActivosCount >= limiteDocentes ? 'Límite de Cupos Alcanzado' : '+ Crear Cuenta Docente'}
            </button>
          </form>
        </div>

        {/* COLUMNA 2 Y 3: LISTA DE DOCENTES */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex justify-between items-center">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              📋 Nómina de Docentes ({docentes.length})
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              Los inactivos conservan su historial académico
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">Docente</th>
                  <th className="p-3">Correo</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {docentes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-500 font-medium">
                      No hay docentes registrados aún. Puedes agregar hasta {limiteDocentes} profesores.
                    </td>
                  </tr>
                ) : (
                  docentes.map((doc) => {
                    const estaActivo = doc.activo !== false

                    return (
                      <tr key={doc.id} className={`hover:bg-slate-50/80 transition-colors ${!estaActivo ? 'bg-slate-50/60 opacity-75' : ''}`}>
                        <td className="p-3 font-bold text-slate-800">
                          {doc.nombres} {doc.apellidos}
                          {!estaActivo && <span className="ml-2 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase bg-rose-100 text-rose-800">Inactivo</span>}
                        </td>
                        <td className="p-3 text-slate-600 font-mono">{doc.email}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleActivoDocente(doc.id, estaActivo, `${doc.nombres} ${doc.apellidos}`)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase transition cursor-pointer shadow-2xs ${
                              estaActivo ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                            title="Hacer clic para cambiar estado operativo"
                          >
                            {estaActivo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                          <button 
                            onClick={() => abrirModalEditar(doc)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[10px] transition cursor-pointer shadow-2xs"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleResetearPassword(doc.email, doc.nombres, doc.id)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-[10px] transition cursor-pointer shadow-2xs"
                            title="Restablecer contraseña a 123456 y exigir cambio obligatorio"
                          >
                            Resetear Clave
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* MODAL DE EDICIÓN DE DOCENTE */}
      {mostrarModalEditar && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">✏️ Editar Datos del Docente</h2>
              <button onClick={() => setMostrarModalEditar(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleGuardarEdicionDocente} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombres</label>
                <input
                  type="text"
                  required
                  value={editNombres}
                  onChange={(e) => setEditNombres(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Apellidos</label>
                <input
                  type="text"
                  required
                  value={editApellidos}
                  onChange={(e) => setEditApellidos(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setMostrarModalEditar(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}