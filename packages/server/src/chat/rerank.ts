import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Tokenizer } from "@huggingface/tokenizers";
import * as ort from "onnxruntime-web";

// Cross-encoder ligero (6 capas, cuantizado a int8, ~23 MB) especializado en
// reordenar pares pregunta-pasaje. Corre sobre onnxruntime-web (WASM) en vez
// de onnxruntime-node: la versión nativa no tiene binarios para Alpine/musl
// (issue abierto en microsoft/onnxruntime desde 2021), y cambiar la imagen
// base a una glibc casi duplicaría su tamaño solo por esto. WASM se queda en
// node:20-alpine sin tocarlo, a costa de algo de velocidad — ver
// ARCHITECTURE.md para la comparativa completa.
const MODEL_BASE_URL = "https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2/resolve/main";
const MAX_SEQ_LEN = 512;
// [SEP]: fijo en el tokenizer.json de este modelo (vocabulario BERT estándar).
const SEP_TOKEN_ID = 102;

export interface RerankCandidate {
  id: string;
  content: string;
}

interface Reranker {
  session: ort.InferenceSession;
  tokenizer: Tokenizer;
}

// No se hornea en la imagen Docker a propósito: así el tamaño de la imagen
// no crece para quien no activa esta feature (opt-in, RERANKER_ENABLED). Se
// descarga una vez al primer uso, igual que un `ollama pull` — un archivo de
// modelo estático, no datos de usuario, así que no rompe "privacy-first".
async function downloadIfMissing(url: string, path: string): Promise<void> {
  try {
    await access(path);
    return;
  } catch {
    // no existe todavía, se descarga a continuación
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: HTTP ${response.status}`);
  }
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

let rerankerPromise: Promise<Reranker> | null = null;

async function loadReranker(): Promise<Reranker> {
  const dir = join(tmpdir(), "docsera-reranker");
  await mkdir(dir, { recursive: true });
  const modelPath = join(dir, "model_quantized.onnx");
  const tokenizerPath = join(dir, "tokenizer.json");

  await Promise.all([
    downloadIfMissing(`${MODEL_BASE_URL}/onnx/model_quantized.onnx`, modelPath),
    downloadIfMissing(`${MODEL_BASE_URL}/tokenizer.json`, tokenizerPath),
  ]);

  const raw = JSON.parse(await readFile(tokenizerPath, "utf-8")) as Record<string, unknown>;
  // El constructor de Tokenizer arma cada pieza (normalizer, pre_tokenizer...)
  // internamente a partir de su campo `type`, tal cual viene en tokenizer.json
  // — no hace falta instanciar WordPiece/BertNormalizer/etc. a mano.
  const tokenizer = new Tokenizer(
    {
      model: raw.model,
      normalizer: raw.normalizer,
      pre_tokenizer: raw.pre_tokenizer,
      post_processor: raw.post_processor,
      decoder: raw.decoder,
      added_tokens: raw.added_tokens ?? [],
    },
    raw,
  );

  const session = await ort.InferenceSession.create(modelPath);
  return { session, tokenizer };
}

interface EncodedPair {
  ids: number[];
  attentionMask: number[];
  tokenTypeIds: number[];
}

// Los chunks rondan los 1500 caracteres (MAX_CHUNK_CHARS en chunk.ts); BERT
// solo admite 512 posiciones. Truncar por caracteres antes de tokenizar
// cubre el caso normal; esto es el cinturón de seguridad para textos con
// una proporción caracteres/token distinta (CJK, código muy denso...):
// recorta tokens conservando el [SEP] final para que la secuencia no quede
// mal formada.
export function truncateEncodedPair(pair: EncodedPair, maxLen: number = MAX_SEQ_LEN): EncodedPair {
  if (pair.ids.length <= maxLen) return pair;
  // El type_id del pasaje (1) es constante en todo su tramo; con la
  // secuencia ya comprobada más larga que maxLen, el último elemento existe.
  const lastTypeId = pair.tokenTypeIds.at(-1) ?? 1;
  return {
    ids: [...pair.ids.slice(0, maxLen - 1), SEP_TOKEN_ID],
    attentionMask: pair.attentionMask.slice(0, maxLen),
    tokenTypeIds: [...pair.tokenTypeIds.slice(0, maxLen - 1), lastTypeId],
  };
}

async function scorePair(reranker: Reranker, query: string, passage: string): Promise<number> {
  const encoded = reranker.tokenizer.encode(query, {
    text_pair: passage,
    return_token_type_ids: true,
  }) as { ids: number[]; attention_mask: number[]; token_type_ids: number[] };

  const { ids, attentionMask, tokenTypeIds } = truncateEncodedPair({
    ids: encoded.ids,
    attentionMask: encoded.attention_mask,
    tokenTypeIds: encoded.token_type_ids,
  });

  const n = ids.length;
  const feeds = {
    input_ids: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, n]),
    attention_mask: new ort.Tensor("int64", BigInt64Array.from(attentionMask.map(BigInt)), [1, n]),
    token_type_ids: new ort.Tensor("int64", BigInt64Array.from(tokenTypeIds.map(BigInt)), [1, n]),
  };
  const results = await reranker.session.run(feeds);
  const logits = results.logits;
  if (!logits) throw new Error("El modelo de re-ranking no devolvió 'logits'");
  return Number(logits.data[0]);
}

export function isRerankerEnabled(): boolean {
  return process.env.RERANKER_ENABLED === "true";
}

// Reordena `candidates` por relevancia real al `query` según el
// cross-encoder, de más a menos relevante. Secuencial a propósito: una
// sesión de onnxruntime-web (WASM, sin hilos) no gana nada con
// Promise.all — son ~12 candidatos, no compensa la complejidad de un
// batch con padding manual.
export async function rerank(query: string, candidates: RerankCandidate[]): Promise<string[]> {
  if (candidates.length === 0) return [];
  rerankerPromise ??= loadReranker().catch((error: unknown) => {
    // Un fallo de carga (sin red, HF caído...) no debe envenenar llamadas
    // futuras para siempre: se reintenta en la próxima petición.
    rerankerPromise = null;
    throw error;
  });
  const reranker = await rerankerPromise;

  const scored: { id: string; score: number }[] = [];
  for (const candidate of candidates) {
    const score = await scorePair(reranker, query, candidate.content);
    scored.push({ id: candidate.id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.id);
}
