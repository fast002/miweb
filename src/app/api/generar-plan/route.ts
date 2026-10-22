import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const deepseek = new OpenAI({ 
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com',
  timeout: 45000
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

async function generarConIA(promptText: string, maxTokens = 4000): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "Eres un Diseñador Curricular y Asesor Pedagógico del Ministerio de Educación de Ecuador. Tu objetivo es generar planificaciones hiper-específicas, prácticas y detalladas, prohibiendo totalmente frases genéricas. Responde ÚNICAMENTE en JSON válido sin bloques markdown."
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
        temperature: 0.25,
        max_tokens: maxTokens,
      });

      const contenido = completion.choices[0]?.message?.content;
      if (contenido && contenido.trim() !== '') {
        return contenido;
      }
    } catch (error: any) {
      console.warn(`⚠️ DeepSeek falló o tardó demasiado (${error.message}). Conmutando a OpenAI...`);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('🚀 Ejecutando con OpenAI Backup (gpt-4o-mini)...');
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.25,
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

// Generador pedagógico de respaldo de alta especificidad por materia
function construirActividadesEspecificasPorMateria(asig: string, temaTitulo: string, productoFinal: string) {
  const norm = asig.toUpperCase()

  if (norm.includes('NATURALES') || norm.includes('BIOLOGÍA') || norm.includes('QUÍMICA')) {
    return [
      {
        fase_titulo: "1. PLANIFICACIÓN (Semana 1)",
        pregunta_orientadora: "¿De qué manera el descanso, la alimentación equilibrada, la higiene y el tiempo frente a las pantallas afectan a nuestro cerebro, vista y energía para aprender?",
        actividades: "• Observar infografías y láminas del cuerpo humano (sistema nervioso, ojos, postura y ciclo circadiano) analizando cómo responde el organismo ante la luz azul y el desvelo.\n• Realizar el diálogo guiado 'El semáforo de nuestra energía' donde los estudiantes identifican señales corporales de agotamiento (pesadez ocular, bostezos frecuentes, falta de concentración).\n• Formular en el cuaderno de ciencias dos preguntas de investigación sobre los hábitos de salud del grado.",
        recursos: "Láminas del cuerpo humano y sistema nervioso.\nInfografías sobre luz azul y calidad del sueño.\nCuaderno de campo y marcadores."
      },
      {
        fase_titulo: "2.- Organización e investigación (Semana 1)",
        pregunta_orientadora: "¿Cómo investigamos y registramos científicamente las evidencias biológicas del grupo?",
        actividades: "• Conformar brigadas de investigación científica asignando roles: Observador de descanso, Inspector de hidratación y loncheras, Cronometrador de pantallas y Relator científico.\n• Aplicar durante 3 días la bitácora 'Mi reloj biológico de bienestar', registrando horas efectivas de sueño, litros de agua ingeridos y minutos de exposición a dispositivos.\n• Contrastar los datos obtenidos con la tabla oficial de recomendaciones pediátricas (9 a 10 horas de sueño y menos de 1 hora de recreación digital).",
        recursos: "Bitácora impresa 'Mi reloj biológico'.\nTabla comparativa de estándares de salud pediátrica.\nFichas de registro de campo."
      },
      {
        fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
        pregunta_orientadora: "¿Cómo transformamos las evidencias biológicas en aportes para el producto final?",
        actividades: "• Taller de higiene visual: practicar la regla 20-20-20 (cada 20 minutos mirar a 20 pies de distancia por 20 segundos) y ejercicios de respiración diafragmática para la oxigenación cerebral.\n• Redactar la sección científica de la guía colectiva integrando 3 fichas técnicas: 'Efectos de las pantallas en el cerebro', 'Nutrientes que impulsan el aprendizaje' y 'Guía de posturas ergonómicas para estudiar'.\n• Diseñar diagramas explicativos con recortes y dibujos sobre los órganos protegidos con buenos hábitos.",
        recursos: "Plantilla para la guía colectiva.\nCartulinas de colores, tijeras, goma y témperas.\nIlustraciones de órganos y hábitos saludables."
      },
      {
        fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
        pregunta_orientadora: "¿Cómo transmitimos el mensaje de prevención y salud a la comunidad educativa?",
        actividades: "• Montaje del rincón experimental 'Cuerpo sano, mente despierta' en la feria del proyecto.\n• Exposición oral guiada: los estudiantes demuestran con maquetas o siluetas la diferencia de un cerebro descansado frente a uno fatigado.\n• Guiar al público asistente en una pausa activa de respiración y descanso visual de 2 minutos.",
        recursos: "Paneles informativos.\nSiluetas anatómicas interactivas.\nGuía colectiva finalizada."
      },
      {
        fase_titulo: "5. Evaluación, reflexión y metacognición",
        pregunta_orientadora: "¿Qué cambios biológicos observamos en nosotros al modificar nuestros hábitos?",
        actividades: "• Aplicar la rúbrica disciplinar analítica de Ciencias Naturales evaluando rigor en los registros y sustentación científica.\n• Círculo de la salud: los estudiantes exponen cómo se sintieron físicamente al reducir pantallas y firman el compromiso de desconexión nocturna.",
        recursos: "Rúbrica analítica disciplinar.\nContrato de compromiso de salud personal."
      }
    ]
  }

  if (norm.includes('MATEMÁTICA')) {
    return [
      {
        fase_titulo: "1. PLANIFICACIÓN (Semana 1)",
        pregunta_orientadora: "¿Cómo podemos usar los números, las tablas de conteo y la distinción entre necesidades y deseos para conocer cómo distribuimos nuestro tiempo y recursos?",
        actividades: "• Dialogar sobre las actividades cotidianas que constituyen necesidades básicas (dormir, alimentarse, estudiar) frente a los deseos (horas extra en consolas o compras prescindibles).\n• Analizar un modelo de tabla de conteo en la pizarra para definir qué variables cuantificaremos en el proyecto: horas de sueño, minutos de pantallas y gastos diarios del recreo.",
        recursos: "Pizarra y marcadores.\nLáminas comparativas 'Necesidad vs. Deseo'.\nReloj didáctico."
      },
      {
        fase_titulo: "2.- Organización e investigación (Semana 1)",
        pregunta_orientadora: "¿Cómo levantamos y organizamos los datos numéricos con precisión?",
        actividades: "• Conformar grupos de trabajo asignando roles matemáticos: Encuestador, Registrador de marcas de conteo, Verificador de sumas y Diseñador de tablas.\n• Aplicar un cuestionario cuantitativo rápido de 4 preguntas a los estudiantes del curso para levantar datos sobre hábitos diarios.\n• Totalizar los registros mediante sumas simples sin reagrupación y validar que el total coincida con el universo de encuestados.",
        recursos: "Fichas de conteo con palotes.\nTablas de frecuencia vacías.\nCalculadoras básicas o material concreto (semillas/tapas)."
      },
      {
        fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
        pregunta_orientadora: "¿Cómo construimos gráficos estadísticos comprensibles para la comunidad?",
        actividades: "• Construir un gráfico de barras en cuadrícula (definiendo escala, títulos, categorías en eje horizontal y frecuencia en eje vertical) que ilustre los hábitos del curso.\n• Extraer conclusiones matemáticas: identificar la moda estadística, comparar valores (mayor que, menor que) y calcular cuántas horas se desperdician semanalmente.\n• Redactar la página matemática para la guía colectiva con la tabla de datos, el gráfico coloreado y una meta numérica de ahorro de tiempo.",
        recursos: "Papel milimetrado o cuadrícula A4.\nReglas, lápices de colores y rotuladores.\nFormato para la guía colectiva."
      },
      {
        fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
        pregunta_orientadora: "¿Cómo comunicamos las estadísticas del proyecto con claridad?",
        actividades: "• Exponer los gráficos de barras en el stand matemático de la feria del proyecto.\n• Explicar con precisión verbal: 'El 65% de nuestro grado duerme menos de 8 horas, por lo que planteamos la meta de recuperar 1 hora diaria de sueño'.\n• Responder preguntas del público demostrando la lectura correcta de los ejes y barras estadísticas.",
        recursos: "Carteleras con gráficos de barras gigantes.\nGuía colectiva impresa."
      },
      {
        fase_titulo: "5. Evaluación, reflexión y metacognición",
        pregunta_orientadora: "¿Por qué los números y gráficos nos ayudan a tomar mejores decisiones de vida?",
        actividades: "• Aplicar la rúbrica disciplinar analítica de Matemática (evaluando recolección, tabulación, diseño gráfico e interpretación de hallazgos).\n• Reflexión individual: ¿Cómo influye el registro exacto de las horas en la mejora de mi disciplina personal?",
        recursos: "Rúbrica disciplinar analítica de Matemática.\nFicha de autoevaluación cuantitativa."
      }
    ]
  }

  if (norm.includes('LENGUA') || norm.includes('LITERATURA')) {
    return [
      {
        fase_titulo: "1. PLANIFICACIÓN (Semana 1)",
        pregunta_orientadora: "¿Cómo podemos usar la comunicación oral respetuosa, la escucha activa y la redacción clara para investigar y transformar los hábitos del aula?",
        actividades: "• Lectura dialógica del cuento 'La noche sin pantallas', reflexionando sobre los personajes que perdieron el sueño y la convivencia por el uso desmedido de dispositivos.\n• Dinámica 'El micrófono de la confianza': cada estudiante expresa en qué momentos de la jornada siente mayor distracción y qué palabras le motivan a mejorar.",
        recursos: "Cuento impreso.\nMicrófono didáctico.\nTarjetas de intenciones comunicativas."
      },
      {
        fase_titulo: "2.- Organización e investigación (Semana 1)",
        pregunta_orientadora: "¿Cómo estructuramos una entrevista empática para recoger testimonios reales?",
        actividades: "• Organizar equipos asignando roles comunicativos: Entrevistador principal, Secretario de notas textuales, Observador de lenguaje no verbal y Vocero.\n• Diseñar un guion de entrevista de 3 preguntas abiertas utilizando apoyos visuales y pictogramas para asegurar la inclusión de todos los compañeros.\n• Ejecutar las entrevistas practicando pautas fundamentales: contacto visual con el interlocutor, escucha atenta sin interrumpir y tono de voz adecuado.",
        recursos: "Guion de entrevista estructurado.\nFichas con pictogramas de apoyo.\nLibreta de notas del reportero."
      },
      {
        fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
        pregunta_orientadora: "¿Cómo redactamos textos expositivos y reflexivos con coherencia y cohesión?",
        actividades: "• Sintetizar los testimonios recolectados y redactar párrafos breves con estructura clara (introducción, desarrollo y recomendación).\n• Crear los mensajes de impacto, frases motivadoras y decálogos que encabezarán cada sección de la guía colectiva 'Pequeños hábitos para sentirnos bien y aprender mejor'.\n• Revisar colectivamente la concordancia, ortografía básica y signos de puntuación de los textos antes de su versión final.",
        recursos: "Borradores de redacción.\nDiccionarios escolares.\nPáginas de diagramación de la guía colectiva."
      },
      {
        fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
        pregunta_orientadora: "¿Cómo cautivamos a la audiencia durante la presentación de nuestra guía?",
        actividades: "• Ensayo de oratoria: practicar modulación de la voz, pausas expresivas y gesticulación corporal para la presentación oral.\n• Presentar formalmente la guía colectiva ante padres y compañeros, relatando anécdotas del proceso y leyendo con expresividad los consejos de bienestar.",
        recursos: "Atril de oratoria.\nGuía colectiva encuadernada.\nCarteles de difusión."
      },
      {
        fase_titulo: "5. Evaluación, reflexión y metacognición",
        pregunta_orientadora: "¿Cómo mejoró mi capacidad de escuchar y expresarme con empatía?",
        actividades: "• Evaluación con la rúbrica disciplinar de Lengua y Literatura (expresión oral, coherencia textual y escucha activa).\n• Dinámica 'El círculo de la palabra': evaluación entre pares y entrega de cartas de agradecimiento por el trabajo cooperativo.",
        recursos: "Rúbrica analítica de comunicación.\nTarjetas de coevaluación."
      }
    ]
  }

  if (norm.includes('SOCIALES') || norm.includes('HISTORIA')) {
    return [
      {
        fase_titulo: "1. PLANIFICACIÓN (Semana 1)",
        pregunta_orientadora: "¿Qué normas de convivencia, deberes y derechos debemos fortalecer en la escuela para garantizar un ambiente armónico y respetuoso de la diversidad?",
        actividades: "• Analizar a la institución como un espacio compartido de interacción social, identificando cómo las diferencias culturales y familiares enriquecen la vida comunitaria.\n• Mapear los espacios de la escuela (aulas, patios, canchas, biblioteca) señalando dónde se generan mayores tensiones o incumplimiento de acuerdos.",
        recursos: "Croquis de la institución educativa.\nTexto escolar de Estudios Sociales.\nTarjetas de derechos y deberes."
      },
      {
        fase_titulo: "2.- Organización e investigación (Semana 1)",
        pregunta_orientadora: "¿Cómo diagnosticamos el cumplimiento de acuerdos en la jornada escolar?",
        actividades: "• Conformar grupos de observadores ciudadanos: Coordinador cívico, Secretario de actas, Mediador de conflictos y Portavoz.\n• Observar las dinámicas durante los recreos y filas, registrando en un cuadro de doble entrada conductas de 'Se puede' (solidaridad, inclusión) y 'No se puede' (discriminación, irrespeto de turnos).\n• Entrevistar a personal de servicio y docentes sobre los acuerdos indispensables para el buen vivir escolar.",
        recursos: "Fichas de observación ciudadana.\nCuadro de comportamientos 'Se puede / No se puede'."
      },
      {
        fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
        pregunta_orientadora: "¿Cómo construimos herramientas tangibles que fortalezcan la paz escolar?",
        actividades: "• Construir colectivamente el mural 'El Árbol de Nuestra Identidad y Convivencia', donde cada rama represente un valor cultural y cada fruto un compromiso cívico.\n• Fabricar y rotular el 'Ánfora de acuerdos escolares', redactando en tarjetas iris los compromisos del grado para erradicar el maltrato y fomentar la inclusión.\n• Redactar la sección de Convivencia y Ciudadanía para la guía colectiva.",
        recursos: "Cartulinas iris, tijeras, goma y pinturas.\nCaja para el ánfora decorada.\nMateriales para el mural cívico."
      },
      {
        fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
        pregunta_orientadora: "¿Cómo involucramos a toda la escuela en nuestro pacto de convivencia?",
        actividades: "• Inaugurar el mural de la identidad ante directivos y comités de aula.\n• Realizar una dramatización corta que contraste un aula en conflicto con una que aplica acuerdos participativos.\n• Instalar el ánfora de acuerdos en un lugar visible para que otros grados depositen sus propuestas.",
        recursos: "Mural escolar.\nÁnfora de acuerdos.\nGuía colectiva."
      },
      {
        fase_titulo: "5. Evaluación, reflexión y metacognición",
        pregunta_orientadora: "¿Qué significa ser un ciudadano solidario dentro de mi aula?",
        actividades: "• Aplicar rúbrica de Estudios Sociales sobre normas, identidad y convivencia armónica.\n• Firmar el 'Pacto Escolar por el Respeto y la Diversidad' para el trimestre.",
        recursos: "Rúbrica disciplinar de Estudios Sociales.\nPergamino del pacto escolar."
      }
    ]
  }

  if (norm.includes('ECA') || norm.includes('ARTÍSTICA') || norm.includes('CULTURAL')) {
    return [
      {
        fase_titulo: "1. PLANIFICACIÓN (Semana 1)",
        pregunta_orientadora: "¿Cómo podemos representar a través del dibujo, gestos, sonidos y texturas las expresiones de nuestro cuerpo al practicar hábitos que benefician nuestro bienestar y descanso?",
        actividades: "• Escuchar pistas de paisajes sonoros y música instrumental observando imágenes de posturas corporales asociadas al descanso, la concentración y la fatiga visual.\n• Explorar movimientos corporales libres ante estímulos musicales contrastantes para reconocer cómo se siente el cuerpo en calma, tensión y relajación.",
        recursos: "Láminas con expresiones y posturas.\nEmoticones ilustrativos.\nPistas de música instrumental y ambiental.\nObras artísticas de referencia."
      },
      {
        fase_titulo: "2.- Organización e investigación (Semana 1)",
        pregunta_orientadora: "¿Qué materiales sensoriales y texturas del entorno podemos explorar y utilizar?",
        actividades: "• Conformar colectivos artísticos asignando roles: Diseñador gráfico, Explorador de texturas, Expresor corporal y Vocero de arte.\n• Recolectar y clasificar materiales del entorno con texturas naturales (hojas secas, cortezas, semillas, piedras, tierra) y artificiales (telas, papeles corrugados, plásticos reciclados).\n• Realizar un frotagge táctil sobre papel para registrar las diferentes sensaciones y relieves de los elementos.",
        recursos: "Hojas secas, semillas, cortezas y piedras.\nRetazos de telas, lanas y papeles con relieve.\nCrayones de cera para frotagge."
      },
      {
        fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
        pregunta_orientadora: "¿Cómo elaboramos la producción visual y la portada que encabezará la guía colectiva?",
        actividades: "• Estampado de huellas y siluetas: trazar siluetas de rostros o manos incorporando elementos identitarios (peinados, accesorios, símbolos personales) con dactilopintura y técnicas mixtas.\n• Crear la lámina de hábitos saludables combinando colores cálidos y fríos para representar estados de energía y descanso.\n• Ensamble visual: diagramar artísticamente la portada y los separadores visuales de la guía colectiva utilizando los collages de texturas.",
        recursos: "Dactilopintura y témperas.\nTierra de color y pinceles gruesos.\nCartulina bristol, goma y tijeras."
      },
      {
        fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
        pregunta_orientadora: "¿Cómo transformamos el aula en una galería viva de arte y bienestar?",
        actividades: "• Montaje de la 'Galería de Expresión Corporal y Texturas': colgar las obras con pinzas de madera en cuerdas tensadas alrededor del aula.\n• Exposición de los creadores: cada alumno explica los materiales seleccionados y cómo su obra refleja un cuerpo relajado y saludable.",
        recursos: "Cuerdas, pinzas de madera, atriles.\nIluminación focal y música de fondo.\nGuía colectiva ensamblada."
      },
      {
        fase_titulo: "5. Evaluación, reflexión y metacognición",
        pregunta_orientadora: "¿De qué forma el arte me ayudó a conocerme y expresar mis emociones?",
        actividades: "• Rúbrica de Educación Cultural y Artística (creatividad plástica, uso de texturas y expresión estética).\n• Reflexión metacognitiva individual sobre el valor del cuerpo como soporte y medio expresivo.",
        recursos: "Rúbrica analítica de ECA.\nFicha de autovaloración creativa."
      }
    ]
  }

  if (norm.includes('FÍSICA') || norm.includes('DEPORTE')) {
    return [
      {
        fase_titulo: "1. PLANIFICACIÓN (Semana 1)",
        pregunta_orientadora: "¿Cómo influyen los juegos activos, las pausas en movimiento y el control de nuestras emociones en la energía que tenemos para aprender y sentirnos bien?",
        actividades: "• Circuito sensorial motriz: realizar juegos de intensidad variable (desplazamientos suaves, carreras de relevos y ejercicios de elongación muscular).\n• Registro de pulsaciones y frecuencia respiratoria antes y después del ejercicio para entender cómo el corazón oxigena el cerebro.\n• Conversatorio en el patio: reflexionar sobre cómo el sedentarismo digital agota la musculatura mientras el juego cooperativo renueva el ánimo.",
        recursos: "Patio o cancha de uso múltiple.\nCronómetro, conos, pelotas y cuerdas.\nPlantilla de registro de pulso cardíaco."
      },
      {
        fase_titulo: "2.- Organización e investigación (Semana 1)",
        pregunta_orientadora: "¿Cómo adaptamos los juegos para garantizar la seguridad e inclusión de todos?",
        actividades: "• Conformar patrullas lúdicas con roles específicos: Líder de juego, Monitor de seguridad y riesgos, Mediador de reglas inclusivas y Cronometrador de pausas.\n• Inspeccionar el área deportiva marcando zonas seguras y libres de obstáculos.\n• Experimentar juegos tradicionales (la rayuela, el elástico, quemadas) identificando qué reglas eliminan a compañeros para diseñar alternativas donde nadie quede fuera.",
        recursos: "Implementos deportivos.\nTiza para delimitar zonas de juego.\nFicha de detección de riesgos de campo."
      },
      {
        fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
        pregunta_orientadora: "¿Cómo diseñamos el manual de juegos y pausas activas para la guía colectiva?",
        actividades: "• Diseñar el 'Juego Inclusivo del Bienestar': redactar paso a paso sus reglas modificadas, puntuaciones colectivas y roles cooperativos.\n• Taller de pausas activas escolares: practicar rutinas de 3 minutos de estiramientos de cuello, muñecas y espalda, combinadas con ejercicios de respiración diafragmática.\n• Redactar la ficha de Educación Física para la guía colectiva ilustrando los pasos de las pausas activas para hacerlas en el aula.",
        recursos: "Colchonetas y aros.\nPlantillas de diagramación para la guía.\nMarcadores y lápices de colores."
      },
      {
        fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
        pregunta_orientadora: "¿Cómo lideramos la recreación activa durante la feria final?",
        actividades: "• Organizar el 'Festival de Juegos Inclusivos' en el patio central durante la feria del proyecto.\n• Los estudiantes dirigen las estaciones de pausas activas para docentes, familias y compañeros de otros grados, explicando la autorregulación emocional ante la derrota o el error.",
        recursos: "Estaciones activas señalizadas.\nImplementos deportivos.\nSilbatos y música rítmica."
      },
      {
        fase_titulo: "5. Evaluación, reflexión y metacognición",
        pregunta_orientadora: "¿Cómo aprendí a autorregular mis emociones y frustraciones durante el juego?",
        actividades: "• Aplicar rúbrica de Educación Física sobre desempeño motor, cooperación, juego limpio y respeto a la diversidad.\n• Compromiso personal de realizar al menos 30 minutos diarios de juego activo sin pantallas en el hogar.",
        recursos: "Rúbrica analítica de Educación Física.\nContrato de compromiso deportivo."
      }
    ]
  }

  if (norm.includes('INGLÉS') || norm.includes('ENGLISH') || norm.includes('EFL')) {
    return [
      {
        fase_titulo: "1. PLANIFICACIÓN (Semana 1)",
        pregunta_orientadora: "Who helps us feel good in our classroom, and how can we talk to them respectfully?",
        actividades: "• The teacher introduces vocabulary about emotions, physical feelings, and polite classroom expressions using flashcards.\n• In pairs, students practice communicative routines: 'How do you feel today?' -> 'I feel happy/tired', and polite phrases: 'Look at the speaker', 'Listen attentively', 'Can you repeat, please?'.",
        recursos: "Emotion flashcards.\nConversational cue cards.\nBoard and markers."
      },
      {
        fase_titulo: "2.- Organización e investigación (Semana 1)",
        pregunta_orientadora: "How do we interview our peers about classroom supporters in English?",
        actividades: "• Form teams of 4 assigning communicative roles: Leader, Timekeeper, Artist, and Speaker.\n• 'The Helper Search': Students use a mini-checklist to interview peers: 'Who helps you learn?' -> 'My teacher / My team / My friend helps me.'\n• Collect 3 key habits in English: 'Drink water daily', 'Take deep breaths', 'Listen with kindness'.",
        recursos: "Classroom Supporters Checklist.\nMini interview sheets.\nVisual posters."
      },
      {
        fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
        pregunta_orientadora: "How do we write and illustrate our English section for the collective guide?",
        actividades: "• Draft team pages for the collective guide 'Small Habits to Feel Good and Learn Better'.\n• Students illustrate helpers and write captions: 'Habit 1: We listen attentively', 'Habit 2: We ask politely: Can you help me, please?', 'Habit 3: We respect different feelings'.\n• Review spelling and sentence structure with teacher assistance.",
        recursos: "Template cards for the guide.\nColored pencils and markers.\nEnglish picture dictionary."
      },
      {
        fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
        pregunta_orientadora: "How do we present our English habits to visitors?",
        actividades: "• 'Gallery Walk and Spoken Showcase': Teams display their guide pages on stands.\n• Oral presentation: Each student speaks one habit aloud: 'Our habit is respectful listening. My friend helps me study.' Visitors answer: 'Thank you for sharing!'.",
        recursos: "Display stands.\nBound Collective Guide in English.\nVisual speaking props."
      },
      {
        fase_titulo: "5. Evaluación, reflexión y metacognición",
        pregunta_orientadora: "What did we learn about kindness, listening, and English communication?",
        actividades: "• Students complete a visual rubric with smiley faces evaluating polite words and active listening.\n• Teacher evaluates using the EFL analytical rubric (declarative, procedural, attitudinal, and final product).",
        recursos: "Visual self-assessment sheet.\nEFL Assessment Rubric."
      }
    ]
  }

  // Fallback genérico estructurado si es una materia atípica
  return [
    {
      fase_titulo: "1. PLANIFICACIÓN (Semana 1)",
      pregunta_orientadora: `¿Cómo podemos investigar el impacto del entorno escolar desde los saberes de ${asig}?`,
      actividades: `• Presentación del reto contextualizado en ${asig}.\n• Lluvia de ideas mediante preguntas generadoras sobre los problemas del aula.\n• Definición de las preguntas clave de investigación grupal.`,
      recursos: "Láminas didácticas, papelógrafos, cuaderno de notas."
    },
    {
      fase_titulo: "2.- Organización e investigación (Semana 1)",
      pregunta_orientadora: `¿Qué instrumentos y roles emplearemos en ${asig}?`,
      actividades: `• Conformar equipos asignando roles: Coordinador, Secretario, Diseñador y Portavoz.\n• Aplicar instrumentos de recolección de información en el plantel vinculados a ${asig}.\n• Tabular y clasificar las evidencias recogidas.`,
      recursos: "Fichas de registro estructuradas, textos escolares."
    },
    {
      fase_titulo: "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
      pregunta_orientadora: `¿Cómo elaboramos la evidencia tangible de ${asig} para el producto integrador?`,
      actividades: `• Elaboración de la sección disciplinar para la guía colectiva.\n• Integración de conceptos, gráficos, consejos y reflexiones prácticas de ${asig}.\n• Revisión de calidad y diseño de la propuesta.`,
      recursos: "Materiales de diseño gráfico, cartulinas, plantillas de la guía."
    },
    {
      fase_titulo: "4. Socialización, presentación y difusión (Semana 2)",
      pregunta_orientadora: `¿Cómo exponemos los resultados a la comunidad educativa?`,
      actividades: `• Exposición pública en la feria del proyecto mediante demostraciones prácticas.\n• Explicación de los hallazgos disciplinares y las recomendaciones de mejora.`,
      recursos: "Stands, paneles expositivos y guía colectiva."
    },
    {
      fase_titulo: "5. Evaluación, reflexión y metacognición",
      pregunta_orientadora: `¿Qué aprendizajes aplicaremos a nuestra vida cotidiana desde ${asig}?`,
      actividades: `• Aplicación de la rúbrica disciplinar analítica.\n• Conversatorio metacognitivo sobre el trabajo en equipo y asunción de compromisos personales.`,
      recursos: "Rúbrica analítica y ficha de autoevaluación."
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

    const gradoFinal = grado || grado_curso || '4to Grado EGB'
    const semanasFinal = Number(numero_semanas || noSemanas || 2)

    // 1. AUTOCOMPLETADO DE ESTRUCTURA
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
          situacion_aprendizaje: situacion_aprendizaje || `En el aula se ha observado que algunos estudiantes presentan dificultades para mantener la atención, organizar su tiempo y concluir actividades en el tiempo previsto.`,
          desafio: desafio || `¿Cómo podemos investigar nuestros hábitos, interpretar las evidencias obtenidas y diseñar acciones para organizar mejor nuestro tiempo, cuidar nuestro bienestar y mejorar nuestros aprendizajes?`,
          producto: producto || `Guía colectiva “Pequeños hábitos para sentirnos bien y aprender mejor”`
        })
      }
    }

    // 2. PROYECTO INTERDISCIPLINAR COMPLETO CON DETALLE POR MATERIA
    if (tipo === 'cnc_proyecto' || tipoModelo === 'cnc_proyecto') {
      const materiasLista = (materias_participantes && materias_participantes.length > 0) 
        ? materias_participantes 
        : ['Ciencias Naturales', 'Matemática', 'Lengua y Literatura', 'Estudios Sociales', 'Educación Cultural y Artística', 'Educación Física', 'Inglés']

      const promptProyecto = `
Eres un Diseñador Curricular experto del Ministerio de Educación de Ecuador.
Diseña la planificación oficial completa del PROYECTO INTERDISCIPLINAR PARA LA EVALUACIÓN SUMATIVA.

DATOS:
- Grado: "${gradoFinal}" | Trimestre: "${trimestre || '1'}" | Duración: ${semanasFinal} semanas
- Título: "${titulo || 'Conectados con nuestro Bienestar'}"
- Situación: "${situacion_aprendizaje || ''}"
- Desafío: "${desafio || ''}"
- Producto: "${producto || ''}"
- Materias: ${materiasLista.join(', ')}
- Competencias: ${JSON.stringify(competencias_a_evaluar || [])}

REGLAS ESTRICTAS DE CONTENIDO:
1. "actividades_por_materia": Genera un elemento por CADA una de las asignaturas (${materiasLista.join(', ')}).
2. PARA CADA MATERIA debes formular las 5 FASES METODOLÓGICAS con total especificidad:
   - "pregunta_orientadora": Específica del área disciplinar (ej. cómo influyen las pantallas en el cerebro en CCNN; cómo clasificar necesidades vs deseos en Matemática; qué texturas y gestos usar en ECA).
   - "actividades": Describe DINÁMICAS ESPECÍFICAS DE AULA, NOMBRA ROLES CONCRETOS EN LA FASE 2 (ej. en ECA: Diseñador gráfico, Explorador de texturas; en Matemática: Encuestador, Registrador de conteo; en CCNN: Observador de descanso, Inspector de hidratación). En la Fase 3 detalla la elaboración manual/cuantitativa/artística de la evidencia del producto.
   - "recursos": Materiales palpables concretos (témperas, hojas secas, semillas, relojes, tablas de frecuencia, cuerdas, flashcards).
   - En INGLÉS/EFL todo debe estar redactado en inglés formal.

Devuelve EXCLUSIVAMENTE este JSON:
{
  "titulo": "${titulo || 'Conectados con nuestro Bienestar'}",
  "objetivo_proyecto": "Objetivo integrador...",
  "descripcion_proyecto": "${situacion_aprendizaje || ''}",
  "desafio": "${desafio || ''}",
  "producto": "${producto || ''}",
  "matriz_curricular": [
    {
      "asignatura": "Nombre",
      "competencias_especificas": "CE...",
      "indicadores_evaluacion": "I...",
      "saberes_declarativos": "...",
      "saberes_procedimentales": "...",
      "saberes_actitudinales": "..."
    }
  ],
  "fases_proyecto": [
    { "fase": "1. Planificación", "pregunta_orientadora": "¿Qué vamos a investigar y para qué?", "resultado": "Propósito, desafío y preguntas" },
    { "fase": "2. Organización o investigación (asignación de roles)", "pregunta_orientadora": "¿Cómo vamos a hacerlo?", "resultado": "Plan de trabajo" },
    { "fase": "3. Ejecución e integración de saberes para la creación del producto", "pregunta_orientadora": "¿Cómo resolvemos el desafío?", "resultado": "Producto + evidencias" },
    { "fase": "4. Socialización, presentación y difusión", "pregunta_orientadora": "¿Qué descubrimos y cómo lo comunicamos?", "resultado": "Presentación del producto" },
    { "fase": "5. Evaluación, reflexión y metacognición", "pregunta_orientadora": "¿Qué aprendimos y qué podemos mejorar?", "resultado": "Metacognición y compromisos" }
  ],
  "actividades_por_materia": [
    {
      "asignatura": "Ciencias Naturales",
      "fases": [
        {
          "fase_titulo": "1. PLANIFICACIÓN (Semana 1)",
          "pregunta_orientadora": "¿De qué manera el descanso, la alimentación y las pantallas afectan a nuestro cerebro y energía?",
          "actividades": "• Dinámica de sensibilización...\\n• Observación de láminas anatómicas...\\n• Preguntas en cuaderno de campo...",
          "recursos": "Láminas del sistema nervioso, infografías de luz azul..."
        },
        {
          "fase_titulo": "2.- Organización e investigación (Semana 1)",
          "pregunta_orientadora": "...",
          "actividades": "• Conformar equipos asignando roles: Observador de descanso, Inspector de hidratación, Cronometrador de pantallas...\\n• Bitácora 'Mi reloj biológico'...",
          "recursos": "..."
        },
        {
          "fase_titulo": "3. Ejecución e integración de saberes para la creación del producto (Semana 2)",
          "pregunta_orientadora": "...",
          "actividades": "• Taller de higiene visual (regla 20-20-20)...\\n• Redacción de las fichas técnicas para la guía colectiva...",
          "recursos": "..."
        },
        {
          "fase_titulo": "4. Socialización, presentación y difusión (Semana 2)",
          "pregunta_orientadora": "...",
          "actividades": "• Montaje del rincón 'Cuerpo sano, mente atenta'...\\n• Demostración guiada...",
          "recursos": "..."
        },
        {
          "fase_titulo": "5. Evaluación, reflexión y metacognición",
          "pregunta_orientadora": "...",
          "actividades": "• Rúbrica disciplinar analítica...\\n• Contrato de compromiso personal...",
          "recursos": "..."
        }
      ]
    }
  ],
  "rubrica_disciplinar": [
    { "criterio": "Recopila y registra datos", "destacado": "Registra de manera completa y ordenada...", "esperado": "Registra correctamente la mayoría...", "proceso": "Registra parcialmente...", "apoyo": "Requiere acompañamiento..." },
    { "criterio": "Organiza los datos", "destacado": "Organiza correctamente en tabla...", "esperado": "Organiza la mayoría...", "proceso": "Presenta errores...", "apoyo": "Requiere apoyo..." },
    { "criterio": "Representa gráficamente la información", "destacado": "Representa con exactitud...", "esperado": "Representa con pocos errores...", "proceso": "Contiene errores...", "apoyo": "Requiere ayuda..." },
    { "criterio": "Interpreta los resultados", "destacado": "Identifica dos o más hallazgos...", "esperado": "Identifica al menos un hallazgo...", "proceso": "Interpretación parcial...", "apoyo": "Conclusiones sin sustento..." },
    { "criterio": "Utiliza los datos para responder al desafío", "destacado": "Justifica claramente la acción...", "esperado": "Propone acción relacionada...", "proceso": "Relación poco clara...", "apoyo": "Requiere apoyo..." }
  ],
  "rubrica_interdisciplinar": [
    { "criterio": "Integración de aprendizajes", "destacado": "Integra de manera clara y coherente...", "esperado": "Relaciona aprendizajes...", "proceso": "Poco relacionados...", "apoyo": "Aislados..." },
    { "criterio": "Respuesta al desafío", "destacado": "Responde claramente sustentado...", "esperado": "Responde al desafío...", "proceso": "Responde parcialmente...", "apoyo": "No responde..." },
    { "criterio": "Uso de evidencias", "destacado": "Utiliza datos y observaciones...", "esperado": "Utiliza evidencias pertinentes...", "proceso": "Utiliza pocas evidencias...", "apoyo": "Sin evidencias..." },
    { "criterio": "Comunicación del producto", "destacado": "Comunica de manera clara y organizada...", "esperado": "Comunica con claridad...", "proceso": "Dificultades de orden...", "apoyo": "Requiere ayuda..." },
    { "criterio": "Creatividad y pertinencia", "destacado": "Propuestas creativas y realistas...", "esperado": "Propuestas pertinentes...", "proceso": "Propuestas generales...", "apoyo": "Poco viables..." },
    { "criterio": "Trabajo colaborativo", "destacado": "Todos participan y cumplen roles...", "esperado": "La mayoría cumple...", "proceso": "Participación desigual...", "apoyo": "Requiere apoyo constante..." }
  ]
}`

      let objetoProyecto: any = null

      try {
        const respuestaIa = await generarConIA(promptProyecto, 4000)
        const jsonLimpio = respuestaIa.replace(/```json/g, '').replace(/```/g, '').trim()
        objetoProyecto = JSON.parse(jsonLimpio)

        // Validación estricta: si la IA devolvió actividades_por_materia vacías o genéricas, inyectamos el detalle curricular
        if (!objetoProyecto.actividades_por_materia || objetoProyecto.actividades_por_materia.length === 0) {
          objetoProyecto.actividades_por_materia = materiasLista.map((m: string) => ({
            asignatura: m,
            fases: construirActividadesEspecificasPorMateria(m, objetoProyecto.titulo, objetoProyecto.producto)
          }))
        }
      } catch (errorIa: any) {
        console.warn('⚠️ IA en timeout o error de parsing, activando motor pedagógico estructurado:', errorIa.message)
        
        objetoProyecto = {
          titulo: titulo || 'Conectados con nuestro Bienestar',
          objetivo_proyecto: `Investigar hábitos y factores que pueden influir en el bienestar y el aprendizaje de los estudiantes en ${gradoFinal}, mediante la observación, la recopilación e interpretación de información y el análisis desde diferentes asignaturas, para proponer acciones sencillas que contribuyan al cuidado personal, la organización del tiempo, la convivencia y el aprendizaje.`,
          descripcion_proyecto: situacion_aprendizaje || `En el aula se ha observado que algunos estudiantes presentan dificultades para mantener la atención, organizar su tiempo y concluir determinadas actividades en el tiempo previsto. Sin embargo, no se conocen con certeza los factores relacionados con esta situación. A través del proyecto, los estudiantes investigarán hábitos cotidianos y diseñarán propuestas aplicables.`,
          desafio: desafio || `¿Cómo podemos investigar nuestros hábitos, interpretar las evidencias obtenidas y diseñar acciones para organizar mejor nuestro tiempo, cuidar nuestro bienestar, fortalecer nuestra convivencia y mejorar nuestros aprendizajes?`,
          producto: producto || `Guía colectiva “Pequeños hábitos para sentirnos bien y aprender mejor”, elaborada con resultados de la investigación del grupo, tablas o gráficos sencillos, textos breves, ilustraciones, mensajes y propuestas de acciones.`,
          matriz_curricular: materiasLista.map((asig: string) => {
            const itemComp = competencias_a_evaluar?.find((c: any) => c.asignatura === asig)
            return {
              asignatura: asig,
              competencias_especificas: itemComp?.competencia || `Desarrollar y aplicar saberes y destrezas de ${asig} orientados a la solución del desafío del proyecto.`,
              indicadores_evaluacion: `Aplica los contenidos y destrezas de ${asig} en la elaboración de evidencias para el producto integrador.`,
              saberes_declarativos: `Conceptos fundamentales y terminología esencial de ${asig}.`,
              saberes_procedimentales: `Recopilar, organizar e interpretar información aplicada a la vida cotidiana.`,
              saberes_actitudinales: `Demostrar responsabilidad, apertura al diálogo, empatía y trabajo colaborativo.`
            }
          }),
          fases_proyecto: [
            { fase: "1. Planificación", pregunta_orientadora: "¿Qué vamos a investigar y para qué?", resultado: "Propósito, desafío y preguntas" },
            { fase: "2. Organización o investigación (asignación de roles)", pregunta_orientadora: "¿Cómo vamos a hacerlo?", resultado: "Plan de trabajo" },
            { fase: "3. Ejecución e integración de saberes para la creación del producto", pregunta_orientadora: "¿Cómo resolvemos el desafío?", resultado: "Producto + evidencias" },
            { fase: "4. Socialización, presentación y difusión", pregunta_orientadora: "¿Qué descubrimos y cómo lo comunicamos?", resultado: "Presentación del producto" },
            { fase: "5. Evaluación, reflexión y metacognición", pregunta_orientadora: "¿Qué aprendimos y qué podemos mejorar?", resultado: "Metacognición y compromisos" }
          ],
          actividades_por_materia: materiasLista.map((m: string) => ({
            asignatura: m,
            fases: construirActividadesEspecificasPorMateria(m, titulo || 'Conectados con nuestro Bienestar', producto || 'Guía colectiva')
          })),
          rubrica_disciplinar: [
            { criterio: "Recopila y registra datos", destacado: "Registra de manera completa y ordenada los datos obtenidos, sin alterar la información.", esperado: "Registra correctamente la mayoría de los datos obtenidos.", proceso: "Registra los datos de manera parcial o presenta algunas inconsistencias.", apoyo: "Requiere acompañamiento para registrar los datos obtenidos." },
            { criterio: "Organiza los datos", destacado: "Organiza correctamente todos los datos en una tabla y facilita su lectura y comparación.", esperado: "Organiza correctamente la mayoría de los datos en una tabla.", proceso: "Organiza parcialmente los datos y presenta errores que dificultan su lectura.", apoyo: "Requiere apoyo para organizar los datos." },
            { criterio: "Representa gráficamente la información", destacado: "Representa correctamente los datos y utiliza de manera adecuada título, categorías y valores.", esperado: "Representa los datos de forma comprensible con pocos errores.", proceso: "La representación contiene varios errores o elementos incompletos.", apoyo: "Requiere acompañamiento para construir la representación gráfica." },
            { criterio: "Interpreta los resultados", destacado: "Compara los datos e identifica correctamente dos o más hallazgos relevantes sobre los hábitos investigados.", esperado: "Identifica al menos un hallazgo correcto a partir de los datos.", proceso: "Realiza interpretaciones parciales o poco relacionadas con los datos.", apoyo: "Presenta conclusiones que no se sustentan todavía en los datos obtenidos." },
            { criterio: "Utiliza los datos para responder al desafío", destacado: "Utiliza los resultados para justificar claramente una acción o recomendación relacionada con el bienestar.", esperado: "Propone una acción o recomendación relacionada con los resultados obtenidos.", proceso: "Propone una acción, pero establece una relación poco clara con los datos.", apoyo: "Requiere apoyo para relacionar los resultados con una propuesta." }
          ],
          rubrica_interdisciplinar: [
            { criterio: "Integración de aprendizajes", destacado: "La guía integra de manera clara y coherente aprendizajes de varias asignaturas para comprender la problemática.", esperado: "La guía relaciona aprendizajes de varias asignaturas de manera adecuada.", proceso: "Se observan aportes de distintas asignaturas, pero aparecen poco relacionados entre sí.", apoyo: "Los aportes aparecen aislados y todavía no evidencian integración." },
            { criterio: "Respuesta al desafío", destacado: "Las propuestas responden claramente al desafío y están sustentadas en los datos e información investigados.", esperado: "Las propuestas responden al desafío y se relacionan con los principales hallazgos.", proceso: "Las propuestas responden parcialmente al desafío o presentan poca relación con la investigación.", apoyo: "Las propuestas no responden claramente al desafío planteado." },
            { criterio: "Uso de evidencias", destacado: "Utiliza datos, textos, observaciones y otras evidencias del proyecto para explicar y justificar sus conclusiones.", esperado: "Utiliza evidencias pertinentes para sustentar la mayoría de sus conclusiones.", proceso: "Utiliza algunas evidencias, pero no siempre las relaciona con sus conclusiones.", apoyo: "Presenta conclusiones sin utilizar suficientemente las evidencias recogidas." },
            { criterio: "Comunicación del producto", destacado: "Comunica los hallazgos y propuestas de manera clara, organizada y comprensible mediante recursos escritos, gráficos u orales.", esperado: "Comunica de manera clara los principales hallazgos y propuestas.", proceso: "La comunicación presenta dificultades de organización o claridad.", apoyo: "Requiere acompañamiento para comunicar los principales hallazgos del proyecto." },
            { criterio: "Creatividad y pertinencia", destacado: "Presenta acciones creativas, realistas y posibles de aplicar en la vida cotidiana de los estudiantes.", esperado: "Presenta acciones pertinentes y posibles de aplicar.", proceso: "Presenta acciones generales o poco contextualizadas.", apoyo: "Las acciones propuestas son poco viables o no guardan relación suficiente con la problemática." },
            { criterio: "Trabajo colaborativo", destacado: "Todos los integrantes participan, asumen responsabilidades, escuchan y contribuyen al producto común.", esperado: "La mayoría participa y cumple las responsabilidades acordadas.", proceso: "La participación y distribución de responsabilidades es desigual.", apoyo: "El equipo requiere acompañamiento constante para organizarse y trabajar conjuntamente." }
          ]
        }
      }

      // 3. GUARDADO EN BASE DE DATOS
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
            bloques_competencias: objetoProyecto.matriz_curricular || competencias_a_evaluar || [],
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

    // 4. MODELOS ANTERIORES INTACTOS
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
      jsonText = await generarConIA(promptText, 3500)

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

      jsonText = await generarConIA(promptText, 3800)

    } else {
      promptText = `
Planificación disciplinar trimestral (Currículo por Competencias):
- Tema: "${tema || ''}" | Subnivel: "${subnivel || ''}" | Grado: "${gradoFinal}" | Asignatura: "${asignatura || ''}"

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