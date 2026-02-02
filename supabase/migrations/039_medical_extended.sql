-- ============================================================================
-- Migration 039: Medical Extended (Lab, Inpatient, Complaints, Pharmacy)
-- Adds: lab_orders, lab_results, admissions, bed_assignments, medical_complaints
-- ============================================================================

-- 1. Lab Orders (lab & imaging orders)
CREATE TABLE lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  ordered_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  order_type TEXT DEFAULT 'lab' CHECK (order_type IN ('lab', 'imaging', 'other')),
  test_name TEXT NOT NULL,
  test_code TEXT,
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'stat')),
  specimen_type TEXT,
  collection_time TIMESTAMPTZ,
  status TEXT DEFAULT 'ordered' CHECK (status IN ('ordered', 'collected', 'processing', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_orders_store ON lab_orders(store_id);
CREATE INDEX idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX idx_lab_orders_encounter ON lab_orders(encounter_id);
CREATE INDEX idx_lab_orders_status ON lab_orders(store_id, status);
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_orders_store_access" ON lab_orders
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER lab_orders_updated_at
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Lab Results (test results linked to orders)
CREATE TABLE lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  result_data JSONB DEFAULT '[]',
  interpretation TEXT,
  report_url TEXT,
  resulted_by TEXT,
  resulted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_results_store ON lab_results(store_id);
CREATE INDEX idx_lab_results_order ON lab_results(order_id);
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_results_store_access" ON lab_results
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER lab_results_updated_at
  BEFORE UPDATE ON lab_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Admissions (inpatient stays)
CREATE TABLE admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  attending_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  admit_diagnosis TEXT,
  admit_at TIMESTAMPTZ DEFAULT now(),
  discharge_at TIMESTAMPTZ,
  discharge_summary TEXT,
  status TEXT DEFAULT 'admitted' CHECK (status IN ('admitted', 'discharged', 'transferred')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admissions_store ON admissions(store_id);
CREATE INDEX idx_admissions_patient ON admissions(patient_id);
CREATE INDEX idx_admissions_status ON admissions(store_id, status);
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admissions_store_access" ON admissions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER admissions_updated_at
  BEFORE UPDATE ON admissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Bed Assignments (bed/unit tracking for admissions)
CREATE TABLE bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES bookable_resources(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ DEFAULT now(),
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bed_assignments_store ON bed_assignments(store_id);
CREATE INDEX idx_bed_assignments_admission ON bed_assignments(admission_id);
CREATE INDEX idx_bed_assignments_unit ON bed_assignments(unit_id);
ALTER TABLE bed_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bed_assignments_store_access" ON bed_assignments
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- 5. Medical Complaints (QA / patient complaints)
CREATE TABLE medical_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'other' CHECK (category IN ('wait_time', 'treatment', 'staff_behavior', 'facility', 'billing', 'other')),
  severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'serious')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'reviewed', 'resolved', 'closed')),
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_medical_complaints_store ON medical_complaints(store_id);
CREATE INDEX idx_medical_complaints_patient ON medical_complaints(patient_id);
CREATE INDEX idx_medical_complaints_status ON medical_complaints(store_id, status);
ALTER TABLE medical_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_complaints_store_access" ON medical_complaints
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER medical_complaints_updated_at
  BEFORE UPDATE ON medical_complaints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Add vitals and physical_exam JSONB columns to encounters
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS vitals JSONB DEFAULT '{}';
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS physical_exam JSONB DEFAULT '{}';
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS diagnosis_codes TEXT[] DEFAULT '{}';

-- 7. Add dispensed tracking columns to prescriptions
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS dispensed_by UUID REFERENCES staff(id) ON DELETE SET NULL;

-- 8. Enable realtime for lab orders
ALTER PUBLICATION supabase_realtime ADD TABLE lab_orders;
