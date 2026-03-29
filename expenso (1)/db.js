/* ══════════════════════════════════════════════════════════════
   DATABASE — PostgreSQL Connection & Initialization
   ══════════════════════════════════════════════════════════════ */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
  process.exit(-1);
});

async function initDB() {
  const client = await pool.connect();
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Database schema initialized');
    await seedIfEmpty(client);
  } finally {
    client.release();
  }
}

async function seedIfEmpty(client) {
  const { rows } = await client.query('SELECT COUNT(*) as c FROM companies');
  if (parseInt(rows[0].c) > 0) return;

  console.log('📦 Seeding demo data...');

  // Company
  const compRes = await client.query(
    `INSERT INTO companies (name, country, base_currency, is_manager_approver)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    ['TechCorp', 'India', 'INR', true]
  );
  const companyId = compRes.rows[0].id;

  // Users
  const ins = async (name, email, pass, role, managerId) => {
    const res = await client.query(
      `INSERT INTO users (company_id, name, email, password, role, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [companyId, name, email, pass, role, managerId]
    );
    return res.rows[0].id;
  };

  const u1 = await ins('Admin User', 'admin@company.com', 'admin', 'admin', null);
  const u2 = await ins('Priya Sharma', 'priya@company.com', 'pass', 'manager', null);
  const u3 = await ins('Raj Kumar', 'raj@company.com', 'pass', 'employee', u2);
  const u4 = await ins('Ananya Gupta', 'ananya@company.com', 'pass', 'employee', u2);
  const u5 = await ins('Vikram Singh', 'vikram@company.com', 'pass', 'manager', null);
  const u6 = await ins('Sneha Patel', 'sneha@company.com', 'pass', 'manager', null);

  // Approval chain steps
  await client.query(
    `INSERT INTO approval_chain_steps (company_id, step_order, approver_type, approver_user_id, label) VALUES
     ($1, 1, 'manager', NULL, 'Direct Manager'),
     ($1, 2, 'user', $2, 'Finance Review'),
     ($1, 3, 'user', $3, 'Director Approval')`,
    [companyId, u5, u6]
  );

  // Sample expenses helper
  const insExp = async (userId, desc, amt, curr, convAmt, baseCurr, cat, expDate, notes, status, step, createdAt) => {
    const res = await client.query(
      `INSERT INTO expenses (company_id, user_id, description, amount, currency, converted_amount, base_currency, category, expense_date, notes, status, current_step, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [companyId, userId, desc, amt, curr, convAmt, baseCurr, cat, expDate, notes, status, step, createdAt]
    );
    return res.rows[0].id;
  };

  const insLog = async (expId, action, actedBy, comment, createdAt) => {
    await client.query(
      `INSERT INTO approval_log (expense_id, action, acted_by, comment, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [expId, action, actedBy, comment, createdAt]
    );
  };

  const insStep = async (expId, order, approverId, label, status, comment, actedAt) => {
    await client.query(
      `INSERT INTO expense_approval_steps (expense_id, step_order, approver_id, approver_label, status, comment, acted_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [expId, order, approverId, label, status, comment, actedAt]
    );
  };

  // Expense 1: Pending at step 1
  const e1 = await insExp(u3, 'Client lunch at Taj Hotel', 3500, 'INR', 3500, 'INR', 'Meals', '2026-03-20', 'Met with Acme Corp team', 'PENDING', 1, '2026-03-20T10:00:00Z');
  await insLog(e1, 'SUBMITTED', u3, null, '2026-03-20T10:00:00Z');
  await insStep(e1, 1, u2, 'Direct Manager', 'PENDING', null, null);
  await insStep(e1, 2, u5, 'Finance Review', 'PENDING', null, null);
  await insStep(e1, 3, u6, 'Director Approval', 'PENDING', null, null);

  // Expense 2: Pending at step 1
  const e2 = await insExp(u4, 'Flight to Mumbai — Annual Conference', 8200, 'INR', 8200, 'INR', 'Travel', '2026-03-18', 'Roundtrip economy class', 'PENDING', 1, '2026-03-18T14:00:00Z');
  await insLog(e2, 'SUBMITTED', u4, null, '2026-03-18T14:00:00Z');
  await insStep(e2, 1, u2, 'Direct Manager', 'PENDING', null, null);
  await insStep(e2, 2, u5, 'Finance Review', 'PENDING', null, null);
  await insStep(e2, 3, u6, 'Director Approval', 'PENDING', null, null);

  // Expense 3: Approved
  const e3 = await insExp(u3, 'Office supplies from Amazon', 45, 'USD', 3780, 'INR', 'Office', '2026-03-15', 'Notebooks, pens, whiteboard markers', 'APPROVED', 3, '2026-03-15T09:00:00Z');
  await insLog(e3, 'SUBMITTED', u3, null, '2026-03-15T09:00:00Z');
  await insLog(e3, 'APPROVED', u2, 'Looks good', '2026-03-16T11:00:00Z');
  await insLog(e3, 'APPROVED', u5, 'Budget OK', '2026-03-16T14:00:00Z');
  await insLog(e3, 'APPROVED', u6, null, '2026-03-17T09:00:00Z');
  await insStep(e3, 1, u2, 'Direct Manager', 'APPROVED', 'Looks good', '2026-03-16T11:00:00Z');
  await insStep(e3, 2, u5, 'Finance Review', 'APPROVED', 'Budget OK', '2026-03-16T14:00:00Z');
  await insStep(e3, 3, u6, 'Director Approval', 'APPROVED', null, '2026-03-17T09:00:00Z');

  // Expense 4: Rejected
  const e4 = await insExp(u4, 'Uber rides — client visits', 1200, 'INR', 1200, 'INR', 'Travel', '2026-03-10', '', 'REJECTED', 1, '2026-03-10T08:00:00Z');
  await insLog(e4, 'SUBMITTED', u4, null, '2026-03-10T08:00:00Z');
  await insLog(e4, 'REJECTED', u2, 'Missing receipt — please resubmit', '2026-03-11T09:30:00Z');
  await insStep(e4, 1, u2, 'Direct Manager', 'REJECTED', 'Missing receipt — please resubmit', '2026-03-11T09:30:00Z');

  // Expense 5: Approved
  const e5 = await insExp(u3, 'Figma Pro — Monthly subscription', 15, 'USD', 1260, 'INR', 'Software', '2026-03-05', 'Design tools subscription', 'APPROVED', 3, '2026-03-05T12:00:00Z');
  await insLog(e5, 'SUBMITTED', u3, null, '2026-03-05T12:00:00Z');
  await insLog(e5, 'APPROVED', u2, null, '2026-03-06T10:00:00Z');
  await insLog(e5, 'APPROVED', u5, null, '2026-03-06T12:00:00Z');
  await insLog(e5, 'APPROVED', u6, null, '2026-03-06T14:00:00Z');
  await insStep(e5, 1, u2, 'Direct Manager', 'APPROVED', null, '2026-03-06T10:00:00Z');
  await insStep(e5, 2, u5, 'Finance Review', 'APPROVED', null, '2026-03-06T12:00:00Z');
  await insStep(e5, 3, u6, 'Director Approval', 'APPROVED', null, '2026-03-06T14:00:00Z');

  // Expense 6: Approved
  const e6 = await insExp(u4, 'Team dinner at ITC Grand', 6800, 'INR', 6800, 'INR', 'Meals', '2026-02-28', 'Sprint retrospective celebration', 'APPROVED', 3, '2026-02-28T20:00:00Z');
  await insLog(e6, 'SUBMITTED', u4, null, '2026-02-28T20:00:00Z');
  await insLog(e6, 'APPROVED', u2, 'Approved — great team event', '2026-03-01T09:00:00Z');
  await insLog(e6, 'APPROVED', u5, null, '2026-03-01T11:00:00Z');
  await insLog(e6, 'APPROVED', u6, null, '2026-03-01T14:00:00Z');
  await insStep(e6, 1, u2, 'Direct Manager', 'APPROVED', 'Approved — great team event', '2026-03-01T09:00:00Z');
  await insStep(e6, 2, u5, 'Finance Review', 'APPROVED', null, '2026-03-01T11:00:00Z');
  await insStep(e6, 3, u6, 'Director Approval', 'APPROVED', null, '2026-03-01T14:00:00Z');

  // Expense lines
  await client.query(
    `INSERT INTO expense_lines (expense_id, description, amount, sort_order) VALUES
     ($1, 'Lunch buffet x4', 2800, 1), ($1, 'Beverages', 500, 2), ($1, 'Service charge', 200, 3),
     ($2, 'Notebooks (pack of 5)', 15, 1), ($2, 'Pen set', 12, 2), ($2, 'Whiteboard markers', 18, 3)`,
    [e1, e3]
  );

  console.log('✅ Demo data seeded successfully');
}

module.exports = { pool, initDB };
