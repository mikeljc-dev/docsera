interface Feature {
  shape: "square" | "circle" | "diamond";
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    shape: "square",
    title: "Privacy-first",
    body: "Self-hosted: your data never leaves your server, except calls to whatever LLM you choose — or none at all with Ollama.",
  },
  {
    shape: "circle",
    title: "LLM-agnostic",
    body: "Anthropic, OpenAI, or local models via Ollama. Chat and embeddings are configured independently.",
  },
  {
    shape: "diamond",
    title: "Answers with sources",
    body: 'Every response links to the exact section it came from. Before hallucinating, it says "I don\'t know."',
  },
  {
    shape: "square",
    title: "Flexible ingestion",
    body: "Markdown, a URL, a full sitemap, a PDF, or an entire GitHub repo — in one shot.",
  },
  {
    shape: "circle",
    title: "Analytics dashboard",
    body: "Answer rate, unanswered questions, most-cited sections, and 👍/👎 feedback.",
  },
  {
    shape: "diamond",
    title: "MCP server",
    body: "Expose your docs as an MCP server so AI agents can query them directly.",
  },
];

export function Features() {
  return (
    <section id="features">
      <h2 class="reveal">Everything a support chat needs, without giving up your data</h2>
      <p class="lead reveal">Think of the Intercom chat — but open source and hosted by you.</p>
      <div class="grid">
        {FEATURES.map((feature) => (
          <div class="card reveal" key={feature.title}>
            <div class="icon-tile">
              <span class={`icon-shape ${feature.shape}`} />
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
