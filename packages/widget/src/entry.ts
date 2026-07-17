import "./widget.js";
import type { DocseraWidget } from "./widget.js";

const currentScript = document.currentScript as HTMLScriptElement | null;
const server = currentScript?.dataset["server"];

if (server && !document.querySelector("docsera-widget")) {
  const el = document.createElement("docsera-widget") as DocseraWidget;
  el.setAttribute("server", server);
  const locale = currentScript?.dataset["locale"];
  if (locale) el.setAttribute("locale", locale);
  const heading = currentScript?.dataset["heading"];
  if (heading) el.setAttribute("heading", heading);
  const placeholder = currentScript?.dataset["placeholder"];
  if (placeholder) el.setAttribute("placeholder", placeholder);
  const primary = currentScript?.dataset["primary"];
  if (primary) el.setAttribute("primary", primary);
  const position = currentScript?.dataset["position"];
  if (position) el.setAttribute("position", position);
  const suggestions = currentScript?.dataset["suggestions"];
  if (suggestions) el.setAttribute("suggestions", suggestions);
  const contact = currentScript?.dataset["contact"];
  if (contact) el.setAttribute("contact", contact);
  document.body.appendChild(el);
}
