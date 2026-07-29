CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'pt_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);
    ALTER TEXT SEARCH CONFIGURATION pt_unaccent
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, portuguese_stem;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        text NOT NULL,
  content_hash    text NOT NULL UNIQUE,
  size_bytes      integer NOT NULL,
  page_count      integer NOT NULL DEFAULT 0,
  chunk_count     integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'ready', 'failed')),
  error_message   text,
  contract_number text,
  buyer_name      text,
  development     text,
  total_value     text,
  delivery_term   text,
  signed_at       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
  position      integer NOT NULL,
  clause_number integer,
  clause_title  text,
  heading       text NOT NULL,
  content       text NOT NULL,
  page_start    integer,
  page_end      integer,
  char_count    integer NOT NULL,
  embedding     vector(384),
  search_vector tsvector GENERATED ALWAYS AS (
                  to_tsvector('pt_unaccent', heading || ' ' || content)
                ) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, position)
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chunks_search_vector_idx
  ON chunks USING gin (search_vector);

CREATE INDEX IF NOT EXISTS chunks_contract_id_idx
  ON chunks (contract_id);

CREATE INDEX IF NOT EXISTS contracts_created_at_idx
  ON contracts (created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contracts_set_updated_at ON contracts;
CREATE TRIGGER contracts_set_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
