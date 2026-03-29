/* ══════════════════════════════════════════════════════════════
   STORE — API Client (replaces localStorage)
   All data flows through Express → PostgreSQL
   ══════════════════════════════════════════════════════════════ */

const Store = (() => {
  const BASE = '/api';
  let _userId = null;
  let _user = null;
  let _company = null;

  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (_userId) h['X-User-Id'] = _userId;
    return h;
  }

  async function request(method, path, body) {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ── Auth ──
  async function login(email, password) {
    const data = await request('POST', '/auth/login', { email, password });
    _userId = data.user.id;
    _user = data.user;
    _company = data.company;
    localStorage.setItem('expenso_uid', _userId);
    return data;
  }

  async function signup(companyName, country, currency, adminName, email, password) {
    const data = await request('POST', '/auth/signup', { companyName, country, currency, adminName, email, password });
    _userId = data.user.id;
    _user = data.user;
    _company = data.company;
    localStorage.setItem('expenso_uid', _userId);
    return data;
  }

  function logout() {
    _userId = null;
    _user = null;
    _company = null;
    localStorage.removeItem('expenso_uid');
  }

  function getStoredUserId() { return localStorage.getItem('expenso_uid'); }
  function getCurrentUser() { return _user; }
  function getCompanyCache() { return _company; }
  function setUser(u) { _user = u; _userId = u.id; }
  function setCompany(c) { _company = c; }

  // ── Restore session ──
  async function restoreSession() {
    const uid = getStoredUserId();
    if (!uid) return null;
    _userId = uid;
    try {
      const company = await request('GET', '/company');
      const users = await request('GET', '/users');
      const me = users.find(u => u.id === parseInt(uid));
      if (!me) { logout(); return null; }
      _user = me;
      _company = company;
      return { user: me, company };
    } catch {
      logout();
      return null;
    }
  }

  // ── Company ──
  async function getCompany() { return request('GET', '/company'); }
  async function updateCompany(data) {
    const c = await request('PUT', '/company', data);
    _company = c;
    return c;
  }

  // ── Users ──
  async function getUsers() { return request('GET', '/users'); }
  async function createUser(data) { return request('POST', '/users', data); }
  async function updateUser(id, data) { return request('PUT', `/users/${id}`, data); }
  async function deleteUser(id) { return request('DELETE', `/users/${id}`); }

  // ── Approval Chain ──
  async function getApprovalChain() { return request('GET', '/approval-chain'); }
  async function updateApprovalChain(steps) { return request('PUT', '/approval-chain', { steps }); }

  // ── Approval Rules ──
  async function getApprovalRules() { return request('GET', '/approval-rules'); }
  async function updateApprovalRules(rules) { return request('PUT', '/approval-rules', { rules }); }

  // ── Expenses ──
  async function getExpenses(scope) { return request('GET', `/expenses?scope=${scope || 'my'}`); }
  async function getExpense(id) { return request('GET', `/expenses/${id}`); }
  async function createExpense(data) { return request('POST', '/expenses', data); }
  async function actionExpense(id, action, comment) {
    return request('POST', `/expenses/${id}/action`, { action, comment });
  }
  async function getPendingCount() { return request('GET', '/expenses/pending-count'); }

  // ── Dashboard ──
  async function getDashboard() { return request('GET', '/dashboard'); }

  return {
    login, signup, logout, restoreSession, getStoredUserId,
    getCurrentUser, getCompanyCache, setUser, setCompany,
    getCompany, updateCompany,
    getUsers, createUser, updateUser, deleteUser,
    getApprovalChain, updateApprovalChain,
    getApprovalRules, updateApprovalRules,
    getExpenses, getExpense, createExpense, actionExpense, getPendingCount,
    getDashboard,
  };
})();
