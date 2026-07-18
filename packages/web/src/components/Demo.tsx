export function Demo() {
  return (
    <section id="demo">
      <h2 class="reveal">See it in action</h2>
      <p class="lead reveal">
        Suggested questions, answers with copyable code, per-section citations, 👍/👎 feedback —
        and an honest "I don't know".
      </p>
      <figure class="demo-shot reveal">
        <img
          src="/demo.gif"
          alt="The Docsera widget answering a question with code blocks and citations, then declining an off-topic question"
          loading="lazy"
          width="960"
          height="600"
        />
      </figure>
      <p class="demo-cta reveal">
        Or skip the recording — <a href="https://docs.docsera.dev/?demo=1">try it live</a>: the
        bubble on this page is the real thing.
      </p>
    </section>
  );
}
