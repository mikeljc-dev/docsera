import { useState } from "preact/hooks";
import { clearToken, getStoredToken, storeToken } from "./api.js";
import { ConversationsView } from "./ConversationsView.js";

export function App() {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [inputValue, setInputValue] = useState("");

  if (!token) {
    return (
      <div class="login">
        <h1>AskDocs — Panel de administración</h1>
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
            Token de administración (ADMIN_TOKEN)
            <input
              type="password"
              value={inputValue}
              onInput={(event) => setInputValue((event.target as HTMLInputElement).value)}
              placeholder="Pega tu ADMIN_TOKEN"
              autoFocus
            />
          </label>
          <button type="submit">Entrar</button>
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
