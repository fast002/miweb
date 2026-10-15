'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function TerminosModal({ userId, onAceptado }: { userId: string; onAceptado: () => void }) {
  const [debeAceptar, setDebeAceptar] = useState(false)
  const [leido, setLeido] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    async function verificarAceptacion() {
      if (!userId) return
      try {
        const { data } = await supabase
          .from('docentes')
          .select('terminos_aceptados_at')
          .eq('id', userId)
          .maybeSingle()

        if (data && !data.terminos_aceptados_at) {
          setDebeAceptar(true)
        }
      } catch (err) {
        console.error('Error al verificar términos:', err)
      } finally {
        setCargando(false)
      }
    }
    verificarAceptacion()
  }, [userId])

  const handleAceptar = async () => {
    if (!leido) return
    setGuardando(true)
    try {
      const ahora = new Date().toISOString()
      const { error } = await supabase
        .from('docentes')
        .update({ terminos_aceptados_at: ahora })
        .eq('id', userId)

      if (error) throw error

      setDebeAceptar(false)
      onAceptado()
    } catch (err: any) {
      alert('Error al registrar la aceptación: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando || !debeAceptar) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* ENCABEZADO */}
        <div className="bg-[#4b4c99] p-6 text-white text-center">
          <span className="text-[10px] uppercase font-bold tracking-widest bg-white/10 px-3 py-1 rounded-xl">
            Aviso Legal Obligatorio
          </span>
          <h2 className="text-xl font-black mt-2">Términos y Condiciones de Uso</h2>
          <p className="text-xs text-white/80 mt-1">Educamet SGA • Propiedad Intelectual y Privacidad</p>
        </div>

        {/* CUERPO DEL TEXTO LEGAL */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed max-h-[50vh] bg-slate-50/50">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase text-[#4b4c99]">1. Titularidad y Propiedad Intelectual</h3>
            <p>
              El software <strong>Educamet SGA</strong>, incluyendo su código fuente, arquitectura, diseño de interfaces, base de datos y logotipos, es creación exclusiva y propiedad intelectual de <strong>Rómulo Fernando Urgilez Siguencia</strong>. Queda estrictamente prohibida la reproducción, copia, distribución, comercialización, sublicencia, ingeniería inversa o divulgación total o parcial sin autorización escrita.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase text-[#4b4c99]">2. Fines Estrictamente Educativos</h3>
            <p>
              El uso de este sistema está limitado exclusivamente a la gestión académica, pedagógica y administrativa interna de la institución educativa autorizada. Se prohíbe su uso para prestar servicios comerciales externos o clonación con fines de lucro.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase text-[#4b4c99]">3. Privacidad y Seguridad de Datos</h3>
            <p>
              Toda la información ingresada en el sistema pertenece a la institución educativa. Educamet SGA implementa estrictos protocolos de seguridad para garantizar que los datos no sean comercializados ni compartidos con terceros no autorizados.
            </p>
          </div>
        </div>

        {/* PIE Y ACCIÓN DE ACEPTACIÓN */}
        <div className="p-6 bg-white border-t border-slate-200 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={leido}
              onChange={(e) => setLeido(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4b4c99] focus:ring-[#4b4c99] cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-800">
              He leído, comprendido y acepto los Términos y Condiciones, Aviso Legal y Políticas de Uso de Información de Educamet SGA.
            </span>
          </label>

          <button
            onClick={handleAceptar}
            disabled={!leido || guardando}
            style={{ backgroundColor: '#4b4c99' }}
            className="w-full py-3 text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
          >
            {guardando ? 'Registrando aceptación...' : 'Aceptar y Continuar al Sistema'}
          </button>
        </div>

      </div>
    </div>
  )
}