-- ============================================================================
-- TEMUULEL PLATFORM: 23 Test Business Accounts Seed Script
-- Run in Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================================

BEGIN;

-- ============================================================================
-- FIXED UUID SCHEME
-- Users:  00000000-0000-4000-a000-000000000001 .. 023
-- Stores: 00000000-0000-4000-a000-000000000101 .. 123
-- Staff:  00000000-0000-4000-a000-000000000201 .. 2xx
-- Products/Services: 00000000-0000-4000-a000-000000000301 .. 3xx
-- Customers: 00000000-0000-4000-a000-000000000401 .. 4xx
-- Vertical-specific: 00000000-0000-4000-a000-000000000501 .. 5xx
-- ============================================================================

-- Password hash for Test123456!
-- bcrypt: $2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC

-- ============================================================================
-- 1. AUTH USERS (Supabase auth.users)
-- ============================================================================

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
  confirmation_token, recovery_token
) VALUES
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'test@commerce.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Commerce Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'test@laundry.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Laundry Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000', 'test@beauty.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Beauty Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-0000-0000-000000000000', 'test@pet.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Pet Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-0000-0000-000000000000', 'test@carwash.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"CarWash Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000006', '00000000-0000-0000-0000-000000000000', 'test@wellness.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Wellness Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000007', '00000000-0000-0000-0000-000000000000', 'test@retail.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Retail Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000008', '00000000-0000-0000-0000-000000000000', 'test@photo.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Photo Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000009', '00000000-0000-0000-0000-000000000000', 'test@venue.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Venue Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000010', '00000000-0000-0000-0000-000000000000', 'test@cowork.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Cowork Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000011', '00000000-0000-0000-0000-000000000000', 'test@legal.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Legal Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000012', '00000000-0000-0000-0000-000000000000', 'test@construction.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Construction Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000013', '00000000-0000-0000-0000-000000000000', 'test@subscription.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Subscription Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000014', '00000000-0000-0000-0000-000000000000', 'test@qsr.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"QSR Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000015', '00000000-0000-0000-0000-000000000000', 'test@restaurant.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Restaurant Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000016', '00000000-0000-0000-0000-000000000000', 'test@stay.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Stay Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000017', '00000000-0000-0000-0000-000000000000', 'test@education.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Education Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000018', '00000000-0000-0000-0000-000000000000', 'test@sports.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sports Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000019', '00000000-0000-0000-0000-000000000000', 'test@medical.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Medical Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000020', '00000000-0000-0000-0000-000000000000', 'test@proservices.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ProServices Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000021', '00000000-0000-0000-0000-000000000000', 'test@repair.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000022', '00000000-0000-0000-0000-000000000000', 'test@homeservices.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"HomeServices Test"}', 'authenticated', 'authenticated', now(), now(), '', ''),
  ('00000000-0000-4000-a000-000000000023', '00000000-0000-0000-0000-000000000000', 'test@logistics.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Logistics Test"}', 'authenticated', 'authenticated', now(), now(), '', '')
ON CONFLICT (id) DO NOTHING;

