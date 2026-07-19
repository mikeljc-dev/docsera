import type { HttpBindings } from "@hono/node-server";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import { z } from "zod";
import { runChat } from "../chat/index.js";
import { retrieveRelevantChunks, type RetrievedChunk } from "../chat/retrieve.js";
import { chatRateLimit } from "../lib/chatRateLimit.js";
import { getPool } from "../lib/db.js";
import { getEmbeddingsAdapter } from "../llm/index.js";
import { VERSION } from "../version.js";

// Se usa el Server de bajo nivel (no McpServer) para declarar los esquemas
// de las tools como JSON Schema plano: el SDK arrastra su propio zod y el
// registro de tools de alto nivel no acepta esquemas de zod v4 (el nuestro).
const searchArgs = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(10).default(6),
});

const askArgs = z.object({
  question: z.string().min(1).max(2000),
});

function sourceRef(chunk: RetrievedChunk): string {
  const base = chunk.url ?? chunk.title;
  return chunk.anchor ? `${base}#${chunk.anchor}` : base;
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No matching sections found in the indexed documentation.";
  }
  return chunks
    .map((chunk) => `## ${chunk.title}\nSource: ${sourceRef(chunk)}\n\n${chunk.content}`)
    .join("\n\n---\n\n");
}

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], isError };
}

function buildMcpServer(): Server {
  const server = new Server(
    { name: "docsera", version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: "search_docs",
        description:
          "Search the indexed documentation and return the most relevant sections " +
          "(hybrid vector + full-text retrieval). Cheap: no LLM call.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            limit: {
              type: "number",
              description: "Max sections to return (1-10, default 6)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "ask_docs",
        description:
          "Ask a question and get an answer generated from the indexed documentation, " +
          "with source links. Uses one LLM call.",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string", description: "Question to answer" },
          },
          required: ["question"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    try {
      switch (request.params.name) {
        case "search_docs": {
          const args = searchArgs.parse(request.params.arguments);
          const [embedding] = await getEmbeddingsAdapter().embed([args.query]);
          if (!embedding) throw new Error("No se pudo generar el embedding de la consulta");
          const chunks = await retrieveRelevantChunks(getPool(), embedding, args.query, args.limit);
          return textResult(formatChunks(chunks));
        }
        case "ask_docs": {
          const args = askArgs.parse(request.params.arguments);
          const result = await runChat({
            question: args.question,
            sessionId: crypto.randomUUID(),
          });
          const sources = result.sources
            .map((s) => `- ${s.title}: ${s.url ?? ""}${s.anchor ? `#${s.anchor}` : ""}`)
            .join("\n");
          return textResult(sources ? `${result.answer}\n\nSources:\n${sources}` : result.answer);
        }
        default:
          return textResult(`Unknown tool: ${request.params.name}`, true);
      }
    } catch (error) {
      // Superficie pública: el detalle queda en el log, como en /chat.
      console.error(`Error en MCP tool ${request.params.name}:`, error);
      if (error instanceof z.ZodError) {
        return textResult(`Invalid arguments: ${error.message}`, true);
      }
      return textResult("Something went wrong. Please try again in a moment.", true);
    }
  });

  return server;
}

export const mcpRoute = new Hono<{ Bindings: HttpBindings }>();

// Stateless: server y transport nuevos por petición, sin sesión. Cada POST
// es autocontenido, lo que encaja con instancias efímeras (Railway) y evita
// estado compartido entre clientes.
mcpRoute.post("/mcp", chatRateLimit, async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  c.env.outgoing.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(c.env.incoming, c.env.outgoing, body);
  return RESPONSE_ALREADY_SENT;
});

// En modo stateless no hay stream de servidor ni sesión que terminar.
mcpRoute.on(["GET", "DELETE"], "/mcp", (c) =>
  c.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed: stateless server, use POST" },
      id: null,
    },
    405,
  ),
);
