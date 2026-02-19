-- Full seed: public.users, stores, products, services, staff, bookable_resources.
-- Run this in Supabase SQL Editor.

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════
-- Номин Ресторан (restaurant)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('0e624fce-7cd5-431b-a00d-2fd511d7a9e5', 'restaurant@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('0e624fce-7cd5-431b-a00d-2fd511d7a9e5', 'Номин Ресторан', 'nomin-restaurant', 'restaurant', 'Монгол уламжлалт хоолны ресторан. Бууз, хуушуур, цуйван зэрэг шилдэг хоолнууд.', '77001001', '{"welcome_message":"Сайн байна уу! Номин Ресторанд тавтай морил. Цэс, захиалга, ширээ захиалах талаар асууна уу! 🍽️","away_message":"Одоогоор ажлын бус цаг байна. Маргааш 10:00-д эргэн холбогдоно!","quick_replies":["Өнөөдрийн тусгай цэс","Хүргэлт хийдэг үү?","Ширээ захиалах","Ажиллах цаг"],"tone":"friendly","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"менежер, хүн, оператор, гомдол","accent_color":"#ef4444"}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'nomin-restaurant';
  DELETE FROM products WHERE store_id = v_store_id;
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Бууз (8ш)', 'Уламжлалт монгол бууз, махан чанартай', 'Үндсэн хоол', 12000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Хуушуур (4ш)', 'Шарсан хуушуур, халуун шинэхэн', 'Зууш', 8000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Цуйван', 'Монгол шарсан гоймон, ногоотой', 'Үндсэн хоол', 15000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Шарсан мах', 'Хонины шарсан мах, төмсөнд дэвсэж', 'Үндсэн хоол', 18000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Ногоотой салат', 'Шинэхэн ногооны салат, заправкатай', 'Зууш', 8000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Сүүтэй цай', 'Монгол сүүтэй цай (аяга)', 'Ундаа', 3000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Бялуу', 'Өдрийн шинэхэн бялуу', 'Амттан', 7000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Вегетариан хуурга', 'Ногоон хүнсний хуурга, тофутай', 'Тусгай цэс', 10000, 'active', '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Батбаяр', '99001001', 'batbayar@nomin.mn', ARRAY['менежер'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Оюунцэцэг', '99001002', 'oyunaa@nomin.mn', ARRAY['тогооч'], 'active');
  DELETE FROM bookable_resources WHERE store_id = v_store_id;
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'table', 'Ширээ 1', 'Цонхны дэргэдэх 2 хүний ширээ', 2, 0, '{"window_view":true}', '[]', 'available', 0);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'table', 'Ширээ 2', '4 хүний ширээ', 4, 0, '{}', '[]', 'available', 1);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'table', 'Ширээ 3', '4 хүний ширээ', 4, 0, '{}', '[]', 'available', 2);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'table', 'Ширээ 4 (VIP)', 'Хувийн өрөө, 6 хүн', 6, 0, '{"private_room":true}', '[]', 'available', 3);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'table', 'Ширээ 5 (Том)', '10 хүний том ширээ', 10, 0, '{}', '[]', 'available', 4);
END $$;

