import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const deepseek = new OpenAI({ 
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com',
  timeout: 110000
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

async function generarConIA(promptText: string, maxTokens = 8800): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "Eres un Especialista en Diseño Microcurricular del Ministerio de Educación de Ecuador (Distrito 03D01). Tu objetivo es redactar Proyectos Interdisciplinares donde cada asignatura trabaja sus propios saberes declarativos, procedimentales y actitudinales para construir una sección física/tangible de un MISMO Producto Final común. Prohibido usar frases genéricas: nombra las fórmulas, conceptos técnicos, leyes o textos exactos del saber seleccionado y vincula las rúbricas directamente con las tareas realizadas. Responde ÚNICAMENTE en JSON válido sin bloques markdown."
    },
    {
      role: "user",
      content: promptText
    }
  ];

  if (process.env.DEEPSEEK_API_KEY) {
    try {
      console.log('⚡ Solicitando generación pedagógica con DeepSeek...');
      const completion = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: maxTokens,
      });

      const contenido = completion.choices[0]?.message?.content;
      if (contenido && contenido.trim() !== '') {
        return contenido;
      }
    } catch (error: any) {
      console.warn(`⚠️ DeepSeek falló (${error.message}). Conmutando a OpenAI Backup...`);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('🚀 Ejecutando con OpenAI Backup (gpt-4o-mini)...');
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: maxTokens,
      });

      const contenido = completion.choices[0]?.message?.content;
      if (contenido && contenido.trim() !== '') {
        return contenido;
      }
    } catch (openaiError: any) {
      console.error('❌ Error en OpenAI Backup:', openaiError);
      throw new Error(`Error en OpenAI: ${openaiError.message}`);
    }
  }

  throw new Error('No se pudo conectar con ningún proveedor de IA.');
}

// Limpia el código ministerial inicial (ej. "CN.4.1.d.20. Ecosistemas..." -> "Ecosistemas...") para insertarlo fluidamente en la redacción
function limpiarCodigoCurricular(texto: string): string {
  if (!texto) return ''
  return texto
    .replace(/^(?:Ref\.\s*)?(?:I\.[A-Z]{1,4}|SC\.CE\.[A-Z]{1,4}|CE\.[A-Z]{1,4}|[A-Z]{1,4})\.\d+(?:\.[0-9a-z]+)*\.?\s*/i, '')
    .trim()
}

// Generador de contingencia con el formato exacto de las capturas (2 viñetas con guion por fase)
function construirActividadesDesdeSaberesReales(
  asig: string,
  compTexto: string,
  decs: string[],
  procs: string[],
  acts: string[],
  tituloProyecto: string,
  desafioProyecto: string,
  productoFinal: string
) {
  const norm = asig.toUpperCase()
  const esIngles = norm.includes('INGLÉS') || norm.includes('ENGLISH') || norm.includes('EXTRANJERO') || norm.includes('EFL')

  const saberDecRaw = decs[0] || `los contenidos esenciales de ${asig}`
  const saberDecLimpio = limpiarCodigoCurricular(saberDecRaw) || saberDecRaw
  const saberProcRaw = procs[0] || `la aplicación práctica de ${asig}`
  const saberProcLimpio = limpiarCodigoCurricular(saberProcRaw) || saberProcRaw
  const saberActRaw = acts[0] || `la responsabilidad y honestidad académica`
  const saberActLimpio = limpiarCodigoCurricular(saberActRaw) || saberActRaw

  if (esIngles) {
    return [
      {
        fase_titulo: "PLANIFICACIÓN (Semana 1)",
        pregunta_orientadora: `How can we apply "${saberDecLimpio}" in English to solve our project challenge?`,
        actividades: `- Present the communicative challenge in teams: analyze "${saberDecLimpio}" within the context of the project "${tituloProyecto}".\n\n- Form working trios and socialize the handwritten or printed presentation criteria for the English section of the "${productoFinal}".`,
        recursos: "Whiteboard, markers, workbook, physical folder for the product."
      },
      {
        fase_titulo: "2.- Organización o investigación (Semana 1)",
        pregunta_orientadora: `How do we investigate and organize information using "${saberProcLimpio}"?`,
        actividades: `- Investigate key vocabulary, grammar structures, and examples related to "${saberDecLimpio}" and "${saberProcLimpio}".\n\n- Distribute roles within the trio (vocabulary verifier, drafter, and illustrator of the physical technical sheet for the "${productoFinal}").`,
        recursos: "English textbook, bilingual dictionary, perforated sheets."
      },
      {
        fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
        pregunta_orientadora: `How do we build the English section for the "${productoFinal}"?`,
        actividades: `- Draft and illustrate step-by-step on a letterhead sheet 3 contextualized communicative proposals applying "${saberProcLimpio}".\n\n- Attach the complete, reviewed, and organized English sheet into the corresponding section of the "${productoFinal}".`,
        recursos: "Grid/lined resolution sheets, colored markers, physical binder/product."
      },
      {
        fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
        pregunta_orientadora: `How do we orally present our English section of the "${productoFinal}"?`,
        actividades: `- Present and explain verbally in front of the class the English findings and messages during the exhibition of the "${productoFinal}".`,
        recursos: `Physical "${productoFinal}" in the English section.`
      },
      {
        fase_titulo: "5. Evaluación, reflexión y metacognición",
        pregunta_orientadora: `Why is "${saberActLimpio}" important when communicating in English?`,
        actividades: `- Analytical evaluation rubric verifying grammatical accuracy, vocabulary use, and clean presentation in the "${productoFinal}".\n\n- Write a brief reflection in the portfolio/product about the usefulness of "${saberDecLimpio}" and "${saberActLimpio}" in real-life situations.`,
        recursos: "Evaluation instrument (analytical rubric), self-assessment metacognition sheet."
      }
    ]
  }

  return [
    {
      fase_titulo: "PLANIFICACIÓN (Semana 1)",
      pregunta_orientadora: `¿Cómo aplicamos ${saberDecLimpio} desde ${asig} para responder al desafío del proyecto?`,
      actividades: `- Presentar el desafío disciplinar de ${asig}: analizar casos prácticos aplicando ${saberDecLimpio} en el contexto del proyecto "${tituloProyecto}".\n\n- Formar los tríos de trabajo y socializar los criterios de presentación manuscrita o impresa para la ficha o sección de ${asig} dentro del "${productoFinal}".`,
      recursos: "Pizarra, marcador, cuaderno de trabajo, carpeta o soporte físico del producto."
    },
    {
      fase_titulo: "2.- Organización o investigación (Semana 1)",
      pregunta_orientadora: `¿Cómo indagamos los fundamentos de ${saberDecLimpio} y distribuimos roles en el equipo?`,
      actividades: `- Investigar los fundamentos teóricos, propiedades o estructura de ${saberDecLimpio} y ${saberProcLimpio}.\n\n- Distribuir roles específicos en el trío (verificador de contenidos/datos, analista práctico y redactor de la ficha técnica física para el "${productoFinal}").`,
      recursos: `Libros de texto de ${asig}, hojas perforadas, material de consulta escolar.`
    },
    {
      fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
      pregunta_orientadora: `¿Cómo elaboramos e integramos el aporte técnico de ${asig} en el "${productoFinal}"?`,
      actividades: `- Plantear y desarrollar paso a paso en una hoja membretada o formato físico los ejercicios, análisis o registros contextualizados aplicando ${saberProcLimpio}.\n\n- Adjuntar la producción completa, verificada y ordenada en la sección de ${asig} del "${productoFinal}".`,
      recursos: `Hojas de trabajo a cuadros/líneas, regla, esferográficos, archivador o soporte del "${productoFinal}".`
    },
    {
      fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
      pregunta_orientadora: `¿Cómo sustentamos verbalmente los resultados de ${asig} integrados en el producto?`,
      actividades: `- Presentar y explicar verbalmente ante la clase la solución, análisis o propuesta desarrollada en la sección de ${asig} durante la exhibición del "${productoFinal}".`,
      recursos: `"${productoFinal}" en la sección correspondiente a ${asig}.`
    },
    {
      fase_titulo: "5. Evaluación, reflexión y metacognición",
      pregunta_orientadora: `¿De qué manera el aprendizaje de ${saberDecLimpio} aporta a las decisiones reales de nuestro entorno?`,
      actividades: `- Evaluación con rúbrica analítica de ${asig} para verificar la precisión técnica de ${saberProcLimpio} y la presentación limpia en el "${productoFinal}".\n\n- Redactar una breve reflexión en el "${productoFinal}" sobre la utilidad práctica de ${saberDecLimpio} y la importancia de practicar: ${saberActLimpio}.`,
      recursos: `Instrumento de evaluación (rúbrica analítica de ${asig}), ficha de metacognición.`
    }
  ]
}

// Generador de contingencia para la Rúbrica Analítica vinculada 100% a las actividades de las 5 fases
function construirRubricaDisciplinarEspecifica(
  asig: string,
  inds: string[],
  decs: string[],
  procs: string[],
  acts: string[],
  productoFinal: string
) {
  const norm = asig.toUpperCase()
  const esIngles = norm.includes('INGLÉS') || norm.includes('ENGLISH') || norm.includes('EXTRANJERO') || norm.includes('EFL')

  const indPrincipal = limpiarCodigoCurricular(inds[0] || '') || `el indicador de evaluación de ${asig}`
  const decPrincipal = limpiarCodigoCurricular(decs[0] || '') || `los conceptos de ${asig}`
  const procPrincipal = limpiarCodigoCurricular(procs[0] || '') || `los procedimientos de ${asig}`
  const actPrincipal = limpiarCodigoCurricular(acts[0] || '') || `el trabajo cooperativo y ético`

  if (esIngles) {
    return [
      {
        criterio: `1. Research & Conceptual Understanding (${decPrincipal.substring(0, 45)})`,
        destacado: `Thoroughly investigates and explains "${decPrincipal}" in Fase 1 and Fase 2 without conceptual errors.`,
        esperado: `Investigates and explains most concepts of "${decPrincipal}" accurately.`,
        proceso: `Identifies partial information about "${decPrincipal}" with some inaccuracies.`,
        apoyo: `Requires teacher assistance to understand basic concepts of "${decPrincipal}".`
      },
      {
        criterio: `2. Practical Execution & Accuracy (${procPrincipal.substring(0, 45)})`,
        destacado: `Develops the 3 contextualized exercises/proposals in Fase 3 applying "${procPrincipal}" with full grammatical and technical precision.`,
        esperado: `Develops the exercises/proposals applying "${procPrincipal}" with minor errors.`,
        proceso: `Presents incomplete exercises or frequent errors when applying "${procPrincipal}".`,
        apoyo: `Needs step-by-step guidance to complete the practical sheet in Fase 3.`
      },
      {
        criterio: `3. Achievement of Indicator (${indPrincipal.substring(0, 42)})`,
        destacado: `Fully evidences the evaluation indicator "${indPrincipal}" throughout the English section.`,
        esperado: `Satisfactorily meets the evaluation indicator "${indPrincipal}".`,
        proceso: `Partially evidences the achievement indicator in the submitted work.`,
        apoyo: `Does not yet evidence the minimum standard required by the indicator.`
      },
      {
        criterio: `4. Presentation in the "${productoFinal.substring(0, 35)}" & Oral Defense`,
        destacado: `Attaches a clean, well-organized English section in the "${productoFinal}" and explains it fluently in Fase 4.`,
        esperado: `Attaches a complete English section in the "${productoFinal}" and explains it clearly.`,
        proceso: `The attached section in the "${productoFinal}" is disorganized or the oral explanation is hesitant.`,
        apoyo: `Does not attach the complete section or requires total support during the oral presentation.`
      },
      {
        criterio: `5. Teamwork Roles & Metacognition (${actPrincipal.substring(0, 42)})`,
        destacado: `Fulfills assigned trio roles responsibly, practices "${actPrincipal}", and writes a deep reflection in Fase 5.`,
        esperado: `Fulfills trio roles and writes an adequate metacognitive reflection in Fase 5.`,
        proceso: `Participates inconsistently in the trio or writes a superficial reflection.`,
        apoyo: `Requires constant supervision to fulfill team roles and complete the reflection.`
      }
    ]
  }

  return [
    {
      criterio: `1. Indagación y Dominio Conceptual (${decPrincipal.substring(0, 48)})`,
      destacado: `Investiga y fundamenta con total rigor las propiedades y conceptos de "${decPrincipal}" en las Fases 1 y 2.`,
      esperado: `Investiga y comprende adecuadamente los conceptos principales de "${decPrincipal}".`,
      proceso: `Registra información parcial o con imprecisiones conceptuales sobre "${decPrincipal}".`,
      apoyo: `Requiere acompañamiento personalizado para identificar los conceptos básicos de ${asig}.`
    },
    {
      criterio: `2. Resolución y Precisión Procedimental (${procPrincipal.substring(0, 45)})`,
      destacado: `Plantea y desarrolla paso a paso los ejercicios, registros o análisis de la Fase 3 aplicando "${procPrincipal}" sin errores.`,
      esperado: `Desarrolla correctamente la mayoría de ejercicios o registros aplicando "${procPrincipal}".`,
      proceso: `Desarrolla de manera incompleta los ejercicios o presenta errores al aplicar "${procPrincipal}".`,
      apoyo: `Necesita guía permanente para resolver las actividades prácticas de la Fase 3.`
    },
    {
      criterio: `3. Cumplimiento del Indicador (${indPrincipal.substring(0, 45)})`,
      destacado: `Demuestra de forma sobresaliente el desempeño exigido en el indicador: "${indPrincipal}".`,
      esperado: `Alcanza satisfactoriamente el desempeño establecido en el indicador de evaluación.`,
      proceso: `Evidencia un logro parcial del indicador de evaluación en sus producciones.`,
      apoyo: `Aún no evidencia el nivel mínimo requerido en el indicador de ${asig}.`
    },
    {
      criterio: `4. Calidad de la Sección en "${productoFinal.substring(0, 32)}" y Sustentación`,
      destacado: `Adjunta la hoja/ficha técnica limpia, ordenada y verificada en la sección de ${asig} del "${productoFinal}" y la explica con solvencia en la Fase 4.`,
      esperado: `Adjunta la sección completa en el "${productoFinal}" y explica adecuadamente su resolución ante la clase.`,
      proceso: `Entrega la sección de ${asig} desordenada o presenta dudas al explicarla en la exhibición.`,
      apoyo: `Requiere apoyo directo para organizar e integrar su sección dentro del "${productoFinal}".`
    },
    {
      criterio: `5. Roles en el Trío y Reflexión Metacognitiva (${actPrincipal.substring(0, 40)})`,
      destacado: `Cumple con excelencia su rol en el trío de trabajo, evidencia "${actPrincipal}" y redacta con criterio la reflexión de la Fase 5.`,
      esperado: `Cumple su rol asignado en el trío y redacta la reflexión metacognitiva en el producto.`,
      proceso: `Participa de forma intermitente en el trío y redacta una reflexión superficial.`,
      apoyo: `Requiere mediación continua del docente para asumir su rol y completar la autoevaluación.`
    }
  ]
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { 
      tipo,
      tipoModelo, 
      tema, 
      subnivel, 
      grado, 
      grado_curso,
      asignatura, 
      ejeTematico, 
      competenciasPrincipales,
      filasSaberes,
      noSemanas, 
      numero_semanas,
      trimestre, 
      paralelo,
      titulo,
      situacion_aprendizaje,
      desafio,
      producto,
      materias_participantes,
      competencias_a_evaluar,
      desglose_curricular_interdisciplinar,
      docente_id,
      institucion_id,
      anio_lectivo,
      estructuraTematicaPrevia,
      bloquesManuales 
    } = body

    const gradoFinal = grado || grado_curso || '8vo Grado EGB'
    const semanasFinal = Number(numero_semanas || noSemanas || 2)

    // =========================================================================
    // 1. AUTOCOMPLETADO DE ESTRUCTURA DEL PROYECTO (CONSERVADO INTACTO)
    // =========================================================================
    if (tipo === 'sugerir_estructura_proyecto') {
      const promptEstructura = `
Genera una propuesta integradora para la estructura de un Proyecto Interdisciplinar en Ecuador:
- Nivel: "${subnivel || 'Básica Media'}" | Grado: "${gradoFinal}"
- Trimestre: "${trimestre || '1'}" | Duración: ${semanasFinal} semanas
- Asignaturas: ${materias_participantes?.join(', ') || 'Tronco común'}
- Competencias: ${JSON.stringify(body.competencias_seleccionadas || [])}

Responde ÚNICAMENTE un JSON con:
{
  "titulo": "Título atractivo y pedagógico",
  "situacion_aprendizaje": "Descripción contextualizada del aula",
  "desafio": "¿Pregunta retadora orientadora?",
  "producto": "Producto tangible final integrador"
}`

      try {
        const resIa = await generarConIA(promptEstructura, 1200)
        const parsed = JSON.parse(resIa.replace(/```json/g, '').replace(/```/g, '').trim())
        return NextResponse.json(parsed)
      } catch (e) {
        return NextResponse.json({
          titulo: titulo || `Conectados con nuestro Bienestar`,
          situacion_aprendizaje: situacion_aprendizaje || `En el aula se ha observado la necesidad de integrar saberes para resolver problemáticas del entorno.`,
          desafio: desafio || `¿Cómo podemos investigar e integrar conocimientos de diferentes asignaturas para proponer soluciones viables?`,
          producto: producto || `Portafolio Integrado Físico`
        })
      }
    }

    // =========================================================================
    // 2. PROYECTO INTERDISCIPLINAR COMPLETO (ESTILO OFICIAL DISTRITO 03D01)
    // =========================================================================
    if (tipo === 'cnc_proyecto' || tipoModelo === 'cnc_proyecto') {
      const materiasLista = (materias_participantes && materias_participantes.length > 0) 
        ? materias_participantes 
        : ['Matemática', 'Lengua y Literatura', 'Ciencias Naturales', 'Estudios Sociales']

      const desgloseSeguro: any[] = Array.isArray(desglose_curricular_interdisciplinar) && desglose_curricular_interdisciplinar.length > 0
        ? desglose_curricular_interdisciplinar
        : materiasLista.map((m: string) => {
            const compObj = competencias_a_evaluar?.find((c: any) => c.asignatura === m)
            return {
              asignatura: m,
              competencia: compObj?.competencia || `Desarrollar y aplicar destrezas de ${m} orientadas al proyecto.`,
              indicadores: compObj?.indicadores_disponibles || [],
              declarativos: compObj?.declarativos_disponibles || [],
              procedimentales: compObj?.procedimentales_disponibles || [],
              actitudinales: compObj?.actitudinales_disponibles || []
            }
          })

      // Matriz Curricular Oficial inmutable con los saberes exactos seleccionados 1 a 1
      const matrizCurricularOficial = materiasLista.map((m: string) => {
        const itemDesglose = desgloseSeguro.find(d => d.asignatura.toUpperCase() === m.toUpperCase())
        const itemComp = competencias_a_evaluar?.find((c: any) => c.asignatura.toUpperCase() === m.toUpperCase())

        const inds = Array.isArray(itemDesglose?.indicadores) && itemDesglose.indicadores.length > 0 
          ? itemDesglose.indicadores.join('\n') 
          : (Array.isArray(itemComp?.indicadores_disponibles) ? itemComp.indicadores_disponibles.join('\n') : (itemComp?.indicador || ''))

        const decs = Array.isArray(itemDesglose?.declarativos) && itemDesglose.declarativos.length > 0 
          ? itemDesglose.declarativos.join('\n') 
          : (Array.isArray(itemComp?.declarativos_disponibles) ? itemComp.declarativos_disponibles.join('\n') : (itemComp?.declarativo || ''))

        const procs = Array.isArray(itemDesglose?.procedimentales) && itemDesglose.procedimentales.length > 0 
          ? itemDesglose.procedimentales.join('\n') 
          : (Array.isArray(itemComp?.procedimentales_disponibles) ? itemComp.procedimentales_disponibles.join('\n') : (itemComp?.procedimental || ''))

        const acts = Array.isArray(itemDesglose?.actitudinales) && itemDesglose.actitudinales.length > 0 
          ? itemDesglose.actitudinales.join('\n') 
          : (Array.isArray(itemComp?.actitudinales_disponibles) ? itemComp.actitudinales_disponibles.join('\n') : (itemComp?.actitudinal || ''))

        return {
          asignatura: m,
          competencias_especificas: itemDesglose?.competencia || itemComp?.competencia || `Competencia oficial de ${m}`,
          indicadores_evaluacion: inds,
          saberes_declarativos: decs,
          saberes_procedimentales: procs,
          saberes_actitudinales: acts
        }
      })

      // Desglose explícito materia por materia para inyectar al prompt
      const desgloseCurricularDetallado = desgloseSeguro.map((d: any, idx: number) => `
===================================================================
MATERIA #${idx + 1}: ${d.asignatura.toUpperCase()}
===================================================================
• COMPETENCIA SELECCIONADA: "${d.competencia}"
• INDICADORES DE EVALUACIÓN SELECCIONADOS:
  ${Array.isArray(d.indicadores) && d.indicadores.length > 0 ? d.indicadores.join('\n  ') : 'Aplicar indicador oficial de la competencia'}
• SABERES DECLARATIVOS SELECCIONADOS (Temas/conceptos exactos que DEBEN aparecer en las actividades):
  ${Array.isArray(d.declarativos) && d.declarativos.length > 0 ? d.declarativos.join('\n  ') : 'Conceptos disciplinares de la materia'}
• SABERES PROCEDIMENTALES SELECCIONADOS (Acciones técnicas que DEBEN hacer en Fase 2 y Fase 3):
  ${Array.isArray(d.procedimentales) && d.procedimentales.length > 0 ? d.procedimentales.join('\n  ') : 'Procedimientos prácticos de la materia'}
• SABERES ACTITUDINALES SELECCIONADOS (Valores a evaluar en Fase 5 y Rúbrica):
  ${Array.isArray(d.actitudinales) && d.actitudinales.length > 0 ? d.actitudinales.join('\n  ') : 'Trabajo colaborativo y honestidad académica'}
`).join('\n')

      const productoNombre = producto || 'Portafolio Integrado Físico'

      const promptProyectoArticulado = `
Actúa como un Especialista en Diseño Microcurricular del Ministerio de Educación del Ecuador (Distrito 03D01 Azogues - Biblián - Déleg).
Tu tarea es diseñar las ACTIVIDADES POR ASIGNATURA y las RÚBRICAS ANALÍTICAS de un Proyecto Interdisciplinar para la Evaluación Sumativa, cumpliendo con absoluta fidelidad el estilo oficial del Distrito.

===================================================================
1. EJE RECTOR DEL PROYECTO COMÚN (TODAS LAS MATERIAS CONFLUYEN AQUÍ):
===================================================================
- Nivel/Subnivel: "${subnivel || 'Básica Superior'}" | Grado/Curso: "${gradoFinal}"
- Trimestre: "${trimestre || '1'}" | Duración: ${semanasFinal} semanas
- TÍTULO DEL PROYECTO: "${titulo || 'Proyecto Interdisciplinar Oficial'}"
- DESCRIPCIÓN / SITUACIÓN DE APRENDIZAJE: "${situacion_aprendizaje || ''}"
- DESAFÍO / PREGUNTA RETADORA: "${desafio || ''}"
- PRODUCTO FINAL COMÚN: "${productoNombre}"
- ASIGNATURAS PARTICIPANTES (${materiasLista.length}): ${materiasLista.join(', ')}

===================================================================
2. COMPETENCIAS, INDICADORES Y SABERES SELECCIONADOS POR EL DOCENTE:
===================================================================
${desgloseCurricularDetallado}

===================================================================
3. EJEMPLO EXACTO DEL ESTILO DE REDACCIÓN REQUERIDO (FEW-SHOT MODEL):
===================================================================
Observa cómo se redactan las actividades cuando el Producto Final es un "Portafolio Integrado Físico":

Ejemplo en MATEMÁTICA (si su saber declarativo fuera "Ecuaciones de primer grado con valor absoluto |ax+b|=c"):
- PLANIFICACIÓN (Semana 1):
  "- Presentar el desafío matemático: resolver casos de tolerancia o margen de error usando ecuaciones con valor absoluto |ax+b|=c en el contexto de materiales y experimentos.\\n\\n- Formar los tríos de trabajo y socializar los criterios de presentación manuscrita o impresa para la ficha de matemática del portafolio."
  Recursos: "Pizarra, marcador, cuaderno de trabajo, carpeta física del portafolio."
- 2.- Organización o investigación (Semana 1):
  "- Investigar las propiedades de la ecuación de primer grado con valor absoluto.\\n\\n- Distribuir roles en el trío (verificador de fórmulas, calculador y redactor de la ficha técnica física)."
  Recursos: "Libros de texto de Matemática, calculadora, hojas perforadas."
- 3. Ejecución e integración de saberes para la creación del producto (Semana 2):
  "- Plantear y resolver paso a paso en una hoja membretada 3 ejercicios contextualizados de ecuaciones de primer grado con valor absoluto.\\n\\n- Adjuntar la resolución completa y ordenada en la sección de Matemática del Portafolio Integrado Físico."
  Recursos: "Hojas de resolución a cuadros, juego geométrico, archivador físico."
- 4. Socialización, presentación y difusión (Semana 2):
  "- Presentar y explicar verbalmente ante la clase la solución de uno de los problemas resueltos durante la exhibición del portafolio físico."
  Recursos: "Portafolio físico en la sección de Matemática."
- 5. Evaluación, reflexión y metacognición:
  "- Rúbrica de evaluación sobre precisión algebraica y presentación limpia en el portafolio.\\n\\n- Redactar una breve reflexión en el portafolio sobre la utilidad del valor absoluto en márgenes de error reales."
  Recursos: "Instrumento de evaluación, ficha de metacognición."

Ejemplo en EMPRENDIMIENTO Y GESTIÓN (si su saber fuera "Ciclo contable y Libro Diario" para el MISMO proyecto):
- PLANIFICACIÓN (Semana 1):
  "- Discutir en el trío la importancia de la contabilidad y el registro de costos para elaborar un proyecto físico.\\n\\n- Definir el presupuesto simulado de materiales para el ensamble del Portafolio Integrado Físico (carpeta, separadores, copias, impresiones)."
- 2.- Organización o investigación (Semana 1):
  "- Investigar el orden lógico del ciclo contable básico y el llenado del libro diario.\\n\\n- Asignar en el trío la recolección de comprobantes o notas de venta simuladas de los materiales del portafolio."
- 3. Ejecución e integración de saberes para la creación del producto (Semana 2):
  "- Elaborar el registro de transacciones financieras en un formato físico impreso o dibujado a regla en la hoja contable.\\n\\n- Incluir el reporte contable veraz y transparente en la sección de Emprendimiento y Gestión del portafolio."

===================================================================
4. INSTRUCCIONES OBLIGATORIAS PARA TU GENERACIÓN:
===================================================================
1. FORMATO DE ACTIVIDADES EN CADA FASE:
   - En las Fases 1, 2, 3 y 5 redacta EXACTAMENTE 2 viñetas con guion ("- Viñeta 1...\\n\\n- Viñeta 2...") separadas por doble salto de línea. En la Fase 4 redacta 1 o 2 viñetas directas.
   - CADA viñeta debe nombrar EXPLÍCITAMENTE el concepto del Saber Declarativo y la acción del Saber Procedimental seleccionados arriba para esa asignatura (NO uses los temas del ejemplo si no fueron seleccionados; usa EXCLUSIVAMENTE los saberes listados en la sección 2 para cada materia).
   - CADA materia debe construir su propia sección/ficha/componente tangible e integrarlo dentro del Producto Final Común: "${productoNombre}".
   - Adapta todos los recursos a útiles reales del aula ecuatoriana (pizarra, marcador, cuaderno de trabajo, hojas perforadas, hojas a cuadros, regla, esferográficos, textos del MinEduc, etc.).
   - Si una materia es Inglés (EFL), redacta sus 5 fases y su rúbrica disciplinar 100% en INGLÉS siguiendo exactamente el mismo formato de guiones.

2. VINCULACIÓN ESTRICTA ENTRE ACTIVIDADES Y RÚBRICAS ("rubricas_disciplinares_por_materia"):
   - Genera una rúbrica analítica independiente (5 criterios) para CADA materia participante (${materiasLista.join(', ')}).
   - Los 5 criterios de la rúbrica de una materia DEBEN CALIFICAR EXACTAMENTE lo que el estudiante hizo en las 5 fases de esa materia (Ejemplo: Criterio 1 evalúa la investigación de la Fase 2 sobre el saber declarativo; Criterio 2 evalúa los ejercicios/producciones de la Fase 3 aplicando el saber procedimental; Criterio 3 evalúa el indicador de evaluación seleccionado; Criterio 4 evalúa el orden y presentación de la sección de esa materia dentro de "${productoNombre}" y su defensa en Fase 4; Criterio 5 evalúa los roles en el trío y la reflexión metacognitiva del saber actitudinal en Fase 5).

3. RÚBRICA INTERDISCIPLINAR COMÚN ("rubrica_interdisciplinar"):
   - Genera UNA SOLA rúbrica interdisciplinar (6 criterios) que evalúe el Producto Final Común ("${productoNombre}") ensamblado con las secciones de todas las asignaturas.

Devuelve EXCLUSIVAMENTE este JSON válido:
{
  "titulo": "${titulo || 'Proyecto Interdisciplinar Oficial'}",
  "objetivo_proyecto": "Objetivo integrador redactado en infinitivo que articula las materias participantes (${materiasLista.join(', ')}) con el desafío y la creación del producto final (${productoNombre}).",
  "descripcion_proyecto": "${situacion_aprendizaje || ''}",
  "desafio": "${desafio || ''}",
  "producto": "${productoNombre}",
  "fases_proyecto": [
    { "fase": "1. Planificación", "pregunta_orientadora": "¿Qué vamos a investigar y para qué?", "resultado": "Propósito, desafío y acuerdos de presentación" },
    { "fase": "2. Organización o investigación (asignación de roles)", "pregunta_orientadora": "¿Cómo vamos a hacerlo?", "resultado": "Investigación disciplinar y distribución de roles en tríos/equipos" },
    { "fase": "3. Ejecución e integración de saberes para la creación del producto", "pregunta_orientadora": "¿Cómo resolvemos el desafío?", "resultado": "Producciones disciplinares integradas en el producto final" },
    { "fase": "4. Socialización, presentación y difusión", "pregunta_orientadora": "¿Qué descubrimos y cómo lo comunicamos?", "resultado": "Exhibición y sustentación verbal del producto final" },
    { "fase": "5. Evaluación, reflexión y metacognición", "pregunta_orientadora": "¿Qué aprendimos y qué podemos mejorar?", "resultado": "Evaluación con rúbrica analítica y reflexión metacognitiva" }
  ],
  "actividades_por_materia": [
    {
      "asignatura": "Nombre Exacto de la Materia",
      "fases": [
        {
          "fase_titulo": "PLANIFICACIÓN (Semana 1)",
          "pregunta_orientadora": "¿Pregunta específica que conecta el saber declarativo de la materia con el producto?",
          "actividades": "- Presentar el desafío de la materia aplicando [Saber Declarativo exacto] en el contexto de [Título/Situación del proyecto].\\n\\n- Formar los tríos de trabajo y socializar los criterios de presentación para la sección de [Materia] del ${productoNombre}.",
          "recursos": "Pizarra, marcador, cuaderno de trabajo, carpeta/soporte del ${productoNombre}."
        },
        {
          "fase_titulo": "2.- Organización o investigación (Semana 1)",
          "pregunta_orientadora": "¿Pregunta específica sobre la indagación y organización del trío?",
          "actividades": "- Investigar las propiedades/conceptos/estructura de [Saber Declarativo exacto].\\n\\n- Distribuir roles específicos en el trío (rol 1, rol 2 y redactor de la ficha técnica para el ${productoNombre}).",
          "recursos": "Libros de texto de la materia, hojas perforadas, materiales específicos."
        },
        {
          "fase_titulo": "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
          "pregunta_orientadora": "¿Pregunta sobre la elaboración concreta de la sección de esta materia?",
          "actividades": "- Plantear y elaborar paso a paso [tarea concreta usando el Saber Procedimental exacto].\\n\\n- Adjuntar la producción completa y ordenada en la sección de [Materia] del ${productoNombre}.",
          "recursos": "Hojas de trabajo, instrumentos específicos de la materia, ${productoNombre}."
        },
        {
          "fase_titulo": "4. Socialización, presentación y difusión (Semana 2)",
          "pregunta_orientadora": "¿Pregunta sobre la defensa oral de la sección de esta materia?",
          "actividades": "- Presentar y explicar verbalmente ante la clase el trabajo resuelto en la sección de [Materia] durante la exhibición del ${productoNombre}.",
          "recursos": "${productoNombre} en la sección de [Materia]."
        },
        {
          "fase_titulo": "5. Evaluación, reflexión y metacognición",
          "pregunta_orientadora": "¿Pregunta reflexiva sobre la utilidad real del saber aprendido?",
          "actividades": "- Aplicación de rúbrica de evaluación sobre [precisión del Saber Procedimental] y presentación limpia en el ${productoNombre}.\\n\\n- Redactar una breve reflexión en el ${productoNombre} sobre la utilidad de [Saber Declarativo] y [Saber Actitudinal] en situaciones reales.",
          "recursos": "Rúbrica analítica de evaluación, ficha de metacognición."
        }
      ]
    }
  ],
  "rubricas_disciplinares_por_materia": [
    {
      "asignatura": "Nombre Exacto de la Materia",
      "criterios": [
        {
          "criterio": "1. Investigación y dominio de [Saber Declarativo de la materia]",
          "destacado": "Investiga y comprende con exactitud las propiedades y conceptos de [Saber Declarativo] en la Fase 1 y 2.",
          "esperado": "Investiga y comprende la mayoría de conceptos de [Saber Declarativo].",
          "proceso": "Investiga de manera parcial los conceptos con algunas confusiones.",
          "apoyo": "Requiere acompañamiento docente para comprender los conceptos básicos."
        },
        {
          "criterio": "2. Ejecución práctica de [tarea de la Fase 3 con el Saber Procedimental]",
          "destacado": "Desarrolla paso a paso y sin errores la actividad práctica de la Fase 3 aplicando [Saber Procedimental].",
          "esperado": "Desarrolla correctamente la actividad práctica con mínimos errores.",
          "proceso": "Presenta la actividad práctica incompleta o con imprecisiones.",
          "apoyo": "Requiere guía constante para resolver la actividad de la Fase 3."
        },
        {
          "criterio": "3. Cumplimiento del indicador [Código y texto breve del Indicador]",
          "destacado": "Alcanza de manera sobresaliente el desempeño establecido en el indicador de evaluación.",
          "esperado": "Alcanza satisfactoriamente el indicador de evaluación de la asignatura.",
          "proceso": "Evidencia un logro parcial del indicador de evaluación.",
          "apoyo": "No evidencia aún el logro mínimo del indicador."
        },
        {
          "criterio": "4. Presentación en la sección del ${productoNombre} y sustentación oral (Fase 4)",
          "destacado": "Adjunta la sección de la materia limpia y ordenada en el ${productoNombre} y la explica con total claridad ante la clase.",
          "esperado": "Adjunta la sección completa en el ${productoNombre} y realiza una explicación clara.",
          "proceso": "Adjunta la sección con desorden o expone con inseguridad.",
          "apoyo": "No adjunta la sección completa o requiere apoyo total para exponer."
        },
        {
          "criterio": "5. Trabajo en trío y reflexión metacognitiva ([Saber Actitudinal])",
          "destacado": "Cumple su rol específico en el trío, practica [Saber Actitudinal] y redacta una reflexión profunda en la Fase 5.",
          "esperado": "Cumple su rol en el trío y redacta una reflexión adecuada en la Fase 5.",
          "proceso": "Cumple parcialmente su rol o redacta una reflexión superficial.",
          "apoyo": "Requiere supervisión continua para integrarse al trío y reflexionar."
        }
      ]
    }
  ],
  "rubrica_interdisciplinar": [
    { "criterio": "Integración de secciones disciplinares en el producto", "destacado": "El ${productoNombre} integra de manera armónica, completa y coherente las secciones de todas las asignaturas participantes.", "esperado": "El ${productoNombre} integra adecuadamente la mayoría de las secciones disciplinares.", "proceso": "Se observan secciones incompletas o desarticuladas dentro del ${productoNombre}.", "apoyo": "Las producciones aparecen aisladas y sin estructura de producto común." },
    { "criterio": "Respuesta al desafío del proyecto", "destacado": "El ${productoNombre} responde con total pertinencia, viabilidad y sustento práctico a la pregunta retadora del proyecto.", "esperado": "El producto responde adecuadamente al desafío planteado.", "proceso": "El producto responde de manera parcial o superficial al desafío.", "apoyo": "El producto no logra dar respuesta al desafío del proyecto." },
    { "criterio": "Rigor técnico y uso de evidencias", "destacado": "Todas las fichas, cálculos, registros y textos incluidos en el ${productoNombre} presentan datos verificados y rigor académico.", "esperado": "La mayoría de los registros y evidencias del producto son correctos y pertinentes.", "proceso": "Algunas evidencias presentan errores de cálculo, redacción o fundamentación.", "apoyo": "Las secciones carecen de evidencias verificables." },
    { "criterio": "Exhibición y comunicación oral (Fase 4)", "destacado": "El trío/equipo expone y defiende el ${productoNombre} con fluidez, dominio técnico de todas las materias y excelente organización.", "esperado": "El equipo comunica con claridad los resultados del producto final.", "proceso": "La exposición presenta dificultades de orden o lectura mecánica.", "apoyo": "El equipo requiere guía constante del docente para explicar su producto." },
    { "criterio": "Presentación formal, orden y creatividad", "destacado": "El ${productoNombre} destaca por su pulcritud, diseño organizado por secciones, hojas membretadas limpias y creatividad.", "esperado": "El producto cumple con las normas de presentación y orden acordadas.", "proceso": "El producto presenta descuidos de orden, limpieza o estructura.", "apoyo": "El producto se entrega incompleto y sin el formato acordado." },
    { "criterio": "Trabajo cooperativo y cumplimiento de roles", "destacado": "Todos los integrantes del trío/equipo asumen sus roles específicos, colaboran activamente y cumplen los tiempos previstos.", "esperado": "La mayoría de los integrantes cumple sus responsabilidades en el equipo.", "proceso": "La distribución del trabajo en el trío/equipo es desigual.", "apoyo": "El equipo requiere intervención constante para trabajar de forma conjunta." }
  ]
}`

      let objetoProyecto: any = null

      try {
        const respuestaIa = await generarConIA(promptProyectoArticulado, 7800)
        const jsonLimpio = respuestaIa.replace(/```json/g, '').replace(/```/g, '').trim()
        objetoProyecto = JSON.parse(jsonLimpio)

        // Asignar la matriz curricular oficial inmutable con los saberes seleccionados 1 a 1
        objetoProyecto.matriz_curricular = matrizCurricularOficial

        // Verificar que todas las materias tengan sus 5 fases completas y vinculadas
        const actividadesExistentes = Array.isArray(objetoProyecto.actividades_por_materia)
          ? objetoProyecto.actividades_por_materia
          : []

        objetoProyecto.actividades_por_materia = materiasLista.map((m: string) => {
          const encontrada = actividadesExistentes.find(
            (a: any) => (a.asignatura || '').toUpperCase().trim() === m.toUpperCase().trim()
          )
          if (encontrada && Array.isArray(encontrada.fases) && encontrada.fases.length >= 5) {
            return encontrada
          }
          const d = desgloseSeguro.find(item => item.asignatura.toUpperCase() === m.toUpperCase())
          return {
            asignatura: m,
            fases: construirActividadesDesdeSaberesReales(
              m, 
              d?.competencia || '', 
              d?.declarativos || [], 
              d?.procedimentales || [], 
              d?.actitudinales || [], 
              titulo || 'Proyecto Interdisciplinar',
              desafio || 'Desafío del proyecto',
              productoNombre
            )
          }
        })

        // Garantizar que CADA materia tenga su propia rúbrica analítica disciplinar vinculada a sus actividades
        const rubricasExistentes = Array.isArray(objetoProyecto.rubricas_disciplinares_por_materia)
          ? objetoProyecto.rubricas_disciplinares_por_materia
          : []

        objetoProyecto.rubricas_disciplinares_por_materia = materiasLista.map((m: string) => {
          const encontrada = rubricasExistentes.find(
            (r: any) => (r.asignatura || '').toUpperCase().trim() === m.toUpperCase().trim()
          )
          if (encontrada && Array.isArray(encontrada.criterios) && encontrada.criterios.length > 0) {
            return encontrada
          }
          const d = desgloseSeguro.find(item => item.asignatura.toUpperCase() === m.toUpperCase())
          return {
            asignatura: m,
            criterios: construirRubricaDisciplinarEspecifica(
              m,
              d?.indicadores || [],
              d?.declarativos || [],
              d?.procedimentales || [],
              d?.actitudinales || [],
              productoNombre
            )
          }
        })

      } catch (errorIa: any) {
        console.warn('⚠️ IA en timeout o error de parsing, activando motor estructurado Distrito 03D01:', errorIa.message)
        
        objetoProyecto = {
          titulo: titulo || 'Proyecto Interdisciplinar Oficial',
          objetivo_proyecto: `Articular los saberes disciplinares de ${materiasLista.join(', ')} en ${gradoFinal}, mediante la resolución práctica y el trabajo cooperativo en tríos, para elaborar y sustentar el producto común: ${productoNombre}.`,
          descripcion_proyecto: situacion_aprendizaje || `En la institución educativa se aborda la necesidad de integrar los saberes teóricos y prácticos de cada asignatura en un producto tangible aplicado a situaciones reales del entorno.`,
          desafio: desafio || `¿Cómo podemos integrar los conocimientos de nuestras asignaturas para elaborar y sustentar ${productoNombre}?`,
          producto: productoNombre,
          matriz_curricular: matrizCurricularOficial,
          fases_proyecto: [
            { fase: "1. Planificación", pregunta_orientadora: "¿Qué vamos a investigar y para qué?", resultado: "Propósito, desafío y criterios de presentación" },
            { fase: "2. Organización o investigación (asignación de roles)", pregunta_orientadora: "¿Cómo vamos a hacerlo?", resultado: "Indagación disciplinar y distribución de roles en el trío" },
            { fase: "3. Ejecución e integración de saberes para la creación del producto", pregunta_orientadora: "¿Cómo resolvemos el desafío?", resultado: "Secciones disciplinares integradas en el producto final" },
            { fase: "4. Socialización, presentación y difusión", pregunta_orientadora: "¿Qué descubrimos y cómo lo comunicamos?", resultado: "Exhibición y sustentación oral del producto" },
            { fase: "5. Evaluación, reflexión y metacognición", pregunta_orientadora: "¿Qué aprendimos y qué podemos mejorar?", resultado: "Evaluación con rúbrica analítica y reflexión en el producto" }
          ],
          actividades_por_materia: materiasLista.map((m: string) => {
            const d = desgloseSeguro.find(item => item.asignatura.toUpperCase() === m.toUpperCase())
            return {
              asignatura: m,
              fases: construirActividadesDesdeSaberesReales(
                m, 
                d?.competencia || '', 
                d?.declarativos || [], 
                d?.procedimentales || [], 
                d?.actitudinales || [], 
                titulo || 'Proyecto Interdisciplinar',
                desafio || 'Desafío del proyecto',
                productoNombre
              )
            }
          }),
          rubricas_disciplinares_por_materia: materiasLista.map((m: string) => {
            const d = desgloseSeguro.find(item => item.asignatura.toUpperCase() === m.toUpperCase())
            return {
              asignatura: m,
              criterios: construirRubricaDisciplinarEspecifica(
                m,
                d?.indicadores || [],
                d?.declarativos || [],
                d?.procedimentales || [],
                d?.actitudinales || [],
                productoNombre
              )
            }
          }),
          rubrica_interdisciplinar: [
            { criterio: "Integración de secciones disciplinares", destacado: `El "${productoNombre}" integra de manera armónica, completa y coherente las secciones de todas las materias participantes.`, esperado: `El "${productoNombre}" relaciona adecuadamente las secciones de las asignaturas.`, proceso: "Se aprecian aportes aislados o incompletos entre asignaturas.", apoyo: "Los trabajos no evidencian integración en el producto común." },
            { criterio: "Respuesta al desafío", destacado: "Las resoluciones y evidencias del producto responden con rigor y viabilidad al desafío planteado.", esperado: "El producto responde satisfactoriamente al desafío.", proceso: "El producto responde de forma superficial al reto.", apoyo: "El producto no responde al desafío del proyecto." },
            { criterio: "Uso de evidencias y rigurosidad", destacado: "Utiliza cálculos, registros, fichas técnicas y producciones verificadas sin errores.", esperado: "Sustenta sus secciones con evidencias adecuadas.", proceso: "Utiliza pocas evidencias o presenta imprecisiones.", apoyo: "Presenta trabajos sin sustento ni verificación." },
            { criterio: "Sustentación oral en la exhibición (Fase 4)", destacado: "Explica verbalmente ante la clase las soluciones y secciones del producto con solvencia y claridad.", esperado: "Comunica de manera organizada los resultados principales.", proceso: "Presenta dificultades de orden o claridad en la exposición.", apoyo: "Requiere acompañamiento total para explicar su sección." },
            { criterio: "Presentación formal y orden", destacado: `El "${productoNombre}" destaca por su orden, hojas membretadas limpias y excelente estructura.`, esperado: "Presenta el producto limpio y ordenado según los criterios.", proceso: "Presenta descuidos en el orden o formato de entrega.", apoyo: "Entrega el producto incompleto o desorganizado." },
            { criterio: "Trabajo en trío y cumplimiento de roles", destacado: "Todos los integrantes cumplen con excelencia sus roles asignados en el trío y colaboran activamente.", esperado: "La mayoría cumple sus roles y coopera en el trío.", proceso: "Participación y distribución de responsabilidades desigual.", apoyo: "El trío requiere acompañamiento constante para trabajar." }
          ]
        }
      }

      // Guardado seguro en Supabase
      if (docente_id && institucion_id) {
        const { data: insertData, error: insertError } = await supabase
          .from('planificaciones_microcurriculares')
          .insert({
            docente_id,
            institucion_id,
            asignatura: 'PROYECTO INTERDISCIPLINAR',
            grado_curso: gradoFinal,
            paralelo: paralelo || 'A',
            trimestre: String(trimestre || '1'),
            no_semanas: String(semanasFinal),
            subnivel: subnivel || 'Básica Superior',
            titulo_sia: objetoProyecto.titulo,
            descripcion_sia: objetoProyecto.descripcion_proyecto,
            asignaturas_conexion: materiasLista.join(', '),
            competencia_especifica: objetoProyecto.desafio,
            bloques_competencias: matrizCurricularOficial,
            semanas: objetoProyecto.actividades_por_materia || [],
            filas_saberes: objetoProyecto
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('Error insertando en planificaciones_microcurriculares:', insertError)
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        return NextResponse.json({
          id: insertData.id,
          mensaje: 'Proyecto interdisciplinar generado exitosamente',
          ...objetoProyecto
        })
      }

      return NextResponse.json(objetoProyecto)
    }

    // =========================================================================
    // 3. MODELOS DISCIPLINARIOS PREVIOS (CONSERVADOS 100% INTACTOS)
    // =========================================================================
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
      // 1. Detección de grados oficiales según el subnivel
      let gradosSubnivel = ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB']
      const subNorm = (subnivel || '').toUpperCase()

      if (subNorm.includes('ELEMENTAL') || subNorm.includes('2DO') || subNorm.includes('3RO') || subNorm.includes('4TO')) {
        gradosSubnivel = ['2do Grado EGB', '3ro Grado EGB', '4to Grado EGB']
      } else if (subNorm.includes('MEDIA') || subNorm.includes('5TO') || subNorm.includes('6TO') || subNorm.includes('7MO')) {
        gradosSubnivel = ['5to Grado EGB', '6to Grado EGB', '7mo Grado EGB']
      } else if (subNorm.includes('SUPERIOR') || subNorm.includes('8VO') || subNorm.includes('9NO') || subNorm.includes('10MO')) {
        gradosSubnivel = ['8vo EGB', '9no EGB', '10mo EGB']
      } else if (subNorm.includes('BACHILLERATO') || subNorm.includes('BGU')) {
        gradosSubnivel = ['1er Curso BGU', '2do Curso BGU', '3er Curso BGU']
      }

      // 2. Comprobar si el docente ya definió insumos previos en el formulario
      const objetivoDocente = body.objetivos || body.objetivo || ''
      const destrezasDocente = body.criterios || body.destrezas || ''
      const indicadoresDocente = body.indicadores || ''

      const contextoInsumosDocente = `
INSUMOS PREVIOS PROPORCIONADOS POR EL DOCENTE (OBLIGATORIO RESPETAR SI NO ESTÁN VACÍOS):
- Objetivo de Aprendizaje: ${objetivoDocente ? `"${objetivoDocente}"` : 'NO PROPORCIONADO (Formúlalo alineado al Currículo Priorizado por Competencias de Ecuador)'}
- Destrezas con Criterios de Desempeño (DCD): ${destrezasDocente ? `"${destrezasDocente}"` : `NO PROPORCIONADO (Selecciona DCD oficiales con su código ministerial, ej: LL.3.3.2, M.3.1.5, correspondientes a ${subnivel || 'Básica Media'})`}
- Indicadores de Evaluación: ${indicadoresDocente ? `"${indicadoresDocente}"` : `NO PROPORCIONADO (Selecciona indicadores oficiales con su código ministerial, ej: I.LL.3.3.1, I.M.3.1.2)`}
`

      promptText = `
Eres un Asesor Pedagógico y Especialista Curricular del Ministerio de Educación del Ecuador.
Tu tarea es formular la planificación microcurricular MULTIGRADO POR EJE TEMÁTICO estructurada bajo el CURRÍCULO PRIORIZADO POR COMPETENCIAS.

DATOS DEL CURSO Y CONTEXTO:
- Eje Temático: "${ejeTematico || '1. El Yo y la Identidad'}"
- Subnivel Educativo: "${subnivel || 'Básica Media'}"
- Asignatura: "${asignatura || 'Lengua y Literatura'}"
- Tema / Unidad Didáctica: "${tema || titulo || 'Comprensión y producción textual'}"
- Grados a articular simultáneamente: ${gradosSubnivel.join(', ')}

${contextoInsumosDocente}

REGLAS PEDAGÓGICAS ESTRICTAS:
1. DESTREZAS (DCD) E INDICADORES:
   - Prohibido usar códigos de Criterios (los que inician con "CE."). Usa EXCLUSIVAMENTE Destrezas con Criterio de Desempeño con código oficial (ej: LL.3.1.1, M.3.2.1) e Indicadores de Evaluación (ej: I.LL.3.1.1).
   - Si el docente proporcionó el Objetivo, DCD o Indicadores, utilízalos como base inamovible. Si no los proporcionó, selecciónalos del Currículo Priorizado por Competencias de Ecuador para el subnivel "${subnivel || 'Básica Media'}".
   - En el campo "criterios" debes colocar la DCD común integradora o articulada para el subnivel.

2. ORIENTACIONES METODOLÓGICAS (MOMENTOS DE LA CLASE MULTIGRADO):
   Para CADA UNO de los 3 grados (${gradosSubnivel.join(', ')}), las "orientaciones" DEBEN estructurarse OBLIGATORIAMENTE en 3 momentos pedagógicos secuenciales con enfoque DUA:
   • ANTICIPACIÓN: Actividades iniciales de motivación, activación de conocimientos previos y planteamiento del desafío común en el aula.
   • CONSTRUCCIÓN: Trabajo autónomo o colaborativo diferenciado por grado para conceptualizar, experimentar y resolver la destreza según su nivel de complejidad.
   • CONSOLIDACIÓN: Aplicación del aprendizaje, elaboración del producto/evidencia y puesta en común de los 3 grados.

3. EVALUACIÓN Y ADAPTACIONES:
   - "evaluacion": Actividades e instrumentos de evaluación (formativa y sumativa) con técnicas concretas (rúbricas, listas de cotejo, fichas de observación).
   - "grados": Debe contener EXACTAMENTE 3 elementos, uno para cada grado: ${gradosSubnivel.join(', ')}.

Devuelve EXCLUSIVAMENTE este JSON válido (sin markdown, sin texto extra):
{
  "objetivos": "Objetivo de aprendizaje del subnivel...",
  "criterios": "DCD seleccionada con su código oficial del MinEduc (ej: M.3.1.1. ...)",
  "evaluacion": "Técnicas e instrumentos de evaluación...",
  "grados": [
    {
      "grado": "${gradosSubnivel[0]}",
      "indicadores": "Indicador oficial con código para este grado (ej: I.M.3.1.1...)",
      "orientaciones": "• ANTICIPACIÓN:\\n- Actividad motivadora y lluvia de ideas...\\n\\n• CONSTRUCCIÓN:\\n- Trabajo guiado con material concreto...\\n\\n• CONSOLIDACIÓN:\\n- Ficha de aplicación y socialización..."
    },
    {
      "grado": "${gradosSubnivel[1]}",
      "indicadores": "Indicador oficial con código para este grado...",
      "orientaciones": "• ANTICIPACIÓN:\\n- Activación de conocimientos previos y diálogo...\\n\\n• CONSTRUCCIÓN:\\n- Resolución en parejas y análisis en cuaderno...\\n\\n• CONSOLIDACIÓN:\\n- Ejercicios prácticos de aplicación..."
    },
    {
      "grado": "${gradosSubnivel[2]}",
      "indicadores": "Indicador oficial con código para este grado...",
      "orientaciones": "• ANTICIPACIÓN:\\n- Preguntas retadoras sobre el tema...\\n\\n• CONSTRUCCIÓN:\\n- Indagación autónoma y desarrollo de ejercicios complejos...\\n\\n• CONSOLIDACIÓN:\\n- Síntesis grupal y sustentación..."
    }
  ]
}`

      jsonText = await generarConIA(promptText, 4500)
    } else if (tipoModelo === 'estructura_tematica') {
      const saberesValidos = filasSaberes?.filter((f: any) => f && (f.indicador || f.declarativo || f.procedimental)) || []
      
      const saberesTexto = saberesValidos.map((f: any, idx: number) => `
-[${idx + 1}] Comp: "${f.competenciaFila || 'Competencia general'}" | Ind: "${f.indicador || 'N/A'}" | Dec: "${f.declarativo || 'N/A'}" | Proc: "${f.procedimental || 'N/A'}" | Act: "${f.actitudinal || 'N/A'}"
      `).join('\n') || 'Sin saberes específicos'

      promptText = `
Estructura temas secuenciados bajo Currículo por Competencias de Ecuador:
- Asignatura: "${asignatura || 'Matemática'}" | Grado: "${gradoFinal}" | Trimestre: "${trimestre || 'Trimestre 1'}"
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
- Asignatura: "${asignatura}" | Subnivel: "${subnivel}" | Grado: "${gradoFinal}"
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
      jsonText = await generarConIA(promptText, 5800)

    } else if (tipoModelo === 'secuencia_piloto_zona6') {
      const bloques = bloquesManuales || []
      
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
      const esInglesPiloto = String(asignatura).toLowerCase().includes('inglés') || String(asignatura).toLowerCase().includes('ingles') || String(asignatura).toLowerCase().includes('english')
      const esLenguaPiloto = String(asignatura).toLowerCase().includes('lengua')

      const instruccionEnfoque = esInglesPiloto 
        ? "CRITICAL REQUIREMENT: Generate ALL text in ENGLISH, structuring tasks around the 4 macro-skills (Listening, Speaking, Reading, Writing)." 
        : esLenguaPiloto 
        ? "REQUISITO OBLIGATORIO: Estructura las actividades en torno a las macrodestrezas de Lengua y Literatura: Hablar, Escuchar, Leer y Escribir." 
        : ""

      promptText = `Eres especialista curricular del Ministerio de Educación de Ecuador (Piloto Zona 6, DUA y metodología ERCA).
Diseña una planificación microcurricular secuenciada cronológicamente de ${totalSemanas} semanas.
- Asignatura: "${asignatura}" | Subnivel: "${subnivel}" | Grado: "${gradoFinal}" | Trimestre: "${trimestre}"
${instruccionEnfoque}

CURRÍCULO BASE Y SABERES CARGADOS DESDE LA MATRIZ OFICIAL:
${resumenBloques}

LISTA DE SABERES DECLARATIVOS (TEMAS OFICIALES):
${listaDeclarativosDisponibles.length > 0 ? listaDeclarativosDisponibles.map((t, i) => `${i + 1}.${t}`).join('\n') : 'Distribuir temas según la competencia seleccionada'}

LISTA DE INDICADORES:
${listaIndicadoresDisponibles.length > 0 ? listaIndicadoresDisponibles.join(' | ') : 'Asignar indicador oficial correspondiente'}

REGLAS OBLIGATORIAS PARA CADA UNA DE LAS ${totalSemanas} SEMANAS:
1. 'temaSemana': DEBE SER OBLIGATORIAMENTE un saber declarativo de la lista anterior.
2. 'codigoIndicador': Asigna el código oficial exacto del indicador (ej: "I.M.2.1.1").
3. 'sugerenciasInicio', 'sugerenciasDesarrollo', 'sugerenciasCierre': Desarrolla actividades pedagógicas completas para cubrir la carga horaria semanal.

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
      "sugerenciasInicio": "- Actividad motivadora DUA...\\n- Pregunta retadora...",
      "sugerenciasDesarrollo": "- Modelado del docente...\\n- Práctica guiada...\\n- Trabajo en parejas...",
      "sugerenciasCierre": "- Presentación de la evidencia...\\n- Preguntas de reflexión metacognitiva...",
      "recursos": "Material concreto, fichas de trabajo, papelotes, cuadernos.",
      "tecnica": "Observación sistemática",
      "instrumento": "Lista de cotejo"
    }
  ]
}`

      jsonText = await generarConIA(promptText, 6500)

    } else {
      // 1. Extraer insumos previos proporcionados por el docente (si los hay)
      const objetivoDocente = body.objetivos || body.objetivo || ''
      const destrezaDocente = body.criterios || body.destrezas || body.criterio || ''
      const indicadorDocente = body.indicadores || body.indicador || ''

      const contextoInsumosDocente = `
