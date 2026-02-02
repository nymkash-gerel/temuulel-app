-- Phase 9: Photography + Venue/Event + Coworking
-- Tables: photo_sessions, photo_galleries, venues, venue_bookings, coworking_spaces, desk_bookings

-- ============================================================
-- PHOTOGRAPHY / CREATIVE
-- ============================================================

CREATE TABLE IF NOT EXISTS photo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  photographer_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL DEFAULT 'portrait',
  location TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled',
  total_amount NUMERIC(12,2),
  deposit_amount NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT photo_session_type_check CHECK (session_type IN ('portrait', 'wedding', 'event', 'product', 'family', 'maternity', 'newborn', 'corporate', 'other')),
  CONSTRAINT photo_session_status_check CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'))
);

CREATE INDEX idx_photo_sessions_store ON photo_sessions(store_id);
CREATE INDEX idx_photo_sessions_customer ON photo_sessions(customer_id);
CREATE INDEX idx_photo_sessions_scheduled ON photo_sessions(scheduled_at);
CREATE INDEX idx_photo_sessions_status ON photo_sessions(status);

ALTER TABLE photo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photo_sessions_store_owner" ON photo_sessions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS photo_galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES photo_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  gallery_url TEXT,
  download_url TEXT,
  password TEXT,
  photo_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT photo_gallery_status_check CHECK (status IN ('processing', 'ready', 'delivered', 'archived'))
);

CREATE INDEX idx_photo_galleries_store ON photo_galleries(store_id);
CREATE INDEX idx_photo_galleries_session ON photo_galleries(session_id);

ALTER TABLE photo_galleries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photo_galleries_store_owner" ON photo_galleries
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- VENUE / EVENT
-- ============================================================

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL DEFAULT 50,
  hourly_rate NUMERIC(12,2),
  daily_rate NUMERIC(12,2),
  amenities JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_venues_store ON venues(store_id);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues_store_owner" ON venues
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS venue_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'private',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  guests_count INTEGER,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pending',
  special_requests TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_event_type_check CHECK (event_type IN ('private', 'corporate', 'wedding', 'birthday', 'conference', 'workshop', 'exhibition', 'other')),
  CONSTRAINT venue_booking_status_check CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX idx_venue_bookings_store ON venue_bookings(store_id);
CREATE INDEX idx_venue_bookings_venue ON venue_bookings(venue_id);
CREATE INDEX idx_venue_bookings_start ON venue_bookings(start_at);
CREATE INDEX idx_venue_bookings_status ON venue_bookings(status);

ALTER TABLE venue_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_bookings_store_owner" ON venue_bookings
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- COWORKING
-- ============================================================

CREATE TABLE IF NOT EXISTS coworking_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  space_type TEXT NOT NULL DEFAULT 'hot_desk',
  capacity INTEGER NOT NULL DEFAULT 1,
  hourly_rate NUMERIC(12,2),
  daily_rate NUMERIC(12,2),
  monthly_rate NUMERIC(12,2),
  amenities JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coworking_space_type_check CHECK (space_type IN ('hot_desk', 'dedicated_desk', 'private_office', 'meeting_room', 'event_space', 'phone_booth'))
);

CREATE INDEX idx_coworking_spaces_store ON coworking_spaces(store_id);

ALTER TABLE coworking_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coworking_spaces_store_owner" ON coworking_spaces
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS desk_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES coworking_spaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT desk_booking_status_check CHECK (status IN ('confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'))
);

CREATE INDEX idx_desk_bookings_store ON desk_bookings(store_id);
CREATE INDEX idx_desk_bookings_space ON desk_bookings(space_id);
CREATE INDEX idx_desk_bookings_date ON desk_bookings(booking_date);

ALTER TABLE desk_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desk_bookings_store_owner" ON desk_bookings
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );
