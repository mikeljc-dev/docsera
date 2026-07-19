import { getChatAdapter } from "../llm/index.js";
import type { ChatMessage } from "../llm/types.js";
import type { Turn } from "./history.js";

// Una reescritura más larga que esto no es una pregunta: es el modelo
// ignorando la instrucción y respondiendo. Se descarta y se usa la original.
const MAX_STANDALONE_LENGTH = 300;

function buildCondenseSystemPrompt(): string {
  return `You rewrite the user's latest message into a standalone question that
can be understood without the conversation history, so it can be used as a
documentation search query.

Rules:
- Resolve pronouns and references ("it", "that", "the same") using the history.
- Keep the original language of the latest message.
- Keep the user's own wording and technical terms; do not translate, explain
  or expand them.
- If the latest message is already self-contained, repeat it unchanged.
- Reply with the rewritten question only: no preamble, no quotes, no
  explanation. Never answer the question.`;
}

export function buildCondenseMessages(question: string, turns: Turn[]): ChatMessage[] {
  const history = turns
    .map((turn) => `User: ${turn.question}\nAssistant: ${turn.answer}`)
    .join("\n\n");

  return [
    { role: "system", content: buildCondenseSystemPrompt() },
    { role: "user", content: `Conversation so far:\n\n${history}\n\nLatest message: ${question}` },
  ];
}

// Los modelos pequeños devuelven la reescritura entrecomillada o con un
// "Standalone question:" delante. Se limpia lo recuperable y, ante cualquier
// resultado sospechoso, se vuelve a la pregunta original: una búsqueda con la
// pregunta literal es peor que con la reescrita, pero mejor que con basura.
export function resolveStandaloneQuestion(raw: string, question: string): string {
  const cleaned = raw
    .trim()
    .replace(/^[^:\n]{0,40}question:\s*/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

  if (!cleaned || cleaned.length > MAX_STANDALONE_LENGTH) return question;
  return cleaned;
}

// Coste: una llamada extra al LLM, y solo en las preguntas de seguimiento (la
// primera de cada sesión no tiene historial). Se paga porque sin ella la
// recuperación embebe "¿y eso cómo se configura?" tal cual, que no se parece a
// ningún chunk de la doc. Si la llamada falla, se degrada a la pregunta
// original en vez de tumbar la petición entera.
export async function condenseQuestion(question: string, turns: Turn[]): Promise<string> {
  if (turns.length === 0) return question;

  try {
    const raw = await getChatAdapter().chat(buildCondenseMessages(question, turns));
    return resolveStandaloneQuestion(raw, question);
  } catch (error) {
    console.error("Error al reescribir la pregunta con el historial:", error);
    return question;
  }
}
