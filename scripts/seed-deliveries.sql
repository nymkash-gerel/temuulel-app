-- Seed delivery drivers for Номин Ресторан
INSERT INTO delivery_drivers (id, store_id, name, phone, email, vehicle_type, vehicle_number, status) VALUES
  ('d1000000-0000-0000-0000-000000000001', '5ff9f468-5066-4716-9496-bae77ea1bb80', 'Болд', '99112233', 'bold@driver.mn', 'motorcycle', '1234 УБА', 'active'),
  ('d1000000-0000-0000-0000-000000000002', '5ff9f468-5066-4716-9496-bae77ea1bb80', 'Тэмүүлэн', '99223344', NULL, 'car', '5678 УБА', 'on_delivery'),
  ('d1000000-0000-0000-0000-000000000003', '5ff9f468-5066-4716-9496-bae77ea1bb80', 'Сүхбат', '99334455', NULL, 'bicycle', NULL, 'active'),
  ('d1000000-0000-0000-0000-000000000004', '5ff9f468-5066-4716-9496-bae77ea1bb80', 'Ганзориг', '99445566', 'ganzo@driver.mn', 'motorcycle', '9012 УБА', 'inactive')
ON CONFLICT DO NOTHING;

-- Seed delivery drivers for Кофе Хаус
INSERT INTO delivery_drivers (id, store_id, name, phone, email, vehicle_type, vehicle_number, status) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'e90252aa-68ee-497e-b93b-dfecae929b13', 'Батбаяр', '88112233', NULL, 'motorcycle', '3456 УБА', 'active'),
  ('d2000000-0000-0000-0000-000000000002', 'e90252aa-68ee-497e-b93b-dfecae929b13', 'Мөнхбат', '88223344', NULL, 'on_foot', NULL, 'active')
ON CONFLICT DO NOTHING;

-- Seed deliveries for Номин Ресторан
INSERT INTO deliveries (id, store_id, driver_id, delivery_number, status, delivery_type, delivery_address, customer_name, customer_phone, delivery_fee, created_at) VALUES
  ('e1000000-0000-0000-0000-000000000001', '5ff9f468-5066-4716-9496-bae77ea1bb80', 'd1000000-0000-0000-0000-000000000002', 'DEL-1706700001', 'in_transit', 'own_driver', 'БЗД, 3-р хороо, 45-р байр, 302 тоот', 'Дорж', '99887766', 5000, NOW() - INTERVAL '2 hours'),
  ('e1000000-0000-0000-0000-000000000002', '5ff9f468-5066-4716-9496-bae77ea1bb80', 'd1000000-0000-0000-0000-000000000001', 'DEL-1706700002', 'delivered', 'own_driver', 'СБД, 1-р хороо, Ногоон нуур', 'Нарантуяа', '99776655', 3000, NOW() - INTERVAL '1 day'),
  ('e1000000-0000-0000-0000-000000000003', '5ff9f468-5066-4716-9496-bae77ea1bb80', NULL, 'DEL-1706700003', 'pending', 'own_driver', 'ХУД, 7-р хороо, Зайсан', 'Цэрэн', '99665544', 7000, NOW() - INTERVAL '30 minutes'),
  ('e1000000-0000-0000-0000-000000000004', '5ff9f468-5066-4716-9496-bae77ea1bb80', 'd1000000-0000-0000-0000-000000000003', 'DEL-1706700004', 'failed', 'own_driver', 'ЧД, 5-р хороо, 100 айл', 'Баяр', '99554433', 4000, NOW() - INTERVAL '3 hours'),
  ('e1000000-0000-0000-0000-000000000005', '5ff9f468-5066-4716-9496-bae77ea1bb80', NULL, 'DEL-1706700005', 'pending', 'external_provider', 'СХД, 20-р хороо, Шинэ яармаг', 'Отгон', '99443322', 8000, NOW() - INTERVAL '15 minutes')
ON CONFLICT DO NOTHING;

-- Update external delivery with provider info
UPDATE deliveries SET provider_name = 'HiDel', provider_tracking_id = 'HD-98765' WHERE id = 'e1000000-0000-0000-0000-000000000005';

-- Seed deliveries for Кофе Хаус
INSERT INTO deliveries (id, store_id, driver_id, delivery_number, status, delivery_type, delivery_address, customer_name, customer_phone, delivery_fee, created_at) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'e90252aa-68ee-497e-b93b-dfecae929b13', 'd2000000-0000-0000-0000-000000000001', 'DEL-1706700010', 'assigned', 'own_driver', 'БЗД, 4-р хороо, Энхтайваны өргөн чөлөө', 'Солонго', '88776655', 3500, NOW() - INTERVAL '45 minutes'),
  ('e2000000-0000-0000-0000-000000000002', 'e90252aa-68ee-497e-b93b-dfecae929b13', 'd2000000-0000-0000-0000-000000000002', 'DEL-1706700011', 'delivered', 'own_driver', 'СБД, Оюутны гудамж', 'Анар', '88665544', 2000, NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Add delivery_failed entry with failure reason
UPDATE deliveries SET failure_reason = 'Утсанд хариулахгүй байна, хаяг олдсонгүй' WHERE id = 'e1000000-0000-0000-0000-000000000004';

-- Seed status logs for active deliveries
INSERT INTO delivery_status_log (delivery_id, status, changed_by, notes, created_at) VALUES
  -- DEL-1706700001: pending → assigned → picked_up → in_transit
  ('e1000000-0000-0000-0000-000000000001', 'pending', 'system', 'Delivery created', NOW() - INTERVAL '2 hours'),
  ('e1000000-0000-0000-0000-000000000001', 'assigned', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '1 hour 45 minutes'),
  ('e1000000-0000-0000-0000-000000000001', 'picked_up', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '1 hour 30 minutes'),
  ('e1000000-0000-0000-0000-000000000001', 'in_transit', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '1 hour'),

  -- DEL-1706700002: pending → assigned → picked_up → in_transit → delivered
  ('e1000000-0000-0000-0000-000000000002', 'pending', 'system', 'Delivery created', NOW() - INTERVAL '1 day'),
  ('e1000000-0000-0000-0000-000000000002', 'assigned', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '23 hours'),
  ('e1000000-0000-0000-0000-000000000002', 'picked_up', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '22 hours 30 minutes'),
  ('e1000000-0000-0000-0000-000000000002', 'in_transit', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '22 hours'),
  ('e1000000-0000-0000-0000-000000000002', 'delivered', 'restaurant@temuulel.test', 'Амжилттай хүргэсэн', NOW() - INTERVAL '21 hours'),

  -- DEL-1706700003: pending only
  ('e1000000-0000-0000-0000-000000000003', 'pending', 'system', 'Delivery created', NOW() - INTERVAL '30 minutes'),

  -- DEL-1706700004: pending → assigned → picked_up → in_transit → failed
  ('e1000000-0000-0000-0000-000000000004', 'pending', 'system', 'Delivery created', NOW() - INTERVAL '3 hours'),
  ('e1000000-0000-0000-0000-000000000004', 'assigned', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '2 hours 45 minutes'),
  ('e1000000-0000-0000-0000-000000000004', 'picked_up', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '2 hours 30 minutes'),
  ('e1000000-0000-0000-0000-000000000004', 'in_transit', 'restaurant@temuulel.test', NULL, NOW() - INTERVAL '2 hours'),
  ('e1000000-0000-0000-0000-000000000004', 'failed', 'restaurant@temuulel.test', 'Утсанд хариулахгүй байна, хаяг олдсонгүй', NOW() - INTERVAL '1 hour'),

  -- DEL-1706700010: pending → assigned
  ('e2000000-0000-0000-0000-000000000001', 'pending', 'system', 'Delivery created', NOW() - INTERVAL '45 minutes'),
  ('e2000000-0000-0000-0000-000000000001', 'assigned', 'coffee@temuulel.test', NULL, NOW() - INTERVAL '30 minutes'),

  -- DEL-1706700011: full lifecycle
  ('e2000000-0000-0000-0000-000000000002', 'pending', 'system', 'Delivery created', NOW() - INTERVAL '2 days'),
  ('e2000000-0000-0000-0000-000000000002', 'assigned', 'coffee@temuulel.test', NULL, NOW() - INTERVAL '1 day 23 hours'),
  ('e2000000-0000-0000-0000-000000000002', 'picked_up', 'coffee@temuulel.test', NULL, NOW() - INTERVAL '1 day 22 hours'),
  ('e2000000-0000-0000-0000-000000000002', 'in_transit', 'coffee@temuulel.test', NULL, NOW() - INTERVAL '1 day 21 hours 30 minutes'),
  ('e2000000-0000-0000-0000-000000000002', 'delivered', 'coffee@temuulel.test', 'Амжилттай хүргэсэн', NOW() - INTERVAL '1 day 21 hours')
ON CONFLICT DO NOTHING;
