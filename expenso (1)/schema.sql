-- ══════════════════════════════════════════════════════════════
--  EXPENSO — PostgreSQL Schema
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  base_currency TEXT DEFAULT 'USD',
  is_manager_approver BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  manager_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Approval chain steps (company-level configuration)
CREATE TABLE IF NOT EXISTS approval_chain_steps (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  step_order INTEGER NOT NULL,
  approver_type TEXT NOT NULL,           -- 'manager', 'user'
  approver_user_id INTEGER REFERENCES users(id),
  label TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conditional approval rules (company-level)
CREATE TABLE IF NOT EXISTS approval_rules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  rule_type TEXT NOT NULL,               -- 'percentage', 'specific_approver', 'hybrid'
  percentage_threshold INTEGER,
  specific_approver_id INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  converted_amount NUMERIC(14,2),
  base_currency TEXT,
  category TEXT,
  expense_date DATE,
  notes TEXT,
  receipt_url TEXT,
  status TEXT DEFAULT 'PENDING',
  current_step INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_lines (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  description TEXT,
  amount NUMERIC(14,2),
  sort_order INTEGER DEFAULT 0
);

-- Per-expense approval step snapshots
CREATE TABLE IF NOT EXISTS expense_approval_steps (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  approver_id INTEGER REFERENCES users(id),
  approver_label TEXT,
  status TEXT DEFAULT 'PENDING',
  comment TEXT,
  acted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_log (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  acted_by INTEGER REFERENCES users(id),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_eas_expense ON expense_approval_steps(expense_id);
CREATE INDEX IF NOT EXISTS idx_chain_company ON approval_chain_steps(company_id);
