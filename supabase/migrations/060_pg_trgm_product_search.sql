-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on products.name for trigram similarity search
-- This enables fast fuzzy matching: "скимс" matches "SKIMS Хуулбарууд"
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

-- GIN index on products.description for trigram search
CREATE INDEX IF NOT EXISTS idx_products_description_trgm
  ON products USING GIN (description gin_trgm_ops);

-- Create a helper function for product fuzzy search
-- Returns products matching a query by trigram similarity
CREATE OR REPLACE FUNCTION search_products_fuzzy(
  p_store_id UUID,
  p_query TEXT,
  p_threshold FLOAT DEFAULT 0.3,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  base_price NUMERIC,
  similarity_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.category,
    p.base_price,
    GREATEST(
      similarity(LOWER(p.name), LOWER(p_query)),
      similarity(LOWER(COALESCE(p.description, '')), LOWER(p_query))
    ) AS similarity_score
  FROM products p
  WHERE p.store_id = p_store_id
    AND p.status = 'active'
    AND (
      similarity(LOWER(p.name), LOWER(p_query)) > p_threshold
      OR similarity(LOWER(COALESCE(p.description, '')), LOWER(p_query)) > p_threshold
      OR LOWER(p.name) LIKE '%' || LOWER(p_query) || '%'
    )
  ORDER BY similarity_score DESC
  LIMIT p_limit;
$$;
