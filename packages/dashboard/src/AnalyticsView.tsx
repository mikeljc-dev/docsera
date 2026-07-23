import { useEffect, useState } from "preact/hooks";
import { type AdminStats, fetchStats, UnauthorizedError } from "./api.js";

interface Props {
  token: string;
  onUnauthorized: () => void;
}

function percent(part: number, whole: number): string {
  if (whole === 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function sourceLabel(source: AdminStats["topSources"][number]): string {
  if (!source.anchor) return source.title;
  return `${source.title} § ${source.anchor.replace(/-/g, " ")}`;
}

function sourceHref(source: AdminStats["topSources"][number]): string | null {
  if (!source.url) return null;
  return source.anchor ? `${source.url}#${source.anchor}` : source.url;
}

export function AnalyticsView({ token, onUnauthorized }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStats(token)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) return <p class="error">{error}</p>;
  if (!stats) return <p class="loading">Loading…</p>;

  const { totals } = stats;
  const voted = totals.feedbackUp + totals.feedbackDown;
  const maxUnanswered = Math.max(1, ...stats.topUnanswered.map((q) => q.times));
  const maxSource = Math.max(1, ...stats.topSources.map((s) => s.times));
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.total));

  return (
    <div class="analytics">
      <div class="tiles">
        <div class="tile">
          <span class="value">{totals.total}</span>
          <span class="label">Questions</span>
        </div>
        <div class="tile">
          <span class="value">{percent(totals.answered, totals.total)}</span>
          <span class="label">Answer rate</span>
        </div>
        <div class="tile">
          <span class="value">{totals.unanswered}</span>
          <span class="label">Unanswered</span>
        </div>
        <div class="tile">
          <span class="value">
            {totals.feedbackUp} / {totals.feedbackDown}
          </span>
          <span class="label">👍 / 👎</span>
        </div>
        <div class="tile">
          <span class="value">{percent(totals.feedbackUp, voted)}</span>
          <span class="label">Positive feedback</span>
        </div>
      </div>

      <section class="panel">
        <h2>Questions per day <span class="hint">(last 14 days)</span></h2>
        {stats.daily.length === 0 ? (
          <p class="empty-note">No activity yet.</p>
        ) : (
          <div class="days">
            {stats.daily.map((day) => (
              <div
                key={day.day}
                class="day"
                title={`${day.day}: ${day.total} questions (${day.unanswered} unanswered)`}
              >
                <div class="day-bar" style={{ height: `${(day.total / maxDaily) * 100}%` }} />
                <span class="day-label">{day.day.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div class="panels">
        <section class="panel">
          <h2>Top unanswered questions</h2>
          {stats.topUnanswered.length === 0 ? (
            <p class="empty-note">Nothing here — your docs are keeping up. 🎉</p>
          ) : (
            <ol class="rank">
              {stats.topUnanswered.map((item) => (
                <li key={item.question}>
                  <div class="rank-row">
                    <span class="rank-text">{item.question}</span>
                    <span class="rank-count">{item.times}</span>
                  </div>
                  <div class="rank-bar" style={{ width: `${(item.times / maxUnanswered) * 100}%` }} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <section class="panel">
          <h2>Most cited sections</h2>
          {stats.topSources.length === 0 ? (
            <p class="empty-note">No citations yet.</p>
          ) : (
            <ol class="rank">
              {stats.topSources.map((item) => {
                const href = sourceHref(item);
                return (
                  <li key={`${item.url}#${item.anchor}`}>
                    <div class="rank-row">
                      {href ? (
                        <a class="rank-text" href={href} target="_blank" rel="noopener noreferrer">
                          {sourceLabel(item)}
                        </a>
                      ) : (
                        <span class="rank-text">{sourceLabel(item)}</span>
                      )}
                      <span class="rank-count">{item.times}</span>
                    </div>
                    <div class="rank-bar" style={{ width: `${(item.times / maxSource) * 100}%` }} />
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
