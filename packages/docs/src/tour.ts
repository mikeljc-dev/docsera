import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// Tour de un solo paso que señala el widget cuando se llega desde el CTA
// "Try the live demo" de la landing (?demo=1). Sin el parámetro no molesta.

const WIDGET_POLL_MS = 200;
const WIDGET_TIMEOUT_MS = 12_000;

function openWidget(widget: Element): void {
  const fab = widget.shadowRoot?.querySelector<HTMLButtonElement>(".fab");
  fab?.click();
}

function startTour(widget: Element): void {
  const tour = driver({
    showProgress: false,
    showButtons: ["next", "close"],
    overlayOpacity: 0.6,
    stagePadding: 8,
    stageRadius: 32,
    doneBtnText: "Try it →",
    steps: [
      {
        element: "docsera-widget",
        popover: {
          title: "This is the live demo 👋",
          description:
            "This chat bubble is Docsera itself, running on these very docs. Click it and ask anything — every answer cites the exact section it came from.",
          side: "top",
          align: "end",
        },
      },
    ],
    onDestroyed: () => {
      openWidget(widget);
    },
  });
  tour.drive();
}

if (new URLSearchParams(window.location.search).has("demo")) {
  const startedAt = Date.now();
  const poll = setInterval(() => {
    const widget = document.querySelector("docsera-widget");
    if (widget) {
      clearInterval(poll);
      startTour(widget);
    } else if (Date.now() - startedAt > WIDGET_TIMEOUT_MS) {
      clearInterval(poll);
    }
  }, WIDGET_POLL_MS);
}
