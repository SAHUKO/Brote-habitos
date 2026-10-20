/**
 * ai.js
 * Integración real con la API gratuita de Google Gemini (generativelanguage.googleapis.com).
 * La app llama DIRECTAMENTE desde el navegador a la API de Google con la clave
 * que el propio usuario introduce en Ajustes (se guarda solo en localStorage,
 * nunca se envía a ningún servidor propio: no existe backend en este proyecto).
 *
 * Cómo conseguir una clave gratuita: https://aistudio.google.com/apikey
 */

// Modelos soportados (el primero es el predeterminado).
const GEMINI_MODELS = ["gemini-3.6-flash"];

// Idiomas en los que puede responder el asistente (el primero es el predeterminado).
// "prompt" es cómo se le nombra el idioma a la IA dentro de las instrucciones.
const AI_LANGUAGES = [
  { id: "es", label: "Español",   prompt: "español de España" },
  { id: "en", label: "English",   prompt: "English" },
  { id: "ca", label: "Català",    prompt: "catalán (català)" },
  { id: "gl", label: "Galego",    prompt: "gallego (galego)" },
  { id: "eu", label: "Euskara",   prompt: "euskera (euskara)" },
  { id: "pt", label: "Português", prompt: "portugués de Portugal (português)" },
  { id: "fr", label: "Français",  prompt: "francés (français)" },
];

function getAiLanguage() {
  const id = getSettings().aiLanguage;
  return AI_LANGUAGES.find(l => l.id === id) || AI_LANGUAGES[0];
}

const GEMINI_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/*
 * Por qué estos valores:
 * - Los modelos Gemini 3 "piensan" antes de responder y ese razonamiento interno
 *   (en inglés) cuenta dentro de maxOutputTokens. Con el antiguo límite de 400
 *   el modelo se quedaba sin tokens a mitad del razonamiento y la app mostraba
 *   ese trozo cortado en inglés en vez de la respuesta.
 * - Por eso se sube el margen y se pide un nivel de razonamiento bajo: las
 *   respuestas son cortas y no necesitan pensar mucho (además, son más rápidas).
 */
const GEMINI_MAX_OUTPUT_TOKENS = 2048;
const GEMINI_THINKING = { thinkingLevel: "low" };

async function postGemini(model, apiKey, body) {
  try {
    return await fetch(`${GEMINI_ENDPOINT(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error("No se pudo conectar con la API de Gemini. Revisa tu conexión a internet.");
  }
}

async function readErrorDetail(response) {
  try {
    const errJson = await response.json();
    return errJson?.error?.message || "";
  } catch (_) {
    return "";
  }
}

/**
 * Llama a Gemini con un prompt de texto y devuelve la respuesta como string.
 * Lanza un Error con un mensaje ya traducido al español para mostrar en la UI.
 */
async function callGemini(prompt) {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey;
  // Solo se usa un modelo verificado como operativo; si en Ajustes quedó guardado
  // otro (versiones anteriores de la app), se ignora y se usa el recomendado.
  const model = GEMINI_MODELS.includes(settings.geminiModel) ? settings.geminiModel : GEMINI_MODELS[0];
  const lang = getAiLanguage();

  if (!apiKey) {
    throw new Error("No hay ninguna clave de API configurada. Ve a Ajustes para añadirla (es gratis).");
  }

  const body = {
    // Instrucción de sistema: tiene más peso que el prompt para fijar el idioma.
    systemInstruction: {
      parts: [{
        text: `Eres Brote IA, el asistente de una app de hábitos. Responde SIEMPRE y ÚNICAMENTE en ${lang.prompt}, aunque los datos o las instrucciones estén en otro idioma. Da solo la respuesta final, sin mostrar tu razonamiento, notas internas ni borradores.`,
      }],
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      thinkingConfig: GEMINI_THINKING,
    },
  };

  let response = await postGemini(model, apiKey, body);

  // Si el modelo no admite el ajuste de razonamiento, se reintenta una vez sin él.
  if (response.status === 400) {
    const detail = await readErrorDetail(response);
    if (/API key/i.test(detail)) {
      throw new Error("La clave de API no es válida. Revísala en Ajustes.");
    }
    if (/think/i.test(detail)) {
      delete body.generationConfig.thinkingConfig;
      response = await postGemini(model, apiKey, body);
    } else {
      throw new Error(`Error de la API de Gemini (400). ${detail}`);
    }
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    if (response.status === 400 && /API key/i.test(detail)) {
      throw new Error("La clave de API no es válida. Revísala en Ajustes.");
    }
    if (response.status === 403) {
      throw new Error("La clave no tiene permisos o la API no está habilitada para esta clave.");
    }
    if (response.status === 429) {
      throw new Error("Se ha superado el límite gratuito de peticiones por minuto. Espera un momento y vuelve a intentarlo.");
    }
    throw new Error(`Error de la API de Gemini (${response.status}). ${detail}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  // Se descartan las partes de razonamiento interno (thought: true): solo interesa la respuesta.
  const text = (candidate?.content?.parts || [])
    .filter(p => !p.thought)
    .map(p => p.text || "")
    .join("")
    .trim();

  if (candidate?.finishReason === "MAX_TOKENS") {
    // Mejor avisar que enseñar una respuesta a medias.
    throw new Error("La respuesta de la IA se quedó a medias. Vuelve a pulsar el botón para intentarlo de nuevo.");
  }
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason || candidate?.finishReason === "SAFETY") {
      throw new Error("La respuesta fue bloqueada por los filtros de seguridad de Gemini. Prueba de nuevo.");
    }
    throw new Error("La IA no devolvió ninguna respuesta. Inténtalo de nuevo.");
  }
  return text;
}

