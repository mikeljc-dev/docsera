import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import { type Conversation, fetchConversations, UnauthorizedError } from "./api.js";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

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

function sourceLabel(source: Conversation["sources"][number]): string {
  if (!source.anchor) return source.title;
  return `${source.title} § ${source.anchor.replace(/-/g, " ")}`;
}

function sourceHref(source: Conversation["sources"][number]): string {
  if (!source.url) return "";
  return source.anchor ? `${source.url}#${source.anchor}` : source.url;
}

export function ConversationsView({ token, onUnauthorized }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Debounce: no dispares una petición por cada tecla.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const answered = filter === "all" ? undefined : filter === "answered";

    fetchConversations(token, { answered, search, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
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
  }, [token, filter, search, page]);

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

      <input
        class="search"
        type="search"
        placeholder="Search questions…"
        value={searchInput}
        onInput={(event) => setSearchInput((event.target as HTMLInputElement).value)}
      />

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
              {conversations.map((conversation) => {
                const isExpanded = expanded === conversation.id;
                return (
                  <Fragment key={conversation.id}>
                    <tr
                      class={`row ${isExpanded ? "expanded" : ""}`}
                      onClick={() => setExpanded(isExpanded ? null : conversation.id)}
                    >
                      <td class="date">{new Date(conversation.createdAt).toLocaleString()}</td>
                      <td class={isExpanded ? "" : "clamp"}>{conversation.question}</td>
                      <td class={isExpanded ? "" : "clamp"}>{conversation.answer ?? "—"}</td>
                      <td>
                        <span class={conversation.answered ? "badge ok" : "badge warn"}>
                          {conversation.answered ? "Answered" : "Unanswered"}
                        </span>
                      </td>
                      <td class="center">{conversation.sources.length}</td>
                      <td class="center">
                        {conversation.feedback === 1
                          ? "👍"
                          : conversation.feedback === -1
                            ? "👎"
                            : "—"}
                      </td>
                    </tr>
                    {isExpanded && conversation.sources.length > 0 && (
                      <tr class="row-detail">
                        <td colSpan={6}>
                          <div class="source-chips">
                            {conversation.sources.map((source) => (
                              <a
                                key={sourceHref(source)}
                                href={sourceHref(source)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {sourceLabel(source)}
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
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
