export interface ConversationSource {
  url: string | null;
  title: string;
  anchor: string | null;
}

export interface Conversation {
  id: string;
  sessionId: string;
  question: string;
  answer: string | null;
  answered: boolean;
  feedback: number | null;
  createdAt: string;
  sources: ConversationSource[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
}

const TOKEN_STORAGE_KEY = "docsera-admin-token";

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage no disponible (modo privado, etc.): la sesion no persiste
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignorar
  }
}

export class UnauthorizedError extends Error {}

export type SortBy = "date" | "feedback" | "sources";
export type SortDir = "asc" | "desc";

export interface FetchConversationsOptions {
  answered?: boolean;
  search?: string;
  sessionId?: string;
  since?: string;
  sortBy?: SortBy;
  sortDir?: SortDir;
  limit: number;
  offset: number;
}

export async function fetchConversations(
  token: string,
  options: FetchConversationsOptions,
): Promise<ConversationsResponse> {
  const params = new URLSearchParams();
  if (options.answered !== undefined) params.set("answered", String(options.answered));
  if (options.search) params.set("search", options.search);
  if (options.sessionId) params.set("sessionId", options.sessionId);
  if (options.since) params.set("since", options.since);
  if (options.sortBy) params.set("sortBy", options.sortBy);
  if (options.sortDir) params.set("sortDir", options.sortDir);
  params.set("limit", String(options.limit));
  params.set("offset", String(options.offset));

  const response = await fetch(`/admin/conversations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    throw new UnauthorizedError("Invalid token");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as ConversationsResponse;
}

export async function deleteConversation(token: string, id: string): Promise<void> {
  const response = await fetch(`/admin/conversations/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    throw new UnauthorizedError("Invalid token");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export interface AdminStats {
  totals: {
    total: number;
    answered: number;
    unanswered: number;
    feedbackUp: number;
    feedbackDown: number;
  };
  topUnanswered: { question: string; times: number }[];
  topSources: { title: string; url: string | null; anchor: string | null; times: number }[];
  daily: { day: string; total: number; unanswered: number }[];
  chartDays: number;
}

export async function fetchStats(token: string, days?: number): Promise<AdminStats> {
  const query = days ? `?days=${days}` : "";
  const response = await fetch(`/admin/stats${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    throw new UnauthorizedError("Invalid token");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as AdminStats;
}
