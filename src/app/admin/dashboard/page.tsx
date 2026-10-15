'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SuperAdminDashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'gestion' | 'instituciones' | 'docentes' | 'padres'>('gestion')
  
  const [instituciones, setInstituciones] = useState<any[]>([])
  const [docentesLista, setDocentesLista] = useState<any[]>([])
  const [estudiantesLista, setEstudiantesLista] = useState<any[]>([])
  const [padresAgrupados, setPadresAgrupados] = useState<any[]>([])

  // Estado local para los cupos editables por institución
  const [cuposEditables, setCuposEditables] = useState<{ [key: string]: number }>({})

  // Formulario Institución
  const [nombreInst, setNombreInst] = useState('')
  const [codigoAmie, setCodigoAmie] = useState('')
  const [tipoLicencia, setTipoLicencia] = useState('anual')
  const [diasPersonalizados, setDiasPersonalizados] = useState(1)
  const [limiteDocentes, setLimiteDocentes] = useState(20)

  // Formulario Usuario/Docente/Rector/Secretaria
  const [institucionIdDocente, setInstitucionIdDocente] = useState('')
  const [emailDocente, setEmailDocente] = useState('')
  const [nombresDocente, setNombresDocente] = useState('')
  const [apellidosDocente, setApellidosDocente] = useState('')
  const [rolUsuario, setRolUsuario] = useState<'docente' | 'rector' | 'vicerrector' | 'inspector' | 'secretaria'>('rector')

  // Estados para la Pestaña Cuentas Padres
  const [periodosDisponibles, setPeriodosDisponibles] = useState<string[]>([])
  const [anioLectivoFiltro, setAnioLectivoFiltro] = useState('2026-2027')
  const [jornadaFiltro, setJornadaFiltro] = useState('MATUTINA')
  const [gradoFiltro, setGradoFiltro] = useState('')
  const [paraleloFiltro, setParaleloFiltro] = useState('A')
  const [filtroTexto, setFiltroTexto] = useState('')

  // Formulario Registro Padre
  const [emailPadre, setEmailPadre] = useState('')
  const [nombresPadre, setNombresPadre] = useState('')
  const [apellidosPadre, setApellidosPadre] = useState('')
  const [cedulaPadre, setCedulaPadre] = useState('')
  const [telefonoPadre, setTelefonoPadre] = useState('')
  const [estudianteIdVinculo, setEstudianteIdVinculo] = useState('')
  const [parentescoPadre, setParentescoPadre] = useState('Padre')

  // Modales auxiliares de Padres
  const [modalVinculacionAbierto, setModalVinculacionAbierto] = useState(false)
  const [representanteSeleccionadoUserId, setRepresentanteSeleccionadoUserId] = useState('')
  const [representanteNombreDisplay, setRepresentanteNombreDisplay] = useState('')
  const [estudianteExtraId, setEstudianteExtraId] = useState('')
  const [parentescoExtra, setParentescoExtra] = useState('Padre')

  const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
  const [editVinculoId, setEditVinculoId] = useState('')
  const [editNombres, setEditNombres] = useState('')
  const [editApellidos, setEditApellidos] = useState('')
  const [editCedula, setEditCedula] = useState('')
  const [editTelefono, setEditTelefono] = useState('')

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
    // 1. Cargar instituciones y periodos globales
    const { data: instData } = await supabase
      .from('instituciones')
      .select('*, licencias(*)')
      .order('nombre_institucion', { ascending: true })

    if (instData) {
      setInstituciones(instData)
      if (instData.length > 0 && !institucionIdDocente) {
        setInstitucionIdDocente(instData[0].id)
      }

      const todosPeriodos = new Set<string>()
      instData.forEach(inst => {
        if (inst.periodos_disponibles && Array.isArray(inst.periodos_disponibles)) {
          inst.periodos_disponibles.forEach((p: string) => todosPeriodos.add(p))
        }
      })
      const listaPeriodos = Array.from(todosPeriodos)
      if (listaPeriodos.length > 0) {
        setPeriodosDisponibles(listaPeriodos)
        setAnioLectivoFiltro(listaPeriodos[0])
      }

      const mapaCupos: { [key: string]: number } = {}
      instData.forEach((inst) => {
        const lic = inst.licencias?.[0]
        if (lic) {
          mapaCupos[lic.id] = lic.limite_docentes || 0
        }
      })
      setCuposEditables(mapaCupos)
    }

    // 2. Cargar docentes
    const { data: docData } = await supabase
      .from('docentes')
      .select('*, instituciones(id, nombre_institucion, codigo_amie)')
      .order('created_at', { ascending: false })

    if (docData) setDocentesLista(docData)

    // 3. Cargar estudiantes globales
    const { data: estData } = await supabase
      .from('estudiantes')
      .select('*, instituciones(id, nombre_institucion)')
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true })

    if (estData) {
      setEstudiantesLista(estData)
      if (estData.length > 0) {
        setGradoFiltro(estData[0].grado_curso || '')
        setParaleloFiltro(estData[0].paralelo || 'A')
        setEstudianteIdVinculo(estData[0].id)
        setEstudianteExtraId(estData[0].id)
      }
    }

    // 4. Cargar y Agrupar Representantes
    const { data: padresData, error: errorPadres } = await supabase
      .from('estudiante_representantes')
      .select('*, estudiantes(*, instituciones(nombre_institucion))')

    if (errorPadres) {
      console.error('Error al consultar representantes:', errorPadres.message)
    }

    if (padresData) {
      const mapa: { [key: string]: any } = {}

      padresData.forEach((item: any) => {
        if (item.estudiantes) {
          const uid = item.user_id || item.id
          if (!mapa[uid]) {
            mapa[uid] = {
              id: item.id,
              user_id: uid,
              nombres: item.nombres || '',
              apellidos: item.apellidos || '',
              cedula: item.cedula || 'S/N',
              telefono: item.telefono || 'S/N',
              email: item.email || '',
              activo: item.activo ?? true,
              hijos: []
            }
          }
          mapa[uid].hijos.push({
            vinculo_id: item.id,
            estudiante_id: item.estudiantes.id,
            nombreCompleto: `${item.estudiantes.apellidos || ''} ${item.estudiantes.nombres || ''}`.trim(),
            cursoParalelo: `${item.estudiantes.grado_curso || 'N/A'} "${item.estudiantes.paralelo || 'N/A'}"`,
            parentesco: item.parentesco || 'Representante',
            institucionNombre: item.estudiantes.instituciones?.nombre_institucion || 'Institución'
          })
        }
      })
      setPadresAgrupados(Object.values(mapa))
    }
  }

  // Filtros dinámicos para estudiantes
  const gradosDisponibles = Array.from(new Set(
    estudiantesLista
      .filter(e => (e.jornada || 'MATUTINA').toUpperCase() === jornadaFiltro.toUpperCase())
      .map(e => e.grado_curso)
  ))

  const paralelosDisponibles = Array.from(new Set(
    estudiantesLista
      .filter(e => (e.jornada || 'MATUTINA').toUpperCase() === jornadaFiltro.toUpperCase() && e.grado_curso === gradoFiltro)
      .map(e => e.paralelo || 'A')
  ))

  const estudiantesFiltrados = estudiantesLista.filter(e => {
    const coincidePeriodo = anioLectivoFiltro ? e.anio_lectivo === anioLectivoFiltro : true
    const coincideJornada = (e.jornada || 'MATUTINA').toUpperCase() === jornadaFiltro.toUpperCase()
    const coincideGrado = gradoFiltro ? e.grado_curso === gradoFiltro : true
    const coincideParalelo = paraleloFiltro ? (e.paralelo || 'A') === paraleloFiltro : true
    return coincidePeriodo && coincideJornada && coincideGrado && coincideParalelo
  })

  useEffect(() => {
    if (estudiantesFiltrados.length > 0) {
      const existe = estudiantesFiltrados.some(e => e.id === estudianteIdVinculo)
      if (!existe) {
        setEstudianteIdVinculo(estudiantesFiltrados[0].id)
      }
    } else {
      setEstudianteIdVinculo('')
    }
  }, [estudiantesFiltrados, estudianteIdVinculo])

  const padresFiltrados = padresAgrupados.filter(p => {
    const texto = filtroTexto.toLowerCase()
    const nombreCompleto = `${p.nombres} ${p.apellidos}`.toLowerCase()
    const cedula = (p.cedula || '').toLowerCase()
    const coincideHijo = p.hijos.some((h: any) => h.nombreCompleto.toLowerCase().includes(texto) || h.cursoParalelo.toLowerCase().includes(texto))
    return nombreCompleto.includes(texto) || cedula.includes(texto) || coincideHijo
  })

  // ACCIÓN: Registrar Padre
  const handleCrearPadre = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')

    if (!estudianteIdVinculo || estudianteIdVinculo.trim() === '') {
      setMensaje('Error: Debe seleccionar un estudiante válido de la lista para vincular.')
      return
    }

    setCargando(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailPadre.trim().toLowerCase(),
        password: '123456',
        options: {
          data: {
            nombres: nombresPadre.trim(),
            apellidos: apellidosPadre.trim(),
            requiere_cambio_password: true
          }
        }
      })

      if (authError && !authError.message.toLowerCase().includes('already registered')) throw authError

      let userIdFinal = authData?.user?.id
      if (!userIdFinal) throw new Error('El correo ingresado ya se encuentra registrado en el sistema.')

      if (sessionData?.session) {
        await supabase.auth.setSession(sessionData.session)
      }

      const { error: vinculoError } = await supabase
        .from('estudiante_representantes')
        .insert([{
          user_id: userIdFinal,
          estudiante_id: estudianteIdVinculo,
          parentesco: parentescoPadre,
          nombres: nombresPadre.trim().toUpperCase(),
          apellidos: apellidosPadre.trim().toUpperCase(),
          cedula: cedulaPadre.trim(),
          telefono: telefonoPadre.trim(),
          email: emailPadre.trim().toLowerCase(),
          activo: true,
          requiere_cambio_password: true
        }])

      if (vinculoError) throw vinculoError

      setMensaje('¡Representante registrado y vinculado con éxito! Clave temporal: 123456.')
      setEmailPadre('')
      setNombresPadre('')
      setApellidosPadre('')
      setCedulaPadre('')
      setTelefonoPadre('')
      await cargarDatos()
    } catch (err: any) {
      setMensaje('Error: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  // ACCIÓN: Agregar hijo extra
  const handleAgregarHijoExtra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!estudianteExtraId) {
      alert('Debe seleccionar un estudiante.')
      return
    }
    setCargando(true)
    try {
      const padreActual = padresAgrupados.find(p => p.user_id === representanteSeleccionadoUserId)
      if (!padreActual) throw new Error('Representante no encontrado.')

      const { error } = await supabase.from('estudiante_representantes').insert([{
        user_id: representanteSeleccionadoUserId,
        estudiante_id: estudianteExtraId,
        parentesco: parentescoExtra,
        nombres: padreActual.nombres,
        apellidos: padreActual.apellidos,
        cedula: padreActual.cedula,
        telefono: padreActual.telefono,
        email: padreActual.email,
        activo: true
      }])

      if (error) throw error

      setMensaje('¡Estudiante adicional vinculado con éxito!')
      setModalVinculacionAbierto(false)
      await cargarDatos()
    } catch (err: any) {
      setMensaje('Error al vincular estudiante: ' + err.message)
      setCargando(false)
    }
  }

  // ACCIÓN: Guardar edición de representante
  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    try {
      const { error } = await supabase
        .from('estudiante_representantes')
        .update({
          nombres: editNombres.trim().toUpperCase(),
          apellidos: editApellidos.trim().toUpperCase(),
          cedula: editCedula.trim(),
          telefono: editTelefono.trim()
        })
        .eq('id', editVinculoId)

      if (error) throw error

      setMensaje('¡Datos actualizados con éxito!')
      setModalEditarAbierto(false)
      await cargarDatos()
    } catch (err: any) {
      setMensaje('Error al editar: ' + err.message)
      setCargando(false)
    }
  }

  // ACCIÓN: Activar o Inactivar cuenta padre
  const handleToggleActivo = async (userId: string, estadoActual: boolean) => {
    try {
      setCargando(true)
      await supabase.from('estudiante_representantes')
        .update({ activo: !estadoActual })
        .eq('user_id', userId)
      
      setMensaje(`Representante ${!estadoActual ? 'activado' : 'inactivado / bloqueado'} correctamente.`)
      await cargarDatos()
    } catch (err: any) {
      setMensaje('Error al cambiar estado.')
      setCargando(false)
    }
  }

  // ACCIÓN: Eliminar vínculo de hijo
  const handleEliminarVinculo = async (vinculoId: string) => {
    if (!confirm('¿Está seguro de eliminar este vínculo o estudiante del representante?')) return
    try {
      setCargando(true)
      await supabase.from('estudiante_representantes').delete().eq('id', vinculoId)
      await cargarDatos()
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
      setCargando(false)
    }
  }

  // Actualizar Cupo de Docentes
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

      setMensaje(`¡Límite de usuarios actualizado a ${nuevoCupo} cupos exitosamente!`)
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

  // Crear Cuenta Docente / Autoridad
  const handleCrearDocente = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')
    setCargando(true)

    try {
      if (!institucionIdDocente) throw new Error('Debes seleccionar una institución.')

      const { data: sessionData } = await supabase.auth.getSession()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailDocente.trim().toLowerCase(),
        password: '123456',
        options: {
          data: { requiere_cambio_password: true }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: docenteError } = await supabase
          .from('docentes')
          .upsert([{
            id: authData.user.id,
            institucion_id: institucionIdDocente, 
            email: emailDocente.trim().toLowerCase(),
            nombres: nombresDocente.trim(),
            apellidos: apellidosDocente.trim(),
            rol: rolUsuario,
            es_superadmin: false,
            activo: true,
            requiere_cambio_password: true,
            requiere_cambio_clave: true
          }])

        if (docenteError) throw docenteError

        if (sessionData?.session) {
          await supabase.auth.setSession(sessionData.session)
        }

        setMensaje(`¡Cuenta de ${rolUsuario.toUpperCase()} creada con éxito! Contraseña inicial temporal: "123456".`)
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

  // Cambiar Institución de un Docente/Rector
  const handleCambiarInstitucionDocente = async (docenteId: string, nuevaInstitucionId: string) => {
    try {
      const { error } = await supabase
        .from('docentes')
        .update({ institucion_id: nuevaInstitucionId })
        .eq('id', docenteId)

      if (error) throw error

      setMensaje('¡Institución del usuario actualizada correctamente!')
      cargarDatos()
    } catch (err: any) {
      setMensaje('Error al cambiar de institución: ' + err.message)
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

  // Activar / Inactivar docente
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

  // Restablecer contraseña conectándose al endpoint /api/admin/reset-password
  const handleResetearPasswordSuperadmin = async (docenteId: string, emailUsuario: string, nombresUsuario: string) => {
    if (!confirm(`¿Deseas restablecer la contraseña de ${nombresUsuario} (${emailUsuario}) a la clave temporal "123456"?`)) {
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: docenteId,
          targetEmail: emailUsuario,
          requesterUserId: user?.id
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al restablecer contraseña')

      setMensaje(`La contraseña de ${emailUsuario} ha sido restablecida a "123456" y su cuenta fue desbloqueada.`)
      cargarDatos()
    } catch (err: any) {
      setMensaje('Error al restablecer clave: ' + err.message)
    }
  }

  if (verificandoAcceso) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Verificando accesos de Superadministrador...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#4b4c99] selection:text-white">
      
      {/* ENCABEZADO CORPORATIVO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Consola Central • Administración Global
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            Panel del Superadministrador
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Gestión Global de Licencias, Cupos de Usuarios, Instituciones y Autoridades.
          </p>
        </div>

        <button 
          onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} 
          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition cursor-pointer flex items-center gap-2 shadow-2xs shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          Cerrar Sesión
        </button>
      </div>

      {/* BARRA DE PESTAÑAS */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap gap-2">
        <button 
          onClick={() => { setTab('gestion'); setMensaje(''); }}
          style={tab === 'gestion' ? { backgroundColor: '#4b4c99' } : {}}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            tab === 'gestion' ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
          </svg>
          Control de Escuelas y Licencias
        </button>

        <button 
          onClick={() => { setTab('instituciones'); setMensaje(''); }}
          style={tab === 'instituciones' ? { backgroundColor: '#4b4c99' } : {}}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            tab === 'instituciones' ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Registrar Escuela
        </button>

        <button 
          onClick={() => { setTab('docentes'); setMensaje(''); }}
          style={tab === 'docentes' ? { backgroundColor: '#4b4c99' } : {}}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            tab === 'docentes' ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
          Creación de Cuentas
        </button>

        <button 
          onClick={() => { setTab('padres'); setMensaje(''); }}
          style={tab === 'padres' ? { backgroundColor: '#4b4c99' } : {}}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            tab === 'padres' ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          Cuentas Padres
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-2xl text-xs font-bold border shadow-2xs flex items-center gap-2.5 ${
          mensaje.toLowerCase().includes('error') 
            ? 'bg-rose-50 text-rose-900 border-rose-200' 
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{mensaje}</span>
        </div>
      )}

      {/* PESTAÑA 1: GESTIÓN DE ESCUELAS, CUPOS Y LICENCIAS */}
      {tab === 'gestion' && (
        <div className="space-y-6">
          
          {/* Tabla de Instituciones y Licencias */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div 
              style={{ backgroundColor: '#4b4c99' }}
              className="p-4 text-xs font-bold uppercase text-white tracking-wider flex justify-between items-center"
            >
              <span>Instituciones Educativas, Límite de Usuarios y Licencias</span>
              <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-xl">Total: {instituciones.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Institución</th>
                    <th className="p-3.5">AMIE</th>
                    <th className="p-3.5">Plan</th>
                    <th className="p-3.5">Límite / Cupo de Usuarios</th>
                    <th className="p-3.5">Vencimiento</th>
                    <th className="p-3.5">Estado</th>
                    <th className="p-3.5 text-center">Renovación de Licencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {instituciones.map((inst) => {
                    const lic = inst.licencias?.[0]
                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-slate-800">{inst.nombre_institucion}</td>
                        <td className="p-3.5 font-mono text-slate-600">{inst.codigo_amie}</td>
                        <td className="p-3.5 text-slate-700 font-semibold capitalize">{lic?.tipo_licencia || 'N/A'}</td>

                        <td className="p-3.5">
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
                                className="w-20 p-2 border border-slate-300 rounded-xl text-center text-xs font-bold text-slate-900 focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] outline-none shadow-2xs"
                              />
                              <button
                                onClick={() => handleGuardarCupoLicencia(lic.id)}
                                style={{ backgroundColor: '#4b4c99' }}
                                className="px-3 py-2 text-white font-bold text-[11px] rounded-xl transition whitespace-nowrap shadow-2xs cursor-pointer flex items-center gap-1.5 hover:opacity-95"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                Guardar
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Sin licencia</span>
                          )}
                        </td>

                        <td className="p-3.5 text-slate-600 font-semibold">
                          {lic ? new Date(lic.fecha_vencimiento).toLocaleDateString('es-EC') : 'N/A'}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase inline-block ${
                            lic?.estado === 'activa' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {lic?.estado || 'Inactiva'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center space-x-1.5 whitespace-nowrap">
                          {lic && (
                            <>
                              <button 
                                onClick={() => handleRenovarLicencia(lic.id, 'dias', 1)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition cursor-pointer"
                              >
                                +1 Día
                              </button>
                              <button 
                                onClick={() => handleRenovarLicencia(lic.id, 'mensual')}
                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[11px] font-bold transition cursor-pointer"
                              >
                                +1 Mes
                              </button>
                              <button 
                                onClick={() => handleRenovarLicencia(lic.id, 'trimestral')}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold transition cursor-pointer"
                              >
                                +3 Meses
                              </button>
                              <button 
                                onClick={() => handleRenovarLicencia(lic.id, 'anual')}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[11px] font-bold transition cursor-pointer"
                              >
                                +1 Año
                              </button>
                              <button 
                                onClick={() => handleToggleLicencia(lic.id, lic.estado)}
                                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                                  lic.estado === 'activa' ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
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

          {/* Tabla de Usuarios y Autoridades */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div 
              style={{ backgroundColor: '#4b4c99' }}
              className="p-4 text-xs font-bold uppercase text-white tracking-wider flex justify-between items-center"
            >
              <span>Usuarios y Autoridades Registradas</span>
              <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-xl">Total: {docentesLista.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Usuario</th>
                    <th className="p-3.5">Correo</th>
                    <th className="p-3.5">Institución Actual / Reasignar</th>
                    <th className="p-3.5">Rol</th>
                    <th className="p-3.5">Estado Acceso</th>
                    <th className="p-3.5 text-center">Acciones</th>
                    <th className="p-3.5 text-center">Restablecer Clave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {docentesLista.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-800">{doc.nombres} {doc.apellidos}</td>
                      <td className="p-3.5 text-slate-600">{doc.email}</td>
                      
                      <td className="p-3.5">
                        {doc.es_superadmin ? (
                          <span className="text-[11px] font-bold text-[#4b4c99] uppercase">Superadministrador</span>
                        ) : (
                          <select
                            value={doc.institucion_id || ''}
                            onChange={(e) => handleCambiarInstitucionDocente(doc.id, e.target.value)}
                            className="p-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:border-[#4b4c99] outline-none max-w-[220px] shadow-2xs cursor-pointer"
                          >
                            {instituciones.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                {inst.nombre_institucion}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase inline-block ${
                          doc.rol === 'rector' ? 'bg-purple-100 text-purple-800' :
                          doc.rol === 'vicerrector' ? 'bg-indigo-100 text-indigo-800' :
                          doc.rol === 'inspector' ? 'bg-amber-100 text-amber-800' :
                          doc.rol === 'secretaria' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {doc.rol || 'docente'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase inline-block ${
                          doc.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {doc.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {!doc.es_superadmin && (
                          <button 
                            onClick={() => handleToggleEstadoDocente(doc.id, doc.activo !== false)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                              doc.activo !== false 
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700' 
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {doc.activo !== false ? 'Inactivar' : 'Activar'}
                          </button>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {!doc.es_superadmin && (
                          <button 
                            onClick={() => handleResetearPasswordSuperadmin(doc.id, doc.email, doc.nombres)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                            </svg>
                            Resetear a 123456
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
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs max-w-xl">
          <div className="border-b border-slate-100 pb-4 mb-5">
            <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wide">Registrar Nueva Institución Educativa</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configura los datos base y el plan de licenciamiento inicial.</p>
          </div>

          <form onSubmit={handleCrearInstitucion} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombre de la Institución</label>
              <input 
                type="text" 
                required 
                value={nombreInst} 
                onChange={(e) => setNombreInst(e.target.value)}
                placeholder="Ej: Unidad Educativa Ecuatoriana"
                className="w-full p-3 rounded-xl border border-slate-300 font-semibold text-slate-900 focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Código AMIE</label>
              <input 
                type="text" 
                required 
                value={codigoAmie} 
                onChange={(e) => setCodigoAmie(e.target.value)}
                placeholder="Ej: 01H00123"
                className="w-full p-3 rounded-xl border border-slate-300 font-semibold text-slate-900 focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] outline-none shadow-2xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Tipo de Licencia</label>
                <select 
                  value={tipoLicencia} 
                  onChange={(e) => setTipoLicencia(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs cursor-pointer"
                >
                  <option value="diaria">Diaria (Días Exactos)</option>
                  <option value="mensual">Mensual</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>

              {tipoLicencia === 'diaria' ? (
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Cantidad de Días</label>
                  <input 
                    type="number" 
                    min={1} 
                    value={diasPersonalizados} 
                    onChange={(e) => setDiasPersonalizados(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-[#4b4c99] outline-none shadow-2xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1.5">Límite de Docentes</label>
                  <input 
                    type="number" 
                    value={limiteDocentes} 
                    onChange={(e) => setLimiteDocentes(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-[#4b4c99] outline-none shadow-2xs"
                  />
                </div>
              )}
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={cargando}
                style={{ backgroundColor: '#4b4c99' }}
                className="px-6 py-3 text-white font-bold text-xs rounded-xl hover:opacity-95 transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {cargando ? 'Guardando...' : 'Registrar Institución'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PESTAÑA 3: CREAR USUARIOS CON ROL */}
      {tab === 'docentes' && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs max-w-xl">
          <div className="border-b border-slate-100 pb-4 mb-5">
            <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wide">Crear Cuenta de Usuario / Autoridad</h2>
            <p className="text-xs text-slate-500 mt-0.5">Asigna credenciales vinculadas directamente a una institución educativa.</p>
          </div>

          <form onSubmit={handleCrearDocente} className="space-y-4 text-xs">
            <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-200/80 text-xs text-slate-700 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[#4b4c99] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p>La contraseña inicial temporal será siempre <strong className="text-[#4b4c99] font-bold">123456</strong>.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Institución Educativa</label>
              <select 
                value={institucionIdDocente} 
                onChange={(e) => setInstitucionIdDocente(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs cursor-pointer"
              >
                {instituciones.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.nombre_institucion} (AMIE: {inst.codigo_amie})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Rol en la Institución</label>
              <select 
                value={rolUsuario} 
                onChange={(e: any) => setRolUsuario(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 font-bold text-[#4b4c99] bg-indigo-50/40 focus:border-[#4b4c99] outline-none shadow-2xs cursor-pointer"
              >
                <option value="rector">Rector / Director (Autoridad)</option>
                <option value="vicerrector">Vicerrector / Coordinador (Autoridad)</option>
                <option value="inspector">Inspector / Inspectora</option>
                <option value="secretaria">Secretaria / Secretario</option>
                <option value="docente">Docente</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombres</label>
                <input 
                  type="text" 
                  required 
                  value={nombresDocente} 
                  onChange={(e) => setNombresDocente(e.target.value)}
                  placeholder="Ej: Carlos Alberto"
                  className="w-full p-3 rounded-xl border border-slate-300 font-semibold text-slate-900 focus:border-[#4b4c99] outline-none shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Apellidos</label>
                <input 
                  type="text" 
                  required 
                  value={apellidosDocente} 
                  onChange={(e) => setApellidosDocente(e.target.value)}
                  placeholder="Ej: Andrade Vaca"
                  className="w-full p-3 rounded-xl border border-slate-300 font-semibold text-slate-900 focus:border-[#4b4c99] outline-none shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1.5">Correo Electrónico</label>
              <input 
                type="email" 
                required 
                value={emailDocente} 
                onChange={(e) => setEmailDocente(e.target.value)}
                placeholder="autoridad@escuela.edu.ec"
                className="w-full p-3 rounded-xl border border-slate-300 font-semibold text-slate-900 focus:border-[#4b4c99] outline-none shadow-2xs"
              />
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={cargando || instituciones.length === 0}
                style={{ backgroundColor: '#4b4c99' }}
                className="px-6 py-3 text-white font-bold text-xs rounded-xl hover:opacity-95 transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {cargando ? 'Creando Cuenta...' : 'Crear Cuenta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PESTAÑA 4: CUENTAS PADRES */}
      {tab === 'padres' && (
        <div className="space-y-6">

          {/* Formulario de Registro con Filtros en Cascada */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Crear y Vincular Representante</h2>
              <p className="text-xs text-slate-500 mt-0.5">Filtra al estudiante por jornada, grado y paralelo para asignarle su representante legal.</p>
            </div>
            
            <form onSubmit={handleCrearPadre} className="space-y-4 text-xs">
              
              {/* Filtros de Estudiantes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Jornada</label>
                  <select
                    value={jornadaFiltro}
                    onChange={(e) => {
                      setJornadaFiltro(e.target.value)
                      const gradosJ = Array.from(new Set(estudiantesLista.filter(est => (est.jornada || 'MATUTINA').toUpperCase() === e.target.value.toUpperCase()).map(est => est.grado_curso)))
                      if (gradosJ.length > 0) setGradoFiltro(gradosJ[0] as string)
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="MATUTINA">Matutina</option>
                    <option value="VESPERTINA">Vespertina</option>
                    <option value="NOCTURNA">Nocturna</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Año / Grado de Básica</label>
                  <select
                    value={gradoFiltro}
                    onChange={(e) => {
                      setGradoFiltro(e.target.value)
                      const paralelosG = Array.from(new Set(estudiantesLista.filter(est => est.grado_curso === e.target.value).map(est => est.paralelo || 'A')))
                      if (paralelosG.length > 0) setParaleloFiltro(paralelosG[0] as string)
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none cursor-pointer shadow-2xs"
                  >
                    {gradosDisponibles.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Paralelo</label>
                  <select
                    value={paraleloFiltro}
                    onChange={(e) => setParaleloFiltro(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white outline-none cursor-pointer shadow-2xs"
                  >
                    {paralelosDisponibles.map(par => (
                      <option key={par} value={par}>Paralelo "{par}"</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selector del Estudiante */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Seleccionar Estudiante Disponible ({anioLectivoFiltro})</label>
                <select 
                  value={estudianteIdVinculo} 
                  onChange={(e) => setEstudianteIdVinculo(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs cursor-pointer"
                  required
                >
                  {estudiantesFiltrados.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.apellidos} {est.nombres} — Paralelo "{est.paralelo}" ({est.instituciones?.nombre_institucion})
                    </option>
                  ))}
                  {estudiantesFiltrados.length === 0 && (
                    <option value="">No hay estudiantes disponibles en este filtro</option>
                  )}
                </select>
              </div>

              {/* Datos del Representante */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Nombres del Representante</label>
                  <input 
                    type="text" 
                    required 
                    value={nombresPadre} 
                    onChange={(e) => setNombresPadre(e.target.value)}
                    placeholder="Ej: Marco Antonio"
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Apellidos</label>
                  <input 
                    type="text" 
                    required 
                    value={apellidosPadre} 
                    onChange={(e) => setApellidosPadre(e.target.value)}
                    placeholder="Ej: Urgilez Pinos"
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Cédula de Identidad</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={10}
                    value={cedulaPadre} 
                    onChange={(e) => setCedulaPadre(e.target.value)}
                    placeholder="0301060601"
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Número Telefónico / Celular</label>
                  <input 
                    type="text" 
                    required 
                    value={telefonoPadre} 
                    onChange={(e) => setTelefonoPadre(e.target.value)}
                    placeholder="0991234567"
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Correo Electrónico (Acceso)</label>
                  <input 
                    type="email" 
                    required 
                    value={emailPadre} 
                    onChange={(e) => setEmailPadre(e.target.value)}
                    placeholder="representante@correo.com"
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Clave por defecto: 123456 (Obligatorio cambio en primer inicio).</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Parentesco</label>
                  <select 
                    value={parentescoPadre} 
                    onChange={(e) => setParentescoPadre(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:border-[#4b4c99] outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="Padre">Padre</option>
                    <option value="Madre">Madre</option>
                    <option value="Tutor/Representante">Tutor / Representante</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={cargando || estudiantesFiltrados.length === 0}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-6 py-3 text-white font-bold text-xs rounded-xl shadow-sm hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {cargando ? 'Registrando...' : 'Crear Cuenta y Vincular'}
                </button>
              </div>
            </form>
          </div>

          {/* TABLA: Representantes Registrados */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Representantes Registrados en el Sistema (Global)</h3>
                <p className="text-[11px] text-slate-500 font-medium">Total agrupados: {padresFiltrados.length}</p>
              </div>
              <div className="w-full sm:w-80 relative">
                <input
                  type="text"
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  placeholder="Buscar por nombre, cédula o hijo..."
                  className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:bg-white focus:border-[#4b4c99] shadow-2xs"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Representante (Datos)</th>
                    <th className="p-3.5">Cédula / Teléfono</th>
                    <th className="p-3.5">Estudiantes Vinculados (Hijos)</th>
                    <th className="p-3.5 text-center">Estado / Bloqueo</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {padresFiltrados.map((p) => {
                    const nombreCompletoRep = `${p.apellidos || ''} ${p.nombres || ''}`.trim() || 'Representante'
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5">
                          <span className="block font-bold text-slate-900">{nombreCompletoRep}</span>
                          <span className="block text-[10px] text-slate-500">{p.email}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="block font-bold text-slate-800">Cédula: {p.cedula}</span>
                          <span className="block text-slate-600 text-[11px]">Telf: {p.telefono}</span>
                        </td>
                        <td className="p-3.5">
                          <ul className="space-y-1.5">
                            {p.hijos.map((h: any) => (
                              <li key={h.vinculo_id} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                                <div>
                                  <span className="font-bold text-slate-800">
                                    {h.nombreCompleto} <span className="text-[10px] text-slate-500">({h.cursoParalelo})</span>
                                  </span>
                                  <span className="block text-[10px] text-[#4b4c99] font-bold">{h.institucionNombre}</span>
                                  <span className="block text-[9px] text-slate-500 font-bold uppercase">Parentesco: {h.parentesco}</span>
                                </div>
                                <button
                                  onClick={() => handleEliminarVinculo(h.vinculo_id)}
                                  className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition ml-2 cursor-pointer"
                                  title="Eliminar este estudiante vinculado"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                  </svg>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase inline-block ${
                            p.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {p.activo !== false ? 'ACTIVO' : 'INACTIVO / BLOQUEADO'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setEditVinculoId(p.id)
                              setEditNombres(p.nombres || '')
                              setEditApellidos(p.apellidos || '')
                              setEditCedula(p.cedula || '')
                              setEditTelefono(p.telefono || '')
                              setModalEditarAbierto(true)
                            }}
                            className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-xl text-[11px] transition cursor-pointer"
                            title="Editar datos"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              setRepresentanteSeleccionadoUserId(p.user_id)
                              setRepresentanteNombreDisplay(nombreCompletoRep)
                              setModalVinculacionAbierto(true)
                            }}
                            className="px-2.5 py-1.5 bg-indigo-50 text-[#4b4c99] hover:bg-indigo-100 font-bold rounded-xl text-[11px] transition cursor-pointer"
                            title="Vincular otro hijo"
                          >
                            + Hijo
                          </button>
                          <button
                            onClick={() => handleToggleActivo(p.user_id, p.activo !== false)}
                            className={`px-2.5 py-1.5 font-bold rounded-xl text-[11px] transition cursor-pointer ${
                              p.activo !== false ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                            title="Activar o bloquear"
                          >
                            {p.activo !== false ? 'Inactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => handleResetearPasswordSuperadmin(p.user_id, p.email, nombreCompletoRep)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                            title="Resetear contraseña"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                            </svg>
                            Reset
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {padresFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 font-medium text-xs">
                        No hay representantes registrados en el sistema.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: Agregar Estudiante Adicional */}
      {modalVinculacionAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                Agregar Estudiante a Representante
              </h2>
              <button onClick={() => setModalVinculacionAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleAgregarHijoExtra} className="space-y-4 text-xs">
              <p className="text-slate-600 font-semibold bg-slate-50 p-3 rounded-xl border border-slate-200">
                Representante: <strong className="text-slate-900">{representanteNombreDisplay}</strong>
              </p>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Seleccionar Estudiante:</label>
                <select
                  value={estudianteExtraId}
                  onChange={(e) => setEstudianteExtraId(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
                >
                  {estudiantesLista.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.apellidos} {est.nombres} — {est.grado_curso} "{est.paralelo}" ({est.instituciones?.nombre_institucion})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Parentesco:</label>
                <select
                  value={parentescoExtra}
                  onChange={(e) => setParentescoExtra(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs cursor-pointer"
                >
                  <option value="Padre">Padre</option>
                  <option value="Madre">Madre</option>
                  <option value="Tutor/Representante">Tutor / Representante</option>
                </select>
              </div>
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalVinculacionAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm hover:opacity-95 transition cursor-pointer"
                >
                  Vincular Estudiante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Datos del Representante */}
      {modalEditarAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase text-slate-900 tracking-wide">
                Editar Datos del Representante
              </h2>
              <button onClick={() => setModalEditarAbierto(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleGuardarEdicion} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Nombres:</label>
                <input
                  type="text"
                  required
                  value={editNombres}
                  onChange={(e) => setEditNombres(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Apellidos:</label>
                <input
                  type="text"
                  required
                  value={editApellidos}
                  onChange={(e) => setEditApellidos(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Cédula:</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={editCedula}
                  onChange={(e) => setEditCedula(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Teléfono:</label>
                <input
                  type="text"
                  required
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] shadow-2xs"
                />
              </div>
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalEditarAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm hover:opacity-95 transition cursor-pointer"
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