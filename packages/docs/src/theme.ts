// Toggle claro/oscuro: por defecto sigue al sistema; el botón fija la
// elección en localStorage (el snippet inline del <head> la aplica antes
// del primer pintado para evitar el destello).

const STORAGE_KEY = "docsera-theme";
const root = document.documentElement;

function currentTheme(): "light" | "dark" {
  if (root.dataset["theme"] === "dark") return "dark";
  if (root.dataset["theme"] === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function renderIcon(button: HTMLButtonElement): void {
  button.textContent = currentTheme() === "dark" ? "☀️" : "🌙";
}

const toggle = document.getElementById("theme-toggle") as HTMLButtonElement | null;
if (toggle) {
  renderIcon(toggle);
  toggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset["theme"] = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sin localStorage, el cambio vale solo para esta página
    }
    renderIcon(toggle);
  });
}
