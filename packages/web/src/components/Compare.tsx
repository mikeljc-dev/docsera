interface ComparisonRow {
  label: string;
  docsera: string;
  hosted: string;
}

const ROWS: ComparisonRow[] = [
  { label: "Code", docsera: "Open (AGPL-3.0)", hosted: "Proprietary" },
  { label: "Where it runs", docsera: "Your server", hosted: "Their cloud" },
  { label: "Where your data lives", docsera: "Your Postgres", hosted: "Their infrastructure" },
  { label: "LLM", docsera: "Whichever you choose, even local", hosted: "Managed by them" },
  { label: "Cost", docsera: "Free + your infra", hosted: "Subscription" },
];

export function Compare() {
  return (
    <section id="compare">
      <h2 class="reveal">How does it compare?</h2>
      <p class="lead reveal">
        Intercom Fin, Mintlify, DocsBot, or kapa.ai solve the same problem as a managed service.
        Docsera is the open source, self-hosted version.
      </p>
      <div class="compare reveal">
        <div class="compare-row compare-head">
          <div />
          <div>Docsera</div>
          <div>Managed alternatives</div>
        </div>
        {ROWS.map((row) => (
          <div class="compare-row" key={row.label}>
            <div class="compare-label">{row.label}</div>
            <div class="compare-docsera">{row.docsera}</div>
            <div class="compare-hosted">{row.hosted}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
