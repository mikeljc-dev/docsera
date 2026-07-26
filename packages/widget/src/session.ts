const SESSION_STORAGE_KEY = "docsera-session-id";

// Identificador estable por navegador para que el server agrupe los turnos
// de una misma conversacion (misma ventana que usa el LLM para recordar).
// El storage se inyecta para poder testear el fallback sin `window`; en el
// widget real cae en `globalThis.localStorage`. Best-effort: si el storage
// no esta disponible (modo privado, bloqueado) genera un id igualmente, que
// simplemente no persistira entre recargas.
export function loadSessionId(
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage,
): string {
  try {
    const existing = storage?.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // localStorage no disponible (modo privado, storage bloqueado, etc.)
  }
  const id = crypto.randomUUID();
  try {
    storage?.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // ignorar: la sesion simplemente no persistira entre recargas
  }
  return id;
}
