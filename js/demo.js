/**
 * demo.js
 * Datos de ejemplo para ver la app "con vida" (gráficas, rachas y mapa de
 * constancia) sin tener que esperar semanas de uso real.
 *
 * - Los hábitos de ejemplo llevan la marca `demo: true`, así se pueden quitar
 *   sin tocar los hábitos que haya creado el usuario.
 * - El historial se genera con un generador pseudoaleatorio con semilla fija:
 *   siempre sale el mismo patrón, pero las fechas se calculan respecto a HOY,
 *   de modo que los últimos días y las rachas siempre están al día.
 * - Cubre las 8 categorías y distintos "ritmos" (constante, mejorando, solo
 *   entre semana, con un bache...) para que las gráficas y el mapa de calor
 *   tengan variedad real.
 *
 * Depende de data.js (HABIT_CATALOG) y storage.js (hábitos, completados, fechas).
 */

// Pequeño PRNG determinista (mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Día de la semana de una fecha ISO: 0 = lunes ... 6 = domingo
function weekdayIndex(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/*
 * Cada hábito de ejemplo se apoya en uno del catálogo (sourceId) y define:
 *   daysAgo   -> cuántos días atrás "se creó" (fecha de alta)
 *   seed      -> semilla del generador
 *   prob      -> probabilidad de cumplirlo ese día: (díaSemana 0-6, t 0..1, díasAtrás) => 0..1
 *   forceLast -> los últimos N días se marcan seguro (para tener una racha actual visible)
 */
const DEMO_HABITS = [
  // Salud física
  { sourceId: "c-agua",        daysAgo: 178, seed: 11, forceLast: 12, prob: () => 0.9 },                                   // muy constante, con racha actual
  { sourceId: "c-ejercicio",   daysAgo: 178, seed: 67, forceLast: 0,  prob: (wd) => ([0, 2, 4].includes(wd) ? 0.85 : 0.2) }, // lunes, miércoles y viernes
  { sourceId: "c-dormir",      daysAgo: 178, seed: 89, forceLast: 0,  prob: (wd, t, ago) => (ago >= 50 && ago <= 64 ? 0.1 : 0.6) }, // con un bache de dos semanas
  // Alimentación
  { sourceId: "c-fruver",      daysAgo: 140, seed: 29, forceLast: 0,  prob: () => 0.5 },                                   // irregular
  // Mente y bienestar
  { sourceId: "c-meditar",     daysAgo: 150, seed: 37, forceLast: 0,  prob: (wd, t) => 0.15 + 0.75 * t },                  // mejora con el tiempo
  // Productividad
  { sourceId: "c-planificar",  daysAgo: 100, seed: 43, forceLast: 0,  prob: (wd) => (wd < 5 ? 0.7 : 0.15) },               // casi solo entre semana
  // Aprendizaje
  { sourceId: "c-leer",        daysAgo: 120, seed: 41, forceLast: 0,  prob: (wd) => (wd < 5 ? 0.8 : 0.45) },
  // Finanzas
  { sourceId: "c-gastos",      daysAgo: 60,  seed: 71, forceLast: 0,  prob: () => 0.5 },                                   // hábito más reciente e irregular
  // Social y relaciones
  { sourceId: "c-llamar",      daysAgo: 90,  seed: 79, forceLast: 0,  prob: (wd) => (wd === 6 ? 0.9 : 0.2) },              // sobre todo los domingos
  // Creatividad
  { sourceId: "c-instrumento", daysAgo: 45,  seed: 97, forceLast: 0,  prob: (wd) => ([1, 3, 5].includes(wd) ? 0.8 : 0.15) }, // martes, jueves y sábado
];

function generateDemoDays(cfg) {
  const rand = mulberry32(cfg.seed);
  const days = [];
  for (let ago = cfg.daysAgo; ago >= 0; ago--) {
    const iso = isoDaysAgo(ago);
    const t = 1 - ago / cfg.daysAgo; // 0 = alta, 1 = hoy
    const p = cfg.prob(weekdayIndex(iso), t, ago);
    const r = rand(); // se consume siempre para que el patrón sea estable
    if (ago < cfg.forceLast || r < p) days.push(iso);
  }
  return days;
}

function demoHabitCount() {
  return getHabits().filter(h => h.demo).length;
}

function hasDemoData() {
  return demoHabitCount() > 0;
}

/**
 * Añade los hábitos de ejemplo (con su historial). Si el usuario ya tiene un
 * hábito del catálogo con el mismo origen, no se duplica.
 * Devuelve { added, skipped }.
 */
function loadDemoData() {
  const habits = getHabits();
  const completions = getCompletions();
  let added = 0;
  let skipped = 0;

  DEMO_HABITS.forEach(cfg => {
    const base = HABIT_CATALOG.find(h => h.id === cfg.sourceId);
    if (!base) return;
    if (habits.some(h => h.sourceId === cfg.sourceId)) { skipped++; return; } // ya existe uno igual
    const id = "h_demo_" + cfg.sourceId.replace(/^c-/, "");
    habits.push({
      id,
      name: base.name,
      icon: base.icon,
      category: base.category,
      sourceId: base.id,
      createdAt: isoDaysAgo(cfg.daysAgo),
      archived: false,
      demo: true,
    });
    completions[id] = generateDemoDays(cfg);
    added++;
  });

  saveHabits(habits);
  saveCompletions(completions);
  return { added, skipped };
}

/** Quita solo los hábitos de ejemplo (y su historial). Devuelve cuántos quitó. */
function clearDemoData() {
  const habits = getHabits();
  const demoIds = habits.filter(h => h.demo).map(h => h.id);
  if (demoIds.length === 0) return 0;
  saveHabits(habits.filter(h => !h.demo));
  const completions = getCompletions();
  demoIds.forEach(id => delete completions[id]);
  saveCompletions(completions);
  return demoIds.length;
}
