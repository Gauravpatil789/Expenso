/* ══════════════════════════════════════════════════════════════
   STORE — localStorage Data Layer
   ══════════════════════════════════════════════════════════════ */

const Store = (() => {
  const PREFIX = 'expenso_';

  function get(key) {
    try { return JSON.parse(localStorage.getItem(PREFIX + key)); }
    catch { return null; }
  }
  function set(key, val) { localStorage.setItem(PREFIX + key, JSON.stringify(val)); }
  function del(key) { localStorage.removeItem(PREFIX + key); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }

  // ── Seed Data ──
  const SEED_USERS = [
    { id: 'u1', name: 'Admin User',    email: 'admin@company.com',  password: 'admin', role: 'admin',    manager: null },
    { id: 'u2', name: 'Priya Sharma',  email: 'priya@company.com',  password: 'pass',  role: 'manager',  manager: null },
    { id: 'u3', name: 'Raj Kumar',     email: 'raj@company.com',    password: 'pass',  role: 'employee', manager: 'u2' },
    { id: 'u4', name: 'Ananya Gupta',  email: 'ananya@company.com', password: 'pass',  role: 'employee', manager: 'u2' },
  ];

  const SEED_COMPANY = { name: 'TechCorp', country: 'India', baseCurrency: 'INR' };

  const SEED_EXPENSES = [
    {
      id: 'e1', userId: 'u3', description: 'Client lunch at Taj Hotel',
      amount: 3500, currency: 'INR', convertedAmount: 3500, baseCurrency: 'INR',
      category: 'Meals', date: '2026-03-20', notes: 'Met with Acme Corp team',
      status: 'PENDING', managerId: 'u2', createdAt: '2026-03-20T10:00:00Z',
      approvalLog: [{ action: 'SUBMITTED', by: 'u3', at: '2026-03-20T10:00:00Z' }]
    },
    {
      id: 'e2', userId: 'u4', description: 'Flight to Mumbai — Annual Conference',
      amount: 8200, currency: 'INR', convertedAmount: 8200, baseCurrency: 'INR',
      category: 'Travel', date: '2026-03-18', notes: 'Roundtrip economy class',
      status: 'PENDING', managerId: 'u2', createdAt: '2026-03-18T14:00:00Z',
      approvalLog: [{ action: 'SUBMITTED', by: 'u4', at: '2026-03-18T14:00:00Z' }]
    },
    {
      id: 'e3', userId: 'u3', description: 'Office supplies from Amazon',
      amount: 45, currency: 'USD', convertedAmount: 3780, baseCurrency: 'INR',
      category: 'Office', date: '2026-03-15', notes: 'Notebooks, pens, whiteboard markers',
      status: 'APPROVED', managerId: 'u2', createdAt: '2026-03-15T09:00:00Z',
      approvalLog: [
        { action: 'SUBMITTED', by: 'u3', at: '2026-03-15T09:00:00Z' },
        { action: 'APPROVED', by: 'u2', at: '2026-03-16T11:00:00Z', comment: 'Looks good' }
      ]
    },
    {
      id: 'e4', userId: 'u4', description: 'Uber rides — client visits',
      amount: 1200, currency: 'INR', convertedAmount: 1200, baseCurrency: 'INR',
      category: 'Travel', date: '2026-03-10', notes: '',
      status: 'REJECTED', managerId: 'u2', createdAt: '2026-03-10T08:00:00Z',
      approvalLog: [
        { action: 'SUBMITTED', by: 'u4', at: '2026-03-10T08:00:00Z' },
        { action: 'REJECTED', by: 'u2', at: '2026-03-11T09:30:00Z', comment: 'Missing receipt — please resubmit with receipt attached' }
      ]
    },
    {
      id: 'e5', userId: 'u3', description: 'Figma Pro — Monthly subscription',
      amount: 15, currency: 'USD', convertedAmount: 1260, baseCurrency: 'INR',
      category: 'Software', date: '2026-03-05', notes: 'Design tools subscription',
      status: 'APPROVED', managerId: 'u2', createdAt: '2026-03-05T12:00:00Z',
      approvalLog: [
        { action: 'SUBMITTED', by: 'u3', at: '2026-03-05T12:00:00Z' },
        { action: 'APPROVED', by: 'u2', at: '2026-03-06T10:00:00Z' }
      ]
    },
    {
      id: 'e6', userId: 'u4', description: 'Team dinner at ITC Grand',
      amount: 6800, currency: 'INR', convertedAmount: 6800, baseCurrency: 'INR',
      category: 'Meals', date: '2026-02-28', notes: 'Sprint retrospective celebration',
      status: 'APPROVED', managerId: 'u2', createdAt: '2026-02-28T20:00:00Z',
      approvalLog: [
        { action: 'SUBMITTED', by: 'u4', at: '2026-02-28T20:00:00Z' },
        { action: 'APPROVED', by: 'u2', at: '2026-03-01T09:00:00Z', comment: 'Approved — great team event' }
      ]
    },
  ];

  function initSeed() {
    if (!get('users')) set('users', SEED_USERS);
    if (!get('company')) set('company', SEED_COMPANY);
    if (!get('expenses')) set('expenses', SEED_EXPENSES);
  }

  // ── Data Accessors ──
  function getUsers() { return get('users') || []; }
  function getUser(id) { return getUsers().find(u => u.id === id); }
  function getUserByEmail(email) { return getUsers().find(u => u.email === email.toLowerCase().trim()); }
  function saveUsers(users) { set('users', users); }

  function getCompany() { return get('company') || {}; }
  function saveCompany(company) { set('company', company); }

  function getExpenses() { return get('expenses') || []; }
  function saveExpenses(expenses) { set('expenses', expenses); }
  function addExpense(expense) {
    const exps = getExpenses();
    exps.push(expense);
    saveExpenses(exps);
  }
  function updateExpense(id, updates) {
    const exps = getExpenses();
    const idx = exps.findIndex(e => e.id === id);
    if (idx === -1) return null;
    Object.assign(exps[idx], updates);
    saveExpenses(exps);
    return exps[idx];
  }

  function setSession(userId) { set('session', userId); }
  function getSession() { return get('session'); }
  function clearSession() { del('session'); }

  return {
    get, set, del, uid, initSeed,
    getUsers, getUser, getUserByEmail, saveUsers,
    getCompany, saveCompany,
    getExpenses, saveExpenses, addExpense, updateExpense,
    setSession, getSession, clearSession,
  };
})();
