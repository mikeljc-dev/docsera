import { GITHUB_URL } from "../links.js";

export function Hero() {
  return (
    <header class="hero"><div class="glow" aria-hidden="true"></div>
      <h1 class="hero-in" style="--d:0">
        AI chat for your docs.
        <br />
        <em>Open source. Self-hosted. One line.</em>
      </h1>
      <p class="sub hero-in" style="--d:1">
        Add an intelligent assistant to your documentation with a single script tag. Your data
        never leaves your server. Every answer cites its sources.
      </p>
      <div class="cta hero-in" style="--d:2">
        <a class="btn primary" href="https://docs.docsera.dev/?demo=1">
          Try the live demo
        </a>
        <a class="btn ghost" href={`${GITHUB_URL}#installation`}>
          Get started
        </a>
        <a class="btn ghost" href={GITHUB_URL}>
          Star on GitHub
        </a>
      </div>
      <p class="cta-note hero-in" style="--d:3">
        The chat bubble on this page — and on the docs — is Docsera itself, running on its own
        documentation.
      </p>

      <div class="snippet hero-in" style="--d:4">
        <div class="bar">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
          &nbsp;index.html
        </div>
        <pre>
          <code>
            <span class="c">{"<!-- That's the whole integration: -->"}</span>
            {"\n"}
            <span class="k">{"<script"}</span> <span class="s">src</span>=
            <span class="s">"https://docs.yourdomain.com/widget.js"</span>
            {"\n        "}
            <span class="s">data-server</span>=
            <span class="s">"https://docs.yourdomain.com"</span>
            <span class="k">{"></script>"}</span>
          </code>
        </pre>
      </div>
    </header>
  );
}
