import { useEffect, useState } from "preact/hooks";
import { type Conversation, fetchConversations, UnauthorizedError } from "./api.js";

const PAGE_SIZE = 25;

type Filter = "all" | "answered" | "unanswered";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "answered", label: "Respondidas" },
  { value: "unanswered", label: "Sin respuesta" },
];

interface Props {
  token: string;
  onUnauthorized: () => void;
}

export function ConversationsView({ token, onUnauthorized }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const answered = filter === "all" ? undefined : filter === "answered";

    fetchConversations(token, { answered, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setConversations(result.conversations);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }
        setError(err instanceof Error ? err.message : "Error desconocido");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, filter, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div class="dashboard">
      <header>
        <h1>Conversaciones</h1>
        <div class="filters">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              class={filter === value ? "active" : ""}
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error && <p class="error">{error}</p>}
      {loading && <p class="loading">Cargando…</p>}

      {!loading && !error && (
        <>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pregunta</th>
                <th>Respuesta</th>
                <th>Estado</th>
                <th>Fuentes</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <tr key={conversation.id}>
                  <td class="date">{new Date(conversation.createdAt).toLocaleString()}</td>
                  <td>{conversation.question}</td>
                  <td>{conversation.answer ?? "—"}</td>
                  <td>
                    <span class={conversation.answered ? "badge ok" : "badge warn"}>
                      {conversation.answered ? "Respondida" : "Sin respuesta"}
                    </span>
                  </td>
                  <td class="center">{conversation.sourceCount}</td>
                </tr>
              ))}
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={5} class="empty">
                    No hay conversaciones para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div class="pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <span>
              Página {page + 1} de {totalPages} ({total} en total)
            </span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
