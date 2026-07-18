-- Búsqueda híbrida: columna tsvector generada para full-text (BM25-ish via
-- ts_rank_cd) que se fusiona con la búsqueda vectorial por RRF. Config
-- 'simple' a propósito: sin stemming ni stopwords, agnóstica de idioma —
-- su papel es cazar términos exactos (nombres de funciones, variables de
-- entorno, códigos de error) donde el embedding flojea.
ALTER TABLE chunks ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE INDEX chunks_tsv_idx ON chunks USING gin (tsv);
