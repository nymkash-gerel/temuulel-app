-- Migration 011: Link products to Facebook/Instagram posts
-- Allows comment auto-reply to provide product-specific information

-- Add facebook_post_id to products table
ALTER TABLE products
ADD COLUMN facebook_post_id VARCHAR(100);

-- Add instagram_post_id for Instagram posts
ALTER TABLE products
ADD COLUMN instagram_post_id VARCHAR(100);

-- Index for fast lookup by post ID
CREATE INDEX idx_products_facebook_post ON products (facebook_post_id) WHERE facebook_post_id IS NOT NULL;
CREATE INDEX idx_products_instagram_post ON products (instagram_post_id) WHERE instagram_post_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN products.facebook_post_id IS 'Facebook post ID where this product was promoted';
COMMENT ON COLUMN products.instagram_post_id IS 'Instagram post ID where this product was promoted';
