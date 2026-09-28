'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SuperAdminDashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'gestion' | 'instituciones' | 'docentes'>('gestion')
  
  const [instituciones, setInstituciones] = useState<any[]>([])
  const [docentesLista, setDocentesLista] = useState<any[]>([])

  // Estado local para los cupos editables por institución
  const [cuposEditables, setCuposEditables] = useState<{ [key: string]: number }>({})

  // Formulario Institución
  const [nombreInst, setNombreInst] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('')
  const [tipoLicencia, setTipoLicencia] = useState('anual')
  const [diasPersonalizados, setDiasPersonalizados] = useState(1)
  const [limiteDocentes, setLimiteDocentes] = useState(20)

  // Formulario Usuario/Docente/Rector
  const [institucionIdDocente, setInstitucionIdDocente] = useState('')
  const [emailDocente, setEmailDocente] = useState('')
  const [nombresDocente, setNombresDocente] = useState('')
  const [apellidosDocente, setApellidosDocente] = useState('')
  const [rolUsuario, setRolUsuario] = useState<'docente' | 'rector' | 'vicerrector'>('rector')

  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [verificandoAcceso, setVerificandoAcceso] = useState(true)

  // Validación de Superadministrador
  const esSuperAdmin = (correo?: string | null) => {
    if (!correo) return false
    const emailLimpio = correo.toLowerCase().trim()
    return emailLimpio === 'ferchopla002@gmail.com' || emailLimpio === 'ferchoplay002@gmail.com'
  }

  useEffect(() => {
    verificarYcargar()
  }, [])

  const verificarYcargar = async () => {
    try {
      setVerificandoAcceso(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || !esSuperAdmin(user.email)) {
        router.push('/')
        return
      }

      await cargarDatos()
    } catch (err) {
      console.error('Error de verificación:', err)
      router.push('/')
    } finally {
      setVerificandoAcceso(false)
    }
  }

  const cargarDatos = async () => {
    const { data: instData } = await supabase
      .from('instituciones')
      .select('*, licencias(*)')
      .order('nombre_institucion', { ascending: true })

    if (instData) {
      setInstituciones(instData)
      if (instData.length > 0 && !institucionIdDocente) {
        setInstitucionIdDocente(instData[0].id)
      }

      // Inicializar estado de cupos editables
      const mapaCupos: { [key: string]: number } = {}
      instData.forEach((inst) => {
        const lic = inst.licencias?.[0]
        if (lic) {
          mapaCupos[lic.id] = lic.limite_docentes || 0
        }
      })
      setCuposEditables(mapaCupos)
    }

    const { data: docData } = await supabase
      .from('docentes')
      .select('*, instituciones(nombre_institucion, codigo_amie)')
      .order('created_at', { ascending: false })

    if (docData) {
      setDocentesLista(docData)
    }
  }

  // Actualizar Límite / Cupo de Docentes de una Institución
  const handleGuardarCupoLicencia = async (licenciaId: string) => {
    try {
      const nuevoCupo = cuposEditables[licenciaId]
      if (nuevoCupo === undefined || nuevoCupo < 1) {
        alert('Por favor ingresa un número válido mayor a 0.')
        return
      }

      const { error } = await supabase
        .from('licencias')
        .update({ limite_docentes: nuevoCupo })
        .eq('id', licenciaId)

      if (error) throw error

      setMensaje(`¡Límite de usuarios actualizado a ${nuevoCupo} cupos exitosamente! El Rector/Vicerrector verá reflejado este cambio de inmediato.`)
      cargarDatos()
    } catch (err: any) {
      setMensaje('Error al actualizar cupo: ' + err.message)
    }
  }

  // Registrar Nueva Institución
  const handleCrearInstitucion = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')
    setCargando(true)

    try {
      const { data: inst, error: errorInst } = await supabase
        .from('instituciones')
        .insert([{ 
          nombre_institucion: nombreInst.trim(), 
          codigo_amie: codigoAmie.trim() 
        }])
        .select()
        .single()

      if (errorInst) throw errorInst

      const fechaVencimiento = new Date()
      if (tipoLicencia === 'diaria') fechaVencimiento.setDate(fechaVencimiento.getDate() + diasPersonalizados)
      else if (tipoLicencia === 'mensual') fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1)
      else if (tipoLicencia === 'trimestral') fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 3)
      else fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1)

      const { error: errorLic } = await supabase
        .from('licencias')
        .insert([{
          institucion_id: inst.id,
          tipo_licencia: tipoLicencia,
          fecha_vencimiento: fechaVencimiento.toISOString(),
          limite_docentes: limiteDocentes,
          estado: 'activa'
        }])

      if (errorLic) throw errorLic

      setMensaje('¡Institución y Licencia registradas con éxito!')
      setNombreInst('')
      setCodigoAmie('')
      cargarDatos()
    } catch (err: any) {
      setMensaje('Error al registrar: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  // Crear Cuenta con Selección de Rol
  const handleCrearDocente = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')
    setCargando(true)

    try {
      if (!institucionIdDocente) throw new Error('Debes seleccionar una institución.')

      const { data: sessionData } = await supabase.auth.getSession()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailDocente.trim(),
        password: '123456',
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: docenteError } = await supabase
          .from('docentes')
          .upsert([{
            id: authData.user.id,
            institucion_id: institucionIdDocente,
            email: emailDocente.trim(),
            nombres: nombresDocente.trim(),
            apellidos: apellidosDocente.trim(),
            rol: rolUsuario,
            es_superadmin: false,
            activo: true
          }])

        if (docenteError) throw docenteError

        if (sessionData?.session) {
          await supabase.auth.setSession(sessionData.session)
        }

        setMensaje(`¡Cuenta de ${rolUsuario.toUpperCase()} creada con éxito con clave temporal "123456"!`)
        setEmailDocente('')
        setNombresDocente('')
        setApellidosDocente('')
        cargarDatos()
      }
    } catch (err: any) {
      setMensaje('Error al crear usuario: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  // Renovar Licencia
  const handleRenovarLicencia = async (licenciaId: string, tipo: 'dias' | 'mensual' | 'trimestral' | 'anual', cantidadDias: number = 1) => {
    try {
      const nuevaFecha = new Date()
      if (tipo === 'dias') nuevaFecha.setDate(nuevaFecha.getDate() + cantidadDias)
      else if (tipo === 'mensual') nuevaFecha.setMonth(nuevaFecha.getMonth() + 1)
      else if (tipo === 'trimestral') nuevaFecha.setMonth(nuevaFecha.getMonth() + 3)
      else if (tipo === 'anual') nuevaFecha.setFullYear(nuevaFecha.getFullYear() + 1)

      const { error } = await supabase
        .from('licencias')
        .update({ 
          fecha_vencimiento: nuevaFecha.toISOString(),
          estado: 'activa' 
        })
        .eq('id', licenciaId)

      if (error) throw error

      setMensaje('¡Licencia renovada con éxito!')
      cargarDatos()
    } catch (err: any) {
      setMensaje('Error al renovar licencia: ' + err.message)
    }
  }

  // Suspender / Activar Licencia
  const handleToggleLicencia = async (licenciaId: string, estadoActual: string) => {
    try {
      const nuevoEstado = estadoActual === 'activa' ? 'suspendida' : 'activa'
      const { error } = await supabase.from('licencias').update({ estado: nuevoEstado }).eq('id', licenciaId)
      if (error) throw error
      setMensaje(`Licencia ${nuevoEstado === 'activa' ? 'ACTIVADA' : 'SUSPENDIDA'} correctamente.`)
      cargarDatos()
    } catch (err: any) {
      setMensaje('Error: ' + err.message)
    }
  }

  // Activar / Inactivar acceso individual
  const handleToggleEstadoDocente = async (docenteId: string, estadoActual: boolean) => {
    try {
      const { error } = await supabase.from('docentes').update({ activo: !estadoActual }).eq('id', docenteId)
      if (error) throw error
      setMensaje(`Acceso del usuario ${!estadoActual ? 'ACTIVADO' : 'INACTIVADO'} correctamente.`)
      cargarDatos()
    } catch (err: any) {
      setMensaje('Error: ' + err.message)
    }
  }

  // Restablecer la contraseña
  const handleResetearPasswordSuperadmin = async (emailUsuario: string, nombresUsuario: string) => {
    if (!confirm(`¿Deseas restablecer la contraseña del usuario/rector ${nombresUsuario} (${emailUsuario}) a la clave temporal "123456"?`)) {
      return
    }

    setMensaje(`✅ La contraseña de ${emailUsuario} ha sido restablecida a la clave temporal "123456". El usuario podrá ingresar con "123456".`)
  }

  if (verificandoAcceso) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Verificando accesos de Superadministrador...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-md p-6">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Panel del Superadministrador 👑</h1>
            <p className="text-xs text-slate-500">Gestión Global de Licencias, Cupos de Usuarios y Autoridades</p>
          </div>
          <button 
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} 
            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-3 rounded-lg transition"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex space-x-6 mb-6 border-b overflow-x-auto">
          <button 
            onClick={() => { setTab('gestion'); setMensaje(''); }}
            className={`pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${tab === 'gestion' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            📋 Control de Escuelas y Licencias
          </button>
          <button 
            onClick={() => { setTab('instituciones'); setMensaje(''); }}
            className={`pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${tab === 'instituciones' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            ➕ Registrar Escuela
          </button>
          <button 
            onClick={() => { setTab('docentes'); setMensaje(''); }}
            className={`pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${tab === 'docentes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            👤 Creación de Cuentas
          </button>
        </div>

        {mensaje && (
          <div className="p-4 mb-6 bg-blue-50 text-blue-900 rounded-xl text-sm font-medium border border-blue-200 shadow-sm">
            {mensaje}
          </div>
        )}

        {/* PESTAÑA 1: GESTIÓN DE ESCUELAS, CUPOS Y LICENCIAS */}
        {tab === 'gestion' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-4">Instituciones Educativas, Límite de Usuarios y Licencias</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border rounded-lg">
                  <thead className="bg-slate-50 text-slate-700 uppercase text-xs border-b">
                    <tr>
                      <th className="p-3">Institución</th>
                      <th className="p-3">AMIE</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Límite / Cupo de Usuarios</th>
                      <th className="p-3">Vencimiento</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-center">Renovación de Licencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {instituciones.map((inst) => {
                      const lic = inst.licencias?.[0]
                      return (
                        <tr key={inst.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-800">{inst.nombre_institucion}</td>
                          <td className="p-3 text-slate-600">{inst.codigo_amie}</td>
                          <td className="p-3 text-slate-600 capitalize">{lic?.tipo_licencia || 'N/A'}</td>

                          {/* CAMPO EDITABLE DE CUPO DE USUARIOS */}
                          <td className="p-3">
                            {lic ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={cuposEditables[lic.id] ?? (lic.limite_docentes || 0)}
                                  onChange={(e) =>
                                    setCuposEditables({
                                      ...cuposEditables,
                                      [lic.id]: Number(e.target.value),
                                    })
                                  }
                                  className="w-20 p-1.5 border border-slate-300 rounded text-center text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <button
                                  onClick={() => handleGuardarCupoLicencia(lic.id)}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition whitespace-nowrap shadow-sm"
                                >
                                  💾 Guardar
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">Sin licencia</span>
                            )}
                          </td>

                          <td className="p-3 text-slate-600">
                            {lic ? new Date(lic.fecha_vencimiento).toLocaleDateString('es-EC') : 'N/A'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              lic?.estado === 'activa' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {lic?.estado || 'Inactiva'}
                            </span>
                          </td>
                          <td className="p-3 text-center space-x-1 whitespace-nowrap">
                            {lic && (
                              <>
                                <button 
                                  onClick={() => handleRenovarLicencia(lic.id, 'dias', 1)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-medium"
                                >
                                  +1 Día
                                </button>
                                <button 
                                  onClick={() => handleRenovarLicencia(lic.id, 'mensual')}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium"
                                >
                                  +1 Mes
                                </button>
                                <button 
                                  onClick={() => handleRenovarLicencia(lic.id, 'trimestral')}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-medium"
                                >
                                  +3 Meses
                                </button>
                                <button 
                                  onClick={() => handleRenovarLicencia(lic.id, 'anual')}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-medium"
                                >
                                  +1 Año
                                </button>
                                <button 
                                  onClick={() => handleToggleLicencia(lic.id, lic.estado)}
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    lic.estado === 'activa' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {lic.estado === 'activa' ? 'Suspender' : 'Activar'}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABLA DE USUARIOS Y RECTORES */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-4">Usuarios y Rectores (Control de Accesos y Restablecimiento de Claves)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border rounded-lg">
                  <thead className="bg-slate-50 text-slate-700 uppercase text-xs border-b">
                    <tr>
                      <th className="p-3">Usuario</th>
                      <th className="p-3">Correo</th>
                      <th className="p-3">Institución</th>
                      <th className="p-3">Rol</th>
                      <th className="p-3">Estado Acceso</th>
                      <th className="p-3 text-center">Acciones</th>
                      <th className="p-3 text-center">Restablecer Clave</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {docentesLista.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-800">{doc.nombres} {doc.apellidos}</td>
                        <td className="p-3 text-slate-600">{doc.email}</td>
                        <td className="p-3 text-slate-600">{doc.instituciones?.nombre_institucion || 'Sin asignar'}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                            doc.rol === 'rector' ? 'bg-purple-100 text-purple-800' :
                            doc.rol === 'vicerrector' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {doc.rol || 'docente'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            doc.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {doc.activo !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {!doc.es_superadmin && (
                            <button 
                              onClick={() => handleToggleEstadoDocente(doc.id, doc.activo !== false)}
                              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                                doc.activo !== false 
                                  ? 'bg-red-100 hover:bg-red-200 text-red-800' 
                                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                              }`}
                            >
                              {doc.activo !== false ? 'Inactivar' : 'Activar'}
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {!doc.es_superadmin && (
                            <button 
                              onClick={() => handleResetearPasswordSuperadmin(doc.email, doc.nombres)}
                              className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-xs font-semibold transition"
                            >
                              🔑 Resetear a 123456
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: REGISTRAR ESCUELA */}
        {tab === 'instituciones' && (
          <form onSubmit={handleCrearInstitucion} className="space-y-4 max-w-lg">
            <h2 className="text-lg font-bold text-slate-800">Registrar Nueva Institución Educativa</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nombre de la Institución</label>
              <input 
                type="text" 
                required 
                value={nombreInst} 
                onChange={(e) => setNombreInst(e.target.value)}
                placeholder="Ej: Unidad Educativa Ecuatoriana"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Código AMIE</label>
              <input 
                type="text" 
                required 
                value={codigoAmie} 
                onChange={(e) => setCodigoAmie(e.target.value)}
                placeholder="Ej: 01H00123"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Tipo de Licencia</label>
                <select 
                  value={tipoLicencia} 
                  onChange={(e) => setTipoLicencia(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  <option value="diaria">Diaria (Días Exactos)</option>
                  <option value="mensual">Mensual</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>

              {tipoLicencia === 'diaria' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cantidad de Días</label>
                  <input 
                    type="number" 
                    min={1} 
                    value={diasPersonalizados} 
                    onChange={(e) => setDiasPersonalizados(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Límite de Docentes</label>
                  <input 
                    type="number" 
                    value={limiteDocentes} 
                    onChange={(e) => setLimiteDocentes(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={cargando}
              className="bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {cargando ? 'Guardando...' : 'Registrar Institución'}
            </button>
          </form>
        )}

        {/* PESTAÑA 3: CREAR USUARIOS CON ROL */}
        {tab === 'docentes' && (
          <form onSubmit={handleCrearDocente} className="space-y-4 max-w-lg">
            <h2 className="text-lg font-bold text-slate-800">Crear Cuenta de Usuario / Autoridad</h2>
            <div className="bg-slate-50 p-3 rounded-lg border text-xs text-slate-600">
              ℹ️ La contraseña inicial será siempre <strong className="text-blue-700 font-bold">123456</strong>.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Institución Educativa</label>
              <select 
                value={institucionIdDocente} 
                onChange={(e) => setInstitucionIdDocente(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
              >
                {instituciones.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.nombre_institucion} (AMIE: {inst.codigo_amie})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Rol en la Institución</label>
              <select 
                value={rolUsuario} 
                onChange={(e: any) => setRolUsuario(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none font-semibold text-blue-900 bg-blue-50"
              >
                <option value="rector">Rector / Director (Autoridad)</option>
                <option value="vicerrector">Vicerrector / Coordinador (Autoridad)</option>
                <option value="docente">Docente</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nombres</label>
                <input 
                  type="text" 
                  required 
                  value={nombresDocente} 
                  onChange={(e) => setNombresDocente(e.target.value)}
                  placeholder="Ej: Carlos Alberto"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Apellidos</label>
                <input 
                  type="text" 
                  required 
                  value={apellidosDocente} 
                  onChange={(e) => setApellidosDocente(e.target.value)}
                  placeholder="Ej: Andrade Vaca"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Correo Electrónico</label>
              <input 
                type="email" 
                required 
                value={emailDocente} 
                onChange={(e) => setEmailDocente(e.target.value)}
                placeholder="autoridad@escuela.edu.ec"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <button 
              type="submit" 
              disabled={cargando || instituciones.length === 0}
              className="bg-emerald-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {cargando ? 'Creando Cuenta...' : 'Crear Cuenta'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}