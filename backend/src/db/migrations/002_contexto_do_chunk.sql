ALTER TABLE chunks ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT '';

ALTER TABLE chunks DROP COLUMN IF EXISTS search_vector;

ALTER TABLE chunks ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  to_tsvector('pt_unaccent', context || ' ' || heading || ' ' || content)
) STORED;

CREATE INDEX IF NOT EXISTS chunks_search_vector_idx
  ON chunks USING gin (search_vector);

ALTER TABLE contracts DROP COLUMN IF EXISTS status;
ALTER TABLE contracts DROP COLUMN IF EXISTS error_message;