INSUMOS CURRICULARES PROPORCIONADOS POR EL DOCENTE (OBLIGATORIO RESPETAR SI NO ESTÁN VACÍOS):
- Objetivo de Aprendizaje: ${objetivoDocente ? `"${objetivoDocente}"` : `NO PROPORCIONADO (Formúlalo alineado al Currículo Priorizado por Competencias de Ecuador para ${gradoFinal})`}
- Destreza con Criterio de Desempeño (DCD): ${destrezaDocente ? `"${destrezaDocente}"` : `NO PROPORCIONADO (Selecciona una DCD oficial con su código ministerial, ej: M.3.1.2., LL.4.3.1., correspondiente a ${asignatura} en ${gradoFinal})`}
- Indicador de Evaluación: ${indicadorDocente ? `"${indicadorDocente}"` : `NO PROPORCIONADO (Selecciona un indicador oficial con su código ministerial, ej: I.M.3.1.2., I.LL.4.3.1.)`}
`

      promptText = `
Planificación microcurricular disciplinar (Currículo por Competencias):
- Modelo seleccionado: Modelo 1: Trimestral Disciplinar
- Asignatura: "${asignatura || 'Matemática'}"
- Subnivel Educativo: "${subnivel || 'Básica Media'}"
- Grado / Curso: "${gradoFinal}"
- Tema / Unidad Didáctica: "${tema || titulo || 'Desarrollo de aprendizajes disciplinares'}"

