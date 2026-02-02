-- Phase 10: Legal + Construction + Subscription
-- Tables: legal_cases, case_documents, projects, project_tasks, subscriptions, subscription_items

-- ============================================================
-- LEGAL / LAW FIRM
-- ============================================================

CREATE TABLE IF NOT EXISTS legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  case_type TEXT NOT NULL DEFAULT 'civil',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  description TEXT,
  court_name TEXT,
  filing_date DATE,
  next_hearing DATE,
  total_fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_case_type_check CHECK (case_type IN ('civil', 'criminal', 'corporate', 'family', 'real_estate', 'immigration', 'tax', 'labor', 'other')),
  CONSTRAINT legal_case_status_check CHECK (status IN ('open', 'in_progress', 'pending_hearing', 'settled', 'closed', 'archived')),
  CONSTRAINT legal_case_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX idx_legal_cases_store ON legal_cases(store_id);
CREATE INDEX idx_legal_cases_customer ON legal_cases(customer_id);
CREATE INDEX idx_legal_cases_status ON legal_cases(status);
CREATE INDEX idx_legal_cases_number ON legal_cases(case_number);

ALTER TABLE legal_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_cases_store_owner" ON legal_cases
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'general',
  file_url TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT case_document_type_check CHECK (document_type IN ('general', 'contract', 'court_filing', 'evidence', 'correspondence', 'invoice', 'other'))
);

CREATE INDEX idx_case_documents_store ON case_documents(store_id);
CREATE INDEX idx_case_documents_case ON case_documents(case_id);

ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_documents_store_owner" ON case_documents
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- CONSTRUCTION / PROJECT MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'construction',
  status TEXT NOT NULL DEFAULT 'planning',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date DATE,
  end_date DATE,
  budget NUMERIC(14,2),
  actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  completion_percentage INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_type_check CHECK (project_type IN ('construction', 'renovation', 'maintenance', 'design', 'consulting', 'other')),
  CONSTRAINT project_status_check CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT project_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT project_completion_check CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

CREATE INDEX idx_projects_store ON projects(store_id);
CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_projects_status ON projects(status);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_store_owner" ON projects
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  estimated_hours NUMERIC(8,2),
  actual_hours NUMERIC(8,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_status_check CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'cancelled')),
  CONSTRAINT task_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX idx_project_tasks_store ON project_tasks(store_id);
CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_tasks_store_owner" ON project_tasks
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- SUBSCRIPTION / RECURRING
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_billing_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_period_check CHECK (billing_period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  CONSTRAINT subscription_status_check CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'past_due'))
);

CREATE INDEX idx_subscriptions_store ON subscriptions(store_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_store_owner" ON subscriptions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_items_store ON subscription_items(store_id);
CREATE INDEX idx_subscription_items_subscription ON subscription_items(subscription_id);

ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_items_store_owner" ON subscription_items
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );
