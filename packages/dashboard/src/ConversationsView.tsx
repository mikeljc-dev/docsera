import { useEffect, useState } from "preact/hooks";
import { type Conversation, fetchConversations, UnauthorizedError } from "./api.js";

const PAGE_SIZE = 25;

type Filter = "all" | "answered" | "unanswered";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "answered", label: "Answered" },
  { value: "unanswered", label: "Unanswered" },
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
        setError(err instanceof Error ? err.message : "Unknown error");
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
    <div>
      <header>
        <h1>Conversations</h1>
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
      {loading && <p class="loading">Loading…</p>}

      {!loading && !error && (
        <>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Question</th>
                <th>Answer</th>
                <th>Status</th>
                <th>Sources</th>
                <th>Feedback</th>
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
                      {conversation.answered ? "Answered" : "Unanswered"}
                    </span>
                  </td>
                  <td class="center">{conversation.sourceCount}</td>
                  <td class="center">
                    {conversation.feedback === 1 ? "👍" : conversation.feedback === -1 ? "👎" : "—"}
                  </td>
                </tr>
              ))}
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={6} class="empty">
                    No conversations match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div class="pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages} ({total} total)
            </span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
