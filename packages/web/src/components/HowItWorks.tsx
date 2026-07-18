import type { ComponentChildren } from "preact";

interface Step {
  title: string;
  body: ComponentChildren;
}

const STEPS: Step[] = [
  {
    title: "Ingest",
    body: "Docsera crawls your sitemap or takes your Markdown, splits it into sections, and stores embeddings in Postgres with pgvector — one service for data and vectors.",
  },
  {
    title: "Retrieve",
    body: 'Each question is embedded and matched against your docs by cosine similarity. If nothing relevant passes the threshold, it answers "I don\'t know" without even calling the LLM.',
  },
  {
    title: "Answer with citations",
    body: (
      <>
        The LLM answers strictly from the retrieved context, and the widget shows the sources —
        deep links to the exact sections, like <code>/docs/install#requirements</code>.
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how">
      <h2 class="reveal">How it works</h2>
      <p class="lead reveal">Classic RAG, engineered to be boring and reliable.</p>
      <div class="steps">
        {STEPS.map((step) => (
          <div class="step reveal" key={step.title}>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
