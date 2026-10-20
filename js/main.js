/**
 * main.js
 * Arranque de la app: routing entre vistas y todos los listeners de eventos.
 * Usa delegación de eventos en document.body para simplificar el cableado
 * de elementos que se regeneran dinámicamente (tarjetas de hábito, chips, etc).
 */

const VIEWS = ["dashboard", "habits", "catalog", "stats", "ai", "settings"];

function switchView(view) {
  if (!VIEWS.includes(view)) view = "dashboard";
  VIEWS.forEach(v => {
    document.getElementById("view-" + v).classList.toggle("active", v === view);
  });
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".bn-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

  if (view === "dashboard") renderDashboard();
  if (view === "habits") renderHabitsView();
  if (view === "catalog") { renderCatalogSelect(); renderCatalogAccordion(document.getElementById("catalogSearch").value); }
  if (view === "stats") renderStatsView();
  if (view === "ai") renderAiView();
  if (view === "settings") renderSettingsView();

  history.replaceState(null, "", "#" + view);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeIcon").textContent = theme === "dark" ? "☀️" : "🌙";
  document.getElementById("themeLabel").textContent = theme === "dark" ? "Modo claro" : "Modo oscuro";
}

function init() {
  const settings = getSettings();
  applyTheme(settings.theme || "light");

  const startView = (location.hash || "").replace("#", "") || "dashboard";
  switchView(VIEWS.includes(startView) ? startView : "dashboard");

  wireNav();
  wireDashboard();
  wireHabits();
  wireCatalog();
  wireStats();
  wireAi();
  wireSettings();
  wireGlobalDelegation();
}

/* ---------- Navegación ---------- */
function wireNav() {
  document.querySelectorAll(".nav-btn, .bn-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = getSettings().theme || "light";
    const next = current === "light" ? "dark" : "light";
    updateSettings({ theme: next });
    applyTheme(next);
  });
}

/* Delegación global para botones "data-goto" que aparecen en textos dinámicos */
function wireGlobalDelegation() {
  document.body.addEventListener("click", (e) => {
    const goto = e.target.closest("[data-goto]");
    if (goto) {
      e.preventDefault();
      switchView(goto.dataset.goto);
    }
  });
}

/* ---------- Dashboard ---------- */
function wireDashboard() {
  document.getElementById("todayList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toggle-today]");
    if (!btn) return;
    toggleCompletion(btn.dataset.toggleToday, todayISO());
    renderDashboard();
  });

  document.getElementById("btnRegenTip").addEventListener("click", async () => {
    const settings = getSettings();
    if (!settings.geminiApiKey) {
      toast("Configura tu clave de IA en Ajustes primero");
      switchView("settings");
      return;
    }
    const tipEl = document.getElementById("dailyTipText");
    tipEl.textContent = "Pensando un consejo para ti…";
    try {
      const text = await aiDailyTip();
      updateSettings({ dailyTip: { date: todayISO(), text } });
      tipEl.textContent = text;
    } catch (err) {
      tipEl.textContent = "No se pudo generar el consejo: " + err.message;
    }
  });
}

/* ---------- Mis hábitos ---------- */
function wireHabits() {
  const container = document.getElementById("habitsByCategory");
  container.addEventListener("click", (e) => {
    const weekBtn = e.target.closest("[data-week-toggle]");
    if (weekBtn) {
      toggleCompletion(weekBtn.dataset.weekToggle, weekBtn.dataset.iso);
      renderHabitsView();
      return;
    }
    const delBtn = e.target.closest("[data-delete-habit]");
    if (delBtn) {
      if (confirm("¿Eliminar este hábito y todo su historial?")) {
        deleteHabit(delBtn.dataset.deleteHabit);
        renderHabitsView();
        toast("Hábito eliminado");
      }
    }
  });
}

/* ---------- Catálogo ---------- */
function setCustomEmoji(emoji) {
  document.getElementById("customIcon").value = emoji;
  document.getElementById("customIconPreview").textContent = emoji;
}

function setEmojiPickerOpen(open) {
  document.getElementById("emojiPickerPanel").hidden = !open;
  document.getElementById("emojiPickerTrigger").setAttribute("aria-expanded", String(open));
  if (open) renderEmojiPicker(false);
}

