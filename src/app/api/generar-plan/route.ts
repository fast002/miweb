import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Inicializar cliente de DeepSeek
const deepseek = new OpenAI({ 
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

// Función centralizada optimizada para gastar mínimos tokens
async function generarConDeepSeek(promptText: string, maxTokens = 2500) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('Falta la clave DEEPSEEK_API_KEY en las variables de entorno.');
  }

  const completion = await deepseek.chat.completions.create({
    model: "deepseek-chat", 
    messages: [
      {
        role: "system",
        content: "Eres experto pedagógico del Ministerio de Educación de Ecuador. Responde EXCLUSIVAMENTE en formato JSON válido, sin bloques de código Markdown ni texto adicional."
      },
      {
        role: "user",
        content: promptText
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2, // Más bajo = respuestas más directas y menor consumo de tokens
    max_tokens: maxTokens, // Límite estricto de salida para gastar menos
  });

  return completion.choices[0].message.content || '{}';
}

export async function POST(req: Request) {
  try {
    const { 
      tipoModelo, 
      tema, 
      subnivel, 
      grado, 
      asignatura, 
      ejeTematico, 
      competenciasPrincipales,
      filasSaberes,
      noSemanas, 
      trimestre, 
      estructuraTematicaPrevia 
    } = await req.json()

    // VALIDACIÓN DE IDIOMA
    const esIngles = asignatura && (
      asignatura.toLowerCase().includes('inglés') || 
      asignatura.toLowerCase().includes('ingles') || 
      asignatura.toLowerCase().includes('foreign language')
    )
    
    const instruccionIdioma = esIngles 
      ? "CRITICAL: Subject is English. Generate ALL fields STRICTLY IN ENGLISH."
      : "Genera todo en español formal adaptado al currículo de Ecuador."

    let promptText = ''
    let jsonText = ''

    if (tipoModelo === 'multigrado_eje') {
      promptText = `
Genera planificación MULTIGRADO por EJE TEMÁTICO (Currículo por Competencias):
- Eje: "${ejeTematico || '1. El Yo y la Identidad'}"
- Subnivel: "${subnivel || 'Básica Media'}"
- Asignatura: "${asignatura || 'Lengua y Literatura'}"
- Tema: "${tema || 'Comprensión textual'}"

JSON exacto:
{
  "objetivos": "...",
  "criterios": "...",
  "grados": [{"grado": "5to Grado", "indicadores": "...", "orientaciones": "..."}],
  "evaluacion": "...",
  "adaptaciones": "..."
}`
      jsonText = await generarConDeepSeek(promptText, 1500)

    } else if (tipoModelo === 'estructura_tematica') {
      const saberesTexto = filasSaberes?.map((f: any, idx: number) => `
      - [${idx + 1}] Comp: "${f.competenciaFila || ''}" | Ind: "${f.indicador || ''}" | Dec: "${f.declarativo || ''}" | Proc: "${f.procedimental || ''}" | Act: "${f.actitudinal || ''}"
      `).join('\n') || 'Sin saberes'

      const totalSemanas = noSemanas || 8

      promptText = `
Estructura ${totalSemanas} temas secuenciados bajo Currículo por Competencias:
- Asignatura: "${asignatura}" | Grado: "${grado}" | Trimestre: "${trimestre || 'Trimestre 1'}"
- Datos:
${saberesTexto}
${instruccionIdioma}

JSON exacto con arreglo "temas" de ${totalSemanas} elementos:
{
  "temas": [
    {
      "orden": "Tema 1: Nombre",
      "subtitulo": "...",
      "indicadores": "...",
      "conceptual": "...",
      "procedimental": "...",
      "actitudinal": "..."
    }
  ]
}`
      jsonText = await generarConDeepSeek(promptText, 2000)

    } else if (tipoModelo === 'secuencia_copisi') {
      const saberesTexto = filasSaberes?.map((f: any, idx: number) => `
      - [${idx + 1}] Comp: "${f.competenciaFila || ''}" | Ind: "${f.indicador || ''}" | Dec: "${f.declarativo || ''}" | Proc: "${f.procedimental || ''}" | Act: "${f.actitudinal || ''}"
      `).join('\n') || 'Sin saberes'

      const totalSemanas = noSemanas || 8
      const contextoDatos = estructuraTematicaPrevia?.length > 0 ? JSON.stringify(estructuraTematicaPrevia) : saberesTexto

      promptText = `
Genera planificación trimestral ${totalSemanas} semanas (DUA y COPISI, Currículo por Competencias):
- Asignatura: "${asignatura}" | Subnivel: "${subnivel}" | Grado: "${grado}"
- Competencias: ${competenciasPrincipales?.join(', ') || 'Base'}
- Datos: ${contextoDatos}
${instruccionIdioma}

Requisitos: Cero campos vacíos, múltiples códigos de referencia (ej: Ref. M.3.1.d.1.), YouTube format en recursos.
JSON exacto con arreglo "semanas" de ${totalSemanas} elementos:
{
  "tituloSia": "...",
  "descripcionSia": "...",
  "asignaturasConexion": "...",
  "semanas": [
    {
      "numero": 1,
      "sugerenciasInicio": "[Principio DUA] ...",
      "sugerenciasDesarrollo": "[Principio DUA] ...",
      "sugerenciasCierre": "[Principio DUA] ...",
      "recursos": "- Video: [Tema](https://www.youtube.com/results?search_query=...) \\n - Web: [Sitio](https://...)",
      "tecnica": "...",
      "instrumento": "..."
    }
  ]
}`
      jsonText = await generarConDeepSeek(promptText, 4000)

    } else {
      promptText = `
Planificación disciplinar trimestral (Currículo por Competencias):
- Tema: "${tema || ''}" | Subnivel: "${subnivel || ''}" | Grado: "${grado || ''}" | Asignatura: "${asignatura || ''}"

JSON exacto:
{
  "objetivos": "...",
  "criterios": "...",
  "indicadores": "...",
  "estrategiasDua": "...",
  "recursos": "...",
  "evaluacion": "...",
  "adaptaciones": "..."
}`
      jsonText = await generarConDeepSeek(promptText, 1500)
    }

    const jsonLimpio = jsonText.replace(/```json/g, '').replace(/```/g, '').trim()
    return NextResponse.json(JSON.parse(jsonLimpio))

  } catch (error: any) {
    console.error('Error en API route DeepSeek:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}