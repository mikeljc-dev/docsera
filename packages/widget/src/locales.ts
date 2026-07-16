export interface WidgetStrings {
  heading: string;
  placeholder: string;
  empty: string;
  typing: string;
  send: string;
  error: string;
  openChat: string;
  close: string;
}

export const DEFAULT_LOCALE = "en";

export const LOCALES: Record<string, WidgetStrings> = {
  en: {
    heading: "Ask me about the docs",
    placeholder: "Type your question…",
    empty: "Ask a question about the documentation.",
    typing: "Typing…",
    send: "Send",
    error: "Something went wrong. Please try again in a moment.",
    openChat: "Open help chat",
    close: "Close",
  },
  es: {
    heading: "Pregúntame sobre la documentación",
    placeholder: "Escribe tu pregunta…",
    empty: "Escribe una pregunta sobre la documentación.",
    typing: "Escribiendo…",
    send: "Enviar",
    error: "Ha ocurrido un error. Inténtalo de nuevo en un momento.",
    openChat: "Abrir chat de ayuda",
    close: "Cerrar",
  },
  fr: {
    heading: "Posez-moi vos questions sur la doc",
    placeholder: "Écrivez votre question…",
    empty: "Posez une question sur la documentation.",
    typing: "En train d'écrire…",
    send: "Envoyer",
    error: "Une erreur est survenue. Réessayez dans un instant.",
    openChat: "Ouvrir le chat d'aide",
    close: "Fermer",
  },
  de: {
    heading: "Frag mich zur Dokumentation",
    placeholder: "Schreibe deine Frage…",
    empty: "Stelle eine Frage zur Dokumentation.",
    typing: "Schreibt…",
    send: "Senden",
    error: "Etwas ist schiefgelaufen. Bitte versuche es gleich noch einmal.",
    openChat: "Hilfe-Chat öffnen",
    close: "Schließen",
  },
  pt: {
    heading: "Pergunte-me sobre a documentação",
    placeholder: "Escreva a sua pergunta…",
    empty: "Faça uma pergunta sobre a documentação.",
    typing: "A escrever…",
    send: "Enviar",
    error: "Ocorreu um erro. Tente novamente em instantes.",
    openChat: "Abrir chat de ajuda",
    close: "Fechar",
  },
};

function primarySubtag(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_]/)[0] ?? "";
}

// Resolución: atributo explícito > <html lang> > idioma del navegador > en.
export function resolveStrings(explicit?: string): WidgetStrings {
  const candidates = [explicit, document.documentElement.lang, navigator.language];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const strings = LOCALES[primarySubtag(candidate)];
    if (strings) return strings;
  }
  return LOCALES[DEFAULT_LOCALE] as WidgetStrings;
}
