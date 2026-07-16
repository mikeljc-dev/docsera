import { GITHUB_URL } from "../links.js";

export function Hero() {
  return (
    <header class="hero">
      <h1>
        AI chat for your docs.
        <br />
        <em>Open source. Self-hosted. One line.</em>
      </h1>
      <p class="sub">
        Add an intelligent assistant to your documentation with a single script tag. Your data
        never leaves your server. Every answer cites its sources.
      </p>
      <div class="cta">
        <a class="btn primary" href={`${GITHUB_URL}#installation`}>
          Get started
        </a>
        <a class="btn ghost" href={GITHUB_URL}>
          Star on GitHub
        </a>
      </div>

      <div class="snippet">
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
