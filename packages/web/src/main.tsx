import { render } from "preact";
import { App } from "./App.js";
import { initReveal } from "./reveal.js";
import "./style.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("No se encontró #app en el HTML");
}

render(<App />, root);
initReveal();
