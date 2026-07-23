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
  // Búsqueda con la que arrancar (llega de un drill-down desde Analytics).
  initialSearch?: string;
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

// toLocaleString() da fechas de longitud variable (con/sin AM-PM, día de 1 o
// 2 dígitos...), así que la misma columna se salía o envolvía a 2 líneas
// según la fila. Día/mes/hora/minuto siempre a 2 cifras + mes de 3 letras:
// la misma longitud siempre, cabe en una línea sin excepción.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
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

// La tabla es para leer, no para renderizar Markdown: quita la sintaxis más
// ruidosa (fences ```, backticks, #, énfasis, sintaxis de enlace) dejando el
// texto legible. No es un parser completo — solo lo justo para que un
// operador no vea "```bash npx docsera```" literal en cada fila.
function stripMarkdown(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, "") // apertura de fence (con lenguaje opcional)
    .replace(/```/g, "") // cierre de fence
    .replace(/`([^`]+)`/g, "$1") // código inline
    .replace(/^#{1,6}\s+/gm, "") // encabezados
    .replace(/\*\*([^*]+)\*\*/g, "$1") // negrita
    .replace(/\*([^*]+)\*/g, "$1") // cursiva
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // enlaces → solo el texto
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

export function ConversationsView({ token, onUnauthorized, initialSearch = "" }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  // Sembrados desde initialSearch: la vista se remonta al cambiar de pestaña,
  // así que el valor inicial del state basta (no hace falta un efecto).
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [sessionFilter, setSessionFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // Solo se muestra el placeholder "Loading…" en la primera carga; en las
  // recargas por filtro se mantiene la tabla anterior visible (atenuada),
  // sin parpadeo.
  const [hasLoaded, setHasLoaded] = useState(false);
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
        setHasLoaded(true);
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
      {!error && !hasLoaded && <p class="loading">Loading…</p>}

      {!error && hasLoaded && (
        <div class={loading ? "reloading" : ""}>
          <table>
            <colgroup>
              <col style="width: 17%" />
              <col style="width: 26%" />
              <col style="width: 26%" />
              <col style="width: 12%" />
              <col style="width: 9.5%" />
              <col style="width: 9.5%" />
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
                      <td class="date">
                        <div class="date-row">
                          {formatDate(conversation.createdAt)}
                          <button
                            class="session-link"
                            title="Filter this session"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSessionFilter(conversation.sessionId);
                              setPage(0);
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td>
                        <div class={isExpanded ? "" : "clamp"}>
                          {highlight(conversation.question, search)}
                        </div>
                      </td>
                      <td>
                        {conversation.answer == null ? (
                          "—"
                        ) : isExpanded ? (
                          // Al expandir: Markdown limpiado pero con los saltos
                          // de línea intactos (pre-wrap), para que un bloque de
                          // código o una lista se lean como tal.
                          <div class="answer-full">{stripMarkdown(conversation.answer)}</div>
                        ) : (
                          <div class="clamp">
                            {stripMarkdown(conversation.answer).replace(/\s+/g, " ").trim()}
                          </div>
                        )}
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
                    </tr>
                    {isExpanded && (
                      <tr class="row-detail">
                        <td colSpan={6}>
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
        </div>
      )}
    </div>
  );
}
