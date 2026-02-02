-- Realistic customer data: customers, conversations, messages, orders, appointments
-- For all 9 seeded businesses

-- ═══════════════════════════════════════════════
-- 1. НОМИН РЕСТОРАН (restaurant)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID; v_cust5 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID; v_conv5 UUID;
  v_ord1 UUID; v_ord2 UUID; v_ord3 UUID;
  v_prod UUID;
  v_staff1 UUID; v_staff2 UUID;
  v_res1 UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'nomin-restaurant';

  -- Clean existing
  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE store_id = v_store_id);
  DELETE FROM orders WHERE store_id = v_store_id;
  DELETE FROM appointments WHERE store_id = v_store_id;
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  -- Customers
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Батбаяр', '99112233', 'messenger') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Сарангэрэл', '88334455', 'web') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Ганзориг', '99887766', 'messenger') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Оюунчимэг', '88001122', 'instagram') RETURNING id INTO v_cust4;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Тэмүүлэн', '99554433', 'web') RETURNING id INTO v_cust5;

  -- Conv1: Батбаяр - цэсний асуулт + захиалга
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'messenger', 0, now()-interval '5 days', now()-interval '5 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'Сайн байна уу, цэс харж болох уу?', true, false, now()-interval '5 days 2 hours'),
    (v_conv1, 'Сайн байна уу! Манай цэсэнд Бууз (8ш) - 12,000₮, Цуйван - 15,000₮, Шарсан мах - 18,000₮, Хуушуур (4ш) - 8,000₮ зэрэг хоол байна. Та юу захиалах вэ?', false, true, now()-interval '5 days 2 hours'+interval '10 seconds'),
    (v_conv1, 'Бууз 2 порц, Цуйван 1 авна', true, false, now()-interval '5 days 1 hour 50 minutes'),
    (v_conv1, 'Бууз 2 порц (24,000₮) + Цуйван 1 (15,000₮) = Нийт 39,000₮. Захиалга бүртгэлээ. Хүргэлт хийх үү?', false, true, now()-interval '5 days 1 hour 49 minutes'),
    (v_conv1, 'Тийм, БЗД 3-р хороо 45-р байр', true, false, now()-interval '5 days 1 hour 45 minutes'),
    (v_conv1, 'Хүргэлтийн хаяг бүртгэлээ. 30-40 минутын дотор хүргэнэ. Баярлалаа!', false, true, now()-interval '5 days 1 hour 44 minutes');

  -- Order for Батбаяр
  SELECT id INTO v_prod FROM products WHERE store_id = v_store_id AND name = 'Бууз (8ш)' LIMIT 1;
  INSERT INTO orders (id, store_id, customer_id, order_number, status, total_amount, payment_method, payment_status, shipping_address, created_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'NR-001', 'delivered', 39000, 'cash', 'paid', 'БЗД 3-р хороо 45-р байр', now()-interval '5 days') RETURNING id INTO v_ord1;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (v_ord1, v_prod, 2, 12000);

  -- Conv2: Сарангэрэл - Гомдол (хоол хүйтэн ирсэн)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'closed', 'web', 0, 55, 'medium', now()-interval '3 days', now()-interval '3 days') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, 'Өчигдөр захиалсан хоол хүйтэн ирсэн байна! Цуйван нь огт хүйтэн, идэх боломжгүй байсан', true, false, now()-interval '3 days 4 hours'),
    (v_conv2, 'Уучлаарай, хоол чанарын асуудал гарсанд маш их харамсаж байна. Таны захиалгын дугаарыг хэлнэ үү?', false, true, now()-interval '3 days 4 hours'+interval '15 seconds'),
    (v_conv2, 'NR-002 захиалга. Энэ анх удаа биш шүү, өмнө нь бас хоол удаан ирсэн', true, false, now()-interval '3 days 3 hours 50 minutes'),
    (v_conv2, 'Дахин уучлаарай. Таны NR-002 захиалгыг шалгалаа. Нөхөн олговор болгож дараагийн захиалгад 20% хөнгөлөлт үзүүлье. Мөн энэ удаагийн захиалгын мөнгийг буцаах уу?', false, true, now()-interval '3 days 3 hours 49 minutes'),
    (v_conv2, 'Мөнгө буцааж өгөөч', true, false, now()-interval '3 days 3 hours 40 minutes'),
    (v_conv2, 'Тийм ээ, 15,000₮ буцаан олголтыг бүртгэлээ. 1-2 ажлын өдөрт орно. Дахин уучлаарай, цаашид чанараа сайжруулна.', false, true, now()-interval '3 days 3 hours 39 minutes'),
    (v_conv2, 'За баярлалаа', true, false, now()-interval '3 days 3 hours 30 minutes');

  INSERT INTO orders (id, store_id, customer_id, order_number, status, total_amount, payment_method, payment_status, created_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'NR-002', 'cancelled', 15000, 'qpay', 'refunded', now()-interval '4 days') RETURNING id INTO v_ord2;

  -- Conv3: Ганзориг - Ширээ захиалга
  SELECT id INTO v_staff1 FROM staff WHERE store_id = v_store_id LIMIT 1;
  SELECT id INTO v_res1 FROM bookable_resources WHERE store_id = v_store_id AND name LIKE '%VIP%' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'closed', 'messenger', now()-interval '2 days', now()-interval '2 days') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, 'Ширээ захиалах боломжтой юу?', true, false, now()-interval '2 days 6 hours'),
    (v_conv3, 'Тийм! Хэдэн хүн ирэх вэ, хэзээ ирэх вэ?', false, true, now()-interval '2 days 6 hours'+interval '8 seconds'),
    (v_conv3, '6 хүн, маргааш оройн 7 цагт', true, false, now()-interval '2 days 5 hours 55 minutes'),
    (v_conv3, '6 хүний VIP ширээ маргааш 19:00 цагт захиалагдлаа. Таны нэр, утасны дугаар хэлнэ үү?', false, true, now()-interval '2 days 5 hours 54 minutes'),
    (v_conv3, 'Ганзориг, 99887766', true, false, now()-interval '2 days 5 hours 50 minutes'),
    (v_conv3, 'Ганзориг, 99887766 дугаараар бүртгэлээ. VIP ширээ (6 хүн) маргааш 19:00 цагт. Тавтай морилно уу!', false, true, now()-interval '2 days 5 hours 49 minutes');

  -- Appointment for table reservation
  INSERT INTO appointments (store_id, customer_id, staff_id, resource_id, scheduled_at, duration_minutes, status, customer_name, customer_phone, source, conversation_id, party_size)
    VALUES (v_store_id, v_cust3, v_staff1, v_res1, now()-interval '1 day'+interval '19 hours', 120, 'completed', 'Ганзориг', '99887766', 'messenger', v_conv3, 6);

  -- Conv4: Оюунчимэг - Instagram-с үнэ асуулт
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'active', 'instagram', 1, now()-interval '1 day', now()-interval '1 day') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, 'Сайн байна уу, хоолны үнэ хэд вэ?', true, false, now()-interval '1 day 3 hours'),
    (v_conv4, 'Сайн байна уу! Манай зарим хоолны үнэ: Бууз 8ш - 12,000₮, Цуйван - 15,000₮, Шарсан мах - 18,000₮. Дэлгэрэнгүй цэс үзэх үү?', false, true, now()-interval '1 day 3 hours'+interval '12 seconds'),
    (v_conv4, 'Хүргэлт байгаа юу?', true, false, now()-interval '1 day 2 hours 50 minutes');

  -- Conv5: Тэмүүлэн - хоол захиалга + сэтгэл ханамж
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust5, 'closed', 'web', 0, now()-interval '6 days', now()-interval '6 days') RETURNING id INTO v_conv5;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv5, 'Шарсан мах захиалъя', true, false, now()-interval '6 days 1 hour'),
    (v_conv5, 'Шарсан мах - 18,000₮. Захиалга үүсгэх үү?', false, true, now()-interval '6 days 1 hour'+interval '8 seconds'),
    (v_conv5, 'Тийм, мөн Сүүтэй цай нэмнэ үү', true, false, now()-interval '6 days 55 minutes'),
    (v_conv5, 'Шарсан мах (18,000₮) + Сүүтэй цай (3,000₮) = 21,000₮. Захиалга бүртгэлээ!', false, true, now()-interval '6 days 54 minutes'),
    (v_conv5, 'Хоол маш амттай байсан, баярлалаа! 👍', true, false, now()-interval '5 days 20 hours'),
    (v_conv5, 'Баярлалаа! Таны сэтгэгдэлд талархаж байна. Дахин тавтай морилно уу! 😊', false, true, now()-interval '5 days 20 hours'+interval '5 seconds');

  INSERT INTO orders (id, store_id, customer_id, order_number, status, total_amount, payment_method, payment_status, created_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust5, 'NR-003', 'delivered', 21000, 'qpay', 'paid', now()-interval '6 days');
