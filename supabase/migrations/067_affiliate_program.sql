-- Affiliate partner program (higher-tier referrals with commission tracking)

-- Affiliate accounts (one per user who enrolled as partner)
CREATE TABLE IF NOT EXISTS affiliate_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC(4, 3) NOT NULL DEFAULT 0.200, -- 20%
  payout_threshold INTEGER NOT NULL DEFAULT 100000, -- MNT
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  bank_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_code ON affiliate_accounts(referral_code);

-- Affiliate referrals (each click / signup / conversion)
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliate_accounts(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email TEXT,
  status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked', 'signed_up', 'converted', 'paid')),
  plan TEXT,
  commission_amount INTEGER,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_aff ON affiliate_referrals(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_code ON affiliate_referrals(referral_code);

-- Affiliate payouts
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliate_accounts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  transaction_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_aff ON affiliate_payouts(affiliate_id, created_at DESC);

-- RLS
ALTER TABLE affiliate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_accounts_own" ON affiliate_accounts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "affiliate_referrals_own" ON affiliate_referrals
  FOR SELECT USING (affiliate_id IN (SELECT id FROM affiliate_accounts WHERE user_id = auth.uid()));

CREATE POLICY "affiliate_payouts_own" ON affiliate_payouts
  FOR SELECT USING (affiliate_id IN (SELECT id FROM affiliate_accounts WHERE user_id = auth.uid()));
