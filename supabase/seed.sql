-- Test Data Seed for Temuulel
-- Run with: supabase db reset (or just this file)

-- Create test user (password: Test1234)
-- Password hash for "Test1234" using bcrypt
INSERT INTO auth.users (
  id,
  aud,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  '00000000-0000-0000-0000-000000000000',
  'shop@temuulel.com',
  crypt('Test1234', gen_salt('bf')), -- Test1234
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Монгол Маркет"}',
  false,
  'authenticated',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Create identity for email auth
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', '00000000-0000-0000-0000-000000000001', 'email', 'shop@temuulel.com'),
  'email',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Create public.users row (stores.owner_id references public.users, not auth.users)
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  is_verified,
  email_verified,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'shop@temuulel.com',
  'Монгол Маркет',
  'owner',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create ecommerce store
INSERT INTO stores (
  id,
  owner_id,
  name,
  slug,
  business_type,
  created_at,
  updated_at,
  chatbot_settings,
  shipping_settings
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Монгол Маркет',
  'mongol-market-test',
  'ecommerce',
  NOW(),
  NOW(),
  jsonb_build_object(
    'enabled', true,
    'auto_reply', true
  ),
  jsonb_build_object(
    'delivery_fee', 5000,
    'free_delivery_threshold', 100000,
    'free_delivery_items', 3
  )
) ON CONFLICT (id) DO NOTHING;

-- Create test products
INSERT INTO products (
  id,
  store_id,
  name,
  description,
  base_price,
  status,
  has_variants,
  created_at,
  updated_at
) VALUES
(
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Цамц',
  'Өвлийн дулаан цамц',
  45000,
  'active',
  true,
  NOW(),
  NOW()
),
(
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'Өмд',
  'Жинсэн өмд',
  35000,
  'active',
  true,
  NOW(),
  NOW()
),
(
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'Гутал',
  'Арьсан гутал',
  85000,
  'active',
  true,
  NOW(),
  NOW()
),
(
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'Малгай',
  'Зусах малгай',
  15000,
  'active',
  true,
  NOW(),
  NOW()
),
(
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'Цүнх',
  'Эмэгтэй цүнх',
  55000,
  'active',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create product variants with stock
INSERT INTO product_variants (
  id,
  product_id,
  size,
  color,
  price,
  stock_quantity,
  created_at
) VALUES
-- Цамц variants
('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'M', 'Цэнхэр', 45000, 10, NOW()),
-- Өмд variants
('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'L', 'Хар', 35000, 15, NOW()),
-- Гутал variants
('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '42', 'Бор', 85000, 5, NOW()),
-- Малгай variants
('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'Free', 'Улаан', 15000, 20, NOW()),
-- Цүнх variants (low stock for testing)
('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'Medium', 'Саарал', 55000, 2, NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test customer
INSERT INTO customers (
  id,
  store_id,
  name,
  phone,
  address,
  channel,
  created_at
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Болд',
  '99001122',
  'БЗД 5-р хороо',
  'messenger',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create conversation for customer
INSERT INTO conversations (
  id,
  store_id,
  customer_id,
  channel,
  status,
  created_at,
  updated_at
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'messenger',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Test data seeded successfully!';
  RAISE NOTICE 'Login: shop@temuulel.com / Test1234';
  RAISE NOTICE 'Store: Монгол Маркет (ecommerce)';
  RAISE NOTICE 'Products: 5 items';
  RAISE NOTICE 'Customer: Болд (99001122)';
END $$;
