export function Demo() {
  return (
    <section id="demo">
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
        Every answer links to the exact section it came from. Faced with something it doesn't
        know, it says "I don't know" — without calling the LLM.
      </p>
    </section>
  );
}
