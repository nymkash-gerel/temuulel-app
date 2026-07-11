-- Remove the world-open INSERT policy on driver_ratings.
--
-- Migration 022 created `FOR INSERT WITH CHECK (true)`, letting the anon key insert a
-- rating for ANY store/driver/delivery with arbitrary values directly via PostgREST —
-- e.g. flooding a competitor's driver with 1-star rows (the AFTER INSERT trigger then
-- drags down that driver's avg_rating).
--
-- The only legitimate path, POST /api/track/[deliveryNumber]/rate, uses the
-- service-role client (which bypasses RLS) AFTER verifying the delivery is delivered,
-- has a driver, and isn't already rated — and it derives driver_id/store_id from the
-- delivery row, not from user input. So dropping this policy breaks no real flow while
-- closing the direct-insert abuse.

DROP POLICY IF EXISTS "Anyone can insert driver ratings" ON driver_ratings;
