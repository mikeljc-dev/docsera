import { createInterface } from "node:readline";
import { detectSource } from "./detect.js";
import { bold, cyan, dim, yellow } from "./ui.js";
import type { IngestSource } from "./detect.js";
import type { SetupConfig } from "./generate.js";

export type WizardAnswers = Pick<
  SetupConfig,
  "chatProvider" | "embeddingProvider" | "anthropicApiKey" | "openaiApiKey" | "openaiBaseUrl" | "chatModel"
> & {
  source: IngestSource | null;
  origin: string | null;
};

// Si hay un Ollama corriendo en la máquina, el wizard lo ofrece como default:
// es la ruta sin API keys y por tanto la de menos fricción.
export async function detectOllamaModels(): Promise<string[] | null> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((model) => model.name);
  } catch {
    return null;
  }
}

// readline a pelo con cola de líneas propia: `rl.question` se rompe si el
// stdin es una tubería que llega a EOF antes de preguntar (instalaciones
// scriptadas tipo `printf "3\n..." | npx docsera`). Aquí las líneas se
// bufferizan y el EOF pasa a significar "acepta el default".
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY ?? false });
  const buffered: string[] = [];
  let waiting: ((line: string) => void) | null = null;
  let closed = false;
  rl.on("line", (line) => {
    if (waiting !== null) {
      const resolve = waiting;
      waiting = null;
      resolve(line);
    } else {
      buffered.push(line);
    }
  });
  rl.on("close", () => {
    closed = true;
    if (waiting !== null) {
      const resolve = waiting;
      waiting = null;
      resolve("");
    }
  });
  return {
    question(text: string): Promise<string> {
      const fromBuffer = buffered.shift();
      if (fromBuffer !== undefined) {
        process.stdout.write(text + fromBuffer + "\n");
        return Promise.resolve(fromBuffer);
      }
      if (closed) {
        process.stdout.write(text + "\n");
        return Promise.resolve("");
      }
      process.stdout.write(text);
      return new Promise((resolve) => {
        waiting = resolve;
      });
    },
    eof(): boolean {
      return closed && buffered.length === 0;
    },
    close(): void {
      rl.close();
    },
  };
}

export async function runWizard(): Promise<WizardAnswers> {
  const rl = createPrompter();
  const ask = async (question: string, fallback = ""): Promise<string> => {
    const answer = (await rl.question(question)).trim();
    return answer === "" ? fallback : answer;
  };
  const askRequired = async (question: string): Promise<string> => {
    for (;;) {
      const answer = (await rl.question(question)).trim();
      if (answer !== "") return answer;
      if (rl.eof()) {
        throw new Error("Input ended before a required answer (an API key) was provided.");
      }
      console.log(yellow("  This one is required."));
    }
  };

  try {
    const ollamaModels = await detectOllamaModels();
    const ollamaHint =
      ollamaModels !== null ? "detected on this machine ✓" : "not detected at localhost:11434";

    console.log(bold("\nHow should answers be generated?\n"));
    console.log("  1) Anthropic (Claude) — needs an API key");
    console.log("  2) OpenAI or any compatible API (Gemini, Groq, Mistral…) — needs an API key");
    console.log(`  3) Ollama — free, fully local (${ollamaHint})`);
    const providerDefault = ollamaModels !== null ? "3" : "1";
    let chatProvider: WizardAnswers["chatProvider"];
    for (;;) {
      const choice = await ask(`\nChoose 1-3 ${dim(`[${providerDefault}]`)}: `, providerDefault);
      if (choice === "1") { chatProvider = "anthropic"; break; }
      if (choice === "2") { chatProvider = "openai"; break; }
      if (choice === "3") { chatProvider = "ollama"; break; }
      console.log(yellow("  Please answer 1, 2 or 3."));
    }

    let anthropicApiKey: string | undefined;
    let openaiApiKey: string | undefined;
    let openaiBaseUrl: string | undefined;
    let chatModel: string | undefined;
    let embeddingProvider: WizardAnswers["embeddingProvider"];

    if (chatProvider === "anthropic") {
      anthropicApiKey = await askRequired("Anthropic API key (sk-ant-…): ");
      // Anthropic no tiene API de embeddings: hay que elegir quién indexa.
      console.log(bold("\nIndexing your docs needs an embeddings provider (Anthropic has none):\n"));
      console.log("  1) OpenAI — needs an OpenAI API key");
      console.log(`  2) Ollama — free, local (${ollamaHint})`);
      const embedDefault = ollamaModels !== null ? "2" : "1";
      for (;;) {
        const choice = await ask(`\nChoose 1-2 ${dim(`[${embedDefault}]`)}: `, embedDefault);
        if (choice === "1") { embeddingProvider = "openai"; break; }
        if (choice === "2") { embeddingProvider = "ollama"; break; }
        console.log(yellow("  Please answer 1 or 2."));
      }
      if (embeddingProvider === "openai") {
        openaiApiKey = await askRequired("OpenAI API key (for embeddings): ");
      }
    } else if (chatProvider === "openai") {
      openaiBaseUrl = await ask(
        `OpenAI-compatible base URL ${dim("[press Enter for OpenAI itself]")}: `,
      ) || undefined;
      openaiApiKey = await askRequired("API key: ");
      embeddingProvider = "openai";
    } else {
      embeddingProvider = "ollama";
      const modelHint =
        ollamaModels && ollamaModels.length > 0
          ? `available: ${ollamaModels.join(", ")}`
          : "will be used once Ollama is installed";
      chatModel = await ask(`Ollama chat model ${dim(`[llama3.1] (${modelHint})`)}: `, "llama3.1");
    }

    if (embeddingProvider === "ollama") {
      if (ollamaModels === null) {
        console.log(
          yellow(
            "\n⚠ Ollama was not detected. Install it from https://ollama.com and run\n" +
              "  `ollama pull nomic-embed-text` before ingesting your docs.",
          ),
        );
      } else if (!ollamaModels.some((name) => name.startsWith("nomic-embed-text"))) {
        console.log(
          yellow("\n⚠ Run `ollama pull nomic-embed-text` — it's the embedding model used for indexing."),
        );
      }
    }

    let source: IngestSource | null = null;
    for (;;) {
      const raw = await ask(
        `\nYour docs, to index them now — a URL, a sitemap.xml or a GitHub owner/repo ${dim("[Enter to skip]")}: `,
      );
      if (raw === "") break;
      source = detectSource(raw);
      if (source !== null) break;
      console.log(yellow("  That doesn't look like an http(s) URL or owner/repo. Try again or press Enter to skip."));
    }

    let origin: string | null = null;
    for (;;) {
      const raw = await ask(
        `Website where the widget will be embedded, e.g. ${cyan("https://docs.example.com")} ${dim("[Enter to add later]")}: `,
      );
      if (raw === "") break;
      try {
        origin = new URL(raw).origin;
        break;
      } catch {
        console.log(yellow("  That doesn't look like a URL. Try again or press Enter to skip."));
      }
    }

    return {
      chatProvider,
      embeddingProvider,
      anthropicApiKey,
      openaiApiKey,
      openaiBaseUrl,
      chatModel,
      source,
      origin,
    };
  } finally {
    rl.close();
  }
}
