'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje(null)
    setCargando(true)

    const emailLimpio = email.trim().toLowerCase()
    const passwordLimpia = password.trim()

    try {
      if (emailLimpio === 'ferchopla002@gmail.com' || emailLimpio === 'ferchoplay002@gmail.com') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailLimpio,
          password: passwordLimpia,
        })
        if (error || !data?.user) throw new Error('Correo o contraseña incorrectos.')
        window.location.href = '/admin/dashboard'
        return
      }

      // 1. Buscar en DOCENTES y validar estado ANTES de autenticar
      const { data: docInfo } = await supabase
        .from('docentes')
        .select('*')
        .ilike('email', emailLimpio)
        .maybeSingle()

      if (docInfo) {
        // Si está inactivo por boolean o por texto, bloqueamos el paso inmediatamente
        if (docInfo.activo === false || docInfo.estado === 'inactivo') {
          throw new Error('Tu cuenta se encuentra bloqueada o inactiva. Contacta a tu Rector o Vicerrector para activarla.')
        }

        // Si el Rector ya lo activó en el sistema (activo = true), pero se quedaron pegados los 3 intentos o la fecha de bloqueo en la tabla, los limpiamos
        if (docInfo.activo === true && (docInfo.intentos_fallidos >= 3 || docInfo.cuenta_bloqueada_hasta)) {
          await supabase
            .from('docentes')
            .update({ intentos_fallidos: 0, cuenta_bloqueada_hasta: null })
            .eq('id', docInfo.id)
          docInfo.intentos_fallidos = 0
          docInfo.cuenta_bloqueada_hasta = null
        }
      }

      // 1.1. Buscar en REPRESENTANTES y validar estado ANTES de autenticar
      const { data: repInfo } = await supabase
        .from('estudiante_representantes')
        .select('*')
        .ilike('email', emailLimpio)
        .maybeSingle()

      if (repInfo) {
        if (repInfo.activo === false) {
          throw new Error('Tu cuenta se encuentra bloqueada o inactiva. Contacta a la institución.')
        }

        if (repInfo.activo === true && (repInfo.intentos_fallidos >= 3 || repInfo.cuenta_bloqueada_hasta)) {
          await supabase
            .from('estudiante_representantes')
            .update({ intentos_fallidos: 0, cuenta_bloqueada_hasta: null })
            .eq('id', repInfo.id)
          repInfo.intentos_fallidos = 0
          repInfo.cuenta_bloqueada_hasta = null
        }
      }

      // 2. Intentar autenticación con Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLimpio,
        password: passwordLimpia,
      })

      if (error || !data?.user) {
        // --- CONTROL DE INTENTOS FALLIDOS ---
        if (docInfo) {
          const nuevosIntentos = (docInfo.intentos_fallidos || 0) + 1
          const bloqueado = nuevosIntentos >= 3

          // Actualizamos intentos y, si llegó a 3, pasamos activo a FALSE y estado a 'inactivo'
          await supabase
            .from('docentes')
            .update({ 
              intentos_fallidos: nuevosIntentos,
              activo: bloqueado ? false : true,
              estado: bloqueado ? 'inactivo' : 'activo',
              cuenta_bloqueada_hasta: bloqueado ? new Date(Date.now() + 86400000).toISOString() : null
            })
            .eq('id', docInfo.id)

          if (bloqueado) {
            throw new Error('Has superado el límite de 3 intentos. Tu cuenta ha sido bloqueada e inactivada. Contacta a tu Rector o Vicerrector.')
          }
          const restantes = 3 - nuevosIntentos
          throw new Error(`Contraseña incorrecta. Te quedan ${restantes} intento(s) antes del bloqueo.`)
        }

        if (repInfo) {
          const nuevosIntentos = (repInfo.intentos_fallidos || 0) + 1
          const bloqueado = nuevosIntentos >= 3

          await supabase
            .from('estudiante_representantes')
            .update({ 
              intentos_fallidos: nuevosIntentos,
              activo: bloqueado ? false : true,
              cuenta_bloqueada_hasta: bloqueado ? new Date(Date.now() + 86400000).toISOString() : null
            })
            .eq('id', repInfo.id)

          if (bloqueado) {
            throw new Error('Has superado el límite de 3 intentos. Tu cuenta ha sido bloqueada. Contacta a tu Rector o Vicerrector.')
          }
          const restantes = 3 - nuevosIntentos
          throw new Error(`Contraseña incorrecta. Te quedan ${restantes} intento(s) antes del bloqueo.`)
        }

        throw new Error('Correo o contraseña incorrectos.')
      }

      const user = data.user

      // 3. Validar si es Docente / Autoridad tras la autenticación de Supabase
      const { data: docData } = await supabase
        .from('docentes')
        .select('*')
        .or(`id.eq.${user.id},email.ilike.${emailLimpio}`)
        .maybeSingle()

      if (docData) {
        // Doble candado de seguridad: si está inactivo o tiene 3 intentos fallidos sin limpiar, cerramos la sesión de inmediato
        if (docData.activo === false || docData.estado === 'inactivo') {
          await supabase.auth.signOut()
          throw new Error('Tu cuenta se encuentra bloqueada o inactiva. Contacta al administrador o rector.')
        }

        // Si entró con éxito en el 1er o 2do intento, reiniciamos el contador a 0
        if (docData.intentos_fallidos > 0 || docData.cuenta_bloqueada_hasta) {
          await supabase
            .from('docentes')
            .update({ intentos_fallidos: 0, cuenta_bloqueada_hasta: null })
            .eq('id', docData.id)
        }

        localStorage.setItem('usuario', JSON.stringify(docData))
        if (docData.institucion_id) {
          localStorage.setItem('institucion_id', docData.institucion_id)
        }

        if (passwordLimpia === '123456' || docData.requiere_cambio_password || docData.requiere_cambio_clave) {
          window.location.href = '/cambiar-password'
          return
        }

        const rol = (docData.rol || '').toLowerCase().trim()
        if (rol === 'rector' || rol === 'vicerrector' || rol === 'director') {
          window.location.href = '/rector'
        } else if (rol === 'inspector') {
          window.location.href = '/inspector'
        } else if (rol === 'padres') {
          window.location.href = '/padres'
        } else if (rol === 'secretaria') {
          window.location.href = '/secretaria'
        } else {
          window.location.href = '/docente'
        }
        return
      }

      // 4. Validar si es Representante / Padre
      const { data: repData } = await supabase
        .from('estudiante_representantes')
        .select('*')
        .or(`user_id.eq.${user.id},email.ilike.${emailLimpio}`)
        .maybeSingle()

      if (repData) {
        if (repData.activo === false) {
          await supabase.auth.signOut()
          throw new Error('Tu cuenta se encuentra inactiva.')
        }

        if (repData.intentos_fallidos > 0 || repData.cuenta_bloqueada_hasta) {
          await supabase
            .from('estudiante_representantes')
            .update({ intentos_fallidos: 0, cuenta_bloqueada_hasta: null })
            .eq('id', repData.id)
        }

        localStorage.setItem('usuario', JSON.stringify(repData))

        if (passwordLimpia === '123456' || repData.requiere_cambio_password) {
          window.location.href = '/cambiar-password'
          return
        }

        window.location.href = '/padres'
        return
      }

      window.location.href = '/rector'

    } catch (err: any) {
      console.error('Error durante el login:', err)
      setMensaje(err.message || 'Error al iniciar sesión.')
      setCargando(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[#4b4c99] via-indigo-900 to-[#313270]">
      <div className="absolute top-10 left-10 w-72 h-72 bg-[#f6c358]/30 rounded-full blur-2xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#45b3a5]/25 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md bg-white/90 p-8 rounded-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3),inset_0_2px_6px_rgba(255,255,255,0.8)] border-4 border-white/60 transition-all duration-300 z-10">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="p-4 bg-white rounded-3xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.04),0_8px_16px_rgba(0,0,0,0.08)] border-2 border-slate-100 mb-3">
            <img
              src="/iconos/logo educament amarillo@8x.png"
              alt="Logo Educamet"
              className="h-14 w-auto object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">Bienvenido a Educamet</h1>
          <p className="text-xs text-slate-500 font-bold mt-0.5">Sistema Pedagógico e Institucional</p>
        </div>

        {mensaje && (
          <div className="p-3.5 mb-5 rounded-2xl text-xs font-bold bg-[#de5860]/15 text-[#de5860] border-2 border-[#de5860]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)] flex items-center gap-2">
            <span>{mensaje}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5 ml-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@ejemplo.com"
              className="w-full p-4 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-800 bg-slate-100/80 shadow-[inset_0_3px_6px_rgba(0,0,0,0.06),0_2px_4px_rgba(255,255,255,0.8)] focus:bg-white focus:border-[#4b4c99] focus:ring-2 focus:ring-[#4b4c99]/20 outline-none transition placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5 ml-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-4 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-800 bg-slate-100/80 shadow-[inset_0_3px_6px_rgba(0,0,0,0.06),0_2px_4px_rgba(255,255,255,0.8)] focus:bg-white focus:border-[#4b4c99] focus:ring-2 focus:ring-[#4b4c99]/20 outline-none transition placeholder-slate-400"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{ backgroundColor: '#4b4c99' }}
            className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:opacity-95 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 cursor-pointer shadow-[0_10px_25px_rgba(75,76,153,0.4),inset_0_2px_4px_rgba(255,255,255,0.3)] border-2 border-white/20 mt-3"
          >
            {cargando ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando Sesión...
              </span>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t-2 border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold">
            Plataforma Segura • Currículo Nacional del Ecuador
          </p>
        </div>
      </div>
    </main>
  )
}