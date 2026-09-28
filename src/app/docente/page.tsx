'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DocenteRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirige inmediatamente al dashboard
    router.replace('/docente/dashboard')
  }, [router])

  // Opcional: Puedes mostrar un pequeño spinner mientras ocurre la redirección
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-600 font-bold text-xs uppercase tracking-widest">Redirigiendo...</p>
      </div>
    </div>
  )
}