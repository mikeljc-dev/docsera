-- Cambia chunks.embedding a 768 dimensiones para usar nomic-embed-text
-- (Ollama) en vez de text-embedding-3-small (OpenAI, 1536 dims).
-- Solo segura porque la tabla estaba vacia en el momento de escribir esto;
-- si ya tienes chunks ingeridos, necesitas re-ingestar todo tras aplicarla.
DROP INDEX IF EXISTS chunks_embedding_idx;

ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(__EMBEDDING_DIMENSIONS__)
  USING embedding::vector(__EMBEDDING_DIMENSIONS__);

CREATE INDEX chunks_embedding_idx ON chunks
  USING hnsw (embedding vector_cosine_ops);
