export interface Conversation {
  id: string;
  sessionId: string;
  question: string;
  answer: string | null;
  answered: boolean;
  createdAt: string;
  sourceCount: number;
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

export interface FetchConversationsOptions {
  answered?: boolean;
  limit: number;
  offset: number;
}

export async function fetchConversations(
  token: string,
  options: FetchConversationsOptions,
): Promise<ConversationsResponse> {
  const params = new URLSearchParams();
  if (options.answered !== undefined) params.set("answered", String(options.answered));
  params.set("limit", String(options.limit));
  params.set("offset", String(options.offset));

  const response = await fetch(`/admin/conversations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    throw new UnauthorizedError("Token inválido");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as ConversationsResponse;
}
