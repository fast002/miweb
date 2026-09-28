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

  const validarClaveSegura = (pwd: string) => {
    const tieneMinimo = pwd.length >= 8
    const tieneMayuscula = /[A-Z]/.test(pwd)
    const tieneNumero = /[0-9]/.test(pwd)
    const tieneEspecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    return tieneMinimo && tieneMayuscula && tieneNumero && tieneEspecial
  }

  const handleGuardarNuevaClave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (!validarClaveSegura(nuevaPassword)) {
      setError('La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un carácter especial.')
      return
    }

    setCargando(true)

    try {
      // 1. Obtener la sesión actual (ya logueado con 123456)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/'
        return
      }

      // 2. Sobrescribir la contraseña directamente en Supabase (NO pide la clave anterior)
      const { error: authError } = await supabase.auth.updateUser({
        password: nuevaPassword.trim(),
        data: { requiere_cambio_password: false }
      })

      if (authError) throw authError

      // 3. Quitar las banderas en la base de datos
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

      // Si es representante / padre
      await supabase
        .from('estudiante_representantes')
        .update({
          requiere_cambio_password: false,
          intentos_fallidos: 0,
          cuenta_bloqueada_hasta: null
        })
        .or(`user_id.eq.${user.id},email.ilike.${user.email}`)

      alert('✅ Contraseña actualizada correctamente.')

      // 4. Redirigir según el rol
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
      setError(err.message || 'Error al actualizar contraseña')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 space-y-6 border border-slate-200">
        
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto flex items-center justify-center">
            <img 
              src="/iconos/logo educament amarillo@8x.png" 
              alt="Logo Educamet" 
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-2">Crear Nueva Contraseña</h1>
          <p className="text-xs text-slate-600 font-medium">
            Ingresa tu nueva contraseña definitiva para proteger tu cuenta.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-900 text-xs font-bold rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleGuardarNuevaClave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Nueva Contraseña</label>
            <input
              type="password"
              required
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none focus:ring-2 focus:ring-[#4b4c99]"
            />
            <p className="text-[10px] text-slate-500 mt-1">Mínimo 8 caracteres, 1 mayúscula, 1 número y 1 símbolo especial.</p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Confirmar Nueva Contraseña</label>
            <input
              type="password"
              required
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 border rounded-xl text-xs font-bold text-slate-900 bg-slate-50 outline-none focus:ring-2 focus:ring-[#4b4c99]"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{ backgroundColor: '#4b4c99' }}
            className="w-full py-3 hover:opacity-90 text-white font-black text-xs rounded-xl shadow-md transition disabled:opacity-50 uppercase tracking-wider cursor-pointer"
          >
            {cargando ? 'Guardando clave...' : 'Actualizar e Ingresar'}
          </button>
        </form>

      </div>
    </div>
  )
}