${contextoInsumosDocente}

REGLAS PEDAGÓGICAS ESTRICTAS:
1. DESTREZAS (DCD) E INDICADORES:
   - Prohibido utilizar Criterios de Evaluación generales (los códigos que inician con "CE."). Usa EXCLUSIVAMENTE Destrezas con Criterio de Desempeño oficiales (ej: LL.3.2.1, M.4.1.3, CN.2.2.1) con su respectivo código ministerial y desagregación si aplica.
   - Si el docente proporcionó el Objetivo, la DCD o el Indicador, utilízalos como eje rector inamovible. Si no los proporcionó, selecciónalos del Currículo Priorizado por Competencias oficial para ${gradoFinal}.
   - Devuelve la DCD seleccionada tanto en la clave "destrezas" como en "criterios" para garantizar compatibilidad con la vista del sistema.

2. ESTRATEGIAS METODOLÓGICAS (ANTICIPACIÓN, CONSTRUCCIÓN Y CONSOLIDACIÓN):
   En el campo "estrategiasDua", DEBES estructurar obligatoriamente las actividades de aprendizaje en los tres momentos pedagógicos del ciclo con enfoque DUA y metodología activa:
   • ANTICIPACIÓN: Actividades motivadoras, preguntas generadoras, exploración sensorial o activación de conocimientos previos para despertar el interés de los estudiantes.
   • CONSTRUCCIÓN DEL APRENDIZAJE: Actividades secuenciadas donde los estudiantes experimentan, analizan, resuelven problemas, leen o manipulan material concreto para apropiarse de la destreza.
   • CONSOLIDACIÓN: Actividades prácticas de aplicación, resolución autónoma o colaborativa, síntesis en el cuaderno/papelógrafo y puesta en común de lo aprendido.