function wireCatalog() {
  const categorySelect = document.getElementById("customCategory");
  categorySelect.addEventListener("change", () => {
    // Sugerir el emoji apropiado al seleccionar una nueva categoría.
    // Después el usuario puede elegir libremente cualquier otro.
    setCustomEmoji(HABIT_EMOJIS[categorySelect.value]?.[0] || "🌟");
    renderEmojiPicker(false);
  });
  document.getElementById("emojiPickerTrigger").addEventListener("click", () => {
    setEmojiPickerOpen(document.getElementById("emojiPickerPanel").hidden);
  });
  document.getElementById("emojiPickerClose").addEventListener("click", () => setEmojiPickerOpen(false));
  document.getElementById("emojiTabCategory").addEventListener("click", () => renderEmojiPicker(false));
  document.getElementById("emojiTabAll").addEventListener("click", () => renderEmojiPicker(true));
  document.getElementById("emojiPickerOptions").addEventListener("click", (event) => {
    const choice = event.target.closest("[data-emoji]");
    if (!choice) return;
    setCustomEmoji(choice.dataset.emoji);
    setEmojiPickerOpen(false);
    document.getElementById("emojiPickerTrigger").focus();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#emojiPickerWrap")) setEmojiPickerOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("emojiPickerPanel").hidden) {
      setEmojiPickerOpen(false);
      document.getElementById("emojiPickerTrigger").focus();
    }
  });
  setCustomEmoji(HABIT_EMOJIS[categorySelect.value]?.[0] || "🌟");
  document.getElementById("customHabitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("customName").value.trim();
    if (!name) return;
    const icon = document.getElementById("customIcon").value || "🌟";
    const category = document.getElementById("customCategory").value;
    addHabit({ name, icon, category });
    e.target.reset();
    setCustomEmoji(HABIT_EMOJIS[document.getElementById("customCategory").value]?.[0] || "🌟");
    setEmojiPickerOpen(false);
    toast("Hábito creado 🌱");
    renderCatalogAccordion(document.getElementById("catalogSearch").value);
  });

  document.getElementById("catalogSearch").addEventListener("input", (e) => {
    renderCatalogAccordion(e.target.value);
  });

  document.getElementById("catalogAccordion").addEventListener("click", (e) => {
    const head = e.target.closest("[data-accordion-toggle]");
    if (head) {
      head.closest(".accordion-item").classList.toggle("open");
      return;
    }
    const addBtn = e.target.closest("[data-add-catalog]");
    if (addBtn && !addBtn.disabled) {
      const item = HABIT_CATALOG.find(h => h.id === addBtn.dataset.addCatalog);
      if (item) {
        addHabit({ name: item.name, icon: item.icon, category: item.category, sourceId: item.id });
        toast(`"${item.name}" añadido a tus hábitos`);
        renderCatalogAccordion(document.getElementById("catalogSearch").value);
      }
    }
  });
}

/* ---------- Estadísticas ---------- */
function wireStats() {
  document.getElementById("heatmapHabitSelect").addEventListener("change", renderFullHeatmap);

  document.getElementById("btnExportCsv").addEventListener("click", () => {
    const csv = exportCsv();
    downloadFile("brote-habitos.csv", csv, "text/csv");
    toast("CSV exportado");
  });
}

/* ---------- Asistente IA ---------- */
function wireAi() {
  document.getElementById("btnAiAnalyze").addEventListener("click", () => runAiAction(aiAnalyzeProgress));
  document.getElementById("btnAiSuggest").addEventListener("click", () => runAiAction(aiSuggestHabit));
}

async function runAiAction(fn) {
  const loading = document.getElementById("aiLoading");
  const errorBox = document.getElementById("aiError");
  const respBox = document.getElementById("aiResponseBox");
  loading.hidden = false;
  errorBox.hidden = true;
  respBox.hidden = true;
  try {
    const text = await fn();
    document.getElementById("aiResponseText").innerHTML = mdBoldToHtml(escapeHtml(text));
    document.getElementById("aiTimestamp").textContent = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    respBox.hidden = false;
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  } finally {
    loading.hidden = true;
  }
}

