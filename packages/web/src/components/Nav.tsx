import { GITHUB_URL } from "../links.js";

export function Nav() {
  return (
    <nav>
      <div class="logo">
        Doc<span>sera</span>
      </div>
      <div class="links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a class="gh-btn" href={GITHUB_URL}>
          GitHub ↗
        </a>
      </div>
    </nav>
  );
}
