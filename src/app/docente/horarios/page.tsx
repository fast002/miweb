'use client'

import { useState, useEffect } from 'react'

export default function ProximamenteComponent() {
  const [isVisible, setIsVisible] = useState(false)

  // Efecto de aparición suave
  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className={`
      flex flex-col items-center justify-center min-h-[400px] w-full p-8 
      bg-white rounded-3xl border border-slate-200 shadow-sm
      transition-all duration-700 ease-out transform
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
    `}>
      {/* Icono decorativo */}
      <div className="mb-6 animate-pulse">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
          <span className="text-4xl">🚧</span>
        </div>
      </div>

      {/* Títulos grandes */}
      <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter text-center">
        Próximamente
      </h2>
      
      <p className="text-slate-500 font-bold text-sm md:text-base mt-4 max-w-md text-center">
        Estamos trabajando en la mejor experiencia para gestionar tus horarios. 
        Este módulo estará disponible muy pronto en tu dashboard docente.
      </p>

      {/* Barra de carga decorativa */}
      <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-10 overflow-hidden">
        <div className="w-1/2 h-full bg-indigo-500 rounded-full animate-progress-bar"></div>
      </div>

      <style jsx>{`
        @keyframes progress-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-progress-bar {
          animation: progress-bar 2s infinite linear;
        }
      `}</style>
    </div>
  )
}