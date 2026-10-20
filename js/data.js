/**
 * data.js
 * Catálogo estático de categorías y hábitos precargados.
 * No depende de ninguna API: es la "semilla" de contenido de la app.
 */

const CATEGORIES = [
  { id: "salud",       name: "Salud física",        icon: "🏃" },
  { id: "alimentacion",name: "Alimentación",         icon: "🥗" },
  { id: "mente",       name: "Mente y bienestar",    icon: "🧘" },
  { id: "productividad",name: "Productividad",       icon: "🎯" },
  { id: "aprendizaje", name: "Aprendizaje",          icon: "📚" },
  { id: "finanzas",    name: "Finanzas",             icon: "💰" },
  { id: "social",      name: "Social y relaciones",  icon: "🤝" },
  { id: "creatividad", name: "Creatividad",          icon: "🎨" },
];

function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || { id: "otros", name: "Otros", icon: "🌟" };
}

// Catálogo amplio y ordenado por categoría (id único estable "cat:slug")
const HABIT_CATALOG = [
  // Salud física
  { id: "c-agua", name: "Beber 2 litros de agua", icon: "💧", category: "salud" },
  { id: "c-dormir", name: "Dormir 8 horas", icon: "😴", category: "salud" },
  { id: "c-caminar", name: "Caminar 30 minutos", icon: "🚶", category: "salud" },
  { id: "c-ejercicio", name: "Hacer ejercicio", icon: "🏋️", category: "salud" },
  { id: "c-estirar", name: "Estirar al despertar", icon: "🤸", category: "salud" },
  { id: "c-sol", name: "Tomar el sol 10 minutos", icon: "☀️", category: "salud" },

  // Alimentación
  { id: "c-fruver", name: "Comer 5 raciones de fruta y verdura", icon: "🍎", category: "alimentacion" },
  { id: "c-desayuno", name: "Desayunar sin prisas", icon: "🍳", category: "alimentacion" },
  { id: "c-azucar", name: "Reducir el azúcar añadido", icon: "🍬", category: "alimentacion" },
  { id: "c-cocinar", name: "Cocinar en casa", icon: "🥘", category: "alimentacion" },
  { id: "c-vasoagua", name: "Beber un vaso de agua al despertar", icon: "🥤", category: "alimentacion" },

  // Mente y bienestar
  { id: "c-meditar", name: "Meditar 10 minutos", icon: "🧘", category: "mente" },
  { id: "c-gratitud", name: "Escribir un diario de gratitud", icon: "📓", category: "mente" },
  { id: "c-respirar", name: "Practicar respiración profunda", icon: "🌬️", category: "mente" },
  { id: "c-desconectar", name: "Desconectar del móvil antes de dormir", icon: "📴", category: "mente" },
  { id: "c-naturaleza", name: "Pasar tiempo en la naturaleza", icon: "🌳", category: "mente" },

  // Productividad
  { id: "c-planificar", name: "Planificar el día la noche anterior", icon: "🗒️", category: "productividad" },
  { id: "c-priorizar", name: "Priorizar las 3 tareas más importantes", icon: "✅", category: "productividad" },
  { id: "c-ordenar", name: "Ordenar el espacio de trabajo", icon: "🧹", category: "productividad" },
  { id: "c-redes", name: "Evitar redes sociales en horario laboral", icon: "🚫", category: "productividad" },
  { id: "c-revisarobjetivos", name: "Revisar objetivos semanales", icon: "🧭", category: "productividad" },

  // Aprendizaje
  { id: "c-leer", name: "Leer 20 minutos", icon: "📖", category: "aprendizaje" },
  { id: "c-idioma", name: "Practicar un idioma nuevo", icon: "🗣️", category: "aprendizaje" },
  { id: "c-programar", name: "Programar 30 minutos", icon: "💻", category: "aprendizaje" },
  { id: "c-curso", name: "Avanzar en un curso o tutorial", icon: "🎓", category: "aprendizaje" },
  { id: "c-podcast", name: "Escuchar un podcast educativo", icon: "🎧", category: "aprendizaje" },

  // Finanzas
  { id: "c-gastos", name: "Registrar los gastos del día", icon: "🧾", category: "finanzas" },
  { id: "c-ahorrar", name: "Ahorrar una cantidad fija", icon: "🐷", category: "finanzas" },
  { id: "c-presupuesto", name: "Revisar el presupuesto mensual", icon: "📊", category: "finanzas" },
  { id: "c-impulsivas", name: "Evitar compras impulsivas", icon: "🛑", category: "finanzas" },

  // Social y relaciones
  { id: "c-llamar", name: "Llamar a un familiar o amigo", icon: "☎️", category: "social" },
  { id: "c-escucha", name: "Practicar la escucha activa", icon: "👂", category: "social" },
  { id: "c-cumplido", name: "Hacer un cumplido sincero", icon: "💬", category: "social" },

  // Creatividad
  { id: "c-dibujar", name: "Dibujar o pintar 15 minutos", icon: "🎨", category: "creatividad" },
  { id: "c-escribir", name: "Escribir algo creativo", icon: "✍️", category: "creatividad" },
  { id: "c-instrumento", name: "Tocar un instrumento", icon: "🎸", category: "creatividad" },
];