END $$;

-- ═══════════════════════════════════════════════
-- 2. ЭРҮҮЛ АМЬДРАЛ ЭМНЭЛЭГ (hospital)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID;
  v_svc UUID; v_staff1 UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'eruul-amidral';

  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM appointments WHERE store_id = v_store_id;
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Нарангэрэл', '99001234', 'web') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Болдбаатар', '88112345', 'messenger') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Цэцэгмаа', '99223344', 'web') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Дэлгэрмаа', '88556677', 'messenger') RETURNING id INTO v_cust4;

  SELECT id INTO v_staff1 FROM staff WHERE store_id = v_store_id LIMIT 1;

  -- Conv1: Нарангэрэл - Ерөнхий үзлэг цаг авах
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name = 'Ерөнхий үзлэг' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'web', 0, now()-interval '4 days', now()-interval '4 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'Сайн байна уу, ерөнхий үзлэгт цаг авах боломжтой юу?', true, false, now()-interval '4 days 3 hours'),
    (v_conv1, 'Сайн байна уу! Ерөнхий үзлэг 25,000₮. Маргааш 10:00 эсвэл 14:00 цагт сул байна. Аль нь тохирох вэ?', false, true, now()-interval '4 days 3 hours'+interval '10 seconds'),
    (v_conv1, '10 цагт авъя', true, false, now()-interval '4 days 2 hours 55 minutes'),
    (v_conv1, 'Маргааш 10:00 цагт ерөнхий үзлэгт бүртгэлээ. Нэр, утасны дугаараа хэлнэ үү?', false, true, now()-interval '4 days 2 hours 54 minutes'),
    (v_conv1, 'Нарангэрэл, 99001234', true, false, now()-interval '4 days 2 hours 50 minutes'),
    (v_conv1, 'Бүртгэлээ! Маргааш 10:00 цагт ирнэ үү. Иргэний үнэмлэхээ авчрахаа мартуузай.', false, true, now()-interval '4 days 2 hours 49 minutes');

  INSERT INTO appointments (store_id, customer_id, staff_id, service_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status)
    VALUES (v_store_id, v_cust1, v_staff1, v_svc, now()-interval '3 days'+interval '10 hours', 30, 'completed', 25000, 'Нарангэрэл', '99001234', 'chat', v_conv1, 'paid');

  -- Conv2: Болдбаатар - Шүд өвдөж байгаа яаралтай
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'active', 'messenger', 2, 40, 'medium', now()-interval '1 day', now()-interval '1 day') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, 'Яаралтай! Гэдэс маш их өвдөж байна, өнөөдөр үзүүлэх боломжтой юу?', true, false, now()-interval '1 day 5 hours'),
    (v_conv2, 'Дотрын эмчийн үзлэг 35,000₮. Өнөөдөр 15:00 цагт сул цаг байна. Та ирж чадах уу?', false, true, now()-interval '1 day 5 hours'+interval '12 seconds'),
    (v_conv2, 'Тийм, 15 цагт ирнэ. Маш их өвдөж байна', true, false, now()-interval '1 day 4 hours 55 minutes'),
    (v_conv2, 'Ойлголоо, 15:00 цагт бүртгэлээ. Яаралтай тул тэр цагт шууд үзнэ. Хэрэв өвчин хүчтэй бол 103 дугаарт залгана уу.', false, true, now()-interval '1 day 4 hours 54 minutes'),
    (v_conv2, 'Үзлэгийн дараа ямар шинжилгээ өгөх ёстой вэ?', true, false, now()-interval '1 day 2 hours');

  -- Conv3: Цэцэгмаа - Цусны шинжилгээний үр дүн асуух
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'closed', 'web', 0, now()-interval '7 days', now()-interval '7 days') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, 'Өчигдөр цусны шинжилгээ өгсөн, үр дүн хэзээ гарах вэ?', true, false, now()-interval '7 days 2 hours'),
    (v_conv3, 'Цусны ерөнхий шинжилгээний үр дүн ихэвчлэн 1-2 ажлын өдөрт гарна. Үр дүн бэлэн болмогц мессежээр мэдэгдэнэ.', false, true, now()-interval '7 days 2 hours'+interval '8 seconds'),
    (v_conv3, 'За ойлголоо, баярлалаа', true, false, now()-interval '7 days 1 hour 55 minutes');

  -- Conv4: Дэлгэрмаа - Гомдол (удаан хүлээсэн)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'closed', 'messenger', 0, 65, 'high', now()-interval '2 days', now()-interval '2 days') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, 'Цаг авсан байсан, 1 цаг хүлээсэн мөртөө үзүүлж чадсангүй! Энэ юу вэ?', true, false, now()-interval '2 days 4 hours'),
    (v_conv4, 'Маш их уучлаарай. Таны цагийг шалгая. Цагийн мэдээллээ хэлнэ үү?', false, true, now()-interval '2 days 4 hours'+interval '10 seconds'),
    (v_conv4, 'Өчигдөр 14:00 цагт дотрын эмчийн үзлэг. Дэлгэрмаа нэртэй', true, false, now()-interval '2 days 3 hours 50 minutes'),
    (v_conv4, 'Уучлаарай Дэлгэрмаа. Өчигдөр яаралтай өвчтөнүүд ирсэн учраас хугацаа хоцорсон. Нөхөн олговор болгож дараагийн үзлэгийг 50% хөнгөлөлттэй үзүүлнэ.', false, true, now()-interval '2 days 3 hours 49 minutes'),
    (v_conv4, 'Ингэвэл зүгээр, дараа нь цаг авна', true, false, now()-interval '2 days 3 hours 40 minutes'),
    (v_conv4, 'Баярлалаа, ойлголцсонд талархаж байна. Цаг авахдаа мессеж бичнэ үү!', false, true, now()-interval '2 days 3 hours 39 minutes');
END $$;

