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
      setMensaje({ tipo: 'exito', texto: '¡Logo institucional actualizado con éxito!' })
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
        texto: `🚫 Has alcanzado el límite máximo de ${limiteDocentes} docentes activos contratados para tu institución. Si requieres registrar más usuarios, contacta con Soporte para ampliar tu plan.`
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
          texto: `¡Cuenta docente creada con éxito! Contraseña temporal: 123456 (Se le exigirá actualizarla al iniciar sesión).`
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
        texto: `✅ Contraseña restablecida con éxito a "123456". El docente ${emailDocente} deberá cambiarla obligatoriamente al reingresar.`
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-semibold text-slate-600">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p>Cargando Panel Rectoral...</p>
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
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-md p-6">
        
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-6 gap-4">
          <div className="flex items-center gap-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer group flex items-center justify-center"
              title="Hacer clic para cambiar logo institucional"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo Institución" className="w-12 h-12 object-contain group-hover:opacity-80 transition" />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-purple-100 text-purple-900 font-black text-sm rounded-full group-hover:opacity-80 transition">
                  {iniciales || 'DR'}
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleUploadLogo} className="hidden" accept="image/png, image/jpeg, image/jpg" disabled={subiendoLogo} />

            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-wide uppercase">
                Panel Rectoral / Dirección
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                {autoridad?.instituciones?.nombre_institucion || 'Unidad Educativa'} • <strong className="text-slate-700">Bienvenido/a, {autoridad?.nombres} {autoridad?.apellidos}</strong>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="text-[10px] text-indigo-600 font-bold hover:underline ml-1 cursor-pointer"
                >
                  {subiendoLogo ? '(Subiendo...)' : '(Cambiar Logo)'}
                </button>
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} 
              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-3 rounded-lg transition cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* TARJETAS INFORMATIVAS DE LICENCIA Y CUPOS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          
          {/* Vencimiento de Licencia */}
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl text-center">
            <span className="text-xs text-purple-700 font-bold uppercase">Vencimiento de Licencia</span>
            <p className="text-base font-bold text-purple-900 mt-1 capitalize">{fechaVencimientoFormatted}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-200 text-purple-800 text-[10px] font-bold rounded-full capitalize">
              Plan {licenciaInfo?.tipo_licencia || 'Estándar'}
            </span>
          </div>

          {/* Límite Contratado */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
            <span className="text-xs text-blue-600 font-bold uppercase">Límite Contratado</span>
            <p className="text-2xl font-black text-blue-900">{limiteDocentes} Usuarios</p>
          </div>

          {/* Docentes Registrados */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
            <span className="text-xs text-emerald-600 font-bold uppercase">Docentes Activos</span>
            <p className="text-2xl font-black text-emerald-900">{docentesActivosCount} Usuarios</p>
          </div>

          {/* Cupos Disponibles */}
          <div className={`border p-4 rounded-xl text-center ${
            licenciasDisponibles > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <span className="text-xs font-bold uppercase">Cupos Disponibles</span>
            <p className="text-2xl font-black">{licenciasDisponibles} Cupos</p>
          </div>

        </div>

        {mensaje && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-medium border shadow-sm ${
            mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
            mensaje.tipo === 'advertencia' ? 'bg-amber-50 text-amber-900 border-amber-300' :
            'bg-red-50 text-red-900 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA 1: CREAR DOCENTE */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>👤</span> Registrar Nuevo Docente
            </h2>
            
            <form onSubmit={handleCrearDocente} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nombres</label>
                <input 
                  type="text" 
                  required 
                  value={nombres} 
                  onChange={(e) => setNombres(e.target.value)}
                  placeholder="Ej: María Elena"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Apellidos</label>
                <input 
                  type="text" 
                  required 
                  value={apellidos} 
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="Ej: Andrade Vaca"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="docente@escuela.edu.ec"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600 text-sm bg-white"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg space-y-1">
                <p className="text-[11px] font-bold text-blue-900">🔒 Requisitos de Seguridad Obligatorios:</p>
                <ul className="text-[10px] text-blue-800 list-disc list-inside space-y-0.5">
                  <li>Contraseña inicial por defecto: <strong className="font-mono">123456</strong></li>
                  <li>Se le exigirá actualizarla obligatoriamente a una clave segura (8+ caracteres, mayúscula, número y carácter especial) en su primer inicio de sesión.</li>
                </ul>
              </div>

              <button 
                type="submit" 
                disabled={guardando || docentesActivosCount >= limiteDocentes}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
              >
                {guardando ? 'Creando...' : docentesActivosCount >= limiteDocentes ? 'Límite de Cupos Alcanzado' : 'Crear Cuenta Docente'}
              </button>
            </form>
          </div>

          {/* COLUMNA 2 Y 3: LISTA DE DOCENTES */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">📋 Nómina de Docentes de la Institución</span>
              <span className="text-xs font-normal text-slate-500">Los inactivos conservan su historial académico</span>
            </h2>

            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase text-xs border-b">
                  <tr>
                    <th className="p-3">Docente</th>
                    <th className="p-3">Correo</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {docentes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 text-xs">
                        No hay docentes registrados aún. Puedes agregar hasta {limiteDocentes} profesores.
                      </td>
                    </tr>
                  ) : (
                    docentes.map((doc) => {
                      const estaActivo = doc.activo !== false

                      return (
                        <tr key={doc.id} className={`hover:bg-slate-50 ${!estaActivo ? 'bg-slate-100/60 opacity-75' : ''}`}>
                          <td className="p-3 font-semibold text-slate-800">
                            {doc.nombres} {doc.apellidos}
                            {!estaActivo && <span className="ml-2 text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">Inactivo</span>}
                          </td>
                          <td className="p-3 text-slate-600 text-xs">{doc.email}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleToggleActivoDocente(doc.id, estaActivo, `${doc.nombres} ${doc.apellidos}`)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                                estaActivo ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                              title="Hacer clic para cambiar estado operativo"
                            >
                              {estaActivo ? '🟢 Activo' : '🔴 Inactivo'}
                            </button>
                          </td>
                          <td className="p-3 text-center flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => handleResetearPassword(doc.email, doc.nombres, doc.id)}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-xs font-semibold transition cursor-pointer"
                              title="Restablecer contraseña a 123456 y exigir cambio obligatorio"
                            >
                              🔑 Resetear
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

      </div>
    </div>
  )
}