-- ═══════════════════════════════════════════════
-- Эрүүл Амьдрал Эмнэлэг (hospital)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('09ffd0de-6b02-4e14-9220-0dc382c0f97a', 'hospital@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('09ffd0de-6b02-4e14-9220-0dc382c0f97a', 'Эрүүл Амьдрал Эмнэлэг', 'eruul-amidral', 'hospital', 'Олон мэргэжлийн эмнэлэг. Ерөнхий үзлэг, дотрын тасаг, лаборатори.', '77002001', '{"welcome_message":"Сайн байна уу! Эрүүл Амьдрал Эмнэлэгт тавтай морил. Цаг захиалга, тасаг, үнийн мэдээлэл асууна уу. 🏥","away_message":"Ажлын бус цагт холбогдож байна. Яаралтай тусламж: 107.","quick_replies":["Цаг захиалах","Тасгуудын мэдээлэл","Даатгал хүлээн авдаг уу?","Ажиллах цаг"],"tone":"professional","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"эмч, менежер, яаралтай, оператор, гомдол","accent_color":"#06b6d4"}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'eruul-amidral';
  DELETE FROM services WHERE store_id = v_store_id;
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Ерөнхий үзлэг', 'Ерөнхий нарийн мэргэжлийн эмчийн үзлэг', 'Ерөнхий үзлэг', 30, 25000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Цусны ерөнхий шинжилгээ', 'CBC шинжилгээ, хариу 2 цагт гарна', 'Лаборатори', 15, 15000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Нүдний үзлэг', 'Нүдний харааны шалгалт, оношилгоо', 'Нүдний тасаг', 30, 30000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Дотрын эмчийн үзлэг', 'Дотрын нарийн мэргэжлийн эмчийн үзлэг', 'Дотрын тасаг', 30, 35000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Хүүхдийн үзлэг', 'Хүүхдийн нарийн мэргэжлийн эмчийн үзлэг', 'Хүүхдийн тасаг', 30, 30000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'ЭХО шинжилгээ', 'Хэвлийн ЭХО шинжилгээ', 'Лаборатори', 20, 35000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Зүрхний ЭКГ', 'Зүрхний цахилгаан бичлэг', 'Дотрын тасаг', 15, 20000, 'active', NULL, '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Д. Болормаа', '99002001', 'bolormaa@eruul.mn', ARRAY['Ерөнхий үзлэг','Дотрын тасаг'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Э. Батсүх', '99002002', 'batsukh@eruul.mn', ARRAY['Нүдний тасаг'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Н. Сарантуяа', '99002003', 'sarantuya@eruul.mn', ARRAY['Хүүхдийн тасаг'], 'active');
END $$;

-- ═══════════════════════════════════════════════
-- Bella Beauty Salon (beauty_salon)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('0e3ab11b-a4fe-4ff4-b0cd-f8e6e04d00a9', 'beauty@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('0e3ab11b-a4fe-4ff4-b0cd-f8e6e04d00a9', 'Bella Beauty Salon', 'bella-beauty', 'beauty_salon', 'Гоо сайхны салон. Үсчин, маникюр, нүүр арчилгаа, массаж.', '77003001', '{"welcome_message":"Сайн байна уу! Bella Beauty Salon-д тавтай морил. Үйлчилгээ, цаг захиалга, үнийн мэдээлэл авна уу! 💇","away_message":"Одоогоор ажлын бус цаг байна. Маргааш 10:00-д эргэн холбогдоно!","quick_replies":["Үйлчилгээний жагсаалт","Цаг захиалах","Үнийн мэдээлэл","Ажиллах цаг"],"tone":"friendly","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"менежер, хүн, оператор, гомдол","accent_color":"#ec4899"}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'bella-beauty';
  DELETE FROM services WHERE store_id = v_store_id;
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Эмэгтэй үс засалт', 'Эмэгтэй үс засалт, загвар', 'Үсчин', 60, 25000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Эрэгтэй үс засалт', 'Эрэгтэй үс засалт', 'Үсчин', 30, 15000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Үс будалт', 'Үс будах, өнгө сонголттой', 'Үсчин', 120, 60000, 'active', 'Богино: 45,000₮, Дунд: 60,000₮, Урт: 80,000₮', '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Маникюр', 'Маникюр, лак түрхэлт', 'Маникюр/Педикюр', 45, 15000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Гель маникюр', 'Гель лак маникюр, загвартай', 'Маникюр/Педикюр', 60, 25000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Нүүр цэвэрлэгээ', 'Нүүрний гүнзгий цэвэрлэгээ', 'Нүүр арчилгаа', 60, 35000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Биеийн массаж', 'Бүх биеийн тайвшруулах массаж', 'Массаж', 60, 45000, 'active', NULL, '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Ану', '99003001', 'anu@bella.mn', ARRAY['Үсчин'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Сэлэнгэ', '99003002', 'selenge@bella.mn', ARRAY['Маникюр/Педикюр','Нүүр арчилгаа'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Нандин', '99003003', 'nandin@bella.mn', ARRAY['Массаж'], 'active');
END $$;

-- ═══════════════════════════════════════════════
-- Кофе Хаус (coffee_shop)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('3e50318b-c416-4cdc-b251-44e8e05b7326', 'coffee@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('3e50318b-c416-4cdc-b251-44e8e05b7326', 'Кофе Хаус', 'kofe-haus', 'coffee_shop', 'Чанартай кофе, бялуу, тухтай орчин.', '77004001', '{"welcome_message":"Сайн байна уу! Кофе Хаус-т тавтай морил. Цэс, захиалга, хүргэлтийн талаар асууна уу! ☕","away_message":"Одоогоор хаалттай байна. Маргааш 08:00-д нээгдэнэ!","quick_replies":["Цэс харах","Хүргэлт хийдэг үү?","Өнөөдрийн онцлох","Wi-Fi нууц үг"],"tone":"casual","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"менежер, хүн, оператор, гомдол","accent_color":"#92400e"}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'kofe-haus';
  DELETE FROM products WHERE store_id = v_store_id;
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Американо', 'Классик хар кофе', 'Кофе', 6000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Латте', 'Эспрессо + сүү, зөөлөн амт', 'Кофе', 7500, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Капучино', 'Эспрессо + сүүн хөөс', 'Кофе', 7000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Моча', 'Шоколадтай кофе, крем', 'Кофе', 8500, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Матча латте', 'Япон ногоон цайн латте', 'Цай', 8000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Ice Americano', 'Хүйтэн американо, мөстэй', 'Хүйтэн ундаа', 7000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Чизкейк', 'Нью-Йорк чизкейк, нэг зүсэм', 'Бялуу/Амттан', 9000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Круассан', 'Шинэхэн жигнэсэн круассан', 'Snack', 5000, 'active', '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Тэмүүлэл', '99004001', 'temuulel@kofe.mn', ARRAY['бариста'], 'active');
END $$;

-- ═══════════════════════════════════════════════
-- FitZone Gym (fitness)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('143e203a-f7da-4d26-8e72-6976ff761162', 'fitness@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('143e203a-f7da-4d26-8e72-6976ff761162', 'FitZone Gym', 'fitzone-gym', 'fitness', 'Орчин үеийн фитнесс клуб. Gym, йога, пилатес, кроссфит, усан сан.', '77005001', '{"welcome_message":"Сайн байна уу! FitZone Gym-д тавтай морил. Гишүүнчлэл, хичээлийн хуваарь, үнийн мэдээлэл авна уу! 💪","away_message":"Одоогоор ажлын бус цаг байна. Маргааш 07:00-д нээгдэнэ!","quick_replies":["Гишүүнчлэлийн үнэ","Хичээлийн хуваарь","Хувийн дасгалжуулагч","Ажиллах цаг"],"tone":"friendly","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"менежер, хүн, оператор, гомдол","accent_color":"#8b5cf6"}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'fitzone-gym';
  DELETE FROM services WHERE store_id = v_store_id;
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Хувийн дасгал (1 цаг)', 'Хувийн дасгалжуулагчтай 1 цагийн хичээл', 'Хувийн дасгал', 60, 40000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Йога хичээл', 'Бүлгийн йога хичээл', 'Йога', 60, 15000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Пилатес', 'Бүлгийн пилатес хичээл', 'Бүлгийн хичээл', 50, 15000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Кроссфит', 'Бүлгийн кроссфит хичээл', 'Бүлгийн хичээл', 45, 12000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Усан сан (1 удаа)', 'Усан сангийн 1 удаагийн эрх', 'Усан сан', 60, 10000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Сарын гишүүнчлэл', '1 сарын бүрэн гишүүнчлэл', 'Гишүүнчлэл', 0, 120000, 'active', NULL, '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Төмөр', '99005001', 'tomor@fitzone.mn', ARRAY['Хувийн дасгал','Кроссфит'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Солонго', '99005002', 'solongo@fitzone.mn', ARRAY['Йога','Пилатес'], 'active');
END $$;

-- ═══════════════════════════════════════════════
-- Ухаанай Сургалт (education)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('b2a79932-de1b-46dc-95a5-bdc1027b1289', 'education@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('b2a79932-de1b-46dc-95a5-bdc1027b1289', 'Ухаанай Сургалт', 'ukhaanai-surgalt', 'education', 'Хэл сургалт, програмчлал, IELTS бэлтгэл, математик.', '77006001', '{"welcome_message":"Сайн байна уу! Ухаанай Сургалтын төвийн цахим туслахад тавтай морил. Курс, бүртгэл, хуваарийн талаар асууна уу! 📚","away_message":"Одоогоор ажлын бус цаг байна. Даваа гарагт эргэн холбогдоно!","quick_replies":["Курсуудын жагсаалт","Бүртгүүлэх","Хуваарь","Үнийн мэдээлэл"],"tone":"professional","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"менежер, багш, оператор, гомдол","accent_color":"#f59e0b","return_policy":"Курс эхлэхээс 3 хоногийн өмнө цуцалвал 100% буцаана. Эхэлсний дараа буцаалт хийгдэхгүй."}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'ukhaanai-surgalt';
  DELETE FROM services WHERE store_id = v_store_id;
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Англи хэл (Эхлэгч)', 'Эхлэгчдэд зориулсан англи хэлний сургалт', 'Хэл сургалт', 90, 180000, 'active', 'Сард 12 хичээл, 7 хоногт 3 удаа', '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'IELTS бэлтгэл', 'IELTS шалгалтын бэлтгэл курс', 'Хэл сургалт', 90, 350000, 'active', '3 сарын курс, 7 хоногт 5 удаа', '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Математик (ЕБС)', '10-12-р ангийн математик бэлтгэл', 'ЕБС бэлтгэл', 90, 150000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Python програмчлал', 'Python хэлний үндсэн курс', 'Програмчлал', 120, 250000, 'active', '2 сарын курс, 7 хоногт 3 удаа', '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Зурагийн хичээл', 'Уран зургийн хичээл, бүх насны', 'Урлаг', 90, 80000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Хятад хэл (Эхлэгч)', 'Эхлэгчдэд зориулсан хятад хэлний курс', 'Хэл сургалт', 90, 200000, 'active', NULL, '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Б. Мөнхжин', '99006001', 'munkhjin@ukhaanai.mn', ARRAY['Англи хэл','IELTS'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Д. Ариунболд', '99006002', 'ariunbold@ukhaanai.mn', ARRAY['Python','Програмчлал'], 'active');
END $$;

-- ═══════════════════════════════════════════════
-- Инээмсэглэл Шүдний (dental_clinic)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('1f171300-61d7-4361-befc-5cd9735e5dd2', 'dental@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('1f171300-61d7-4361-befc-5cd9735e5dd2', 'Инээмсэглэл Шүдний', 'ineemseglel-dental', 'dental_clinic', 'Шүдний эмнэлэг. Үзлэг, цэвэрлэгээ, ломбо, импланат.', '77007001', '{"welcome_message":"Сайн байна уу! Инээмсэглэл Шүдний Эмнэлэгт тавтай морил. Цаг захиалга, үйлчилгээ, үнийн мэдээлэл авна уу! 🦷","away_message":"Ажлын бус цагт холбогдож байна. Даваа-Баасан 09:00-18:00 цагт үйлчилнэ.","quick_replies":["Цаг захиалах","Үйлчилгээний үнэ","Шүдний цэвэрлэгээ","Даатгал хүлээн авдаг уу?"],"tone":"professional","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"эмч, менежер, яаралтай, оператор, гомдол","accent_color":"#14b8a6"}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'ineemseglel-dental';
  DELETE FROM services WHERE store_id = v_store_id;
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Шүдний үзлэг', 'Шүдний ерөнхий үзлэг, оношилгоо', 'Оношилгоо', 30, 15000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Шүдний цэвэрлэгээ', 'Мэргэжлийн шүдний цэвэрлэгээ', 'Гоо сайхны', 45, 40000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Ломбо тавих', 'Шүдний ломбо, материал сонголттой', 'Эмчилгээ', 45, 35000, 'active', 'Энгийн ломбо: 35,000₮. Гэрлийн ломбо: 50,000₮.', '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Шүд авалт', 'Шүд авах мэс ажилбар', 'Мэс засал', 30, 30000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Шүдний импланат', 'Импланат суулгах, зөвлөгөө', 'Мэс засал', 90, 800000, 'active', 'Үнэ импланатын төрлөөс хамаарна. Зөвлөгөөг үнэгүй авна.', '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Шүд цайруулах', 'Мэргэжлийн шүд цайруулалт', 'Гоо сайхны', 60, 120000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Хүүхдийн шүдний үзлэг', 'Хүүхдэд зориулсан шүдний үзлэг', 'Хүүхдийн', 20, 10000, 'active', NULL, '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Д. Нарангэрэл', '99007001', 'narangerel@dental.mn', ARRAY['Оношилгоо','Эмчилгээ'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Б. Энхбаяр', '99007002', 'enkhbayar@dental.mn', ARRAY['Мэс засал','Импланат'], 'active');
END $$;

-- ═══════════════════════════════════════════════
-- Green Home Realty (real_estate)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('3f3d537a-6db7-4a08-8037-e28b5f1f94f8', 'realestate@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('3f3d537a-6db7-4a08-8037-e28b5f1f94f8', 'Green Home Realty', 'green-home-realty', 'real_estate', 'Үл хөдлөх хөрөнгийн агентлаг. Орон сууц, газар, түрээс.', '77008001', '{"welcome_message":"Сайн байна уу! Green Home Realty-д тавтай морил. Орон сууц, газар, түрээсийн мэдээлэл авна уу! 🏠","away_message":"Ажлын бус цагт холбогдож байна. Даваа-Баасан 09:00-18:00.","quick_replies":["Орон сууц хайх","Газрын зар","Түрээсийн зар","Зээлийн зөвлөгөө"],"tone":"professional","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"агент, менежер, хүн, оператор, гомдол","accent_color":"#10b981"}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'green-home-realty';
  DELETE FROM products WHERE store_id = v_store_id;
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, '2 өрөө орон сууц (Баянгол)', '2 өрөө, 55м², 12-р давхар, шинэ засалтай', 'Орон сууц', 95000000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, '3 өрөө орон сууц (Сүхбаатар)', '3 өрөө, 85м², 7-р давхар, төв байршилтай', 'Орон сууц', 180000000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Газар (Налайх 700м²)', '700м² газар, гэр хорооллын бүсэд', 'Газар', 45000000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Оффис (Чингэлтэй 120м²)', '120м² оффис, анхан давхарт, зогсоолтой', 'Оффис', 250000000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, '1 өрөө түрээс (ХУД)', '1 өрөө, 35м², тавилга бүрэн', 'Түрээс', 650000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, '2 өрөө түрээс (БЗД)', '2 өрөө, 60м², шинэ засалтай', 'Түрээс', 1200000, 'active', '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Б. Ганзориг', '99008001', 'ganzorig@greenhome.mn', ARRAY['Орон сууц','Газар'], 'active');
END $$;

-- ═══════════════════════════════════════════════
-- Хустай Кемпинг (camping_guesthouse)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('9f93f7af-e928-41cb-a341-e6b65012b4f1', 'camping@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('9f93f7af-e928-41cb-a341-e6b65012b4f1', 'Хустай Кемпинг', 'khustai-camping', 'camping_guesthouse', 'Монгол гэр, модон байшин, майхны талбай. Морь унах, сур харвалт.', '77009001', '{"welcome_message":"Сайн байна уу! Хустай Кемпинг-д тавтай морил. Байр захиалга, үнэ, хөтөлбөрийн талаар асууна уу! ⛺","away_message":"Одоогоор ажлын бус цаг байна. Маргааш 09:00-д холбогдоно.","quick_replies":["Байрны төрлүүд","Захиалга өгөх","Амралтын хөтөлбөр","Хэрхэн хүрэх вэ?"],"tone":"friendly","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"менежер, хүн, оператор, гомдол","accent_color":"#84cc16"}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'khustai-camping';
  DELETE FROM services WHERE store_id = v_store_id;
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Морь унах', 'Морь унах аялал (1 цаг)', 'Хөтөлбөр', 60, 30000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Сур харвалт', 'Сур харвалт, зааварчилгаатай', 'Хөтөлбөр', 30, 20000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Байгалийн аялал', 'Хустай нуруу тойрох аялал', 'Хөтөлбөр', 180, 15000, 'active', NULL, '[]');
  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
    VALUES (v_store_id, 'Кэмпфайр шөнийн хөтөлбөр', 'Галын дэргэдэх шөнийн хөтөлбөр', 'Хөтөлбөр', 120, 10000, 'active', NULL, '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Б. Ганболд', '99009001', 'ganbold@khustai.mn', ARRAY['менежер'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Д. Мөнхбат', '99009002', 'munkhbat@khustai.mn', ARRAY['морь','аялал'], 'active');
  DELETE FROM bookable_resources WHERE store_id = v_store_id;
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'ger', 'Монгол гэр (Стандарт) №1', '2 хүн, халуун ус', 2, 80000, '{"hot_water":true}', '[]', 'available', 0);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'ger', 'Монгол гэр (Стандарт) №2', '2 хүн, халуун ус', 2, 80000, '{"hot_water":true}', '[]', 'available', 1);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'ger', 'Монгол гэр (Люкс)', '4 хүн, wifi, халуун ус', 4, 120000, '{"hot_water":true,"wifi":true}', '[]', 'available', 2);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'room', 'Стандарт өрөө №1', '2 хүн, TV, wifi', 2, 60000, '{"tv":true,"wifi":true}', '[]', 'available', 3);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'room', 'Люкс өрөө', '2 хүн, мини бар, тагт', 2, 100000, '{"mini_bar":true,"balcony":true,"wifi":true}', '[]', 'available', 4);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'tent_site', 'Майхны талбай №1', 'Цахилгаан, усны холболттой', 4, 15000, '{"electricity":true,"water":true}', '[]', 'available', 5);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'tent_site', 'Майхны талбай №2', 'Цахилгаан, усны холболттой', 4, 15000, '{"electricity":true,"water":true}', '[]', 'available', 6);
  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
    VALUES (v_store_id, 'cabin', 'Модон байшин', '4 хүн, гал тогоо, зуух', 4, 150000, '{"kitchen":true,"fireplace":true}', '[]', 'available', 7);
END $$;

-- ═══════════════════════════════════════════════
-- Монгол Маркет (ecommerce)
-- ═══════════════════════════════════════════════
INSERT INTO users (id, email, password_hash, is_verified, email_verified)
  VALUES ('270bc604-6107-4821-b6f0-a26931b6a5b7', 'shop@temuulel.test', 'supabase_auth', true, true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)
  VALUES ('270bc604-6107-4821-b6f0-a26931b6a5b7', 'Монгол Маркет', 'mongol-market', 'ecommerce', 'Онлайн дэлгүүр. Хувцас, электроник, гэр ахуй, гоо сайхны бүтээгдэхүүн.', '77010001', '{"welcome_message":"Сайн байна уу! Монгол Маркет онлайн дэлгүүрт тавтай морил. Бүтээгдэхүүн хайх, захиалга өгөх, хүргэлтийн мэдээлэл авна уу! 🛒","away_message":"Баярлалаа! Ажлын цагт (09:00-21:00) эргэн холбогдоно.","quick_replies":["Бүтээгдэхүүн хайх","Захиалга шалгах","Хүргэлтийн мэдээлэл","Буцаалтын бодлого"],"tone":"friendly","language":"mongolian","show_product_prices":true,"max_product_results":5,"auto_handoff":true,"handoff_keywords":"менежер, хүн, оператор, гомдол","accent_color":"#3b82f6","return_policy":"Бүтээгдэхүүн хүлээж авснаас 14 хоногийн дотор буцаалт хийх боломжтой. Шошго, баглаа боодол бүрэн байх шаардлагатай."}', true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, business_type = EXCLUDED.business_type,
    description = EXCLUDED.description, phone = EXCLUDED.phone,
    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;
DO $$
DECLARE v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'mongol-market';
  DELETE FROM products WHERE store_id = v_store_id;
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Кашемир цамц', 'Монгол кашемир, эрэгтэй/эмэгтэй, S-XL размер', 'Хувцас', 189000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Ноосон малгай', 'Монгол ноосон малгай, өвлийн улирал', 'Хувцас', 35000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Арьсан цүнх', 'Жинхэнэ арьсан гар цүнх', 'Хувцас', 120000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Утасгүй чихэвч (Bluetooth)', 'ANC чихэвч, 30 цагийн батерей', 'Электроник', 85000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Ухаалаг цаг', 'Фитнесс трекер, зүрхний цохилт, GPS', 'Электроник', 125000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'USB-C цэнэглэгч (65W)', 'Хурдан цэнэглэгч, зөөврийн компьютерт тохиромжтой', 'Электроник', 45000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Нүүрний тос (Витамин C)', 'Нүүрний арчилгааны тос, 50мл', 'Гоо сайхан', 28000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Шампунь + Кондиционер', 'Байгалийн орц найрлагатай, 2х250мл', 'Гоо сайхан', 32000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Гэрийн чимэглэл (Зурагтын тавиур)', 'Модон ханын тавиур, 3 тавцантай', 'Гэр ахуй', 55000, 'active', '[]');
  INSERT INTO products (store_id, name, description, category, base_price, status, images)
    VALUES (v_store_id, 'Хүүхдийн тоглоом (Лего)', 'Барилгын блок, 150+ хэсэг, 5+ нас', 'Хүүхэд', 42000, 'active', '[]');
  DELETE FROM staff WHERE store_id = v_store_id;
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Б. Тэмүүлэн', '99010001', 'temuulen@mongolmarket.mn', ARRAY['менежер','борлуулалт'], 'active');
  INSERT INTO staff (store_id, name, phone, email, specialties, status)
    VALUES (v_store_id, 'Д. Сарнай', '99010002', 'sarnai@mongolmarket.mn', ARRAY['хүргэлт','агуулах'], 'active');
END $$;

NOTIFY pgrst, 'reload schema';