-- ═══════════════════════════════════════════════
-- 3. BELLA BEAUTY SALON (beauty_salon)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID; v_cust5 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID; v_conv5 UUID;
  v_svc UUID; v_staff1 UUID; v_staff2 UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'bella-beauty';

  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM appointments WHERE store_id = v_store_id;
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Солонго', '99334455', 'instagram') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Ариунаа', '88445566', 'messenger') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Мөнхзул', '99667788', 'web') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Энхтуяа', '88998877', 'instagram') RETURNING id INTO v_cust4;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Гэрэлмаа', '99112200', 'messenger') RETURNING id INTO v_cust5;

  SELECT id INTO v_staff1 FROM staff WHERE store_id = v_store_id LIMIT 1;
  SELECT id INTO v_staff2 FROM staff WHERE store_id = v_store_id OFFSET 1 LIMIT 1;

  -- Conv1: Солонго - Үс будалт цаг + Instagram
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name = 'Үс будалт' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'instagram', 0, now()-interval '3 days', now()-interval '3 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'Сайн байна уу, үс будуулах гэсэн юм. Үнэ хэд вэ?', true, false, now()-interval '3 days 4 hours'),
    (v_conv1, 'Сайн байна уу! Үс будалт 60,000₮-с эхэлнэ, үсний урт, өнгөнөөс хамаарна. 2 цаг орчим үргэлжилнэ. Цаг авах уу?', false, true, now()-interval '3 days 4 hours'+interval '10 seconds'),
    (v_conv1, 'Тийм, маргааш болох уу?', true, false, now()-interval '3 days 3 hours 55 minutes'),
    (v_conv1, 'Маргааш 11:00 эсвэл 15:00 цагт сул байна. Аль нь тохирох вэ?', false, true, now()-interval '3 days 3 hours 54 minutes'),
    (v_conv1, '15 цагт авъя', true, false, now()-interval '3 days 3 hours 50 minutes'),
    (v_conv1, 'Маргааш 15:00 цагт үс будалт бүртгэлээ. Тавтай морилно уу!', false, true, now()-interval '3 days 3 hours 49 minutes');

  INSERT INTO appointments (store_id, customer_id, staff_id, service_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status)
    VALUES (v_store_id, v_cust1, v_staff1, v_svc, now()-interval '2 days'+interval '15 hours', 120, 'completed', 60000, 'Солонго', '99334455', 'instagram', v_conv1, 'paid');

  -- Conv2: Ариунаа - Гомдол (үс муу болсон)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'active', 'messenger', 1, 70, 'high', now()-interval '1 day', now()-interval '1 day') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, 'Өнгөрсөн долоо хоногт үс будуулсан юмаа, өнгө нь огт өөр болсон байна! Хар өнгө захиалсан, бор өнгө болсон', true, false, now()-interval '1 day 6 hours'),
    (v_conv2, 'Уучлаарай, өнгө таарахгүй байсанд харамсаж байна. Хэзээ хийлгэсэн бэ? Мастерын нэрийг хэлж чадах уу?', false, true, now()-interval '1 day 6 hours'+interval '12 seconds'),
    (v_conv2, 'Баасан гаригт. Ямар мастер байсныг санахгүй байна. Мөнгөө буцааж өгөх үү?', true, false, now()-interval '1 day 5 hours 50 minutes'),
    (v_conv2, 'Ойлголоо. 2 сонголт байна: 1) Үнэгүй дахин будуулах, 2) Бүтэн буцаан олговор. Аль нь тохирох вэ?', false, true, now()-interval '1 day 5 hours 49 minutes'),
    (v_conv2, 'Дахин будуулъя, гэхдээ сайн мастер байгаа юу?', true, false, now()-interval '1 day 5 hours 40 minutes'),
    (v_conv2, 'Тийм, ахлах мастер Бадамцэцэг таныг хийнэ. Хэзээ ирэх вэ?', false, true, now()-interval '1 day 5 hours 39 minutes'),
    (v_conv2, 'Маргааш 11 цагт ирнэ', true, false, now()-interval '1 day 5 hours 30 minutes');

  INSERT INTO appointments (store_id, customer_id, staff_id, service_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status, notes)
    VALUES (v_store_id, v_cust2, v_staff2, v_svc, now()+interval '11 hours', 120, 'confirmed', 0, 'Ариунаа', '88445566', 'messenger', v_conv2, 'pending', 'Үнэгүй дахин будалт - өмнөх удаа өнгө буруу болсон');

  -- Conv3: Мөнхзул - Маникюр цаг
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name = 'Гель маникюр' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'closed', 'web', 0, now()-interval '5 days', now()-interval '5 days') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, 'Гель маникюр хийлгэхэд хэр удаан болдог вэ?', true, false, now()-interval '5 days 2 hours'),
    (v_conv3, 'Гель маникюр 1 цаг орчим үргэлжилнэ. Үнэ 25,000₮. Цаг авах уу?', false, true, now()-interval '5 days 2 hours'+interval '8 seconds'),
    (v_conv3, 'Тийм, энэ долоо хоногт ямар цаг сул байна?', true, false, now()-interval '5 days 1 hour 55 minutes'),
    (v_conv3, 'Лхагва 14:00, Пүрэв 10:00, Баасан 16:00 цагт сул. Аль нь тохирох вэ?', false, true, now()-interval '5 days 1 hour 54 minutes'),
    (v_conv3, 'Пүрэв 10 цагт', true, false, now()-interval '5 days 1 hour 50 minutes'),
    (v_conv3, 'Бүртгэлээ! Пүрэв гаригт 10:00 цагт гель маникюр. Тавтай морилно уу!', false, true, now()-interval '5 days 1 hour 49 minutes'),
    (v_conv3, 'Баярлалаа! Маш сайхан болсон 💅', true, false, now()-interval '3 days 12 hours');

  INSERT INTO appointments (store_id, customer_id, staff_id, service_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status)
    VALUES (v_store_id, v_cust3, v_staff1, v_svc, now()-interval '3 days'+interval '10 hours', 60, 'completed', 25000, 'Мөнхзул', '99667788', 'chat', v_conv3, 'paid');

  -- Conv4: Энхтуяа - Үнэ асуулт
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'closed', 'instagram', 0, now()-interval '6 days', now()-interval '6 days') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, 'Үйлчилгээний үнэ хэд хэд вэ?', true, false, now()-interval '6 days 3 hours'),
    (v_conv4, 'Манай үйлчилгээнүүд: Эрэгтэй үс засалт 15,000₮, Эмэгтэй үс засалт 25,000₮, Үс будалт 60,000₮, Маникюр 15,000₮, Гель маникюр 25,000₮, Нүүр цэвэрлэгээ 35,000₮, Биеийн массаж 45,000₮', false, true, now()-interval '6 days 3 hours'+interval '10 seconds'),
    (v_conv4, 'Нүүр цэвэрлэгээ + массаж хамт хийлгэвэл хөнгөлөлт байгаа юу?', true, false, now()-interval '6 days 2 hours 55 minutes'),
    (v_conv4, 'Хоёр үйлчилгээг хамт авбал 10% хөнгөлөлт үзүүлнэ. Нүүр цэвэрлэгээ + массаж = 72,000₮ (80,000₮-с). Цаг авах уу?', false, true, now()-interval '6 days 2 hours 54 minutes'),
    (v_conv4, 'За дараа авъя, баярлалаа', true, false, now()-interval '6 days 2 hours 50 minutes');

  -- Conv5: Гэрэлмаа - Цаг цуцлах
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust5, 'closed', 'messenger', 0, now()-interval '2 days', now()-interval '2 days') RETURNING id INTO v_conv5;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv5, 'Маргаашийн цагаа цуцлах гэсэн юм. Болох уу?', true, false, now()-interval '2 days 3 hours'),
    (v_conv5, 'Мэдээж! Таны нэр, утасны дугаарыг хэлнэ үү?', false, true, now()-interval '2 days 3 hours'+interval '8 seconds'),
    (v_conv5, 'Гэрэлмаа, 99112200', true, false, now()-interval '2 days 2 hours 55 minutes'),
    (v_conv5, 'Гэрэлмаа, маргааш 11:00 цагийн маникюр цагийг цуцаллаа. Дахин цаг авахыг хүсвэл мессеж бичнэ үү!', false, true, now()-interval '2 days 2 hours 54 minutes'),
    (v_conv5, 'За баярлалаа', true, false, now()-interval '2 days 2 hours 50 minutes');
END $$;

