/**
 * ui.js
 * Funciones de renderizado puro: leen datos (storage.js) y pintan el DOM.
 * No contienen lógica de eventos (eso vive en main.js).
 */

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

function formatDateLong(date) {
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Pequeña etiqueta para distinguir los hábitos cargados como datos de ejemplo.
function demoBadge(habit) {
  return habit.demo ? ` <span class="demo-badge" title="Hábito de ejemplo">ejemplo</span>` : "";
}

/* ============ DASHBOARD ============ */
function renderDashboard() {
  document.getElementById("todayLabel").textContent =
    "Hoy es " + formatDateLong(new Date());

  const habits = getHabits();
  const today = todayISO();
  const total = habits.length;
  const done = completionsTodayCount();
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById("doneToday").textContent = done;
  document.getElementById("totalHabits").textContent = total;
  document.getElementById("heroPercent").textContent = pct + "%";

  const CIRC = 2 * Math.PI * 60;
  const ring = document.getElementById("ringFill");
  ring.style.strokeDasharray = CIRC;
  ring.style.strokeDashoffset = CIRC - (CIRC * pct) / 100;

  document.getElementById("statLongestStreak").textContent = globalBestStreak();
  document.getElementById("statActive").textContent = total;
  document.getElementById("statMonth").textContent = completionsThisMonthCount();

  // lista de hoy
  const list = document.getElementById("todayList");
  if (total === 0) {
    list.innerHTML = `<p class="empty-msg">Aún no tienes hábitos activos. <a href="#" data-goto="catalog">Añade el primero</a>.</p>`;
  } else {
    list.innerHTML = habits.map(h => {
      const isDone = isCompletedOn(h.id, today);
      const streak = currentStreak(h.id);
      return `
        <div class="today-item">
          <button class="today-check ${isDone ? "done" : ""}" data-toggle-today="${h.id}">${isDone ? "✓" : ""}</button>
          <span class="today-icon">${h.icon}</span>
          <span class="today-name ${isDone ? "done" : ""}">${escapeHtml(h.name)}${demoBadge(h)}</span>
          <span class="today-streak">${streak > 0 ? "🔥 " + streak : ""}</span>
        </div>`;
    }).join("");
  }

  renderHeatmapInto("miniHeatmap", 84, null);

  // consejo del día (cacheado)
  const settings = getSettings();
  const tipBox = document.getElementById("dailyTipText");
  if (settings.dailyTip && settings.dailyTip.date === today) {
    tipBox.textContent = settings.dailyTip.text;
  } else if (!settings.geminiApiKey) {
    tipBox.textContent = "Configura tu clave gratuita de IA en Ajustes para recibir un consejo personalizado cada día.";
  } else {
    tipBox.textContent = "Pulsa \"Regenerar\" para pedirle un consejo a tu asistente de IA.";
  }
}

/* ============ HEATMAP genérico ============
   habitId = null -> agregado de todos los hábitos (color = ratio de cumplimiento del día)
*/
function renderHeatmapInto(containerId, numDays, habitId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const habits = getHabits();
  const completions = getCompletions();

  // La cuadrícula usa grid-auto-flow:column con 7 filas fijas (L..D), así que
  // para que cada día caiga en la fila de su día de la semana correcto hay que
  // rellenar con celdas vacías invisibles antes del primer día real.
  const today = new Date();
  const firstDate = new Date(today);
  firstDate.setDate(firstDate.getDate() - (numDays - 1));
  const startPadding = (firstDate.getDay() + 6) % 7; // 0 = lunes

  let html = "";
  for (let p = 0; p < startPadding; p++) {
    html += `<div class="hm-cell" data-level="0" style="visibility:hidden"></div>`;
  }

  for (let i = 0; i < numDays; i++) {
    const d = new Date(firstDate);
    d.setDate(d.getDate() + i);
    const iso = dateToISO(d);
    let level = 0;
    let title = iso;

    if (habitId) {
      const done = (completions[habitId] || []).includes(iso);
      level = done ? 3 : 0;
      title += done ? " · completado" : " · sin completar";
    } else {
      const activeThatDay = habits.filter(h => h.createdAt <= iso);
      const doneCount = activeThatDay.filter(h => (completions[h.id] || []).includes(iso)).length;
      const ratio = activeThatDay.length ? doneCount / activeThatDay.length : 0;
      if (ratio === 0) level = 0;
      else if (ratio < 0.34) level = 1;
      else if (ratio < 0.67) level = 2;
      else if (ratio < 1) level = 3;
      else level = 4;
      title += ` · ${doneCount}/${activeThatDay.length} hábitos`;
    }
    html += `<div class="hm-cell" data-level="${level}" title="${title}"></div>`;
  }
  container.innerHTML = html;
  container.scrollLeft = container.scrollWidth; // en pantallas estrechas, mostrar las semanas más recientes
}

/* ============ MIS HÁBITOS ============ */
function renderHabitsView() {
  const habits = getHabits();
  const container = document.getElementById("habitsByCategory");
  const emptyMsg = document.getElementById("habitsEmptyMsg");

  if (habits.length === 0) {
    container.innerHTML = "";
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  const byCat = {};
  habits.forEach(h => {
    byCat[h.category] = byCat[h.category] || [];
    byCat[h.category].push(h);
  });

  const today = new Date();
  container.innerHTML = Object.keys(byCat).map(catId => {
    const cat = getCategory(catId);
    const cards = byCat[catId].map(h => renderHabitCard(h, today)).join("");
    return `
      <div class="category-block">
        <div class="category-title"><span>${cat.icon}</span> ${cat.name}</div>
        <div class="habit-cards">${cards}</div>
      </div>`;
  }).join("");
}

function renderHabitCard(h, today) {
  const streak = currentStreak(h.id);
  let week = "";
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = dateToISO(d);
    const done = isCompletedOn(h.id, iso);
    const label = WEEKDAY_LABELS[(d.getDay() + 6) % 7];
    week += `<button class="week-dot ${done ? "done" : ""}" data-week-toggle="${h.id}" data-iso="${iso}" title="${iso}">${done ? "✓" : label}</button>`;
  }
  return `
    <div class="habit-card">
      <div class="habit-card-top">
        <span class="habit-card-icon">${h.icon}</span>
        <span class="habit-card-name">${escapeHtml(h.name)}${demoBadge(h)}</span>
        <div class="habit-card-menu">
          <button class="icon-btn" data-delete-habit="${h.id}" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="habit-card-streak">${streak > 0 ? "🔥 Racha de " + diasTxt(streak) : "Aún sin racha"}</div>
      <div class="week-row">${week}</div>
    </div>`;
}

/* ============ CATÁLOGO ============ */
function renderCatalogSelect() {
  const sel = document.getElementById("customCategory");
  sel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
}

// Paleta de emojis adaptada al tipo de hábito elegido.
function renderEmojiPicker(showAll = false) {
  const category = document.getElementById("customCategory").value;
  const container = document.getElementById("emojiPickerOptions");
  const chosen = document.getElementById("customIcon").value;
  const categories = showAll ? CATEGORIES : CATEGORIES.filter(c => c.id === category);
  container.innerHTML = categories.map(cat => {
    const buttons = (HABIT_EMOJIS[cat.id] || []).map(emoji => `
      <button type="button" class="emoji-option ${emoji === chosen ? "selected" : ""}"
        data-emoji="${emoji}" aria-label="Elegir ${emoji}" aria-pressed="${emoji === chosen}" title="${emoji}">${emoji}</button>`).join("");
    return `<div class="emoji-option-group"><p class="emoji-group-label">${cat.icon} ${escapeHtml(cat.name)}</p><div class="emoji-option-grid">${buttons}</div></div>`;
  }).join("");
  document.getElementById("emojiTabCategory").classList.toggle("active", !showAll);
  document.getElementById("emojiTabAll").classList.toggle("active", showAll);
  document.getElementById("emojiTabCategory").setAttribute("aria-pressed", String(!showAll));
  document.getElementById("emojiTabAll").setAttribute("aria-pressed", String(showAll));
}

function renderCatalogAccordion(filter = "") {
  const container = document.getElementById("catalogAccordion");
  const f = filter.trim().toLowerCase();

  container.innerHTML = CATEGORIES.map(cat => {
    const items = HABIT_CATALOG.filter(item =>
      item.category === cat.id &&
      (f === "" || item.name.toLowerCase().includes(f))
    );
    if (items.length === 0) return "";
    const chips = items.map(item => {
      const added = isHabitFromCatalogAdded(item.id);
      return `
        <div class="catalog-chip ${added ? "added" : ""}">
          <span>${item.icon}</span>
          <span>${escapeHtml(item.name)}</span>
          <button data-add-catalog="${item.id}" ${added ? "disabled" : ""}>${added ? "✓" : "+"}</button>
        </div>`;
    }).join("");
    return `
      <div class="accordion-item ${f ? "open" : ""}">
        <button class="accordion-head" data-accordion-toggle>
          <span>${cat.icon} ${cat.name} <span style="color:var(--text-soft); font-weight:400; font-size:.8rem;">(${items.length})</span></span>
          <span class="accordion-chevron">▾</span>
        </button>
        <div class="accordion-body">${chips}</div>
      </div>`;
  }).join("");
}

/* ============ ESTADÍSTICAS ============ */
let completionChart = null;
let categoryChart = null;

// Lee los colores del tema actual (claro/oscuro) desde las variables CSS,
// para que ejes, rejilla y textos de los gráficos se lean bien en ambos modos.
function chartTheme() {
  const css = getComputedStyle(document.body);
  const v = name => css.getPropertyValue(name).trim();
  return {
    text:  v("--text-soft") || "#5B6156",
    grid:  v("--border")    || "#E1D9C4",
    moss:  v("--moss")      || "#4E7A43",
    amber: v("--amber")     || "#DE9F3B",
  };
}

function applyChartDefaults() {
  const t = chartTheme();
  Chart.defaults.font.family = "'Work Sans', sans-serif";
  Chart.defaults.color = t.text;
  Chart.defaults.borderColor = t.grid;
}

// Al cambiar de tema, si la vista de Estadísticas está abierta, se redibujan los gráficos.
const themeObserver = new MutationObserver(() => {
  const statsView = document.getElementById("view-stats");
  if (statsView && statsView.classList.contains("active") && typeof Chart !== "undefined") {
    applyChartDefaults();
    renderCompletionChart();
    renderCategoryChart();
  }
});
[document.documentElement, document.body].forEach(el =>
  themeObserver.observe(el, { attributes: true, attributeFilter: ["data-theme", "class"] })
);

function renderStatsView() {
  // Los gráficos dependen de Chart.js; si la librería no ha cargado (CDN caído,
  // sin conexión, bloqueador…) los saltamos para que el resto de la vista se pinte igual.
  if (typeof Chart !== "undefined") {
    applyChartDefaults();
    try {
      renderCompletionChart();
      renderCategoryChart();
    } catch (err) {
      console.error("Error al dibujar los gráficos:", err);
    }
  } else {
    console.warn("Chart.js no está disponible: se omiten los gráficos de Estadísticas.");
  }
  renderHeatmapSelect();
  renderFullHeatmap();
}

function renderCompletionChart() {
  const data = dailyCompletionRate(30);
  const ctx = document.getElementById("chartCompletion");
  const labels = data.map(d => d.iso.slice(5));
  const values = data.map(d => Math.round(d.rate * 100));

  if (completionChart) completionChart.destroy();
  completionChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "% cumplido",
        data: values,
        borderColor: chartTheme().moss,
        backgroundColor: chartTheme().moss + "26", // ~15 % de opacidad
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + "%" } },
        x: { ticks: { maxTicksLimit: 8 } },
      },
    },
  });
}

