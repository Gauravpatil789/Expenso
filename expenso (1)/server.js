/* ══════════════════════════════════════════════════════════════
   SERVER — Express Application (PostgreSQL)
   ══════════════════════════════════════════════════════════════ */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ──
async function getSessionUser(req) {
  const userId = req.headers['x-user-id'];
  if (!userId) return null;
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return rows[0] || null;
}

async function requireAuth(req, res, next) {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ═══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password = $2',
      [email.toLowerCase().trim(), password]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const company = (await pool.query('SELECT * FROM companies WHERE id = $1', [user.company_id])).rows[0];
    res.json({ user: { ...user, password: undefined }, company });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyName, country, currency, adminName, email, password } = req.body;
    if (!companyName || !email || !password || !adminName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    await client.query('BEGIN');

    const compRes = await client.query(
      'INSERT INTO companies (name, country, base_currency, is_manager_approver) VALUES ($1, $2, $3, TRUE) RETURNING *',
      [companyName, country || '', currency || 'USD']
    );
    const company = compRes.rows[0];

    const userRes = await client.query(
      'INSERT INTO users (company_id, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [company.id, adminName, email.toLowerCase().trim(), password, 'admin']
    );
    const user = userRes.rows[0];

    await client.query('COMMIT');
    res.status(201).json({ user: { ...user, password: undefined }, company });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
//  COMPANY ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/company', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
  res.json(rows[0]);
});

app.put('/api/company', requireAuth, requireAdmin, async (req, res) => {
  const { name, country, base_currency, is_manager_approver } = req.body;
  await pool.query(
    'UPDATE companies SET name=$1, country=$2, base_currency=$3, is_manager_approver=$4 WHERE id=$5',
    [name, country, base_currency, !!is_manager_approver, req.user.company_id]
  );
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
  res.json(rows[0]);
});

