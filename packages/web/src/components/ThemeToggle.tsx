import { useState } from "preact/hooks";

// Por defecto se sigue al sistema; el botón fija la elección en
// localStorage (el snippet inline del index.html la aplica antes del
// primer pintado para evitar el destello).

const STORAGE_KEY = "docsera-theme";

function currentTheme(): "light" | "dark" {
  const forced = document.documentElement.dataset["theme"];
  if (forced === "dark" || forced === "light") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(currentTheme());

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset["theme"] = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sin localStorage, el cambio vale solo para esta página
    }
    setTheme(next);
  };

  return (
    <button class="theme-toggle" onClick={toggle} aria-label="Toggle light/dark theme">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
