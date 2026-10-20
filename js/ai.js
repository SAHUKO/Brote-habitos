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

const GEMINI_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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

  if (!apiKey) {
    throw new Error("No hay ninguna clave de API configurada. Ve a Ajustes para añadirla (es gratis).");
  }

  let response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 400 },
      }),
    });
  } catch (networkErr) {
    throw new Error("No se pudo conectar con la API de Gemini. Revisa tu conexión a internet.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || "";
    } catch (_) {}
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
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error("La respuesta fue bloqueada por los filtros de seguridad de Gemini. Prueba de nuevo.");
    }
    throw new Error("La IA no devolvió ninguna respuesta. Inténtalo de nuevo.");
  }
  return text.trim();
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
  const prompt = `Eres un coach de hábitos breve, cercano y motivador que escribe en español de España.
${summary}

Analiza este progreso en un máximo de 110 palabras: reconoce lo que va bien, señala con delicadeza un punto de mejora si lo hay, y termina con UNA sola recomendación concreta y accionable para los próximos días. No uses listas ni markdown, escribe en prosa cercana, tuteando al usuario.`;
  return callGemini(prompt);
}

/** Sugiere un nuevo hábito complementario a los que ya tiene el usuario. */
async function aiSuggestHabit() {
  const summary = buildHabitsSummaryForPrompt();
  const prompt = `Eres un coach de hábitos que escribe en español de España.
${summary}

Sugiere UN único hábito nuevo que complemente bien a los que ya tiene el usuario (que no esté ya en su lista) y explica en máximo 90 palabras por qué encaja con su rutina actual. Escribe en prosa cercana, tuteando, sin listas ni markdown. Empieza directamente con el nombre del hábito en negrita usando doble asterisco, así: **Nombre del hábito**: seguido de la explicación.`;
  return callGemini(prompt);
}

/** Consejo corto del día para el panel del dashboard (se cachea por fecha). */
async function aiDailyTip() {
  const summary = buildHabitsSummaryForPrompt();
  const prompt = `Eres un coach de hábitos motivador que escribe en español de España.
${summary}

Escribe un único consejo o frase motivadora de un máximo de 35 palabras para el día de hoy, relacionado con la constancia y los hábitos. Sin comillas, sin markdown, una sola frase.`;
  return callGemini(prompt);
}
