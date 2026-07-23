import type { Pool } from "pg";
import type { ChatAdapter, ChatMessage, EmbeddingsAdapter } from "../llm/types.js";

export interface FakeRow {
  [column: string]: unknown;
}

// Pool falso: devuelve filas fijas según qué contiene el SQL. Basta para las
// rutas, que solo necesitan que la consulta responda algo coherente; el SQL
// de verdad se sigue verificando a mano contra Postgres (ver deuda-tecnica.md).
// rowCount es opcional (para UPDATE/DELETE, donde no hay filas que devolver
// pero sí importa cuántas se tocaron); por defecto, el número de filas.
export function fakePool(handlers: { match: RegExp; rows: FakeRow[]; rowCount?: number }[]): Pool {
  const query = (text: string): Promise<{ rows: FakeRow[]; rowCount: number }> => {
    const handler = handlers.find((h) => h.match.test(text));
    return Promise.resolve({
      rows: handler?.rows ?? [],
      rowCount: handler?.rowCount ?? handler?.rows.length ?? 0,
    });
  };

  return {
    query: (text: string) => query(text),
    connect: () =>
      Promise.resolve({
        query: (text: string) => query(text),
        release: () => undefined,
      }),
  } as unknown as Pool;
}

export function fakeChatAdapter(answer: string, deltas?: string[]): ChatAdapter {
  return {
    chat: (_messages: ChatMessage[]) => Promise.resolve(answer),
    ...(deltas
      ? {
          chatStream: async function* () {
            for (const delta of deltas) yield delta;
          },
        }
      : {}),
  };
}

export function fakeEmbeddingsAdapter(dimensions = 4): EmbeddingsAdapter {
  return {
    embed: (texts: string[]) => Promise.resolve(texts.map(() => Array(dimensions).fill(0.1))),
  };
}

// getConnInfo() de @hono/node-server lee la IP del socket entrante; sin este
// env el middleware de rate limit revienta al ejercer la ruta con app.fetch.
export function fakeConnEnv(address = "203.0.113.1"): { incoming: unknown; outgoing: unknown } {
  return {
    incoming: { socket: { remoteAddress: address } },
    outgoing: {},
  };
}
