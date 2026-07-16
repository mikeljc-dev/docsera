import { useState } from "preact/hooks";
import { clearToken, getStoredToken, storeToken } from "./api.js";
import { ConversationsView } from "./ConversationsView.js";

export function App() {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [inputValue, setInputValue] = useState("");

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

  return (
    <ConversationsView
      token={token}
      onUnauthorized={() => {
        clearToken();
        setToken(null);
      }}
    />
  );
}
