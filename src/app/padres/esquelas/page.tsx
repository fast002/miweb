'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EsquelasRepresentantePage() {
  const router = useRouter()
  const [esquelas, setEsquelas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarEsquelasHijos()
  }, [])

  const cargarEsquelasHijos = async () => {
    try {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: vinculos, error: errVinculos } = await supabase
        .from('estudiante_representantes')
        .select('estudiante_id')
        .eq('user_id', user.id)
        .eq('activo', true)

      if (errVinculos || !vinculos || vinculos.length === 0) {
        setEsquelas([])
        setCargando(false)
        return
      }

      const estudianteIds = vinculos.map(v => v.estudiante_id).filter(Boolean)

      if (estudianteIds.length === 0) {
        setEsquelas([])
        setCargando(false)
        return
      }

      const { data: dataEsquelas, error: errEsquelas } = await supabase
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
        .in('estudiante_id', estudianteIds)
        .order('fecha', { ascending: false })

      if (errEsquelas) {
        console.error('Error al consultar esquelas:', errEsquelas.message)
      }

      if (dataEsquelas) {
        setEsquelas(dataEsquelas)
      }
    } catch (err) {
      console.error('Error al inicializar esquelas del representante:', err)
    } finally {
      setCargando(false)
    }
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
                <p>Sistema de Gestión Académica - EDUCAMET</p>
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

  if (cargando) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center font-sans selection:bg-[#4b4c99] selection:text-white">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4b4c99] border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cargando notificaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 selection:bg-[#4b4c99] selection:text-white font-sans max-w-7xl mx-auto">
      
      {/* ENCABEZADO */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="font-bold text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider border shadow-2xs inline-block mb-1.5"
          >
            Modo Consulta Familiar
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Notificaciones y Esquelas de Representados
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Consulte el historial de reportes disciplinarios emitidos para sus hijos.
          </p>
        </div>
      </div>

      {/* TABLA DE HISTORIAL EN MODO SOLO LECTURA */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Historial Disciplinario</h3>
          <span 
            style={{ color: '#4b4c99', backgroundColor: 'rgba(75, 76, 153, 0.08)', borderColor: 'rgba(75, 76, 153, 0.2)' }}
            className="text-[10px] font-bold px-3 py-1 rounded-xl uppercase border shadow-2xs"
          >
            Consulta Familiar
          </span>
        </div>

        {esquelas.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">
            No registra esquelas o notificaciones disciplinarias para sus hijos en este período.
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead className="bg-slate-50 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 border border-slate-200">Estudiante (Representado)</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 border border-slate-200">Institución</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 border border-slate-200">Curso</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 border border-slate-200 text-center">Gravedad</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 border border-slate-200">Motivo</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 border border-slate-200 text-center">Fecha</th>
                  <th style={{ color: '#4b4c99' }} className="p-3.5 border border-slate-200 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {esquelas.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 border border-slate-200 font-bold text-slate-800 whitespace-nowrap">
                      {item.estudiantes?.apellidos} {item.estudiantes?.nombres}
                    </td>
                    <td className="p-3.5 border border-slate-200 text-slate-600 font-semibold">
                      {item.estudiantes?.instituciones?.nombre_institucion || 'N/A'}
                    </td>
                    <td className="p-3.5 border border-slate-200 font-medium">{item.estudiantes?.grado_curso} "{item.estudiantes?.paralelo}"</td>
                    <td className="p-3.5 border border-slate-200 text-center">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase shadow-2xs inline-block ${
                        item.gravedad === 'Leve' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                        item.gravedad === 'Grave' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {item.gravedad}
                      </span>
                    </td>
                    <td className="p-3.5 border border-slate-200 max-w-xs truncate text-slate-600">{item.motivo}</td>
                    <td className="p-3.5 border border-slate-200 text-center text-slate-500">{new Date(item.fecha).toLocaleDateString()}</td>
                    <td className="p-3.5 border border-slate-200 text-center">
                      <button 
                        onClick={() => imprimirEsquela(item, index)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-[11px] cursor-pointer border border-slate-300 shadow-2xs"
                      >
                        🖨️ Ver / Imprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}