import { GITHUB_URL } from "../links.js";
import { ThemeToggle } from "./ThemeToggle.js";

export function Nav() {
  return (
    <div class="nav-bar">
      <nav class="wrap">
        <div class="logo">
          <img class="logo-dark" src="/assets/docsera-logotype-dark.svg" width="118" height="30" alt="Docsera" />
          <img class="logo-light" src="/assets/docsera-logotype-light.svg" width="118" height="30" alt="Docsera" />
        </div>
        <div class="links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#compare">Compare</a>
          <a class="gh-btn" href={GITHUB_URL}>
            GitHub ↗
          </a>
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}
