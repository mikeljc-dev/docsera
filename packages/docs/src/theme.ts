// Switch claro/oscuro: por defecto sigue al sistema; el botón fija la
// elección en localStorage (el snippet inline del <head> la aplica antes
// del primer pintado para evitar el destello).

const STORAGE_KEY = "docsera-theme";
const root = document.documentElement;

const SUN_ICON = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>`;
const MOON_ICON = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>`;

function currentTheme(): "light" | "dark" {
  if (root.dataset["theme"] === "dark") return "dark";
  if (root.dataset["theme"] === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const toggle = document.getElementById("theme-toggle") as HTMLButtonElement | null;
if (toggle) {
  toggle.innerHTML = `<span class="icon sun">${SUN_ICON}</span><span class="icon moon">${MOON_ICON}</span><span class="knob"></span>`;
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", String(currentTheme() === "dark"));
  toggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset["theme"] = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sin localStorage, el cambio vale solo para esta página
    }
    toggle.setAttribute("aria-checked", String(next === "dark"));
  });
}
