import { GITHUB_URL } from "../links.js";

export function Footer() {
  return (
    <footer>
      <div>
        © 2026 Docsera · <a href={`${GITHUB_URL}/blob/main/LICENSE`}>AGPL-3.0</a>
      </div>
      <div>
        <a href={GITHUB_URL}>GitHub</a> ·{" "}
        <a href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`}>Contributing</a>
      </div>
    </footer>
  );
}