function mdBoldToHtml(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/* ---------- Ajustes ---------- */
function wireSettings() {
  document.getElementById("apiKeyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const key = document.getElementById("apiKeyInput").value.trim();
    const model = document.getElementById("modelSelect").value;
    updateSettings({ geminiApiKey: key, geminiModel: model });
    setStatus("apiKeyStatus", key ? "Clave guardada correctamente." : "Clave eliminada.", "ok");
    toast("Ajustes de IA guardados");
  });

  // El idioma se guarda al momento, sin tener que pulsar "Guardar clave".
  document.getElementById("aiLanguageSelect").addEventListener("change", (e) => {
    const lang = AI_LANGUAGES.find(l => l.id === e.target.value) || AI_LANGUAGES[0];
    // El consejo del día cacheado está en el idioma anterior: se descarta.
    updateSettings({ aiLanguage: lang.id, dailyTip: null });
    toast(`La IA responderá en ${lang.label}`);
  });

  document.getElementById("btnTestKey").addEventListener("click", async () => {
    const key = document.getElementById("apiKeyInput").value.trim();
    const model = document.getElementById("modelSelect").value;
    if (!key) { setStatus("apiKeyStatus", "Introduce primero una clave.", "err"); return; }
    updateSettings({ geminiApiKey: key, geminiModel: model });
    setStatus("apiKeyStatus", "Probando conexión…", "");
    try {
      await testGeminiConnection();
      setStatus("apiKeyStatus", "✅ Conexión correcta. Todo listo para usar el asistente.", "ok");
    } catch (err) {
      setStatus("apiKeyStatus", "❌ " + err.message, "err");
    }
  });

  document.getElementById("btnClearKey").addEventListener("click", () => {
    updateSettings({ geminiApiKey: "" });
    document.getElementById("apiKeyInput").value = "";
    setStatus("apiKeyStatus", "Clave eliminada.", "ok");
  });

  document.getElementById("btnExportJson").addEventListener("click", () => {
    const data = exportAllData();
    downloadFile("brote-copia.json", JSON.stringify(data, null, 2), "application/json");
    toast("Copia de seguridad exportada");
  });

  document.getElementById("btnImportJson").addEventListener("click", () => {
    document.getElementById("importJsonFile").click();
  });

  document.getElementById("importJsonFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        importAllData(payload);
        toast("Copia importada correctamente");
        switchView("dashboard");
      } catch (err) {
        toast("Error al importar: " + err.message);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  document.getElementById("btnResetAll").addEventListener("click", () => {
    if (confirm("Esto borrará todos tus hábitos e historial. ¿Seguro?")) {
      if (confirm("Confirma de nuevo: se perderá todo de forma permanente.")) {
        resetAllData();
        toast("Datos borrados");
        switchView("dashboard");
      }
    }
  });

  document.getElementById("btnClearHistory").addEventListener("click", () => {
    if (confirm("Esto borrará todas las marcas de hábitos completados (rachas incluidas), pero conservará tus hábitos. ¿Seguro?")) {
      clearHistoryOnly();
      toast("Historial borrado");
      switchView("dashboard");
    }
  });

  /* ----- Datos de ejemplo ----- */
  document.getElementById("btnLoadDemo").addEventListener("click", () => {
    if (!confirm("Se añadirán hábitos de ejemplo con unos 6 meses de historial inventado. Tus hábitos actuales no se tocan y podrás quitar los de ejemplo cuando quieras. ¿Continuar?")) return;
    const { added } = loadDemoData();
    if (added === 0) {
      renderDemoStatus("No se ha añadido nada: ya tenías esos hábitos.");
      return;
    }
    toast(`Datos de ejemplo cargados (${added} hábitos)`);
    switchView("stats");
  });

  document.getElementById("btnClearDemo").addEventListener("click", () => {
    if (!hasDemoData()) return;
    if (!confirm("¿Quitar los hábitos de ejemplo y su historial? Tus hábitos reales no se tocan.")) return;
    const n = clearDemoData();
    toast(`${n} hábitos de ejemplo quitados`);
    renderDemoStatus();
  });
}

function setStatus(elId, msg, cls) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.className = "settings-status" + (cls ? " " + cls : "");
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", init);
