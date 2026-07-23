import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  type Conversation,
  deleteConversation,
  fetchConversations,
  type SortBy,
  type SortDir,
  UnauthorizedError,
} from "./api.js";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;
const DAY_MS = 86_400_000;

type Filter = "all" | "answered" | "unanswered";
type DateRange = "all" | "today" | "7d" | "30d";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "answered", label: "Answered" },
  { value: "unanswered", label: "Unanswered" },
];

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const SORTABLE_COLUMNS: { key: SortBy; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "sources", label: "Sources" },
  { key: "feedback", label: "Feedback" },
];

interface Props {
  token: string;
  onUnauthorized: () => void;
}

// Sin el título del documento delante: casi todas las citas de una misma
// instancia vienen del mismo documento, así que repetirlo en cada chip
// solo añade ruido. Sin anchor no queda otra que caer al título.
function sourceLabel(source: Conversation["sources"][number]): string {
  if (!source.anchor) return source.title;
  return source.anchor.replace(/-/g, " ");
}

function sourceHref(source: Conversation["sources"][number]): string {
  if (!source.url) return "";
  return source.anchor ? `${source.url}#${source.anchor}` : source.url;
}

function sinceFor(range: DateRange): string | undefined {
  if (range === "all") return undefined;
  const now = Date.now();
  if (range === "today") {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight.toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now - days * DAY_MS).toISOString();
}

// Trocea el texto en partes, envolviendo cada aparición del término buscado
// en <mark>. Sin librería de resaltado: es solo un split por regex.
function highlight(text: string, term: string) {
  if (!term.trim()) return text;
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.trim().toLowerCase() ? <mark key={i}>{part}</mark> : part,
  );
}

export function ConversationsView({ token, onUnauthorized }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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

    fetchConversations(token, {
      answered,
      search,
      sessionId: sessionFilter ?? undefined,
      since: sinceFor(dateRange),
      sortBy,
      sortDir,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
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
  }, [token, filter, search, sessionFilter, dateRange, sortBy, sortDir, page, reloadToken]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (key: SortBy) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
    setDeletingId(id);
    try {
      await deleteConversation(token, id);
      setExpanded(null);
      setReloadToken((t) => t + 1);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      window.alert(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <header>
        <h1>Conversations</h1>
        <div class="toolbar">
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
          <div class="filters">
            {DATE_RANGES.map(({ value, label }) => (
              <button
                key={value}
                class={dateRange === value ? "active" : ""}
                onClick={() => {
                  setDateRange(value);
                  setPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            class="search"
            type="search"
            placeholder="Search questions…"
            value={searchInput}
            onInput={(event) => setSearchInput((event.target as HTMLInputElement).value)}
          />
        </div>
        {sessionFilter && (
          <div class="active-filter">
            Session {sessionFilter.slice(0, 8)}…
            <button
              onClick={() => {
                setSessionFilter(null);
                setPage(0);
              }}
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {error && <p class="error">{error}</p>}
      {loading && <p class="loading">Loading…</p>}

      {!loading && !error && (
        <>
          <table>
            <colgroup>
              <col style="width: 16%" />
              <col style="width: 24%" />
              <col style="width: 24%" />
              <col style="width: 11%" />
              <col style="width: 9%" />
              <col style="width: 9%" />
              <col style="width: 7%" />
            </colgroup>
            <thead>
              <tr>
                {SORTABLE_COLUMNS.slice(0, 1).map(({ key, label }) => (
                  <th key={key} class="sortable" onClick={() => toggleSort(key)}>
                    {label}
                    {sortBy === key && <span class="sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </th>
                ))}
                <th>Question</th>
                <th>Answer</th>
                <th>Status</th>
                {SORTABLE_COLUMNS.slice(1).map(({ key, label }) => (
                  <th key={key} class="sortable" onClick={() => toggleSort(key)}>
                    {label}
                    {sortBy === key && <span class="sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </th>
                ))}
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
                      <td>
                        <div class={isExpanded ? "" : "clamp"}>
                          {highlight(conversation.question, search)}
                        </div>
                      </td>
                      <td>
                        <div class={isExpanded ? "" : "clamp"}>{conversation.answer ?? "—"}</div>
                      </td>
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
                      <td class="center">
                        <button
                          class="icon-button"
                          title="Filter this session"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSessionFilter(conversation.sessionId);
                            setPage(0);
                          }}
                        >
                          🔗
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr class="row-detail">
                        <td colSpan={7}>
                          {conversation.sources.length > 0 && (
                            <>
                              <span class="source-chips-label">Sources</span>
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
                            </>
                          )}
                          <button
                            class="delete-button"
                            disabled={deletingId === conversation.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDelete(conversation.id);
                            }}
                          >
                            {deletingId === conversation.id ? "Deleting…" : "Delete conversation"}
                          </button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={7} class="empty">
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