3. RECURSOS Y EVALUACIÓN:
   - "recursos": Útiles y materiales reales del entorno escolar ecuatoriano (texto escolar del MinEduc, cuaderno de trabajo, material concreto, pizarra, marcadores, etc.).
   - "evaluacion": Actividades e instrumentos concretos (técnica: ej. observación sistemática, análisis de producciones; instrumento: ej. lista de cotejo, rúbrica analítica, escala valorativa).
   - "adaptaciones": Sugerencias prácticas para adaptaciones curriculares / NEE no asociadas a la discapacidad en el aula ordinaria.

Devuelve EXCLUSIVAMENTE este JSON válido (sin formato markdown, sin comillas adicionales):
{
  "objetivos": "Objetivo de aprendizaje del currículo priorizado...",
  "destrezas": "DCD oficial con su código (ej: M.3.1.2. Describir y reproducir...)",
  "criterios": "DCD oficial con su código (la misma DCD anterior para compatibilidad con la vista)",
  "indicadores": "Indicador oficial con su código (ej: I.M.3.1.2...)",
  "estrategiasDua": "• ANTICIPACIÓN:\\n- Actividad motivadora y preguntas exploratorias sobre el tema...\\n\\n• CONSTRUCCIÓN:\\n- Trabajo guiado con el texto del MinEduc y resolución paso a paso de...\\n- Práctica en parejas aplicando el concepto...\\n\\n• CONSOLIDACIÓN:\\n- Ejercicios prácticos en el cuaderno de trabajo y socialización colectiva de dudas...",
  "recursos": "Texto escolar del Ministerio de Educación, cuaderno de trabajo, material concreto, marcadores, pizarra.",
  "evaluacion": "Técnica: Análisis del desempeño.\\nInstrumento: Rúbrica de evaluación formativa sobre la precisión en la resolución y participación.",
  "adaptaciones": "Otorgar tiempo adicional para la entrega, apoyos visuales y tutoría entre pares para la resolución de ejercicios."
}`

      jsonText = await generarConIA(promptText, 5800)
    }
    const jsonLimpio = jsonText.replace(/```json/g, '').replace(/```/g, '').trim()
    const objetoParseado = JSON.parse(jsonLimpio)
    
    return NextResponse.json(objetoParseado)

  } catch (error: any) {
    console.error('Error en API route IA:', error)
    return NextResponse.json({ error: error.message || 'Error interno al procesar con la IA' }, { status: 500 })
  }
}