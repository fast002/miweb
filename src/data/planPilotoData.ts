// src/data/planPilotoData.ts

export interface ItemCurricular {
  competencia: string;
  indicador: string;
  declarativo: string;
  procedimental: string;
  actitudinal: string;
  declarative?: string;   // Compatibilidad opcional por si el linter busca en inglés
  procedural?: string;    // Compatibilidad opcional
  attitudinal?: string;   // Compatibilidad opcional
  orientaciones?: string;
  conexiones?: string;
}

export const PLAN_PILOTO_CURRICULO: Record<string, Record<string, ItemCurricular[]>> = {
  "Idioma Extranjero (Inglés)": {
    "PRIMER AÑO BGU (Inglés)": [
      {
        "competencia": "CE.EFL.5.1. Expansion of communicative awareness through the analysis of non-verbal language in audiovisual contexts in English, including gestures, facial expressions, and body language, to understand communication as a multimodal process. CC, CCICC, CSE, CECA.",
        "indicador": "I.EFL.5.1.1. Identify and describe at least three types of nonverbal cues - gesture, facial expression, posture, or gaze - in an audiovisual fragment in English, explaining what each conveys and how it complements or contradicts the verbal message.\nI.EFL.5.1.2. Compare nonverbal communication conventions in two different English-speaking cultural contexts, explaining observed similarities and differences with supporting examples from the materials viewed.\nI.EFL.5.1.3. Evaluate how nonverbal resources in a short video or speech change the overall communicative effect, justifying the analysis with evidence from the viewed text and relevant terminology.",
        "declarativo": "EFL.5.1.d.4. Nonverbal and paralinguistic resources in English-language communication: gestures, gaze, facial expressions, posture, proxemics, and their cultural variation across contexts.\nEFL.5.3.d.28. Cultural diversity of English-using communities: language and cultural practices in the Philippines, Kenya, Tanzania, Aotearoa/New Zealand, Vietnam, India, Jamaica, Singapore, and Ireland - their histories with English, distinct voices, and contributions to global culture and knowledge.",
        "procedimental": "EFL.5.1.p.3. Understand TV programs, films, and online video content on familiar topics, identifying the setting, characters' stances, and the emotional tone of exchanges.\nEFL.5.1.p.4. Identify a speaker's attitude, opinion, and degree of certainty in interviews, debates, and discussions, using lexical and prosodic cues.",
        "actitudinal": "EFL.5.2.a.1. Show genuine attention and respect when others are speaking in English by maintaining eye contact, using appropriate backchanneling, and waiting for natural pauses before responding.\nEFL.5.2.a.4. Show curiosity and openness toward the cultural practices, values, and perspectives of English-using communities.",
        "orientaciones": "Employ Project-Based Learning, inquiry, case-study analysis, the flipped classroom, and gamification to analyze nonverbal and paralinguistic resources in global English without resorting to mimicry or stereotypes.",
        "conexiones": "Lengua y Literatura, Estudios Sociales, Educación Cultural y Artística, Filosofía."
      },
      {
        "competencia": "CE.EFL.5.2. Development of inclusive communication through a short audio guide for a local cultural exhibition, using guided recording and revision to share local knowledge with English-speaking visitors and to recognize community voices and cultural heritage. CCICC, CD, CECA, CIT.",
        "indicador": "I.EFL.5.2.1. Produce a short audio guide for a local cultural space or exhibition that includes an introduction, descriptions of at least two exhibits, and a closing statement, using appropriate register and clear pronunciation.\nI.EFL.5.2.2. Describe and explain the significance of a local cultural object, practice, or place in English, using vocabulary related to heritage, community, and identity, and including at least one community voice or perspective.\nI.EFL.5.2.3. Revise a recorded audio guide using peer feedback and a checklist focused on content accuracy, register, pronunciation clarity, and the inclusion of local voices.",
        "declarativo": "EFL.5.2.d.1. Registers in spoken English formal, semi-formal, and informal and the vocabulary, intonation, and formulas that distinguish them across face-to-face, phone, and digital interactions.\nEFL.5.2.d.3. Prosodic features used for emphasis and contrast: sentence stress on key information, contrastive stress, rising and falling intonation in statements and different question types.",
        "procedimental": "EFL.5.2.p.5. Give a structured oral presentation on an academic or community topic, using visual aids and clearly organising information into an introduction, main points, and a conclusion.\nEFL.5.2.p.39. Act as an informal interpreter for short exchanges in school or community contexts, facilitating communication between English and Spanish speakers with accuracy and respect.",
        "actitudinal": "EFL.5.2.a.16. Show commitment to accuracy and improvement in language production, using feedback from rubrics, peers, and teachers as a resource for growth rather than a judgment.\nEFL.5.3.a.24. Engage with artistic and multimodal production as expressive acts that contribute one's own voice to a shared cultural record.",
        "orientaciones": "Guide students through Project-Based Learning, service learning, inquiry, case-study analysis, and gamification to produce an English-language audio guide for an existing local exhibition.",
        "conexiones": "Lengua y Literatura, Estudios Sociales, Educación Cultural y Artística, Tecnologías de la Información y la Comunicación."
      }
    ]
  }
};