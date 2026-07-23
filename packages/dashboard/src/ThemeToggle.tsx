import { useState } from "preact/hooks";

// Switch claro/oscuro: por defecto se sigue al sistema; el botón fija la
// elección en localStorage (el snippet inline del index.html la aplica
// antes del primer pintado para evitar el destello). Mismo patrón que
// packages/web/src/components/ThemeToggle.tsx.

const STORAGE_KEY = "docsera-theme";

function currentTheme(): "light" | "dark" {
  const forced = document.documentElement.dataset["theme"];
  if (forced === "dark" || forced === "light") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
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
    <button
      class="theme-toggle"
      role="switch"
      aria-checked={theme === "dark"}
      aria-label="Toggle light/dark theme"
      onClick={toggle}
    >
      <span class="icon sun">
        <SunIcon />
      </span>
      <span class="icon moon">
        <MoonIcon />
      </span>
      <span class="knob" />
    </button>
  );
}
