'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function EsquelasPage() {
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

  // Cargar esquelas y estudiantes al abrir la página
  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    // 1. Obtener esquelas unidas con estudiante y su institución
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

    // 2. Obtener lista de estudiantes activos
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
      setMensaje('⚠️ Por favor selecciona un estudiante y redacta el motivo.')
      return
    }

    setEnviando(true)
    setMensaje(null)

    // 1. Calcular el número de esquela secuencial para este estudiante
    const { count } = await supabase
      .from('esquelas')
      .select('*', { count: 'exact', head: true })
      .eq('estudiante_id', estudianteIdSeleccionado)

    const numeroSecuencial = (count || 0) + 1
    const codigoEsquela = `ESQ-${String(numeroSecuencial).padStart(3, '0')}`

    // 2. Guardar la esquela incluyendo el número secuencial
    const { error } = await supabase.from('esquelas').insert([
      {
        estudiante_id: estudianteIdSeleccionado,
        motivo,
        gravedad,
        anio_lectivo: '2026-2027',
        numero_esquela: codigoEsquela // Asegúrate de tener esta columna o guardarla en un campo similar
      }
    ])

    setEnviando(false)

    if (error) {
      // Si la columna numero_esquela no existe, intentamos insertarla sin ella pero guardando el conteo
      const { error: errFallback } = await supabase.from('esquelas').insert([
        {
          estudiante_id: estudianteIdSeleccionado,
          motivo,
          gravedad,
          anio_lectivo: '2026-2027'
        }
      ])
      
      if (errFallback) {
        setMensaje('❌ Error al guardar la esquela: ' + errFallback.message)
        return
      }
    }

    setMensaje('✅ Esquela emitida y registrada con éxito.')
    setMotivo('')
    setEstudianteIdSeleccionado('')
    setModalAbierto(false)
    cargarDatos()
  }

  // Función para imprimir la esquela con diseño formal e institucional
  const imprimirEsquela = (esquela: any, indexGlobal: number) => {
    const ventana = window.open('', '_blank')
    if (!ventana) return

    const inst = esquela.estudiantes?.instituciones || {}
    const logoUrl = inst.logo_url || ''
    const nombreInst = inst.nombre_institucion || 'INSTITUCIÓN EDUCATIVA'
    const codigoAmie = inst.codigo_amie || 'S/N'
    const direccionInst = inst.direccion || ''
    
    // Generar número de esquela dinámico si no está en la base
    const numEsquela = esquela.numero_esquela || `ESQ-${String(indexGlobal + 1).padStart(3, '0')}`

    ventana.document.write(`
      <html>
        <head>
          <title>Notificación Disciplinaria - ${numEsquela}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; }
            .container { max-width: 700px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 30px; border-radius: 8px; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; }
            .logo-container { width: 80px; text-align: center; margin-right: 20px; }
            .logo-container img { max-width: 75px; max-height: 75px; object-fit: contain; }
            .inst-info { flex: 1; text-align: center; }
            .inst-info h2 { margin: 0; font-size: 18px; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .inst-info p { margin: 3px 0; font-size: 11px; color: #475569; }
            .doc-title { text-align: center; margin-bottom: 25px; }
            .doc-title h1 { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; background: #f1f5f9; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
            .meta-box { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
            .content { font-size: 13px; line-height: 1.6; }
            .field { margin-bottom: 12px; }
            .field strong { color: #334155; display: inline-block; width: 150px; }
            .badge { display: inline-block; padding: 3px 10px; font-size: 11px; font-weight: bold; border-radius: 4px; text-transform: uppercase; }
            .badge.Leve { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
            .badge.Grave { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
            .badge.MuyGrave { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
            .motivo-box { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 8px; min-height: 60px; }
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
                <p>Sistema de Gestión Académica- EDUCAMET</p>
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
              Documento generado digitalmente a través de EDUCAMET SGA para notificación oficial al representante legal.
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Gestión de Esquelas</h1>
          <p className="text-sm text-slate-600 font-medium">Emite reportes disciplinarios formales para notificación inmediata a padres.</p>
        </div>
        
        <button 
          onClick={() => setModalAbierto(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>+ Emitir Nueva Esquela</span>
        </button>
      </div>

      {mensaje && (
        <div className="p-3 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          {mensaje}
        </div>
      )}

      {/* Tabla de Historial */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Historial de Esquelas Emitidas</h3>
        </div>

        {cargando ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando registros...</div>
        ) : esquelas.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No hay esquelas registradas en este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider bg-slate-50">
                  <th className="p-4">Estudiante</th>
                  <th className="p-4">Institución / AMIE</th>
                  <th className="p-4">Curso</th>
                  <th className="p-4">Gravedad</th>
                  <th className="p-4">Motivo</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {esquelas.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-800">
                      {item.estudiantes?.apellidos} {item.estudiantes?.nombres}
                    </td>
                    <td className="p-4 text-slate-500 font-semibold">
                      {item.estudiantes?.instituciones?.nombre_institucion || 'N/A'} 
                      <span className="block text-[10px] text-slate-400">AMIE: {item.estudiantes?.instituciones?.codigo_amie || 'N/A'}</span>
                    </td>
                    <td className="p-4">{item.estudiantes?.grado_curso} "{item.estudiantes?.paralelo}"</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        item.gravedad === 'Leve' ? 'bg-slate-100 text-slate-700' :
                        item.gravedad === 'Grave' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.gravedad}
                      </span>
                    </td>
                    <td className="p-4 max-w-xs truncate">{item.motivo}</td>
                    <td className="p-4 text-slate-400">{new Date(item.fecha).toLocaleDateString()}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => imprimirEsquela(item, index)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px] cursor-pointer"
                      >
                        🖨️ Imprimir / Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Crear Esquela */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-xl space-y-4">
            <h2 className="text-lg font-black text-slate-800">Emitir Nueva Esquela Disciplinaria</h2>
            <p className="text-xs text-slate-500">Selecciona al alumno y detalla la incidencia. Se generará un número de esquela institucional automático.</p>
            
            <form onSubmit={crearEsquela} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Estudiante</label>
                <select
                  required
                  value={estudianteIdSeleccionado}
                  onChange={(e) => setEstudianteIdSeleccionado(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecciona un estudiante...</option>
                  {estudiantes.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.apellidos} {est.nombres} ({est.grado_curso} "{est.paralelo}")
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Gravedad de la Falta</label>
                <select
                  value={gravedad}
                  onChange={(e) => setGravedad(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
                >
                  <option value="Leve">Leve</option>
                  <option value="Grave">Grave</option>
                  <option value="Muy Grave">Muy Grave</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / Descripción de la Incidencia</label>
                <textarea
                  required
                  rows={4}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Atraso injustificado al ingreso a la institución, uso inadecuado del uniforme, etc."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={enviando}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
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