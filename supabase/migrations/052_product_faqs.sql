-- Add product_faqs JSONB column to products table.
-- Stores structured Q&A pairs specific to each product, used by the AI chatbot
-- to answer product-specific questions accurately.
-- Example: {"Хэмжээ яаж авах вэ?": "Биеийн хэмжээ өгвөл зөвлөнө", "Материал?": "100% кашемир"}

ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_faqs JSONB DEFAULT NULL;

COMMENT ON COLUMN products.product_faqs IS 'Product-specific Q&A pairs for AI chatbot responses. JSON object with question keys and answer values.';