// ═══════════════════════════════════════════════════════════════
//  USER ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/users', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, company_id, name, email, role, manager_id, created_at FROM users WHERE company_id = $1 ORDER BY created_at',
    [req.user.company_id]
  );
  res.json(rows);
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, manager_id } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already exists' });

    const { rows } = await pool.query(
      'INSERT INTO users (company_id, name, email, password, role, manager_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, company_id, name, email, role, manager_id, created_at',
      [req.user.company_id, name, email.toLowerCase().trim(), password || 'pass', role || 'employee', manager_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, password, role, manager_id } = req.body;
  const target = (await pool.query('SELECT * FROM users WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id])).rows[0];
  if (!target) return res.status(404).json({ error: 'User not found' });

  await pool.query(
    'UPDATE users SET name=$1, password=$2, role=$3, manager_id=$4 WHERE id=$5',
    [name || target.name, password || target.password, role || target.role, manager_id !== undefined ? (manager_id || null) : target.manager_id, target.id]
  );
  const { rows } = await pool.query('SELECT id, company_id, name, email, role, manager_id, created_at FROM users WHERE id=$1', [target.id]);
  res.json(rows[0]);
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const target = (await pool.query('SELECT * FROM users WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id])).rows[0];
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  await pool.query('DELETE FROM users WHERE id=$1', [target.id]);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
//  APPROVAL CHAIN ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/approval-chain', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT acs.*, u.name as approver_name
     FROM approval_chain_steps acs LEFT JOIN users u ON acs.approver_user_id = u.id
     WHERE acs.company_id = $1 ORDER BY acs.step_order`,
    [req.user.company_id]
  );
  res.json(rows);
});

app.put('/api/approval-chain', requireAuth, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { steps } = req.body;
    await client.query('BEGIN');
    await client.query('DELETE FROM approval_chain_steps WHERE company_id = $1', [req.user.company_id]);
    for (const step of steps) {
      await client.query(
        'INSERT INTO approval_chain_steps (company_id, step_order, approver_type, approver_user_id, label) VALUES ($1,$2,$3,$4,$5)',
        [req.user.company_id, step.step_order, step.approver_type, step.approver_user_id || null, step.label]
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query(
      `SELECT acs.*, u.name as approver_name
       FROM approval_chain_steps acs LEFT JOIN users u ON acs.approver_user_id = u.id
       WHERE acs.company_id = $1 ORDER BY acs.step_order`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update approval chain' });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
//  APPROVAL RULES (Conditional) ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/approval-rules', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ar.*, u.name as approver_name
     FROM approval_rules ar LEFT JOIN users u ON ar.specific_approver_id = u.id
     WHERE ar.company_id = $1`,
    [req.user.company_id]
  );
  res.json(rows);
});

app.put('/api/approval-rules', requireAuth, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rules } = req.body;
    await client.query('BEGIN');
    await client.query('DELETE FROM approval_rules WHERE company_id = $1', [req.user.company_id]);
    for (const rule of rules) {
      await client.query(
        'INSERT INTO approval_rules (company_id, rule_type, percentage_threshold, specific_approver_id, is_active) VALUES ($1,$2,$3,$4,$5)',
        [req.user.company_id, rule.rule_type, rule.percentage_threshold || null, rule.specific_approver_id || null, rule.is_active !== false]
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query(
      `SELECT ar.*, u.name as approver_name
       FROM approval_rules ar LEFT JOIN users u ON ar.specific_approver_id = u.id
       WHERE ar.company_id = $1`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update approval rules' });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
//  EXPENSE ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/expenses', requireAuth, async (req, res) => {
  try {
    const { scope } = req.query;
    let expenses;

    if (scope === 'all' && req.user.role === 'admin') {
      expenses = (await pool.query(
        `SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.user_id = u.id
         WHERE e.company_id = $1 ORDER BY e.created_at DESC`, [req.user.company_id]
      )).rows;
    } else if (scope === 'team' && (req.user.role === 'manager' || req.user.role === 'admin')) {
      const reportRes = await pool.query('SELECT id FROM users WHERE manager_id = $1', [req.user.id]);
      const reportIds = reportRes.rows.map(u => u.id);
      if (reportIds.length === 0) {
        expenses = [];
      } else {
        const placeholders = reportIds.map((_, i) => `$${i + 2}`).join(',');
        expenses = (await pool.query(
          `SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.user_id = u.id
           WHERE e.user_id IN (${placeholders}) AND e.company_id = $1 ORDER BY e.created_at DESC`,
          [req.user.company_id, ...reportIds]
        )).rows;
      }
    } else if (scope === 'pending') {
      expenses = (await pool.query(
        `SELECT e.*, u.name as user_name FROM expenses e
         JOIN users u ON e.user_id = u.id
         JOIN expense_approval_steps eas ON eas.expense_id = e.id AND eas.step_order = e.current_step
         WHERE e.status = 'PENDING' AND e.company_id = $1 AND eas.approver_id = $2 AND eas.status = 'PENDING'
         ORDER BY e.created_at DESC`,
        [req.user.company_id, req.user.id]
      )).rows;
    } else {
      expenses = (await pool.query(
        `SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.user_id = u.id
         WHERE e.user_id = $1 AND e.company_id = $2 ORDER BY e.created_at DESC`,
        [req.user.id, req.user.company_id]
      )).rows;
    }

    // Attach details
    for (const e of expenses) {
      e.approval_steps = (await pool.query(
        `SELECT eas.*, u.name as approver_name FROM expense_approval_steps eas
         LEFT JOIN users u ON eas.approver_id = u.id
         WHERE eas.expense_id = $1 ORDER BY eas.step_order`, [e.id]
      )).rows;
      e.approval_log = (await pool.query(
        `SELECT al.*, u.name as actor_name FROM approval_log al
         LEFT JOIN users u ON al.acted_by = u.id
         WHERE al.expense_id = $1 ORDER BY al.created_at`, [e.id]
      )).rows;
      e.lines = (await pool.query(
        'SELECT * FROM expense_lines WHERE expense_id = $1 ORDER BY sort_order', [e.id]
      )).rows;
    }

    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.get('/api/expenses/:id', requireAuth, async (req, res) => {
  try {
    const expense = (await pool.query(
      `SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.user_id = u.id
       WHERE e.id = $1 AND e.company_id = $2`, [req.params.id, req.user.company_id]
    )).rows[0];
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    expense.approval_steps = (await pool.query(
      `SELECT eas.*, u.name as approver_name FROM expense_approval_steps eas
       LEFT JOIN users u ON eas.approver_id = u.id
       WHERE eas.expense_id = $1 ORDER BY eas.step_order`, [expense.id]
    )).rows;
    expense.approval_log = (await pool.query(
      `SELECT al.*, u.name as actor_name FROM approval_log al
       LEFT JOIN users u ON al.acted_by = u.id
       WHERE al.expense_id = $1 ORDER BY al.created_at`, [expense.id]
    )).rows;
    expense.lines = (await pool.query(
      'SELECT * FROM expense_lines WHERE expense_id = $1 ORDER BY sort_order', [expense.id]
    )).rows;

    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

app.post('/api/expenses', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { description, amount, currency, converted_amount, base_currency, category, expense_date, notes, lines } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'Description and amount required' });

    const company = (await client.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id])).rows[0];
    const me = (await client.query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0];

    await client.query('BEGIN');

    // Get approval chain
    const chainSteps = (await client.query(
      'SELECT * FROM approval_chain_steps WHERE company_id = $1 ORDER BY step_order',
      [req.user.company_id]
    )).rows;

    // Filter if is_manager_approver is off
    let effectiveSteps = chainSteps;
    if (!company.is_manager_approver) {
      effectiveSteps = chainSteps.filter(s => s.approver_type !== 'manager');
    }

    const firstStep = effectiveSteps.length > 0 ? 1 : 0;
    const status = effectiveSteps.length > 0 ? 'PENDING' : 'APPROVED';

    const expRes = await client.query(
      `INSERT INTO expenses (company_id, user_id, description, amount, currency, converted_amount, base_currency, category, expense_date, notes, status, current_step)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [req.user.company_id, req.user.id, description, amount, currency, converted_amount || amount, base_currency || company.base_currency, category, expense_date, notes, status, firstStep]
    );
    const expenseId = expRes.rows[0].id;

    // Create approval step snapshots
    let stepOrder = 0;
    for (const step of effectiveSteps) {
      stepOrder++;
      let approverId = step.approver_user_id;
      if (step.approver_type === 'manager') {
        approverId = me.manager_id;
      }
      await client.query(
        'INSERT INTO expense_approval_steps (expense_id, step_order, approver_id, approver_label, status) VALUES ($1,$2,$3,$4,$5)',
        [expenseId, stepOrder, approverId, step.label, 'PENDING']
      );
    }

    await client.query(
      'INSERT INTO approval_log (expense_id, action, acted_by) VALUES ($1,$2,$3)',
      [expenseId, 'SUBMITTED', req.user.id]
    );

    // Expense lines
    if (lines && lines.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.description || line.amount) {
          await client.query(
            'INSERT INTO expense_lines (expense_id, description, amount, sort_order) VALUES ($1,$2,$3,$4)',
            [expenseId, line.description, line.amount, i + 1]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Return full expense
    const expense = (await pool.query('SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.id = $1', [expenseId])).rows[0];
    expense.approval_steps = (await pool.query('SELECT eas.*, u.name as approver_name FROM expense_approval_steps eas LEFT JOIN users u ON eas.approver_id = u.id WHERE eas.expense_id = $1 ORDER BY eas.step_order', [expenseId])).rows;
    expense.approval_log = (await pool.query('SELECT al.*, u.name as actor_name FROM approval_log al LEFT JOIN users u ON al.acted_by = u.id WHERE al.expense_id = $1 ORDER BY al.created_at', [expenseId])).rows;
    expense.lines = (await pool.query('SELECT * FROM expense_lines WHERE expense_id = $1 ORDER BY sort_order', [expenseId])).rows;
    res.status(201).json(expense);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create expense' });
  } finally {
    client.release();
  }
});

// ── Approve / Reject ──
app.post('/api/expenses/:id/action', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { action, comment } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    const expense = (await client.query(
      'SELECT * FROM expenses WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]
    )).rows[0];
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status !== 'PENDING') return res.status(400).json({ error: 'Expense is not pending' });

    await client.query('BEGIN');

    const currentStep = (await client.query(
      'SELECT * FROM expense_approval_steps WHERE expense_id = $1 AND step_order = $2',
      [expense.id, expense.current_step]
    )).rows[0];

    const isAdmin = req.user.role === 'admin';
    const isApprover = currentStep && currentStep.approver_id === req.user.id;
    if (!isApprover && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not the approver for this step' });
    }

    if (action === 'REJECTED') {
      if (currentStep) {
        await client.query(
          'UPDATE expense_approval_steps SET status=$1, comment=$2, acted_at=NOW() WHERE id=$3',
          ['REJECTED', comment || null, currentStep.id]
        );
      }
      await client.query('UPDATE expenses SET status=$1 WHERE id=$2', ['REJECTED', expense.id]);
      await client.query(
        'INSERT INTO approval_log (expense_id, action, acted_by, comment) VALUES ($1,$2,$3,$4)',
        [expense.id, isAdmin ? 'REJECTED (Admin Override)' : 'REJECTED', req.user.id, comment || null]
      );
    } else {
      // Approve this step
      if (currentStep) {
        await client.query(
          'UPDATE expense_approval_steps SET status=$1, comment=$2, acted_at=NOW() WHERE id=$3',
          ['APPROVED', comment || null, currentStep.id]
        );
      }
      await client.query(
        'INSERT INTO approval_log (expense_id, action, acted_by, comment) VALUES ($1,$2,$3,$4)',
        [expense.id, isAdmin ? 'APPROVED (Admin Override)' : 'APPROVED', req.user.id, comment || null]
      );

      // Check conditional rules
      const rules = (await client.query(
        'SELECT * FROM approval_rules WHERE company_id = $1 AND is_active = TRUE', [expense.company_id]
      )).rows;
      const allSteps = (await client.query(
        'SELECT * FROM expense_approval_steps WHERE expense_id = $1 ORDER BY step_order', [expense.id]
      )).rows;
      const approvedSteps = allSteps.filter(s => s.status === 'APPROVED');
      const totalSteps = allSteps.length;

      let autoApprove = false;
      for (const rule of rules) {
        if (rule.rule_type === 'percentage' && rule.percentage_threshold) {
          const pct = (approvedSteps.length / totalSteps) * 100;
          if (pct >= rule.percentage_threshold) autoApprove = true;
        }
        if (rule.rule_type === 'specific_approver' && rule.specific_approver_id) {
          if (approvedSteps.some(s => s.approver_id === rule.specific_approver_id)) autoApprove = true;
        }
        if (rule.rule_type === 'hybrid') {
          const pctMet = rule.percentage_threshold && (approvedSteps.length / totalSteps) * 100 >= rule.percentage_threshold;
          const approverMet = rule.specific_approver_id && approvedSteps.some(s => s.approver_id === rule.specific_approver_id);
          if (pctMet || approverMet) autoApprove = true;
        }
      }

      if (autoApprove || isAdmin) {
        await client.query(
          `UPDATE expense_approval_steps SET status='APPROVED', acted_at=NOW() WHERE expense_id=$1 AND status='PENDING'`,
          [expense.id]
        );
        await client.query(
          'UPDATE expenses SET status=$1, current_step=$2 WHERE id=$3',
          ['APPROVED', totalSteps, expense.id]
        );
        if (autoApprove && !isAdmin) {
          await client.query(
            'INSERT INTO approval_log (expense_id, action, acted_by, comment) VALUES ($1,$2,$3,$4)',
            [expense.id, 'AUTO-APPROVED (Conditional Rule)', req.user.id, 'Approval rule condition met']
          );
        }
      } else {
        const nextStep = expense.current_step + 1;
        const hasNext = allSteps.some(s => s.step_order === nextStep);
        if (hasNext) {
          await client.query('UPDATE expenses SET current_step=$1 WHERE id=$2', [nextStep, expense.id]);
        } else {
          await client.query(
            'UPDATE expenses SET status=$1, current_step=$2 WHERE id=$3',
            ['APPROVED', nextStep - 1, expense.id]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Return updated expense
    const updated = (await pool.query('SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.id = $1', [expense.id])).rows[0];
    updated.approval_steps = (await pool.query('SELECT eas.*, u.name as approver_name FROM expense_approval_steps eas LEFT JOIN users u ON eas.approver_id = u.id WHERE eas.expense_id = $1 ORDER BY eas.step_order', [expense.id])).rows;
    updated.approval_log = (await pool.query('SELECT al.*, u.name as actor_name FROM approval_log al LEFT JOIN users u ON al.acted_by = u.id WHERE al.expense_id = $1 ORDER BY al.created_at', [expense.id])).rows;
    updated.lines = (await pool.query('SELECT * FROM expense_lines WHERE expense_id = $1 ORDER BY sort_order', [expense.id])).rows;
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Pending count ──
app.get('/api/expenses/pending-count', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM expenses e
     JOIN expense_approval_steps eas ON eas.expense_id = e.id AND eas.step_order = e.current_step
     WHERE e.status = 'PENDING' AND e.company_id = $1 AND eas.approver_id = $2 AND eas.status = 'PENDING'`,
    [req.user.company_id, req.user.id]
  );
  res.json({ count: parseInt(rows[0].count) });
});

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let whereClause = 'WHERE e.company_id = $1';
    let params = [user.company_id];
    let paramIdx = 2;

    if (user.role === 'employee') {
      whereClause += ` AND e.user_id = $${paramIdx}`;
      params.push(user.id);
      paramIdx++;
    } else if (user.role === 'manager') {
      const reportRes = await pool.query('SELECT id FROM users WHERE manager_id = $1', [user.id]);
      const reportIds = reportRes.rows.map(u => u.id);
      reportIds.push(user.id);
      const placeholders = reportIds.map((_, i) => `$${paramIdx + i}`).join(',');
      whereClause += ` AND e.user_id IN (${placeholders})`;
      params.push(...reportIds);
      paramIdx += reportIds.length;
    }

    const total = (await pool.query(`SELECT COUNT(*) as c FROM expenses e ${whereClause}`, params)).rows[0].c;
    const pending = (await pool.query(`SELECT COUNT(*) as c, COALESCE(SUM(converted_amount),0) as total FROM expenses e ${whereClause} AND status = 'PENDING'`, params)).rows[0];
    const approved = (await pool.query(`SELECT COUNT(*) as c, COALESCE(SUM(converted_amount),0) as total FROM expenses e ${whereClause} AND status = 'APPROVED'`, params)).rows[0];
    const rejected = (await pool.query(`SELECT COUNT(*) as c FROM expenses e ${whereClause} AND status = 'REJECTED'`, params)).rows[0].c;

    const recent = (await pool.query(
      `SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.user_id = u.id ${whereClause} ORDER BY e.created_at DESC LIMIT 8`, params
    )).rows;
    const categories = (await pool.query(
      `SELECT category, SUM(converted_amount) as total FROM expenses e ${whereClause} AND status = 'APPROVED' GROUP BY category ORDER BY total DESC`, params
    )).rows;

    res.json({
      total: parseInt(total),
      pending: { count: parseInt(pending.c), total: parseFloat(pending.total) },
      approved: { count: parseInt(approved.c), total: parseFloat(approved.total) },
      rejected: parseInt(rejected),
      recent,
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  SPA FALLBACK
// ═══════════════════════════════════════════════════════════════

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ──
(async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`\n⚡ Expenso server running at http://localhost:${PORT}\n`);
  });
})();
