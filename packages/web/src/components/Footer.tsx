import { GITHUB_URL } from "../links.js";

export function Footer() {
  return (
    <footer>
      <div>
        Docsera · <a href={`${GITHUB_URL}/blob/main/LICENSE`}>AGPL-3.0</a>
      </div>
      <div>
        <a href={GITHUB_URL}>GitHub</a> · <a href="https://docs.docsera.dev">Docs</a> ·{" "}
        <a href="https://docsera.dev">docsera.dev</a>
      </div>
    </footer>
  );
}
