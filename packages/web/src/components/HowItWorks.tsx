interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "npx docsera",
    body: "A wizard detects your LLM (local Ollama included), indexes your docs, and generates the config with secrets already in place.",
  },
  {
    title: "Paste the snippet",
    body: "One line of code with your brand's data-attributes: color, language, position, suggested questions.",
  },
  {
    title: "Check the dashboard",
    body: "Answer rate, uncovered questions, and user feedback to improve your docs.",
  },
];

export function HowItWorks() {
  return (
    <section id="how">
      <h2 class="reveal">Zero to widget in three steps</h2>
      <p class="lead reveal">One command spins up Postgres, ingests your docs, and hands you the ready snippet.</p>
      <div class="steps">
        {STEPS.map((step, i) => (
          <div class="step reveal" key={step.title}>
            <div class="step-badge">{i + 1}</div>
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
