-- 022: Driver Ratings System
-- Adds driver_ratings table and avg_rating/rating_count columns to delivery_drivers

-- Add rating columns to delivery_drivers
ALTER TABLE delivery_drivers
  ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;

-- Create driver_ratings table
CREATE TABLE IF NOT EXISTS driver_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL UNIQUE REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_name text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver_id ON driver_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_store_id ON driver_ratings(store_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_delivery_id ON driver_ratings(delivery_id);

-- Enable RLS
ALTER TABLE driver_ratings ENABLE ROW LEVEL SECURITY;

-- Public insert (customers can rate without auth)
CREATE POLICY "Anyone can insert driver ratings"
  ON driver_ratings FOR INSERT
  WITH CHECK (true);

-- Store owner can read ratings for their store
CREATE POLICY "Store owners can read their ratings"
  ON driver_ratings FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Drivers can read their own ratings (via store membership check)
CREATE POLICY "Drivers can read own ratings"
  ON driver_ratings FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM delivery_drivers WHERE user_id = auth.uid()
    )
  );

-- Trigger function to auto-update avg_rating and rating_count
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE delivery_drivers
  SET
    rating_count = (SELECT COUNT(*) FROM driver_ratings WHERE driver_id = NEW.driver_id),
    avg_rating = (SELECT COALESCE(AVG(rating)::numeric(3,2), 0) FROM driver_ratings WHERE driver_id = NEW.driver_id),
    updated_at = now()
  WHERE id = NEW.driver_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_rating
  AFTER INSERT ON driver_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_rating();
