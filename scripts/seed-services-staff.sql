-- Auto-generated seed data for services, staff, and bookable_resources.
-- Run this in Supabase SQL Editor (these tables are not in PostgREST schema cache).

-- Reload schema cache first
NOTIFY pgrst, 'reload schema';

-- === Номин Ресторан (restaurant) ===
DELETE FROM staff WHERE store_id = '5ff9f468-5066-4716-9496-bae77ea1bb80';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('5ff9f468-5066-4716-9496-bae77ea1bb80', 'Батбаяр', '99001001', 'batbayar@nomin.mn', ARRAY['менежер'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('5ff9f468-5066-4716-9496-bae77ea1bb80', 'Оюунцэцэг', '99001002', 'oyunaa@nomin.mn', ARRAY['тогооч'], 'active');
DELETE FROM bookable_resources WHERE store_id = '5ff9f468-5066-4716-9496-bae77ea1bb80';
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('5ff9f468-5066-4716-9496-bae77ea1bb80', 'table', 'Ширээ 1', 'Цонхны дэргэдэх 2 хүний ширээ', 2, 0, '{"window_view":true}', '[]', 'available', 0);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('5ff9f468-5066-4716-9496-bae77ea1bb80', 'table', 'Ширээ 2', '4 хүний ширээ', 4, 0, '{}', '[]', 'available', 1);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('5ff9f468-5066-4716-9496-bae77ea1bb80', 'table', 'Ширээ 3', '4 хүний ширээ', 4, 0, '{}', '[]', 'available', 2);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('5ff9f468-5066-4716-9496-bae77ea1bb80', 'table', 'Ширээ 4 (VIP)', 'Хувийн өрөө, 6 хүн', 6, 0, '{"private_room":true}', '[]', 'available', 3);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('5ff9f468-5066-4716-9496-bae77ea1bb80', 'table', 'Ширээ 5 (Том)', '10 хүний том ширээ', 10, 0, '{}', '[]', 'available', 4);

-- === Эрүүл Амьдрал Эмнэлэг (hospital) ===
DELETE FROM services WHERE store_id = '1b99fdca-bb72-4c85-8b77-507587ca4c27';
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Ерөнхий үзлэг', 'Ерөнхий нарийн мэргэжлийн эмчийн үзлэг', 'Ерөнхий үзлэг', 30, 25000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Цусны ерөнхий шинжилгээ', 'CBC шинжилгээ, хариу 2 цагт гарна', 'Лаборатори', 15, 15000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Нүдний үзлэг', 'Нүдний харааны шалгалт, оношилгоо', 'Нүдний тасаг', 30, 30000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Дотрын эмчийн үзлэг', 'Дотрын нарийн мэргэжлийн эмчийн үзлэг', 'Дотрын тасаг', 30, 35000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Хүүхдийн үзлэг', 'Хүүхдийн нарийн мэргэжлийн эмчийн үзлэг', 'Хүүхдийн тасаг', 30, 30000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'ЭХО шинжилгээ', 'Хэвлийн ЭХО шинжилгээ', 'Лаборатори', 20, 35000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Зүрхний ЭКГ', 'Зүрхний цахилгаан бичлэг', 'Дотрын тасаг', 15, 20000, 'active', NULL, '[]');
DELETE FROM staff WHERE store_id = '1b99fdca-bb72-4c85-8b77-507587ca4c27';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Д. Болормаа', '99002001', 'bolormaa@eruul.mn', ARRAY['Ерөнхий үзлэг','Дотрын тасаг'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Э. Батсүх', '99002002', 'batsukh@eruul.mn', ARRAY['Нүдний тасаг'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('1b99fdca-bb72-4c85-8b77-507587ca4c27', 'Н. Сарантуяа', '99002003', 'sarantuya@eruul.mn', ARRAY['Хүүхдийн тасаг'], 'active');

-- === Bella Beauty Salon (beauty_salon) ===
DELETE FROM services WHERE store_id = 'a654accd-0b6c-4005-b1d3-759f10534cce';
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Эмэгтэй үс засалт', 'Эмэгтэй үс засалт, загвар', 'Үсчин', 60, 25000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Эрэгтэй үс засалт', 'Эрэгтэй үс засалт', 'Үсчин', 30, 15000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Үс будалт', 'Үс будах, өнгө сонголттой', 'Үсчин', 120, 60000, 'active', 'Богино: 45,000₮, Дунд: 60,000₮, Урт: 80,000₮', '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Маникюр', 'Маникюр, лак түрхэлт', 'Маникюр/Педикюр', 45, 15000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Гель маникюр', 'Гель лак маникюр, загвартай', 'Маникюр/Педикюр', 60, 25000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Нүүр цэвэрлэгээ', 'Нүүрний гүнзгий цэвэрлэгээ', 'Нүүр арчилгаа', 60, 35000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Биеийн массаж', 'Бүх биеийн тайвшруулах массаж', 'Массаж', 60, 45000, 'active', NULL, '[]');
DELETE FROM staff WHERE store_id = 'a654accd-0b6c-4005-b1d3-759f10534cce';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Ану', '99003001', 'anu@bella.mn', ARRAY['Үсчин'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Сэлэнгэ', '99003002', 'selenge@bella.mn', ARRAY['Маникюр/Педикюр','Нүүр арчилгаа'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('a654accd-0b6c-4005-b1d3-759f10534cce', 'Нандин', '99003003', 'nandin@bella.mn', ARRAY['Массаж'], 'active');

-- === Кофе Хаус (coffee_shop) ===
DELETE FROM staff WHERE store_id = 'e90252aa-68ee-497e-b93b-dfecae929b13';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('e90252aa-68ee-497e-b93b-dfecae929b13', 'Тэмүүлэл', '99004001', 'temuulel@kofe.mn', ARRAY['бариста'], 'active');

-- === FitZone Gym (fitness) ===
DELETE FROM services WHERE store_id = '82e064c6-e108-4453-84f3-abe4d6871563';
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('82e064c6-e108-4453-84f3-abe4d6871563', 'Хувийн дасгал (1 цаг)', 'Хувийн дасгалжуулагчтай 1 цагийн хичээл', 'Хувийн дасгал', 60, 40000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('82e064c6-e108-4453-84f3-abe4d6871563', 'Йога хичээл', 'Бүлгийн йога хичээл', 'Йога', 60, 15000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('82e064c6-e108-4453-84f3-abe4d6871563', 'Пилатес', 'Бүлгийн пилатес хичээл', 'Бүлгийн хичээл', 50, 15000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('82e064c6-e108-4453-84f3-abe4d6871563', 'Кроссфит', 'Бүлгийн кроссфит хичээл', 'Бүлгийн хичээл', 45, 12000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('82e064c6-e108-4453-84f3-abe4d6871563', 'Усан сан (1 удаа)', 'Усан сангийн 1 удаагийн эрх', 'Усан сан', 60, 10000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('82e064c6-e108-4453-84f3-abe4d6871563', 'Сарын гишүүнчлэл', '1 сарын бүрэн гишүүнчлэл', 'Гишүүнчлэл', 0, 120000, 'active', NULL, '[]');
DELETE FROM staff WHERE store_id = '82e064c6-e108-4453-84f3-abe4d6871563';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('82e064c6-e108-4453-84f3-abe4d6871563', 'Төмөр', '99005001', 'tomor@fitzone.mn', ARRAY['Хувийн дасгал','Кроссфит'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('82e064c6-e108-4453-84f3-abe4d6871563', 'Солонго', '99005002', 'solongo@fitzone.mn', ARRAY['Йога','Пилатес'], 'active');

-- === Ухаанай Сургалт (education) ===
DELETE FROM services WHERE store_id = 'd2b186b8-9eb4-449b-8aac-dadd0e6328e2';
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('d2b186b8-9eb4-449b-8aac-dadd0e6328e2', 'Англи хэл (Эхлэгч)', 'Эхлэгчдэд зориулсан англи хэлний сургалт', 'Хэл сургалт', 90, 180000, 'active', 'Сард 12 хичээл, 7 хоногт 3 удаа', '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('d2b186b8-9eb4-449b-8aac-dadd0e6328e2', 'IELTS бэлтгэл', 'IELTS шалгалтын бэлтгэл курс', 'Хэл сургалт', 90, 350000, 'active', '3 сарын курс, 7 хоногт 5 удаа', '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('d2b186b8-9eb4-449b-8aac-dadd0e6328e2', 'Математик (ЕБС)', '10-12-р ангийн математик бэлтгэл', 'ЕБС бэлтгэл', 90, 150000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('d2b186b8-9eb4-449b-8aac-dadd0e6328e2', 'Python програмчлал', 'Python хэлний үндсэн курс', 'Програмчлал', 120, 250000, 'active', '2 сарын курс, 7 хоногт 3 удаа', '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('d2b186b8-9eb4-449b-8aac-dadd0e6328e2', 'Зурагийн хичээл', 'Уран зургийн хичээл, бүх насны', 'Урлаг', 90, 80000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('d2b186b8-9eb4-449b-8aac-dadd0e6328e2', 'Хятад хэл (Эхлэгч)', 'Эхлэгчдэд зориулсан хятад хэлний курс', 'Хэл сургалт', 90, 200000, 'active', NULL, '[]');
DELETE FROM staff WHERE store_id = 'd2b186b8-9eb4-449b-8aac-dadd0e6328e2';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('d2b186b8-9eb4-449b-8aac-dadd0e6328e2', 'Б. Мөнхжин', '99006001', 'munkhjin@ukhaanai.mn', ARRAY['Англи хэл','IELTS'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('d2b186b8-9eb4-449b-8aac-dadd0e6328e2', 'Д. Ариунболд', '99006002', 'ariunbold@ukhaanai.mn', ARRAY['Python','Програмчлал'], 'active');

-- === Инээмсэглэл Шүдний (dental_clinic) ===
DELETE FROM services WHERE store_id = '1c5f6f92-c0e3-45b2-98b2-20746c025e9d';
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Шүдний үзлэг', 'Шүдний ерөнхий үзлэг, оношилгоо', 'Оношилгоо', 30, 15000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Шүдний цэвэрлэгээ', 'Мэргэжлийн шүдний цэвэрлэгээ', 'Гоо сайхны', 45, 40000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Ломбо тавих', 'Шүдний ломбо, материал сонголттой', 'Эмчилгээ', 45, 35000, 'active', 'Энгийн ломбо: 35,000₮. Гэрлийн ломбо: 50,000₮.', '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Шүд авалт', 'Шүд авах мэс ажилбар', 'Мэс засал', 30, 30000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Шүдний импланат', 'Импланат суулгах, зөвлөгөө', 'Мэс засал', 90, 800000, 'active', 'Үнэ импланатын төрлөөс хамаарна. Зөвлөгөөг үнэгүй авна.', '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Шүд цайруулах', 'Мэргэжлийн шүд цайруулалт', 'Гоо сайхны', 60, 120000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Хүүхдийн шүдний үзлэг', 'Хүүхдэд зориулсан шүдний үзлэг', 'Хүүхдийн', 20, 10000, 'active', NULL, '[]');
DELETE FROM staff WHERE store_id = '1c5f6f92-c0e3-45b2-98b2-20746c025e9d';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Д. Нарангэрэл', '99007001', 'narangerel@dental.mn', ARRAY['Оношилгоо','Эмчилгээ'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('1c5f6f92-c0e3-45b2-98b2-20746c025e9d', 'Б. Энхбаяр', '99007002', 'enkhbayar@dental.mn', ARRAY['Мэс засал','Импланат'], 'active');

-- === Green Home Realty (real_estate) ===
DELETE FROM staff WHERE store_id = '533da3d1-2ee6-430e-a504-45bfad7aca4d';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('533da3d1-2ee6-430e-a504-45bfad7aca4d', 'Б. Ганзориг', '99008001', 'ganzorig@greenhome.mn', ARRAY['Орон сууц','Газар'], 'active');

-- === Хустай Кемпинг (camping_guesthouse) ===
DELETE FROM services WHERE store_id = '525b086a-e0cc-42d9-be37-f9533f95b428';
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'Морь унах', 'Морь унах аялал (1 цаг)', 'Хөтөлбөр', 60, 30000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'Сур харвалт', 'Сур харвалт, зааварчилгаатай', 'Хөтөлбөр', 30, 20000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'Байгалийн аялал', 'Хустай нуруу тойрох аялал', 'Хөтөлбөр', 180, 15000, 'active', NULL, '[]');
INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'Кэмпфайр шөнийн хөтөлбөр', 'Галын дэргэдэх шөнийн хөтөлбөр', 'Хөтөлбөр', 120, 10000, 'active', NULL, '[]');
DELETE FROM staff WHERE store_id = '525b086a-e0cc-42d9-be37-f9533f95b428';
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'Б. Ганболд', '99009001', 'ganbold@khustai.mn', ARRAY['менежер'], 'active');
INSERT INTO staff (store_id, name, phone, email, specialties, status)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'Д. Мөнхбат', '99009002', 'munkhbat@khustai.mn', ARRAY['морь','аялал'], 'active');
DELETE FROM bookable_resources WHERE store_id = '525b086a-e0cc-42d9-be37-f9533f95b428';
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'ger', 'Монгол гэр (Стандарт) №1', '2 хүн, халуун ус', 2, 80000, '{"hot_water":true}', '[]', 'available', 0);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'ger', 'Монгол гэр (Стандарт) №2', '2 хүн, халуун ус', 2, 80000, '{"hot_water":true}', '[]', 'available', 1);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'ger', 'Монгол гэр (Люкс)', '4 хүн, wifi, халуун ус', 4, 120000, '{"hot_water":true,"wifi":true}', '[]', 'available', 2);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'room', 'Стандарт өрөө №1', '2 хүн, TV, wifi', 2, 60000, '{"tv":true,"wifi":true}', '[]', 'available', 3);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'room', 'Люкс өрөө', '2 хүн, мини бар, тагт', 2, 100000, '{"mini_bar":true,"balcony":true,"wifi":true}', '[]', 'available', 4);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'tent_site', 'Майхны талбай №1', 'Цахилгаан, усны холболттой', 4, 15000, '{"electricity":true,"water":true}', '[]', 'available', 5);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'tent_site', 'Майхны талбай №2', 'Цахилгаан, усны холболттой', 4, 15000, '{"electricity":true,"water":true}', '[]', 'available', 6);
INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)
  VALUES ('525b086a-e0cc-42d9-be37-f9533f95b428', 'cabin', 'Модон байшин', '4 хүн, гал тогоо, зуух', 4, 150000, '{"kitchen":true,"fireplace":true}', '[]', 'available', 7);