-- Create identities for each auth user
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT id, id, json_build_object('sub', id, 'email', email), 'email', id::text, now(), now(), now()
FROM auth.users
WHERE id IN (
  '00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000005','00000000-0000-4000-a000-000000000006',
  '00000000-0000-4000-a000-000000000007','00000000-0000-4000-a000-000000000008','00000000-0000-4000-a000-000000000009',
  '00000000-0000-4000-a000-000000000010','00000000-0000-4000-a000-000000000011','00000000-0000-4000-a000-000000000012',
  '00000000-0000-4000-a000-000000000013','00000000-0000-4000-a000-000000000014','00000000-0000-4000-a000-000000000015',
  '00000000-0000-4000-a000-000000000016','00000000-0000-4000-a000-000000000017','00000000-0000-4000-a000-000000000018',
  '00000000-0000-4000-a000-000000000019','00000000-0000-4000-a000-000000000020','00000000-0000-4000-a000-000000000021',
  '00000000-0000-4000-a000-000000000022','00000000-0000-4000-a000-000000000023'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. PUBLIC USERS
-- ============================================================================

INSERT INTO users (id, email, password_hash, is_verified, email_verified, full_name) VALUES
  ('00000000-0000-4000-a000-000000000001', 'test@commerce.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Commerce Test'),
  ('00000000-0000-4000-a000-000000000002', 'test@laundry.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Laundry Test'),
  ('00000000-0000-4000-a000-000000000003', 'test@beauty.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Beauty Test'),
  ('00000000-0000-4000-a000-000000000004', 'test@pet.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Pet Test'),
  ('00000000-0000-4000-a000-000000000005', 'test@carwash.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'CarWash Test'),
  ('00000000-0000-4000-a000-000000000006', 'test@wellness.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Wellness Test'),
  ('00000000-0000-4000-a000-000000000007', 'test@retail.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Retail Test'),
  ('00000000-0000-4000-a000-000000000008', 'test@photo.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Photo Test'),
  ('00000000-0000-4000-a000-000000000009', 'test@venue.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Venue Test'),
  ('00000000-0000-4000-a000-000000000010', 'test@cowork.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Cowork Test'),
  ('00000000-0000-4000-a000-000000000011', 'test@legal.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Legal Test'),
  ('00000000-0000-4000-a000-000000000012', 'test@construction.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Construction Test'),
  ('00000000-0000-4000-a000-000000000013', 'test@subscription.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Subscription Test'),
  ('00000000-0000-4000-a000-000000000014', 'test@qsr.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'QSR Test'),
  ('00000000-0000-4000-a000-000000000015', 'test@restaurant.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Restaurant Test'),
  ('00000000-0000-4000-a000-000000000016', 'test@stay.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Stay Test'),
  ('00000000-0000-4000-a000-000000000017', 'test@education.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Education Test'),
  ('00000000-0000-4000-a000-000000000018', 'test@sports.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Sports Test'),
  ('00000000-0000-4000-a000-000000000019', 'test@medical.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Medical Test'),
  ('00000000-0000-4000-a000-000000000020', 'test@proservices.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'ProServices Test'),
  ('00000000-0000-4000-a000-000000000021', 'test@repair.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Repair Test'),
  ('00000000-0000-4000-a000-000000000022', 'test@homeservices.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'HomeServices Test'),
  ('00000000-0000-4000-a000-000000000023', 'test@logistics.temuulel.mn', '$2a$10$PznCQDDT0KjCzlOZL0rL.uZ0aJ3jfFCyMGqyMJKfB.Vk9kYxHyRHC', true, true, 'Logistics Test')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. STORES (all 23)
-- ============================================================================

-- #1 Commerce
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000001',
  'Urban Style Boutique', 'urban-style-boutique', 'ecommerce',
  'Online clothing & accessories shop specializing in Mongolian-made fashion. We carry cashmere, leather goods, streetwear and accessories.',
  '77110001', 'Sukhbaatar District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Urban Style Boutique! Ask about our products, sizing, delivery, or returns.","away_message":"We are currently closed. Hours: Mon-Sat 10:00-20:00.","quick_replies":["Browse products","Check order status","Delivery info","Return policy"],"tone":"friendly","language":"english","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"manager,human,operator,complaint","accent_color":"#3b82f6","return_policy":"14-day return policy. Items must be unworn with tags attached. Free returns for defective items. Refund processed within 5 business days.","business_hours":"Mon-Sat 10:00-20:00, Sun closed","delivery_info":"Free delivery for orders over 50,000 MNT. Standard delivery 3-5 business days (5,000 MNT). Express delivery next day (15,000 MNT).","faq":[{"q":"Do you ship nationwide?","a":"Yes, we deliver to all 21 provinces. Delivery time is 5-10 days outside UB."},{"q":"What sizes do you carry?","a":"We carry XS to XXL. Check each product for specific sizing charts."},{"q":"Can I exchange an item?","a":"Yes, exchanges within 14 days. Item must be in original condition."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #2 Laundry
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000102', '00000000-0000-4000-a000-000000000002',
  'Premium Dry Cleaners', 'premium-dry-cleaners', 'laundry',
  'Professional dry cleaning and laundry service. Suits, dresses, leather, cashmere care. Pickup and delivery available.',
  '77110002', 'Bayangol District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Premium Dry Cleaners! Ask about our services, pricing, or order status.","away_message":"Closed now. Hours: Mon-Sat 08:00-19:00.","quick_replies":["Service prices","Track my order","Pickup/delivery","Rush orders"],"tone":"professional","language":"english","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"manager,human,complaint","accent_color":"#06b6d4","return_policy":"We guarantee quality. If unsatisfied, free re-cleaning within 48 hours.","business_hours":"Mon-Sat 08:00-19:00","faq":[{"q":"How long does dry cleaning take?","a":"Standard 2-3 business days. Rush service available for next-day at 50% surcharge."},{"q":"Do you clean leather/suede?","a":"Yes, we specialize in leather and suede cleaning. Prices start at 25,000 MNT."},{"q":"Do you offer pickup?","a":"Yes, free pickup and delivery for orders over 30,000 MNT within UB."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #3 Beauty
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000103', '00000000-0000-4000-a000-000000000003',
  'Glamour Beauty Salon', 'glamour-beauty-salon', 'beauty_salon',
  'Full-service beauty salon: haircuts, coloring, manicure, pedicure, facial treatments, and massage.',
  '77110003', 'Chingeltei District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Glamour Beauty Salon! Book appointments, check services, or ask about our packages.","away_message":"Closed now. Hours: Mon-Sun 10:00-20:00.","quick_replies":["Book appointment","Services & prices","Our packages","Available times"],"tone":"friendly","language":"english","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"manager,human,complaint","accent_color":"#ec4899","business_hours":"Mon-Sun 10:00-20:00","faq":[{"q":"Do I need to book in advance?","a":"Walk-ins welcome but we recommend booking 1 day ahead for popular times."},{"q":"Do you do bridal makeup?","a":"Yes! Bridal packages start at 150,000 MNT including trial."},{"q":"What hair products do you use?","a":"We use L''Oreal Professional and Kerastase products."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #4 Pet Services
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000104', '00000000-0000-4000-a000-000000000004',
  'Happy Paws Pet Center', 'happy-paws-pet', 'pet_services',
  'Pet grooming, boarding, daycare and veterinary referrals. Dogs, cats, and small animals welcome.',
  '77110004', 'Khan-Uul District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Happy Paws! Ask about grooming, boarding, daycare, or book an appointment.","away_message":"Closed now. Hours: Mon-Sat 09:00-18:00.","quick_replies":["Grooming prices","Book boarding","Daycare info","Vaccination requirements"],"tone":"friendly","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,vet,complaint","accent_color":"#f97316","business_hours":"Mon-Sat 09:00-18:00","faq":[{"q":"What vaccinations are required?","a":"All pets must have current rabies and distemper vaccinations for boarding."},{"q":"How long is a grooming session?","a":"Small dogs 1-1.5 hours, large dogs 2-3 hours depending on breed and coat."},{"q":"Do you accept cats?","a":"Yes! We have separate cat grooming and boarding areas."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #5 Car Wash
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000105', '00000000-0000-4000-a000-000000000005',
  'Shine Auto Spa', 'shine-auto-spa', 'car_wash',
  'Professional car wash and detailing. Exterior wash, interior cleaning, ceramic coating, paint protection.',
  '77110005', 'Bayanzurkh District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Shine Auto Spa! Ask about our wash packages, detailing, or book a slot.","away_message":"Closed now. Hours: Mon-Sun 08:00-20:00.","quick_replies":["Wash packages","Detailing services","Book a slot","Membership"],"tone":"friendly","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint","accent_color":"#0ea5e9","business_hours":"Mon-Sun 08:00-20:00","faq":[{"q":"How long does a full wash take?","a":"Basic wash 30 min, full detail 2-3 hours."},{"q":"Do you do ceramic coating?","a":"Yes, ceramic coating packages from 250,000 MNT with 2-year warranty."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #6 Wellness
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000106', '00000000-0000-4000-a000-000000000006',
  'Zen Wellness Studio', 'zen-wellness-studio', 'wellness',
  'Yoga, pilates, personal training, meditation, and holistic wellness services.',
  '77110006', 'Sukhbaatar District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Zen Wellness! Ask about classes, memberships, or book a session.","away_message":"Closed now. Hours: Mon-Sat 07:00-21:00.","quick_replies":["Class schedule","Memberships","Personal training","Book session"],"tone":"calm","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint","accent_color":"#8b5cf6","business_hours":"Mon-Sat 07:00-21:00","faq":[{"q":"Do you offer trial classes?","a":"Yes, first class is free for new members!"},{"q":"What types of yoga?","a":"We offer Hatha, Vinyasa, Yin, and Prenatal yoga classes."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #7 Retail
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000107', '00000000-0000-4000-a000-000000000007',
  'Urban Mart', 'urban-mart', 'retail',
  'General retail store with POS. Electronics, household goods, stationery, and daily essentials.',
  '77110007', 'Bayangol District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Urban Mart! Ask about products, availability, or store info.","away_message":"Closed now. Hours: Mon-Sun 09:00-21:00.","quick_replies":["Product search","Store hours","Delivery","Loyalty program"],"tone":"friendly","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint","accent_color":"#10b981","business_hours":"Mon-Sun 09:00-21:00","faq":[{"q":"Do you have a loyalty program?","a":"Yes! Earn 1 point per 1,000 MNT spent. 100 points = 5,000 MNT discount."},{"q":"Do you deliver?","a":"Yes, same-day delivery within UB for orders over 20,000 MNT."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #8 Photography
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000108', '00000000-0000-4000-a000-000000000008',
  'Moments Photography Studio', 'moments-photography', 'photography',
  'Professional photography: portraits, weddings, events, product photography, and video production.',
  '77110008', 'Sukhbaatar District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Moments Photography! Ask about sessions, packages, or book a shoot.","away_message":"Closed now. Hours: Mon-Sat 10:00-19:00.","quick_replies":["Photo packages","Book a session","Wedding photography","Portfolio"],"tone":"creative","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint","accent_color":"#f59e0b","business_hours":"Mon-Sat 10:00-19:00","faq":[{"q":"How long before I get my photos?","a":"Standard turnaround is 7-10 business days. Rush processing available."},{"q":"Do you travel for shoots?","a":"Yes, we travel nationwide. Travel fees apply outside UB."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #9 Venue
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000109', '00000000-0000-4000-a000-000000000009',
  'Grand Hall Events', 'grand-hall-events', 'venue',
  'Event space rental for weddings, corporate events, conferences, and private parties. Multiple halls available.',
  '77110009', 'Chingeltei District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Grand Hall Events! Ask about venue availability, packages, or get a quote.","away_message":"Closed now. Hours: Mon-Fri 09:00-18:00.","quick_replies":["Available dates","Venue packages","Capacity info","Get a quote"],"tone":"professional","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint","accent_color":"#a855f7","business_hours":"Mon-Fri 09:00-18:00, Events: any day","faq":[{"q":"What is the maximum capacity?","a":"Grand Ballroom: 300 guests. Garden Hall: 150 guests. VIP Room: 50 guests."},{"q":"Is catering included?","a":"We offer catering add-ons starting at 25,000 MNT per guest."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #10 Coworking
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000110', '00000000-0000-4000-a000-000000000010',
  'WorkHub Coworking', 'workhub-coworking', 'coworking',
  'Shared office space with hot desks, dedicated desks, private offices, and meeting rooms.',
  '77110010', 'Sukhbaatar District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to WorkHub! Ask about desk availability, memberships, or meeting rooms.","away_message":"Building open 24/7 for members. Office hours: Mon-Fri 09:00-18:00.","quick_replies":["Desk pricing","Meeting rooms","Day pass","Membership plans"],"tone":"professional","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint","accent_color":"#6366f1","business_hours":"Mon-Fri 09:00-18:00, 24/7 member access","faq":[{"q":"Is there a day pass?","a":"Yes, day pass is 25,000 MNT including WiFi, coffee, and printing."},{"q":"Do you have meeting rooms?","a":"Yes, 3 meeting rooms seating 4-12 people. Bookable by the hour."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #11 Legal
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000111', '00000000-0000-4000-a000-000000000011',
  'Bataar & Associates Law Firm', 'bataar-law-firm', 'legal',
  'Full-service law firm: corporate law, real estate, family law, immigration, and criminal defense.',
  '77110011', 'Sukhbaatar District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Bataar & Associates. Ask about our practice areas, schedule a consultation, or check case status.","away_message":"Office closed. Hours: Mon-Fri 09:00-18:00. For emergencies call 77110011.","quick_replies":["Practice areas","Book consultation","Case status","Legal fees"],"tone":"professional","language":"english","show_product_prices":false,"auto_handoff":true,"handoff_keywords":"lawyer,attorney,urgent,complaint","accent_color":"#1e3a5f","business_hours":"Mon-Fri 09:00-18:00","faq":[{"q":"How much is a consultation?","a":"Initial 30-minute consultation is 50,000 MNT. Free for returning clients."},{"q":"What areas of law do you practice?","a":"Corporate, real estate, family, immigration, criminal defense, and tax law."},{"q":"Do you handle international cases?","a":"Yes, we work with partner firms in China, Korea, and Japan."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #12 Construction
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000112', '00000000-0000-4000-a000-000000000012',
  'BuildRight Construction', 'buildright-construction', 'construction',
  'Construction and contracting: residential, commercial, renovations, and project management.',
  '77110012', 'Bayanzurkh District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to BuildRight! Ask about our construction services, get a project estimate, or check project status.","away_message":"Office closed. Hours: Mon-Fri 09:00-18:00.","quick_replies":["Our services","Get estimate","Project status","Contact us"],"tone":"professional","language":"english","show_product_prices":false,"auto_handoff":true,"handoff_keywords":"manager,engineer,complaint","accent_color":"#ea580c","business_hours":"Mon-Fri 09:00-18:00","faq":[{"q":"What types of projects do you handle?","a":"Residential homes, apartments, commercial buildings, renovations, and interior design."},{"q":"How long does a typical home build take?","a":"3-6 months depending on size and complexity. We provide detailed timelines."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #13 Subscription
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000113', '00000000-0000-4000-a000-000000000013',
  'MN Box Monthly', 'mn-box-monthly', 'subscription',
  'Monthly subscription boxes: snack box, beauty box, book box, and wellness box delivered to your door.',
  '77110013', 'Bayangol District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to MN Box Monthly! Ask about our subscription plans, manage your box, or gift a subscription.","away_message":"We reply within 24 hours. Check your account at mnbox.mn.","quick_replies":["Subscription plans","Manage my box","Gift a box","Delivery schedule"],"tone":"friendly","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint,cancel","accent_color":"#e11d48","business_hours":"Mon-Fri 10:00-18:00","faq":[{"q":"When do boxes ship?","a":"Boxes ship on the 1st of each month. Delivery within 3-5 days."},{"q":"Can I skip a month?","a":"Yes, you can pause or skip anytime from your account. No penalty."},{"q":"What is in the snack box?","a":"8-10 curated Mongolian snacks and treats. Different theme each month."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #14 Coffee Shop
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000114', '00000000-0000-4000-a000-000000000014',
  'Nomad Coffee Co.', 'nomad-coffee-co', 'coffee_shop',
  'Specialty coffee shop and bakery. Single-origin beans, fresh pastries, and light meals.',
  '77110014', 'Sukhbaatar District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Nomad Coffee! Check our menu, order ahead, or ask about our beans.","away_message":"Closed now. Hours: Mon-Sun 07:30-21:00.","quick_replies":["Full menu","Order ahead","Today''s special","WiFi password"],"tone":"casual","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint","accent_color":"#92400e","business_hours":"Mon-Sun 07:30-21:00","faq":[{"q":"Do you have WiFi?","a":"Yes! Free WiFi for all customers. Password: nomadcoffee2024"},{"q":"Do you sell beans?","a":"Yes, we sell our house-roasted beans: 250g for 18,000 MNT, 500g for 32,000 MNT."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #15 Restaurant
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000115', '00000000-0000-4000-a000-000000000015',
  'Silk Road Restaurant', 'silk-road-restaurant', 'restaurant',
  'Full-service restaurant featuring Mongolian and Central Asian cuisine. Dine-in, takeout, and catering.',
  '77110015', 'Chingeltei District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Silk Road Restaurant! View our menu, reserve a table, or order for delivery.","away_message":"Closed now. Hours: Mon-Sun 11:00-22:00.","quick_replies":["View menu","Reserve table","Order delivery","Today''s special"],"tone":"friendly","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint,waiter","accent_color":"#ef4444","business_hours":"Mon-Sun 11:00-22:00","faq":[{"q":"Do you take reservations?","a":"Yes! Reserve online or call. We recommend booking for groups of 4+."},{"q":"Do you cater events?","a":"Yes, catering for 20-200 guests. Contact us for custom menus."},{"q":"Is there parking?","a":"Yes, free parking lot behind the restaurant for 30 cars."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #16 Hotel
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000116', '00000000-0000-4000-a000-000000000016',
  'Steppe Inn Hotel', 'steppe-inn-hotel', 'hotel',
  'Boutique hotel in central Ulaanbaatar. Standard, Deluxe, and Suite rooms. Restaurant, spa, and conference facilities.',
  '77110016', 'Sukhbaatar District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Steppe Inn Hotel! Book a room, check availability, or ask about amenities.","away_message":"Front desk available 24/7 at 77110016.","quick_replies":["Room availability","Book a room","Amenities","Restaurant"],"tone":"professional","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint,concierge","accent_color":"#b45309","business_hours":"24/7 front desk","faq":[{"q":"What time is check-in/check-out?","a":"Check-in: 14:00, Check-out: 12:00. Early check-in and late check-out available on request."},{"q":"Is breakfast included?","a":"Yes, buffet breakfast included for all room types. 07:00-10:00."},{"q":"Do you have airport transfer?","a":"Yes, airport pickup/drop-off for 40,000 MNT per trip."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #17 Education
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000117', '00000000-0000-4000-a000-000000000017',
  'Smart Learning Center', 'smart-learning-center', 'education',
  'Educational center: English, Chinese, Korean language courses, IELTS prep, coding bootcamps, and math tutoring.',
  '77110017', 'Bayangol District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Smart Learning Center! Ask about courses, enrollment, or schedules.","away_message":"Closed now. Hours: Mon-Sat 09:00-20:00.","quick_replies":["Course list","Enroll now","Schedule","Pricing"],"tone":"professional","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,teacher,complaint","accent_color":"#f59e0b","business_hours":"Mon-Sat 09:00-20:00","faq":[{"q":"Can I get a refund?","a":"Full refund if cancelled 3+ days before course starts. No refunds after."},{"q":"Do you offer online classes?","a":"Yes, most courses available both in-person and online via Zoom."},{"q":"What level am I?","a":"We offer free placement tests for all language courses."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #18 Sports/Gym
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000118', '00000000-0000-4000-a000-000000000018',
  'Active Life Sports Complex', 'active-life-sports', 'gym',
  'Multi-sport facility: gym, swimming pool, basketball court, boxing, fitness classes, and personal training.',
  '77110018', 'Khan-Uul District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Active Life! Ask about memberships, class schedule, or facility info.","away_message":"Closed now. Hours: Mon-Sun 06:00-22:00.","quick_replies":["Membership plans","Class schedule","Facility info","Personal training"],"tone":"energetic","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,trainer,complaint","accent_color":"#16a34a","business_hours":"Mon-Sun 06:00-22:00","faq":[{"q":"Is there a trial period?","a":"Yes, 3-day free trial pass for first-time visitors."},{"q":"Do you have a pool?","a":"Yes, 25m indoor pool open 06:00-21:00. Included in full membership."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #19 Medical
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000119', '00000000-0000-4000-a000-000000000019',
  'HealthFirst Clinic', 'healthfirst-clinic', 'hospital',
  'Multi-specialty medical clinic: general practice, internal medicine, pediatrics, laboratory, and ultrasound.',
  '77110019', 'Bayanzurkh District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to HealthFirst Clinic. Book appointments, check lab results, or ask about our services.","away_message":"For emergencies call 107. Office hours: Mon-Fri 08:00-18:00, Sat 09:00-14:00.","quick_replies":["Book appointment","Our departments","Lab results","Insurance info"],"tone":"professional","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"doctor,nurse,emergency,complaint","accent_color":"#0891b2","business_hours":"Mon-Fri 08:00-18:00, Sat 09:00-14:00","faq":[{"q":"Do you accept insurance?","a":"Yes, we accept most major insurance providers including Mongol Daatgal and Ard Daatgal."},{"q":"How do I get lab results?","a":"Results available within 24 hours. Check online or pick up at reception."},{"q":"Do you do vaccinations?","a":"Yes, standard vaccinations and flu shots available. Call to schedule."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #20 Consulting
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000120', '00000000-0000-4000-a000-000000000020',
  'Elite Consulting Group', 'elite-consulting', 'consulting',
  'Professional consulting: business strategy, financial advisory, marketing, IT consulting, and HR solutions.',
  '77110020', 'Sukhbaatar District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Elite Consulting Group. Ask about our services, book a consultation, or learn about our approach.","away_message":"Office closed. Hours: Mon-Fri 09:00-18:00.","quick_replies":["Our services","Book consultation","Case studies","Pricing"],"tone":"professional","language":"english","show_product_prices":false,"auto_handoff":true,"handoff_keywords":"partner,consultant,complaint","accent_color":"#0f172a","business_hours":"Mon-Fri 09:00-18:00","faq":[{"q":"What industries do you serve?","a":"Mining, banking, retail, technology, and government sectors."},{"q":"How much is an initial consultation?","a":"Free 30-minute discovery call. Project-based pricing from there."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #21 Repair Shop
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000121', '00000000-0000-4000-a000-000000000021',
  'QuickFix Auto Repair', 'quickfix-auto-repair', 'repair_shop',
  'Auto repair and maintenance: oil change, brakes, engine diagnostics, tire service, and body work.',
  '77110021', 'Songinokhairkhan District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to QuickFix Auto Repair! Ask about services, get an estimate, or check repair status.","away_message":"Closed now. Hours: Mon-Sat 08:00-18:00.","quick_replies":["Service list","Get estimate","Repair status","Appointment"],"tone":"friendly","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,mechanic,complaint","accent_color":"#dc2626","business_hours":"Mon-Sat 08:00-18:00","faq":[{"q":"Do you work on all car brands?","a":"Yes, we service all major brands: Toyota, Hyundai, Kia, BMW, Mercedes, etc."},{"q":"How long is an oil change?","a":"30-45 minutes. No appointment needed for basic oil changes."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #22 Home Services
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000122', '00000000-0000-4000-a000-000000000022',
  'Sparkle Home Services', 'sparkle-home-services', 'home_services',
  'Home cleaning, deep cleaning, move-in/out cleaning, carpet cleaning, and handyman services.',
  '77110022', 'Bayangol District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Sparkle Home Services! Book a cleaning, get a quote, or check your appointment.","away_message":"Closed now. Hours: Mon-Sat 08:00-18:00. Book online 24/7.","quick_replies":["Book cleaning","Service prices","Service areas","My appointments"],"tone":"friendly","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,complaint","accent_color":"#059669","business_hours":"Mon-Sat 08:00-18:00","faq":[{"q":"What areas do you serve?","a":"All districts within Ulaanbaatar city limits."},{"q":"Do you bring your own supplies?","a":"Yes, we bring all cleaning supplies and equipment. Eco-friendly products available."}]}'
) ON CONFLICT (id) DO NOTHING;

-- #23 Logistics
INSERT INTO stores (id, owner_id, name, slug, business_type, description, phone, address, ai_auto_reply, chatbot_settings)
VALUES ('00000000-0000-4000-a000-000000000123', '00000000-0000-4000-a000-000000000023',
  'Swift Delivery Service', 'swift-delivery', 'logistics',
  'Courier and delivery service: same-day, next-day, and scheduled deliveries within UB and nationwide.',
  '77110023', 'Bayanzurkh District, Ulaanbaatar', true,
  '{"welcome_message":"Welcome to Swift Delivery! Track a package, get delivery rates, or schedule a pickup.","away_message":"Dispatching hours: 08:00-20:00. Track packages 24/7 online.","quick_replies":["Track package","Delivery rates","Schedule pickup","Service areas"],"tone":"efficient","language":"english","show_product_prices":true,"auto_handoff":true,"handoff_keywords":"manager,dispatcher,complaint","accent_color":"#2563eb","business_hours":"Mon-Sun 08:00-20:00","faq":[{"q":"How fast is same-day delivery?","a":"Within UB: 2-4 hours. Must order before 16:00."},{"q":"Do you deliver outside UB?","a":"Yes, nationwide delivery to all provinces. 2-5 business days."}]}'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. STORE MEMBERS (owner role)
-- ============================================================================

INSERT INTO store_members (store_id, user_id, role) VALUES
  ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000001', 'owner'),
  ('00000000-0000-4000-a000-000000000102', '00000000-0000-4000-a000-000000000002', 'owner'),
  ('00000000-0000-4000-a000-000000000103', '00000000-0000-4000-a000-000000000003', 'owner'),
  ('00000000-0000-4000-a000-000000000104', '00000000-0000-4000-a000-000000000004', 'owner'),
  ('00000000-0000-4000-a000-000000000105', '00000000-0000-4000-a000-000000000005', 'owner'),
  ('00000000-0000-4000-a000-000000000106', '00000000-0000-4000-a000-000000000006', 'owner'),
  ('00000000-0000-4000-a000-000000000107', '00000000-0000-4000-a000-000000000007', 'owner'),
  ('00000000-0000-4000-a000-000000000108', '00000000-0000-4000-a000-000000000008', 'owner'),
  ('00000000-0000-4000-a000-000000000109', '00000000-0000-4000-a000-000000000009', 'owner'),
  ('00000000-0000-4000-a000-000000000110', '00000000-0000-4000-a000-000000000010', 'owner'),
  ('00000000-0000-4000-a000-000000000111', '00000000-0000-4000-a000-000000000011', 'owner'),
  ('00000000-0000-4000-a000-000000000112', '00000000-0000-4000-a000-000000000012', 'owner'),
  ('00000000-0000-4000-a000-000000000113', '00000000-0000-4000-a000-000000000013', 'owner'),
  ('00000000-0000-4000-a000-000000000114', '00000000-0000-4000-a000-000000000014', 'owner'),
  ('00000000-0000-4000-a000-000000000115', '00000000-0000-4000-a000-000000000015', 'owner'),
  ('00000000-0000-4000-a000-000000000116', '00000000-0000-4000-a000-000000000016', 'owner'),
  ('00000000-0000-4000-a000-000000000117', '00000000-0000-4000-a000-000000000017', 'owner'),
  ('00000000-0000-4000-a000-000000000118', '00000000-0000-4000-a000-000000000018', 'owner'),
  ('00000000-0000-4000-a000-000000000119', '00000000-0000-4000-a000-000000000019', 'owner'),
  ('00000000-0000-4000-a000-000000000120', '00000000-0000-4000-a000-000000000020', 'owner'),
  ('00000000-0000-4000-a000-000000000121', '00000000-0000-4000-a000-000000000021', 'owner'),
  ('00000000-0000-4000-a000-000000000122', '00000000-0000-4000-a000-000000000022', 'owner'),
  ('00000000-0000-4000-a000-000000000123', '00000000-0000-4000-a000-000000000023', 'owner')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. STAFF MEMBERS (2-4 per store)
-- ============================================================================

-- #1 Commerce staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000101', 'Batbold Dorj', '99110001', 'batbold@urbanstyle.mn', ARRAY['manager','sales'], 'active'),
  ('00000000-0000-4000-a000-000000000202', '00000000-0000-4000-a000-000000000101', 'Sarnai Enkhtur', '99110002', 'sarnai@urbanstyle.mn', ARRAY['fulfillment','customer service'], 'active'),
  ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000101', 'Munkh-Erdene Bat', '99110003', 'munkh@urbanstyle.mn', ARRAY['warehouse','shipping'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #2 Laundry staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000102', 'Ganbaatar Tsedev', '99110004', 'ganbaatar@premiumdc.mn', ARRAY['manager','pressing'], 'active'),
  ('00000000-0000-4000-a000-000000000205', '00000000-0000-4000-a000-000000000102', 'Oyunbileg Namsrai', '99110005', 'oyunbileg@premiumdc.mn', ARRAY['dry cleaning','stain removal'], 'active'),
  ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000102', 'Tsolmon Byamba', '99110006', 'tsolmon@premiumdc.mn', ARRAY['washing','ironing'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #3 Beauty staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000207', '00000000-0000-4000-a000-000000000103', 'Anujin Bat', '99110007', 'anujin@glamour.mn', ARRAY['hair stylist','coloring'], 'active'),
  ('00000000-0000-4000-a000-000000000208', '00000000-0000-4000-a000-000000000103', 'Selenge Davaajav', '99110008', 'selenge@glamour.mn', ARRAY['manicure','pedicure','facial'], 'active'),
  ('00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000103', 'Nandin Boldbaatar', '99110009', 'nandin@glamour.mn', ARRAY['massage','body treatment'], 'active'),
  ('00000000-0000-4000-a000-000000000210', '00000000-0000-4000-a000-000000000103', 'Uyanga Gansukh', '99110010', 'uyanga@glamour.mn', ARRAY['makeup','bridal'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #4 Pet staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000211', '00000000-0000-4000-a000-000000000104', 'Munkhbat Dash', '99110011', 'munkhbat@happypaws.mn', ARRAY['grooming','manager'], 'active'),
  ('00000000-0000-4000-a000-000000000212', '00000000-0000-4000-a000-000000000104', 'Solongo Tsend', '99110012', 'solongo@happypaws.mn', ARRAY['boarding','daycare'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #5 Car Wash staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000213', '00000000-0000-4000-a000-000000000105', 'Erdene Bolor', '99110013', 'erdene@shineauto.mn', ARRAY['manager','detailing'], 'active'),
  ('00000000-0000-4000-a000-000000000214', '00000000-0000-4000-a000-000000000105', 'Temuulen Bold', '99110014', 'temuulen@shineauto.mn', ARRAY['wash','interior'], 'active'),
  ('00000000-0000-4000-a000-000000000215', '00000000-0000-4000-a000-000000000105', 'Dulguun Ganbat', '99110015', 'dulguun@shineauto.mn', ARRAY['ceramic coating','polish'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #6 Wellness staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000216', '00000000-0000-4000-a000-000000000106', 'Sarangerel Nyam', '99110016', 'sarangerel@zen.mn', ARRAY['yoga','meditation'], 'active'),
  ('00000000-0000-4000-a000-000000000217', '00000000-0000-4000-a000-000000000106', 'Enkhzul Bold', '99110017', 'enkhzul@zen.mn', ARRAY['pilates','personal training'], 'active'),
  ('00000000-0000-4000-a000-000000000218', '00000000-0000-4000-a000-000000000106', 'Tuvshin Dorj', '99110018', 'tuvshin@zen.mn', ARRAY['massage','acupuncture'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #7 Retail staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000219', '00000000-0000-4000-a000-000000000107', 'Bayarmaa Ganbold', '99110019', 'bayarmaa@urbanmart.mn', ARRAY['manager','cashier'], 'active'),
  ('00000000-0000-4000-a000-000000000220', '00000000-0000-4000-a000-000000000107', 'Otgonbayar Sukhee', '99110020', 'otgonbayar@urbanmart.mn', ARRAY['inventory','warehouse'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #8 Photography staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000221', '00000000-0000-4000-a000-000000000108', 'Ganzorig Bat', '99110021', 'ganzorig@moments.mn', ARRAY['portrait','wedding'], 'active'),
  ('00000000-0000-4000-a000-000000000222', '00000000-0000-4000-a000-000000000108', 'Zolzaya Enkhbold', '99110022', 'zolzaya@moments.mn', ARRAY['event','product photography'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #9 Venue staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000223', '00000000-0000-4000-a000-000000000109', 'Purevdorj Nyam', '99110023', 'purevdorj@grandhall.mn', ARRAY['event coordinator','manager'], 'active'),
  ('00000000-0000-4000-a000-000000000224', '00000000-0000-4000-a000-000000000109', 'Odval Tsend', '99110024', 'odval@grandhall.mn', ARRAY['catering','logistics'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #10 Coworking staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000225', '00000000-0000-4000-a000-000000000110', 'Naranbaatar Sukh', '99110025', 'naranbaatar@workhub.mn', ARRAY['community manager'], 'active'),
  ('00000000-0000-4000-a000-000000000226', '00000000-0000-4000-a000-000000000110', 'Altantsetseg Damba', '99110026', 'altantsetseg@workhub.mn', ARRAY['front desk','events'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #11 Legal staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000227', '00000000-0000-4000-a000-000000000111', 'Bataar Enkhbold', '99110027', 'bataar@bataarlegal.mn', ARRAY['corporate','real estate'], 'active'),
  ('00000000-0000-4000-a000-000000000228', '00000000-0000-4000-a000-000000000111', 'Oyungerel Tseden', '99110028', 'oyungerel@bataarlegal.mn', ARRAY['family law','immigration'], 'active'),
  ('00000000-0000-4000-a000-000000000229', '00000000-0000-4000-a000-000000000111', 'Enkhbayar Dorj', '99110029', 'enkhbayar@bataarlegal.mn', ARRAY['criminal defense','labor'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #12 Construction staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000230', '00000000-0000-4000-a000-000000000112', 'Bayanmunkh Dash', '99110030', 'bayanmunkh@buildright.mn', ARRAY['project manager','engineer'], 'active'),
  ('00000000-0000-4000-a000-000000000231', '00000000-0000-4000-a000-000000000112', 'Tsogbadrakh Bold', '99110031', 'tsogbadrakh@buildright.mn', ARRAY['foreman','safety'], 'active'),
  ('00000000-0000-4000-a000-000000000232', '00000000-0000-4000-a000-000000000112', 'Khishigdalai Bat', '99110032', 'khishigdalai@buildright.mn', ARRAY['architect','design'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #13 Subscription staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000233', '00000000-0000-4000-a000-000000000113', 'Munkhjargal Nyam', '99110033', 'munkhjargal@mnbox.mn', ARRAY['manager','curation'], 'active'),
  ('00000000-0000-4000-a000-000000000234', '00000000-0000-4000-a000-000000000113', 'Enkhmaa Bold', '99110034', 'enkhmaa@mnbox.mn', ARRAY['fulfillment','customer service'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #14 Coffee Shop staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000235', '00000000-0000-4000-a000-000000000114', 'Temuulen Ganbat', '99110035', 'temuulen@nomadcoffee.mn', ARRAY['barista','roasting'], 'active'),
  ('00000000-0000-4000-a000-000000000236', '00000000-0000-4000-a000-000000000114', 'Nomin Erdene', '99110036', 'nomin@nomadcoffee.mn', ARRAY['barista','pastry'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #15 Restaurant staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000237', '00000000-0000-4000-a000-000000000115', 'Batbayar Gansukh', '99110037', 'batbayar@silkroad.mn', ARRAY['head chef','mongolian cuisine'], 'active'),
  ('00000000-0000-4000-a000-000000000238', '00000000-0000-4000-a000-000000000115', 'Oyuntsetseg Bold', '99110038', 'oyuntsetseg@silkroad.mn', ARRAY['sous chef','central asian'], 'active'),
  ('00000000-0000-4000-a000-000000000239', '00000000-0000-4000-a000-000000000115', 'Enkhtuya Dorj', '99110039', 'enkhtuya@silkroad.mn', ARRAY['front of house','manager'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #16 Hotel staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000240', '00000000-0000-4000-a000-000000000116', 'Boldbaatar Nyam', '99110040', 'boldbaatar@steppeinn.mn', ARRAY['front desk','concierge'], 'active'),
  ('00000000-0000-4000-a000-000000000241', '00000000-0000-4000-a000-000000000116', 'Tsetsegmaa Bat', '99110041', 'tsetsegmaa@steppeinn.mn', ARRAY['housekeeping','manager'], 'active'),
  ('00000000-0000-4000-a000-000000000242', '00000000-0000-4000-a000-000000000116', 'Munkh Erdene', '99110042', 'munkh@steppeinn.mn', ARRAY['maintenance','engineering'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #17 Education staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000243', '00000000-0000-4000-a000-000000000117', 'Munkhjin Bold', '99110043', 'munkhjin@smartlearn.mn', ARRAY['English','IELTS'], 'active'),
  ('00000000-0000-4000-a000-000000000244', '00000000-0000-4000-a000-000000000117', 'Ariunbold Dorj', '99110044', 'ariunbold@smartlearn.mn', ARRAY['Python','JavaScript'], 'active'),
  ('00000000-0000-4000-a000-000000000245', '00000000-0000-4000-a000-000000000117', 'Nergui Tsend', '99110045', 'nergui@smartlearn.mn', ARRAY['math','physics'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #18 Sports/Gym staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000246', '00000000-0000-4000-a000-000000000118', 'Tomor Ganbat', '99110046', 'tomor@activelife.mn', ARRAY['personal training','crossfit'], 'active'),
  ('00000000-0000-4000-a000-000000000247', '00000000-0000-4000-a000-000000000118', 'Solongo Bat', '99110047', 'solongo@activelife.mn', ARRAY['swimming','yoga'], 'active'),
  ('00000000-0000-4000-a000-000000000248', '00000000-0000-4000-a000-000000000118', 'Dulguun Enkhbold', '99110048', 'dulguun@activelife.mn', ARRAY['boxing','MMA'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #19 Medical staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000249', '00000000-0000-4000-a000-000000000119', 'Dr. Bolormaa Dorj', '99110049', 'bolormaa@healthfirst.mn', ARRAY['general practice','internal medicine'], 'active'),
  ('00000000-0000-4000-a000-000000000250', '00000000-0000-4000-a000-000000000119', 'Dr. Batsukh Erdene', '99110050', 'batsukh@healthfirst.mn', ARRAY['pediatrics','vaccination'], 'active'),
  ('00000000-0000-4000-a000-000000000251', '00000000-0000-4000-a000-000000000119', 'Sarantuya Nyam', '99110051', 'sarantuya@healthfirst.mn', ARRAY['laboratory','nurse'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #20 Consulting staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000252', '00000000-0000-4000-a000-000000000120', 'Enkhsaikhan Bat', '99110052', 'enkhsaikhan@elite.mn', ARRAY['strategy','finance'], 'active'),
  ('00000000-0000-4000-a000-000000000253', '00000000-0000-4000-a000-000000000120', 'Altangerel Bold', '99110053', 'altangerel@elite.mn', ARRAY['marketing','digital'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #21 Repair staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000254', '00000000-0000-4000-a000-000000000121', 'Ganbold Sukhee', '99110054', 'ganbold@quickfix.mn', ARRAY['engine','diagnostics'], 'active'),
  ('00000000-0000-4000-a000-000000000255', '00000000-0000-4000-a000-000000000121', 'Battulga Dorj', '99110055', 'battulga@quickfix.mn', ARRAY['brakes','suspension'], 'active'),
  ('00000000-0000-4000-a000-000000000256', '00000000-0000-4000-a000-000000000121', 'Munkhtur Bat', '99110056', 'munkhtur@quickfix.mn', ARRAY['body work','painting'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #22 Home Services staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000257', '00000000-0000-4000-a000-000000000122', 'Bayarjargal Nyam', '99110057', 'bayarjargal@sparkle.mn', ARRAY['cleaning','deep cleaning'], 'active'),
  ('00000000-0000-4000-a000-000000000258', '00000000-0000-4000-a000-000000000122', 'Narangerel Tsend', '99110058', 'narangerel@sparkle.mn', ARRAY['carpet cleaning','move-in/out'], 'active'),
  ('00000000-0000-4000-a000-000000000259', '00000000-0000-4000-a000-000000000122', 'Erdenebat Bold', '99110059', 'erdenebat@sparkle.mn', ARRAY['handyman','plumbing'], 'active')
ON CONFLICT (id) DO NOTHING;

-- #23 Logistics staff
INSERT INTO staff (id, store_id, name, phone, email, specialties, status) VALUES
  ('00000000-0000-4000-a000-000000000260', '00000000-0000-4000-a000-000000000123', 'Sukhbaatar Ganbat', '99110060', 'sukhbaatar@swift.mn', ARRAY['dispatcher','manager'], 'active'),
  ('00000000-0000-4000-a000-000000000261', '00000000-0000-4000-a000-000000000123', 'Baterdene Dorj', '99110061', 'baterdene@swift.mn', ARRAY['driver','courier'], 'active'),
  ('00000000-0000-4000-a000-000000000262', '00000000-0000-4000-a000-000000000123', 'Gankhuyag Bold', '99110062', 'gankhuyag@swift.mn', ARRAY['driver','long-haul'], 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. CUSTOMERS (2-3 per store)
-- ============================================================================

INSERT INTO customers (id, store_id, name, phone, email, channel) VALUES
  -- #1 Commerce
  ('00000000-0000-4000-a000-000000000401', '00000000-0000-4000-a000-000000000101', 'Enkhbayar Tsedev', '88110001', 'enkhbayar.t@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000402', '00000000-0000-4000-a000-000000000101', 'Munkhjin Bayar', '88110002', 'munkhjin.b@gmail.com', 'messenger'),
  ('00000000-0000-4000-a000-000000000403', '00000000-0000-4000-a000-000000000101', 'Tsetsgee Dorj', '88110003', 'tsetsgee.d@gmail.com', 'web'),
  -- #2 Laundry
  ('00000000-0000-4000-a000-000000000404', '00000000-0000-4000-a000-000000000102', 'Davaadorj Bat', '88110004', 'davaadorj@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000405', '00000000-0000-4000-a000-000000000102', 'Narantsetseg Bold', '88110005', 'narantsetseg@gmail.com', 'messenger'),
  -- #3 Beauty
  ('00000000-0000-4000-a000-000000000406', '00000000-0000-4000-a000-000000000103', 'Altanchimeg Nyam', '88110006', 'altanchimeg@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000407', '00000000-0000-4000-a000-000000000103', 'Tuya Erdene', '88110007', 'tuya.e@gmail.com', 'messenger'),
  ('00000000-0000-4000-a000-000000000408', '00000000-0000-4000-a000-000000000103', 'Zaya Bat', '88110008', 'zaya.b@gmail.com', 'web'),
  -- #4-#23 (2 customers each)
  ('00000000-0000-4000-a000-000000000409', '00000000-0000-4000-a000-000000000104', 'Bolormaa Gansukh', '88110009', 'bolormaa.g@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000410', '00000000-0000-4000-a000-000000000104', 'Amarjargal Tsend', '88110010', 'amarjargal@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000411', '00000000-0000-4000-a000-000000000105', 'Otgonbaatar Bold', '88110011', 'otgonbaatar@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000412', '00000000-0000-4000-a000-000000000105', 'Purev Dorj', '88110012', 'purev.d@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000413', '00000000-0000-4000-a000-000000000106', 'Suvdmaa Nyam', '88110013', 'suvdmaa@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000414', '00000000-0000-4000-a000-000000000106', 'Tselmeg Bold', '88110014', 'tselmeg@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000415', '00000000-0000-4000-a000-000000000107', 'Dorjsuren Ganbat', '88110015', 'dorjsuren@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000416', '00000000-0000-4000-a000-000000000107', 'Byambaa Tsend', '88110016', 'byambaa@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000417', '00000000-0000-4000-a000-000000000108', 'Uranchimeg Bold', '88110017', 'uranchimeg@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000418', '00000000-0000-4000-a000-000000000108', 'Batgerel Nyam', '88110018', 'batgerel@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000419', '00000000-0000-4000-a000-000000000109', 'Tsogzolmaa Dorj', '88110019', 'tsogzolmaa@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000420', '00000000-0000-4000-a000-000000000109', 'Munkhzul Erdene', '88110020', 'munkhzul@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000421', '00000000-0000-4000-a000-000000000110', 'Namsrai Ganbold', '88110021', 'namsrai@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000422', '00000000-0000-4000-a000-000000000110', 'Delgermaa Bat', '88110022', 'delgermaa@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000423', '00000000-0000-4000-a000-000000000111', 'Batjargal Sukh', '88110023', 'batjargal@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000424', '00000000-0000-4000-a000-000000000111', 'Enkhtuya Nyam', '88110024', 'enkhtuya.n@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000425', '00000000-0000-4000-a000-000000000112', 'Gankhuyag Tsend', '88110025', 'gankhuyag.t@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000426', '00000000-0000-4000-a000-000000000112', 'Dorjpurev Bold', '88110026', 'dorjpurev@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000427', '00000000-0000-4000-a000-000000000113', 'Erdenechimeg Bat', '88110027', 'erdenechimeg@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000428', '00000000-0000-4000-a000-000000000113', 'Bayartsengel Dorj', '88110028', 'bayartsengel@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000429', '00000000-0000-4000-a000-000000000114', 'Idertsetseg Nyam', '88110029', 'idertsetseg@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000430', '00000000-0000-4000-a000-000000000114', 'Undrakh Bold', '88110030', 'undrakh@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000431', '00000000-0000-4000-a000-000000000115', 'Gansukh Erdene', '88110031', 'gansukh@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000432', '00000000-0000-4000-a000-000000000115', 'Bayasgalan Bat', '88110032', 'bayasgalan@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000433', '00000000-0000-4000-a000-000000000116', 'Tsendmaa Ganbat', '88110033', 'tsendmaa@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000434', '00000000-0000-4000-a000-000000000116', 'Sukhbold Dorj', '88110034', 'sukhbold@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000435', '00000000-0000-4000-a000-000000000117', 'Oyunbold Tsend', '88110035', 'oyunbold@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000436', '00000000-0000-4000-a000-000000000117', 'Khishigbayar Bold', '88110036', 'khishigbayar@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000437', '00000000-0000-4000-a000-000000000118', 'Tuvshinjargal Nyam', '88110037', 'tuvshinjargal@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000438', '00000000-0000-4000-a000-000000000118', 'Gantulga Bat', '88110038', 'gantulga@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000439', '00000000-0000-4000-a000-000000000119', 'Demberel Dorj', '88110039', 'demberel@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000440', '00000000-0000-4000-a000-000000000119', 'Oyundelger Erdene', '88110040', 'oyundelger@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000441', '00000000-0000-4000-a000-000000000120', 'Narmandakh Bold', '88110041', 'narmandakh@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000442', '00000000-0000-4000-a000-000000000120', 'Enkhdalai Bat', '88110042', 'enkhdalai@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000443', '00000000-0000-4000-a000-000000000121', 'Batochir Ganbat', '88110043', 'batochir@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000444', '00000000-0000-4000-a000-000000000121', 'Jargalsaikhan Tsend', '88110044', 'jargalsaikhan@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000445', '00000000-0000-4000-a000-000000000122', 'Sarantsatsral Nyam', '88110045', 'sarantsatsral@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000446', '00000000-0000-4000-a000-000000000122', 'Munkhsaikhan Bold', '88110046', 'munkhsaikhan@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000447', '00000000-0000-4000-a000-000000000123', 'Boldkhuyag Dorj', '88110047', 'boldkhuyag@gmail.com', 'web'),
  ('00000000-0000-4000-a000-000000000448', '00000000-0000-4000-a000-000000000123', 'Amartuvshin Bat', '88110048', 'amartuvshin@gmail.com', 'web')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. PRODUCTS (for product-based businesses)
-- ============================================================================

-- #1 Commerce: products with variants
INSERT INTO products (id, store_id, name, description, category, base_price, status, has_variants, images, ai_context) VALUES
  ('00000000-0000-4000-a000-000000000301', '00000000-0000-4000-a000-000000000101', 'Cashmere Sweater', 'Premium Mongolian cashmere sweater', 'Clothing', 189000, 'active', true, '[]', 'Sizes S-XL. Colors: black, cream, gray.'),
  ('00000000-0000-4000-a000-000000000302', '00000000-0000-4000-a000-000000000101', 'Leather Crossbody Bag', 'Genuine leather handcrafted bag', 'Accessories', 120000, 'active', true, '[]', 'Colors: brown, black, burgundy.'),
  ('00000000-0000-4000-a000-000000000303', '00000000-0000-4000-a000-000000000101', 'Wool Scarf', 'Mongolian yak wool scarf', 'Accessories', 45000, 'active', false, '[]', NULL),
  ('00000000-0000-4000-a000-000000000304', '00000000-0000-4000-a000-000000000101', 'Streetwear T-Shirt', 'Cotton graphic tee with Mongolian motifs', 'Clothing', 35000, 'active', true, '[]', 'Sizes S-XXL.'),
  ('00000000-0000-4000-a000-000000000305', '00000000-0000-4000-a000-000000000101', 'Felt Slippers', 'Handmade Mongolian felt slippers', 'Footwear', 28000, 'active', true, '[]', 'Sizes 36-44.')
ON CONFLICT (id) DO NOTHING;

-- Commerce product variants
INSERT INTO product_variants (id, product_id, size, color, price, stock_quantity, sku) VALUES
  ('00000000-0000-4000-a000-000000000601', '00000000-0000-4000-a000-000000000301', 'S', 'Black', 189000, 15, 'CSW-S-BLK'),
  ('00000000-0000-4000-a000-000000000602', '00000000-0000-4000-a000-000000000301', 'M', 'Black', 189000, 20, 'CSW-M-BLK'),
  ('00000000-0000-4000-a000-000000000603', '00000000-0000-4000-a000-000000000301', 'L', 'Cream', 189000, 12, 'CSW-L-CRM'),
  ('00000000-0000-4000-a000-000000000604', '00000000-0000-4000-a000-000000000301', 'XL', 'Gray', 189000, 8, 'CSW-XL-GRY'),
  ('00000000-0000-4000-a000-000000000605', '00000000-0000-4000-a000-000000000302', NULL, 'Brown', 120000, 10, 'LCB-BRN'),
  ('00000000-0000-4000-a000-000000000606', '00000000-0000-4000-a000-000000000302', NULL, 'Black', 120000, 8, 'LCB-BLK'),
  ('00000000-0000-4000-a000-000000000607', '00000000-0000-4000-a000-000000000304', 'M', NULL, 35000, 25, 'TSH-M'),
  ('00000000-0000-4000-a000-000000000608', '00000000-0000-4000-a000-000000000304', 'L', NULL, 35000, 20, 'TSH-L')
ON CONFLICT (id) DO NOTHING;

-- #7 Retail: products
INSERT INTO products (id, store_id, name, description, category, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000306', '00000000-0000-4000-a000-000000000107', 'Wireless Mouse', 'Ergonomic wireless mouse', 'Electronics', 25000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000307', '00000000-0000-4000-a000-000000000107', 'Notebook Set (3-pack)', 'A5 lined notebooks', 'Stationery', 12000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000308', '00000000-0000-4000-a000-000000000107', 'USB-C Hub', '7-in-1 USB-C hub with HDMI', 'Electronics', 55000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000309', '00000000-0000-4000-a000-000000000107', 'LED Desk Lamp', 'Adjustable LED desk lamp', 'Home', 38000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000310', '00000000-0000-4000-a000-000000000107', 'Hand Sanitizer 500ml', 'Antibacterial hand sanitizer', 'Health', 8000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #13 Subscription: box products
INSERT INTO products (id, store_id, name, description, category, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000311', '00000000-0000-4000-a000-000000000113', 'Snack Box Monthly', '8-10 curated Mongolian snacks', 'Snack Box', 29000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000312', '00000000-0000-4000-a000-000000000113', 'Beauty Box Monthly', '5-6 skincare and beauty products', 'Beauty Box', 45000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000313', '00000000-0000-4000-a000-000000000113', 'Book Box Monthly', '2 curated books + bookmark + tea', 'Book Box', 35000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000314', '00000000-0000-4000-a000-000000000113', 'Wellness Box Monthly', 'Supplements, teas, and wellness items', 'Wellness Box', 39000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #14 Coffee Shop: menu products
INSERT INTO products (id, store_id, name, description, category, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000315', '00000000-0000-4000-a000-000000000114', 'Americano', 'Classic black coffee', 'Coffee', 6000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000316', '00000000-0000-4000-a000-000000000114', 'Latte', 'Espresso with steamed milk', 'Coffee', 7500, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000317', '00000000-0000-4000-a000-000000000114', 'Cappuccino', 'Espresso with milk foam', 'Coffee', 7000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000318', '00000000-0000-4000-a000-000000000114', 'Croissant', 'Freshly baked butter croissant', 'Pastry', 5000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000319', '00000000-0000-4000-a000-000000000114', 'Cheesecake Slice', 'New York style cheesecake', 'Pastry', 9000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #15 Restaurant: menu products
INSERT INTO products (id, store_id, name, description, category, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000320', '00000000-0000-4000-a000-000000000115', 'Buuz (8 pcs)', 'Traditional steamed dumplings', 'Main Course', 14000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000321', '00000000-0000-4000-a000-000000000115', 'Khuushuur (4 pcs)', 'Deep-fried meat pastries', 'Appetizer', 10000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000322', '00000000-0000-4000-a000-000000000115', 'Tsuivan', 'Stir-fried noodles with meat', 'Main Course', 16000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000323', '00000000-0000-4000-a000-000000000115', 'Lamb Kebab', 'Grilled lamb skewers', 'Main Course', 22000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000324', '00000000-0000-4000-a000-000000000115', 'Milk Tea', 'Traditional Mongolian milk tea', 'Beverage', 3000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. SERVICES (for service-based businesses)
-- ============================================================================

-- #2 Laundry: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000325', '00000000-0000-4000-a000-000000000102', 'Suit Dry Clean', 'Full suit dry cleaning', 'Dry Cleaning', 120, 18000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000326', '00000000-0000-4000-a000-000000000102', 'Dress Dry Clean', 'Dress dry cleaning', 'Dry Cleaning', 120, 15000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000327', '00000000-0000-4000-a000-000000000102', 'Shirt Launder & Press', 'Wash, starch, and press', 'Laundry', 60, 5000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000328', '00000000-0000-4000-a000-000000000102', 'Leather/Suede Cleaning', 'Specialty leather care', 'Specialty', 180, 25000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #3 Beauty: services with durations
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images, ai_context) VALUES
  ('00000000-0000-4000-a000-000000000329', '00000000-0000-4000-a000-000000000103', 'Women Haircut', 'Haircut and styling', 'Hair', 60, 25000, 'active', '[]', NULL),
  ('00000000-0000-4000-a000-000000000330', '00000000-0000-4000-a000-000000000103', 'Men Haircut', 'Classic men haircut', 'Hair', 30, 15000, 'active', '[]', NULL),
  ('00000000-0000-4000-a000-000000000331', '00000000-0000-4000-a000-000000000103', 'Hair Coloring', 'Full color treatment', 'Hair', 120, 60000, 'active', '[]', 'Short: 45,000. Medium: 60,000. Long: 80,000.'),
  ('00000000-0000-4000-a000-000000000332', '00000000-0000-4000-a000-000000000103', 'Gel Manicure', 'Gel polish manicure', 'Nails', 60, 25000, 'active', '[]', NULL),
  ('00000000-0000-4000-a000-000000000333', '00000000-0000-4000-a000-000000000103', 'Facial Treatment', 'Deep cleansing facial', 'Facial', 60, 35000, 'active', '[]', NULL),
  ('00000000-0000-4000-a000-000000000334', '00000000-0000-4000-a000-000000000103', 'Full Body Massage', 'Relaxing full body massage', 'Massage', 60, 45000, 'active', '[]', NULL)
ON CONFLICT (id) DO NOTHING;

-- #4 Pet: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000335', '00000000-0000-4000-a000-000000000104', 'Dog Grooming (Small)', 'Bath, haircut, nails for small dogs', 'Grooming', 90, 35000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000336', '00000000-0000-4000-a000-000000000104', 'Dog Grooming (Large)', 'Bath, haircut, nails for large dogs', 'Grooming', 150, 55000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000337', '00000000-0000-4000-a000-000000000104', 'Cat Grooming', 'Bath and grooming for cats', 'Grooming', 60, 30000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000338', '00000000-0000-4000-a000-000000000104', 'Pet Boarding (per day)', 'Overnight boarding with meals', 'Boarding', 1440, 25000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000339', '00000000-0000-4000-a000-000000000104', 'Daycare (full day)', 'Full day supervised daycare', 'Daycare', 480, 15000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #5 Car Wash: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000340', '00000000-0000-4000-a000-000000000105', 'Basic Exterior Wash', 'Exterior wash, rinse, dry', 'Wash', 30, 12000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000341', '00000000-0000-4000-a000-000000000105', 'Full Service Wash', 'Exterior + interior cleaning', 'Wash', 60, 25000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000342', '00000000-0000-4000-a000-000000000105', 'Premium Detail', 'Full detail: wash, clay, polish, wax', 'Detailing', 180, 80000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000343', '00000000-0000-4000-a000-000000000105', 'Ceramic Coating', '2-year ceramic coating protection', 'Detailing', 240, 250000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #6 Wellness: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000344', '00000000-0000-4000-a000-000000000106', 'Hatha Yoga Class', 'Group hatha yoga session', 'Yoga', 60, 15000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000345', '00000000-0000-4000-a000-000000000106', 'Pilates Class', 'Mat pilates group class', 'Pilates', 50, 15000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000346', '00000000-0000-4000-a000-000000000106', 'Personal Training', '1-on-1 personal training session', 'Training', 60, 40000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000347', '00000000-0000-4000-a000-000000000106', 'Thai Massage', 'Traditional Thai massage', 'Massage', 90, 55000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #8 Photography: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000348', '00000000-0000-4000-a000-000000000108', 'Portrait Session', '1-hour portrait shoot, 20 edited photos', 'Portrait', 60, 120000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000349', '00000000-0000-4000-a000-000000000108', 'Wedding Photography', 'Full day wedding coverage', 'Wedding', 480, 800000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000350', '00000000-0000-4000-a000-000000000108', 'Product Photography', '10 products, white background', 'Commercial', 120, 150000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #9 Venue: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000351', '00000000-0000-4000-a000-000000000109', 'Grand Ballroom Rental', 'Full day rental, 300 capacity', 'Venue', 480, 2000000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000352', '00000000-0000-4000-a000-000000000109', 'Garden Hall Rental', 'Half day rental, 150 capacity', 'Venue', 240, 800000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000353', '00000000-0000-4000-a000-000000000109', 'VIP Room', 'Private room, 50 capacity', 'Venue', 240, 400000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000354', '00000000-0000-4000-a000-000000000109', 'Catering Package', 'Per person catering add-on', 'Catering', 0, 25000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #10 Coworking: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000355', '00000000-0000-4000-a000-000000000110', 'Hot Desk Day Pass', 'Full day hot desk access', 'Desk', 480, 25000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000356', '00000000-0000-4000-a000-000000000110', 'Dedicated Desk Monthly', 'Reserved desk, monthly', 'Desk', 0, 350000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000357', '00000000-0000-4000-a000-000000000110', 'Meeting Room (per hour)', '8-person meeting room', 'Meeting', 60, 20000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #11 Legal: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000358', '00000000-0000-4000-a000-000000000111', 'Initial Consultation', '30-min consultation with attorney', 'Consultation', 30, 50000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000359', '00000000-0000-4000-a000-000000000111', 'Contract Review', 'Review and advise on contracts', 'Corporate', 120, 150000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000360', '00000000-0000-4000-a000-000000000111', 'Court Representation', 'Full court representation per hearing', 'Litigation', 240, 500000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #17 Education: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images, ai_context) VALUES
  ('00000000-0000-4000-a000-000000000361', '00000000-0000-4000-a000-000000000117', 'English Beginner Course', 'English for beginners, 3x per week', 'Language', 90, 180000, 'active', '[]', 'Monthly fee. 12 sessions per month.'),
  ('00000000-0000-4000-a000-000000000362', '00000000-0000-4000-a000-000000000117', 'IELTS Preparation', 'IELTS exam prep, intensive', 'Language', 90, 350000, 'active', '[]', '3-month course, 5x per week.'),
  ('00000000-0000-4000-a000-000000000363', '00000000-0000-4000-a000-000000000117', 'Python Bootcamp', 'Python programming fundamentals', 'Coding', 120, 250000, 'active', '[]', '2-month course, 3x per week.'),
  ('00000000-0000-4000-a000-000000000364', '00000000-0000-4000-a000-000000000117', 'Math Tutoring (Grade 10-12)', 'Advanced math preparation', 'Academic', 90, 150000, 'active', '[]', NULL)
ON CONFLICT (id) DO NOTHING;

-- #18 Sports/Gym: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000365', '00000000-0000-4000-a000-000000000118', 'Monthly Full Membership', 'All facilities and classes', 'Membership', 0, 120000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000366', '00000000-0000-4000-a000-000000000118', 'Personal Training Session', '1-hour with certified trainer', 'Training', 60, 40000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000367', '00000000-0000-4000-a000-000000000118', 'Swimming Pool Pass', 'Single pool session', 'Pool', 60, 10000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000368', '00000000-0000-4000-a000-000000000118', 'Boxing Class', 'Group boxing class', 'Class', 60, 15000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #19 Medical: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000369', '00000000-0000-4000-a000-000000000119', 'General Checkup', 'General practitioner consultation', 'General', 30, 25000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000370', '00000000-0000-4000-a000-000000000119', 'Blood Test (CBC)', 'Complete blood count', 'Laboratory', 15, 15000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000371', '00000000-0000-4000-a000-000000000119', 'Pediatric Consultation', 'Pediatrician visit', 'Pediatrics', 30, 30000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000372', '00000000-0000-4000-a000-000000000119', 'Ultrasound', 'Abdominal ultrasound', 'Imaging', 20, 35000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #20 Consulting: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000373', '00000000-0000-4000-a000-000000000120', 'Strategy Consultation', 'Business strategy session', 'Strategy', 60, 200000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000374', '00000000-0000-4000-a000-000000000120', 'Financial Advisory', 'Financial planning session', 'Finance', 60, 150000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000375', '00000000-0000-4000-a000-000000000120', 'Marketing Audit', 'Digital marketing audit', 'Marketing', 120, 300000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #21 Repair: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000376', '00000000-0000-4000-a000-000000000121', 'Oil Change', 'Engine oil and filter change', 'Maintenance', 45, 35000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000377', '00000000-0000-4000-a000-000000000121', 'Brake Pad Replacement', 'Front or rear brake pads', 'Brakes', 90, 80000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000378', '00000000-0000-4000-a000-000000000121', 'Engine Diagnostics', 'Full computer diagnostics', 'Diagnostics', 60, 25000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000379', '00000000-0000-4000-a000-000000000121', 'Tire Change (set of 4)', 'Mount and balance 4 tires', 'Tires', 60, 40000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #22 Home Services: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000380', '00000000-0000-4000-a000-000000000122', 'Standard Home Cleaning', '2-bedroom apartment cleaning', 'Cleaning', 120, 50000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000381', '00000000-0000-4000-a000-000000000122', 'Deep Cleaning', 'Thorough deep clean, all rooms', 'Cleaning', 240, 120000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000382', '00000000-0000-4000-a000-000000000122', 'Move-In/Out Cleaning', 'Complete move cleaning service', 'Cleaning', 300, 150000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000383', '00000000-0000-4000-a000-000000000122', 'Carpet Cleaning', 'Per room carpet shampooing', 'Carpet', 60, 30000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- #23 Logistics: services
INSERT INTO services (id, store_id, name, description, category, duration_minutes, base_price, status, images) VALUES
  ('00000000-0000-4000-a000-000000000384', '00000000-0000-4000-a000-000000000123', 'Same-Day Delivery (UB)', 'Within Ulaanbaatar, 2-4 hours', 'Delivery', 240, 8000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000385', '00000000-0000-4000-a000-000000000123', 'Next-Day Delivery', 'Delivery by next business day', 'Delivery', 1440, 5000, 'active', '[]'),
  ('00000000-0000-4000-a000-000000000386', '00000000-0000-4000-a000-000000000123', 'Nationwide Delivery', 'Province delivery, 2-5 days', 'Delivery', 7200, 15000, 'active', '[]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. VERTICAL-SPECIFIC DATA
-- ============================================================================

-- #2 Laundry: machines
INSERT INTO machines (id, store_id, name, machine_type, status, capacity_kg) VALUES
  ('00000000-0000-4000-a000-000000000501', '00000000-0000-4000-a000-000000000102', 'Washer 1', 'washer', 'available', 12.0),
  ('00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000102', 'Washer 2', 'washer', 'available', 12.0),
  ('00000000-0000-4000-a000-000000000503', '00000000-0000-4000-a000-000000000102', 'Dryer 1', 'dryer', 'available', 10.0),
  ('00000000-0000-4000-a000-000000000504', '00000000-0000-4000-a000-000000000102', 'Iron Press 1', 'iron_press', 'available', NULL),
  ('00000000-0000-4000-a000-000000000505', '00000000-0000-4000-a000-000000000102', 'Steam Unit', 'steam', 'available', NULL)
ON CONFLICT (id) DO NOTHING;

-- #3 Beauty: staff commissions
INSERT INTO staff_commissions (id, store_id, staff_id, sale_type, sale_amount, commission_rate, commission_amount, status) VALUES
  ('00000000-0000-4000-a000-000000000506', '00000000-0000-4000-a000-000000000103', '00000000-0000-4000-a000-000000000207', 'service', 25000, 30.00, 7500, 'pending'),
  ('00000000-0000-4000-a000-000000000507', '00000000-0000-4000-a000-000000000103', '00000000-0000-4000-a000-000000000208', 'service', 35000, 25.00, 8750, 'pending')
ON CONFLICT (id) DO NOTHING;

-- #7 Retail: inventory locations and suppliers
INSERT INTO inventory_locations (id, store_id, name, location_type, is_active) VALUES
  ('00000000-0000-4000-a000-000000000508', '00000000-0000-4000-a000-000000000107', 'Main Warehouse', 'warehouse', true),
  ('00000000-0000-4000-a000-000000000509', '00000000-0000-4000-a000-000000000107', 'Store Display', 'display', true),
  ('00000000-0000-4000-a000-000000000510', '00000000-0000-4000-a000-000000000107', 'Backroom Storage', 'backroom', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO suppliers (id, store_id, name, contact_name, email, phone, payment_terms, is_active) VALUES
  ('00000000-0000-4000-a000-000000000511', '00000000-0000-4000-a000-000000000107', 'TechSupply Co.', 'Batjargal', 'sales@techsupply.mn', '77220001', 'net_30', true),
  ('00000000-0000-4000-a000-000000000512', '00000000-0000-4000-a000-000000000107', 'PaperWorld MN', 'Oyungerel', 'orders@paperworld.mn', '77220002', 'net_15', true)
ON CONFLICT (id) DO NOTHING;

-- #11 Legal: sample case
INSERT INTO legal_cases (id, store_id, customer_id, assigned_to, case_number, title, case_type, status, priority, description, court_name, filing_date, total_fees, amount_paid) VALUES
  ('00000000-0000-4000-a000-000000000513', '00000000-0000-4000-a000-000000000111', '00000000-0000-4000-a000-000000000423', '00000000-0000-4000-a000-000000000227', 'CASE-2024-001', 'Corporate Registration Dispute', 'corporate', 'in_progress', 'high', 'Client disputes rejected corporate registration at State Registry.', 'Civil Court, UB', '2024-06-15', 3000000, 1500000)
ON CONFLICT (id) DO NOTHING;

-- #12 Construction: sample project
INSERT INTO projects (id, store_id, customer_id, manager_id, name, description, project_type, status, priority, start_date, end_date, budget, actual_cost, completion_percentage, location) VALUES
  ('00000000-0000-4000-a000-000000000514', '00000000-0000-4000-a000-000000000112', '00000000-0000-4000-a000-000000000425', '00000000-0000-4000-a000-000000000230', 'Bayangol Office Renovation', 'Full office renovation for 200sqm office space', 'renovation', 'in_progress', 'medium', '2024-09-01', '2025-02-28', 85000000, 42000000, 50, 'Bayangol District, UB')
ON CONFLICT (id) DO NOTHING;

-- #15 Restaurant: menu categories and table layouts
INSERT INTO menu_categories (id, store_id, name, description, sort_order, is_active) VALUES
  ('00000000-0000-4000-a000-000000000515', '00000000-0000-4000-a000-000000000115', 'Appetizers', 'Starters and snacks', 0, true),
  ('00000000-0000-4000-a000-000000000516', '00000000-0000-4000-a000-000000000115', 'Main Course', 'Traditional Mongolian mains', 1, true),
  ('00000000-0000-4000-a000-000000000517', '00000000-0000-4000-a000-000000000115', 'Beverages', 'Hot and cold drinks', 2, true),
  ('00000000-0000-4000-a000-000000000518', '00000000-0000-4000-a000-000000000115', 'Desserts', 'Sweet treats', 3, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO table_layouts (id, store_id, name, section, capacity, shape, status, is_active) VALUES
  ('00000000-0000-4000-a000-000000000519', '00000000-0000-4000-a000-000000000115', 'Table 1', 'Window', 2, 'square', 'available', true),
  ('00000000-0000-4000-a000-000000000520', '00000000-0000-4000-a000-000000000115', 'Table 2', 'Main Hall', 4, 'rectangle', 'available', true),
  ('00000000-0000-4000-a000-000000000521', '00000000-0000-4000-a000-000000000115', 'Table 3', 'Main Hall', 4, 'rectangle', 'available', true),
  ('00000000-0000-4000-a000-000000000522', '00000000-0000-4000-a000-000000000115', 'Table 4 (VIP)', 'VIP Room', 8, 'oval', 'available', true),
  ('00000000-0000-4000-a000-000000000523', '00000000-0000-4000-a000-000000000115', 'Table 5 (Large)', 'Main Hall', 10, 'rectangle', 'available', true)
ON CONFLICT (id) DO NOTHING;

-- #16 Hotel: units (rooms)
INSERT INTO units (id, store_id, unit_number, unit_type, floor, max_occupancy, base_rate, amenities, status) VALUES
  ('00000000-0000-4000-a000-000000000524', '00000000-0000-4000-a000-000000000116', '101', 'standard', '1', 2, 80000, '["WiFi","TV","AC","Mini fridge"]', 'available'),
  ('00000000-0000-4000-a000-000000000525', '00000000-0000-4000-a000-000000000116', '102', 'standard', '1', 2, 80000, '["WiFi","TV","AC","Mini fridge"]', 'available'),
  ('00000000-0000-4000-a000-000000000526', '00000000-0000-4000-a000-000000000116', '201', 'deluxe', '2', 2, 130000, '["WiFi","TV","AC","Mini bar","City view","Bathtub"]', 'available'),
  ('00000000-0000-4000-a000-000000000527', '00000000-0000-4000-a000-000000000116', '202', 'deluxe', '2', 3, 150000, '["WiFi","TV","AC","Mini bar","City view","Bathtub","Sofa bed"]', 'available'),
  ('00000000-0000-4000-a000-000000000528', '00000000-0000-4000-a000-000000000116', '301', 'suite', '3', 4, 250000, '["WiFi","TV","AC","Mini bar","Panoramic view","Jacuzzi","Living room","Kitchen"]', 'available')
ON CONFLICT (id) DO NOTHING;

-- #19 Medical: patient records
INSERT INTO patients (id, store_id, customer_id, first_name, last_name, date_of_birth, gender, blood_type, phone, email, allergies) VALUES
  ('00000000-0000-4000-a000-000000000529', '00000000-0000-4000-a000-000000000119', '00000000-0000-4000-a000-000000000439', 'Demberel', 'Dorj', '1985-03-15', 'male', 'A+', '88110039', 'demberel@gmail.com', ARRAY['Penicillin']),
  ('00000000-0000-4000-a000-000000000530', '00000000-0000-4000-a000-000000000119', '00000000-0000-4000-a000-000000000440', 'Oyundelger', 'Erdene', '1992-08-22', 'female', 'O+', '88110040', 'oyundelger@gmail.com', '{}')
ON CONFLICT (id) DO NOTHING;

-- #22 Home Services: service areas
INSERT INTO service_areas (id, store_id, name, description, is_active) VALUES
  ('00000000-0000-4000-a000-000000000531', '00000000-0000-4000-a000-000000000122', 'Central UB', 'Sukhbaatar, Chingeltei, Bayangol districts', true),
  ('00000000-0000-4000-a000-000000000532', '00000000-0000-4000-a000-000000000122', 'East UB', 'Bayanzurkh, Khan-Uul districts', true),
  ('00000000-0000-4000-a000-000000000533', '00000000-0000-4000-a000-000000000122', 'West UB', 'Songinokhairkhan district', true)
ON CONFLICT (id) DO NOTHING;

-- #23 Logistics: fleet vehicles
INSERT INTO fleet_vehicles (id, store_id, driver_id, plate_number, vehicle_type, brand, model, year, status) VALUES
  ('00000000-0000-4000-a000-000000000534', '00000000-0000-4000-a000-000000000123', '00000000-0000-4000-a000-000000000261', 'UBA-1234', 'van', 'Hyundai', 'Starex', 2021, 'available'),
  ('00000000-0000-4000-a000-000000000535', '00000000-0000-4000-a000-000000000123', '00000000-0000-4000-a000-000000000262', 'UBB-5678', 'truck', 'Isuzu', 'NQR', 2020, 'available'),
  ('00000000-0000-4000-a000-000000000536', '00000000-0000-4000-a000-000000000123', NULL, 'UBC-9012', 'motorcycle', 'Honda', 'CB125', 2023, 'available')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. CLOSE TRANSACTION
-- ============================================================================

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
