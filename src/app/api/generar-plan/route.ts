import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Tiempo máximo de ejecución en Next.js (5 minutos)
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// 1. Cliente principal: DeepSeek con timeout ajustado a 35 segundos
const deepseek = new OpenAI({ 
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com',
  timeout: 35000 // Si en 35s DeepSeek no responde, salta al fallback
});

// 2. Cliente de respaldo: OpenAI oficial
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Función centralizada con conmutación automática por fallo (Fallback)
async function generarConIA(promptText: string, maxTokens = 3800): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "Eres un planificador pedagógico experto del Ministerio de Educación de Ecuador. Responde ÚNICAMENTE en formato JSON válido, sin bloques de código Markdown (```json) ni introducciones."
    },
    {
      role: "user",
      content: promptText
    }
  ];

  // INTENTO 1: DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      console.log('⚡ Solicitando generación con DeepSeek...');
      const completion = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: maxTokens,
      });

      const contenido = completion.choices[0]?.message?.content;
      if (contenido && contenido.trim() !== '') {
        console.log('✅ Generación exitosa con DeepSeek');
        return contenido;
      }
    } catch (error: any) {
      console.warn(`⚠️ DeepSeek falló o tardó demasiado (${error.message || 'Timeout'}). Conmutando a OpenAI...`);
    }
  }

  // INTENTO 2 (FALLBACK): OpenAI GPT-4o-mini
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('🚀 Ejecutando con OpenAI (gpt-4o-mini)...');
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: maxTokens,
      });

      const contenido = completion.choices[0]?.message?.content;
      if (contenido && contenido.trim() !== '') {
        console.log('✅ Generación exitosa con OpenAI Backup');
        return contenido;
      }
    } catch (openaiError: any) {
      console.error('❌ Error en OpenAI Backup:', openaiError);
      throw new Error(`Error en OpenAI: ${openaiError.message}`);
    }
  }

  throw new Error('Todos los proveedores de IA fallaron o falta configurar OPENAI_API_KEY en tu .env.local');
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
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
      estructuraTematicaPrevia,
      bloquesManuales 
    } = body

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
      jsonText = await generarConIA(promptText, 1500)

    } else if (tipoModelo === 'estructura_tematica') {
      const saberesValidos = filasSaberes?.filter((f: any) => f && (f.indicador || f.declarativo || f.procedimental)) || []
      
      const saberesTexto = saberesValidos.map((f: any, idx: number) => `
-[${idx + 1}] Comp: "${f.competenciaFila || 'Competencia general'}" | Ind: "${f.indicador || 'N/A'}" | Dec: "${f.declarativo || 'N/A'}" | Proc: "${f.procedimental || 'N/A'}" | Act: "${f.actitudinal || 'N/A'}"
      `).join('\n') || 'Sin saberes específicos'

      promptText = `
Estructura temas secuenciados bajo Currículo por Competencias de Ecuador:
- Asignatura: "${asignatura || 'Matemática'}" | Grado: "${grado || '8vo Grado EGB'}" | Trimestre: "${trimestre || 'Trimestre 1'}"
- Datos de entrada seleccionados por el docente:
${saberesTexto}
${instruccionIdioma}

Regla estricta: Devuelve un objeto JSON que contenga una propiedad principal llamada "temas" que sea un arreglo con elementos que cubran secuencialmente los saberes proporcionados. Cada elemento debe tener exactamente estas llaves:
{
  "temas": [
    {
      "orden": "Tema 1: ...",
      "subtitulo": "...",
      "indicadores": "...",
      "conceptual": "...",
      "procedimental": "...",
      "actitudinal": "..."
    }
  ]
}`
      jsonText = await generarConIA(promptText, 3500)

    } else if (tipoModelo === 'secuencia_copisi') {
      const saberesTexto = filasSaberes?.map((f: any, idx: number) => `
-[${idx + 1}] Comp: "${f.competenciaFila || ''}" | Ind: "${f.indicador || ''}" | Dec: "${f.declarativo || ''}" | Proc: "${f.procedimental || ''}" | Act: "${f.actitudinal || ''}"
      `).join('\n') || 'Sin saberes'

      const totalSemanas = noSemanas || 8
      const contextoDatos = estructuraTematicaPrevia?.length > 0 ? JSON.stringify(estructuraTematicaPrevia) : saberesTexto

      promptText = `
Genera planificación trimestral ${totalSemanas} semanas (DUA y COPISI, Currículo por Competencias):
- Asignatura: "${asignatura}" | Subnivel: "${subnivel}" | Grado: "${grado}"
- Competencias: ${competenciasPrincipales?.join(', ') || 'Base'}
- Datos: 
${contextoDatos}
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
      jsonText = await generarConIA(promptText, 3500)
} else if (tipoModelo === 'secuencia_piloto_zona6') {
      const bloques = bloquesManuales || []
      
      // Extraemos la lista explícita de saberes declarativos disponibles y seleccionados
      const listaDeclarativosDisponibles: string[] = []
      const listaIndicadoresDisponibles: string[] = []

      const resumenBloques = bloques.map((b: any, idx: number) => {
        const inds = b.indicadoresSeleccionados?.length > 0 ? b.indicadoresSeleccionados : (b.indicadoresDisponibles || [])
        const decs = b.declarativosSeleccionados?.length > 0 ? b.declarativosSeleccionados : (b.declarativosDisponibles || [])
        const procs = b.procedimentalesSeleccionados?.length > 0 ? b.procedimentalesSeleccionados : (b.procedimentalesDisponibles || [])
        const acts = b.actitudinalesSeleccionados?.length > 0 ? b.actitudinalesSeleccionados : (b.actitudinalesDisponibles || [])

        decs.forEach((d: string) => { if (d && !listaDeclarativosDisponibles.includes(d)) listaDeclarativosDisponibles.push(d) })
        inds.forEach((i: string) => { if (i && !listaIndicadoresDisponibles.includes(i)) listaIndicadoresDisponibles.push(i) })

        return `Bloque #${idx + 1} (Competencia: "${b.competencia || 'General'}"):
- Indicadores disponibles/seleccionados: ${inds.join(' | ') || 'N/A'}
- Saberes Declarativos (TEMAS A DISTRIBUIR): ${decs.join(' | ') || 'N/A'}
- Saberes Procedimentales (Metodología cómo dar la clase): ${procs.join(' | ') || 'N/A'}
- Saberes Actitudinales (Valores y convivencia en clase): ${acts.join(' | ') || 'N/A'}`
      }).join('\n\n')

      const totalSemanas = Number(noSemanas) || 7
      const esIngles = String(asignatura).toLowerCase().includes('inglés') || String(asignatura).toLowerCase().includes('ingles') || String(asignatura).toLowerCase().includes('english')
      const esLengua = String(asignatura).toLowerCase().includes('lengua')

      const instruccionEnfoque = esIngles 
        ? "CRITICAL REQUIREMENT: Generate ALL text in ENGLISH, structuring tasks around the 4 macro-skills (Listening, Speaking, Reading, Writing)." 
        : esLengua 
        ? "REQUISITO OBLIGATORIO: Estructura las actividades en torno a las macrodestrezas de Lengua y Literatura: Hablar, Escuchar, Leer y Escribir." 
        : ""

      promptText = `Eres especialista curricular del Ministerio de Educación de Ecuador (Piloto Zona 6, DUA y metodología ERCA).
Diseña una planificación microcurricular secuenciada cronológicamente de ${totalSemanas} semanas.
- Asignatura: "${asignatura}" | Subnivel: "${subnivel}" | Grado: "${grado}" | Trimestre: "${trimestre}"
${instruccionEnfoque}

CURRÍCULO BASE Y SABERES CARGADOS DESDE LA MATRIZ OFICIAL:
${resumenBloques}

LISTA DE SABERES DECLARATIVOS (TEMAS OFICIALES):
${listaDeclarativosDisponibles.length > 0 ? listaDeclarativosDisponibles.map((t, i) => `${i + 1}.${t}`).join('\n') : 'Distribuir temas según la competencia seleccionada'}

LISTA DE INDICADORES:
${listaIndicadoresDisponibles.length > 0 ? listaIndicadoresDisponibles.join(' | ') : 'Asignar indicador oficial correspondiente'}

REGLAS OBLIGATORIAS PARA CADA UNA DE LAS ${totalSemanas} SEMANAS:
1. 'temaSemana': DEBE SER OBLIGATORIAMENTE un saber declarativo de la lista anterior (el tema específico de esa clase, NO el título general del proyecto ni de la unidad). Distribuye los saberes declarativos cronológicamente semana a semana. Si un saber declarativo es extenso o hay pocos temas, abórdalo a profundidad en 2 semanas consecutivas (ej. "Los conjuntos: universo y elementos" en una semana y "Subconjuntos y agrupación" en la siguiente).
2. 'codigoIndicador': Asigna el código oficial exacto del indicador del currículo que evalúa el tema de esa semana (ej: "I.M.2.1.1"). PROHIBIDO inventar códigos o poner genéricos como 'I.M.2.1.X'.
3. 'sugerenciasInicio', 'sugerenciasDesarrollo', 'sugerenciasCierre': Desarrolla actividades pedagógicas completas para cubrir la carga horaria semanal:
   - Los saberes procedimentales definen la metodología paso a paso en el desarrollo (manipulación de material concreto, modelado, ejercitación, trabajo colaborativo).
   - Los saberes actitudinales se reflejan en el trabajo en equipo y las preguntas de reflexión del cierre.

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "tituloSia": "Título llamativo para la situación de aprendizaje trimestral",
  "descripcionSia": "Descripción contextualizada del trimestre",
  "asignaturasConexion": "Conexión interdisciplinar sugerida",
  "semanas": [
    {
      "numero": 1,
      "temaSemana": "Nombre del Saber Declarativo concreto a impartir",
      "codigoIndicador": "I.M.2.1.1",
      "sugerenciasInicio": "- Actividad motivadora DUA vinculada a la experiencia previa...\\n- Pregunta retadora...",
      "sugerenciasDesarrollo": "- Modelado del docente del contenido...\\n- Práctica guiada con material concreto según los saberes procedimentales...\\n- Trabajo en parejas o colaborativo...",
      "sugerenciasCierre": "- Presentación de la evidencia elaborada...\\n- Preguntas de reflexión metacognitiva según los saberes actitudinales...",
      "recursos": "Material concreto, fichas de trabajo, papelotes, cuadernos.",
      "tecnica": "Observación sistemática",
      "instrumento": "Lista de cotejo"
    }
  ]
}`

      jsonText = await generarConIA(promptText, 3800)

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
      jsonText = await generarConIA(promptText, 1500)
    }

    const jsonLimpio = jsonText.replace(/```json/g, '').replace(/```/g, '').trim()
    const objetoParseado = JSON.parse(jsonLimpio)
    
    return NextResponse.json(objetoParseado)

  } catch (error: any) {
    console.error('Error en API route IA:', error)
    return NextResponse.json({ error: error.message || 'Error interno al procesar con la IA' }, { status: 500 })
  }
}