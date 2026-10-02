'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EsquelasPage() {
  const router = useRouter()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [esquelas, setEsquelas] = useState<any[]>([])
  const [estudiantes, setEstudiantes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  // Estados del formulario para la nueva esquela
  const [estudianteIdSeleccionado, setEstudianteIdSeleccionado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [gravedad, setGravedad] = useState('Leve')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    const { data: dataEsquelas } = await supabase
      .from('esquelas')
      .select(`
        *,
        estudiantes (
          nombres, 
          apellidos, 
          grado_curso, 
          paralelo,
          instituciones (
            nombre_institucion,
            codigo_amie,
            logo_url,
            direccion
          )
        )
      `)
      .order('fecha', { ascending: false })

    if (dataEsquelas) setEsquelas(dataEsquelas)

    const { data: dataEstudiantes } = await supabase
      .from('estudiantes')
      .select('id, nombres, apellidos, grado_curso, paralelo')
      .eq('estado', 'activo')
      .order('apellidos', { ascending: true })

    if (dataEstudiantes) setEstudiantes(dataEstudiantes)
    setCargando(false)
  }

  const crearEsquela = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!estudianteIdSeleccionado || !motivo) {
      setMensaje('Por favor selecciona un estudiante y redacta el motivo.')
      return
    }

    setEnviando(true)
    setMensaje(null)

    const { count } = await supabase
      .from('esquelas')
      .select('*', { count: 'exact', head: true })
      .eq('estudiante_id', estudianteIdSeleccionado)

    const numeroSecuencial = (count || 0) + 1
    const codigoEsquela = `ESQ-${String(numeroSecuencial).padStart(3, '0')}`

    const { error } = await supabase.from('esquelas').insert([
      {
        estudiante_id: estudianteIdSeleccionado,
        motivo,
        gravedad,
        anio_lectivo: '2026-2027',
        numero_esquela: codigoEsquela
      }
    ])

    setEnviando(false)

    if (error) {
      const { error: errFallback } = await supabase.from('esquelas').insert([
        {
          estudiante_id: estudianteIdSeleccionado,
          motivo,
          gravedad,
          anio_lectivo: '2026-2027'
        }
      ])
      
      if (errFallback) {
        setMensaje('Error al guardar la esquela: ' + errFallback.message)
        return
      }
    }

    setMensaje('Esquela emitida y registrada con éxito.')
    setMotivo('')
    setEstudianteIdSeleccionado('')
    setModalAbierto(false)
    cargarDatos()
  }

  const imprimirEsquela = (esquela: any, indexGlobal: number) => {
    const ventana = window.open('', '_blank')
    if (!ventana) return

    const inst = esquela.estudiantes?.instituciones || {}
    const logoUrl = inst.logo_url || ''
    const nombreInst = inst.nombre_institucion || 'INSTITUCIÓN EDUCATIVA'
    const codigoAmie = inst.codigo_amie || 'S/N'
    const direccionInst = inst.direccion || ''
    
    const numEsquela = esquela.numero_esquela || `ESQ-${String(indexGlobal + 1).padStart(3, '0')}`

    ventana.document.write(`
      <html>
        <head>
          <title>Notificación Disciplinaria - ${numEsquela}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; }
            .container { max-width: 700px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 30px; border-radius: 12px; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #4b4c99; padding-bottom: 20px; margin-bottom: 25px; }
            .logo-container { width: 80px; text-align: center; margin-right: 20px; }
            .logo-container img { max-width: 75px; max-height: 75px; object-fit: contain; }
            .inst-info { flex: 1; text-align: center; }
            .inst-info h2 { margin: 0; font-size: 16px; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .inst-info p { margin: 3px 0; font-size: 11px; color: #475569; }
            .doc-title { text-align: center; margin-bottom: 25px; }
            .doc-title h1 { font-size: 13px; font-weight: 700; color: #4b4c99; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(75, 76, 153, 0.08); padding: 8px; border-radius: 8px; border: 1px solid rgba(75, 76, 153, 0.2); }
            .meta-box { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-weight: bold; }
            .content { font-size: 12px; line-height: 1.6; }
            .field { margin-bottom: 12px; }
            .field strong { color: #334155; display: inline-block; width: 150px; }
            .badge { display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: bold; border-radius: 6px; text-transform: uppercase; }
            .badge.Leve { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
            .badge.Grave { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
            .badge.MuyGrave { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
            .motivo-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 8px; min-height: 60px; font-weight: 500; }
            .signatures { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; }
            .sig-line { border-top: 1px solid #64748b; width: 220px; padding-top: 6px; font-size: 11px; font-weight: bold; color: #334155; }
            .footer-print { margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-container">
                ${logoUrl ? `<img src="${logoUrl}" alt="Logo Institucional" />` : '<div style="font-size:10px; font-weight:bold; color:#94a3b8; border:1px dashed #cbd5e1; padding:10px;">SIN LOGO</div>'}
              </div>
              <div class="inst-info">
                <h2>${nombreInst}</h2>
                <p><strong>Código AMIE:</strong> ${codigoAmie}</p>
                ${direccionInst ? `<p><strong>Dirección:</strong> ${direccionInst}</p>` : ''}
                <p>Sistema de Gestión Académica</p>
              </div>
            </div>

            <div class="doc-title">
              <h1>NOTIFICACIÓN DE INCIDENCIA COMPORTAMENTAL Y DISCIPLINARIA</h1>
            </div>

            <div class="meta-box">
              <div><strong>Nº de Esquela:</strong> ${numEsquela}</div>
              <div><strong>Fecha de Emisión:</strong> ${new Date(esquela.fecha).toLocaleString()}</div>
            </div>
            
            <div class="content">
              <div class="field"><strong>Estudiante:</strong> ${esquela.estudiantes?.apellidos} ${esquela.estudiantes?.nombres}</div>
              <div class="field"><strong>Curso / Paralelo:</strong> ${esquela.estudiantes?.grado_curso} "${esquela.estudiantes?.paralelo}"</div>
              <div class="field"><strong>Nivel de Gravedad:</strong> <span class="badge ${esquela.gravedad}">${esquela.gravedad}</span></div>
              <div class="field" style="margin-top: 15px;">
                <strong>Motivo / Descripción del Suceso:</strong>
                <div class="motivo-box">
                  ${esquela.motivo}
                </div>
              </div>
            </div>

            <div class="signatures">
              <div>
                <div class="sig-line">Inspector(a) General</div>
              </div>
              <div>
                <div class="sig-line">Padre / Representante Legal</div>
              </div>
            </div>

            <div class="footer-print">
              Documento generado digitalmente para notificación oficial al representante legal.
            </div>
          </div>

          <script>
            window.print();
          </script>
        </body>
      </html>
    `)
    ventana.document.close()
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans">
      
      {/* ENCABEZADO PRINCIPAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Gestión Disciplinaria
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Gestión de Esquelas
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Emite reportes disciplinarios formales para notificación inmediata a padres.
          </p>
        </div>
        
        <button 
          onClick={() => setModalAbierto(true)}
          style={{ backgroundColor: '#4b4c99' }}
          className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
        >
          + Emitir Nueva Esquela
        </button>
      </div>

      {mensaje && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-bold shadow-2xs">
          {mensaje}
        </div>
      )}

      {/* TABLA DE HISTORIAL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div 
          style={{ backgroundColor: '#4b4c99' }}
          className="p-4 text-xs font-bold uppercase text-white tracking-wider shadow-2xs"
        >
          Historial de Esquelas Emitidas
        </div>

        {cargando ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">Cargando registros...</div>
        ) : esquelas.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">No hay esquelas registradas en este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px]">Estudiante</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px]">Institución / AMIE</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px]">Curso</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px]">Gravedad</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px]">Motivo</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px]">Fecha</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 font-extrabold uppercase text-[10px] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {esquelas.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-800">
                      {item.estudiantes?.apellidos} {item.estudiantes?.nombres}
                    </td>
                    <td className="p-3.5 text-slate-600 font-medium">
                      {item.estudiantes?.instituciones?.nombre_institucion || 'N/A'} 
                      <span className="block text-[10px] text-slate-400">AMIE: {item.estudiantes?.instituciones?.codigo_amie || 'N/A'}</span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-700">{item.estudiantes?.grado_curso} "{item.estudiantes?.paralelo}"</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shadow-2xs ${
                        item.gravedad === 'Leve' ? 'bg-slate-100 text-slate-700' :
                        item.gravedad === 'Grave' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {item.gravedad}
                      </span>
                    </td>
                    <td className="p-3.5 max-w-xs truncate text-slate-600 font-medium">{item.motivo}</td>
                    <td className="p-3.5 text-slate-500">{new Date(item.fecha).toLocaleDateString()}</td>
                    <td className="p-3.5 text-center">
                      <button 
                        onClick={() => imprimirEsquela(item, index)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs shadow-2xs cursor-pointer"
                      >
                        Imprimir / Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA CREAR ESQUELA */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-4 shadow-xl border border-slate-200 font-sans">
            <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wide">
              Emitir Nueva Esquela Disciplinaria
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Selecciona al alumno y detalla la incidencia. Se generará un número de esquela institucional automático.
            </p>
            
            <form onSubmit={crearEsquela} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Estudiante</label>
                <select
                  required
                  value={estudianteIdSeleccionado}
                  onChange={(e) => setEstudianteIdSeleccionado(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
                >
                  <option value="" className="text-slate-900 font-bold bg-white">Selecciona un estudiante...</option>
                  {estudiantes.map((est) => (
                    <option key={est.id} value={est.id} className="text-slate-900 font-bold bg-white">
                      {est.apellidos} {est.nombres} ({est.grado_curso} "{est.paralelo}")
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Gravedad de la Falta</label>
                <select
                  value={gravedad}
                  onChange={(e) => setGravedad(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs cursor-pointer"
                >
                  <option value="Leve" className="text-slate-900 font-bold bg-white">Leve</option>
                  <option value="Grave" className="text-slate-900 font-bold bg-white">Grave</option>
                  <option value="Muy Grave" className="text-slate-900 font-bold bg-white">Muy Grave</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Motivo / Descripción de la Incidencia</label>
                <textarea
                  required
                  rows={4}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Atraso injustificado al ingreso a la institución, uso inadecuado del uniforme, etc."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 bg-white outline-none focus:border-[#4b4c99] focus:ring-1 focus:ring-[#4b4c99] shadow-2xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={enviando}
                  style={{ backgroundColor: '#4b4c99' }}
                  className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {enviando ? 'Guardando...' : 'Emitir y Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}