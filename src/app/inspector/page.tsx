'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InspectorRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/inspector/dashboard')
  }, [router])

  return (
    <div className="p-10 text-slate-900 font-bold bg-slate-50 min-h-screen flex items-center justify-center">
      Redirigindo al Dashboard de Inspectoría...
    </div>
  )
}