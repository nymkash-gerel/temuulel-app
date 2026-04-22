-- Align subscription_plans table with the pricing shown on the landing page
-- (Buildry-competitive pricing):
--   Free     — 0₮         / 100 messages
--   Basic    — 89,900₮    / 10,000 messages
--   Starter  — 149,900₮   / 15,000 messages  (new tier)
--   Pro      — 249,900₮   / 30,000 messages, 3 pages
--   Enterprise — deactivated (kept in DB for future custom deals)
--
-- Adds is_active + sort_order columns for plan selection UI.

-- 1. Schema additions (idempotent)
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- 2. Update existing rows
UPDATE subscription_plans
SET
  price = 0,
  limits = jsonb_build_object(
    'orders', 50,
    'channels', jsonb_build_array('web'),
    'messages', 100,
    'products', 10,
    'analytics', false,
    'ai_replies', 50,
    'api_access', false,
    'team_members', 1,
    'connected_pages', 1
  ),
  is_active = true,
  sort_order = 10
WHERE slug = 'free';

UPDATE subscription_plans
SET
  price = 89900,
  limits = jsonb_build_object(
    'orders', 500,
    'channels', jsonb_build_array('web', 'messenger'),
    'messages', 10000,
    'products', 100,
    'analytics', true,
    'ai_replies', 10000,
    'api_access', false,
    'team_members', 3,
    'connected_pages', 1,
    'comment_auto_reply', false,
    'delivery_integration', false
  ),
  is_active = true,
  sort_order = 20
WHERE slug = 'basic';

UPDATE subscription_plans
SET
  price = 249900,
  limits = jsonb_build_object(
    'orders', 5000,
    'channels', jsonb_build_array('web', 'messenger', 'instagram'),
    'messages', 30000,
    'products', 1000,
    'analytics', true,
    'ai_replies', 30000,
    'api_access', true,
    'team_members', 10,
    'connected_pages', 3,
    'comment_auto_reply', true,
    'delivery_integration', true,
    'priority_support', true
  ),
  is_active = true,
  sort_order = 40
WHERE slug = 'pro';

UPDATE subscription_plans
SET
  is_active = false,
  sort_order = 99
WHERE slug = 'enterprise';

-- 3. Insert the new 'starter' tier (idempotent via ON CONFLICT)
INSERT INTO subscription_plans (slug, name, price, limits, is_active, sort_order)
VALUES (
  'starter',
  'Starter',
  149900,
  jsonb_build_object(
    'orders', 1500,
    'channels', jsonb_build_array('web', 'messenger', 'instagram'),
    'messages', 15000,
    'products', 300,
    'analytics', true,
    'ai_replies', 15000,
    'api_access', false,
    'team_members', 5,
    'connected_pages', 1,
    'comment_auto_reply', true,
    'delivery_integration', false
  ),
  true,
  30
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  limits = EXCLUDED.limits,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- 4. Index for active-plan selection UI
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active_sort
  ON subscription_plans (sort_order)
  WHERE is_active = true;