/** Pequeña llamada de prueba para el botón "Probar conexión" de Ajustes. */
async function testGeminiConnection() {
  const text = await callGemini("Responde únicamente con la palabra: Conectado");
  return text;
}

function buildHabitsSummaryForPrompt() {
  const habits = getHabits();
  if (habits.length === 0) return "El usuario todavía no ha creado ningún hábito.";
  const rate14 = dailyCompletionRate(14);
  const avgRate = Math.round(
    (rate14.reduce((a, d) => a + d.rate, 0) / rate14.length) * 100
  );
  const lines = habits.map(h => {
    const cat = getCategory(h.category).name;
    return `- ${h.name} (categoría: ${cat}, racha actual: ${diasTxt(currentStreak(h.id))}, mejor racha: ${diasTxt(bestStreak(h.id))})`;
  });
  return `Hábitos actuales del usuario:\n${lines.join("\n")}\n\nPorcentaje medio de cumplimiento en los últimos 14 días: ${avgRate}%.`;
}

/** Analiza el progreso reciente del usuario y da feedback + 1 sugerencia accionable. */
async function aiAnalyzeProgress() {
  const summary = buildHabitsSummaryForPrompt();
  const lang = getAiLanguage().prompt;
  const prompt = `Eres un coach de hábitos breve, cercano y motivador.
${summary}

Analiza este progreso en un máximo de 110 palabras: reconoce lo que va bien, señala con delicadeza un punto de mejora si lo hay, y termina con UNA sola recomendación concreta y accionable para los próximos días. No uses listas ni markdown, escribe en prosa cercana, tuteando al usuario.
Escribe toda la respuesta en ${lang}.`;
  return callGemini(prompt);
}

/** Sugiere un nuevo hábito complementario a los que ya tiene el usuario. */
async function aiSuggestHabit() {
  const summary = buildHabitsSummaryForPrompt();
  const lang = getAiLanguage().prompt;
  const prompt = `Eres un coach de hábitos.
${summary}

Sugiere UN único hábito nuevo que complemente bien a los que ya tiene el usuario (que no esté ya en su lista) y explica en máximo 90 palabras por qué encaja con su rutina actual. Escribe en prosa cercana, tuteando, sin listas ni markdown. Empieza directamente con el nombre del hábito en negrita usando doble asterisco, así: **Nombre del hábito**: seguido de la explicación.
Escribe toda la respuesta, incluido el nombre del hábito, en ${lang}.`;
  return callGemini(prompt);
}

/** Consejo corto del día para el panel del dashboard (se cachea por fecha). */
async function aiDailyTip() {
  const summary = buildHabitsSummaryForPrompt();
  const lang = getAiLanguage().prompt;
  const prompt = `Eres un coach de hábitos motivador.
${summary}

Escribe un único consejo o frase motivadora de un máximo de 35 palabras para el día de hoy, relacionado con la constancia y los hábitos. Sin comillas, sin markdown, una sola frase.
Escríbelo en ${lang}.`;
  return callGemini(prompt);
}