-- ═══════════════════════════════════════════════
-- 4. КОФЕ ХАУС (coffee_shop)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID;
  v_ord1 UUID; v_ord2 UUID;
  v_prod UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'kofe-haus';

  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE store_id = v_store_id);
  DELETE FROM orders WHERE store_id = v_store_id;
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Анхбаяр', '99776655', 'web') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Номин', '88665544', 'instagram') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Ундрах', '99445566', 'messenger') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Хишигбаяр', '88334422', 'web') RETURNING id INTO v_cust4;

  -- Conv1: Анхбаяр - Кофе захиалга
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'web', 0, now()-interval '2 days', now()-interval '2 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'Латте захиалъя, том хэмжээтэй', true, false, now()-interval '2 days 3 hours'),
    (v_conv1, 'Латте (том) - 7,500₮. Нэмэлт зүйл авах уу? Круассан 5,000₮, Чизкейк 9,000₮ байна.', false, true, now()-interval '2 days 3 hours'+interval '8 seconds'),
    (v_conv1, 'Круассан нэмнэ', true, false, now()-interval '2 days 2 hours 55 minutes'),
    (v_conv1, 'Латте (7,500₮) + Круассан (5,000₮) = 12,500₮. Захиалга бүртгэлээ! Дугаар: KH-001', false, true, now()-interval '2 days 2 hours 54 minutes');

  SELECT id INTO v_prod FROM products WHERE store_id = v_store_id AND name = 'Латте' LIMIT 1;
  INSERT INTO orders (id, store_id, customer_id, order_number, status, total_amount, payment_method, payment_status, created_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'KH-001', 'delivered', 12500, 'qpay', 'paid', now()-interval '2 days') RETURNING id INTO v_ord1;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (v_ord1, v_prod, 1, 7500);

  -- Conv2: Номин - Гомдол (кофе буруу ирсэн)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'closed', 'instagram', 0, 45, 'medium', now()-interval '4 days', now()-interval '4 days') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, 'Американо захиалсан юмаа, Моча ирсэн байна! Захиалга буруу хийсэн', true, false, now()-interval '4 days 2 hours'),
    (v_conv2, 'Уучлаарай! Захиалга солигдсонд харамсаж байна. Та манай дэлгүүрт байгаа бол шууд солих уу, эсвэл дахиад хүргэх үү?', false, true, now()-interval '4 days 2 hours'+interval '10 seconds'),
    (v_conv2, 'Дэлгүүрт байна, солиж өгөөч', true, false, now()-interval '4 days 1 hour 55 minutes'),
    (v_conv2, 'Тэгье! Кассанд хандана уу, шууд Американо хийж өгнө. Уучлаарай, нөхөн олговор болгож бялуу үнэгүй нэмнэ!', false, true, now()-interval '4 days 1 hour 54 minutes'),
    (v_conv2, 'За баярлалаа, бялуу амттай байсан 😄', true, false, now()-interval '4 days 1 hour');

  -- Conv3: Ундрах - Урьдчилсан захиалга
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'closed', 'messenger', 0, now()-interval '1 day', now()-interval '1 day') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, '10 хүнд кофе захиалах гэсэн юм, урьдчилж бэлдэж чадах уу?', true, false, now()-interval '1 day 5 hours'),
    (v_conv3, 'Тийм! 10 хүний захиалга авна. Ямар кофенууд хэрэгтэй вэ?', false, true, now()-interval '1 day 5 hours'+interval '10 seconds'),
    (v_conv3, '5 Американо, 3 Латте, 2 Капучино', true, false, now()-interval '1 day 4 hours 55 minutes'),
    (v_conv3, '5 Американо (30,000₮) + 3 Латте (22,500₮) + 2 Капучино (14,000₮) = 66,500₮. Хэзээ бэлэн болгох вэ?', false, true, now()-interval '1 day 4 hours 54 minutes'),
    (v_conv3, 'Маргааш өглөө 9 цагт', true, false, now()-interval '1 day 4 hours 50 minutes'),
    (v_conv3, 'Бүртгэлээ! Маргааш 9:00 цагт бэлэн байна. QPay-р төлөх үү?', false, true, now()-interval '1 day 4 hours 49 minutes'),
    (v_conv3, 'Тийм, QPay-р төлнө', true, false, now()-interval '1 day 4 hours 45 minutes');

  INSERT INTO orders (id, store_id, customer_id, order_number, status, total_amount, payment_method, payment_status, created_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'KH-002', 'confirmed', 66500, 'qpay', 'paid', now()-interval '1 day') RETURNING id INTO v_ord2;

  -- Conv4: Хишигбаяр - Цэсний асуулт
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'active', 'web', 1, now()-interval '3 hours', now()-interval '3 hours') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, 'Сүүгүй кофе байгаа юу? Сүүнд харшилтай', true, false, now()-interval '3 hours'),
    (v_conv4, 'Тийм! Американо, Ice Americano нь сүүгүй. Мөн Матча латтег соёны сүүгээр хийх боломжтой. Соёны сүү нэмэхэд +1,000₮.', false, true, now()-interval '3 hours'+interval '10 seconds'),
    (v_conv4, 'Соёны сүүтэй Матча латте хэд болох вэ?', true, false, now()-interval '2 hours 55 minutes');
