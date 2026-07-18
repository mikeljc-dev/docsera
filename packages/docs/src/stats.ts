// Pinta las estadísticas en vivo de esta demo (endpoint público de
// solo-agregados del server). Si el endpoint no está activo o falla, la
// sección simplemente no aparece — nunca rompe la página.

const STATS_URL = "https://api.docsera.dev/stats/public";

interface PublicStats {
  totals: { total: number; answered: number; unanswered: number; feedbackUp: number };
  daily: { day: string; total: number }[];
  topSources: { title: string; anchor: string | null; times: number }[];
}

function tile(value: string, label: string): string {
  return `<div class="live-tile"><span class="value">${value}</span><span class="label">${label}</span></div>`;
}

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function render(): Promise<void> {
  const container = document.getElementById("live-stats");
  if (!container) return;

  let stats: PublicStats;
  try {
    const response = await fetch(STATS_URL);
    if (!response.ok) return;
    stats = (await response.json()) as PublicStats;
  } catch {
    return;
  }

  const { totals } = stats;
  const rate = totals.total > 0 ? `${Math.round((totals.answered / totals.total) * 100)}%` : "—";
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.total));

  const bars = stats.daily
    .map(
      (d) =>
        `<div class="live-day" title="${esc(d.day)}: ${d.total}"><div class="live-day-bar" style="height:${Math.max(4, (d.total / maxDaily) * 100)}%"></div></div>`,
    )
    .join("");

  const sources = stats.topSources
    .map((s) => {
      const label = s.anchor ? `${s.title} § ${s.anchor.replace(/-/g, " ")}` : s.title;
      return `<li>${esc(label)} <span class="live-count">×${s.times}</span></li>`;
    })
    .join("");

  container.innerHTML = `
    <h3>This demo, right now</h3>
    <div class="live-tiles">
      ${tile(String(totals.total), "questions asked")}
      ${tile(rate, "answer rate")}
      ${tile(String(totals.feedbackUp), "👍 received")}
    </div>
    <div class="live-row">
      <div class="live-chart"><h4>Questions per day</h4><div class="live-days">${bars}</div></div>
      <div class="live-sources"><h4>Most cited sections</h4><ul>${sources}</ul></div>
    </div>
  `;
  container.hidden = false;
}

void render();
