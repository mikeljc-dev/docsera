import "./widget.js";
import type { DocseraWidget } from "./widget.js";

const currentScript = document.currentScript as HTMLScriptElement | null;
const server = currentScript?.dataset["server"];

if (server && !document.querySelector("docsera-widget")) {
  const el = document.createElement("docsera-widget") as DocseraWidget;
  el.setAttribute("server", server);
  const heading = currentScript?.dataset["heading"];
  if (heading) el.setAttribute("heading", heading);
  document.body.appendChild(el);
}
