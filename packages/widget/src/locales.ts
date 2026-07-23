export interface WidgetStrings {
  heading: string;
  statusOnline: string;
  statusOffline: string;
  placeholder: string;
  empty: string;
  typing: string;
  send: string;
  error: string;
  openChat: string;
  close: string;
  copy: string;
  copied: string;
  contact: string;
  helpful: string;
  notHelpful: string;
  feedbackThanks: string;
  rateLimited: string;
  poweredBy: string;
}

export const DEFAULT_LOCALE = "en";

export const LOCALES: Record<string, WidgetStrings> = {
  en: {
    heading: "Ask me about the docs",
    statusOnline: "Answers from this documentation",
    statusOffline: "Currently unavailable — please try again later.",
    placeholder: "Type your question…",
    empty: "Ask a question about the documentation.",
    typing: "Typing…",
    send: "Send",
    error: "Something went wrong. Please try again in a moment.",
    openChat: "Open help chat",
    close: "Close",
    copy: "Copy",
    copied: "Copied!",
    contact: "Contact support",
    helpful: "Helpful answer",
    notHelpful: "Not helpful",
    feedbackThanks: "Thanks for the feedback!",
    rateLimited: "You've reached the question limit for now — please try again later.",
    poweredBy: "Powered by Docsera · answers only from this documentation",
  },
  es: {
    heading: "Pregúntame sobre la documentación",
    statusOnline: "Responde desde esta documentación",
    statusOffline: "No disponible ahora mismo — inténtalo más tarde.",
    placeholder: "Escribe tu pregunta…",
    empty: "Escribe una pregunta sobre la documentación.",
    typing: "Escribiendo…",
    send: "Enviar",
    error: "Ha ocurrido un error. Inténtalo de nuevo en un momento.",
    openChat: "Abrir chat de ayuda",
    close: "Cerrar",
    copy: "Copiar",
    copied: "¡Copiado!",
    contact: "Contactar con soporte",
    helpful: "Respuesta útil",
    notHelpful: "No me ha servido",
    feedbackThanks: "¡Gracias por el feedback!",
    rateLimited: "Has alcanzado el límite de preguntas por ahora — inténtalo más tarde.",
    poweredBy: "Con la tecnología de Docsera · respuestas solo desde esta documentación",
  },
  fr: {
    heading: "Posez-moi vos questions sur la doc",
    statusOnline: "Répond à partir de cette documentation",
    statusOffline: "Indisponible pour le moment — réessayez plus tard.",
    placeholder: "Écrivez votre question…",
    empty: "Posez une question sur la documentation.",
    typing: "En train d'écrire…",
    send: "Envoyer",
    error: "Une erreur est survenue. Réessayez dans un instant.",
    openChat: "Ouvrir le chat d'aide",
    close: "Fermer",
    copy: "Copier",
    copied: "Copié !",
    contact: "Contacter le support",
    helpful: "Réponse utile",
    notHelpful: "Pas utile",
    feedbackThanks: "Merci pour votre retour !",
    rateLimited: "Vous avez atteint la limite de questions pour le moment — réessayez plus tard.",
    poweredBy: "Propulsé par Docsera · réponses uniquement depuis cette documentation",
  },
  de: {
    heading: "Frag mich zur Dokumentation",
    statusOnline: "Antwortet auf Basis dieser Dokumentation",
    statusOffline: "Momentan nicht verfügbar — bitte versuche es später erneut.",
    placeholder: "Schreibe deine Frage…",
    empty: "Stelle eine Frage zur Dokumentation.",
    typing: "Schreibt…",
    send: "Senden",
    error: "Etwas ist schiefgelaufen. Bitte versuche es gleich noch einmal.",
    openChat: "Hilfe-Chat öffnen",
    close: "Schließen",
    copy: "Kopieren",
    copied: "Kopiert!",
    contact: "Support kontaktieren",
    helpful: "Hilfreiche Antwort",
    notHelpful: "Nicht hilfreich",
    feedbackThanks: "Danke für dein Feedback!",
    rateLimited: "Du hast das Fragenlimit vorerst erreicht — bitte versuche es später erneut.",
    poweredBy: "Unterstützt von Docsera · Antworten nur aus dieser Dokumentation",
  },
  pt: {
    heading: "Pergunte-me sobre a documentação",
    statusOnline: "Responde com base nesta documentação",
    statusOffline: "Indisponível neste momento — tenta novamente mais tarde.",
    placeholder: "Escreva a sua pergunta…",
    empty: "Faça uma pergunta sobre a documentação.",
    typing: "A escrever…",
    send: "Enviar",
    error: "Ocorreu um erro. Tente novamente em instantes.",
    openChat: "Abrir chat de ajuda",
    close: "Fechar",
    copy: "Copiar",
    copied: "Copiado!",
    contact: "Contactar o suporte",
    helpful: "Resposta útil",
    notHelpful: "Não ajudou",
    feedbackThanks: "Obrigado pelo feedback!",
    rateLimited: "Atingiste o limite de perguntas por agora — tenta novamente mais tarde.",
    poweredBy: "Com tecnologia Docsera · respostas apenas desta documentação",
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
