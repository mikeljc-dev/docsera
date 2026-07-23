import { GITHUB_URL } from "../links.js";

export function CTA() {
  return (
    <section id="cta">
      <div class="cta-card reveal">
        <h2>Your documentation, with an assistant that doesn't make things up</h2>
        <p>Free, open source, and your data stays in your Postgres.</p>
        <div class="cta">
          <a class="btn primary" href={GITHUB_URL}>
            Start on GitHub
          </a>
          <a class="btn ghost" href="https://docs.docsera.dev">
            Read the docs
          </a>
        </div>
      </div>
    </section>
  );
}
