-- Legal Extended: time_entries, case_events, legal_expenses, retainers
-- Fills gaps in the Legal / Law Firm vertical.

-- ============================================================
-- TIME ENTRIES (billable hours)
-- ============================================================

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  billable_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_store ON time_entries(store_id);
CREATE INDEX idx_time_entries_case ON time_entries(case_id);
CREATE INDEX idx_time_entries_staff ON time_entries(staff_id);
CREATE INDEX idx_time_entries_date ON time_entries(entry_date);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_store_owner" ON time_entries
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CASE EVENTS (hearings, deadlines, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'hearing',
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT case_event_type_check CHECK (event_type IN ('hearing', 'filing_deadline', 'consultation', 'court_date', 'deposition', 'mediation'))
);

CREATE INDEX idx_case_events_store ON case_events(store_id);
CREATE INDEX idx_case_events_case ON case_events(case_id);
CREATE INDEX idx_case_events_type ON case_events(event_type);
CREATE INDEX idx_case_events_scheduled ON case_events(scheduled_at);

ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_events_store_owner" ON case_events
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER case_events_updated_at
  BEFORE UPDATE ON case_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- LEGAL EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS legal_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  incurred_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_expense_type_check CHECK (expense_type IN ('filing_fee', 'travel', 'expert_witness', 'court_reporter', 'copying', 'other'))
);

CREATE INDEX idx_legal_expenses_store ON legal_expenses(store_id);
CREATE INDEX idx_legal_expenses_case ON legal_expenses(case_id);
CREATE INDEX idx_legal_expenses_type ON legal_expenses(expense_type);
CREATE INDEX idx_legal_expenses_date ON legal_expenses(incurred_date);

ALTER TABLE legal_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_expenses_store_owner" ON legal_expenses
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER legal_expenses_updated_at
  BEFORE UPDATE ON legal_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RETAINERS
-- ============================================================

CREATE TABLE IF NOT EXISTS retainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  initial_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retainer_status_check CHECK (status IN ('active', 'depleted', 'refunded'))
);

CREATE INDEX idx_retainers_store ON retainers(store_id);
CREATE INDEX idx_retainers_case ON retainers(case_id);
CREATE INDEX idx_retainers_client ON retainers(client_id);
CREATE INDEX idx_retainers_status ON retainers(status);

ALTER TABLE retainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retainers_store_owner" ON retainers
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER retainers_updated_at
  BEFORE UPDATE ON retainers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
