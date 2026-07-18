interface Feature {
  icon: string;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: "🔒",
    title: "Privacy-first, self-hosted",
    body: "Deploy with Docker Compose in under 10 minutes. Conversations and documents stay in your Postgres. No third-party SaaS in the middle.",
  },
  {
    icon: "🔌",
    title: "Bring your own LLM",
    body: "Anthropic, OpenAI, or fully local models via Ollama — swappable adapters for chat and embeddings, configured independently.",
  },
  {
    icon: "📎",
    title: "Answers with sources",
    body: 'Every response links to the exact section of your docs it came from. When the docs don\'t have the answer, it says "I don\'t know" — before hallucinating.',
  },
  {
    icon: "📥",
    title: "Ingest anything",
    body: "Point it at a sitemap (nested indexes included), a URL, or raw Markdown from your CI. Re-ingesting unchanged content costs nothing.",
  },
  {
    icon: "📊",
    title: "Find your docs' gaps",
    body: "The dashboard shows your answer rate, top unanswered questions, most cited sections and 👍/👎 feedback — the most direct signal of what's missing in your documentation.",
  },
  {
    icon: "⚖️",
    title: "Open source, AGPL-3.0",
    body: "The core is and will always be open source. TypeScript monorepo: Hono API, Lit web component, Postgres + pgvector. No vendor lock-in.",
  },
];

export function Features() {
  return (
    <section id="features">
      <h2 class="reveal">Like Intercom for your docs — but yours</h2>
      <p class="lead reveal">Everything runs on your infrastructure with the LLM provider you choose.</p>
      <div class="grid">
        {FEATURES.map((feature) => (
          <div class="card reveal" key={feature.title}>
            <div class="icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