END $$;
-- ═══════════════════════════════════════════════
-- 5. FITZONE GYM (fitness)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID;
  v_svc UUID; v_staff1 UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'fitzone-gym';

  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM appointments WHERE store_id = v_store_id;
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Баярсайхан', '99887744', 'web') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Мөнхбат', '88776655', 'messenger') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Алтанцэцэг', '99665533', 'instagram') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Ганбат', '88554411', 'web') RETURNING id INTO v_cust4;

  SELECT id INTO v_staff1 FROM staff WHERE store_id = v_store_id LIMIT 1;

  -- Conv1: Баярсайхан - Гишүүнчлэл асуулт
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name LIKE '%Сарын%' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'web', 0, now()-interval '5 days', now()-interval '5 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'Сайн байна уу, сарын гишүүнчлэл хэд вэ?', true, false, now()-interval '5 days 3 hours'),
    (v_conv1, 'Сайн байна уу! Сарын гишүүнчлэл 120,000₮. Үүнд бүх тренажерууд, бүлгийн хичээлүүд, шүршүүр орно. Усан сан тусдаа 10,000₮/удаа.', false, true, now()-interval '5 days 3 hours'+interval '10 seconds'),
    (v_conv1, 'Хувийн дасгалжуулагч авбал нэмж хэд вэ?', true, false, now()-interval '5 days 2 hours 55 minutes'),
    (v_conv1, 'Хувийн дасгал 1 цаг - 40,000₮. 7 хоногт 3 удаа авбал сард 480,000₮ (10% хөнгөлөлттэй 432,000₮). Гишүүнчлэл + хувийн дасгал = 552,000₮/сар.', false, true, now()-interval '5 days 2 hours 54 minutes'),
    (v_conv1, 'Зөвхөн гишүүнчлэл авъя', true, false, now()-interval '5 days 2 hours 50 minutes'),
    (v_conv1, 'Бүртгэлээ! Сарын гишүүнчлэл 120,000₮. QPay-р төлнө үү?', false, true, now()-interval '5 days 2 hours 49 minutes'),
    (v_conv1, 'Тийм', true, false, now()-interval '5 days 2 hours 45 minutes');

  -- Conv2: Мөнхбат - Гомдол (тренажер эвдэрсэн)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'closed', 'messenger', 0, 50, 'medium', now()-interval '3 days', now()-interval '3 days') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, 'Тренажерын зал дахь гүйдэг зам бүгд эвдэрсэн байна! 3 ширхэг нь ажиллахгүй. Сарын мөнгө төлж байгаа шүү дээ', true, false, now()-interval '3 days 4 hours'),
    (v_conv2, 'Уучлаарай, тренажерын асуудлыг мэдэгдэж байгаад баярлалаа. Техникийн баг шалгана. Ямар тренажерууд вэ?', false, true, now()-interval '3 days 4 hours'+interval '12 seconds'),
    (v_conv2, '2 давхрын гүйдэг зам 3 ширхэг бүгд. Өчигдөрөөс ажиллахгүй', true, false, now()-interval '3 days 3 hours 55 minutes'),
    (v_conv2, 'Ойлголоо, техникч өнөөдөр засна. Нөхөн олговор болгож таны гишүүнчлэлийг 3 хоног сунгалаа. Дахин уучлаарай!', false, true, now()-interval '3 days 3 hours 54 minutes'),
    (v_conv2, 'За ойлголоо, маргааш ирэхэд засарсан байгаарай', true, false, now()-interval '3 days 3 hours 50 minutes');

  -- Conv3: Алтанцэцэг - Йога хичээл бүртгүүлэх
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name LIKE '%Йога%' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'closed', 'instagram', 0, now()-interval '2 days', now()-interval '2 days') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, 'Йога хичээл хэзээ болдог вэ?', true, false, now()-interval '2 days 3 hours'),
    (v_conv3, 'Йога хичээл Даваа, Лхагва, Баасан гаригт 18:00-19:00 цагт болно. 1 удаа 15,000₮. Бүртгүүлэх үү?', false, true, now()-interval '2 days 3 hours'+interval '8 seconds'),
    (v_conv3, 'Баасан гаригт бүртгүүлнэ', true, false, now()-interval '2 days 2 hours 55 minutes'),
    (v_conv3, 'Баасан 18:00 цагт йога хичээлд бүртгэлээ! Дасгалын хувцас, бариулын алчуур авчрахаа мартуузай.', false, true, now()-interval '2 days 2 hours 54 minutes');

  INSERT INTO appointments (store_id, customer_id, staff_id, service_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status)
    VALUES (v_store_id, v_cust3, v_staff1, v_svc, now()-interval '0 days'+interval '18 hours', 60, 'pending', 15000, 'Алтанцэцэг', '99665533', 'instagram', v_conv3, 'pending');

  -- Conv4: Ганбат - Усан сан асуулт
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'active', 'web', 1, now()-interval '5 hours', now()-interval '5 hours') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, 'Усан сан гишүүнчлэлд ордог уу?', true, false, now()-interval '5 hours'),
    (v_conv4, 'Усан сан гишүүнчлэлд ордоггүй, тусдаа 10,000₮/удаа. 10 удаагийн абонемент 80,000₮ (20% хөнгөлөлт).', false, true, now()-interval '5 hours'+interval '8 seconds'),
    (v_conv4, 'Хүүхэд оруулж болох уу?', true, false, now()-interval '4 hours 55 minutes');
END $$;

-- ═══════════════════════════════════════════════
-- 6. УХААНАЙ СУРГАЛТ (education)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID;
  v_svc UUID; v_staff1 UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'ukhaanai-surgalt';

  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM appointments WHERE store_id = v_store_id;
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Тамир', '99112277', 'web') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Оюунтуяа', '88223388', 'messenger') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Цэнд-Аюуш', '99334499', 'instagram') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Сувдаа', '88445500', 'web') RETURNING id INTO v_cust4;

  SELECT id INTO v_staff1 FROM staff WHERE store_id = v_store_id LIMIT 1;

  -- Conv1: Тамир - IELTS бэлтгэл асуулт
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name LIKE '%IELTS%' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'web', 0, now()-interval '4 days', now()-interval '4 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'IELTS бэлтгэл хичээл хэзээ эхлэх вэ? Одоогийн оноо 5.5', true, false, now()-interval '4 days 3 hours'),
    (v_conv1, 'IELTS бэлтгэл сар бүрийн 1, 15-нд шинэ бүлэг эхэлнэ. 350,000₮/сар, 7 хоногт 3 удаа, 90 мин. 5.5 оноотой бол 6.5+ зорилтот бүлэгт тохирно.', false, true, now()-interval '4 days 3 hours'+interval '10 seconds'),
    (v_conv1, 'Дараа сарын 1-нд бүртгүүлэх гэсэн юм', true, false, now()-interval '4 days 2 hours 55 minutes'),
    (v_conv1, 'Бүртгэлээ! IELTS бэлтгэл, 2-р сарын 1-с эхэлнэ. Урьдчилгаа 100,000₮ шилжүүлнэ үү?', false, true, now()-interval '4 days 2 hours 54 minutes'),
    (v_conv1, 'Тийм, QPay-р шилжүүлнэ', true, false, now()-interval '4 days 2 hours 50 minutes'),
    (v_conv1, 'Баярлалаа! Бүртгэл амжилттай. Анхны хичээлд дэвтэр, үзэг авчрана уу.', false, true, now()-interval '4 days 2 hours 49 minutes');

  INSERT INTO appointments (store_id, customer_id, staff_id, service_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status)
    VALUES (v_store_id, v_cust1, v_staff1, v_svc, now()+interval '1 day'+interval '10 hours', 90, 'confirmed', 350000, 'Тамир', '99112277', 'chat', v_conv1, 'paid');

  -- Conv2: Оюунтуяа - Хүүхдийн англи хэлний хичээл
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name LIKE '%Англи%' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'closed', 'messenger', 0, now()-interval '6 days', now()-interval '6 days') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, 'Хүүхдэд зориулсан англи хэлний хичээл байгаа юу? 10 настай', true, false, now()-interval '6 days 2 hours'),
    (v_conv2, 'Англи хэл (Эхлэгч) хичээл байна. 180,000₮/сар, 7 хоногт 2 удаа, 90 мин. 8-12 насны хүүхдэд тохиромжтой.', false, true, now()-interval '6 days 2 hours'+interval '10 seconds'),
    (v_conv2, 'Хичээл хэзээ болдог вэ?', true, false, now()-interval '6 days 1 hour 55 minutes'),
    (v_conv2, 'Мягмар, Пүрэв гаригт 16:00-17:30 цагт. Туршилтын хичээл үнэгүй авах боломжтой!', false, true, now()-interval '6 days 1 hour 54 minutes'),
    (v_conv2, 'Туршилтын хичээл авъя. Мягмар гарагт болох уу?', true, false, now()-interval '6 days 1 hour 50 minutes'),
    (v_conv2, 'Тийм! Ирэх Мягмар 16:00 цагт туршилтын хичээлд бүртгэлээ. Хүүхдийн нэр хэлнэ үү?', false, true, now()-interval '6 days 1 hour 49 minutes'),
    (v_conv2, 'Тэмүүжин', true, false, now()-interval '6 days 1 hour 45 minutes');

  -- Conv3: Цэнд-Аюуш - Гомдол (багш сольсон)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'closed', 'instagram', 0, 55, 'medium', now()-interval '2 days', now()-interval '2 days') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, 'Багш сольсон байна! Өмнөх багш маш сайн зааж байсан, яагаад солисон бэ? Мөнгөө буцааж өгөөч', true, false, now()-interval '2 days 4 hours'),
    (v_conv3, 'Уучлаарай, багш хувийн шалтгааны улмаас завсарлагаа авсан. Шинэ багш мөн адил туршлагатай. Туршиж үзээд таарахгүй бол буцаан олговор хийнэ.', false, true, now()-interval '2 days 4 hours'+interval '12 seconds'),
    (v_conv3, 'Нэг долоо хоног туршиж үзье. Таарахгүй бол цуцална шүү', true, false, now()-interval '2 days 3 hours 55 minutes'),
    (v_conv3, 'Тийм ээ, ойлголоо. 1 долоо хоногийн дараа мэдэгдэнэ үү? Асуулт байвал мессеж бичээрэй!', false, true, now()-interval '2 days 3 hours 54 minutes'),
    (v_conv3, 'За', true, false, now()-interval '2 days 3 hours 50 minutes');

  -- Conv4: Сувдаа - Python хичээл
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'active', 'web', 1, now()-interval '8 hours', now()-interval '8 hours') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, 'Python програмчлалын хичээлд бүртгүүлэх гэсэн юм. Эхлэгч байж болох уу?', true, false, now()-interval '8 hours'),
    (v_conv4, 'Мэдээж! Python програмчлал хичээл эхлэгчдэд зориулсан. 250,000₮/сар, 7 хоногт 2 удаа, 120 мин. Компьютер авчрах шаардлагатай.', false, true, now()-interval '8 hours'+interval '10 seconds'),
    (v_conv4, 'Ноутбүүк байхгүй бол?', true, false, now()-interval '7 hours 55 minutes');