// Emojis seleccionables para hábitos personalizados, agrupados por categoría.
// La primera opción es la sugerencia predeterminada de cada categoría.
const HABIT_EMOJIS = {
  salud: ["🏃","🚶","🏋️","🤸","🚴","🏊","🧗","🧘","💪","🥾","⚽","🏀","🎾","🏸","🏓","🥊","🛼","⛸️","🏄","🛹","💧","🚰","😴","🛏️","🌞","🌤️","🫀","🦷","🩺","🧴"],
  alimentacion: ["🥗","🍎","🍌","🍊","🍓","🫐","🥑","🥦","🥕","🍅","🥒","🥬","🍞","🥚","🍳","🥣","🥛","🫖","☕","🍵","🥤","🍲","🥘","🍱","🍚","🍉","🍇","🍋","🌽","🫘"],
  mente: ["🧘","🧠","🌱","🌿","🌳","🌻","🌸","🌈","🌅","🕯️","🫶","💚","💖","😊","😌","🙏","📓","📔","✍️","💭","🫧","🌙","⭐","☁️","🛀","🎧","🧩","🪷","🍃","🦋"],
  productividad: ["🎯","✅","📋","📝","📅","🗓️","⏰","⌛","⏳","📌","🗂️","📁","💻","⌨️","🖥️","📊","📈","🧹","🗃️","🔕","🚀","💡","🔧","⚙️","🏆","📍","🖊️","📎","🔔","🧭"],
  aprendizaje: ["📚","📖","📕","📗","📘","📙","📒","📓","🧑‍🎓","🎓","🏫","✏️","🖋️","📝","🧮","🔬","🔭","🧪","💻","👨‍💻","🗣️","🌍","🗺️","🎧","🎙️","🧠","💡","🔡","🧑‍🏫","📐"],
  finanzas: ["💰","💵","💶","💷","💳","🪙","💸","🐷","🏦","📈","📉","📊","🧾","🛒","🛍️","💼","🧮","📆","🎯","🏠","🔐","💎","🤝","📋","✅"],
  social: ["🤝","🫂","💬","🗣️","📞","☎️","📱","💌","❤️","💕","🫶","👋","😊","🎉","🎁","👨‍👩‍👧","👪","🧑‍🤝‍🧑","👥","☕","🍽️","🎂","🎈","🙌","🙏","🌍","📨","📅"],
  creatividad: ["🎨","🖌️","🖍️","✏️","📝","✍️","📷","📸","🎬","🎭","🧵","🪡","🧶","🪴","🎤","🎼","🎵","🎶","🎹","🎸","🥁","🪘","🪈","🎻","🎷","🎺","🪗","🪕","📯","🎧","🎙️","💃","🕺","🪄","🧩","🧱","🖼️","📖"]
};
