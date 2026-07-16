import "./widget.js";
import type { AskDocsWidget } from "./widget.js";

const currentScript = document.currentScript as HTMLScriptElement | null;
const server = currentScript?.dataset["server"];

if (server && !document.querySelector("askdocs-widget")) {
  const el = document.createElement("askdocs-widget") as AskDocsWidget;
  el.setAttribute("server", server);
  const heading = currentScript?.dataset["heading"];
  if (heading) el.setAttribute("heading", heading);
  document.body.appendChild(el);
}
