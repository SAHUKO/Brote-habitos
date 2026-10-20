/**
 * storage.js
 * Toda la persistencia de la app vive en localStorage, en tres claves:
 *   gh_habits       -> array de hábitos del usuario
 *   gh_completions  -> { [habitId]: ["2026-09-18", "2026-09-19", ...] }
 *   gh_settings     -> { theme, geminiApiKey, geminiModel, dailyTip }
 *
 * No se usa ningún backend: todo el estado se lee/escribe aquí y el resto
 * de la app solo llama a estas funciones.
 */

const LS_HABITS = "gh_habits";
const LS_COMPLETIONS = "gh_completions";
const LS_SETTINGS = "gh_settings";

// ---------- Utilidades de fecha ----------
function todayISO() {
  return dateToISO(new Date());
}
function dateToISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateToISO(d);
}
function isoAddDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return dateToISO(date);
}

// "1 día" / "2 días"
function diasTxt(n) {
  return n + (n === 1 ? " día" : " días");
}

// ---------- Lectura / escritura genérica ----------
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error leyendo", key, e);
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("Error guardando", key, e);
    return false;
  }
}

// ---------- Hábitos ----------
function getHabits() {
  return loadJSON(LS_HABITS, []);
}
function saveHabits(habits) {
  saveJSON(LS_HABITS, habits);
}
function addHabit({ name, icon, category, sourceId = null }) {
  const habits = getHabits();
  const habit = {
    id: "h_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: name.trim(),
    icon: icon && icon.trim() ? icon.trim() : "🌟",
    category,
    sourceId,
    createdAt: todayISO(),
    archived: false,
  };
  habits.push(habit);
  saveHabits(habits);
  return habit;
}
function deleteHabit(habitId) {
  const habits = getHabits().filter(h => h.id !== habitId);
  saveHabits(habits);
  const completions = getCompletions();
  delete completions[habitId];
  saveCompletions(completions);
}
function isHabitFromCatalogAdded(sourceId) {
  return getHabits().some(h => h.sourceId === sourceId);
}

// ---------- Completados ----------
function getCompletions() {
  return loadJSON(LS_COMPLETIONS, {});
}
function saveCompletions(data) {
  saveJSON(LS_COMPLETIONS, data);
}
function isCompletedOn(habitId, iso) {
  const completions = getCompletions();
  return (completions[habitId] || []).includes(iso);
}
function toggleCompletion(habitId, iso) {
  const completions = getCompletions();
  if (!completions[habitId]) completions[habitId] = [];
  const idx = completions[habitId].indexOf(iso);
  if (idx >= 0) {
    completions[habitId].splice(idx, 1);
  } else {
    completions[habitId].push(iso);
  }
  saveCompletions(completions);
  return completions[habitId].includes(iso);
}

// ---------- Rachas ----------
// Racha actual: días consecutivos hasta hoy (o ayer, si hoy aún no se ha marcado) con el hábito completado.
function currentStreak(habitId) {
  const completions = new Set((getCompletions()[habitId] || []));
  let streak = 0;
  let cursor = todayISO();
  // si hoy no está marcado, empezamos a contar desde ayer (no rompe la racha activa)
  if (!completions.has(cursor)) {
    cursor = isoDaysAgo(1);
  }
  while (completions.has(cursor)) {
    streak++;
    cursor = isoAddDays(cursor, -1);
  }
  return streak;
}
function bestStreak(habitId) {
  const days = (getCompletions()[habitId] || []).slice().sort();
  if (days.length === 0) return 0;
  let best = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    if (isoAddDays(days[i - 1], 1) === days[i]) {
      run++;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }
  return best;
}
function globalBestStreak() {
  const habits = getHabits();
  if (habits.length === 0) return 0;
  return Math.max(0, ...habits.map(h => bestStreak(h.id)));
}

// ---------- Estadísticas agregadas ----------
function completionsTodayCount() {
  const today = todayISO();
  const habits = getHabits();
  return habits.filter(h => isCompletedOn(h.id, today)).length;
}
function completionsThisMonthCount() {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const completions = getCompletions();
  let total = 0;
  Object.values(completions).forEach(arr => {
    total += arr.filter(iso => iso.startsWith(prefix)).length;
  });
  return total;
}
// Devuelve [{iso, rate}] para los últimos n días (rate = 0..1)
function dailyCompletionRate(n) {
  const habits = getHabits();
  const completions = getCompletions();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const iso = isoDaysAgo(i);
    const activeThatDay = habits.filter(h => h.createdAt <= iso);
    const total = activeThatDay.length;
    const done = activeThatDay.filter(h => (completions[h.id] || []).includes(iso)).length;
    out.push({ iso, rate: total ? done / total : 0, done, total });
  }
  return out;
}
function completionsByCategory() {
  const habits = getHabits();
  const completions = getCompletions();
  const totals = {};
  CATEGORIES.forEach(c => totals[c.id] = 0);
  habits.forEach(h => {
    const n = (completions[h.id] || []).length;
    totals[h.category] = (totals[h.category] || 0) + n;
  });
  return totals;
}

// ---------- Ajustes ----------
function getSettings() {
  return loadJSON(LS_SETTINGS, { theme: "light", geminiApiKey: "", geminiModel: "gemini-3.6-flash", dailyTip: null });
}
function saveSettings(settings) {
  saveJSON(LS_SETTINGS, settings);
}
function updateSettings(partial) {
  const s = getSettings();
  const merged = { ...s, ...partial };
  saveSettings(merged);
  return merged;
}

// ---------- Backup / reset ----------
function exportAllData() {
  return {
    habits: getHabits(),
    completions: getCompletions(),
    settings: { ...getSettings(), geminiApiKey: "" }, // no exportamos la clave por seguridad
    exportedAt: new Date().toISOString(),
    app: "Brote",
    version: 1,
  };
}
function importAllData(payload) {
  if (!payload || !Array.isArray(payload.habits) || typeof payload.completions !== "object") {
    throw new Error("Archivo de copia no válido");
  }
  saveHabits(payload.habits);
  saveCompletions(payload.completions);
  if (payload.settings) {
    const current = getSettings();
    saveSettings({ ...current, ...payload.settings, geminiApiKey: current.geminiApiKey });
  }
}
function resetAllData() {
  localStorage.removeItem(LS_HABITS);
  localStorage.removeItem(LS_COMPLETIONS);
  const s = getSettings();
  saveSettings({ theme: s.theme, geminiApiKey: s.geminiApiKey, geminiModel: s.geminiModel, dailyTip: null });
}
// Borra todas las marcas de "completado" pero conserva los hábitos.
function clearHistoryOnly() {
  saveCompletions({});
  updateSettings({ dailyTip: null });
}

function exportCsv() {
  const habits = getHabits();
  const completions = getCompletions();
  const rows = [["hábito", "categoría", "fecha"]];
  habits.forEach(h => {
    (completions[h.id] || []).slice().sort().forEach(iso => {
      rows.push([h.name, getCategory(h.category).name, iso]);
    });
  });
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}
