-- ============================================================================
-- Migration 032: Medical Vertical (Phase 7b)
-- Adds: patients, encounters, prescriptions, prescription_items, medical_notes
-- ============================================================================

-- 1. Patients (patient profiles)
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  phone TEXT,
  email TEXT,
  emergency_contact JSONB DEFAULT '{}',
  medical_history JSONB DEFAULT '[]',
  allergies TEXT[] DEFAULT '{}',
  insurance_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_patients_store ON patients(store_id);
CREATE INDEX idx_patients_customer ON patients(customer_id);
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_store_access" ON patients
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Encounters (patient visits/consultations)
CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  encounter_type TEXT DEFAULT 'consultation' CHECK (encounter_type IN ('consultation', 'follow_up', 'emergency', 'procedure', 'lab_visit')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  notes TEXT,
  encounter_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_encounters_store ON encounters(store_id);
CREATE INDEX idx_encounters_patient ON encounters(patient_id);
CREATE INDEX idx_encounters_provider ON encounters(provider_id);
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encounters_store_access" ON encounters
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER encounters_updated_at
  BEFORE UPDATE ON encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Prescriptions (medications prescribed)
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prescribed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prescriptions_store ON prescriptions(store_id);
CREATE INDEX idx_prescriptions_encounter ON prescriptions(encounter_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_prescribed_by ON prescriptions(prescribed_by);
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescriptions_store_access" ON prescriptions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Prescription Items (individual medications)
CREATE TABLE prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prescription_items_prescription ON prescription_items(prescription_id);
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;

-- Join-based RLS through prescriptions
CREATE POLICY "prescription_items_store_access" ON prescription_items
  FOR ALL USING (
    prescription_id IN (
      SELECT id FROM prescriptions
      WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
         OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
    )
  );

-- 5. Medical Notes (clinical notes)
CREATE TABLE medical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  author_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  note_type TEXT DEFAULT 'progress' CHECK (note_type IN ('progress', 'soap', 'procedure', 'discharge', 'referral')),
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_medical_notes_store ON medical_notes(store_id);
CREATE INDEX idx_medical_notes_encounter ON medical_notes(encounter_id);
CREATE INDEX idx_medical_notes_patient ON medical_notes(patient_id);
CREATE INDEX idx_medical_notes_author ON medical_notes(author_id);
ALTER TABLE medical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_notes_store_access" ON medical_notes
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER medical_notes_updated_at
  BEFORE UPDATE ON medical_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable realtime for encounters
ALTER PUBLICATION supabase_realtime ADD TABLE encounters;