END $$;

-- ═══════════════════════════════════════════════
-- 7. ИНЭЭМСЭГЛЭЛ ШҮДНИЙ (dental_clinic)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID;
  v_svc UUID; v_staff1 UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'ineemseglel-dental';

  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM appointments WHERE store_id = v_store_id;
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Батжаргал', '99001155', 'messenger') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Нансалмаа', '88112266', 'web') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Эрдэнэбат', '99223377', 'messenger') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Туяа', '88334488', 'instagram') RETURNING id INTO v_cust4;

  SELECT id INTO v_staff1 FROM staff WHERE store_id = v_store_id LIMIT 1;

  -- Conv1: Батжаргал - Шүд өвдөж байна яаралтай
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name = 'Шүдний үзлэг' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'messenger', 0, now()-interval '3 days', now()-interval '3 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'Шүд маш их өвдөж байна, өнөөдөр үзүүлж болох уу?', true, false, now()-interval '3 days 5 hours'),
    (v_conv1, 'Өнөөдөр 14:30 цагт сул цаг байна. Шүдний үзлэг 15,000₮. Ирж чадах уу?', false, true, now()-interval '3 days 5 hours'+interval '8 seconds'),
    (v_conv1, 'Тийм ирнэ. Өвдөлт намдаах эм уусан болох уу?', true, false, now()-interval '3 days 4 hours 55 minutes'),
    (v_conv1, 'Парацетамол уух боломжтой. Гэхдээ аспирин ууж болохгүй (цус тогтоохгүй). 14:30 цагт ирнэ үү, ямар шүд вэ?', false, true, now()-interval '3 days 4 hours 54 minutes'),
    (v_conv1, 'Доод талын баруун араа. Батжаргал, 99001155', true, false, now()-interval '3 days 4 hours 50 minutes'),
    (v_conv1, 'Бүртгэлээ! 14:30 цагт ирнэ үү. Өвдөлт хүчтэй бол яаралтай ирж болно.', false, true, now()-interval '3 days 4 hours 49 minutes');

  INSERT INTO appointments (store_id, customer_id, staff_id, service_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status)
    VALUES (v_store_id, v_cust1, v_staff1, v_svc, now()-interval '3 days'+interval '14 hours 30 minutes', 30, 'completed', 15000, 'Батжаргал', '99001155', 'messenger', v_conv1, 'paid');

  -- Conv2: Нансалмаа - Шүд цайруулах үнэ
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'closed', 'web', 0, now()-interval '5 days', now()-interval '5 days') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, 'Шүд цайруулах хэд вэ? Хэр удаан болдог вэ?', true, false, now()-interval '5 days 2 hours'),
    (v_conv2, 'Шүд цайруулах 120,000₮, 1 цаг орчим. Zoom цайруулалт хийнэ. Үр дүн 2-3 жил хадгалагдана.', false, true, now()-interval '5 days 2 hours'+interval '10 seconds'),
    (v_conv2, 'Өвдөлттэй юу?', true, false, now()-interval '5 days 1 hour 55 minutes'),
    (v_conv2, 'Бага зэрэг мэдрэмжтэй байж болно. Процедурын дараа 24 цаг кофе, цай, өнгөтэй хоол хязгаарлана. Цаг авах уу?', false, true, now()-interval '5 days 1 hour 54 minutes'),
    (v_conv2, 'Ирэх долоо хоногт авъя', true, false, now()-interval '5 days 1 hour 50 minutes');

  -- Conv3: Эрдэнэбат - Гомдол (ломбо унасан)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'active', 'messenger', 2, 60, 'high', now()-interval '1 day', now()-interval '1 day') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, '2 долоо хоногийн өмнө тавиулсан ломбо унасан байна! Мөнгө төлж тавиулсан юм чинь', true, false, now()-interval '1 day 4 hours'),
    (v_conv3, 'Уучлаарай! Ломбо 2 долоо хоногт унах ёсгүй. Баталгаат хугацаандаа байгаа тул үнэгүй дахин тавина. Хэзээ ирж чадах вэ?', false, true, now()-interval '1 day 4 hours'+interval '10 seconds'),
    (v_conv3, 'Энэ удаад сайн бэхлээрэй. Маргааш ирнэ', true, false, now()-interval '1 day 3 hours 55 minutes'),
    (v_conv3, 'Мэдээж, маргааш ахлах эмч өөрөө хийнэ. Хэдэн цагт тохирох вэ?', false, true, now()-interval '1 day 3 hours 54 minutes'),
    (v_conv3, '11 цагт', true, false, now()-interval '1 day 3 hours 50 minutes'),
    (v_conv3, 'Маргааш 11:00 цагт бүртгэлээ. Баталгаат засвар тул үнэгүй. Уучлаарай!', false, true, now()-interval '1 day 3 hours 49 minutes');

  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name = 'Ломбо тавих' LIMIT 1;
  INSERT INTO appointments (store_id, customer_id, staff_id, service_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status, notes)
    VALUES (v_store_id, v_cust3, v_staff1, v_svc, now()+interval '11 hours', 45, 'confirmed', 0, 'Эрдэнэбат', '99223377', 'messenger', v_conv3, 'pending', 'Баталгаат засвар - ломбо унасан');

  -- Conv4: Туяа - Хүүхдийн шүдний үзлэг
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'active', 'instagram', 1, now()-interval '6 hours', now()-interval '6 hours') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, '5 настай хүүхдийн шүд үзүүлэх гэсэн юм', true, false, now()-interval '6 hours'),
    (v_conv4, 'Хүүхдийн шүдний үзлэг 10,000₮, 20 минут. Хүүхдийн эмч Даваа-Пүрэв ажилладаг. Цаг авах уу?', false, true, now()-interval '6 hours'+interval '8 seconds'),
    (v_conv4, 'Хүүхэд эмчээс айдаг, яаж болох вэ?', true, false, now()-interval '5 hours 55 minutes');
END $$;
-- ═══════════════════════════════════════════════
-- 8. GREEN HOME REALTY (real_estate)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'green-home-realty';

  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Баатарсүрэн', '99334466', 'messenger') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Мөнхтуяа', '88445577', 'web') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Ганбаатар', '99556688', 'messenger') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Цэрмаа', '88667799', 'instagram') RETURNING id INTO v_cust4;

  -- Conv1: Баатарсүрэн - 2 өрөө орон сууц хайж байна
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'messenger', 0, now()-interval '5 days', now()-interval '5 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'Сайн байна уу, 2 өрөө орон сууц хайж байна. Баянгол дүүрэгт байгаа юу?', true, false, now()-interval '5 days 4 hours'),
    (v_conv1, 'Сайн байна уу! Баянголд 2 өрөө орон сууц байна: 95,000,000₮, 56м², 2024 оны шинэ барилга. Дэлгэрэнгүй мэдээлэл авах уу?', false, true, now()-interval '5 days 4 hours'+interval '10 seconds'),
    (v_conv1, 'Тийм, зураг байгаа юу? Мөн хэдэн давхарт вэ?', true, false, now()-interval '5 days 3 hours 55 minutes'),
    (v_conv1, '7 давхарт, цонхоор наран тусна. Зураг илгээж байна. Үзэхэд ирж чадах уу?', false, true, now()-interval '5 days 3 hours 54 minutes'),
    (v_conv1, 'Маргааш үзэхэд ирж болох уу?', true, false, now()-interval '5 days 3 hours 50 minutes'),
    (v_conv1, 'Тийм! Маргааш 14:00 цагт уулзъя. Хаяг: Баянгол дүүрэг, 16-р хороо, Оргил резиденс. Утас: Баатарсүрэн 99334466', false, true, now()-interval '5 days 3 hours 49 minutes'),
    (v_conv1, 'За тэгье', true, false, now()-interval '5 days 3 hours 45 minutes');

  -- Conv2: Мөнхтуяа - Түрээс хайж байна
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'closed', 'web', 0, now()-interval '3 days', now()-interval '3 days') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, '1 өрөө түрээс хайж байна, ХУД эсвэл БЗД-д', true, false, now()-interval '3 days 2 hours'),
    (v_conv2, 'ХУД-д 1 өрөө түрээс байна: 650,000₮/сар, 35м², тавилгатай, цэвэр засвартай. Интернет, ус, дулааны төлбөр тусдаа.', false, true, now()-interval '3 days 2 hours'+interval '10 seconds'),
    (v_conv2, 'Тавилга юу юу байгаа вэ?', true, false, now()-interval '3 days 1 hour 55 minutes'),
    (v_conv2, 'Ор, шүүгээ, хөргөгч, угаалгын машин, ширээ, сандал. Зурагтай шүү, үзмээр юу?', false, true, now()-interval '3 days 1 hour 54 minutes'),
    (v_conv2, 'Тийм, мөн гэрээний нөхцөл юу вэ?', true, false, now()-interval '3 days 1 hour 50 minutes'),
    (v_conv2, '1 жилийн гэрээ, 2 сарын барьцаа (1,300,000₮). Нүүх өдрөөс 3 хоногийн өмнө мэдэгдэнэ. Үзэхэд ирэх үү?', false, true, now()-interval '3 days 1 hour 49 minutes'),
    (v_conv2, 'Ирэх долоо хоногт ирье. Баярлалаа!', true, false, now()-interval '3 days 1 hour 45 minutes');

  -- Conv3: Ганбаатар - Гомдол (зурагнаас өөр)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'active', 'messenger', 2, 65, 'high', now()-interval '1 day', now()-interval '1 day') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, 'Зарлагдсан орон сууц дээр очиход зурагнаас огт өөр байсан! Засвар хийгээгүй, хуучин байсан. Хуурамч зар тавьж байна уу?', true, false, now()-interval '1 day 5 hours'),
    (v_conv3, 'Уучлаарай, зурагны мэдээлэл буруу байсанд харамсаж байна. Ямар зарыг хэлж байна вэ? Шалгая.', false, true, now()-interval '1 day 5 hours'+interval '12 seconds'),
    (v_conv3, '3 өрөө Сүхбаатар дүүрэг гэсэн 180 сая-тай нь. Очиход засвар хийгээгүй, зураг нь хуучин байсан', true, false, now()-interval '1 day 4 hours 55 minutes'),
    (v_conv3, 'Ойлголоо, энэ зарыг шалгана. Магадгүй эзэн хоорондоо засвар хийсэн байж болно. Нөхөн олговор болгож таньд тохирох өөр санал илгээх үү?', false, true, now()-interval '1 day 4 hours 54 minutes'),
    (v_conv3, 'Тохирох зар байвал илгээгээрэй. Гэхдээ зурагтай ижил байх ёстой шүү!', true, false, now()-interval '1 day 4 hours 50 minutes'),
    (v_conv3, 'Мэдээж! Зурагтай бүрэн таарсан 3 шинэ санал илгээнэ. Дахин уучлаарай.', false, true, now()-interval '1 day 4 hours 49 minutes');

  -- Conv4: Цэрмаа - Оффис түрээс
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'active', 'instagram', 1, now()-interval '4 hours', now()-interval '4 hours') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, 'Оффис түрээслэхэд байгаа юу? 50-80м² орчим', true, false, now()-interval '4 hours'),
    (v_conv4, 'Чингэлтэй дүүрэгт 120м² оффис байна, 250,000,000₮. Хуваалцсан оффис бол сард 800,000₮-с байна.', false, true, now()-interval '4 hours'+interval '10 seconds'),
    (v_conv4, 'Хуваалцсан оффис дэлгэрэнгүй хэлнэ үү?', true, false, now()-interval '3 hours 55 minutes');
END $$;

