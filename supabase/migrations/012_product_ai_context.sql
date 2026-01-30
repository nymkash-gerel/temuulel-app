-- Migration 012: Add AI context to products
-- Allows product-specific AI instructions for comment auto-reply

-- Add ai_context column to products table
ALTER TABLE products
ADD COLUMN ai_context TEXT;

-- Comment for documentation
COMMENT ON COLUMN products.ai_context IS 'Product-specific AI instructions for comment auto-reply';