function renderCategoryChart() {
  const totals = completionsByCategory();
  const ctx = document.getElementById("chartCategory");
  const labels = CATEGORIES.map(c => c.name);
  const values = CATEGORIES.map(c => totals[c.id] || 0);

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Completados",
        data: values,
        backgroundColor: chartTheme().amber,
        borderRadius: 6,
        maxBarThickness: 26,
      }],
    },
    options: {
      indexAxis: "y", // barras horizontales: las categorías se leen rectas, también en móvil
      responsive: true,
      aspectRatio: window.innerWidth < 600 ? 1.1 : 2.2,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { grid: { display: false } },
      },
    },
  });
}

function renderHeatmapSelect() {
  const sel = document.getElementById("heatmapHabitSelect");
  const habits = getHabits();
  const current = sel.value;
  sel.innerHTML = `<option value="__all__">Todos los hábitos</option>` +
    habits.map(h => `<option value="${h.id}">${h.icon} ${escapeHtml(h.name)}</option>`).join("");
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

function renderFullHeatmap() {
  const sel = document.getElementById("heatmapHabitSelect");
  const habitId = sel.value === "__all__" ? null : sel.value;
  renderHeatmapInto("fullHeatmap", 182, habitId);

  const info = document.getElementById("heatmapStreakInfo");
  if (habitId) {
    info.textContent = `Racha actual: ${diasTxt(currentStreak(habitId))} · Mejor racha: ${diasTxt(bestStreak(habitId))}`;
  } else {
    info.textContent = `Mejor racha global: ${diasTxt(globalBestStreak())}`;
  }

  // Si todavía no hay nada que pintar, lo explicamos en vez de dejar solo cuadrados vacíos.
  const habits = getHabits();
  const completions = getCompletions();
  const hasActivity = habitId
    ? (completions[habitId] || []).length > 0
    : habits.some(h => (completions[h.id] || []).length > 0);
  const emptyMsg = document.getElementById("heatmapEmptyMsg");
  emptyMsg.hidden = hasActivity;
  if (!hasActivity) {
    const demoLink = `<a href="#" data-goto="settings">cargar datos de ejemplo</a>`;
    if (habits.length === 0) {
      emptyMsg.innerHTML = `Aún no tienes hábitos. <a href="#" data-goto="catalog">Añade uno</a> o puedes ${demoLink} para ver cómo funciona el mapa.`;
    } else if (habitId) {
      emptyMsg.textContent = "Este hábito todavía no tiene ningún día completado.";
    } else {
      emptyMsg.innerHTML = `Todavía no hay días completados. Marca un hábito como hecho o puedes ${demoLink}.`;
    }
  }
}

/* ============ AJUSTES ============ */
function renderSettingsView() {
  const s = getSettings();
  document.getElementById("apiKeyInput").value = s.geminiApiKey || "";
  document.getElementById("modelSelect").value = "gemini-3.6-flash";
  const langSel = document.getElementById("aiLanguageSelect");
  langSel.innerHTML = AI_LANGUAGES.map(l => `<option value="${l.id}">${l.label}</option>`).join("");
  langSel.value = getAiLanguage().id;
  renderDemoStatus();
}

// Estado del panel "Datos de ejemplo": cuántos hay cargados y si se pueden quitar.
function renderDemoStatus(message, cls) {
  const n = demoHabitCount();
  document.getElementById("btnClearDemo").disabled = n === 0;
  const el = document.getElementById("demoStatus");
  el.textContent = message || (n > 0
    ? `Ahora mismo hay ${n} hábitos de ejemplo cargados.`
    : "No hay datos de ejemplo cargados.");
  el.className = "settings-status" + (cls ? " " + cls : "");
}

/* ============ IA ============ */
function renderAiView() {
  const s = getSettings();
  const hasKey = !!s.geminiApiKey;
  document.getElementById("aiNoKeyPanel").hidden = hasKey;
  document.getElementById("aiActionsPanel").hidden = !hasKey;
}

/* ============ helpers ============ */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
