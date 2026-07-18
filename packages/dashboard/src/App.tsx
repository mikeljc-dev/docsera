import { useState } from "preact/hooks";
import { AnalyticsView } from "./AnalyticsView.js";
import { clearToken, getStoredToken, storeToken } from "./api.js";
import { ConversationsView } from "./ConversationsView.js";

type Tab = "analytics" | "conversations";

export function App() {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [inputValue, setInputValue] = useState("");
  const [tab, setTab] = useState<Tab>("analytics");

  if (!token) {
    return (
      <div class="login">
        <h1>Docsera — Admin panel</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = inputValue.trim();
            if (!trimmed) return;
            storeToken(trimmed);
            setToken(trimmed);
          }}
        >
          <label>
            Admin token (ADMIN_TOKEN)
            <input
              type="password"
              value={inputValue}
              onInput={(event) => setInputValue((event.target as HTMLInputElement).value)}
              placeholder="Paste your ADMIN_TOKEN"
              autoFocus
            />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </div>
    );
  }

  const onUnauthorized = () => {
    clearToken();
    setToken(null);
  };

  return (
    <div class="app">
      <nav class="tabs">
        <button class={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}>
          Analytics
        </button>
        <button
          class={tab === "conversations" ? "active" : ""}
          onClick={() => setTab("conversations")}
        >
          Conversations
        </button>
      </nav>
      {tab === "analytics" ? (
        <AnalyticsView token={token} onUnauthorized={onUnauthorized} />
      ) : (
        <ConversationsView token={token} onUnauthorized={onUnauthorized} />
      )}
    </div>
  );
}
