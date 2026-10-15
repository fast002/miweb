'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Validación estricta: mínimo 10 caracteres, mayúscula, minúscula, número y carácter especial
  const validarClaveSegura = (pwd: string) => {
    const tieneMinimo = pwd.length >= 10
    const tieneMayuscula = /[A-Z]/.test(pwd)
    const tieneMinuscula = /[a-z]/.test(pwd)
    const tieneNumero = /[0-9]/.test(pwd)
    const tieneEspecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    
    // Rechazar claves comunes o débiles
    const clavesComunes = ['1234567890', 'password123', 'educamet2026', 'admin12345']
    if (clavesComunes.includes(pwd.toLowerCase())) return false

    return tieneMinimo && tieneMayuscula && tieneMinuscula && tieneNumero && tieneEspecial
  }

  const handleGuardarNuevaClave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const pwdLimpia = nuevaPassword.trim()
    const confLimpia = confirmarPassword.trim()

    if (pwdLimpia !== confLimpia) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (!validarClaveSegura(pwdLimpia)) {
      setError('La contraseña debe tener al menos 10 caracteres, una letra mayúscula, una letra minúscula, un número y un carácter especial.')
      return
    }

    setCargando(true)

    try {
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()

      if (sessionError || !user) {
        throw new Error('Sesión expirada o no autorizada. Por favor, vuelve a iniciar sesión.')
      }

      const { error: authError } = await supabase.auth.updateUser({
        password: pwdLimpia,
        data: { requiere_cambio_password: false }
      })

      if (authError) throw authError

      const { data: perfilDocente } = await supabase
        .from('docentes')
        .update({
          requiere_cambio_password: false,
          requiere_cambio_clave: false,
          intentos_fallidos: 0,
          cuenta_bloqueada_hasta: null
        })
        .or(`id.eq.${user.id},email.ilike.${user.email}`)
        .select('rol')
        .maybeSingle()

      await supabase
        .from('estudiante_representantes')
        .update({
          requiere_cambio_password: false,
          intentos_fallidos: 0,
          cuenta_bloqueada_hasta: null
        })
        .or(`user_id.eq.${user.id},email.ilike.${user.email}`)

      const rol = (perfilDocente?.rol || '').toLowerCase().trim()
      if (rol.includes('rector') || rol.includes('vicerrector') || rol.includes('director')) {
        window.location.href = '/rector'
      } else if (rol === 'inspector') {
        window.location.href = '/inspector'
      } else if (rol === 'secretaria') {
        window.location.href = '/secretaria'
      } else if (rol === 'docente') {
        window.location.href = '/docente'
      } else {
        window.location.href = '/padres'
      }

    } catch (err: any) {
      console.error('Error al cambiar contraseña:', err)
      setError(err.message || 'Error al actualizar contraseña por motivos de seguridad.')
      setCargando(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[#4b4c99] via-indigo-900 to-[#313270] font-sans">
      
      <div className="absolute top-10 left-10 w-72 h-72 bg-[#f6c358]/30 rounded-full blur-2xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#45b3a5]/25 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md bg-white/95 p-8 rounded-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3),inset_0_2px_6px_rgba(255,255,255,0.8)] border-4 border-white/60 transition-all duration-300 z-10">
        
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="p-4 bg-white rounded-3xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.04),0_8px_16px_rgba(0,0,0,0.08)] border-2 border-slate-100 mb-3">
            <img
              src="/iconos/logo educament amarillo@8x.png"
              alt="Logo Educamet"
              className="h-14 w-auto object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">Crear Nueva Contraseña</h1>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Por seguridad, define una contraseña robusta para proteger tu cuenta institucional.
          </p>
        </div>

        {error && (
          <div className="p-3.5 mb-5 rounded-2xl text-xs font-bold bg-[#de5860]/15 text-[#de5860] border-2 border-[#de5860]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)] flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleGuardarNuevaClave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5 ml-1">
              Nueva Contraseña
            </label>
            <input
              type="password"
              required
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-4 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-800 bg-slate-100/80 shadow-[inset_0_3px_6px_rgba(0,0,0,0.06),0_2px_4px_rgba(255,255,255,0.8)] focus:bg-white focus:border-[#4b4c99] focus:ring-2 focus:ring-[#4b4c99]/20 outline-none transition placeholder-slate-400"
            />
            {/* Guía visual de pautas para el usuario */}
            <div className="mt-2 ml-1 space-y-1 text-[10px] font-bold">
              <p className={nuevaPassword.length >= 10 ? 'text-emerald-600' : 'text-slate-500'}>
                {nuevaPassword.length >= 10 ? '✓' : '•'} Mínimo 10 caracteres
              </p>
              <p className={/[A-Z]/.test(nuevaPassword) ? 'text-emerald-600' : 'text-slate-500'}>
                {/[A-Z]/.test(nuevaPassword) ? '✓' : '•'} Al menos una letra mayúscula
              </p>
              <p className={/[a-z]/.test(nuevaPassword) ? 'text-emerald-600' : 'text-slate-500'}>
                {/[a-z]/.test(nuevaPassword) ? '✓' : '•'} Al menos una letra minúscula
              </p>
              <p className={/[0-9]/.test(nuevaPassword) ? 'text-emerald-600' : 'text-slate-500'}>
                {/[0-9]/.test(nuevaPassword) ? '✓' : '•'} Al menos un número
              </p>
              <p className={/[!@#$%^&*(),.?":{}|<>]/.test(nuevaPassword) ? 'text-emerald-600' : 'text-slate-500'}>
                {/[!@#$%^&*(),.?":{}|<>]/.test(nuevaPassword) ? '✓' : '•'} Al menos un carácter especial (!@#$%^&*)
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5 ml-1">
              Confirmar Nueva Contraseña
            </label>
            <input
              type="password"
              required
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
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
                Actualizando clave...
              </span>
            ) : (
              'Actualizar e Ingresar al Sistema'
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