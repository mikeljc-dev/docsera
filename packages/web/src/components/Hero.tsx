import { GITHUB_URL } from "../links.js";

export function Hero() {
  return (
    <header class="hero"><div class="glow" aria-hidden="true"></div>
      <div class="badge hero-in" style="--d:0">
        <span class="dot" /> v{__DOCSERA_VERSION__} · open source · AGPL-3.0
      </div>
      <h1 class="hero-in" style="--d:1">
        AI chat for your docs,
        <br />
        <em>with citations to the source</em>
      </h1>
      <p class="sub hero-in" style="--d:2">
        Add an intelligent assistant to your docs with a single line of code. Self-hosted,
        privacy-first, and works with Anthropic, OpenAI, or Ollama locally.
      </p>
      <div class="cta hero-in" style="--d:3">
        <a class="btn primary" href={GITHUB_URL}>
          npx docsera
        </a>
        <a class="btn ghost" href="https://docs.docsera.dev/?demo=1">
          See live demo
        </a>
      </div>
      <p class="cta-note hero-in" style="--d:4">Installed in under 10 minutes with Docker Compose.</p>

      <div class="snippet hero-in" style="--d:5">
        <div class="bar">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
          &nbsp;index.html
        </div>
        <pre>
          <code>
            <span class="c">{"<!-- one line, your docs with AI -->"}</span>
            {"\n"}
            <span class="k">{"<script"}</span> <span class="s">src</span>=
            <span class="s">"https://docs.yourdomain.com/widget.js"</span>
            {"\n        "}
            <span class="s">data-server</span>=
            <span class="s">"https://docs.yourdomain.com"</span>
            {"\n        "}
            <span class="s">data-primary</span>=<span class="s">"#2563eb"</span>
            <span class="k">{"></script>"}</span>
          </code>
        </pre>
      </div>
    </header>
  );
}