-- ═══════════════════════════════════════════════
-- 9. ХУСТАЙ КЕМПИНГ (camping_guesthouse)
-- ═══════════════════════════════════════════════
DO $$
DECLARE
  v_store_id UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID; v_cust5 UUID;
  v_conv1 UUID; v_conv2 UUID; v_conv3 UUID; v_conv4 UUID; v_conv5 UUID;
  v_svc UUID; v_staff1 UUID;
  v_res1 UUID; v_res2 UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'khustai-camping';

  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE store_id = v_store_id);
  DELETE FROM appointments WHERE store_id = v_store_id;
  DELETE FROM conversations WHERE store_id = v_store_id;
  DELETE FROM customers WHERE store_id = v_store_id;

  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Дөлгөөн', '99887711', 'web') RETURNING id INTO v_cust1;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Хүрэлбаатар', '88776622', 'messenger') RETURNING id INTO v_cust2;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Нарантуяа', '99665533', 'instagram') RETURNING id INTO v_cust3;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Мягмар', '88554444', 'web') RETURNING id INTO v_cust4;
  INSERT INTO customers (id, store_id, name, phone, channel) VALUES
    (gen_random_uuid(), v_store_id, 'Энхжин', '99443355', 'messenger') RETURNING id INTO v_cust5;

  SELECT id INTO v_staff1 FROM staff WHERE store_id = v_store_id LIMIT 1;
  SELECT id INTO v_res1 FROM bookable_resources WHERE store_id = v_store_id AND name LIKE '%Люкс%гэр%' LIMIT 1;
  SELECT id INTO v_res2 FROM bookable_resources WHERE store_id = v_store_id AND name LIKE '%Модон%' LIMIT 1;

  -- Conv1: Дөлгөөн - Гэр захиалга + морь унах
  SELECT id INTO v_svc FROM services WHERE store_id = v_store_id AND name LIKE '%Морь%' LIMIT 1;
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust1, 'closed', 'web', 0, now()-interval '6 days', now()-interval '6 days') RETURNING id INTO v_conv1;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv1, 'Сайн байна уу, 2 хүн Монгол гэрт хонохоор захиалга хийх гэсэн', true, false, now()-interval '6 days 3 hours'),
    (v_conv1, 'Сайн байна уу! Монгол гэр (Стандарт) 80,000₮/шөнө, 2 хүн. Люкс гэр 120,000₮/шөнө, 4 хүн хүртэл. Хэзээ ирэх вэ?', false, true, now()-interval '6 days 3 hours'+interval '10 seconds'),
    (v_conv1, 'Ирэх Баасан-Бямба 2 шөнө. Люкс гэр авъя', true, false, now()-interval '6 days 2 hours 55 minutes'),
    (v_conv1, 'Люкс гэр 2 шөнө = 240,000₮. Морь унах (30,000₮), сур харвалт (20,000₮), кэмпфайр (10,000₮) нэмж захиалах уу?', false, true, now()-interval '6 days 2 hours 54 minutes'),
    (v_conv1, 'Морь унах нэмнэ. Нийт хэд болох вэ?', true, false, now()-interval '6 days 2 hours 50 minutes'),
    (v_conv1, 'Люкс гэр 2 шөнө (240,000₮) + Морь унах (30,000₮) = 270,000₮. Захиалга бүртгэлээ! Нэр, утас хэлнэ үү.', false, true, now()-interval '6 days 2 hours 49 minutes'),
    (v_conv1, 'Дөлгөөн, 99887711', true, false, now()-interval '6 days 2 hours 45 minutes'),
    (v_conv1, 'Баярлалаа Дөлгөөн! Баасан гаригт тавтай морилно уу. Замын зааварчилгаа: УБ-с баруун тийш 100км, Хустайн нурууны чиглэл.', false, true, now()-interval '6 days 2 hours 44 minutes');

  INSERT INTO appointments (store_id, customer_id, staff_id, resource_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status, check_in_date, check_out_date, party_size)
    VALUES (v_store_id, v_cust1, v_staff1, v_res1, now()-interval '4 days'+interval '14 hours', 2880, 'completed', 270000, 'Дөлгөөн', '99887711', 'chat', v_conv1, 'paid', (now()-interval '4 days')::date, (now()-interval '2 days')::date, 2);

  -- Conv2: Хүрэлбаатар - Гомдол (гэр бохир байсан)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, escalation_score, escalation_level, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust2, 'closed', 'messenger', 0, 60, 'high', now()-interval '3 days', now()-interval '3 days') RETURNING id INTO v_conv2;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv2, 'Дөнгөж ирлээ, гэр маш бохир байна! Дэвсгэр хуучин, шороотой. 80,000 төлсөн юм чинь энэ юу вэ?', true, false, now()-interval '3 days 5 hours'),
    (v_conv2, 'Маш их уучлаарай! Ажилтан очиж цэвэрлэнэ. 15 минутад бэлэн болно. Нөхөн олговор болгож оройн кэмпфайр үнэгүй.', false, true, now()-interval '3 days 5 hours'+interval '10 seconds'),
    (v_conv2, 'Дэвсгэр солиод өгөөч, маш хуучин байна', true, false, now()-interval '3 days 4 hours 55 minutes'),
    (v_conv2, 'Тийм ээ, шинэ дэвсгэр авчирна. 10 минутад очно. Дахин уучлаарай, цаашид анхаарна.', false, true, now()-interval '3 days 4 hours 54 minutes'),
    (v_conv2, 'За дэвсгэр сольсон, одоо зүгээр. Гэхдээ эхнээсээ цэвэрхэн байх ёстой байсан', true, false, now()-interval '3 days 4 hours'),
    (v_conv2, 'Зөв хэлж байна. Дахин ийм зүйл давтахгүй. Кэмпфайр оройн 20:00 цагт, тавтай морилно уу!', false, true, now()-interval '3 days 3 hours 59 minutes');

  -- Conv3: Нарантуяа - Бүлгийн захиалга (10 хүн)
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust3, 'active', 'instagram', 1, now()-interval '1 day', now()-interval '1 day') RETURNING id INTO v_conv3;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv3, '10 хүний бүлгээр очих гэсэн юм. Хэр зарцуулах вэ?', true, false, now()-interval '1 day 4 hours'),
    (v_conv3, '10 хүнд: 2 Монгол гэр (Стандарт) + 1 Модон байшин санал болгоно. 2 гэр (160,000₮) + Модон байшин (150,000₮) = 310,000₮/шөнө. Хэдэн шөнө байх вэ?', false, true, now()-interval '1 day 4 hours'+interval '12 seconds'),
    (v_conv3, '2 шөнө. Бүлгийн хөнгөлөлт байгаа юу?', true, false, now()-interval '1 day 3 hours 55 minutes'),
    (v_conv3, '10+ хүний бүлэгт 15% хөнгөлөлт! 310,000 x 2 = 620,000₮ → 527,000₮. Морь, сур харвалт нэмэх үү?', false, true, now()-interval '1 day 3 hours 54 minutes'),
    (v_conv3, 'Морь унах 10 хүнд хэд болох вэ?', true, false, now()-interval '1 day 3 hours 50 minutes');

  -- Conv4: Мягмар - Майхны талбай асуулт
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust4, 'closed', 'web', 0, now()-interval '7 days', now()-interval '7 days') RETURNING id INTO v_conv4;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv4, 'Өөрийн майхантай очвол хэд вэ?', true, false, now()-interval '7 days 2 hours'),
    (v_conv4, 'Майхны талбай 15,000₮/шөнө, 4 хүн хүртэл. Шүршүүр, ариун цэврийн өрөө ойрхон. Гал зуух бас байна.', false, true, now()-interval '7 days 2 hours'+interval '8 seconds'),
    (v_conv4, 'Машин зогсоол байгаа юу?', true, false, now()-interval '7 days 1 hour 55 minutes'),
    (v_conv4, 'Тийм, үнэгүй зогсоол байна. Майхны талбайн хажууд машинаа зогсоож болно.', false, true, now()-interval '7 days 1 hour 54 minutes'),
    (v_conv4, 'За сайн байна, ирэх амралтын өдөр очно', true, false, now()-interval '7 days 1 hour 50 minutes'),
    (v_conv4, 'Тавтай морилно уу! Урьдчилж захиалга хийвэл талбай баталгаажна. Мессеж бичээрэй!', false, true, now()-interval '7 days 1 hour 49 minutes');

  -- Conv5: Энхжин - Модон байшин захиалга
  INSERT INTO conversations (id, store_id, customer_id, status, channel, unread_count, created_at, updated_at)
    VALUES (gen_random_uuid(), v_store_id, v_cust5, 'closed', 'messenger', 0, now()-interval '2 days', now()-interval '2 days') RETURNING id INTO v_conv5;
  INSERT INTO messages (conversation_id, content, is_from_customer, is_ai_response, created_at) VALUES
    (v_conv5, 'Модон байшин захиалах гэсэн юм. 4 хүн, 3 шөнө', true, false, now()-interval '2 days 3 hours'),
    (v_conv5, 'Модон байшин 150,000₮/шөнө, 4 хүн хүртэл. 3 шөнө = 450,000₮. Хэзээ ирэх вэ?', false, true, now()-interval '2 days 3 hours'+interval '8 seconds'),
    (v_conv5, 'Ирэх Пүрэв-Ням', true, false, now()-interval '2 days 2 hours 55 minutes'),
    (v_conv5, 'Пүрэв-Ням 3 шөнө, Модон байшин бүртгэлээ. QPay-р төлнө үү?', false, true, now()-interval '2 days 2 hours 54 minutes'),
    (v_conv5, 'Тийм, одоо төлнө', true, false, now()-interval '2 days 2 hours 50 minutes'),
    (v_conv5, 'Баярлалаа! Захиалга баталгаажлаа. Пүрэв гарагт 14:00 цагаас check-in хийнэ. Замын чиглэл илгээнэ!', false, true, now()-interval '2 days 2 hours 49 minutes');

  INSERT INTO appointments (store_id, customer_id, staff_id, resource_id, scheduled_at, duration_minutes, status, total_amount, customer_name, customer_phone, source, conversation_id, payment_status, check_in_date, check_out_date, party_size)
    VALUES (v_store_id, v_cust5, v_staff1, v_res2, now()+interval '2 days'+interval '14 hours', 4320, 'confirmed', 450000, 'Энхжин', '99443355', 'messenger', v_conv5, 'paid', (now()+interval '2 days')::date, (now()+interval '5 days')::date, 4);
END $$;
