import { useState } from "preact/hooks";
import { AnalyticsView } from "./AnalyticsView.js";
import { clearToken, getStoredToken, storeToken } from "./api.js";
import { ConversationsView } from "./ConversationsView.js";
import { ThemeToggle } from "./ThemeToggle.js";

type Tab = "analytics" | "conversations";

const BASE = import.meta.env.BASE_URL;

function Logo({ width, height }: { width: number; height: number }) {
  return (
    <>
      <img
        class="logo logo-dark"
        src={`${BASE}assets/docsera-logotype-dark.svg`}
        width={width}
        height={height}
        alt="Docsera"
      />
      <img
        class="logo logo-light"
        src={`${BASE}assets/docsera-logotype-light.svg`}
        width={width}
        height={height}
        alt="Docsera"
      />
    </>
  );
}

export function App() {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [inputValue, setInputValue] = useState("");
  const [tab, setTab] = useState<Tab>("analytics");

  if (!token) {
    return (
      <div class="login">
        <Logo width={140} height={35} />
        <p class="login-subtitle">Admin panel</p>
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

  const signOut = () => {
    clearToken();
    setToken(null);
  };

  return (
    <div class="app">
      <header class="site-header">
        <Logo width={112} height={28} />
        <div class="site-header-actions">
          <ThemeToggle />
          <button class="sign-out" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
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
